/**
 * supplier-state.js - Shared state & DOM references for the Suppliers page.
 *
 * supplier.js was a 1159-line monolith mixing supplier CRUD, parts CRUD,
 * transfer, record editing, pagination, and chart logic. It's now split into
 * cohesive modules (supplier-list.js, supplier-history.js, supplier-parts.js,
 * supplier-charts.js, supplier-events.js) that all share this single `SupplierPage`
 * namespace instead of relying on closures over one giant DOMContentLoaded handler.
 *
 * Load order (see supplier.html): this file MUST load before the other
 * supplier-*.js modules, all of which read/write `window.SupplierPage`.
 */

window.SupplierPage = {
  // --- DOM Elements - Left Panel ---
  searchSupplierInput: null,
  suppliersListContainer: null,
  supplierListEmpty: null,
  btnAddSupplier: null,
  supplierListSpinner: null,

  // --- DOM Elements - Right Panel ---
  detailCard: null,
  detailSupplierName: null,
  btnEditSupplier: null,
  btnDeleteSupplier: null,
  supplierDetailSpinner: null,

  // --- Tab - History ---
  historySearchInput: null,
  historyTableBody: null,
  historyEmpty: null,
  historyInfoSummary: null,
  historyPagination: null,
  historyPagerBar: null,

  // --- Tab - Parts ---
  partsSearchInput: null,
  partsTableBody: null,
  partsEmpty: null,
  partsInfoSummary: null,
  partsPagination: null,
  partsPagerBar: null,
  btnAddPart: null,

  // --- Tab - Charts ---
  chartYearSelect: null,
  chartMonthSelect: null,

  // --- Modals & Forms ---
  supplierModal: null,
  supplierForm: null,
  supplierNameInput: null,
  editSupplierIdInput: null,
  supplierModalLabel: null,

  partModal: null,
  partForm: null,
  partDetailIdInput: null,
  partDetailNameInput: null,
  editPartIdInput: null,
  partModalLabel: null,

  transferModal: null,
  transferForm: null,
  transferPartIdInput: null,
  transferPartDisplay: null,
  transferDestinationSelect: null,

  editRecordModal: null,
  editRecordForm: null,
  editRecId: null,
  editRecDate: null,
  editRecFn: null,
  editRecInspector: null,
  editRecPart: null,
  editRecQty: null,
  editRecChecked: null,
  editRecReturned: null,
  editRecComment: null,

  // --- State ---
  activeSupplierId: null,
  activeTab: 'history', // history | parts | charts

  historyState: Utils.createTableState({ sortColumn: 'date', sortOrder: 'desc', pageSize: 30 }),
  partsState: Utils.createTableState({ sortColumn: 'detailId', sortOrder: 'asc', pageSize: 30 }),

  incomingChart: null,
  returnedChart: null,

  /**
   * Caches all the DOM lookups once on page load. Each module reads from
   * `SupplierPage.<element>` instead of re-querying the DOM itself.
   */
  cacheDom() {
    this.searchSupplierInput = document.getElementById('supplier-search');
    this.suppliersListContainer = document.getElementById('suppliers-list');
    this.supplierListEmpty = document.getElementById('supplier-list-empty');
    this.btnAddSupplier = document.getElementById('btn-add-supplier');
    this.supplierListSpinner = document.getElementById('supplier-list-spinner');

    this.detailCard = document.getElementById('supplier-detail-card');
    this.detailSupplierName = document.getElementById('detail-supplier-name');
    this.btnEditSupplier = document.getElementById('btn-edit-supplier');
    this.btnDeleteSupplier = document.getElementById('btn-delete-supplier');
    this.supplierDetailSpinner = document.getElementById('supplier-detail-spinner');

    this.historySearchInput = document.getElementById('history-search');
    this.historyTableBody = document.getElementById('history-table-body');
    this.historyEmpty = document.getElementById('history-empty');
    this.historyInfoSummary = document.getElementById('history-info-summary');
    this.historyPagination = document.getElementById('history-pagination');
    this.historyPagerBar = document.getElementById('history-pager-bar');

    this.partsSearchInput = document.getElementById('parts-search');
    this.partsTableBody = document.getElementById('parts-table-body');
    this.partsEmpty = document.getElementById('parts-empty');
    this.partsInfoSummary = document.getElementById('parts-info-summary');
    this.partsPagination = document.getElementById('parts-pagination');
    this.partsPagerBar = document.getElementById('parts-pager-bar');
    this.btnAddPart = document.getElementById('btn-add-part');

    this.chartYearSelect = document.getElementById('chart-year');
    this.chartMonthSelect = document.getElementById('chart-month');

    this.supplierModalElem = document.getElementById('supplierModal');
    this.supplierModal = new bootstrap.Modal(this.supplierModalElem);
    this.supplierForm = document.getElementById('supplier-form');
    this.supplierNameInput = document.getElementById('supplier-name-input');
    this.editSupplierIdInput = document.getElementById('edit-supplier-id');
    this.supplierModalLabel = document.getElementById('supplierModalLabel');

    this.partModalElem = document.getElementById('partModal');
    this.partModal = new bootstrap.Modal(this.partModalElem);
    this.partForm = document.getElementById('part-form');
    this.partDetailIdInput = document.getElementById('part-detail-id-input');
    this.partDetailNameInput = document.getElementById('part-detail-name-input');
    this.editPartIdInput = document.getElementById('edit-part-id');
    this.partModalLabel = document.getElementById('partModalLabel');

    this.transferModalElem = document.getElementById('transferModal');
    this.transferModal = new bootstrap.Modal(this.transferModalElem);
    this.transferForm = document.getElementById('transfer-form');
    this.transferPartIdInput = document.getElementById('transfer-part-id');
    this.transferPartDisplay = document.getElementById('transfer-part-display');
    this.transferDestinationSelect = document.getElementById('transfer-destination-select');

    this.editRecordModalElem = document.getElementById('editRecordModal');
    this.editRecordModal = new bootstrap.Modal(this.editRecordModalElem);
    this.editRecordForm = document.getElementById('edit-record-form');
    this.editRecId = document.getElementById('edit-rec-id');
    this.editRecDate = document.getElementById('edit-rec-date');
    this.editRecFn = document.getElementById('edit-rec-fn');
    this.editRecInspector = document.getElementById('edit-rec-inspector');
    this.editRecPart = document.getElementById('edit-rec-part');
    this.editRecQty = document.getElementById('edit-rec-qty');
    this.editRecChecked = document.getElementById('edit-rec-checked');
    this.editRecReturned = document.getElementById('edit-rec-returned');
    this.editRecComment = document.getElementById('edit-rec-comment');
  },

  /**
   * Re-renders whichever tab is currently active. Called after any data change
   * that could affect the visible tab (record edits, part edits, etc).
   */
  async renderActiveTab() {
    if (!this.activeSupplierId) return;

    if (this.activeTab === 'history') {
      await SupplierHistory.load();
    } else if (this.activeTab === 'parts') {
      await SupplierParts.load();
    } else if (this.activeTab === 'charts') {
      await SupplierCharts.render();
    }
  }
};
