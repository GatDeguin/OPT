(async function(){
  const emptyMetrics = {
    rutas: 0,
    km: 0,
    costo: 0,
    sla: 0,
    utilizacion: 0,
    topRutas: []
  };

  const API_BASE_URL = window.API_BASE_URL || window.location.origin || 'http://localhost:3000';

  async function fetchMetrics(){
    try {
      const res = await fetch(`${API_BASE_URL}/metrics`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch(err) {
      console.error('No se pudo obtener métricas', err);
      return { ...emptyMetrics };
    }
  }

  function renderTopRoutesChart(top){
    const ctx = document.getElementById('topRoutesChart');
    if(!ctx) return;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(r => r.descripcion || `Ruta ${r.id}`),
        datasets: [{
          label: 'Km',
          data: top.map(r => r.km),
          backgroundColor: '#43a46d'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function download(data, name, type){
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCSV(metrics){
    const rows = [
      ['km','costo','sla','utilizacion'],
      [metrics.km, metrics.costo, metrics.sla, metrics.utilizacion],
      [],
      ['ruta','km','costo']
    ];
    metrics.topRutas.forEach(r => rows.push([r.descripcion || `Ruta ${r.id}`, r.km, r.costo]));
    const csv = rows.map(r => r.join(',')).join('\n');
    download(csv, 'dashboard.csv', 'text/csv');
  }

  function exportXLSX(metrics){
    const rows = [
      ['km','costo','sla','utilizacion'],
      [metrics.km, metrics.costo, metrics.sla, metrics.utilizacion],
      [],
      ['ruta','km','costo']
    ];
    metrics.topRutas.forEach(r => rows.push([r.descripcion || `Ruta ${r.id}`, r.km, r.costo]));
    const csv = rows.map(r => r.join(',')).join('\n');
    download(csv, 'dashboard.xls', 'application/vnd.ms-excel');
  }

  const metrics = await fetchMetrics();
  const statRoutesEl = document.getElementById('statRoutes');
  if (statRoutesEl) statRoutesEl.textContent = metrics.rutas;
  const statKmEl = document.getElementById('statKm');
  if (statKmEl) statKmEl.textContent = metrics.km.toFixed(1);
  const statCostEl = document.getElementById('statCost');
  if (statCostEl) statCostEl.textContent = metrics.costo.toFixed(2);
  const statSlaEl = document.getElementById('statSla');
  if (statSlaEl) statSlaEl.textContent = (metrics.sla * 100).toFixed(1) + '%';
  const statUtilEl = document.getElementById('statUtil');
  if (statUtilEl) statUtilEl.textContent = metrics.utilizacion.toFixed(2);

  renderTopRoutesChart(metrics.topRutas);

  document.getElementById('dashExportCSV')?.addEventListener('click', ()=> exportCSV(metrics));
  document.getElementById('dashExportXLSX')?.addEventListener('click', ()=> exportXLSX(metrics));
})();
