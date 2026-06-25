/**
 * supplier-events.js - Entry point for the Suppliers page.
 * Wires up tab switching and runs the initial page load, tying together
 * SupplierPage (state), SupplierList, SupplierHistory, SupplierParts, SupplierCharts.
 */

document.addEventListener('DOMContentLoaded', () => {
  UI.initNavbar('supplier.html');

  const P = SupplierPage;
  P.cacheDom();

  // --- TABS SWITCHING ENGINE ---
  document.querySelectorAll('#supplierTabs button').forEach(tabBtn => {
    tabBtn.addEventListener('shown.bs.tab', async (e) => {
      const id = e.target.id;
      if (id === 'history-tab') P.activeTab = 'history';
      else if (id === 'parts-tab') P.activeTab = 'parts';
      else if (id === 'charts-tab') P.activeTab = 'charts';

      await P.renderActiveTab();
    });
  });

  SupplierList.bindEvents();
  SupplierHistory.bindEvents();
  SupplierParts.bindEvents();
  SupplierCharts.bindEvents();

  async function init() {
    await Promise.all([
      SupplierList.load(),
      SupplierCharts.initYearSelector()
    ]);

    // Default to empty state on initialization
    P.activeSupplierId = null;
    SupplierList.updateDetailCardState();
  }

  init();
});
