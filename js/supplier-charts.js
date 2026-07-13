/**
 * supplier-charts.js - "Qabul qilingan" & "Qaytarilgan" tabs: year/month filters + Chart.js rendering.
 * Depends on: SupplierPage, ReceivingRepository, Chart.js (global `Chart`).
 */

window.SupplierCharts = (function () {
  const P = SupplierPage;

  // Custom inline plugin to display data numbers above vertical bars
  const chartValueLabelsPluginVertical = {
    id: 'chartValueLabelsVertical',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          if (value === 0 || value === null || value === undefined) return;
          
          const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
          ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          
          const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
          const x = element.x;
          const y = element.y - 6; // Draw slightly above the bar
          
          ctx.fillText(formattedValue, x, y);
        });
      });
      ctx.restore();
    }
  };

  // Custom inline plugin to display data numbers to the right of horizontal bars
  const chartValueLabelsPluginHorizontal = {
    id: 'chartValueLabelsHorizontal',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          if (value === 0 || value === null || value === undefined) return;
          
          const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
          ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          
          const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
          const x = element.x + 6; // Draw slightly to the right of the bar
          const y = element.y;
          
          ctx.fillText(formattedValue, x, y);
        });
      });
      ctx.restore();
    }
  };

  async function initYearSelectors() {
    try {
      // Fetch distinct years from database
      const years = new Set(await ReceivingRepository.getDistinctYears());
      years.add(new Date().getFullYear());

      const sortedYears = Array.from(years).sort((a, b) => b - a);

      // Populate Received tab year select
      if (P.receivedChartYearSelect) {
        P.receivedChartYearSelect.innerHTML = '';
        sortedYears.forEach(yr => {
          const opt = document.createElement('option');
          opt.value = yr;
          opt.textContent = yr;
          P.receivedChartYearSelect.appendChild(opt);
        });
      }

      // Populate Returned tab year select
      if (P.returnedChartYearSelect) {
        P.returnedChartYearSelect.innerHTML = '';
        sortedYears.forEach(yr => {
          const opt = document.createElement('option');
          opt.value = yr;
          opt.textContent = yr;
          P.returnedChartYearSelect.appendChild(opt);
        });
      }

      // Bind filter change events
      if (P.receivedChartYearSelect) {
        P.receivedChartYearSelect.addEventListener('change', async () => {
          await renderReceived();
        });
      }
      if (P.receivedChartMonthSelect) {
        P.receivedChartMonthSelect.addEventListener('change', async () => {
          await renderReceived();
        });
      }

      if (P.returnedChartYearSelect) {
        P.returnedChartYearSelect.addEventListener('change', async () => {
          await renderReturned();
        });
      }
      if (P.returnedChartMonthSelect) {
        P.returnedChartMonthSelect.addEventListener('change', async () => {
          await renderReturned();
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function renderReceived() {
    if (!P.activeSupplierId) return;
    const yearSelect = P.receivedChartYearSelect;
    const monthSelect = P.receivedChartMonthSelect;
    if (!yearSelect || !yearSelect.value) return;

    if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
    try {
      const selectedYear = Number(yearSelect.value);
      const selectedMonth = monthSelect.value; // 'all' or '0'-'11'

      // Get records for the active supplier
      const records = await ReceivingRepository.getBySupplier(P.activeSupplierId);

      // Filter by selected year & month
      const filteredRecords = records.filter(rec => {
        const d = new Date(rec.date);
        if (d.getFullYear() !== selectedYear) return false;
        if (selectedMonth !== 'all' && d.getMonth() !== Number(selectedMonth)) return false;
        return true;
      });

      let labels = [];
      let qtyData = [];

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      if (selectedMonth === 'all') {
        labels = monthNames;
        qtyData = Array(12).fill(0);

        filteredRecords.forEach(rec => {
          const d = new Date(rec.date);
          const m = d.getMonth();
          qtyData[m] += rec.quantity;
        });
      } else {
        const monthIdx = Number(selectedMonth);
        const daysInMonth = new Date(selectedYear, monthIdx + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
          labels.push(d.toString());
        }

        qtyData = Array(daysInMonth).fill(0);

        filteredRecords.forEach(rec => {
          const d = new Date(rec.date);
          const day = d.getDate();
          qtyData[day - 1] += rec.quantity;
        });
      }

      // Group by detailId to find top received parts
      const partTotals = {};
      filteredRecords.forEach(rec => {
        const key = rec.detailId;
        const name = rec.detailName || '';
        if (!partTotals[key]) {
          partTotals[key] = { detailId: key, detailName: name, total: 0 };
        }
        partTotals[key].total += rec.quantity;
      });

      const topParts = Object.values(partTotals)
        .filter(item => item.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const topLabels = topParts.map(item => {
        const namePart = item.detailName ? ` - ${item.detailName}` : '';
        const fullLabel = `${item.detailId}${namePart}`;
        return fullLabel.length > 25 ? fullLabel.substring(0, 25) + '...' : fullLabel;
      });
      const topData = topParts.map(item => item.total);

      const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      const textColor = isDark ? '#94a3b8' : '#64748b';
      const gridColor = isDark ? '#334155' : '#e2e8f0';

      const ctxQty = document.getElementById('receivedQtyChart').getContext('2d');
      const ctxTop = document.getElementById('topReceivedPartsChart').getContext('2d');

      if (P.receivedQtyChart) P.receivedQtyChart.destroy();
      if (P.topReceivedPartsChart) P.topReceivedPartsChart.destroy();

      const primaryColor = isDark ? '#38bdf8' : '#0f172a';

      P.receivedQtyChart = new Chart(ctxQty, {
        type: 'bar',
        plugins: [chartValueLabelsPluginVertical],
        data: {
          labels: labels,
          datasets: [{
            label: 'Jami qabul qilingan',
            data: qtyData,
            backgroundColor: primaryColor,
            borderColor: primaryColor,
            borderRadius: 4,
            maxBarThickness: 32
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor } },
            y: { 
              grid: { color: gridColor }, 
              ticks: { color: textColor },
              grace: '10%'
            }
          }
        }
      });

      P.topReceivedPartsChart = new Chart(ctxTop, {
        type: 'bar',
        plugins: [chartValueLabelsPluginHorizontal],
        data: {
          labels: topLabels,
          datasets: [{
            label: 'Qabul qilingan',
            data: topData,
            backgroundColor: primaryColor,
            borderColor: primaryColor,
            borderRadius: 4,
            maxBarThickness: 24
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { 
              grid: { color: gridColor }, 
              ticks: { color: textColor },
              grace: '10%'
            },
            y: { 
              grid: { display: false }, 
              ticks: { color: textColor }
            }
          }
        }
      });

    } catch (err) {
      console.error(err);
    } finally {
      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
    }
  }

  async function renderReturned() {
    if (!P.activeSupplierId) return;
    const yearSelect = P.returnedChartYearSelect;
    const monthSelect = P.returnedChartMonthSelect;
    if (!yearSelect || !yearSelect.value) return;

    if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
    try {
      const selectedYear = Number(yearSelect.value);
      const selectedMonth = monthSelect.value; // 'all' or '0'-'11'

      // Get records for the active supplier
      const records = await ReceivingRepository.getBySupplier(P.activeSupplierId);

      // Filter by selected year & month
      const filteredRecords = records.filter(rec => {
        const d = new Date(rec.date);
        if (d.getFullYear() !== selectedYear) return false;
        if (selectedMonth !== 'all' && d.getMonth() !== Number(selectedMonth)) return false;
        return true;
      });

      let labels = [];
      let qtyData = [];

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      if (selectedMonth === 'all') {
        labels = monthNames;
        qtyData = Array(12).fill(0);

        filteredRecords.forEach(rec => {
          const d = new Date(rec.date);
          const m = d.getMonth();
          qtyData[m] += rec.returnedQuantity;
        });
      } else {
        const monthIdx = Number(selectedMonth);
        const daysInMonth = new Date(selectedYear, monthIdx + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
          labels.push(d.toString());
        }

        qtyData = Array(daysInMonth).fill(0);

        filteredRecords.forEach(rec => {
          const d = new Date(rec.date);
          const day = d.getDate();
          qtyData[day - 1] += rec.returnedQuantity;
        });
      }

      // Group by detailId to find top returned parts
      const partTotals = {};
      filteredRecords.forEach(rec => {
        const key = rec.detailId;
        const name = rec.detailName || '';
        if (!partTotals[key]) {
          partTotals[key] = { detailId: key, detailName: name, total: 0 };
        }
        partTotals[key].total += rec.returnedQuantity;
      });

      const topParts = Object.values(partTotals)
        .filter(item => item.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const topLabels = topParts.map(item => {
        const namePart = item.detailName ? ` - ${item.detailName}` : '';
        const fullLabel = `${item.detailId}${namePart}`;
        return fullLabel.length > 25 ? fullLabel.substring(0, 25) + '...' : fullLabel;
      });
      const topData = topParts.map(item => item.total);

      const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      const textColor = isDark ? '#94a3b8' : '#64748b';
      const gridColor = isDark ? '#334155' : '#e2e8f0';

      const ctxQty = document.getElementById('returnedQtyChart').getContext('2d');
      const ctxTop = document.getElementById('topReturnedPartsChart').getContext('2d');

      if (P.returnedQtyChart) P.returnedQtyChart.destroy();
      if (P.topReturnedPartsChart) P.topReturnedPartsChart.destroy();

      const dangerColor = '#dc3545';

      P.returnedQtyChart = new Chart(ctxQty, {
        type: 'bar',
        plugins: [chartValueLabelsPluginVertical],
        data: {
          labels: labels,
          datasets: [{
            label: 'Jami qaytarilgan',
            data: qtyData,
            backgroundColor: dangerColor,
            borderColor: dangerColor,
            borderRadius: 4,
            maxBarThickness: 32
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor } },
            y: { 
              grid: { color: gridColor }, 
              ticks: { color: textColor },
              grace: '10%'
            }
          }
        }
      });

      P.topReturnedPartsChart = new Chart(ctxTop, {
        type: 'bar',
        plugins: [chartValueLabelsPluginHorizontal],
        data: {
          labels: topLabels,
          datasets: [{
            label: 'Qaytarilgan',
            data: topData,
            backgroundColor: dangerColor,
            borderColor: dangerColor,
            borderRadius: 4,
            maxBarThickness: 24
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { 
              grid: { color: gridColor }, 
              ticks: { color: textColor },
              grace: '10%'
            },
            y: { 
              grid: { display: false }, 
              ticks: { color: textColor }
            }
          }
        }
      });

    } catch (err) {
      console.error(err);
    } finally {
      if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.remove('active');
    }
  }

  function bindEvents() {
    const themeToggle = document.getElementById('theme-toggle-btn');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        setTimeout(() => {
          P.renderActiveTab();
        }, 100);
      });
    }
  }

  return { initYearSelectors, renderReceived, renderReturned, bindEvents };
})();
