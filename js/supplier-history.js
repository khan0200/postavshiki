/**
 * supplier-history.js - "History" tab: delivery log table + Edit Delivery Record modal.
 * Depends on: SupplierPage, Utils, UI, ReceivingRepository, InspectorRepository, PartRepository.
 */

window.SupplierHistory = (function () {
  const P = SupplierPage;

  async function load() {
    if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
    try {
      // Scoped Firestore query (where supplierId == X) instead of downloading
      // every supplier's records and filtering in JS - reads are now
      // proportional to this supplier's data, not the whole collection.
      const [supplierRecords, inspectors] = await Promise.all([
        ReceivingRepository.getBySupplier(P.activeSupplierId),
        InspectorRepository.getAll()
      ]);

      if (P.historyRecsCount) {
        P.historyRecsCount.textContent = `(${supplierRecords.length} Recs)`;
      }

      const inspectorsById = new Map(inspectors.map(i => [i.id, i.fullName]));
      let records = supplierRecords.map(rec => ({
        ...rec,
        inspectorName: inspectorsById.get(rec.inspectorId) || 'Unknown Inspector'
      }));

      // 1. Filter
      const query = P.historySearchInput.value.toLowerCase().trim();
      if (query) {
        records = records.filter(rec =>
          rec.fn.toLowerCase().includes(query) ||
          rec.detailId.toLowerCase().includes(query) ||
          rec.detailName.toLowerCase().includes(query) ||
          rec.inspectorName.toLowerCase().includes(query)
        );
      }

      // 2. Sort (shared utility - identical behavior to the previous inline comparator)
      records = Utils.sortRecords(records, P.historyState.sortColumn, P.historyState.sortOrder);

      // 3. Paginate
      const totalEntries = records.length;
      const totalPages = Math.ceil(totalEntries / P.historyState.pageSize);

      if (P.historyState.currentPage > totalPages && totalPages > 0) {
        P.historyState.currentPage = totalPages;
      }

      const startIndex = (P.historyState.currentPage - 1) * P.historyState.pageSize;
      const endIndex = Math.min(startIndex + P.historyState.pageSize, totalEntries);
      const paginated = records.slice(startIndex, endIndex);

      if (totalEntries === 0) {
        P.historyTableBody.innerHTML = '';
        P.historyEmpty.classList.remove('d-none');
        P.historyInfoSummary.textContent = 'Showing 0 to 0 of 0 entries';
        P.historyPagination.innerHTML = '';
        P.historyPagerBar.classList.add('d-none');
        return;
      }

      P.historyEmpty.classList.add('d-none');
      P.historyPagerBar.classList.remove('d-none');
      P.historyInfoSummary.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalEntries} entries`;

      Utils.renderRows(P.historyTableBody, paginated, (rec) => {
        const tr = document.createElement('tr');

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
          <td>
            <div class="mb-0"><span class="badge bg-primary text-white font-monospace">${Utils.escapeHtml(rec.detailId)}</span></div>
            <div class="text-muted small text-wrap" style="font-size: 0.75rem; max-width: 200px;">${Utils.escapeHtml(rec.detailName)}</div>
          </td>
          <td class="text-end fw-semibold">${rec.quantity}</td>
          <td class="text-end text-success">${rec.checkedQuantity}</td>
          <td class="text-end text-danger">${rec.returnedQuantity}</td>
          <td class="small">${Utils.escapeHtml(rec.inspectorName)}</td>
          <td>
            <span class="badge rounded-pill ${rec.comment && rec.comment.trim().toUpperCase() === 'OK' ? 'bg-success' : 'bg-danger'} text-white text-wrap">${Utils.escapeHtml(rec.comment)}</span>
          </td>
          <td class="text-center text-nowrap">
            <button class="btn btn-outline-primary btn-sm border-0 py-0 px-1 me-1 edit-rec-btn" data-id="${rec.id}" aria-label="Edit record">
              <i class="bi bi-pencil-fill"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm border-0 py-0 px-1 delete-rec-btn" data-id="${rec.id}" aria-label="Delete record">
              <i class="bi bi-trash-fill"></i>
            </button>
          </td>
        `;

        tr.querySelector('.delete-rec-btn').addEventListener('click', () => {
          UI.confirm(
            'Delete Record?',
            `Are you sure you want to delete PO record ${rec.fn}? This cannot be undone.`,
            async () => {
              if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
              try {
                await ReceivingRepository.remove(rec.id, P.activeSupplierId);
                UI.showToast('Record deleted.');
                await SupplierList.load();
                await load();
              } catch (err) {
                console.error(err);
                UI.showToast('Failed to delete record.', 'error');
              } finally {
                if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
              }
            }
          );
        });

        tr.querySelector('.edit-rec-btn').addEventListener('click', async () => {
          await openEditRecordModal(rec);
        });

        return tr;
      });

      Utils.renderPagination(P.historyPagination, totalPages, P.historyState, load);
    } catch (err) {
      console.error(err);
    } finally {
      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
    }
  }

  async function openEditRecordModal(rec) {
    if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
    try {
      // Independent collections needed to populate the two <select> elements - parallel load.
      const [inspectors, parts] = await Promise.all([
        InspectorRepository.getAll(),
        PartRepository.getBySupplier(P.activeSupplierId)
      ]);

      P.editRecInspector.innerHTML = '';
      inspectors.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)).forEach(ins => {
        const opt = document.createElement('option');
        opt.value = ins.id;
        opt.textContent = ins.fullName;
        if (ins.id === rec.inspectorId) opt.selected = true;
        P.editRecInspector.appendChild(opt);
      });

      P.editRecPart.innerHTML = '';
      parts.slice().sort((a, b) => a.detailId.localeCompare(b.detailId)).forEach(part => {
        const opt = document.createElement('option');
        opt.value = part.detailId;
        opt.textContent = `${part.detailId} - ${part.detailName}`;
        opt.dataset.name = part.detailName;
        if (part.detailId === rec.detailId) opt.selected = true;
        P.editRecPart.appendChild(opt);
      });

      P.editRecId.value = rec.id;
      P.editRecDate.value = rec.date;
      P.editRecFn.value = rec.fn;
      P.editRecQty.value = rec.quantity;
      P.editRecChecked.value = rec.checkedQuantity;
      P.editRecReturned.value = rec.returnedQuantity;
      P.editRecComment.value = rec.comment || '';

      P.editRecordForm.classList.remove('was-validated');
      P.editRecChecked.classList.remove('is-invalid');
      P.editRecReturned.classList.remove('is-invalid');

      P.editRecordModal.show();
    } catch (err) {
      console.error(err);
      UI.showToast('Failed to load record details.', 'error');
    } finally {
      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
    }
  }

  function parseCSV(text) {
    const cleanText = text.startsWith('\ufeff') ? text.slice(1) : text;
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push("");
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  }

  async function handleCsvImport(file) {
    if (!P.activeSupplierId) {
      UI.showToast('Please select a supplier first.', 'error');
      return;
    }

    const activeSupplier = await SupplierRepository.getById(P.activeSupplierId);
    if (!activeSupplier) {
      UI.showToast('Active supplier not found.', 'error');
      return;
    }
    const activeSupplierName = activeSupplier.name;

    const reader = new FileReader();
    reader.onload = async function (e) {
      const text = e.target.result;

      P.importProgressModal.show();
      P.importProgressStatus.textContent = 'Parsing CSV file...';
      P.importProgressBar.style.width = '0%';
      P.importProgressBar.setAttribute('aria-valuenow', 0);
      P.importProgressDetail.textContent = 'Starting parse...';

      try {
        const rawRows = parseCSV(text);
        if (rawRows.length <= 1) {
          throw new Error('CSV is empty or contains no data rows.');
        }

        const headers = rawRows[0].map(h => h.trim().toLowerCase());
        const expected = ['sana', 'f/n', 'detal id', 'soni'];
        const missing = expected.filter(exp => !headers.includes(exp));
        if (missing.length > 0) {
          throw new Error(`Invalid CSV structure. Missing columns: ${missing.join(', ')}`);
        }

        const sanaIndex = headers.indexOf('sana');
        const fnIndex = headers.indexOf('f/n');
        const detailIdIndex = headers.indexOf('detal id');
        const soniIndex = headers.indexOf('soni');
        const tekshirildiIndex = headers.indexOf('tekshirildi');
        const qaytarildiIndex = headers.indexOf('qaytarildi');
        const tekshirdiIndex = headers.indexOf('tekshirdi');
        const izohIndex = headers.indexOf('izoh');

        const dataRows = rawRows.slice(1).filter(row =>
          row.length > Math.max(sanaIndex, fnIndex, detailIdIndex, soniIndex) &&
          row[sanaIndex].trim() !== ''
        );

        if (dataRows.length === 0) {
          throw new Error('No valid records found in the CSV.');
        }

        P.importProgressStatus.textContent = 'Preparing records...';
        P.importProgressDetail.textContent = `Found ${dataRows.length} rows.`;

        // CSV parsing/normalization stays client-side (pure text processing);
        // the parsed rows are sent in one request to the API, which resolves/
        // creates inspectors and parts and bulk-inserts the records server-side
        // (previously: many small Firestore batches issued directly from here).
        const rows = dataRows.map(row => {
          const rawDate = row[sanaIndex].trim();
          let dateFormatted = '';
          const dateParts = rawDate.split('.');
          if (dateParts.length === 3) {
            dateFormatted = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
          } else {
            const parsedD = new Date(rawDate);
            if (!isNaN(parsedD.getTime())) {
              dateFormatted = parsedD.toISOString().split('T')[0];
            } else {
              dateFormatted = new Date().toISOString().split('T')[0];
            }
          }

          return {
            date: dateFormatted,
            fn: row[fnIndex] ? row[fnIndex].trim() : '',
            detailId: row[detailIdIndex] ? row[detailIdIndex].trim().toUpperCase() : '',
            quantity: parseInt(row[soniIndex]) || 0,
            checkedQuantity: (tekshirildiIndex !== -1 && row[tekshirildiIndex]) ? parseInt(row[tekshirildiIndex]) || 0 : (parseInt(row[soniIndex]) || 0),
            returnedQuantity: (qaytarildiIndex !== -1 && row[qaytarildiIndex]) ? parseInt(row[qaytarildiIndex]) || 0 : 0,
            comment: (izohIndex !== -1 && row[izohIndex]) ? row[izohIndex].trim() : 'OK',
            inspectorName: (tekshirdiIndex !== -1 && row[tekshirdiIndex]) ? row[tekshirdiIndex].trim() : 'Unknown'
          };
        });

        P.importProgressStatus.textContent = 'Importing history records...';
        P.importProgressBar.style.width = '50%';
        P.importProgressBar.setAttribute('aria-valuenow', 50);
        P.importProgressDetail.textContent = `Uploading ${rows.length} records...`;

        const result = await ReceivingRepository.importRows(P.activeSupplierId, activeSupplierName, rows);

        P.importProgressBar.style.width = '100%';
        P.importProgressBar.setAttribute('aria-valuenow', 100);
        P.importProgressDetail.textContent = `${result.imported} / ${rows.length} records written...`;

        Cache.invalidate('parts:all');
        Cache.invalidate(`parts:bySupplier:${P.activeSupplierId}`);

        UI.showToast(`Successfully imported ${result.imported} delivery records!`);
        P.importProgressModal.hide();

        await SupplierList.load();
        await load();
      } catch (err) {
        console.error(err);
        P.importProgressModal.hide();
        UI.showToast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.onerror = function () {
      P.importProgressModal.hide();
      UI.showToast('Failed to read CSV file.', 'error');
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    P.historySearchInput.addEventListener('input', Utils.debounce(() => {
      P.historyState.currentPage = 1;
      load();
    }, 250));

    Utils.bindSortableHeaders('#history-table', P.historyState, load);

    if (P.btnImportCsv && P.csvFileInput) {
      P.btnImportCsv.addEventListener('click', () => {
        P.csvFileInput.click();
      });

      P.csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          handleCsvImport(file);
        }
        P.csvFileInput.value = '';
      });
    }

    P.editRecordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!P.editRecordForm.checkValidity()) {
        e.stopPropagation();
        P.editRecordForm.classList.add('was-validated');
        return;
      }

      const qty = Number(P.editRecQty.value);
      const checked = Number(P.editRecChecked.value);
      const returned = Number(P.editRecReturned.value);

      const { checkedValid, returnedValid } = Utils.validateQuantities(qty, checked, returned);

      P.editRecChecked.classList.toggle('is-invalid', !checkedValid);
      P.editRecReturned.classList.toggle('is-invalid', !returnedValid);

      if (!checkedValid || !returnedValid) return;

      const id = P.editRecId.value;
      const selectedPartOpt = P.editRecPart.options[P.editRecPart.selectedIndex];
      const detailName = selectedPartOpt.dataset.name;
      const supplierName = P.detailSupplierName.textContent;
      const inspectorName = P.editRecInspector.options[P.editRecInspector.selectedIndex].textContent;

      const updatedData = {
        date: P.editRecDate.value,
        fn: P.editRecFn.value,
        supplierId: P.activeSupplierId,
        supplierName,
        inspectorId: P.editRecInspector.value,
        inspectorName,
        detailId: P.editRecPart.value,
        detailName,
        quantity: qty,
        checkedQuantity: checked,
        returnedQuantity: returned,
        comment: P.editRecComment.value || 'OK'
      };

      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
      try {
        await ReceivingRepository.update(id, updatedData);
        UI.showToast('Delivery record updated successfully.');
        P.editRecordModal.hide();
        await load();
      } catch (err) {
        console.error(err);
        UI.showToast('Failed to update record.', 'error');
      } finally {
        if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
      }
    });
  }

  return { load, openEditRecordModal, bindEvents };
})();
