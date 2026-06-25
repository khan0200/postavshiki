/**
 * index.js - Incoming Parts Registration controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize shared navbar
  UI.initNavbar('index.html');

  // DOM Elements
  const form = document.getElementById('receiving-form');
  const dateInput = document.getElementById('rec-date');
  const fnInput = document.getElementById('rec-fn');
  const supplierSelect = document.getElementById('rec-supplier');
  
  const detailSearch = document.getElementById('rec-detail-search');
  const detailIdHidden = document.getElementById('rec-detail-id');
  const detailNameInput = document.getElementById('rec-detail-name');
  const detailDropdownMenu = document.getElementById('rec-detail-dropdown-menu');
  
  const qtyInput = document.getElementById('rec-quantity');
  const checkedQtyInput = document.getElementById('rec-checked-qty');
  const returnedQtyInput = document.getElementById('rec-returned-qty');
  const inspectorSelect = document.getElementById('rec-inspector');
  const commentInput = document.getElementById('rec-comment');
  const commentPresetsList = document.getElementById('predefined-comments-list');
  const submitBtn = document.getElementById('submit-btn');
  const formSpinner = document.getElementById('form-spinner');
  const clearFormBtn = document.getElementById('clear-form-btn');

  // Table & Filter Elements
  const tableSearchInput = document.getElementById('table-search');
  const tableBody = document.getElementById('records-table-body');
  const emptyState = document.getElementById('table-empty-state');
  const tableInfoSummary = document.getElementById('table-info-summary');
  const tableSpinner = document.getElementById('table-spinner');

  // State Management for Registration Screen
  let activeParts = []; // parts of the selected supplier
  let records = [];
  let lastQty = ''; // track previous quantity received for smart auto-syncing
  let tableState = {
    searchQuery: '',
    sortColumn: 'date',
    sortOrder: 'desc', // default newest first
    currentPage: 1,
    pageSize: 30
  };

  // Set default date to today (local timezone) and set default quantities
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  qtyInput.value = '';
  checkedQtyInput.value = '5';
  returnedQtyInput.value = '0';

  // Initialize form drop downs
  async function loadFormDropdowns() {
    if (formSpinner) formSpinner.classList.add('active');
    try {
      // Populate Suppliers
      const suppliers = await AppStorage.getSuppliers();
      supplierSelect.innerHTML = '<option value="" selected disabled>Choose Supplier...</option>';
      suppliers.sort((a, b) => a.name.localeCompare(b.name)).forEach(sup => {
        const opt = document.createElement('option');
        opt.value = sup.id;
        opt.textContent = sup.name;
        supplierSelect.appendChild(opt);
      });

      // Populate Inspectors
      const inspectors = await AppStorage.getInspectors();
      inspectorSelect.innerHTML = '<option value="" selected disabled>Select Inspector...</option>';
      inspectors.sort((a, b) => a.fullName.localeCompare(b.fullName)).forEach(ins => {
        const opt = document.createElement('option');
        opt.value = ins.id;
        opt.textContent = ins.fullName;
        inspectorSelect.appendChild(opt);
      });

      // Populate Predefined Comments
      const comments = await AppStorage.getComments();
      commentPresetsList.innerHTML = '';
      comments.forEach(cmt => {
        const li = document.createElement('li');
        li.innerHTML = `<a class="dropdown-item" href="#">${cmt.text}</a>`;
        li.querySelector('a').addEventListener('click', (e) => {
          e.preventDefault();
          const currentVal = commentInput.value.trim();
          if (currentVal === '') {
            commentInput.value = cmt.text;
          } else {
            commentInput.value = currentVal + ', ' + cmt.text;
          }
          commentInput.focus();
        });
        commentPresetsList.appendChild(li);
      });
    } catch (err) {
      console.error('Error loading dropdowns:', err);
    } finally {
      if (formSpinner) formSpinner.classList.remove('active');
    }
  }

  // --- SEARCHABLE DETAIL ID DROPDOWN LOGIC ---
  supplierSelect.addEventListener('change', async () => {
    const selectedSupplierId = supplierSelect.value;
    
    // Reset Part fields
    detailSearch.value = '';
    detailIdHidden.value = '';
    detailNameInput.value = '';
    
    if (selectedSupplierId) {
      detailSearch.disabled = true;
      detailSearch.placeholder = 'Loading parts...';
      if (formSpinner) formSpinner.classList.add('active');
      try {
        activeParts = await AppStorage.getPartsBySupplier(selectedSupplierId);
        detailSearch.disabled = false;
        detailSearch.placeholder = 'Type to search Detail ID...';
        renderDetailDropdownMenu();
      } catch (err) {
        console.error('Error fetching parts:', err);
        detailSearch.placeholder = 'Failed to load parts';
      } finally {
        if (formSpinner) formSpinner.classList.remove('active');
      }
    } else {
      activeParts = [];
      detailSearch.disabled = true;
      detailSearch.placeholder = 'Select supplier first...';
    }
  });

  function renderDetailDropdownMenu(filter = '') {
    detailDropdownMenu.innerHTML = '';
    
    const filteredParts = activeParts.filter(part => 
      part.detailId.toLowerCase().includes(filter.toLowerCase()) || 
      part.detailName.toLowerCase().includes(filter.toLowerCase())
    );

    if (filteredParts.length === 0) {
      detailDropdownMenu.innerHTML = '<div class="px-3 py-2 text-muted small">No parts found</div>';
      return;
    }

    filteredParts.forEach(part => {
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item d-flex justify-content-between align-items-center';
      item.innerHTML = `
        <span class="fw-semibold text-primary">${part.detailId}</span>
        <span class="small text-muted text-truncate ms-2" style="max-width: 180px;">${part.detailName}</span>
      `;
      item.addEventListener('click', () => {
        detailSearch.value = part.detailId;
        detailIdHidden.value = part.detailId;
        detailNameInput.value = part.detailName;
        detailDropdownMenu.classList.remove('show');
        
        // Remove invalid indicators if selected
        detailSearch.classList.remove('is-invalid');
      });
      detailDropdownMenu.appendChild(item);
    });
  }

  detailSearch.addEventListener('focus', () => {
    if (activeParts.length > 0) {
      renderDetailDropdownMenu(detailSearch.value);
      detailDropdownMenu.classList.add('show');
    }
  });

  detailSearch.addEventListener('input', () => {
    // Hidden ID becomes invalid when user is actively typing, unless it matches exactly
    detailIdHidden.value = '';
    detailNameInput.value = '';
    
    // Check for exact match
    const exactMatch = activeParts.find(p => p.detailId.toUpperCase() === detailSearch.value.trim().toUpperCase());
    if (exactMatch) {
      detailIdHidden.value = exactMatch.detailId;
      detailNameInput.value = exactMatch.detailName;
    }
    
    renderDetailDropdownMenu(detailSearch.value);
  });

  // Hide dropdown menu on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown-container')) {
      detailDropdownMenu.classList.remove('show');
      
      // If user clicks outside and left a non-exact match, clean it up
      if (!detailIdHidden.value) {
        detailSearch.value = '';
      }
    }
  });

  // Helper to toggle Clear Form button visibility
  function updateClearBtnVisibility() {
    if (qtyInput.value.trim() !== '') {
      clearFormBtn.classList.remove('d-none');
    } else {
      clearFormBtn.classList.add('d-none');
    }
  }

  // Clear Form button action
  clearFormBtn.addEventListener('click', () => {
    fnInput.value = '';
    supplierSelect.value = '';
    
    detailSearch.value = '';
    detailSearch.disabled = true;
    detailSearch.placeholder = 'Select supplier first...';
    detailIdHidden.value = '';
    detailNameInput.value = '';
    
    qtyInput.value = '';
    commentInput.value = '';
    lastQty = '';
    
    // Clear validation classes
    form.querySelectorAll('.is-invalid').forEach(elem => elem.classList.remove('is-invalid'));
    form.querySelectorAll('.is-valid').forEach(elem => elem.classList.remove('is-valid'));
    form.classList.remove('was-validated');
    
    // Hide the clear button
    clearFormBtn.classList.add('d-none');
    
    fnInput.focus();
  });

  // --- QUANTITIES AUTO-VALIDATION HELPER ---
  qtyInput.addEventListener('input', () => {
    const qtyStr = qtyInput.value;
    const qty = Number(qtyStr);
    
    // If checked quantity is empty OR matches default '5' OR matches the previous qty value, auto-sync it
    if (checkedQtyInput.value === '' || checkedQtyInput.value === '5' || checkedQtyInput.value === lastQty) {
      checkedQtyInput.value = qtyStr;
    } else {
      // Auto-cap values to prevent immediate user validation issues
      if (Number(checkedQtyInput.value) > qty) {
        checkedQtyInput.value = qty;
      }
    }

    if (Number(returnedQtyInput.value) > Number(checkedQtyInput.value)) {
      returnedQtyInput.value = checkedQtyInput.value;
    }

    lastQty = qtyStr;
    updateClearBtnVisibility();
  });

  checkedQtyInput.addEventListener('input', () => {
    if (qtyInput.value !== '') {
      const qty = Number(qtyInput.value);
      const checked = Number(checkedQtyInput.value);
      
      if (checked > qty) {
        checkedQtyInput.value = qty;
      }
    }
    if (checkedQtyInput.value !== '' && Number(returnedQtyInput.value) > Number(checkedQtyInput.value)) {
      returnedQtyInput.value = checkedQtyInput.value;
    }
  });

  returnedQtyInput.addEventListener('input', () => {
    if (checkedQtyInput.value !== '') {
      const checked = Number(checkedQtyInput.value);
      if (Number(returnedQtyInput.value) > checked) {
        returnedQtyInput.value = checked;
      }
    }
  });

  // --- FORM VALIDATION & SUBMISSION ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let isValid = true;
    form.classList.remove('was-validated');

    // Helper to toggle invalid status
    const setValidation = (input, cond) => {
      if (cond) {
        input.classList.remove('is-invalid');
      } else {
        input.classList.add('is-invalid');
        isValid = false;
      }
    };

    // F/N Check
    setValidation(fnInput, fnInput.value.trim() !== '');

    // Supplier Check
    setValidation(supplierSelect, supplierSelect.value !== '');

    // Detail ID Searchable Dropdown Check
    setValidation(detailSearch, detailIdHidden.value !== '');

    // Qty Check (> 0)
    const qty = Number(qtyInput.value);
    setValidation(qtyInput, qtyInput.value !== '' && qty > 0);

    // Checked Qty Check (<= Qty, >= 0)
    const checked = Number(checkedQtyInput.value);
    setValidation(checkedQtyInput, checkedQtyInput.value !== '' && checked >= 0 && checked <= qty);

    // Returned Qty Check (<= Checked, >= 0)
    const returned = Number(returnedQtyInput.value);
    setValidation(returnedQtyInput, returnedQtyInput.value !== '' && returned >= 0 && returned <= checked);

    // Inspector Check
    setValidation(inspectorSelect, inspectorSelect.value !== '');

    if (!isValid) {
      UI.showToast('Please correct validation errors on the form.', 'error');
      return;
    }

    // Disable button to prevent double submit spamming
    submitBtn.disabled = true;
    formSpinner.classList.add('active');

    // Record submission payload
    const record = {
      date: dateInput.value,
      fn: fnInput.value,
      supplierId: supplierSelect.value,
      detailId: detailIdHidden.value,
      detailName: detailNameInput.value,
      quantity: qty,
      checkedQuantity: checked,
      returnedQuantity: returned,
      inspectorId: inspectorSelect.value,
      comment: commentInput.value || 'OK'
    };

    try {
      await AppStorage.addReceivingRecord(record);
      UI.showToast('Receiving record registered successfully!');
      
      // Keep last entered inputs in the form, just clear the validation formatting styles
      form.classList.remove('was-validated');
      form.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
      form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
      
      // Refresh log table
      await loadTableRecords();
    } catch (err) {
      console.error(err);
      UI.showToast('Failed to save record to storage.', 'error');
    } finally {
      submitBtn.disabled = false;
      formSpinner.classList.remove('active');
      fnInput.focus();
    }
  });

  function resetFormExceptDate() {
    fnInput.value = '';
    supplierSelect.value = '';
    
    detailSearch.value = '';
    detailSearch.disabled = true;
    detailSearch.placeholder = 'Select supplier first...';
    detailIdHidden.value = '';
    detailNameInput.value = '';
    
    qtyInput.value = '';
    checkedQtyInput.value = '5';
    returnedQtyInput.value = '0';
    lastQty = '';
    inspectorSelect.value = '';
    commentInput.value = '';
    
    // Clear validation classes
    form.querySelectorAll('.is-invalid').forEach(elem => elem.classList.remove('is-invalid'));
    form.querySelectorAll('.is-valid').forEach(elem => elem.classList.remove('is-valid'));
    form.classList.remove('was-validated');
  }

  // --- LOG TABLE RENDER ENGINE ---
  async function loadTableRecords() {
    if (tableSpinner) tableSpinner.classList.add('active');
    try {
      const rawRecords = await AppStorage.getReceivingRecords();
      const suppliers = await AppStorage.getSuppliers();
      const inspectors = await AppStorage.getInspectors();

      // Map names for searching and display
      records = rawRecords.map(rec => {
        const sup = suppliers.find(s => s.id === rec.supplierId);
        const ins = inspectors.find(i => i.id === rec.inspectorId);
        return {
          ...rec,
          supplierName: sup ? sup.name : 'Unknown Supplier',
          inspectorName: ins ? ins.fullName : 'Unknown Inspector'
        };
      });

      // Sort by date desc to get newest first, then limit to top 30
      records.sort((a, b) => new Date(b.date) - new Date(a.date));
      records = records.slice(0, 30);

      renderTable();
    } catch (err) {
      console.error('Error loading table records:', err);
    } finally {
      if (tableSpinner) tableSpinner.classList.remove('active');
    }
  }

  function renderTable() {
    // 1. Filter
    let filtered = records.filter(rec => {
      const q = tableState.searchQuery.toLowerCase();
      return (
        rec.fn.toLowerCase().includes(q) ||
        rec.supplierName.toLowerCase().includes(q) ||
        rec.detailId.toLowerCase().includes(q) ||
        rec.detailName.toLowerCase().includes(q) ||
        rec.inspectorName.toLowerCase().includes(q) ||
        rec.comment.toLowerCase().includes(q)
      );
    });

    // 2. Sort
    filtered.sort((a, b) => {
      let valA = a[tableState.sortColumn];
      let valB = b[tableState.sortColumn];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return tableState.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return tableState.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Render Rows
    const totalEntries = filtered.length;
    tableBody.innerHTML = '';
    
    if (totalEntries === 0) {
      emptyState.classList.remove('d-none');
      tableInfoSummary.textContent = `Showing 0 of ${records.length} entries (latest 30)`;
      return;
    }
    
    emptyState.classList.add('d-none');
    tableInfoSummary.textContent = `Showing ${totalEntries} of ${records.length} entries (latest 30)`;

    filtered.forEach(rec => {
      const tr = document.createElement('tr');
      
      // Determine color badge style based on returns
      let borderClass = 'badge-record-green';
      if (rec.returnedQuantity > 0) {
        if (rec.returnedQuantity === rec.checkedQuantity) {
          borderClass = 'badge-record-red';
        } else {
          borderClass = 'badge-record-yellow';
        }
      }
      tr.className = borderClass;

      // Status Badge HTML
      let badgeHtml = '';
      if (rec.returnedQuantity === 0) {
        badgeHtml = `<span class="badge bg-success-subtle text-success">OK</span>`;
      } else if (rec.returnedQuantity === rec.checkedQuantity) {
        badgeHtml = `<span class="badge bg-danger-subtle text-danger">Returned</span>`;
      } else {
        badgeHtml = `<span class="badge bg-warning-subtle text-warning-emphasis">Partial</span>`;
      }

      tr.innerHTML = `
        <td class="small fw-semibold text-nowrap">${rec.date}</td>
        <td><code class="text-secondary fw-semibold">${rec.fn}</code></td>
        <td class="text-truncate" style="max-width: 140px;" title="${rec.supplierName}">${rec.supplierName}</td>
        <td><span class="badge bg-light text-dark font-monospace">${rec.detailId}</span></td>
        <td class="text-truncate" style="max-width: 140px;" title="${rec.detailName}">${rec.detailName}</td>
        <td class="text-end fw-semibold">${rec.quantity}</td>
        <td class="text-end text-success">${rec.checkedQuantity}</td>
        <td class="text-end text-danger">${rec.returnedQuantity}</td>
        <td class="small">${rec.inspectorName}</td>
        <td class="text-truncate small" style="max-width: 120px;" title="${rec.comment}">${rec.comment}</td>
      `;

      tableBody.appendChild(tr);
    });

  // Sorting columns triggers
  document.querySelectorAll('.sortable-header').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-sort');
      
      // Update visual indicators
      document.querySelectorAll('.sortable-header').forEach(h => {
        if (h !== header) {
          h.classList.remove('asc', 'desc');
        }
      });

      if (tableState.sortColumn === column) {
        tableState.sortOrder = tableState.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        tableState.sortColumn = column;
        tableState.sortOrder = 'asc';
      }

      header.classList.remove('asc', 'desc');
      header.classList.add(tableState.sortOrder);

      renderTable();
    });
  });

  // Search input triggers
  tableSearchInput.addEventListener('input', () => {
    tableState.searchQuery = tableSearchInput.value.trim();
    tableState.currentPage = 1;
    renderTable();
  });

  // Initial Load
  loadFormDropdowns();
  loadTableRecords();
});
