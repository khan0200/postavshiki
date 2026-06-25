/**
 * supplier-parts.js - "Parts List" tab: parts catalog table, part CRUD,
 * and the Transfer Production Rights modal.
 * Depends on: SupplierPage, Utils, UI, PartRepository, SupplierRepository.
 */

window.SupplierParts = (function () {
  const P = SupplierPage;

  async function load() {
    if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
    try {
      let parts = await PartRepository.getBySupplier(P.activeSupplierId);

      // 1. Filter
      const query = P.partsSearchInput.value.toLowerCase().trim();
      if (query) {
        parts = parts.filter(p =>
          p.detailId.toLowerCase().includes(query) ||
          p.detailName.toLowerCase().includes(query)
        );
      }

      // 2. Sort (shared utility)
      parts = Utils.sortRecords(parts.slice(), P.partsState.sortColumn, P.partsState.sortOrder);

      // 3. Paginate
      const totalEntries = parts.length;
      const totalPages = Math.ceil(totalEntries / P.partsState.pageSize);

      if (P.partsState.currentPage > totalPages && totalPages > 0) {
        P.partsState.currentPage = totalPages;
      }

      const startIndex = (P.partsState.currentPage - 1) * P.partsState.pageSize;
      const endIndex = Math.min(startIndex + P.partsState.pageSize, totalEntries);
      const paginated = parts.slice(startIndex, endIndex);

      if (totalEntries === 0) {
        P.partsTableBody.innerHTML = '';
        P.partsEmpty.classList.remove('d-none');
        P.partsInfoSummary.textContent = 'Showing 0 to 0 of 0 entries';
        P.partsPagination.innerHTML = '';
        P.partsPagerBar.classList.add('d-none');
        return;
      }

      P.partsEmpty.classList.add('d-none');
      P.partsPagerBar.classList.remove('d-none');
      P.partsInfoSummary.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalEntries} entries`;

      Utils.renderRows(P.partsTableBody, paginated, (part) => {
        const tr = document.createElement('tr');
        const formattedDate = new Date(part.createdAt).toLocaleDateString();

        tr.innerHTML = `
          <td><strong class="text-primary font-monospace">${Utils.escapeHtml(part.detailId)}</strong></td>
          <td>${Utils.escapeHtml(part.detailName)}</td>
          <td class="small text-muted">${Utils.escapeHtml(formattedDate)}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary btn-edit-part" data-id="${part.id}" title="Edit Name" aria-label="Edit part">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-outline-primary btn-transfer-part" data-id="${part.id}" title="Transfer Production Rights" aria-label="Transfer part to another supplier">
                <i class="bi bi-arrow-left-right"></i>
              </button>
              <button class="btn btn-outline-danger btn-delete-part" data-id="${part.id}" title="Delete Part" aria-label="Delete part">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        `;

        tr.querySelector('.btn-edit-part').addEventListener('click', () => {
          openPartModalForEdit(part);
        });

        tr.querySelector('.btn-transfer-part').addEventListener('click', async () => {
          await openTransferModal(part);
        });

        tr.querySelector('.btn-delete-part').addEventListener('click', () => {
          UI.confirm(
            'Delete Part?',
            `Remove "${part.detailId} - ${part.detailName}" from this supplier? Incoming registration dropdowns will stop displaying it. Historical logs are untouched.`,
            async () => {
              if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
              try {
                await PartRepository.remove(part.id, P.activeSupplierId);
                UI.showToast('Part deleted.');
                await load();
                await SupplierList.load();
              } catch (err) {
                console.error(err);
                UI.showToast('Failed to delete part.', 'error');
              } finally {
                if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
              }
            }
          );
        });

        return tr;
      });

      Utils.renderPagination(P.partsPagination, totalPages, P.partsState, load);
    } catch (err) {
      console.error(err);
    } finally {
      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
    }
  }

  function openPartModalForEdit(part) {
    P.editPartIdInput.value = part.id;
    P.partDetailIdInput.value = part.detailId;
    P.partDetailIdInput.disabled = false;
    P.partDetailNameInput.value = part.detailName;
    P.partModalLabel.textContent = 'Edit Part Description';
    P.partForm.classList.remove('was-validated');
    P.partModal.show();
  }

  async function openTransferModal(part) {
    P.transferPartIdInput.value = part.id;
    P.transferPartDisplay.textContent = `${part.detailId} (${part.detailName})`;

    try {
      const suppliers = await SupplierRepository.getAll();
      const destinations = suppliers.filter(s => s.id !== P.activeSupplierId);

      P.transferDestinationSelect.innerHTML = '<option value="" selected disabled>Select Destination...</option>';

      if (destinations.length === 0) {
        UI.showToast('No other suppliers available to transfer to. Create another supplier first.', 'error');
        return;
      }

      destinations.sort((a, b) => a.name.localeCompare(b.name)).forEach(dest => {
        const opt = document.createElement('option');
        opt.value = dest.id;
        opt.textContent = dest.name;
        P.transferDestinationSelect.appendChild(opt);
      });

      P.transferForm.classList.remove('was-validated');
      P.transferModal.show();
    } catch (err) {
      console.error(err);
    }
  }

  function bindEvents() {
    P.partsSearchInput.addEventListener('input', Utils.debounce(() => {
      P.partsState.currentPage = 1;
      load();
    }, 250));

    Utils.bindSortableHeaders('#parts-table', P.partsState, load);

    P.btnAddPart.addEventListener('click', () => {
      P.editPartIdInput.value = '';
      P.partDetailIdInput.value = '';
      P.partDetailIdInput.disabled = false;
      P.partDetailNameInput.value = '';
      P.partModalLabel.textContent = 'Add Supplier Part';
      P.partForm.classList.remove('was-validated');
      P.partModal.show();
    });

    P.partForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!P.partForm.checkValidity()) {
        e.stopPropagation();
        P.partForm.classList.add('was-validated');
        return;
      }

      const id = P.editPartIdInput.value;
      const detailId = P.partDetailIdInput.value.trim().toUpperCase();
      const detailName = P.partDetailNameInput.value.trim();

      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
      try {
        if (id) {
          await PartRepository.update(id, P.activeSupplierId, detailId, detailName);
          UI.showToast('Part details updated.');
        } else {
          const existing = await PartRepository.getBySupplier(P.activeSupplierId);
          if (existing.some(p => p.detailId.toUpperCase() === detailId)) {
            UI.showToast('This Detail ID already exists for this supplier.', 'error');
            if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
            return;
          }
          const supplierName = P.detailSupplierName.textContent;
          await PartRepository.add(P.activeSupplierId, detailId, detailName, supplierName);
          UI.showToast('New part registered.');
        }
        P.partModal.hide();
        await load();
        await SupplierList.load();
      } catch (err) {
        console.error(err);
        UI.showToast('Failed to save part.', 'error');
      } finally {
        if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
      }
    });

    P.transferForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!P.transferForm.checkValidity()) {
        e.stopPropagation();
        P.transferForm.classList.add('was-validated');
        return;
      }

      const partId = P.transferPartIdInput.value;
      const targetSupplierId = P.transferDestinationSelect.value;
      const targetSupplierName = P.transferDestinationSelect.options[P.transferDestinationSelect.selectedIndex].text;

      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
      try {
        await PartRepository.transfer(partId, P.activeSupplierId, targetSupplierId, targetSupplierName);
        UI.showToast(`Part successfully transferred to ${targetSupplierName}.`);

        P.transferModal.hide();

        await load();
        await SupplierList.load();
      } catch (err) {
        console.error(err);
        UI.showToast('Transfer failed.', 'error');
      } finally {
        if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
      }
    });
  }

  return { load, openPartModalForEdit, openTransferModal, bindEvents };
})();
