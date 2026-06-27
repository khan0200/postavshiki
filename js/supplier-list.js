/**
 * supplier-list.js - Supplier directory (left panel list, search, CRUD modals).
 * Depends on: SupplierPage (supplier-state.js), Utils, UI, SupplierRepository,
 * PartRepository, ReceivingRepository.
 */

window.SupplierList = (function () {
  const P = SupplierPage;

  async function load() {
    if (P.supplierListSpinner) P.supplierListSpinner.classList.add('active');
    try {
      const query = P.searchSupplierInput.value.toLowerCase().trim();

      // Independent collections - loaded in parallel instead of sequentially.
      const [suppliers, parts] = await Promise.all([
        SupplierRepository.getAll(),
        PartRepository.getAll()
      ]);

      const filtered = suppliers.filter(s => s.name.toLowerCase().includes(query));

      if (filtered.length === 0) {
        P.suppliersListContainer.innerHTML = '';
        P.supplierListEmpty.classList.remove('d-none');
        return;
      }
      P.supplierListEmpty.classList.add('d-none');

      const sorted = filtered.slice().sort((a, b) => {
        const countA = parts.filter(p => p.supplierId === a.id).length;
        const countB = parts.filter(p => p.supplierId === b.id).length;
        if (countB !== countA) return countB - countA;
        return a.name.localeCompare(b.name);
      });

      Utils.renderRows(P.suppliersListContainer, sorted, (sup) => {
        const supPartsCount = parts.filter(p => p.supplierId === sup.id).length;

        const item = document.createElement('a');
        item.href = '#';
        item.dataset.id = sup.id;
        item.className = `list-group-item list-group-item-action border-bottom py-3 px-3 ${sup.id === P.activeSupplierId ? 'active' : ''}`;
        item.innerHTML = `
          <div class="d-flex w-100 justify-content-between align-items-center mb-1">
            <h6 class="mb-0 fw-bold">${Utils.escapeHtml(sup.name)}</h6>
            <i class="bi bi-chevron-right small text-muted"></i>
          </div>
          <div class="d-flex gap-2 mt-2">
            <span class="badge badge-parts small rounded-pill">
              <i class="bi bi-box me-1"></i>${supPartsCount} ta detal
            </span>
          </div>
        `;

        item.addEventListener('click', async (e) => {
          e.preventDefault();
          await selectSupplier(sup.id);
        });
        return item;
      });
    } catch (err) {
      console.error('Error loading suppliers list:', err);
    } finally {
      if (P.supplierListSpinner) P.supplierListSpinner.classList.remove('active');
    }
  }

  async function selectSupplier(id) {
    P.activeSupplierId = id;
    if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
    try {
      const activeSupplier = await SupplierRepository.getById(id);

      if (activeSupplier) {
        P.detailSupplierName.textContent = activeSupplier.name;
        P.btnEditSupplier.disabled = false;
        P.btnDeleteSupplier.disabled = false;
        if (P.btnImportCsv) P.btnImportCsv.disabled = false;

        P.historyState.currentPage = 1;
        P.partsState.currentPage = 1;

        if (P.historyFilterInspector) {
          P.historyFilterInspector.innerHTML = '<option value="">Barcha inspektorlar</option>';
          P.historyFilterInspector.value = '';
        }
        if (P.historyFilterPart) {
          P.historyFilterPart.innerHTML = '<option value="">Barcha detallar</option>';
          P.historyFilterPart.value = '';
        }

        await P.renderActiveTab();
      }

      updateActiveSupplierHighlight();
    } catch (err) {
      console.error(err);
    } finally {
      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
    }
  }

  function updateDetailCardState() {
    if (!P.activeSupplierId) {
      P.detailSupplierName.textContent = 'Yetkazib beruvchini tanlang';
      P.btnEditSupplier.disabled = true;
      P.btnDeleteSupplier.disabled = true;
      if (P.btnImportCsv) P.btnImportCsv.disabled = true;
      if (P.historyRecsCount) P.historyRecsCount.textContent = '';

      P.historyTableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Katalogdan yetkazib beruvchini tanlang</td></tr>';
      P.partsTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Katalogdan yetkazib beruvchini tanlang</td></tr>';
      P.historyPagerBar.classList.add('d-none');
      P.partsPagerBar.classList.add('d-none');

      if (P.incomingChart) {
        P.incomingChart.destroy();
        P.incomingChart = null;
      }
      if (P.returnedChart) {
        P.returnedChart.destroy();
        P.returnedChart = null;
      }
    }
  }

  function updateActiveSupplierHighlight() {
    const items = P.suppliersListContainer.querySelectorAll('.list-group-item');
    items.forEach(item => {
      item.classList.toggle('active', item.dataset.id === P.activeSupplierId);
    });
  }

  function bindEvents() {
    P.searchSupplierInput.addEventListener('input', Utils.debounce(() => load(), 250));

    P.btnAddSupplier.addEventListener('click', () => {
      P.editSupplierIdInput.value = '';
      P.supplierNameInput.value = '';
      P.supplierModalLabel.textContent = 'Yangi yetkazib beruvchi qo\'shish';
      P.supplierForm.classList.remove('was-validated');
      P.supplierModal.show();
    });

    P.btnEditSupplier.addEventListener('click', async () => {
      try {
        const sup = await SupplierRepository.getById(P.activeSupplierId);
        if (sup) {
          P.editSupplierIdInput.value = sup.id;
          P.supplierNameInput.value = sup.name;
          P.supplierModalLabel.textContent = 'Nomini o\'zgartirish';
          P.supplierForm.classList.remove('was-validated');
          P.supplierModal.show();
        }
      } catch (err) {
        console.error(err);
      }
    });

    P.supplierForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!P.supplierForm.checkValidity()) {
        e.stopPropagation();
        P.supplierForm.classList.add('was-validated');
        return;
      }

      const id = P.editSupplierIdInput.value;
      const name = P.supplierNameInput.value;

      if (P.supplierListSpinner) P.supplierListSpinner.classList.add('active');
      try {
        if (id) {
          await SupplierRepository.rename(id, name);
          UI.showToast('Yetkazib beruvchi nomi muvaffaqiyatli o\'zgartirildi.');
          await load();
          await selectSupplier(id);
        } else {
          const newSup = await SupplierRepository.add(name);
          UI.showToast('Yetkazib beruvchi ro\'yxatga olindi.');
          await load();
          await selectSupplier(newSup.id);
        }
        P.supplierModal.hide();
      } catch (err) {
        console.error(err);
        UI.showToast('Yetkazib beruvchini saqlashda xatolik yuz berdi.', 'error');
      } finally {
        if (P.supplierListSpinner) P.supplierListSpinner.classList.remove('active');
      }
    });

    P.btnDeleteSupplier.addEventListener('click', async () => {
      try {
        const sup = await SupplierRepository.getById(P.activeSupplierId);
        if (!sup) return;

        UI.confirm(
          'Yetkazib beruvchini o\'chirish?',
          `"${sup.name}" yetkazib beruvchisini o'chirasizmi? Bu ushbu yetkazib beruvchi bilan bog'liq barcha faol detallarni o'chirib tashlaydi. Tarixiy yozuvlar saqlab qolinadi.`,
          async () => {
            if (P.supplierListSpinner) P.supplierListSpinner.classList.add('active');
            if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
            try {
              await SupplierRepository.remove(P.activeSupplierId);
              UI.showToast('Yetkazib beruvchi o\'chirildi.');

              P.activeSupplierId = null;

              await load();
              updateDetailCardState();
            } catch (err) {
              console.error(err);
              UI.showToast('Yetkazib beruvchini o\'chirishda xatolik yuz berdi.', 'error');
            } finally {
              if (P.supplierListSpinner) P.supplierListSpinner.classList.remove('active');
              if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
            }
          }
        );
      } catch (err) {
        console.error(err);
      }
    });
  }

  return { load, selectSupplier, updateDetailCardState, updateActiveSupplierHighlight, bindEvents };
})();
