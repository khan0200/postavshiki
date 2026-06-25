/**
 * supplier-charts.js - "Reports & Stats" tab: year/month filters + Chart.js rendering.
 * Depends on: SupplierPage, ReceivingRepository, Chart.js (global `Chart`).
 */

window.SupplierCharts = (function () {
  const P = SupplierPage;

  async function initYearSelector() {
    try {
      // Year options need to span every record in the system (not just the active
      // supplier). This is cached and read once per page session (see
      // ReceivingRepository.getDistinctYears), not re-read on every tab switch.
      const years = new Set(await ReceivingRepository.getDistinctYears());
      years.add(new Date().getFullYear());

      P.chartYearSelect.innerHTML = '';
      Array.from(years).sort((a, b) => b - a).forEach(yr => {
        const opt = document.createElement('option');
        opt.value = yr;
        opt.textContent = yr;
        P.chartYearSelect.appendChild(opt);
      });

      P.chartYearSelect.addEventListener('change', async () => {
        await render();
      });

      P.chartMonthSelect.addEventListener('change', async () => {
        await render();
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function render() {
    if (!P.activeSupplierId || !P.chartYearSelect.value) return;
    if (P.supplierDetailSpinner) P.supplierDetailSpinner.classList.add('active');
    try {
      const selectedYear = Number(P.chartYearSelect.value);
      const selectedMonth = P.chartMonthSelect.value; // 'all' or '0'-'11'

      // Scoped Firestore query (where supplierId == X), cached and shared with
      // the History tab - switching tabs for the same supplier reuses this read.
      const records = await ReceivingRepository.getBySupplier(P.activeSupplierId);

      let labels = [];
      let incomingData = [];
      let returnedData = [];

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      if (selectedMonth === 'all') {
        labels = monthNames;
        incomingData = Array(12).fill(0);
        returnedData = Array(12).fill(0);

        records.forEach(rec => {
          const d = new Date(rec.date);
          if (d.getFullYear() === selectedYear) {
            const m = d.getMonth();
            incomingData[m] += rec.quantity;
            returnedData[m] += rec.returnedQuantity;
          }
        });
      } else {
        const monthIdx = Number(selectedMonth);
        const daysInMonth = new Date(selectedYear, monthIdx + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
          labels.push(d.toString());
        }

        incomingData = Array(daysInMonth).fill(0);
        returnedData = Array(daysInMonth).fill(0);

        records.forEach(rec => {
          const d = new Date(rec.date);
          if (d.getFullYear() === selectedYear && d.getMonth() === monthIdx) {
            const day = d.getDate();
            incomingData[day - 1] += rec.quantity;
            returnedData[day - 1] += rec.returnedQuantity;
          }
        });
      }

      const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      const textColor = isDark ? '#94a3b8' : '#64748b';
      const gridColor = isDark ? '#334155' : '#e2e8f0';

      const ctxIncoming = document.getElementById('incomingChart').getContext('2d');
      const ctxReturned = document.getElementById('returnedChart').getContext('2d');

      if (P.incomingChart) P.incomingChart.destroy();
      if (P.returnedChart) P.returnedChart.destroy();

      P.incomingChart = new Chart(ctxIncoming, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Total Incoming Parts',
            data: incomingData,
            backgroundColor: '#0f172a',
            borderColor: '#0f172a',
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
            y: { grid: { color: gridColor }, ticks: { color: textColor } }
          }
        }
      });

      P.returnedChart = new Chart(ctxReturned, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Returned Parts',
            data: returnedData,
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            borderColor: '#dc3545',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#dc3545'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor }, ticks: { color: textColor } }
          }
        }
      });

      if (isDark) {
        P.incomingChart.data.datasets[0].backgroundColor = '#38bdf8';
        P.incomingChart.data.datasets[0].borderColor = '#38bdf8';
        P.incomingChart.update();
      }
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
        setTimeout(render, 100);
      });
    }
  }

  return { initYearSelector, render, bindEvents };
})();
