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
  const tableState = Utils.createTableState({ sortColumn: 'date', sortOrder: 'desc', pageSize: 30 });
  let commentPresets = []; // cached comment presets

  // Set default date to today (local timezone) and set default quantities
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  qtyInput.value = '';
  checkedQtyInput.value = '5';
  returnedQtyInput.value = '0';

  // --- COMMENT PRESETS DROPDOWN ---
  // Uses a Bootstrap dropdown menu (<ul><li><a>...) driven by its own show()/hide()
  // API, which is a different shape than the `.custom-dropdown-menu` widget used by
  // the Detail ID search box below - so this stays a small dedicated renderer rather
  // than forcing it through UI.createSearchableDropdown's <div> item markup.
  function renderCommentPresets(filter = '') {
    commentPresetsList.innerHTML = '';
    const filtered = commentPresets.filter(cmt => cmt.text.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="dropdown-item-text text-muted small">No matches</span>';
      commentPresetsList.appendChild(li);
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(cmt => {
      const li = document.createElement('li');
      li.innerHTML = `<a class="dropdown-item" href="#">${Utils.escapeHtml(cmt.text)}</a>`;
      li.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();

        const parts = commentInput.value.split(',').map(p => p.trim());
        if (parts.length > 0) {
          parts[parts.length - 1] = cmt.text;
        } else {
          parts.push(cmt.text);
        }
        commentInput.value = parts.filter(p => p !== '').join(', ');

        renderCommentPresets('');

        const dropdownToggle = document.getElementById('presets-dropdown-btn');
        if (dropdownToggle) {
          bootstrap.Dropdown.getOrCreateInstance(dropdownToggle).hide();
        }

        commentInput.focus();
      });
      fragment.appendChild(li);
    });
    commentPresetsList.appendChild(fragment);
  }

  // Initialize form drop downs - independent collections loaded in parallel.
  async function loadFormDropdowns() {
    if (formSpinner) formSpinner.classList.add('active');
    try {
      const [suppliers, parts, inspectors, comments] = await Promise.all([
        SupplierRepository.getAll(),
        PartRepository.getAll(),
        InspectorRepository.getAll(),
        CommentRepository.getAll()
      ]);

      supplierSelect.innerHTML = '<option value="" selected disabled>Choose Supplier...</option>';
      suppliers.slice().sort((a, b) => {
        const countA = parts.filter(p => p.supplierId === a.id).length;
        const countB = parts.filter(p => p.supplierId === b.id).length;
        if (countB !== countA) return countB - countA;
        return a.name.localeCompare(b.name);
      }).forEach(sup => {
        const opt = document.createElement('option');
        opt.value = sup.id;
        opt.textContent = sup.name;
        supplierSelect.appendChild(opt);
      });

      inspectorSelect.innerHTML = '<option value="" selected disabled>Select Inspector...</option>';
      inspectors.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)).forEach(ins => {
        const opt = document.createElement('option');
        opt.value = ins.id;
        opt.textContent = ins.fullName;
        inspectorSelect.appendChild(opt);
      });

      commentPresets = comments;
      renderCommentPresets('');
    } catch (err) {
      console.error('Error loading dropdowns:', err);
    } finally {
      if (formSpinner) formSpinner.classList.remove('active');
    }
  }

  // --- COMMENT PRESET SEARCH LOGIC ---
  commentInput.addEventListener('input', () => {
    const parts = commentInput.value.split(',');
    const query = parts.length > 0 ? parts[parts.length - 1].trim() : '';

    renderCommentPresets(query);

    const dropdownToggle = document.getElementById('presets-dropdown-btn');
    if (dropdownToggle) {
      const dropdown = bootstrap.Dropdown.getOrCreateInstance(dropdownToggle);

      const filtered = commentPresets.filter(cmt =>
        cmt.text.toLowerCase().includes(query.toLowerCase())
      );

      if (query.length > 0 && filtered.length > 0) {
        dropdown.show();
      } else {
        dropdown.hide();
      }
    }
  });

  const dropdownToggle = document.getElementById('presets-dropdown-btn');
  if (dropdownToggle) {
    dropdownToggle.addEventListener('show.bs.dropdown', () => {
      const parts = commentInput.value.split(',');
      const query = parts.length > 0 ? parts[parts.length - 1].trim() : '';
      renderCommentPresets(query);
    });
  }

  // --- SEARCHABLE DETAIL ID DROPDOWN (shared component) ---
  const detailDropdown = UI.createSearchableDropdown({
    inputEl: detailSearch,
    menuEl: detailDropdownMenu,
    getItems: () => activeParts,
    filterFn: (part, query) =>
      part.detailId.toLowerCase().includes(query.toLowerCase()) ||
      part.detailName.toLowerCase().includes(query.toLowerCase()),
    renderItem: (part) => `
      <span class="fw-semibold text-primary">${Utils.escapeHtml(part.detailId)}</span>
      <span class="small text-muted text-truncate ms-2" style="max-width: 180px;">${Utils.escapeHtml(part.detailName)}</span>
    `,
    onSelect: (part) => {
      detailSearch.value = part.detailId;
      detailIdHidden.value = part.detailId;
      detailNameInput.value = part.detailName;
      detailDropdownMenu.classList.remove('show');
      detailSearch.classList.remove('is-invalid');
    },
    emptyText: 'No parts found'
  });
  // The generic component's item markup is `<span>...</span>` pairs with no
  // flex wrapper; this page's CSS expects the flex/justify classes on the
  // item element itself, so override the row class after each render call.
  function renderDetailDropdownMenu(filter = '') {
    detailDropdown.render(filter);
    detailDropdownMenu.querySelectorAll('.custom-dropdown-item').forEach(el => {
      el.classList.add('d-flex', 'justify-content-between', 'align-items-center');
    });
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
        activeParts = await PartRepository.getBySupplier(selectedSupplierId);
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

  // Hide dropdown menu on click outside (additional cleanup specific to this page:
  // clear a non-exact-match search value, on top of the shared component's hide logic).
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown-container')) {
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

    if (qtyStr !== '') {
      const qty = Number(qtyStr);
      // Auto-cap checked quantity only if it exceeds the new received quantity
      if (checkedQtyInput.value !== '' && Number(checkedQtyInput.value) > qty) {
        checkedQtyInput.value = qty;
      }
    }

    if (checkedQtyInput.value !== '' && Number(returnedQtyInput.value) > Number(checkedQtyInput.value)) {
      returnedQtyInput.value = checkedQtyInput.value;
    }

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

    // Quantity relationship checks (shared validator - same rule used by the
    // supplier-page "Edit Delivery Record" modal).
    const qty = Number(qtyInput.value);
    const checked = Number(checkedQtyInput.value);
    const returned = Number(returnedQtyInput.value);
    const { qtyValid, checkedValid, returnedValid } = Utils.validateQuantities(qty, checked, returned);

    setValidation(qtyInput, qtyInput.value !== '' && qtyValid);
    setValidation(checkedQtyInput, checkedQtyInput.value !== '' && checkedValid);
    setValidation(returnedQtyInput, returnedQtyInput.value !== '' && returnedValid);

    // Inspector Check
    setValidation(inspectorSelect, inspectorSelect.value !== '');

    if (!isValid) {
      UI.showToast('Please correct validation errors on the form.', 'error');
      return;
    }

    // Disable button to prevent double submit spamming
    submitBtn.disabled = true;
    formSpinner.classList.add('active');

    // Names are already known from the selected <option> text, so the repository
    // does not need to re-fetch the supplier/inspector documents to denormalize them.
    const record = {
      date: dateInput.value,
      fn: fnInput.value,
      supplierId: supplierSelect.value,
      supplierName: supplierSelect.options[supplierSelect.selectedIndex].textContent,
      detailId: detailIdHidden.value,
      detailName: detailNameInput.value,
      quantity: qty,
      checkedQuantity: checked,
      returnedQuantity: returned,
      inspectorId: inspectorSelect.value,
      inspectorName: inspectorSelect.options[inspectorSelect.selectedIndex].textContent,
      comment: commentInput.value || 'OK'
    };

    try {
      await ReceivingRepository.add(record);
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

  // --- LOG TABLE RENDER ENGINE ---
  async function loadTableRecords() {
    if (tableSpinner) tableSpinner.classList.add('active');
    try {
      // Firestore-side orderBy+limit(30) replaces "download everything, sort,
      // slice to 30" - reads are now proportional to what's displayed.
      records = await ReceivingRepository.getLatest(tableState.pageSize);
      renderTable();
    } catch (err) {
      console.error('Error loading table records:', err);
    } finally {
      if (tableSpinner) tableSpinner.classList.remove('active');
    }
  }

  function renderTable() {
    // 1. Filter
    const q = tableState.searchQuery.toLowerCase();
    let filtered = records.filter(rec =>
      rec.fn.toLowerCase().includes(q) ||
      rec.supplierName.toLowerCase().includes(q) ||
      rec.detailId.toLowerCase().includes(q) ||
      rec.detailName.toLowerCase().includes(q) ||
      rec.inspectorName.toLowerCase().includes(q) ||
      rec.comment.toLowerCase().includes(q)
    );

    // 2. Sort (shared utility - identical behavior to the previous inline comparator)
    filtered = Utils.sortRecords(filtered, tableState.sortColumn, tableState.sortOrder);

    // Render Rows
    const totalEntries = filtered.length;

    if (totalEntries === 0) {
      tableBody.innerHTML = '';
      emptyState.classList.remove('d-none');
      tableInfoSummary.textContent = `Showing 0 of ${records.length} entries (latest ${tableState.pageSize})`;
      return;
    }

    emptyState.classList.add('d-none');
    tableInfoSummary.textContent = `Showing ${totalEntries} of ${records.length} entries (latest ${tableState.pageSize})`;

    Utils.renderRows(tableBody, filtered, (rec) => {
      const tr = document.createElement('tr');

      // Determine color badge style based on returns
      let borderClass = 'badge-record-green';
      if (rec.returnedQuantity > 0) {
        borderClass = rec.returnedQuantity === rec.checkedQuantity ? 'badge-record-red' : 'badge-record-yellow';
      }
      tr.className = borderClass;

      tr.innerHTML = `
        <td class="small fw-semibold text-nowrap">${Utils.escapeHtml(rec.date)}</td>
        <td><code class="text-secondary fw-semibold">${Utils.escapeHtml(rec.fn)}</code></td>
        <td class="text-truncate" style="max-width: 140px;" title="${Utils.escapeHtml(rec.supplierName)}">${Utils.escapeHtml(rec.supplierName)}</td>
        <td><span class="badge bg-light text-dark font-monospace">${Utils.escapeHtml(rec.detailId)}</span></td>
        <td class="text-truncate" style="max-width: 140px;" title="${Utils.escapeHtml(rec.detailName)}">${Utils.escapeHtml(rec.detailName)}</td>
        <td class="text-end fw-semibold">${rec.quantity}</td>
        <td class="text-end text-success">${rec.checkedQuantity}</td>
        <td class="text-end text-danger">${rec.returnedQuantity}</td>
        <td class="small">${Utils.escapeHtml(rec.inspectorName)}</td>
        <td class="text-truncate small" style="max-width: 120px;" title="${Utils.escapeHtml(rec.comment)}">${Utils.escapeHtml(rec.comment)}</td>
      `;

      return tr;
    });
  }

  // Sorting columns triggers (shared helper - identical behavior to the previous
  // hand-rolled listener, now also used identically on the Suppliers page tables)
  Utils.bindSortableHeaders('#records-table', tableState, renderTable);

  // Search input triggers - debounced so fast typing doesn't re-render on every keystroke
  tableSearchInput.addEventListener('input', Utils.debounce(() => {
    tableState.searchQuery = tableSearchInput.value.trim();
    tableState.currentPage = 1;
    renderTable();
  }, 250));

  // Initial Load - independent dropdown data and table data load in parallel
  Promise.all([loadFormDropdowns(), loadTableRecords()]);
});
