/**
 * ui.js - Reusable UI components & Helpers
 * Manages dynamic alerts, confirm modals, and active navbar rendering.
 */

window.UI = {
  // Dynamic success/error toast notifications
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container') || this.createToastContainer();
    const id = 'toast-' + Date.now();
    const iconClass = type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger';
    const borderClass = type === 'success' ? 'border-success' : 'border-danger';
    
    const html = `
      <div id="${id}" class="toast align-items-center border-start border-4 ${borderClass} shadow" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body d-flex align-items-center">
            <i class="bi ${iconClass} fs-5 me-2"></i>
            <div class="fw-medium">${message}</div>
          </div>
          <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    const elem = document.getElementById(id);
    const toast = new bootstrap.Toast(elem, { delay: 4000 });
    toast.show();
    elem.addEventListener('hidden.bs.toast', () => {
      elem.remove();
    });
  },
  
  createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    div.style.zIndex = '1100';
    document.body.appendChild(div);
    return div;
  },
  
  // Custom confirmation dialog before deletion
  confirm(title, message, onConfirm) {
    let modalElem = document.getElementById('ui-confirm-modal');
    const num = Math.floor(Math.random() * 50) + 1;
    const ans = num * 2;

    if (!modalElem) {
      const html = `
        <div class="modal fade" id="ui-confirm-modal" data-bs-backdrop="static" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg">
              <div class="modal-header border-0 pb-0">
                <h5 class="modal-title d-flex align-items-center text-danger fw-bold">
                  <i class="bi bi-shield-lock-fill me-2 fs-4"></i>
                  ${title}
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body py-3 text-center">
                <p class="text-secondary text-start mb-3" id="ui-confirm-body-text">${message}</p>
                <div class="fs-2 fw-bold text-primary mb-3" id="ui-confirm-challenge-num">${num}</div>
                <input type="number" class="form-control text-center mx-auto" id="ui-confirm-pass-input" placeholder="Natijani kiriting..." style="max-width: 200px;">
                <div class="text-danger small mt-2" id="ui-confirm-error" style="display: none;">Xato parol! Qaytadan urinib ko'ring.</div>
              </div>
              <div class="modal-footer border-0 pt-0">
                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Bekor qilish</button>
                <button type="button" class="btn btn-danger" id="ui-confirm-ok-btn">Tasdiqlash</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', html);
      modalElem = document.getElementById('ui-confirm-modal');
    } else {
      document.getElementById('ui-confirm-body-text').innerText = message;
      modalElem.querySelector('.modal-title').innerHTML = `<i class="bi bi-shield-lock-fill me-2 fs-4"></i> ${title}`;
      document.getElementById('ui-confirm-challenge-num').textContent = num;
      document.getElementById('ui-confirm-pass-input').value = '';
      document.getElementById('ui-confirm-error').style.display = 'none';
    }
    
    const bsModal = new bootstrap.Modal(modalElem);
    const okBtn = document.getElementById('ui-confirm-ok-btn');
    const passInput = document.getElementById('ui-confirm-pass-input');
    const errorDiv = document.getElementById('ui-confirm-error');
    
    passInput.addEventListener('input', () => {
      errorDiv.style.display = 'none';
    });
    
    // Remove previous listeners by cloning the button
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    newOkBtn.addEventListener('click', () => {
      if (parseInt(passInput.value) === ans) {
        onConfirm();
        bsModal.hide();
      } else {
        errorDiv.style.display = 'block';
        passInput.value = '';
        passInput.focus();
      }
    });
    
    bsModal.show();
  },
  
  /**
   * Creates a reusable "type to search, click to select" dropdown control.
   * Replaces the two near-identical implementations that previously existed
   * independently for the Comment Presets list and the Detail ID search box.
   *
   * options:
   *   inputEl          - the visible text <input>
   *   menuEl           - the dropdown menu container element
   *   getItems()       - returns the current full array of selectable items
   *   filterFn(item, query) -> boolean
   *   renderItem(item) -> string (innerHTML for one menu entry)
   *   onSelect(item)   - called when an item is clicked
   *   emptyText        - text shown when no items match (default: 'No matches')
   *
   * Returns { render(query) } so callers can force a re-render (e.g. on focus).
   */
  createSearchableDropdown({ inputEl, menuEl, getItems, filterFn, renderItem, onSelect, emptyText = 'Moslik topilmadi' }) {
    function render(query = '') {
      const items = getItems();
      const filtered = items.filter(item => filterFn(item, query));

      menuEl.innerHTML = '';

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'px-3 py-2 text-muted small';
        empty.textContent = emptyText;
        menuEl.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      filtered.forEach(item => {
        const el = document.createElement('div');
        el.className = 'custom-dropdown-item';
        el.innerHTML = renderItem(item);
        el.addEventListener('click', () => onSelect(item));
        fragment.appendChild(el);
      });
      menuEl.appendChild(fragment);
    }

    inputEl.addEventListener('focus', () => {
      render(inputEl.value);
      menuEl.classList.add('show');
    });

    // Hide this dropdown when the user clicks anywhere outside its container.
    document.addEventListener('click', (e) => {
      const container = inputEl.closest('.custom-dropdown-container') || inputEl.parentElement;
      if (!e.target.closest('.custom-dropdown-container') || (container && !container.contains(e.target))) {
        menuEl.classList.remove('show');
      }
    });

    return { render };
  },

  // View detailed receive records in a popup modal
  showReceiveDetailModal(rec) {
    let modalElem = document.getElementById('receive-detail-modal');
    if (!modalElem) {
      const html = `
        <div class="modal fade" id="receive-detail-modal" tabindex="-1" aria-labelledby="receiveDetailModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered modal-md">
            <div class="modal-content border-0 shadow-lg">
              <div class="modal-header bg-body-tertiary">
                <h5 class="modal-title fw-bold text-primary" id="receiveDetailModalLabel">
                  <i class="bi bi-info-circle-fill me-2"></i>Qabul qilish tafsilotlari
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <!-- Info Grid Card -->
                <div class="card border-0 bg-body-tertiary p-3 mb-3">
                  <div class="d-flex justify-content-between mb-2 pb-1 border-bottom border-light-subtle">
                    <span class="text-muted small">Buyurtma (F/N):</span>
                    <strong class="font-monospace text-dark-emphasis" id="detail-modal-fn"></strong>
                  </div>
                  <div class="d-flex justify-content-between mb-2 pb-1 border-bottom border-light-subtle">
                    <span class="text-muted small">Sana:</span>
                    <span class="fw-semibold text-dark-emphasis" id="detail-modal-date"></span>
                  </div>
                  <div class="d-flex justify-content-between mb-2 pb-1 border-bottom border-light-subtle">
                    <span class="text-muted small">Yetkazib beruvchi:</span>
                    <span class="fw-semibold text-dark-emphasis text-end" id="detail-modal-supplier" style="max-width: 65%;"></span>
                  </div>
                  <div class="d-flex justify-content-between">
                    <span class="text-muted small">Inspektor:</span>
                    <span class="fw-semibold text-dark-emphasis text-end" id="detail-modal-inspector" style="max-width: 65%;"></span>
                  </div>
                </div>

                <!-- Detal Card -->
                <h6 class="fw-bold mb-2 text-secondary-emphasis">Detal ma'lumotlari</h6>
                <div class="card border-0 bg-body-tertiary p-3 mb-3">
                  <div class="d-flex align-items-center">
                    <span class="badge bg-primary text-white font-monospace me-2 px-2 py-1.5" id="detail-modal-detail-id" style="font-size: 0.85rem;"></span>
                    <span class="fw-bold text-dark-emphasis text-truncate" id="detail-modal-detail-name"></span>
                  </div>
                </div>

                <!-- Miqdorlar -->
                <h6 class="fw-bold mb-2 text-secondary-emphasis">Miqdorlar</h6>
                <div class="row g-2 mb-3">
                  <div class="col-4">
                    <div class="border rounded p-2 text-center bg-body-secondary border-secondary-subtle">
                      <div class="text-muted small mb-1" style="font-size: 0.72rem;">Qabul qilindi</div>
                      <strong class="fs-5 text-dark-emphasis" id="detail-modal-qty"></strong>
                    </div>
                  </div>
                  <div class="col-4">
                    <div class="border rounded p-2 text-center bg-success-subtle border-success-subtle text-success">
                      <div class="text-success-emphasis small mb-1" style="font-size: 0.72rem;">Tekshirildi</div>
                      <strong class="fs-5 text-success-emphasis" id="detail-modal-checked"></strong>
                    </div>
                  </div>
                  <div class="col-4">
                    <div class="border rounded p-2 text-center bg-danger-subtle border-danger-subtle text-danger">
                      <div class="text-danger-emphasis small mb-1" style="font-size: 0.72rem;">Qaytarildi</div>
                      <strong class="fs-5 text-danger-emphasis" id="detail-modal-returned"></strong>
                    </div>
                  </div>
                </div>

                <!-- Izoh -->
                <h6 class="fw-bold mb-2 text-secondary-emphasis">Izoh</h6>
                <div class="p-3 border rounded text-center fw-bold" id="detail-modal-comment">
                </div>
              </div>
              <div class="modal-footer border-0 pt-0">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Yopish</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', html);
      modalElem = document.getElementById('receive-detail-modal');
    }

    const supplierName = rec.supplierName || (window.SupplierPage && window.SupplierPage.detailSupplierName ? window.SupplierPage.detailSupplierName.textContent : '');
    
    // Parse/format date with hours:minutes if available
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

    document.getElementById('detail-modal-fn').textContent = rec.fn || '';
    document.getElementById('detail-modal-date').textContent = displayDate;
    document.getElementById('detail-modal-supplier').textContent = supplierName;
    document.getElementById('detail-modal-inspector').textContent = rec.inspectorName || '';
    document.getElementById('detail-modal-detail-id').textContent = rec.detailId || '';
    document.getElementById('detail-modal-detail-name').textContent = rec.detailName || '';
    document.getElementById('detail-modal-qty').textContent = rec.quantity || '0';
    document.getElementById('detail-modal-checked').textContent = rec.checkedQuantity || '0';
    document.getElementById('detail-modal-returned').textContent = rec.returnedQuantity || '0';

    const commentEl = document.getElementById('detail-modal-comment');
    const commentText = rec.comment || 'OK';
    commentEl.textContent = commentText;

    // Apply color class based on comment content
    commentEl.className = 'p-2.5 border rounded text-white text-center fw-semibold';
    if (commentText.trim().toUpperCase() === 'OK') {
      commentEl.classList.add('bg-success', 'border-success');
    } else {
      commentEl.classList.add('bg-danger', 'border-danger');
    }

    const bsModal = new bootstrap.Modal(modalElem);
    bsModal.show();
  },

  // Shared navigation initialization
  initNavbar(activePage) {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    // Highlight the active page nav-link
    const links = navbar.querySelectorAll('.nav-link');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href.includes(activePage) || (activePage === 'index.html' && href === 'index.html'))) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
      }
    });

    // Theme toggler logic
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      const getPreferredTheme = () => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) return storedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      };
      
      const setTheme = (theme) => {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
          themeBtn.innerHTML = '<i class="bi bi-sun-fill text-warning"></i>';
          themeBtn.title = 'Switch to Light Mode';
        } else {
          themeBtn.innerHTML = '<i class="bi bi-moon-stars-fill text-primary"></i>';
          themeBtn.title = 'Switch to Dark Mode';
        }
      };

      setTheme(getPreferredTheme());

      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
      });
    }
  }
};
