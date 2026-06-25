/**
 * supplier.js - Suppliers page controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize shared navbar
  UI.initNavbar('supplier.html');

  // DOM Elements - Left Panel
  const searchSupplierInput = document.getElementById('supplier-search');
  const suppliersListContainer = document.getElementById('suppliers-list');
  const supplierListEmpty = document.getElementById('supplier-list-empty');
  const btnAddSupplier = document.getElementById('btn-add-supplier');
  const supplierListSpinner = document.getElementById('supplier-list-spinner');

  // DOM Elements - Right Panel
  const detailCard = document.getElementById('supplier-detail-card');
  const detailSupplierName = document.getElementById('detail-supplier-name');
  const btnEditSupplier = document.getElementById('btn-edit-supplier');
  const btnDeleteSupplier = document.getElementById('btn-delete-supplier');
  const supplierDetailSpinner = document.getElementById('supplier-detail-spinner');

  // Tab - History
  const historySearchInput = document.getElementById('history-search');
  const historyTableBody = document.getElementById('history-table-body');
  const historyEmpty = document.getElementById('history-empty');
  const historyInfoSummary = document.getElementById('history-info-summary');
  const historyPagination = document.getElementById('history-pagination');
  const historyPagerBar = document.getElementById('history-pager-bar');

  // Tab - Parts
  const partsSearchInput = document.getElementById('parts-search');
  const partsTableBody = document.getElementById('parts-table-body');
  const partsEmpty = document.getElementById('parts-empty');
  const partsInfoSummary = document.getElementById('parts-info-summary');
  const partsPagination = document.getElementById('parts-pagination');
  const partsPagerBar = document.getElementById('parts-pager-bar');
  const btnAddPart = document.getElementById('btn-add-part');

  // Tab - Charts
  const chartYearSelect = document.getElementById('chart-year');
  const chartMonthSelect = document.getElementById('chart-month');

  // Modals & Forms
  const supplierModalElem = document.getElementById('supplierModal');
  const supplierModal = new bootstrap.Modal(supplierModalElem);
  const supplierForm = document.getElementById('supplier-form');
  const supplierNameInput = document.getElementById('supplier-name-input');
  const editSupplierIdInput = document.getElementById('edit-supplier-id');
  const supplierModalLabel = document.getElementById('supplierModalLabel');

  const partModalElem = document.getElementById('partModal');
  const partModal = new bootstrap.Modal(partModalElem);
  const partForm = document.getElementById('part-form');
  const partDetailIdInput = document.getElementById('part-detail-id-input');
  const partDetailNameInput = document.getElementById('part-detail-name-input');
  const editPartIdInput = document.getElementById('edit-part-id');
  const partModalLabel = document.getElementById('partModalLabel');

  const transferModalElem = document.getElementById('transferModal');
  const transferModal = new bootstrap.Modal(transferModalElem);
  const transferForm = document.getElementById('transfer-form');
  const transferPartIdInput = document.getElementById('transfer-part-id');
  const transferPartDisplay = document.getElementById('transfer-part-display');
  const transferDestinationSelect = document.getElementById('transfer-destination-select');

  // State Management
  let activeSupplierId = null;
  let activeTab = 'history'; // history | parts | charts

  // Tables paging & sorting state
  let historyState = {
    searchQuery: '',
    sortColumn: 'date',
    sortOrder: 'desc',
    currentPage: 1,
    pageSize: 30
  };

  let partsState = {
    searchQuery: '',
    sortColumn: 'detailId',
    sortOrder: 'asc',
    currentPage: 1,
    pageSize: 30
  };

  // Chart instances holders
  let incomingChart = null;
  let returnedChart = null;

  // --- INITIALIZATION ---
  async function init() {
    await loadSuppliersList();
    await initYearSelector();
    
    // Auto-select first supplier if available
    const suppliers = await AppStorage.getSuppliers();
    if (suppliers.length > 0) {
      await selectSupplier(suppliers[0].id);
    } else {
      updateDetailCardState();
    }
  }

  // --- SUPPLIER DIRECTORY LOGIC ---
  async function loadSuppliersList() {
    if (supplierListSpinner) supplierListSpinner.classList.add('active');
    try {
      const suppliers = await AppStorage.getSuppliers();
      const query = searchSupplierInput.value.toLowerCase().trim();

      // Calculate part and record stats
      const parts = await AppStorage.getParts();
      const records = await AppStorage.getReceivingRecords();

      const filtered = suppliers.filter(s => s.name.toLowerCase().includes(query));

      suppliersListContainer.innerHTML = '';
      
      if (filtered.length === 0) {
        supplierListEmpty.classList.remove('d-none');
        return;
      }
      supplierListEmpty.classList.add('d-none');

      filtered.sort((a, b) => {
        const countA = parts.filter(p => p.supplierId === a.id).length;
        const countB = parts.filter(p => p.supplierId === b.id).length;
        if (countB !== countA) {
          return countB - countA;
        }
        return a.name.localeCompare(b.name);
      }).forEach(sup => {
        const supPartsCount = parts.filter(p => p.supplierId === sup.id).length;
        const supRecordsCount = records.filter(r => r.supplierId === sup.id).length;

        const item = document.createElement('a');
        item.href = '#';
        item.className = `list-group-item list-group-item-action border-bottom py-3 px-3 ${sup.id === activeSupplierId ? 'active' : ''}`;
        item.innerHTML = `
          <div class="d-flex w-100 justify-content-between align-items-center mb-1">
            <h6 class="mb-0 fw-bold">${sup.name}</h6>
            <i class="bi bi-chevron-right small text-muted"></i>
          </div>
          <div class="d-flex gap-2 mt-2">
            <span class="badge bg-secondary-subtle text-secondary small border rounded-pill">
              <i class="bi bi-box me-1"></i>${supPartsCount} Parts
            </span>
            <span class="badge bg-secondary-subtle text-secondary small border rounded-pill">
              <i class="bi bi-clock-history me-1"></i>${supRecordsCount} Recs
            </span>
          </div>
        `;
        
        item.addEventListener('click', async (e) => {
          e.preventDefault();
          await selectSupplier(sup.id);
        });
        suppliersListContainer.appendChild(item);
      });
    } catch (err) {
      console.error('Error loading suppliers list:', err);
    } finally {
      if (supplierListSpinner) supplierListSpinner.classList.remove('active');
    }
  }

  searchSupplierInput.addEventListener('input', async () => {
    await loadSuppliersList();
  });

  // Select supplier
  async function selectSupplier(id) {
    activeSupplierId = id;
    if (supplierDetailSpinner) supplierDetailSpinner.classList.add('active');
    try {
      const suppliers = await AppStorage.getSuppliers();
      const activeSupplier = suppliers.find(s => s.id === id);

      if (activeSupplier) {
        detailSupplierName.textContent = activeSupplier.name;
        btnEditSupplier.disabled = false;
        btnDeleteSupplier.disabled = false;
        
        // Reset tables paging states
        historyState.currentPage = 1;
        partsState.currentPage = 1;

        // Re-load tabs contents
        await renderActiveTab();
      }
      
      // Rerender supplier list to update active class highlight
      await loadSuppliersList();
    } catch (err) {
      console.error(err);
    } finally {
      if (supplierDetailSpinner) supplierDetailSpinner.classList.remove('active');
    }
  }

  function updateDetailCardState() {
    if (!activeSupplierId) {
      detailSupplierName.textContent = 'Select a Supplier';
      btnEditSupplier.disabled = true;
      btnDeleteSupplier.disabled = true;
      
      // Hide logs, show placeholders
      historyTableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Select a supplier from directory</td></tr>';
      partsTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Select a supplier from directory</td></tr>';
      historyPagerBar.classList.add('d-none');
      partsPagerBar.classList.add('d-none');
    }
  }

  // --- SUPPLIER CRUD MODALS ---
  btnAddSupplier.addEventListener('click', () => {
    editSupplierIdInput.value = '';
    supplierNameInput.value = '';
    supplierModalLabel.textContent = 'Add New Supplier';
    supplierForm.classList.remove('was-validated');
    supplierModal.show();
  });

  btnEditSupplier.addEventListener('click', async () => {
    try {
      const sup = await AppStorage.getSupplierById(activeSupplierId);
      if (sup) {
        editSupplierIdInput.value = sup.id;
        supplierNameInput.value = sup.name;
        supplierModalLabel.textContent = 'Rename Supplier';
        supplierForm.classList.remove('was-validated');
        supplierModal.show();
      }
    } catch (err) {
      console.error(err);
    }
  });

  supplierForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supplierForm.checkValidity()) {
      e.stopPropagation();
      supplierForm.classList.add('was-validated');
      return;
    }

    const id = editSupplierIdInput.value;
    const name = supplierNameInput.value;

    if (supplierListSpinner) supplierListSpinner.classList.add('active');
    try {
      if (id) {
        // Edit
        await AppStorage.updateSupplier(id, name);
        UI.showToast('Supplier renamed successfully.');
        await selectSupplier(id);
      } else {
        // Create
        const newSup = await AppStorage.addSupplier(name);
        UI.showToast('Supplier registered.');
        await selectSupplier(newSup.id);
      }
      supplierModal.hide();
    } catch (err) {
      console.error(err);
      UI.showToast('Failed to save supplier.', 'error');
    } finally {
      if (supplierListSpinner) supplierListSpinner.classList.remove('active');
    }
  });

  btnDeleteSupplier.addEventListener('click', async () => {
    try {
      const sup = await AppStorage.getSupplierById(activeSupplierId);
      if (!sup) return;

      UI.confirm(
        'Delete Supplier?',
        `Delete "${sup.name}"? This removes all active parts associated with this supplier. Historical logs will be preserved.`,
        async () => {
          if (supplierListSpinner) supplierListSpinner.classList.add('active');
          if (supplierDetailSpinner) supplierDetailSpinner.classList.add('active');
          try {
            await AppStorage.deleteSupplier(activeSupplierId);
            UI.showToast('Supplier deleted.');
            
            // Reset active selection
            const suppliers = await AppStorage.getSuppliers();
            activeSupplierId = suppliers.length > 0 ? suppliers[0].id : null;
            
            await loadSuppliersList();
            if (activeSupplierId) {
              await selectSupplier(activeSupplierId);
            } else {
              updateDetailCardState();
            }
          } catch (err) {
            console.error(err);
            UI.showToast('Failed to delete supplier.', 'error');
          } finally {
            if (supplierListSpinner) supplierListSpinner.classList.remove('active');
            if (supplierDetailSpinner) supplierDetailSpinner.classList.remove('active');
          }
        }
      );
    } catch (err) {
      console.error(err);
    }
  });


  // --- TABS SWITCHING ENGINE ---
  document.querySelectorAll('#supplierTabs button').forEach(tabBtn => {
    tabBtn.addEventListener('shown.bs.tab', async (e) => {
      const id = e.target.id;
      if (id === 'history-tab') activeTab = 'history';
      else if (id === 'parts-tab') activeTab = 'parts';
      else if (id === 'charts-tab') activeTab = 'charts';
      
      await renderActiveTab();
    });
  });

  async function renderActiveTab() {
    if (!activeSupplierId) return;

    if (activeTab === 'history') {
      await loadHistoryTable();
    } else if (activeTab === 'parts') {
      await loadPartsTable();
    } else if (activeTab === 'charts') {
      await renderCharts();
    }
  }


  // --- TAB 1: HISTORY LOG TABLE ---
  async function loadHistoryTable() {
    if (supplierDetailSpinner) supplierDetailSpinner.classList.add('active');
    try {
      const allRecords = await AppStorage.getReceivingRecords();
      const inspectors = await AppStorage.getInspectors();
      
      // Gather and format records for active supplier
      let supplierRecords = allRecords.filter(r => r.supplierId === activeSupplierId).map(rec => {
        const ins = inspectors.find(i => i.id === rec.inspectorId);
        return {
          ...rec,
          inspectorName: ins ? ins.fullName : 'Unknown Inspector'
        };
      });

      // 1. Filter
      const query = historySearchInput.value.toLowerCase().trim();
      if (query) {
        supplierRecords = supplierRecords.filter(rec => 
          rec.fn.toLowerCase().includes(query) ||
          rec.detailId.toLowerCase().includes(query) ||
          rec.detailName.toLowerCase().includes(query) ||
          rec.inspectorName.toLowerCase().includes(query)
        );
      }

      // 2. Sort
      supplierRecords.sort((a, b) => {
        let valA = a[historyState.sortColumn];
        let valB = b[historyState.sortColumn];

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return historyState.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return historyState.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // 3. Paginate
      const totalEntries = supplierRecords.length;
      const totalPages = Math.ceil(totalEntries / historyState.pageSize);
      
      if (historyState.currentPage > totalPages && totalPages > 0) {
        historyState.currentPage = totalPages;
      }

      const startIndex = (historyState.currentPage - 1) * historyState.pageSize;
      const endIndex = Math.min(startIndex + historyState.pageSize, totalEntries);
      const paginated = supplierRecords.slice(startIndex, endIndex);

      // Render Rows
      historyTableBody.innerHTML = '';
      
      if (totalEntries === 0) {
        historyEmpty.classList.remove('d-none');
        historyInfoSummary.textContent = 'Showing 0 to 0 of 0 entries';
        historyPagination.innerHTML = '';
        historyPagerBar.classList.add('d-none');
        return;
      }
      
      historyEmpty.classList.add('d-none');
      historyPagerBar.classList.remove('d-none');
      historyInfoSummary.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalEntries} entries`;

      paginated.forEach(rec => {
        const tr = document.createElement('tr');
        
        let borderClass = 'badge-record-green';
        if (rec.returnedQuantity > 0) {
          if (rec.returnedQuantity === rec.checkedQuantity) {
            borderClass = 'badge-record-red';
          } else {
            borderClass = 'badge-record-yellow';
          }
        }
        tr.className = borderClass;

        tr.innerHTML = `
          <td class="small fw-semibold text-nowrap">${rec.date}</td>
          <td><code class="text-secondary fw-semibold">${rec.fn}</code></td>
          <td><span class="badge bg-light text-dark font-monospace">${rec.detailId}</span></td>
          <td class="text-truncate" style="max-width: 180px;" title="${rec.detailName}">${rec.detailName}</td>
          <td class="text-end fw-semibold">${rec.quantity}</td>
          <td class="text-end text-success">${rec.checkedQuantity}</td>
          <td class="text-end text-danger">${rec.returnedQuantity}</td>
          <td class="small">${rec.inspectorName}</td>
        `;
        historyTableBody.appendChild(tr);
      });

      renderPagination(historyPagination, totalPages, historyState, loadHistoryTable);
    } catch (err) {
      console.error(err);
    } finally {
      if (supplierDetailSpinner) supplierDetailSpinner.classList.remove('active');
    }
  }

  historySearchInput.addEventListener('input', async () => {
    historyState.currentPage = 1;
    await loadHistoryTable();
  });

  // Tab 1 Sorting Triggers
  document.querySelectorAll('#history-table .sortable-header').forEach(header => {
    header.addEventListener('click', async () => {
      const column = header.getAttribute('data-sort');
      document.querySelectorAll('#history-table .sortable-header').forEach(h => {
        if (h !== header) h.classList.remove('asc', 'desc');
      });

      if (historyState.sortColumn === column) {
        historyState.sortOrder = historyState.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        historyState.sortColumn = column;
        historyState.sortOrder = 'asc';
      }

      header.classList.remove('asc', 'desc');
      header.classList.add(historyState.sortOrder);
      await loadHistoryTable();
    });
  });


  // --- TAB 2: PARTS CATALOG TABLE ---
  async function loadPartsTable() {
    if (supplierDetailSpinner) supplierDetailSpinner.classList.add('active');
    try {
      let parts = await AppStorage.getPartsBySupplier(activeSupplierId);

      // 1. Filter
      const query = partsSearchInput.value.toLowerCase().trim();
      if (query) {
        parts = parts.filter(p => 
          p.detailId.toLowerCase().includes(query) ||
          p.detailName.toLowerCase().includes(query)
        );
      }

      // 2. Sort
      parts.sort((a, b) => {
        let valA = a[partsState.sortColumn];
        let valB = b[partsState.sortColumn];

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return partsState.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return partsState.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // 3. Paginate
      const totalEntries = parts.length;
      const totalPages = Math.ceil(totalEntries / partsState.pageSize);
      
      if (partsState.currentPage > totalPages && totalPages > 0) {
        partsState.currentPage = totalPages;
      }

      const startIndex = (partsState.currentPage - 1) * partsState.pageSize;
      const endIndex = Math.min(startIndex + partsState.pageSize, totalEntries);
      const paginated = parts.slice(startIndex, endIndex);

      partsTableBody.innerHTML = '';
      
      if (totalEntries === 0) {
        partsEmpty.classList.remove('d-none');
        partsInfoSummary.textContent = 'Showing 0 to 0 of 0 entries';
        partsPagination.innerHTML = '';
        partsPagerBar.classList.add('d-none');
        return;
      }
      
      partsEmpty.classList.add('d-none');
      partsPagerBar.classList.remove('d-none');
      partsInfoSummary.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalEntries} entries`;

      paginated.forEach(part => {
        const tr = document.createElement('tr');
        const formattedDate = new Date(part.createdAt).toLocaleDateString();

        tr.innerHTML = `
          <td><strong class="text-primary font-monospace">${part.detailId}</strong></td>
          <td>${part.detailName}</td>
          <td class="small text-muted">${formattedDate}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary btn-edit-part" data-id="${part.id}" title="Edit Name">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-outline-primary btn-transfer-part" data-id="${part.id}" title="Transfer Production Rights">
                <i class="bi bi-arrow-left-right"></i>
              </button>
              <button class="btn btn-outline-danger btn-delete-part" data-id="${part.id}" title="Delete Part">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        `;

        // Wire Part Actions
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
              if (supplierDetailSpinner) supplierDetailSpinner.classList.add('active');
              try {
                await AppStorage.deletePart(part.id);
                UI.showToast('Part deleted.');
                await loadPartsTable();
                await loadSuppliersList(); // Update count badge
              } catch (err) {
                console.error(err);
                UI.showToast('Failed to delete part.', 'error');
              } finally {
                if (supplierDetailSpinner) supplierDetailSpinner.classList.remove('active');
              }
            }
          );
        });

        partsTableBody.appendChild(tr);
      });

      renderPagination(partsPagination, totalPages, partsState, loadPartsTable);
    } catch (err) {
      console.error(err);
    } finally {
      if (supplierDetailSpinner) supplierDetailSpinner.classList.remove('active');
    }
  }

  partsSearchInput.addEventListener('input', async () => {
    partsState.currentPage = 1;
    await loadPartsTable();
  });

  // Tab 2 Sorting Triggers
  document.querySelectorAll('#parts-table .sortable-header').forEach(header => {
    header.addEventListener('click', async () => {
      const column = header.getAttribute('data-sort');
      document.querySelectorAll('#parts-table .sortable-header').forEach(h => {
        if (h !== header) h.classList.remove('asc', 'desc');
      });

      if (partsState.sortColumn === column) {
        partsState.sortOrder = partsState.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        partsState.sortColumn = column;
        partsState.sortOrder = 'asc';
      }

      header.classList.remove('asc', 'desc');
      header.classList.add(partsState.sortOrder);
      await loadPartsTable();
    });
  });

  // Part CRUD Forms
  btnAddPart.addEventListener('click', () => {
    editPartIdInput.value = '';
    partDetailIdInput.value = '';
    partDetailIdInput.disabled = false;
    partDetailNameInput.value = '';
    partModalLabel.textContent = 'Add Supplier Part';
    partForm.classList.remove('was-validated');
    partModal.show();
  });

  function openPartModalForEdit(part) {
    editPartIdInput.value = part.id;
    partDetailIdInput.value = part.detailId;
    partDetailIdInput.disabled = false; // Make Detail ID input editable
    partDetailNameInput.value = part.detailName;
    partModalLabel.textContent = 'Edit Part Description';
    partForm.classList.remove('was-validated');
    partModal.show();
  }

  partForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!partForm.checkValidity()) {
      e.stopPropagation();
      partForm.classList.add('was-validated');
      return;
    }

    const id = editPartIdInput.value;
    const detailId = partDetailIdInput.value.trim().toUpperCase();
    const detailName = partDetailNameInput.value.trim();

    if (supplierDetailSpinner) supplierDetailSpinner.classList.add('active');
    try {
      if (id) {
        await AppStorage.updatePart(id, detailId, detailName);
        UI.showToast('Part details updated.');
      } else {
        // Check for duplicates
        const existing = await AppStorage.getPartsBySupplier(activeSupplierId);
        if (existing.some(p => p.detailId.toUpperCase() === detailId)) {
          UI.showToast('This Detail ID already exists for this supplier.', 'error');
          if (supplierDetailSpinner) supplierDetailSpinner.classList.remove('active');
          return;
        }
        await AppStorage.addPart(activeSupplierId, detailId, detailName);
        UI.showToast('New part registered.');
      }
      partModal.hide();
      await loadPartsTable();
      await loadSuppliersList();
    } catch (err) {
      console.error(err);
      UI.showToast('Failed to save part.', 'error');
    } finally {
      if (supplierDetailSpinner) supplierDetailSpinner.classList.remove('active');
    }
  });

  // --- TAB 2: TRANSFER COMPONENT ---
  async function openTransferModal(part) {
    transferPartIdInput.value = part.id;
    transferPartDisplay.textContent = `${part.detailId} (${part.detailName})`;

    try {
      // Populate destinations list with all OTHER suppliers
      const suppliers = await AppStorage.getSuppliers();
      const destinations = suppliers.filter(s => s.id !== activeSupplierId);
      
      transferDestinationSelect.innerHTML = '<option value="" selected disabled>Select Destination...</option>';
      
      if (destinations.length === 0) {
        UI.showToast('No other suppliers available to transfer to. Create another supplier first.', 'error');
        return;
      }

      destinations.sort((a, b) => a.name.localeCompare(b.name)).forEach(dest => {
        const opt = document.createElement('option');
        opt.value = dest.id;
        opt.textContent = dest.name;
        transferDestinationSelect.appendChild(opt);
      });

      transferForm.classList.remove('was-validated');
      transferModal.show();
    } catch (err) {
      console.error(err);
    }
  }

  transferForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!transferForm.checkValidity()) {
      e.stopPropagation();
      transferForm.classList.add('was-validated');
      return;
    }

    const partId = transferPartIdInput.value;
    const targetSupplierId = transferDestinationSelect.value;
    const targetSupplierName = transferDestinationSelect.options[transferDestinationSelect.selectedIndex].text;

    if (supplierDetailSpinner) supplierDetailSpinner.classList.add('active');
    try {
      await AppStorage.transferPart(partId, targetSupplierId);
      UI.showToast(`Part successfully transferred to ${targetSupplierName}.`);
      
      transferModal.hide();
      
      // Refresh page structures
      await loadPartsTable();
      await loadSuppliersList();
    } catch (err) {
      console.error(err);
      UI.showToast('Transfer failed.', 'error');
    } finally {
      if (supplierDetailSpinner) supplierDetailSpinner.classList.remove('active');
    }
  });


  // --- PAGINATION SHARED HELPER ---
  function renderPagination(container, totalPages, stateObj, renderCallback) {
    container.innerHTML = '';
    if (totalPages <= 1) return;

    // Previous Button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${stateObj.currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>`;
    prevLi.addEventListener('click', (e) => {
      e.preventDefault();
      if (stateObj.currentPage > 1) {
        stateObj.currentPage--;
        renderCallback();
      }
    });
    container.appendChild(prevLi);

    // Numbers
    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement('li');
      li.className = `page-item ${stateObj.currentPage === i ? 'active' : ''}`;
      li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      li.addEventListener('click', (e) => {
        e.preventDefault();
        stateObj.currentPage = i;
        renderCallback();
      });
      container.appendChild(li);
    }

    // Next Button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${stateObj.currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>`;
    nextLi.addEventListener('click', (e) => {
      e.preventDefault();
      if (stateObj.currentPage < totalPages) {
        stateObj.currentPage++;
        renderCallback();
      }
    });
    container.appendChild(nextLi);
  }


  // --- TAB 3: CHART STATISTICS ---
  async function initYearSelector() {
    try {
      const records = await AppStorage.getReceivingRecords();
      const years = new Set();
      
      // Add current year as baseline
      years.add(new Date().getFullYear());

      records.forEach(rec => {
        if (rec.date) {
          const yr = new Date(rec.date).getFullYear();
          if (!isNaN(yr)) years.add(yr);
        }
      });

      chartYearSelect.innerHTML = '';
      Array.from(years).sort((a, b) => b - a).forEach(yr => {
        const opt = document.createElement('option');
        opt.value = yr;
        opt.textContent = yr;
        chartYearSelect.appendChild(opt);
      });

      chartYearSelect.addEventListener('change', async () => {
        await renderCharts();
      });

      chartMonthSelect.addEventListener('change', async () => {
        await renderCharts();
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function renderCharts() {
    if (!activeSupplierId || !chartYearSelect.value) return;
    if (supplierDetailSpinner) supplierDetailSpinner.classList.add('active');
    try {
      const selectedYear = Number(chartYearSelect.value);
      const selectedMonth = chartMonthSelect.value; // 'all' or '0'-'11'

      const allRecords = await AppStorage.getReceivingRecords();
      const records = allRecords.filter(r => r.supplierId === activeSupplierId);

      // Labels & Datasets placeholder
      let labels = [];
      let incomingData = [];
      let returnedData = [];

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      if (selectedMonth === 'all') {
        // 1. Group by 12 Months of selectedYear
        labels = monthNames;
        incomingData = Array(12).fill(0);
        returnedData = Array(12).fill(0);

        records.forEach(rec => {
          const d = new Date(rec.date);
          if (d.getFullYear() === selectedYear) {
            const m = d.getMonth();
            incomingData[m] += rec.quantity;
            returnedData[m] += rec.returnedQuantity;
          }
        });
      } else {
        // 2. Group by Days of specific selectedMonth & selectedYear
        const monthIdx = Number(selectedMonth);
        const daysInMonth = new Date(selectedYear, monthIdx + 1, 0).getDate();
        
        for (let d = 1; d <= daysInMonth; d++) {
          labels.push(d.toString());
        }
        
        incomingData = Array(daysInMonth).fill(0);
        returnedData = Array(daysInMonth).fill(0);

        records.forEach(rec => {
          const d = new Date(rec.date);
          if (d.getFullYear() === selectedYear && d.getMonth() === monthIdx) {
            const day = d.getDate();
            incomingData[day - 1] += rec.quantity;
            returnedData[day - 1] += rec.returnedQuantity;
          }
        });
      }

      // Chart.js Color schemes
      const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      const textColor = isDark ? '#94a3b8' : '#64748b';
      const gridColor = isDark ? '#334155' : '#e2e8f0';

      // Canvas contexts
      const ctxIncoming = document.getElementById('incomingChart').getContext('2d');
      const ctxReturned = document.getElementById('returnedChart').getContext('2d');

      // Destroy existing instances if any
      if (incomingChart) incomingChart.destroy();
      if (returnedChart) returnedChart.destroy();

      // Chart 1: Incoming Qty Bar Chart
      incomingChart = new Chart(ctxIncoming, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Total Incoming Parts',
            data: incomingData,
            backgroundColor: '#0f172a',
            borderColor: '#0f172a',
            borderRadius: 4,
            maxBarThickness: 32
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor }
            }
          }
        }
      });

      // Chart 2: Returned Qty Line Chart
      returnedChart = new Chart(ctxReturned, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Returned Parts',
            data: returnedData,
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            borderColor: '#dc3545',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#dc3545'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor }
            }
          }
        }
      });

      // Update bar chart colors in dark theme for high contrast
      if (isDark) {
        incomingChart.data.datasets[0].backgroundColor = '#38bdf8';
        incomingChart.data.datasets[0].borderColor = '#38bdf8';
        incomingChart.update();
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (supplierDetailSpinner) supplierDetailSpinner.classList.remove('active');
    }
  }

  // Hook into theme-toggle click to re-render charts with correct typography/grid colors
  const themeToggle = document.getElementById('theme-toggle-btn');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      // Small timeout for data-bs-theme attribute change
      setTimeout(renderCharts, 100);
    });
  }



  // Run initializer
  init();
});
