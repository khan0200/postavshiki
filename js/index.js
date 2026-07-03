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
  const tableState = Utils.createTableState({ sortColumn: 'createdAt', sortOrder: 'desc', pageSize: 30 });
  let commentPresets = []; // cached comment presets

  // Set default date to today (local timezone) and set default quantities
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  qtyInput.value = '';
  checkedQtyInput.value = '5';
  returnedQtyInput.value = '0';

  // --- COMMENT PRESETS DROPDOWN ---
  // Renders comment presets into the custom dropdown menu element.
  function renderCommentPresets(filter = '') {
    commentPresetsList.innerHTML = '';
    const filtered = commentPresets.filter(cmt => cmt.text.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'px-3 py-2 text-muted small';
      empty.textContent = 'No matches';
      commentPresetsList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(cmt => {
      const el = document.createElement('div');
      el.className = 'custom-dropdown-item';
      el.textContent = cmt.text;
      el.addEventListener('click', (e) => {
        e.preventDefault();

        const parts = commentInput.value.split(',').map(p => p.trim());
        if (parts.length > 0) {
          parts[parts.length - 1] = cmt.text;
        } else {
          parts.push(cmt.text);
        }
        commentInput.value = parts.filter(p => p !== '').join(', ');

        renderCommentPresets('');
        commentPresetsList.classList.remove('show');
        commentInput.focus();
      });
      fragment.appendChild(el);
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

      supplierSelect.innerHTML = '<option value="" selected disabled>Yetkazib beruvchini tanlang...</option>';
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

      inspectorSelect.innerHTML = '<option value="" selected disabled>Inspektorni tanlang...</option>';
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

    const filtered = commentPresets.filter(cmt =>
      cmt.text.toLowerCase().includes(query.toLowerCase())
    );

    if (query.length > 0 && filtered.length > 0) {
      commentPresetsList.classList.add('show');
    } else {
      commentPresetsList.classList.remove('show');
    }
  });

  const dropdownToggle = document.getElementById('presets-dropdown-btn');
  if (dropdownToggle) {
    dropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const parts = commentInput.value.split(',');
      const query = parts.length > 0 ? parts[parts.length - 1].trim() : '';
      renderCommentPresets(query);
      commentPresetsList.classList.toggle('show');
    });
  }

  // Preset pills quick picker logic
  document.querySelectorAll('#preset-pills-container .preset-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const value = btn.getAttribute('data-value');
      const currentVal = commentInput.value.trim();
      if (!currentVal || currentVal === 'OK') {
        commentInput.value = value;
      } else {
        const parts = currentVal.split(',').map(p => p.trim()).filter(Boolean);
        if (!parts.includes(value)) {
          parts.push(value);
          commentInput.value = parts.join(', ');
        }
      }
      commentInput.focus();
    });
  });

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
      detailNameInput.textContent = part.detailName;
      detailDropdownMenu.classList.remove('show');
      detailSearch.classList.remove('is-invalid');
    },
    emptyText: 'Detallar topilmadi'
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
    detailNameInput.textContent = '';

    if (selectedSupplierId) {
      detailSearch.disabled = true;
      detailSearch.placeholder = 'Detallar yuklanmoqda...';
      if (formSpinner) formSpinner.classList.add('active');
      try {
        activeParts = await PartRepository.getBySupplier(selectedSupplierId);
        detailSearch.disabled = false;
        detailSearch.placeholder = 'Qidirish uchun yozing...';
        renderDetailDropdownMenu();
      } catch (err) {
        console.error('Error fetching parts:', err);
        detailSearch.placeholder = 'Yuklashda xatolik';
      } finally {
        if (formSpinner) formSpinner.classList.remove('active');
      }
    } else {
      activeParts = [];
      detailSearch.disabled = true;
      detailSearch.placeholder = 'Avval yetkazib beruvchini tanlang...';
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
    detailNameInput.textContent = '';

    const query = detailSearch.value.trim().toUpperCase();

    // Suggest first matching part name
    if (query.length > 0) {
      const firstMatch = activeParts.find(p => p.detailId.toUpperCase().includes(query));
      if (firstMatch) {
        detailNameInput.textContent = firstMatch.detailName;
      }
    }

    // Check for exact match
    const exactMatch = activeParts.find(p => p.detailId.toUpperCase() === query);
    if (exactMatch) {
      detailIdHidden.value = exactMatch.detailId;
      detailNameInput.textContent = exactMatch.detailName;
    }

    renderDetailDropdownMenu(detailSearch.value);
  });

  // Hide dropdown menu on click outside (additional cleanup specific to this page:
  // clear a non-exact-match search value, on top of the shared component's hide logic).
  document.addEventListener('click', (e) => {
    // Hide Detail ID dropdown on outside click
    if (!e.target.closest('.custom-dropdown-container')) {
      if (!detailIdHidden.value) {
        detailSearch.value = '';
      }
    }
    // Hide Comment presets dropdown on outside click
    if (!e.target.closest('#rec-comment') && !e.target.closest('#presets-dropdown-btn') && !e.target.closest('#predefined-comments-list')) {
      commentPresetsList.classList.remove('show');
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
    detailSearch.placeholder = 'Avval yetkazib beruvchini tanlang...';
    detailIdHidden.value = '';
    detailNameInput.textContent = '';

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
      UI.showToast('Iltimos, formadagi xatolarni to\'g\'rilang.', 'error');
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
      detailName: detailNameInput.textContent,
      quantity: qty,
      checkedQuantity: checked,
      returnedQuantity: returned,
      inspectorId: inspectorSelect.value,
      inspectorName: inspectorSelect.options[inspectorSelect.selectedIndex].textContent,
      comment: commentInput.value || 'OK'
    };

    try {
      await ReceivingRepository.add(record);
      UI.showToast('Qabul qilish yozuvi muvaffaqiyatli saqlandi!');

      // Keep last entered inputs in the form, just clear the validation formatting styles
      form.classList.remove('was-validated');
      form.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
      form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

      // Refresh log table
      await loadTableRecords();
    } catch (err) {
      console.error(err);
      UI.showToast('Yozuvni saqlashda xatolik yuz berdi.', 'error');
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
      tableInfoSummary.textContent = `Yozuvlar ko'rsatilmoqda: 0 tadan ${records.length} ta (oxirgi ${tableState.pageSize} ta)`;
      return;
    }

    emptyState.classList.add('d-none');
    tableInfoSummary.textContent = `Yozuvlar ko'rsatilmoqda: ${totalEntries} tadan ${records.length} ta (oxirgi ${tableState.pageSize} ta)`;

    Utils.renderRows(tableBody, filtered, (rec) => {
      const tr = document.createElement('tr');

      // Determine color badge style based on returns
      let borderClass = 'badge-record-green';
      if (rec.returnedQuantity > 0) {
        borderClass = rec.returnedQuantity === rec.checkedQuantity ? 'badge-record-red' : 'badge-record-yellow';
      }
      tr.className = borderClass;

      const displayDate = (() => {
        if (!rec.date) return '';
        if (rec.createdAt) {
          try {
            const dateObj = new Date(rec.createdAt);
            if (!isNaN(dateObj.getTime())) {
              const hours = String(dateObj.getHours()).padStart(2, '0');
              const minutes = String(dateObj.getMinutes()).padStart(2, '0');
              return `${rec.date} ${hours}:${minutes}`;
            }
          } catch (e) {
            // ignore and fallback
          }
        }
        return rec.date;
      })();

      tr.innerHTML = `
        <td>
          <div class="mb-0"><code class="text-dark fw-semibold">F/N: ${Utils.escapeHtml(rec.fn)}</code></div>
          <div class="text-muted small text-nowrap" style="font-size: 0.75rem;">${Utils.escapeHtml(displayDate)}</div>
        </td>
        <td class="text-truncate" style="max-width: 140px;" title="${Utils.escapeHtml(rec.supplierName)}">${Utils.escapeHtml(rec.supplierName)}</td>
        <td>
          <div class="mb-0"><span class="badge bg-primary text-white font-monospace" style="font-size: 0.85rem;">${Utils.escapeHtml(rec.detailId)}</span></div>
          <div class="text-muted small text-wrap" style="font-size: 0.75rem; max-width: 200px;">${Utils.escapeHtml(rec.detailName)}</div>
        </td>
        <td class="text-end fw-semibold">${rec.quantity}</td>
        <td class="text-end text-success">${rec.checkedQuantity}</td>
        <td class="text-end text-danger">${rec.returnedQuantity}</td>
        <td class="small">${Utils.escapeHtml(rec.inspectorName)}</td>
        <td>
          <span class="badge rounded-pill ${rec.comment && rec.comment.trim().toUpperCase() === 'OK' ? 'bg-success' : 'bg-danger'} text-white text-wrap">${Utils.escapeHtml(rec.comment)}</span>
        </td>
      `;

      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => {
        UI.showReceiveDetailModal(rec);
      });

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
