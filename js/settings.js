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

  // --- INITIALIZATION ---
  async function init() {
    await loadInspectorsTable();
    await loadCommentsTable();
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
      const inspectors = await AppStorage.getInspectors();
      inspectorsTableBody.innerHTML = '';

      if (inspectors.length === 0) {
        inspectorsTableBody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-muted">No inspectors registered.</td></tr>';
        return;
      }

      inspectors.forEach(ins => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-semibold">${ins.fullName}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary edit-ins-btn" data-id="${ins.id}" title="Rename">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-outline-danger delete-ins-btn" data-id="${ins.id}" title="Delete">
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
            'Delete Inspector?',
            `Remove "${ins.fullName}" from the inspector list? Past receiving records will preserve this inspector name for audit purposes.`,
            async () => {
              if (inspectorsSpinner) inspectorsSpinner.classList.add('active');
              try {
                await AppStorage.deleteInspector(ins.id);
                UI.showToast('Inspector removed.');
                await loadInspectorsTable();
              } catch (err) {
                console.error(err);
                UI.showToast('Failed to delete inspector.', 'error');
              } finally {
                if (inspectorsSpinner) inspectorsSpinner.classList.remove('active');
              }
            }
          );
        });

        inspectorsTableBody.appendChild(tr);
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
    inspectorModalLabel.textContent = 'Add Inspector';
    inspectorForm.classList.remove('was-validated');
    inspectorModal.show();
  });

  function openInspectorModalForEdit(ins) {
    editInspectorIdInput.value = ins.id;
    inspectorNameInput.value = ins.fullName;
    inspectorModalLabel.textContent = 'Edit Inspector Details';
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
        await AppStorage.updateInspector(id, name);
        UI.showToast('Inspector details updated.');
      } else {
        await AppStorage.addInspector(name);
        UI.showToast('Inspector added successfully.');
      }
      
      inspectorModal.hide();
      await loadInspectorsTable();
    } catch (err) {
      console.error(err);
      UI.showToast('Failed to save inspector.', 'error');
    } finally {
      if (inspectorsSpinner) inspectorsSpinner.classList.remove('active');
    }
  });


  // --- COMMENTS LOGIC ---
  async function loadCommentsTable() {
    if (commentsSpinner) commentsSpinner.classList.add('active');
    try {
      const comments = await AppStorage.getComments();
      commentsTableBody.innerHTML = '';

      if (comments.length === 0) {
        commentsTableBody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-muted">No comment presets defined.</td></tr>';
        return;
      }

      comments.forEach(cmt => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-monospace">${cmt.text}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary edit-cmt-btn" data-id="${cmt.id}" title="Rename">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-outline-danger delete-cmt-btn" data-id="${cmt.id}" title="Delete">
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
            'Delete Comment Preset?',
            `Remove "${cmt.text}" from the quick-select list? This will not affect any registered receiving records.`,
            async () => {
              if (commentsSpinner) commentsSpinner.classList.add('active');
              try {
                await AppStorage.deleteComment(cmt.id);
                UI.showToast('Comment preset removed.');
                await loadCommentsTable();
              } catch (err) {
                console.error(err);
                UI.showToast('Failed to delete comment preset.', 'error');
              } finally {
                if (commentsSpinner) commentsSpinner.classList.remove('active');
              }
            }
          );
        });

        commentsTableBody.appendChild(tr);
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
    commentModalLabel.textContent = 'Add Comment Preset';
    commentForm.classList.remove('was-validated');
    commentModal.show();
  });

  function openCommentModalForEdit(cmt) {
    editCommentIdInput.value = cmt.id;
    commentTextInput.value = cmt.text;
    commentModalLabel.textContent = 'Edit Comment Preset';
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
        await AppStorage.updateComment(id, text);
        UI.showToast('Comment preset updated.');
      } else {
        await AppStorage.addComment(text);
        UI.showToast('Comment preset registered.');
      }

      commentModal.hide();
      await loadCommentsTable();
    } catch (err) {
      console.error(err);
      UI.showToast('Failed to save comment preset.', 'error');
    } finally {
      if (commentsSpinner) commentsSpinner.classList.remove('active');
    }
  });

  // Run initializer
  init();
});
