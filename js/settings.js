/**
 * settings.js - Settings page controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize shared navbar
  UI.initNavbar('settings.html');

  // DOM Elements - Navigation Sidebar
  const btnMenuInspectors = document.getElementById('menu-inspectors');
  const btnMenuComments = document.getElementById('menu-comments');
  const cardInspectors = document.getElementById('view-inspectors-card');
  const cardComments = document.getElementById('view-comments-card');
  const inspectorsSpinner = document.getElementById('inspectors-spinner');
  const commentsSpinner = document.getElementById('comments-spinner');

  // DOM Elements - Inspectors Management
  const inspectorsTableBody = document.getElementById('inspectors-table-body');
  const btnAddInspector = document.getElementById('btn-add-inspector');
  const inspectorModalElem = document.getElementById('inspectorModal');
  const inspectorModal = new bootstrap.Modal(inspectorModalElem);
  const inspectorForm = document.getElementById('inspector-form');
  const editInspectorIdInput = document.getElementById('edit-inspector-id');
  const inspectorNameInput = document.getElementById('inspector-name-input');
  const inspectorModalLabel = document.getElementById('inspectorModalLabel');

  // DOM Elements - Comments Management
  const commentsTableBody = document.getElementById('comments-table-body');
  const btnAddComment = document.getElementById('btn-add-comment');
  const commentModalElem = document.getElementById('commentModal');
  const commentModal = new bootstrap.Modal(commentModalElem);
  const commentForm = document.getElementById('comment-form');
  const editCommentIdInput = document.getElementById('edit-comment-id');
  const commentTextInput = document.getElementById('comment-text-input');
  const commentModalLabel = document.getElementById('commentModalLabel');

  // State Management
  let currentView = 'inspectors'; // inspectors | comments

  // --- INITIALIZATION --- (independent collections loaded in parallel)
  async function init() {
    await Promise.all([loadInspectorsTable(), loadCommentsTable()]);
  }

  // --- VIEW TOGGLE LOGIC ---
  function setView(viewName) {
    currentView = viewName;
    if (viewName === 'inspectors') {
      btnMenuInspectors.classList.add('active');
      btnMenuComments.classList.remove('active');
      cardInspectors.classList.remove('d-none');
      cardComments.classList.add('d-none');
    } else {
      btnMenuInspectors.classList.remove('active');
      btnMenuComments.classList.add('active');
      cardInspectors.classList.add('d-none');
      cardComments.classList.remove('d-none');
    }
  }

  btnMenuInspectors.addEventListener('click', () => setView('inspectors'));
  btnMenuComments.addEventListener('click', () => setView('comments'));


  // --- INSPECTORS LOGIC ---
  async function loadInspectorsTable() {
    if (inspectorsSpinner) inspectorsSpinner.classList.add('active');
    try {
      const inspectors = await InspectorRepository.getAll();

      if (inspectors.length === 0) {
        inspectorsTableBody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-muted">Inspektorlar ro\'yxatdan o\'tkazilmagan.</td></tr>';
        return;
      }

      Utils.renderRows(inspectorsTableBody, inspectors, (ins) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-semibold">${Utils.escapeHtml(ins.fullName)}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary edit-ins-btn" data-id="${ins.id}" title="Nomini o'zgartirish" aria-label="Rename inspector">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-outline-danger delete-ins-btn" data-id="${ins.id}" title="O'chirish" aria-label="Delete inspector">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        `;

        tr.querySelector('.edit-ins-btn').addEventListener('click', () => {
          openInspectorModalForEdit(ins);
        });

        tr.querySelector('.delete-ins-btn').addEventListener('click', () => {
          UI.confirm(
            'Inspektorni o\'chirish?',
            `"${ins.fullName}" inspektorini ro'yxatdan olib tashlaysizmi? Oldingi qabul qilish yozuvlaridagi inspektor nomi audit maqsadida saqlab qolinadi.`,
            async () => {
              if (inspectorsSpinner) inspectorsSpinner.classList.add('active');
              try {
                await InspectorRepository.remove(ins.id);
                UI.showToast('Inspektor o\'chirildi.');
                await loadInspectorsTable();
              } catch (err) {
                console.error(err);
                UI.showToast('Inspektorni o\'chirishda xatolik yuz berdi.', 'error');
              } finally {
                if (inspectorsSpinner) inspectorsSpinner.classList.remove('active');
              }
            }
          );
        });

        return tr;
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (inspectorsSpinner) inspectorsSpinner.classList.remove('active');
    }
  }

  btnAddInspector.addEventListener('click', () => {
    editInspectorIdInput.value = '';
    inspectorNameInput.value = '';
    inspectorModalLabel.textContent = 'Inspektor qo\'shish';
    inspectorForm.classList.remove('was-validated');
    inspectorModal.show();
  });

  function openInspectorModalForEdit(ins) {
    editInspectorIdInput.value = ins.id;
    inspectorNameInput.value = ins.fullName;
    inspectorModalLabel.textContent = 'Inspektor tafsilotlarini tahrirlash';
    inspectorForm.classList.remove('was-validated');
    inspectorModal.show();
  }

  inspectorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!inspectorForm.checkValidity()) {
      e.stopPropagation();
      inspectorForm.classList.add('was-validated');
      return;
    }

    const id = editInspectorIdInput.value;
    const name = inspectorNameInput.value.trim();

    if (inspectorsSpinner) inspectorsSpinner.classList.add('active');
    try {
      if (id) {
        await InspectorRepository.update(id, name);
        UI.showToast('Inspektor tafsilotlari yangilandi.');
      } else {
        await InspectorRepository.add(name);
        UI.showToast('Inspektor muvaffaqiyatli qo\'shildi.');
      }

      inspectorModal.hide();
      await loadInspectorsTable();
    } catch (err) {
      console.error(err);
      UI.showToast('Inspektorni saqlashda xatolik yuz berdi.', 'error');
    } finally {
      if (inspectorsSpinner) inspectorsSpinner.classList.remove('active');
    }
  });


  // --- COMMENTS LOGIC ---
  async function loadCommentsTable() {
    if (commentsSpinner) commentsSpinner.classList.add('active');
    try {
      const comments = await CommentRepository.getAll();

      if (comments.length === 0) {
        commentsTableBody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-muted">Tayyor izohlar mavjud emas.</td></tr>';
        return;
      }

      Utils.renderRows(commentsTableBody, comments, (cmt) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-monospace">${Utils.escapeHtml(cmt.text)}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary edit-cmt-btn" data-id="${cmt.id}" title="Nomini o'zgartirish" aria-label="Rename comment preset">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-outline-danger delete-cmt-btn" data-id="${cmt.id}" title="O'chirish" aria-label="Delete comment preset">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        `;

        tr.querySelector('.edit-cmt-btn').addEventListener('click', () => {
          openCommentModalForEdit(cmt);
        });

        tr.querySelector('.delete-cmt-btn').addEventListener('click', () => {
          UI.confirm(
            'Tayyor izohni o\'chirish?',
            `"${cmt.text}" izohini ro'yxatdan olib tashlaysizmi? Bu ro'yxatdan o'tgan qabul qilish yozuvlariga ta'sir qilmaydi.`,
            async () => {
              if (commentsSpinner) commentsSpinner.classList.add('active');
              try {
                await CommentRepository.remove(cmt.id);
                UI.showToast('Tayyor izoh o\'chirildi.');
                await loadCommentsTable();
              } catch (err) {
                console.error(err);
                UI.showToast('Tayyor izohni o\'chirishda xatolik yuz berdi.', 'error');
              } finally {
                if (commentsSpinner) commentsSpinner.classList.remove('active');
              }
            }
          );
        });

        return tr;
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (commentsSpinner) commentsSpinner.classList.remove('active');
    }
  }

  btnAddComment.addEventListener('click', () => {
    editCommentIdInput.value = '';
    commentTextInput.value = '';
    commentModalLabel.textContent = 'Tayyor izoh qo\'shish';
    commentForm.classList.remove('was-validated');
    commentModal.show();
  });

  function openCommentModalForEdit(cmt) {
    editCommentIdInput.value = cmt.id;
    commentTextInput.value = cmt.text;
    commentModalLabel.textContent = 'Tayyor izohni tahrirlash';
    commentForm.classList.remove('was-validated');
    commentModal.show();
  }

  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!commentForm.checkValidity()) {
      e.stopPropagation();
      commentForm.classList.add('was-validated');
      return;
    }

    const id = editCommentIdInput.value;
    const text = commentTextInput.value.trim();

    if (commentsSpinner) commentsSpinner.classList.add('active');
    try {
      if (id) {
        await CommentRepository.update(id, text);
        UI.showToast('Tayyor izoh yangilandi.');
      } else {
        await CommentRepository.add(text);
        UI.showToast('Tayyor izoh ro\'yxatga olindi.');
      }

      commentModal.hide();
      await loadCommentsTable();
    } catch (err) {
      console.error(err);
      UI.showToast('Tayyor izohni saqlashda xatolik yuz berdi.', 'error');
    } finally {
      if (commentsSpinner) commentsSpinner.classList.remove('active');
    }
  });

  // Run initializer
  init();
});
