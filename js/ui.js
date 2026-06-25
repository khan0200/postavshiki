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
    if (!modalElem) {
      const html = `
        <div class="modal fade" id="ui-confirm-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg">
              <div class="modal-header border-0 pb-0">
                <h5 class="modal-title d-flex align-items-center text-danger fw-bold">
                  <i class="bi bi-exclamation-triangle-fill me-2 fs-4"></i>
                  ${title}
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body py-3">
                <p class="text-secondary mb-0" id="ui-confirm-body-text">${message}</p>
              </div>
              <div class="modal-footer border-0 pt-0">
                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-danger" id="ui-confirm-ok-btn">Confirm Delete</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', html);
      modalElem = document.getElementById('ui-confirm-modal');
    } else {
      document.getElementById('ui-confirm-body-text').innerText = message;
      modalElem.querySelector('.modal-title').innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2 fs-4"></i> ${title}`;
    }
    
    const bsModal = new bootstrap.Modal(modalElem);
    const okBtn = document.getElementById('ui-confirm-ok-btn');
    
    // Remove previous listeners by cloning the button
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    newOkBtn.addEventListener('click', () => {
      onConfirm();
      bsModal.hide();
    });
    
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
