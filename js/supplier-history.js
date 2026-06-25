/**
 * supplier-history.js - "History" tab: delivery log table + Edit Delivery Record modal.
 * Depends on: SupplierPage, Utils, UI, ReceivingRepository, InspectorRepository, PartRepository.
 */

window.SupplierHistory = (function () {
  const P = SupplierPage;

  async function load() {
    if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
    try {
      // Scoped Firestore query (where supplierId == X) instead of downloading
      // every supplier's records and filtering in JS - reads are now
      // proportional to this supplier's data, not the whole collection.
      const [supplierRecords, inspectors] = await Promise.all([
        ReceivingRepository.getBySupplier(P.activeSupplierId),
        InspectorRepository.getAll()
      ]);

      const inspectorsById = new Map(inspectors.map(i => [i.id, i.fullName]));
      let records = supplierRecords.map(rec => ({
        ...rec,
        inspectorName: inspectorsById.get(rec.inspectorId) || 'Unknown Inspector'
      }));

      // 1. Filter
      const query = P.historySearchInput.value.toLowerCase().trim();
      if (query) {
        records = records.filter(rec =>
          rec.fn.toLowerCase().includes(query) ||
          rec.detailId.toLowerCase().includes(query) ||
          rec.detailName.toLowerCase().includes(query) ||
          rec.inspectorName.toLowerCase().includes(query)
        );
      }

      // 2. Sort (shared utility - identical behavior to the previous inline comparator)
      records = Utils.sortRecords(records, P.historyState.sortColumn, P.historyState.sortOrder);

      // 3. Paginate
      const totalEntries = records.length;
      const totalPages = Math.ceil(totalEntries / P.historyState.pageSize);

      if (P.historyState.currentPage > totalPages && totalPages > 0) {
        P.historyState.currentPage = totalPages;
      }

      const startIndex = (P.historyState.currentPage - 1) * P.historyState.pageSize;
      const endIndex = Math.min(startIndex + P.historyState.pageSize, totalEntries);
      const paginated = records.slice(startIndex, endIndex);

      if (totalEntries === 0) {
        P.historyTableBody.innerHTML = '';
        P.historyEmpty.classList.remove('d-none');
        P.historyInfoSummary.textContent = 'Showing 0 to 0 of 0 entries';
        P.historyPagination.innerHTML = '';
        P.historyPagerBar.classList.add('d-none');
        return;
      }

      P.historyEmpty.classList.add('d-none');
      P.historyPagerBar.classList.remove('d-none');
      P.historyInfoSummary.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalEntries} entries`;

      Utils.renderRows(P.historyTableBody, paginated, (rec) => {
        const tr = document.createElement('tr');

        let borderClass = 'badge-record-green';
        if (rec.returnedQuantity > 0) {
          borderClass = rec.returnedQuantity === rec.checkedQuantity ? 'badge-record-red' : 'badge-record-yellow';
        }
        tr.className = borderClass;

        tr.innerHTML = `
          <td class="small fw-semibold text-nowrap">${Utils.escapeHtml(rec.date)}</td>
          <td><code class="text-secondary fw-semibold">${Utils.escapeHtml(rec.fn)}</code></td>
          <td><span class="badge bg-light text-dark font-monospace">${Utils.escapeHtml(rec.detailId)}</span></td>
          <td class="text-truncate" style="max-width: 180px;" title="${Utils.escapeHtml(rec.detailName)}">${Utils.escapeHtml(rec.detailName)}</td>
          <td class="text-end fw-semibold">${rec.quantity}</td>
          <td class="text-end text-success">${rec.checkedQuantity}</td>
          <td class="text-end text-danger">${rec.returnedQuantity}</td>
          <td class="small">${Utils.escapeHtml(rec.inspectorName)}</td>
          <td class="text-center text-nowrap">
            <button class="btn btn-outline-primary btn-sm border-0 py-0 px-1 me-1 edit-rec-btn" data-id="${rec.id}" aria-label="Edit record">
              <i class="bi bi-pencil-fill"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm border-0 py-0 px-1 delete-rec-btn" data-id="${rec.id}" aria-label="Delete record">
              <i class="bi bi-trash-fill"></i>
            </button>
          </td>
        `;

        tr.querySelector('.delete-rec-btn').addEventListener('click', () => {
          UI.confirm(
            'Delete Record?',
            `Are you sure you want to delete PO record ${rec.fn}? This cannot be undone.`,
            async () => {
              if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
              try {
                await ReceivingRepository.remove(rec.id, P.activeSupplierId);
                UI.showToast('Record deleted.');
                await SupplierList.load();
                await load();
              } catch (err) {
                console.error(err);
                UI.showToast('Failed to delete record.', 'error');
              } finally {
                if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
              }
            }
          );
        });

        tr.querySelector('.edit-rec-btn').addEventListener('click', async () => {
          await openEditRecordModal(rec);
        });

        return tr;
      });

      Utils.renderPagination(P.historyPagination, totalPages, P.historyState, load);
    } catch (err) {
      console.error(err);
    } finally {
      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
    }
  }

  async function openEditRecordModal(rec) {
    if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
    try {
      // Independent collections needed to populate the two <select> elements - parallel load.
      const [inspectors, parts] = await Promise.all([
        InspectorRepository.getAll(),
        PartRepository.getBySupplier(P.activeSupplierId)
      ]);

      P.editRecInspector.innerHTML = '';
      inspectors.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)).forEach(ins => {
        const opt = document.createElement('option');
        opt.value = ins.id;
        opt.textContent = ins.fullName;
        if (ins.id === rec.inspectorId) opt.selected = true;
        P.editRecInspector.appendChild(opt);
      });

      P.editRecPart.innerHTML = '';
      parts.slice().sort((a, b) => a.detailId.localeCompare(b.detailId)).forEach(part => {
        const opt = document.createElement('option');
        opt.value = part.detailId;
        opt.textContent = `${part.detailId} - ${part.detailName}`;
        opt.dataset.name = part.detailName;
        if (part.detailId === rec.detailId) opt.selected = true;
        P.editRecPart.appendChild(opt);
      });

      P.editRecId.value = rec.id;
      P.editRecDate.value = rec.date;
      P.editRecFn.value = rec.fn;
      P.editRecQty.value = rec.quantity;
      P.editRecChecked.value = rec.checkedQuantity;
      P.editRecReturned.value = rec.returnedQuantity;
      P.editRecComment.value = rec.comment || '';

      P.editRecordForm.classList.remove('was-validated');
      P.editRecChecked.classList.remove('is-invalid');
      P.editRecReturned.classList.remove('is-invalid');

      P.editRecordModal.show();
    } catch (err) {
      console.error(err);
      UI.showToast('Failed to load record details.', 'error');
    } finally {
      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
    }
  }

  function bindEvents() {
    P.historySearchInput.addEventListener('input', Utils.debounce(() => {
      P.historyState.currentPage = 1;
      load();
    }, 250));

    Utils.bindSortableHeaders('#history-table', P.historyState, load);

    P.editRecordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!P.editRecordForm.checkValidity()) {
        e.stopPropagation();
        P.editRecordForm.classList.add('was-validated');
        return;
      }

      const qty = Number(P.editRecQty.value);
      const checked = Number(P.editRecChecked.value);
      const returned = Number(P.editRecReturned.value);

      // Shared validator - identical business rule to the Register page form.
      const { checkedValid, returnedValid } = Utils.validateQuantities(qty, checked, returned);

      P.editRecChecked.classList.toggle('is-invalid', !checkedValid);
      P.editRecReturned.classList.toggle('is-invalid', !returnedValid);

      if (!checkedValid || !returnedValid) return;

      const id = P.editRecId.value;
      const selectedPartOpt = P.editRecPart.options[P.editRecPart.selectedIndex];
      const detailName = selectedPartOpt.dataset.name;
      const supplierName = P.detailSupplierName.textContent;
      const inspectorName = P.editRecInspector.options[P.editRecInspector.selectedIndex].textContent;

      const updatedData = {
        date: P.editRecDate.value,
        fn: P.editRecFn.value,
        supplierId: P.activeSupplierId,
        supplierName,
        inspectorId: P.editRecInspector.value,
        inspectorName,
        detailId: P.editRecPart.value,
        detailName,
        quantity: qty,
        checkedQuantity: checked,
        returnedQuantity: returned,
        comment: P.editRecComment.value || 'OK'
      };

      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
      try {
        await ReceivingRepository.update(id, updatedData);
        UI.showToast('Delivery record updated successfully.');
        P.editRecordModal.hide();
        await load();
      } catch (err) {
        console.error(err);
        UI.showToast('Failed to update record.', 'error');
      } finally {
        if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
      }
    });
  }

  return { load, openEditRecordModal, bindEvents };
})();
