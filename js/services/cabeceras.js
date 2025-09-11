import { showToast } from '../ui/ui.js';

export function initCabeceras({ State, csvParse, csvExport, save, DB }) {
  const tbody = document.getElementById('cabTbody');
  const cntEl = document.getElementById('cabCount');
  const qEl = document.getElementById('cabQ');

  function render() {
    const q = (qEl.value || '').toLowerCase();
    const arr = State.cab.filter(r => !q || Object.values(r).some(v => ('' + v).toLowerCase().includes(q)));
    cntEl.textContent = arr.length;
    tbody.innerHTML = arr.map(r => `
        <tr><td>${r.codigo}</td><td>${r.nombre || ''}</td><td>${r.direccion || ''}</td><td>${r.localidad || ''}</td><td>${r.supervisor || ''}</td><td>${r.telefono || ''}</td></tr>
      `).join('');
  }
  qEl?.addEventListener('input', render);

  document.getElementById('cabImport')?.addEventListener('click', () => document.getElementById('cabImportInput').click());
  document.getElementById('cabImportInput')?.addEventListener('change', (ev) => {
    const f = ev.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = csvParse(e.target.result);
      const idx = {
        codigo: headers.findIndex(h => /codigo/i.test(h)),
        nombre: headers.findIndex(h => /nombre/i.test(h)),
        direccion: headers.findIndex(h => /direccion/i.test(h)),
        localidad: headers.findIndex(h => /localidad/i.test(h)),
        supervisor: headers.findIndex(h => /supervisor/i.test(h)),
        telefono: headers.findIndex(h => /telefono/i.test(h))
      };
      const out = rows.map(cells => ({
        codigo: (cells[idx.codigo] || '').trim(), nombre: (cells[idx.nombre] || '').trim(), direccion: (cells[idx.direccion] || '').trim(),
        localidad: (cells[idx.localidad] || '').trim(), supervisor: (cells[idx.supervisor] || '').trim(), telefono: (cells[idx.telefono] || '').trim()
      })).filter(r => r.codigo && r.nombre);
      if (out.length) { State.cab = out; save(DB.cab, State.cab); render(); showToast('Cabeceras importadas'); }
    };
    reader.readAsText(f);
    ev.target.value = '';
  });
  document.getElementById('cabExport')?.addEventListener('click', () => csvExport(State.cab, ['codigo', 'nombre', 'direccion', 'localidad', 'supervisor', 'telefono']));

  document.getElementById('cabNew')?.addEventListener('click', () => {
    const cod = String(Math.max(0, ...State.cab.map(r => parseInt(r.codigo) || 0)) + 1).padStart(4, '0');
    State.cab.push({ codigo: cod, nombre: 'Nueva', direccion: '—', localidad: '—', supervisor: '—', telefono: '—' });
    save(DB.cab, State.cab); render();
  });

  render();

  const selOrigen = document.getElementById('selOrigen');
  if (selOrigen) {
    selOrigen.innerHTML = '<option value="">—</option>' + State.cab.map(c => `<option value="${c.codigo}">${c.codigo} — ${c.nombre}</option>`).join('');
  }
}
