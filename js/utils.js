/**
 * utils.js - Shared, dependency-free helpers used across pages:
 * debouncing, table sort/state, validation rules, HTML escaping, DOM batching.
 */

window.Utils = {
  /**
   * Returns a debounced wrapper around fn. Trailing-edge only (fires `delay` ms
   * after the last call), matching the search-as-you-type use case.
   */
  debounce(fn, delay = 250) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Escapes HTML special characters so user-entered text can be safely interpolated
   * into innerHTML template strings without enabling stored XSS.
   */
  escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Creates a fresh table state object so each table gets its own independent
   * filter/sort/paging state without re-declaring the same shape everywhere.
   */
  createTableState({ sortColumn = 'date', sortOrder = 'desc', pageSize = 30 } = {}) {
    return {
      searchQuery: '',
      sortColumn,
      sortOrder,
      currentPage: 1,
      pageSize
    };
  },

  /**
   * Generic comparator-based sort used by every table in the app (Register log,
   * Supplier history, Supplier parts). Sorts case-insensitively for strings.
   * Mutates and returns `array` for convenient chaining.
   */
  sortRecords(array, sortColumn, sortOrder) {
    array.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return array;
  },

  /**
   * Wires up a set of `.sortable-header` elements (scoped to `scopeSelector`) so
   * clicking toggles sortColumn/sortOrder on `stateObj` and calls `onChange`.
   * Replaces the same hand-rolled listener that previously existed 3 times.
   */
  bindSortableHeaders(scopeSelector, stateObj, onChange) {
    document.querySelectorAll(`${scopeSelector} .sortable-header`).forEach(header => {
      header.addEventListener('click', () => {
        const column = header.getAttribute('data-sort');

        document.querySelectorAll(`${scopeSelector} .sortable-header`).forEach(h => {
          if (h !== header) h.classList.remove('asc', 'desc');
        });

        if (stateObj.sortColumn === column) {
          stateObj.sortOrder = stateObj.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          stateObj.sortColumn = column;
          stateObj.sortOrder = 'asc';
        }

        header.classList.remove('asc', 'desc');
        header.classList.add(stateObj.sortOrder);

        onChange();
      });
    });
  },

  /**
   * Shared quantity-relationship validation: Qty Received >= Qty Checked >= Qty Returned,
   * all >= 0 and Qty Received > 0. Used by both the registration form and the supplier
   * "Edit Delivery Record" modal so the business rule only lives in one place.
   * Returns { qtyValid, checkedValid, returnedValid }.
   */
  validateQuantities(qty, checked, returned) {
    const qtyValid = !isNaN(qty) && qty > 0;
    const checkedValid = !isNaN(checked) && checked >= 0 && checked <= qty;
    const returnedValid = !isNaN(returned) && returned >= 0 && returned <= checked;
    return { qtyValid, checkedValid, returnedValid };
  },

  /**
   * Renders Bootstrap pagination <li> controls into `container` for the given
   * stateObj/totalPages, invoking renderCallback() after changing page.
   * Single shared implementation (previously lived only inside supplier.js).
   */
  renderPagination(container, totalPages, stateObj, renderCallback) {
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const fragment = document.createDocumentFragment();

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
    fragment.appendChild(prevLi);

    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement('li');
      li.className = `page-item ${stateObj.currentPage === i ? 'active' : ''}`;
      li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      li.addEventListener('click', (e) => {
        e.preventDefault();
        stateObj.currentPage = i;
        renderCallback();
      });
      fragment.appendChild(li);
    }

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
    fragment.appendChild(nextLi);

    container.appendChild(fragment);
  },

  /**
   * Replaces the contents of `container` with rows built by `rowBuilder` for each
   * item in `items`, using a single DocumentFragment so the table only reflows once
   * instead of once per appendChild call.
   */
  renderRows(container, items, rowBuilder) {
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const row = rowBuilder(item);
      if (row) fragment.appendChild(row);
    });
    container.innerHTML = '';
    container.appendChild(fragment);
  }
};
