import { showToast } from '../ui/ui.js';

export function initSucursales({ State, fmtCoord, csvParse, csvExport, waitForLeaflet, save, DB, parseNumber }) {
  const tbody = document.getElementById('sucTbody');
  const cntEl = document.getElementById('sucCount');
  const qEl = document.getElementById('sucQ');
  let sucMap, sucMarker;

  function render() {
    const q = (qEl.value || '').toLowerCase();
    const arr = State.suc.filter(r => !q || r.codigo.includes(q) || (r.nombre || '').toLowerCase().includes(q));
    cntEl.textContent = arr.length;
    tbody.innerHTML = arr.map(r => `
        <tr data-cod="${r.codigo}">
          <td>${r.codigo}</td><td>${r.nombre || ''}</td><td class="right">${fmtCoord(r.lat)}</td><td class="right">${fmtCoord(r.lng)}</td><td>${r.cochera ? 'Sí' : 'No'}</td>
        </tr>
      `).join('');
    [...tbody.querySelectorAll('tr')].forEach(tr => {
      tr.addEventListener('click', () => {
        const cod = tr.dataset.cod;
        const r = State.suc.find(x => x.codigo === cod);
        if (r && sucMap) {
          sucMarker.setLatLng([r.lat, r.lng]);
          sucMap.flyTo([r.lat, r.lng], 12, { duration: .6 });
        }
      });
    });
  }
  qEl?.addEventListener('input', render);

  document.getElementById('sucImport')?.addEventListener('click', () => document.getElementById('sucImportInput').click());
  document.getElementById('sucImportInput')?.addEventListener('change', (ev) => {
    const f = ev.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = csvParse(e.target.result);
      const idx = {
        codigo: headers.findIndex(h => /codigo/i.test(h)),
        nombre: headers.findIndex(h => /nombre/i.test(h)),
        lat: headers.findIndex(h => /^lat/i.test(h)),
        lng: headers.findIndex(h => /^lng|long/i.test(h)),
        cochera: headers.findIndex(h => /cochera/i.test(h))
      };
      const out = rows.map(cells => {
        const lat = parseNumber(cells[idx.lat]); const lng = parseNumber(cells[idx.lng]);
        return { codigo: (cells[idx.codigo] || '').trim(), nombre: (cells[idx.nombre] || '').trim(), lat, lng, cochera: String(cells[idx.cochera] || '').toLowerCase().startsWith('s') };
      }).filter(r => r.codigo && r.nombre && isFinite(r.lat) && isFinite(r.lng));
      if (out.length) { State.suc = out; save(DB.suc, State.suc); render(); showToast('Sucursales importadas'); }
    };
    reader.readAsText(f);
    ev.target.value = '';
  });
  document.getElementById('sucExport')?.addEventListener('click', () => {
    csvExport(State.suc, ['codigo', 'nombre', 'lat', 'lng', 'cochera']);
  });

  waitForLeaflet().then(() => {
    const sk = document.getElementById('sucMapSkeleton'); const el = document.getElementById('sucMap'); if (!el) return;
    sk.classList.add('hidden'); el.classList.remove('hidden');
    sucMap = L.map('sucMap', { zoomControl: true, minZoom: 3 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(sucMap);
    sucMarker = L.marker([State.suc[0]?.lat || -34.60, State.suc[0]?.lng || -58.38]).addTo(sucMap);
    sucMap.setView([State.suc[0]?.lat || -34.60, State.suc[0]?.lng || -58.38], 10);
  });

  document.getElementById('sucNew')?.addEventListener('click', () => {
    const cod = String(Math.max(0, ...State.suc.map(r => +r.codigo || 0)) + 1).padStart(5, '0');
    State.suc.push({ codigo: cod, nombre: 'Nueva', lat: -34.6, lng: -58.38, cochera: false });
    save(DB.suc, State.suc); render();
  });
  document.getElementById('sucLocate')?.addEventListener('click', () => {
    if (!navigator.geolocation) return showToast('Sin geolocalización');
    navigator.geolocation.getCurrentPosition(pos => {
      sucMap && sucMap.flyTo([pos.coords.latitude, pos.coords.longitude], 12, { duration: .8 });
    });
  });

  render();
}
