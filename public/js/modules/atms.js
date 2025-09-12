export function initAtms({ State, fmtCoord, csvParse, csvExport, waitForLeaflet, save, DB, parseNumber, showToast }) {
  const tbody = document.getElementById('atmTbody');
  const cntEl = document.getElementById('atmCount');
  const qEl = document.getElementById('atmQ');
  let atmMap, atmMarker;

  function render() {
    const q = (qEl.value || '').toLowerCase();
    const arr = State.atms.filter(r => !q || r.codigo.includes(q) || (r.nombre || '').toLowerCase().includes(q));
    cntEl.textContent = arr.length;
    tbody.innerHTML = arr.map(r => `
        <tr data-cod="${r.codigo}"><td>${r.codigo}</td><td>${r.nombre || ''}</td><td class="right">${fmtCoord(r.lat)}</td><td class="right">${fmtCoord(r.lng)}</td></tr>
      `).join('');
    [...tbody.querySelectorAll('tr')].forEach(tr => {
      tr.addEventListener('click', () => {
        const r = State.atms.find(x => x.codigo === tr.dataset.cod);
        if (r && atmMap) {
          atmMarker.setLatLng([r.lat, r.lng]);
          atmMap.flyTo([r.lat, r.lng], 12, { duration: .6 });
        }
      });
    });
  }
  qEl?.addEventListener('input', render);

  document.getElementById('atmImport')?.addEventListener('click', () => document.getElementById('atmImportInput').click());
  document.getElementById('atmImportInput')?.addEventListener('change', (ev) => {
    const f = ev.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = csvParse(e.target.result);
      const idx = {
        codigo: headers.findIndex(h => /codigo/i.test(h)),
        nombre: headers.findIndex(h => /nombre/i.test(h)),
        lat: headers.findIndex(h => /^lat/i.test(h)),
        lng: headers.findIndex(h => /^lng|long/i.test(h))
      };
      const out = rows.map(cells => {
        const lat = parseNumber(cells[idx.lat]); const lng = parseNumber(cells[idx.lng]);
        return { codigo: (cells[idx.codigo] || '').trim().padStart(5, '0'), nombre: (cells[idx.nombre] || '').trim(), lat, lng };
      }).filter(r => r.codigo && r.nombre && isFinite(r.lat) && isFinite(r.lng));
      if (out.length) { State.atms = out; save(DB.atms, State.atms); render(); showToast('ATMs importados'); }
    };
    reader.readAsText(f);
    ev.target.value = '';
  });
  document.getElementById('atmExport')?.addEventListener('click', () => csvExport(State.atms, ['codigo', 'nombre', 'lat', 'lng']));

  waitForLeaflet().then(() => {
    const sk = document.getElementById('atmMapSkeleton'); const el = document.getElementById('atmMap'); if (!el) return;
    sk.classList.add('hidden'); el.classList.remove('hidden');
    atmMap = L.map('atmMap', { zoomControl: true, minZoom: 3 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(atmMap);
    atmMarker = L.marker([State.atms[0]?.lat || -34.60, State.atms[0]?.lng || -58.38]).addTo(atmMap);
    atmMap.setView([State.atms[0]?.lat || -34.60, State.atms[0]?.lng || -58.38], 10);
  });

  document.getElementById('atmNew')?.addEventListener('click', () => {
    const cod = String(Math.max(0, ...State.atms.map(r => +r.codigo || 0)) + 1).padStart(5, '0');
    State.atms.push({ codigo: cod, nombre: 'Nuevo', lat: -34.6, lng: -58.38 });
    save(DB.atms, State.atms); render();
  });
  document.getElementById('atmLocate')?.addEventListener('click', () => {
    if (!navigator.geolocation) return showToast('Sin geolocalización');
    navigator.geolocation.getCurrentPosition(pos => {
      atmMap && atmMap.flyTo([pos.coords.latitude, pos.coords.longitude], 12, { duration: .8 });
    });
  });

  render();
}
