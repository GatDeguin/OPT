import { initUI, showToast } from './ui/ui.js';
import { initSucursales } from './services/sucursales.js';
import { initCabeceras } from './services/cabeceras.js';
import { calcRouteStats } from './services/route-utils.mjs';
import { computeFallback, fetchBackendRoutes } from './vrp-fallback/index.js';

let bar, pie, line, lineCtx;

(function(){

  function applyChartTheme(){
    const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const text = cssVar('--chart-text') || '#6b7a8c';
    const grid = cssVar('--chart-grid') || '#ebeff3';

    Chart.defaults.color = text;
    if(bar){
      bar.options.scales.x.ticks.color = text;
      bar.options.scales.y.ticks.color = text;
      bar.options.scales.y.grid.color = grid;
      bar.options.scales.y.grid.borderColor = grid;
      bar.data.datasets[0].backgroundColor = cssVar('--chart-accent') || 'rgba(67,164,109,.85)';
      bar.data.datasets[0].hoverBackgroundColor = cssVar('--chart-accent') || 'rgba(67,164,109,1)';
      bar.update();
    }
    if(pie){
      const bg1 = cssVar('--chart-accent-2') || '#3b9562';
      const bg2 = cssVar('--brand-200') || '#c8ecd7';
      pie.data.datasets[0].backgroundColor = [bg1, bg2];
      pie.update();
    }
    if(line){
      const ctx = lineCtx.getContext('2d');
      const grad = ctx.createLinearGradient(0,0,0,160);
      grad.addColorStop(0, cssVar('--chart-accent-soft') || 'rgba(67,164,109,.18)');
      grad.addColorStop(1,'rgba(0,0,0,0)');

      line.options.scales.x.ticks.color = text;
      line.options.scales.y.ticks.color = text;
      line.options.scales.y.grid.color = grid;
      line.options.scales.y.grid.borderColor = grid;
      line.data.datasets[0].borderColor = cssVar('--chart-accent-2') || '#3b9562';
      line.data.datasets[0].backgroundColor = grad;
      line.data.datasets[0].pointBorderColor = cssVar('--chart-accent-2') || '#3b9562';
      line.data.datasets[1].borderColor = '#113322';
      line.data.datasets[1].pointBorderColor = '#113322';
      line.update();
    }
  }

  /* =====================================================================
     UTILIDADES / ESTADO GLOBAL
  ===================================================================== */
  const fmtES = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
  const fmtMoney = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits:0 }).format(n||0);

  initUI(applyChartTheme);

  /* =====================================================================
     AUTH + SPLASH
  ===================================================================== */
  (function(){
    const AUTH_KEY = 'bp-auth';
    const MAX_AGE = 1000 * 60 * 60 * 8; // 8 horas
    const USERS = {
      "1001@oper": { pwd:"oper123", name:"Operador", role:"oper" },
      "2001@super": { pwd:"super123", name:"Supervisor", role:"super" },
      "admin@tesoro": { pwd:"admin123", name:"Administrador", role:"admin" }
    };
    const appRoot   = document.getElementById('appRoot');
    const loginView = document.getElementById('loginView');
    const loginForm = document.getElementById('loginForm');
    const userEl    = document.getElementById('usuario');
    const passEl    = document.getElementById('password');
    const err       = document.getElementById('loginError');
    const remember  = document.getElementById('remember');
    const userChip  = document.getElementById('userChip');
    const logoutBtn = document.getElementById('logoutBtn');
    const splash    = document.getElementById('splash');

    function getSession(){ try{ return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; }catch(e){ return null; } }
    function setSession(s){
      try {
        localStorage.setItem(AUTH_KEY, JSON.stringify(s));
      } catch (e) {
        // Fallback when storage is unavailable (e.g. private mode)
      }
    }
    function clearSession(){
      try {
        localStorage.removeItem(AUTH_KEY);
      } catch (e) {
        // ignore
      }
    }

    function isSessionValid(s){
      if(!s || !s.user) return false;
      const age = Date.now() - (s.ts||0);
      if(s.remember) return true;
      return age < MAX_AGE;
    }

    function showApp(){
      loginView.classList.add('hidden');
      appRoot.classList.remove('hidden');
      appRoot.removeAttribute('aria-hidden');
      const s = getSession();
      if(userChip && s){ userChip.textContent = s.name || s.user; userChip.classList.remove('hidden'); }
      // splash al ingresar
      splash.classList.add('is-open');
      // Leaflet sizing
      setTimeout(()=>{ try{ if(window.routeMap) routeMap.invalidateSize(); }catch(e){} }, 200);
      setTimeout(()=>{ splash.classList.remove('is-open'); splash.setAttribute('aria-hidden','true'); }, 2400);
    }

    function showLogin(){
      appRoot.classList.add('hidden'); appRoot.setAttribute('aria-hidden','true');
      loginView.classList.remove('hidden');
      if(err) err.textContent = '';
      userEl && userEl.focus();
    }

    function tryAuto(){ const s = getSession(); if(isSessionValid(s)) showApp(); else showLogin(); }

    loginForm?.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      if(!userEl.value || !passEl.value){ err.textContent = 'Completá usuario y contraseña'; return; }
      const u = (userEl.value||'').trim().toLowerCase();
      const p = passEl.value.trim();
      const ok = !!u && !!p && ((USERS[u] && USERS[u].pwd===p) || (!USERS[u] && p==='bapro')); // fallback demo
      if(ok){
        const profile = USERS[u] || {name: u, role: 'invitado'};
        setSession({ user:u, name:profile.name, role:profile.role, ts:Date.now(), remember: !!remember?.checked });
        passEl.value = ''; showApp();
      }else{
        err.textContent = 'Usuario o contraseña inválidos';
      }
    });

    logoutBtn?.addEventListener('click', ()=>{ clearSession(); showToast('Sesión cerrada'); showLogin(); });

    tryAuto();
  })();

  /* =====================================================================
     CHARTS DASHBOARD (ligeros)
  ===================================================================== */
  (function(){
    function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
    const barCtx = document.getElementById('montosChart');
    if(barCtx){
      const bar = new Chart(barCtx, {
        type: 'bar',
        data: { labels: ['mar. 9','mar. 10','mar. 12','mar. 12','mar. 14'],
          datasets: [{ label: 'Montos (M)', data: [4.4,3.5,2.6,1.9,1.4], backgroundColor: cssVar('--chart-accent')||'rgba(67,164,109,.85)', borderRadius: 6, borderSkipped: false, maxBarThickness: 46 }]},
        options: { animation:{duration:700}, plugins:{ legend:{display:false} },
          scales:{ x:{ grid:{display:false} }, y:{ grid:{color:cssVar('--chart-grid')}, suggestedMax:5 } }
        }
      });
    }
    const pieCtx = document.getElementById('entregasChart');
    if(pieCtx){
      new Chart(pieCtx, { type:'doughnut', data:{ labels:['Sucursales','ATMs'],
        datasets:[{ data:[68.7,31.3], backgroundColor:[cssVar('--chart-accent-2')||'#3b9562', cssVar('--brand-200')||'#c8ecd7'], borderColor:['#eaf7ef','#f3faf6'], borderWidth:2 }]},
        options:{ cutout:'62%', rotation:-40, plugins:{ legend:{display:false} } } });
    }
    const lineCtx = document.getElementById('fallidasChart');
    if(lineCtx){
      const grad = lineCtx.getContext('2d').createLinearGradient(0,0,0,160); grad.addColorStop(0, 'rgba(67,164,109,.18)'); grad.addColorStop(1,'rgba(67,164,109,0)');
      new Chart(lineCtx, { type:'line',
        data:{ labels:['abr. 2','abr. 4','abr. 6','abr. 7','abr. 8','abr. 10','abr. 4','abr. 10','abr. 10'],
               datasets:[{ data:[2,3,7,6,3,5,4,6,3], borderColor: cssVar('--chart-accent-2')||'#3b9562', backgroundColor: grad, tension:.35, fill:true, pointRadius:3, pointBackgroundColor:'#fff', pointBorderWidth:2 }]},
        options:{ plugins:{ legend:{display:false} }, scales:{ x:{grid:{display:false}}, y:{grid:{color:cssVar('--chart-grid')}, suggestedMax:10} } }
      });
    }
  })();

  /* =====================================================================
     HELPERS CSV + GEO + LEAFLET
  ===================================================================== */
  function parseNumber(x){
    if(typeof x === 'number') return x;
    if(!x) return NaN;
    let s = String(x).trim();
    if(s.includes(',')) s = s.replace(/\./g,'').replace(',', '.');
    s = s.replace(/[^0-9\.\-]/g, '');
    return parseFloat(s);
  }
  function haversine(lat1, lon1, lat2, lon2){
    const R = 6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); // km
  }
  function waitForLeaflet(){
    return new Promise(res=>{
      (function check(){ if(window.L && typeof L.map==='function') res(); else setTimeout(check, 40); })();
    });
  }
  function clamp(i, min, max){ return Math.max(min, Math.min(max, i)); }
  function uuid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function fmtCoord(n){ return Number(n).toFixed(4); }

  /* =====================================================================
     BASES DE DATOS (localStorage) y Seeds
  ===================================================================== */
  const DB = {
    atms: 'db-atms-v3',
    suc:  'db-suc-v3',
    cab:  'db-cab-v3',
    otros:'db-otros-v1',
    cho:  'db-cho-v1',
    cam:  'db-cam-v1',
    ord:  'db-ord-v2',
    hist: 'db-routes-history-v3',
    cfg:  'db-config-v3'
  };
  function load(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch(e){ return fallback; } }
  function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  const seedATMs = [
    {codigo:"50007", nombre:"América",     lat:-35.426, lng:-61.306},
    {codigo:"50009", nombre:"Ayacucho",    lat:-37.149, lng:-57.139},
    {codigo:"50010", nombre:"Bahía Blanca",lat:-38.715, lng:-62.268},
    {codigo:"50012", nombre:"Bragado",     lat:-35.119, lng:-60.494}
  ];
  const seedSuc = [
    {codigo:"10001", nombre:"Bahía Blanca - Centro", lat:-38.718, lng:-62.268, cochera:false},
    {codigo:"10002", nombre:"La Plata - Catedral",   lat:-34.921, lng:-57.954, cochera:true},
    {codigo:"10003", nombre:"Mar del Plata",         lat:-38.002, lng:-57.556, cochera:false}
  ];
  const seedCab = [
    {codigo:"0106", nombre:"Quilmes", direccion:"Av. Calchaquí", localidad:"Quilmes", supervisor:"M. Ruiz", telefono:"11-23456"},
    {codigo:"0101", nombre:"La Plata", direccion:"Av. 7 925", localidad:"La Plata", supervisor:"J. Pérez", telefono:"11-12348"}
  ];
  const seedOtros = [
    {codigo:"BCRA01", nombre:"BCRA", lat:-34.6037, lng:-58.3816, direccion:"Reconquista 266"},
    {codigo:"OTRO01", nombre:"Otro Banco X", lat:-34.6, lng:-58.44, direccion:"Av. Siempre Viva 123"}
  ];
  const seedCho = [
    {legajo:"C001", nombre:"Juan Pérez", licencia:"C1", vto:"2026-06-30", tel:"11-1234-5678"},
    {legajo:"C002", nombre:"María López", licencia:"C2", vto:"2025-11-15", tel:"11-2345-6789"}
  ];
  const seedCam = [
    {id:"TRK101", modelo:"Iveco Daily", capMonto:200000000, capKg:1500, velMax:60},
    {id:"TRK102", modelo:"Mercedes Sprinter", capMonto:250000000, capKg:1700, velMax:65}
  ];
  const seedOrd = [
    {id:uuid(), fecha:"2025-08-22", categoria:"ATM", codigo:"50010", nombre:"Bahía Blanca", lat:-38.715, lng:-62.268, monto:-30000000, moneda:"ARS", denominacion:"$1000", servicio:"Abastecimiento", peso:20, usar:false},
    {id:uuid(), fecha:"2025-08-22", categoria:"Sucursal", codigo:"10003", nombre:"Mar del Plata", lat:-38.002, lng:-57.556, monto:45000000, moneda:"ARS", denominacion:"Mixta", servicio:"Retiro", peso:30, usar:false}
  ];

  // CONFIG por defecto
  const cfg = Object.assign({
    maxMonto: 200000000, // $
    maxMin:   480,       // minutos
    vel:      40,        // km/h
    stopSuc:  5,         // min
    stopATM:  15,        // min
    stopCab:  10,        // min
    stopExt:  20,        // min
    uiFont:   1,
    uiRadius: 14,
    uiAccent: '#43a46d',
    trafficFactor: 1.0
  }, load(DB.cfg, {}));
  applyUIConfig();

  function applyUIConfig(){
    document.documentElement.style.setProperty('--ui-fontscale', String(cfg.uiFont||1));
    document.documentElement.style.setProperty('--ui-radius', (cfg.uiRadius||14)+'px');
    document.documentElement.style.setProperty('--ui-accent', cfg.uiAccent||'#43a46d');
  }

  /* =====================================================================
     CSV IMPORT/EXPORT HELPERS
  ===================================================================== */
  function csvParse(text, sepGuess=','){
    const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
    if(!lines.length) return { headers:[], rows:[] };
    const sep = (lines[0].includes(';') && !lines[0].includes(',')) ? ';' : sepGuess;
    const headers = lines[0].split(sep).map(h=>h.trim());
    const rows = [];
    for(let i=1;i<lines.length;i++){
      const row = []; let cur='', inQ=false;
      const s = lines[i];
      for(let j=0;j<s.length;j++){
        const ch = s[j];
        if(ch==='\"'){ inQ = !inQ; continue; }
        if(ch===sep && !inQ){ row.push(cur); cur=''; } else cur+=ch;
      }
      row.push(cur);
      rows.push(row);
    }
    return { headers, rows };
  }
  function csvExport(arr, headers){
    const hdr = headers;
    const csv = [hdr.join(',')].concat(arr.map(o => hdr.map(h => {
      const v = (o[h]===undefined || o[h]===null) ? '' : String(o[h]);
      const needs = /[,"\n]/.test(v);
      return needs ? ('"'+v.replace(/"/g,'""')+'"') : v;
    }).join(','))).join('\n');
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href:url, download:"export.csv" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  /* =====================================================================
     MÓDULO DATOS ENTIDADES (ATMs, Suc, Cab, Otros, Choferes, Camiones)
  ===================================================================== */
  const State = {
    atms: load(DB.atms, seedATMs),
    suc: load(DB.suc, seedSuc),
    cab: load(DB.cab, seedCab),
    otros: load(DB.otros, seedOtros),
    cho: load(DB.cho, seedCho),
    cam: load(DB.cam, seedCam),
    ord: load(DB.ord, seedOrd),
    hist: load(DB.hist, [])
  };

  initSucursales({ State, fmtCoord, csvParse, csvExport, waitForLeaflet, save, DB, parseNumber });

  // ========= ATMs =========
  (function(){
    const tbody = document.getElementById('atmTbody');
    const cntEl = document.getElementById('atmCount');
    const qEl = document.getElementById('atmQ');
    let atmMap, atmMarker;

    function render(){
      const q = (qEl.value||'').toLowerCase();
      const arr = State.atms.filter(r=> !q || r.codigo.includes(q) || (r.nombre||'').toLowerCase().includes(q));
      cntEl.textContent = arr.length;
      tbody.innerHTML = arr.map(r => `
        <tr data-cod="${r.codigo}"><td>${r.codigo}</td><td>${r.nombre||''}</td><td class="right">${fmtCoord(r.lat)}</td><td class="right">${fmtCoord(r.lng)}</td></tr>
      `).join('');
      [...tbody.querySelectorAll('tr')].forEach(tr=>{
        tr.addEventListener('click', ()=>{
          const r = State.atms.find(x=>x.codigo===tr.dataset.cod);
          if(r && atmMap){ atmMarker.setLatLng([r.lat,r.lng]); atmMap.flyTo([r.lat,r.lng], 12, {duration:.6}); }
        });
      });
    }
    qEl?.addEventListener('input', render);

    document.getElementById('atmImport')?.addEventListener('click', ()=> document.getElementById('atmImportInput').click());
    document.getElementById('atmImportInput')?.addEventListener('change', (ev)=>{
      const f = ev.target.files?.[0]; if(!f) return;
      const reader = new FileReader();
      reader.onload = (e)=>{
        const {headers, rows} = csvParse(e.target.result);
        const idx = {
          codigo: headers.findIndex(h=>/codigo/i.test(h)),
          nombre: headers.findIndex(h=>/nombre/i.test(h)),
          lat: headers.findIndex(h=>/^lat/i.test(h)),
          lng: headers.findIndex(h=>/^lng|long/i.test(h))
        };
        const out = rows.map(cells => {
          const lat = parseNumber(cells[idx.lat]); const lng = parseNumber(cells[idx.lng]);
          return { codigo: (cells[idx.codigo]||'').trim().padStart(5,'0'), nombre:(cells[idx.nombre]||'').trim(), lat, lng };
        }).filter(r=>r.codigo && r.nombre && isFinite(r.lat) && isFinite(r.lng));
        if(out.length){ State.atms = out; save(DB.atms, State.atms); render(); showToast('ATMs importados'); }
      };
      reader.readAsText(f);
      ev.target.value='';
    });
    document.getElementById('atmExport')?.addEventListener('click', ()=> csvExport(State.atms, ['codigo','nombre','lat','lng']));

    waitForLeaflet().then(()=>{
      const sk = document.getElementById('atmMapSkeleton'); const el = document.getElementById('atmMap'); if(!el) return;
      sk.classList.add('hidden'); el.classList.remove('hidden');
      atmMap = L.map('atmMap', { zoomControl:true, minZoom:3 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; OpenStreetMap'}).addTo(atmMap);
      atmMarker = L.marker([State.atms[0]?.lat||-34.60, State.atms[0]?.lng||-58.38]).addTo(atmMap);
      atmMap.setView([State.atms[0]?.lat||-34.60, State.atms[0]?.lng||-58.38], 10);
    });

    document.getElementById('atmNew')?.addEventListener('click', ()=>{
      const cod = String(Math.max(0,...State.atms.map(r=>+r.codigo||0))+1).padStart(5,'0');
      State.atms.push({codigo:cod, nombre:'Nuevo', lat:-34.6, lng:-58.38});
      save(DB.atms, State.atms); render();
    });
    document.getElementById('atmLocate')?.addEventListener('click', ()=>{
      if(!navigator.geolocation) return showToast('Sin geolocalización');
      navigator.geolocation.getCurrentPosition(pos=>{
        atmMap && atmMap.flyTo([pos.coords.latitude, pos.coords.longitude], 12, {duration:.8});
      });
    });

    render();
  })();

  initCabeceras({ State, csvParse, csvExport, save, DB });

  // ========= Otros Bancos =========
  (function(){
    const tbody = document.getElementById('otrosTbody'); const cntEl = document.getElementById('otrosCount'); const qEl = document.getElementById('otrosQ');
    function render(){
      const q=(qEl.value||'').toLowerCase();
      const arr = State.otros.filter(r=> !q || (r.codigo||'').toLowerCase().includes(q) || (r.nombre||'').toLowerCase().includes(q));
      cntEl.textContent = arr.length;
      tbody.innerHTML = arr.map(r => `<tr><td>${r.codigo||''}</td><td>${r.nombre||''}</td><td>${fmtCoord(r.lat)}</td><td>${fmtCoord(r.lng)}</td><td>${r.direccion||''}</td></tr>`).join('');
    }
    qEl?.addEventListener('input', render);
    document.getElementById('otrosImport')?.addEventListener('click', ()=> document.getElementById('otrosImportInput').click());
    document.getElementById('otrosImportInput')?.addEventListener('change', (ev)=>{
      const f = ev.target.files?.[0]; if(!f) return;
      const reader = new FileReader();
      reader.onload = (e)=>{
        const {headers, rows} = csvParse(e.target.result);
        const idx = {
          codigo: headers.findIndex(h=>/codigo/i.test(h)),
          nombre: headers.findIndex(h=>/nombre/i.test(h)),
          lat: headers.findIndex(h=>/^lat/i.test(h)),
          lng: headers.findIndex(h=>/^lng|long/i.test(h)),
          direccion: headers.findIndex(h=>/direccion/i.test(h))
        };
        const out = rows.map(cells => {
          const lat = parseNumber(cells[idx.lat]); const lng = parseNumber(cells[idx.lng]);
          return { codigo:(cells[idx.codigo]||'').trim(), nombre:(cells[idx.nombre]||'').trim(), lat, lng, direccion:(cells[idx.direccion]||'').trim() };
        }).filter(r=>r.codigo && isFinite(r.lat) && isFinite(r.lng));
        if(out.length){ State.otros = out; save(DB.otros, State.otros); render(); showToast('Otros bancos importados'); }
      };
      reader.readAsText(f);
      ev.target.value='';
    });
    document.getElementById('otrosExport')?.addEventListener('click', ()=> csvExport(State.otros, ['codigo','nombre','lat','lng','direccion']));
    document.getElementById('otrosNew')?.addEventListener('click', ()=>{
      State.otros.push({codigo:'OTRO'+String(State.otros.length+1).padStart(2,'0'), nombre:'Nuevo', lat:-34.6, lng:-58.38, direccion:'—'});
      save(DB.otros, State.otros); render();
    });
    render();
  })();

  // ========= Choferes =========
  (function(){
    const tbody = document.getElementById('choTbody'); const cntEl = document.getElementById('choCount'); const qEl = document.getElementById('choQ');
    function render(){
      const q=(qEl.value||'').toLowerCase();
      const arr = State.cho.filter(r=> !q || Object.values(r).some(v => String(v).toLowerCase().includes(q)));
      cntEl.textContent = arr.length;
      tbody.innerHTML = arr.map(r => `<tr><td>${r.legajo}</td><td>${r.nombre}</td><td>${r.licencia}</td><td>${r.vto}</td><td>${r.tel||''}</td></tr>`).join('');
    }
    qEl?.addEventListener('input', render);
    document.getElementById('choImport')?.addEventListener('click', ()=> document.getElementById('choImportInput').click());
    document.getElementById('choImportInput')?.addEventListener('change', (ev)=>{
      const f = ev.target.files?.[0]; if(!f) return; const reader = new FileReader();
      reader.onload = (e)=>{
        const {headers, rows} = csvParse(e.target.result);
        const idx = {legajo: headers.indexOf('legajo'), nombre: headers.indexOf('nombre'), licencia: headers.indexOf('licencia'), vto: headers.indexOf('vto'), tel: headers.indexOf('tel')};
        const out = rows.map(c => ({legajo:c[idx.legajo], nombre:c[idx.nombre], licencia:c[idx.licencia], vto:c[idx.vto], tel:c[idx.tel]})).filter(r=>r.legajo && r.nombre);
        if(out.length){ State.cho = out; save(DB.cho, State.cho); render(); showToast('Choferes importados'); }
      };
      reader.readAsText(f); ev.target.value='';
    });
    document.getElementById('choExport')?.addEventListener('click', ()=> csvExport(State.cho, ['legajo','nombre','licencia','vto','tel']));
    document.getElementById('choNew')?.addEventListener('click', ()=>{
      State.cho.push({legajo:'C'+String(State.cho.length+1).padStart(3,'0'), nombre:'Nuevo', licencia:'C1', vto:'2026-01-01', tel:''});
      save(DB.cho, State.cho); render();
    });
    render();
  })();

  // ========= Camiones =========
  (function(){
    const tbody = document.getElementById('camTbody'); const cntEl = document.getElementById('camCount'); const qEl = document.getElementById('camQ');
    function render(){
      const q=(qEl.value||'').toLowerCase();
      const arr = State.cam.filter(r=> !q || Object.values(r).some(v => String(v).toLowerCase().includes(q)));
      cntEl.textContent = arr.length;
      tbody.innerHTML = arr.map(r => `<tr><td>${r.id}</td><td>${r.modelo||''}</td><td class="right">${fmtMoney(r.capMonto||0)}</td><td class="right">${r.capKg||0}</td><td class="right">${r.velMax||0}</td></tr>`).join('');
    }
    qEl?.addEventListener('input', render);
    document.getElementById('camImport')?.addEventListener('click', ()=> document.getElementById('camImportInput').click());
    document.getElementById('camImportInput')?.addEventListener('change', (ev)=>{
      const f = ev.target.files?.[0]; if(!f) return; const reader = new FileReader();
      reader.onload = (e)=>{
        const {headers, rows} = csvParse(e.target.result);
        const idx = {id: headers.indexOf('id'), modelo: headers.indexOf('modelo'), capMonto: headers.indexOf('capMonto'), capKg: headers.indexOf('capKg'), velMax: headers.indexOf('velMax')};
        const out = rows.map(c => ({id:c[idx.id], modelo:c[idx.modelo], capMonto: parseNumber(c[idx.capMonto]), capKg: parseNumber(c[idx.capKg]), velMax: parseNumber(c[idx.velMax])})).filter(r=>r.id);
        if(out.length){ State.cam = out; save(DB.cam, State.cam); render(); showToast('Camiones importados'); }
      };
      reader.readAsText(f); ev.target.value='';
    });
    document.getElementById('camExport')?.addEventListener('click', ()=> csvExport(State.cam, ['id','modelo','capMonto','capKg','velMax']));
    document.getElementById('camNew')?.addEventListener('click', ()=>{
      State.cam.push({id:'TRK'+String(State.cam.length+1).padStart(3,'0'), modelo:'Nuevo', capMonto:200000000, capKg:1500, velMax:60});
      save(DB.cam, State.cam); render();
    });
    render();
  })();

  /* =====================================================================
     ÓRDENES (CRUD + CSV)
  ===================================================================== */
  (function(){
    const tbody = document.getElementById('ordTbody'); const cntEl = document.getElementById('ordCount'); const qEl = document.getElementById('ordQ');
    const sel = (s,sc)=> (sc||document).querySelector(s);
    function render(){
      const q=(qEl.value||'').toLowerCase();
      const arr = State.ord.filter(r=> !q || [r.fecha, r.categoria, r.codigo, r.nombre, r.servicio].some(v => String(v||'').toLowerCase().includes(q)));
      cntEl.textContent = arr.length;
      tbody.innerHTML = arr.map(r => `
        <tr data-id="${r.id}">
          <td>${r.fecha||''}</td><td>${r.categoria||''}</td><td>${(r.codigo||'')+' — '+(r.nombre||'')}</td>
          <td class="right">${fmtMoney(r.monto||0)}</td><td>${r.moneda||'ARS'}</td><td>${r.denominacion||''}</td><td>${r.servicio||''}</td>
          <td class="right">${r.peso||0}</td><td>${r.lat??''}</td><td>${r.lng??''}</td>
          <td><input type="checkbox" ${r.usar?'checked':''} data-act="usar" /></td>
          <td><button class="chip" data-act="edit">Editar</button></td>
          <td><button class="chip" data-act="del">Borrar</button></td>
        </tr>`).join('');
      [...tbody.querySelectorAll('input[data-act="usar"]')].forEach(inp=>{
        inp.addEventListener('change', (ev)=>{
          const id = ev.target.closest('tr').dataset.id;
          const o = State.ord.find(x=>x.id===id); if(o){ o.usar = !!ev.target.checked; save(DB.ord, State.ord); }
        });
      });
      [...tbody.querySelectorAll('button[data-act="edit"]')].forEach(btn=>{
        btn.addEventListener('click', ()=> editRow(btn.closest('tr').dataset.id));
      });
      [...tbody.querySelectorAll('button[data-act="del"]')].forEach(btn=>{
        btn.addEventListener('click', ()=> delRow(btn.closest('tr').dataset.id));
      });
    }
    qEl?.addEventListener('input', render);

    function editRow(id){
      const o = State.ord.find(x=>x.id===id) || {id:uuid(), fecha:'', categoria:'', codigo:'', nombre:'', lat:'', lng:'', monto:0, moneda:'ARS', denominacion:'', servicio:'', peso:0, usar:false};
      const html = `
        <div class="field"><label>Fecha</label><input id="fFecha" type="date" value="${o.fecha||''}"></div>
        <div class="field"><label>Categoría</label><input id="fCat" value="${o.categoria||''}" placeholder="Sucursal/ATM/Cabecera/BCRA/Otro"></div>
        <div class="field"><label>Código</label><input id="fCod" value="${o.codigo||''}"></div>
        <div class="field"><label>Nombre</label><input id="fNom" value="${o.nombre||''}"></div>
        <div class="field"><label>Lat</label><input id="fLat" value="${o.lat??''}"></div>
        <div class="field"><label>Lng</label><input id="fLng" value="${o.lng??''}"></div>
        <div class="field"><label>Monto (negativo=entrega)</label><input id="fMonto" value="${o.monto??0}"></div>
        <div class="field"><label>Moneda</label><input id="fMon" value="${o.moneda||'ARS'}"></div>
        <div class="field"><label>Denominación</label><input id="fDen" value="${o.denominacion||''}"></div>
        <div class="field"><label>Servicio</label><input id="fServ" value="${o.servicio||''}" placeholder="Abastecimiento/Retiro/Transferencia/Descarga"></div>
        <div class="field"><label>Peso (kg)</label><input id="fPeso" value="${o.peso||0}"></div>
      `;
      openSmallModal('Editar orden', html, ()=>{
        Object.assign(o, {
          fecha: sel('#fFecha').value, categoria: sel('#fCat').value, codigo: sel('#fCod').value, nombre: sel('#fNom').value,
          lat: parseNumber(sel('#fLat').value), lng: parseNumber(sel('#fLng').value), monto: parseNumber(sel('#fMonto').value),
          moneda: sel('#fMon').value, denominacion: sel('#fDen').value, servicio: sel('#fServ').value, peso: parseNumber(sel('#fPeso').value)
        });
        if(!State.ord.find(x=>x.id===o.id)) State.ord.push(o);
        save(DB.ord, State.ord); render(); showToast('Orden guardada');
      });
    }
    function delRow(id){
      const i = State.ord.findIndex(x=>x.id===id); if(i<0) return;
      if(confirm('¿Eliminar orden?')){ State.ord.splice(i,1); save(DB.ord, State.ord); render(); }
    }

    // Botones
    document.getElementById('ordNew')?.addEventListener('click', ()=> editRow(null));
    document.getElementById('ordImport')?.addEventListener('click', ()=> document.getElementById('ordImportInput').click());
    document.getElementById('ordImportInput')?.addEventListener('change', (ev)=>{
      const f = ev.target.files?.[0]; if(!f) return; const reader = new FileReader();
      reader.onload = (e)=>{
        const {headers, rows} = csvParse(e.target.result);
        const idx = {
          fecha: headers.findIndex(h=>/fecha/i.test(h)),
          categoria: headers.findIndex(h=>/categoria/i.test(h)),
          codigo: headers.findIndex(h=>/codigo/i.test(h)),
          nombre: headers.findIndex(h=>/nombre/i.test(h)),
          monto: headers.findIndex(h=>/monto/i.test(h)),
          moneda: headers.findIndex(h=>/moneda/i.test(h)),
          denominacion: headers.findIndex(h=>/denominacion/i.test(h)),
          servicio: headers.findIndex(h=>/servicio/i.test(h)),
          peso: headers.findIndex(h=>/peso/i.test(h)),
          lat: headers.findIndex(h=>/^lat/i.test(h)),
          lng: headers.findIndex(h=>/^lng|long/i.test(h))
        };
        const out = rows.map(c => ({
          id: uuid(),
          fecha: c[idx.fecha]||'',
          categoria: c[idx.categoria]||'',
          codigo: c[idx.codigo]||'',
          nombre: c[idx.nombre]||'',
          monto: parseNumber(c[idx.monto]), moneda: c[idx.moneda]||'ARS', denominacion: c[idx.denominacion]||'',
          servicio: c[idx.servicio]||'', peso: parseNumber(c[idx.peso]),
          lat: parseNumber(c[idx.lat]), lng: parseNumber(c[idx.lng]), usar:false
        })).filter(o => o.categoria && isFinite(o.lat) && isFinite(o.lng));
        if(out.length){ State.ord = out; save(DB.ord, State.ord); render(); showToast('Órdenes importadas'); }
      };
      reader.readAsText(f); ev.target.value='';
    });
    document.getElementById('ordExport')?.addEventListener('click', ()=> csvExport(State.ord, ['id','fecha','categoria','codigo','nombre','monto','moneda','denominacion','servicio','peso','lat','lng','usar']));
    document.getElementById('ordTemplate')?.addEventListener('click', ()=>{
      const sample = [
        {fecha:'2025-08-23', categoria:'ATM', codigo:'50010', nombre:'Bahía Blanca', monto:-30000000, moneda:'ARS', denominacion:'$1000', servicio:'Abastecimiento', peso:20, lat:-38.715, lng:-62.268},
        {fecha:'2025-08-23', categoria:'Sucursal', codigo:'10003', nombre:'Mar del Plata', monto:45000000, moneda:'ARS', denominacion:'Mixta', servicio:'Retiro', peso:30, lat:-38.002, lng:-57.556}
      ];
      csvExport(sample, ['fecha','categoria','codigo','nombre','monto','moneda','denominacion','servicio','peso','lat','lng']);
    });

    render();
  })();

  /* =====================================================================
     UI: Modal pequeño reutilizable
  ===================================================================== */
  function openSmallModal(title, innerHTML, onAccept){
    const m = document.createElement('div'); m.className='modal open';
    m.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-h"><div>${title||''}</div><button class="icon-btn small" id="mClose"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
        <div class="sheet-b" id="mBody" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${innerHTML||''}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;padding:0 16px 12px">
          <button class="chip" id="mCancel">Cancelar</button>
          <button class="chip" id="mOk" style="background: linear-gradient(180deg, rgba(47,187,107,.24), rgba(47,187,107,.08)); border-color:rgba(47,187,107,.32)">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    const close = ()=>{ m.remove(); };
    m.addEventListener('click', (e)=>{ if(e.target===m) close(); });
    m.querySelector('#mClose').addEventListener('click', close);
    m.querySelector('#mCancel').addEventListener('click', close);
    m.querySelector('#mOk').addEventListener('click', ()=>{ if(onAccept) onAccept(); close(); });
  }

  /* =====================================================================
     LOADER API (Camioncito)
  ===================================================================== */
  const Loader = (()=>{
    const modal = document.getElementById('loaderModal');
    const scene = document.getElementById('scene');
    const bar = document.getElementById('progressBar');
    const status = document.getElementById('loaderDesc');
    document.getElementById('loaderClose').addEventListener('click', hide);
    function open(msg){
      modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
      bar.style.inlineSize='0%'; status.textContent = msg || 'Optimizando…';
      scene.classList.add('is-running'); auto();
      return { setMessage, setProgress, finish, fail, close: hide };
    }
    function setMessage(t){ status.textContent = t; }
    function setProgress(p){ const v = clamp(p,0,100); bar.style.inlineSize=v+'%'; bar.parentElement.setAttribute('aria-valuenow', v); }
    function finish(t){ setProgress(100); setMessage(t||'Listo ✅'); setTimeout(hide, 500); }
    function fail(t){ setMessage(t||'Ocurrió un error'); }
    function hide(){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); scene.classList.remove('is-running'); }
    function auto(){ let v=0; Loader._int && clearInterval(Loader._int); Loader._int=setInterval(()=>{ v = Math.min(v + (Math.random()*6+2), 95); setProgress(v); if(v>=95) clearInterval(Loader._int); }, 400); }
    return { open };
  })();

  /* =====================================================================
     RUTAS: Integración total
  ===================================================================== */
  const Route = (function(){
    let routeMap, routeMarkers = [], routeLines = [];
    let currentRoute = []; // array de puntos {id, tipo, nombre, lat, lng, monto, servicio, priority}
    let undoStack = [];

    const ptsTbody = document.getElementById('ptsTbody');
    const ptsQ = document.getElementById('ptsQ');
    const ptsCount = document.getElementById('ptsCount');
    const rutaTbody = document.getElementById('rutaTbody');
    const mapSk = document.getElementById('routeMapSkeleton');
    const mapEl = document.getElementById('routeMap');
    const selOrigen = document.getElementById('selOrigen');
    const prioAbast = document.getElementById('prioAbast');
    const prioDescAlta = document.getElementById('prioDescargaAlta');
    const btnOptimizar = document.getElementById('btnOptimizar');
    const optStatus = document.getElementById('optStatus');

    function setOptStatus(msg = '') {
      if (!optStatus) return;
      optStatus.textContent = msg;
      optStatus.classList.toggle('hidden', !msg);
    }

    // render listado de puntos disponibles (suc + atms + otros + cab + órdenes marcadas "usar")
    function buildSourceRows(){
      const ords = State.ord.filter(o=>o.usar);
      const suc = State.suc.map(s=> ({tipo:'Sucursal', codigo:s.codigo, nombre:s.nombre, lat:s.lat, lng:s.lng, monto:0, servicio:'', id:'SUC:'+s.codigo}));
      const atms = State.atms.map(a=> ({tipo:'ATM', codigo:a.codigo, nombre:a.nombre, lat:a.lat, lng:a.lng, monto:0, servicio:'', id:'ATM:'+a.codigo}));
      const cab = State.cab.map(c=> ({tipo:'Cabecera', codigo:c.codigo, nombre:c.nombre, lat: parseNumber(c.lat)||null, lng: parseNumber(c.lng)||null, monto:0, servicio:'', id:'CAB:'+c.codigo})).filter(x=> isFinite(x.lat) && isFinite(x.lng));
      const otros = State.otros.map(o=> ({tipo:'Otros', codigo:o.codigo, nombre:o.nombre, lat:o.lat, lng:o.lng, monto:0, servicio:'', id:'OTR:'+o.codigo}));
      const ordMapped = ords.map(o=> ({tipo:o.categoria, codigo:o.codigo, nombre:o.nombre, lat:o.lat, lng:o.lng, monto:o.monto, servicio:o.servicio, id:o.id}));
      return [...ordMapped, ...suc, ...atms, ...otros]; // cabeceras no se mezclan aquí (van como origen)
    }

    function renderPts(){
      const arr = buildSourceRows();
      const q = (ptsQ.value||'').toLowerCase();
      const filtered = arr.filter(r=> !q || (r.codigo||'').toLowerCase().includes(q) || (r.nombre||'').toLowerCase().includes(q) || (r.tipo||'').toLowerCase().includes(q));
      ptsCount.textContent = filtered.length;
      ptsTbody.innerHTML = filtered.map(r => `
        <tr data-id="${r.id}">
          <td>${r.tipo}</td>
          <td>${(r.codigo||'')+' — '+(r.nombre||'')}</td>
          <td class="right">${fmtCoord(r.lat)}</td>
          <td class="right">${fmtCoord(r.lng)}</td>
          <td class="right">${r.monto? fmtMoney(r.monto): ''}</td>
          <td>${r.servicio||''}</td>
          <td><input type="checkbox" data-act="prio"></td>
          <td><button class="chip" data-act="add">Agregar</button></td>
        </tr>
      `).join('');
      [...ptsTbody.querySelectorAll('button[data-act="add"]')].forEach(b=> b.addEventListener('click', ()=>{
        const id = b.closest('tr').dataset.id;
        const src = buildSourceRows().find(x=>x.id===id); if(!src) return;
        addPointToRoute(src, b.closest('tr').querySelector('input[data-act="prio"]')?.checked);
      }));
    }
    ptsQ?.addEventListener('input', renderPts);
    document.getElementById('addFromOrdenes')?.addEventListener('click', ()=>{
      State.ord.filter(o=>o.usar).forEach(o => addPointToRoute({id:o.id, tipo:o.categoria, codigo:o.codigo, nombre:o.nombre, lat:o.lat, lng:o.lng, monto:o.monto, servicio:o.servicio}, false));
    });

    function addPointToRoute(p, priority=false){
      undoStack.push(currentRoute.slice());
      currentRoute.push({ ...p, priority: !!priority });
      draw();
    }
    function removeAt(idx){
      undoStack.push(currentRoute.slice());
      currentRoute.splice(idx,1);
      draw();
    }
    document.getElementById('btnDeshacer')?.addEventListener('click', ()=>{
      const prev = undoStack.pop(); if(prev){ currentRoute = prev; draw(); }
    });
    document.getElementById('btnLimpiarRuta')?.addEventListener('click', ()=>{ undoStack.push(currentRoute.slice()); currentRoute = []; draw(); });

    function stopTimeFor(tipo){
      if(/^suc/i.test(tipo||'')) return cfg.stopSuc||5;
      if(/^atm/i.test(tipo||'')) return cfg.stopATM||15;
      if(/^cab/i.test(tipo||'')) return cfg.stopCab||10;
      return cfg.stopExt||20;
    }

    function draw(){
      // tabla paradas
      rutaTbody.innerHTML = currentRoute.map((r,i)=>`
        <tr><td><span class="order-num">${i+1}</span></td><td>${r.tipo||''}</td><td>${r.nombre||''}</td><td class="right">${r.monto?fmtMoney(r.monto):''}</td><td>${r.servicio||''}${r.priority? ' <span class="priority">★</span>':''}</td><td><button class="chip" data-i="${i}" data-act="rm">Quitar</button></td></tr>
      `).join('');
      [...rutaTbody.querySelectorAll('button[data-act="rm"]')].forEach(b=> b.addEventListener('click', ()=> removeAt(parseInt(b.dataset.i))));

      // mapa
      waitForLeaflet().then(()=>{
        if(!routeMap){
          mapSk.classList.add('hidden'); mapEl.classList.remove('hidden');
          routeMap = L.map('routeMap', { zoomControl:true, minZoom:3 });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; OpenStreetMap'}).addTo(routeMap);
          routeMap.setView([-34.60,-58.38], 9);
        }
        routeMarkers.forEach(m=> m.remove()); routeMarkers=[];
        routeLines.forEach(l=> l.remove()); routeLines=[];
        const origenCodigo = selOrigen.value;
        const origen = State.cab.find(c=>c.codigo===origenCodigo);
        const pts = currentRoute.slice();
        // Dibujar markers (numerados)
        const bounds = [];
        if(origen && isFinite(parseNumber(origen.lat)) && isFinite(parseNumber(origen.lng))){
          const m = L.marker([parseNumber(origen.lat), parseNumber(origen.lng)], { title:'Origen: '+origen.nombre });
          m.addTo(routeMap); routeMarkers.push(m); bounds.push(m.getLatLng());
        }
        pts.forEach((p,i)=>{
          const num = i+1;
          const divIcon = L.divIcon({className:'', html:`<div style="display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#fff;border:2px solid rgba(47,187,107,.8); font:800 12px/1 Inter,sans-serif">${num}</div>`, iconSize:[30,30], iconAnchor:[15,15]});
          const m = L.marker([p.lat, p.lng], {icon:divIcon, title: `${num}. ${p.tipo} — ${p.nombre}`});
          m.addTo(routeMap); routeMarkers.push(m); bounds.push(m.getLatLng());
        });
        if(bounds.length) routeMap.fitBounds(L.latLngBounds(bounds), {padding:[20,20]});

        // Dibujar líneas si ya optimizada/ordenada (tramos alternando colores)
        if(origen && pts.length){
          const coords = [[parseNumber(origen.lat), parseNumber(origen.lng)]].concat(pts.map(p=>[p.lat,p.lng])).concat([[parseNumber(origen.lat), parseNumber(origen.lng)]]);
          for(let i=0;i<coords.length-1;i++){
            const color = (i%2===0? 'var(--route-a)' : 'var(--route-b)');
            const l = L.polyline([coords[i], coords[i+1]], { color, weight:4, opacity:.9 });
            l.addTo(routeMap); routeLines.push(l);
          }
        }
        updateSummary();
      });
    }

    function updateSummary(){
      document.getElementById('sumPuntos').textContent = currentRoute.length;
      document.getElementById('sumCamiones').textContent = document.getElementById('nCamiones').value || 1;
      const origen = State.cab.find(c=>c.codigo===selOrigen.value);
      const stats = calcRouteStats(origen, currentRoute, cfg, {haversine, stopTimeFor, parseNumber});
      document.getElementById('sumMonto').textContent = fmtMoney(stats.maxMonto);
      document.getElementById('sumTiempo').textContent = `${Math.floor(stats.totalMin/60)}:${String(stats.totalMin%60).padStart(2,'0')} h`;
    }

    // ===================== OPTIMIZACIÓN =====================
    async function optimize(){
      btnOptimizar?.setAttribute('disabled', 'disabled');
      setOptStatus('Optimizando…');
      const ctl = Loader.open('Preparando la optimización…');
      try{
        setTimeout(()=> ctl.setMessage('Evaluando restricciones…'), 1000);
        const origen = State.cab.find(c=>c.codigo===selOrigen.value);
        if(!origen){ ctl.fail('Seleccioná una cabecera origen'); setOptStatus(''); return; }

        let pts = currentRoute.map(p=> ({...p}));
        if(pts.length===0){ ctl.fail('Agregá al menos un punto'); setOptStatus(''); return; }
        pts.sort((a,b)=>{
          const pa = (a.priority? -1000:0) + (prioAbast.checked && /^abastec/i.test(a.servicio||'') ? -100 : 0) + (prioDescAlta.checked ? -Math.sign(-(a.monto||0)) * Math.abs(a.monto||0)/1e6 : 0);
          const pb = (b.priority? -1000:0) + (prioAbast.checked && /^abastec/i.test(b.servicio||'') ? -100 : 0) + (prioDescAlta.checked ? -Math.sign(-(b.monto||0)) * Math.abs(b.monto||0)/1e6 : 0);
          if(pa!==pb) return pa-pb;
          const da = haversine(parseNumber(origen.lat), parseNumber(origen.lng), a.lat, a.lng);
          const db = haversine(parseNumber(origen.lat), parseNumber(origen.lng), b.lat, b.lng);
          return da-db;
        });

        try{
          ctl.setMessage('Consultando OR-Tools…');
          const resp = await fetch('/ortools/solve', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ origen, puntos: pts })});
          if(!resp.ok) throw new Error('bad status');
          const data = await resp.json();
          currentRoute = data.route || data.ruta || pts;
          draw();
          ctl.finish('Optimización completada');
          setOptStatus('Listo');
          addRecent();
          return;
        }catch(err){
          console.warn('OR-Tools no disponible, usando fallback', err);
        }

        ctl.setMessage('Servicio OR-Tools no disponible. Ejecutando heurística…');
        showToast('Servicio degradado: usando heurística de rutas');
        let backendPts = pts;
        try{
          const routes = await fetchBackendRoutes();
          if(Array.isArray(routes) && routes[0]?.paradas?.length){
            backendPts = routes[0].paradas.map(p=> ({...p}));
          }
        }catch(e){ console.warn('Fallo al obtener rutas del backend', e); }

        const baseStats = calcRouteStats(origen, backendPts, cfg, {haversine, stopTimeFor, parseNumber});
        const { ordered, stats } = await computeFallback(origen, backendPts, cfg, {haversine, stopTimeFor, parseNumber});
        if(stats.maxMonto > cfg.maxMonto){ ctl.fail('Ruta supera el monto máximo permitido'); setOptStatus(''); return; }
        if(stats.totalMin > cfg.maxMin){ ctl.fail('Ruta excede el tiempo máximo permitido'); setOptStatus(''); return; }
        currentRoute = ordered;
        draw();
        ctl.finish('Optimización heurística completada');
        setOptStatus('Listo');
        addRecent();
        console.log('Fallback comparativo',{original:{costo: baseStats.maxMonto, km: baseStats.distKm}, heuristica:{costo: stats.maxMonto, km: stats.distKm}});
        showToast(`Heurística: costo ${stats.maxMonto.toFixed(2)} vs ${baseStats.maxMonto.toFixed(2)}, km ${stats.distKm.toFixed(2)} vs ${baseStats.distKm.toFixed(2)}`);
      }catch(err){
        console.error('Error durante la optimización', err);
        ctl.fail('Ocurrió un error en la optimización');
        setOptStatus('Error');
        showToast('Error al optimizar la ruta');
      }finally{
        btnOptimizar?.removeAttribute('disabled');
      }
    }

    function tspHeldKarp(nodes, cfg){
      // nodes[0] = origen; nodes[1..N] = puntos
      const n = nodes.length;
      const dist = Array.from({length:n},()=>Array(n).fill(0));
      for(let i=0;i<n;i++) for(let j=0;j<n;j++) if(i!==j){
        dist[i][j] = haversine(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng);
      }
      // Held-Karp DP
      const size = 1<<(n-1); // solo para nodos 1..n-1
      const dp = Array.from({length:size},()=>Array(n).fill(Infinity));
      const parent = Array.from({length:size},()=>Array(n).fill(-1));
      for(let j=1;j<n;j++){ dp[1<<(j-1)][j] = dist[0][j]; }
      for(let mask=1; mask<size; mask++){
        for(let j=1;j<n;j++){
          if(!(mask & (1<<(j-1)))) continue;
          const pmask = mask ^ (1<<(j-1));
          if(pmask===0) continue;
          for(let k=1;k<n;k++){
            if(!(pmask & (1<<(k-1)))) continue;
            const val = dp[pmask][k] + dist[k][j];
            if(val < dp[mask][j]){ dp[mask][j] = val; parent[mask][j] = k; }
          }
        }
      }
      // cerrar ciclo al origen
      let best=Infinity, end=-1; const full= size-1;
      for(let j=1;j<n;j++){ const val = dp[full][j] + dist[j][0]; if(val<best){ best=val; end=j; } }
      // reconstruir
      const seq = []; let mask = full, j=end;
      while(j!==-1){ seq.push(j); const pj = parent[mask][j]; mask = mask ^ (1<<(j-1)); j = pj; }
      seq.reverse(); //  [j1, j2, ...]
      return seq; // índices 1..n-1 en términos de nodes
    }

    function heuristicOrder(origen, pts){
      const unvis = new Set(pts.map((_,i)=>i));
      let cur = {lat: parseNumber(origen.lat), lng: parseNumber(origen.lng)};
      const order = [];
      while(unvis.size){
        let best=null, bestD=Infinity;
        unvis.forEach(i=>{
          const p=pts[i];
          const d = haversine(cur.lat,cur.lng,p.lat,p.lng);
          const penalty = (prioAbast.checked && /^abastec/i.test(p.servicio||''))? 0.85 : 1;
          const score = d*penalty - (p.priority? 5:0) - (prioDescAlta.checked ? Math.abs(p.monto||0)/1e7 : 0);
          if(score<bestD){ bestD=score; best=i; }
        });
        order.push(best); cur = pts[best]; unvis.delete(best);
      }
      return order;
    }
    function routeLength(origen, pts, order){
      let total=0; let last={lat: parseNumber(origen.lat), lng: parseNumber(origen.lng)};
      for(const i of order){ const p=pts[i]; total += haversine(last.lat,last.lng,p.lat,p.lng); last=p; }
      total += haversine(last.lat,last.lng, parseNumber(origen.lat), parseNumber(origen.lng));
      return total;
    }
    function twoOptImprove(origen, pts, order){
      let improved=true; let bestOrder=order.slice(); let bestLen=routeLength(origen, pts, bestOrder);
      while(improved){
        improved=false;
        for(let i=0;i<bestOrder.length-1;i++){
          for(let k=i+1;k<bestOrder.length;k++){
            const newOrder = bestOrder.slice(0,i).concat(bestOrder.slice(i,k+1).reverse(), bestOrder.slice(k+1));
            const len = routeLength(origen, pts, newOrder);
            if(len + 1e-6 < bestLen){ bestLen=len; bestOrder=newOrder; improved=true; }
          }
        }
      }
      return bestOrder;
    }

    // ===================== EXPORTAR / TRÁNSITO / HISTORIAL =====================
    btnOptimizar?.addEventListener('click', optimize);
    document.getElementById('btnTransito')?.addEventListener('click', ()=>{
      // Toggle de factor de tránsito (simulado). Para datos reales, configurar API externa.
      cfg.trafficFactor = (cfg.trafficFactor>=1.45? 1.0 : (cfg.trafficFactor+0.25));
      save(DB.cfg, cfg);
      updateSummary();
      showToast('Factor de tránsito: x'+cfg.trafficFactor.toFixed(2));
    });
    document.getElementById('btnExportar')?.addEventListener('click', ()=>{
      const origen = State.cab.find(c=>c.codigo===selOrigen.value);
      if(!origen){ return showToast('Elegí una cabecera'); }
      if(currentRoute.length===0){ return showToast('No hay paradas'); }
      const origin = `${parseNumber(origen.lat)},${parseNumber(origen.lng)}`;
      const dest = origin;
      const way = currentRoute.map(p=> `${p.lat},${p.lng}`).join('|');
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&waypoints=${encodeURIComponent(way)}&travelmode=driving`;
      window.open(url, '_blank');
    });
    document.getElementById('btnAprobar')?.addEventListener('click', ()=>{
      const nombre = prompt('Nombre de la ruta para historial:', 'Ruta '+ new Date().toLocaleString('es-AR'));
      if(!nombre) return;
      const origen = State.cab.find(c=>c.codigo===selOrigen.value);
      const rec = {
        id: uuid(), fecha: new Date().toISOString().slice(0,10), nombre,
        origen: selOrigen.value, puntos: currentRoute, camiones: parseInt(document.getElementById('nCamiones').value)||1,
        tiempo: document.getElementById('sumTiempo').textContent, montoPico: document.getElementById('sumMonto').textContent,
        aprobado: true
      };
      State.hist.unshift(rec); save(DB.hist, State.hist); renderHist(); showToast('Ruta aprobada y guardada');
    });

    function addRecent(){
      const tb = document.getElementById('recentRoutes');
      if(!tb) return;
      const km = '—';
      const tr = document.createElement('tr'); tr.innerHTML = `<td>${'Ruta '+(new Date().toLocaleDateString('es-AR'))}</td><td>${currentRoute.length}</td><td>${'—'}</td><td>${document.getElementById('sumTiempo').textContent}</td><td>${km}</td>`;
      tb.prepend(tr);
    }

    function renderHist(){
      const tbody = document.getElementById('histTbody');
      tbody.innerHTML = State.hist.map(h=>`
        <tr data-id="${h.id}"><td>${h.fecha}</td><td>${h.nombre}</td><td>${h.puntos.length}</td><td>${h.tiempo}</td><td>${h.montoPico}</td><td>${h.aprobado?'Aprobado':'Borrador'}</td>
        <td><button class="chip" data-act="cargar">Cargar</button> <button class="chip" data-act="del">Eliminar</button></td></tr>
      `).join('');
      [...tbody.querySelectorAll('button[data-act="cargar"]')].forEach(b=> b.addEventListener('click', ()=>{
        const id = b.closest('tr').dataset.id;
        const h = State.hist.find(x=>x.id===id); if(!h) return;
        selOrigen.value = h.origen || '';
        currentRoute = h.puntos || [];
        document.getElementById('nCamiones').value = h.camiones || 1;
        draw(); showToast('Ruta cargada desde historial');
      }));
      [...tbody.querySelectorAll('button[data-act="del"]')].forEach(b=> b.addEventListener('click', ()=>{
        const id = b.closest('tr').dataset.id;
        const i = State.hist.findIndex(x=>x.id===id); if(i>=0 && confirm('¿Eliminar del historial?')){ State.hist.splice(i,1); save(DB.hist, State.hist); renderHist(); }
      }));
    }
    renderHist();

    document.getElementById('btnExportHist')?.addEventListener('click', ()=>{
      const blob = new Blob([JSON.stringify(State.hist, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), {href:url, download:'historial_rutas.json'});
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
    document.getElementById('histImportInput')?.addEventListener('change', (ev)=>{
      const f=ev.target.files?.[0]; if(!f) return; const reader=new FileReader();
      reader.onload = (e)=>{ try{ const arr = JSON.parse(e.target.result); if(Array.isArray(arr)){ State.hist = arr; save(DB.hist, State.hist); renderHist(); showToast('Historial importado'); } }catch(e){ alert('JSON inválido'); } };
      reader.readAsText(f); ev.target.value='';
    });
    document.getElementById('btnImportHist')?.addEventListener('click', ()=> document.getElementById('histImportInput').click());

    // Init
    renderPts(); draw();
  })();

  /* =====================================================================
     CONFIGURACIÓN (persistir y aplicar)
  ===================================================================== */
  (function(){
    const bind = (id, prop, onChange)=>{
      const el = document.getElementById(id); if(!el) return;
      el.value = cfg[prop];
      el.addEventListener('input', ()=>{ cfg[prop] = (el.type==='color'||el.type==='text')? el.value : parseNumber(el.value); save(DB.cfg, cfg); if(onChange) onChange(); if(prop.startsWith('ui')) applyUIConfig(); });
    };
    bind('cfgMaxMonto','maxMonto');
    bind('cfgMaxMin','maxMin');
    bind('cfgVel','vel');
    bind('cfgStopSuc','stopSuc', ()=>{});
    bind('cfgStopATM','stopATM', ()=>{});
    bind('cfgStopCab','stopCab', ()=>{});
    bind('cfgStopExt','stopExt', ()=>{});
    bind('cfgFont','uiFont', applyUIConfig);
    bind('cfgRadius','uiRadius', applyUIConfig);
    bind('cfgAccent','uiAccent', applyUIConfig);
  })();

  // Copiar versión
  document.getElementById('versionChip')?.addEventListener('click', async ()=>{
    try{ await navigator.clipboard.writeText('v8.0.0'); showToast('Versión copiada'); }catch{}
  });
  
})();

(function(){

    // ===== Helper: Spanish number formatting =====
    const fmtES = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });


    // ===== Sidebar ripple + active + routing =====
    const nav = document.getElementById('nav');
    const sections = {
      dashboard: document.getElementById('dashboardSection'),
      about: document.getElementById('aboutSection'),
      atms: document.getElementById('atmsSection'),
      sucursales: document.getElementById('sucSection'),
      cabeceras: document.getElementById('cabSection'),
      costos: document.getElementById('costosSection'),
      ordenes: document.getElementById('ordenesSection'),
      rutas: document.getElementById('rutasSection'),
      choferes: document.getElementById('choferesSection'),
      camiones: document.getElementById('camionesSection'),
      otros: document.getElementById('otrosSection'),
      reportes: document.getElementById('reportesSection'),
      config: document.getElementById('configSection')
    };
    const topTitleText = document.getElementById('topTitleText');

    nav.addEventListener('click', (e)=>{
      const btn = e.target.closest('button');
      if(!btn) return;

      // active state
      document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');

      // ripple
      const circle = document.createElement('span');
      const d = Math.max(btn.clientWidth, btn.clientHeight);
      const rect = btn.getBoundingClientRect();
      circle.style.width = circle.style.height = d+'px';
      circle.style.left = (e.clientX - rect.left - d/2)+'px';
      circle.style.top  = (e.clientY - rect.top  - d/2)+'px';
      circle.className = 'ripple';
      btn.appendChild(circle);
      setTimeout(()=>circle.remove(), 600);

      // show section
      const target = btn.dataset.target || 'dashboard';
      Object.values(sections).forEach(s=>s.classList.add('hidden'));
      sections[target].classList.remove('hidden');
      topTitleText.textContent = ({
        about:'Acerca de',
        atms:'ATMs',
        sucursales:'Sucursales',
        cabeceras:'Cabeceras',
        costos:'Costos',
        ordenes:'Órdenes',
        rutas:'Rutas',
        choferes:'Choferes',
        camiones:'Camiones',
        otros:'Otros Bancos',
        reportes:'Reportes',
        config:'Configuración'
      }[target]) || 'Dashboard';

      // focus mejoras
      if(target==='atms'){ document.getElementById('atmQ')?.focus(); }
      if(target==='sucursales'){ document.getElementById('sucQ')?.focus(); }
      if(target==='cabeceras'){ document.getElementById('cabQ')?.focus(); }
      if(target==='costos'){ if(window.costosOnShow) setTimeout(window.costosOnShow, 50); }
      if(target==='reportes'){ if(window.reportesOnShow) setTimeout(window.reportesOnShow, 50); }
    });

    // ===== Count-up microinteraction =====
    document.querySelectorAll('.value[data-count]').forEach(el=>{
      const end = Number(el.getAttribute('data-count'));
      const fixed = Number(el.getAttribute('data-fixed') || 0);
      const dec = el.getAttribute('data-decimal') || '.';
      let start = 0, startTs=null, dur=900; // ms
      const step = ts=>{
        if(!startTs) startTs = ts;
        const p = Math.min((ts-startTs)/dur, 1);
        const val = start + (end-start)*p;
        el.textContent = (fixed? val.toFixed(fixed): Math.round(val)).toString().replace('.', dec);
        if(p<1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    // ===== Chart.js theme helpers =====
    function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim() }

    // ===== CHARTS (Dashboard) =====
    const barCtx = document.getElementById('montosChart');
    bar = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['mar. 9','mar. 10','mar. 12','mar. 12','mar. 14'],
        datasets: [{
          label: 'Montos (M)',
          data: [4.4,3.5,2.6,1.9,1.4],
          backgroundColor: cssVar('--chart-accent') || 'rgba(67,164,109, .85)',
          hoverBackgroundColor: cssVar('--chart-accent') || 'rgba(67,164,109, 1)',
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 46,
        }]
      },
      options: {
        animation: {duration:700, easing:'easeOutQuart'},
        plugins: { legend: {display:false}, tooltip: {callbacks:{
          label: (ctx)=>` ${fmtES.format(ctx.parsed.y)} M`
        } } },
        scales: {
          x: { grid: { display:false }, ticks: { color: cssVar('--chart-text'), font:{size:12} } },
          y: { grid: { color: cssVar('--chart-grid'), borderColor: cssVar('--chart-grid'), drawTicks:false }, 
               border: {display:false}, ticks: {
            stepSize: 1,
            color: cssVar('--chart-text'),
            callback: v => `${v.toFixed(1).replace('.',',')} M`
          }, suggestedMax: 5 }
        }
      }
    });

    const pieCtx = document.getElementById('entregasChart');
    pie = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Sucursales','ATMs'],
        datasets: [{ data: [68.7,31.3], backgroundColor:[cssVar('--chart-accent-2') || '#3b9562', cssVar('--brand-200') || '#c8ecd7'], borderColor:['#eaf7ef','#f3faf6'], borderWidth:2 }]
      },
      options: {
        cutout: '62%',
        rotation: -40,
        plugins: { legend: {display:false}, tooltip: {callbacks:{ label: (c)=> ` ${c.label}: ${c.parsed}%` }} },
      }
    });

    lineCtx = document.getElementById('fallidasChart');
    const grad = lineCtx.getContext('2d').createLinearGradient(0,0,0,160);
    grad.addColorStop(0,cssVar('--chart-accent-soft') || 'rgba(67,164,109,.18)');
    grad.addColorStop(1,'rgba(67,164,109,0)');

    line = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: ['abr. 2','abr. 4','abr. 6','abr. 7','abr. 8','abr. 10','abr. 4','abr. 10','abr. 10'],
        datasets: [
          { data: [2,3,7,6,3,5,4,6,3], borderColor: cssVar('--chart-accent-2') || '#3b9562', backgroundColor: grad, pointBackgroundColor: '#fff', pointBorderColor: cssVar('--chart-accent-2') || '#3b9562', pointBorderWidth: 2, pointRadius: 4, tension: .35, fill: true },
          { data: [0,0,0,0,0,0,0,0,0], borderColor: '#113322', pointBackgroundColor: '#fff', pointBorderColor: '#113322', pointBorderWidth: 2, pointRadius: 4, borderWidth:1, tension: .35, fill:false }
        ]
      },
      options: {
        animation: {duration:700, easing:'easeOutQuart'},
        plugins: { legend: {display:false}, tooltip:{callbacks:{ label: (c)=> ` ${c.datasetIndex===0? 'Exitosas':'Fallidas'}: ${c.parsed.y}`}} },
        scales: {
          x: { grid: { display:false }, ticks:{ color: cssVar('--chart-text'), font:{size:12} } },
          y: { grid: { color: cssVar('--chart-grid'), borderColor: cssVar('--chart-grid'), drawTicks:false }, border: {display:false}, ticks: { stepSize:2, color: cssVar('--chart-text') }, suggestedMax:10 }
        }
      }
    });

    applyChartTheme();

    // ===== Toast + tooltip helpers (comunes) =====
    const toast = document.getElementById('toast');
    function showToast(text="Listo"){
      toast.textContent = text;
      toast.classList.add('show');
      setTimeout(()=> toast.classList.remove('show'), 1600);
    }
    const tooltip = document.getElementById('tooltip');
    document.addEventListener('mouseover', e=>{
      const t = e.target.closest('[data-tip]'); if(!t) { tooltip.classList.remove('show'); return; }
      tooltip.textContent = t.getAttribute('data-tip');
      const r = t.getBoundingClientRect();
      tooltip.style.left = (r.left + r.width/2) + 'px';
      tooltip.style.top = (r.top - 10) + 'px';
      tooltip.style.transform = 'translate(-50%,-100%)';
      tooltip.classList.add('show');
    });
    document.addEventListener('mouseout', e=>{ if(e.target.closest('[data-tip]')) tooltip.classList.remove('show'); });

    // ===== About: copiar versión =====
    const versionChip = document.getElementById('versionChip');
    if(versionChip){
      versionChip.addEventListener('click', async () => {
        const text = versionChip.dataset.copy || 'v6.0.2';
        try{ await navigator.clipboard.writeText(text); showToast('Versión copiada: ' + text); }
        catch{ showToast('No se pudo copiar'); }
      });
    }

    // ==================== ATMs: LÓGICA COMPLETA ====================
    const ATM_DB_KEY = "atm-ui-v2";
    const atmSeed = [
      {codigo:"50007", nombre:"América",     lat:-35.426, lng:-61.306},
      {codigo:"50009", nombre:"Ayacucho",    lat:-37.149, lng:-57.139},
      {codigo:"50010", nombre:"Bahía Blanca",lat:-38.715, lng:-62.268},
      {codigo:"50011", nombre:"Bólivar",     lat:-36.237, lng:-61.106},
      {codigo:"50012", nombre:"Bragado",     lat:-35.119, lng:-60.494},
      {codigo:"50014", nombre:"Campana",     lat:-34.132, lng:-59.099}
    ];

    function loadATMFromStorage(){
      try{ return JSON.parse(localStorage.getItem(ATM_DB_KEY)) ?? null; }
      catch(e){ return null; }
    }
    function saveATMToStorage(data){ localStorage.setItem(ATM_DB_KEY, JSON.stringify(data)); }

    // CSV helpers (import/export) ATMs
    function parseCSV_ATM(text){
      const lines = text.replace(/\\r/g,'').split('\\n').filter(Boolean);
      if(!lines.length) return [];
      const sep = (lines[0].includes(';') && !lines[0].includes(',')) ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
      const idx = { codigo: headers.indexOf('codigo'), nombre: headers.indexOf('nombre'), lat: headers.indexOf('lat'), lng: headers.indexOf('lng') };
      return lines.slice(1).map(row=>{
        const cells = []; let cur = '', inQ = false;
        for(let i=0; i<row.length; i++){
          const ch = row[i];
          if(ch==='\"'){ inQ = !inQ; continue; }
          if(ch===sep && !inQ){ cells.push(cur); cur=''; } else { cur+=ch; }
        }
        cells.push(cur);
        const get = (k)=> idx[k]>=0 ? (cells[idx[k]]??'').trim() : '';
        return { codigo: (get('codigo')||'').padStart(5,'0'), nombre: get('nombre'), lat: parseFloat(get('lat')), lng: parseFloat(get('lng')) };
      }).filter(r=> r.codigo && r.nombre && !isNaN(r.lat) && !isNaN(r.lng));
    }
    function exportCSV_ATM(rows){
      const hdr = ["codigo","nombre","lat","lng"];
      const csv = [hdr.join(",")].concat(rows.map(r=> [r.codigo, `"${(r.nombre||'').replace(/"/g,'""')}"`, r.lat, r.lng].join(","))).join("\\n");
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href:url, download:"atm.csv" });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast("CSV exportado");
    }
    async function tryFetchATMCSV(){
      try{
        const res = await fetch('atm.csv', {cache:'no-store'});
        if(!res.ok) throw new Error('not ok');
        const text = await res.text();
        const data = parseCSV_ATM(text);
        if(data.length){ return data; }
      }catch(e){ }
      return null;
    }

    // Estado ATMs
    let atmRows = [];
    let atmSelectedIndex = 0;
    let atmSortBy = null;
    let atmSortDir = 1;

    // Refs ATMs
    const atmTbody = document.getElementById('atmTbody');
    const atmCountEl = document.getElementById('atmCount');
    const atmQ = document.getElementById('atmQ');
    const atmClear = document.getElementById('atmClear');
    const atmQuickRow = document.getElementById('atmQuickRow');
    const atmDId = document.getElementById('atmDId'), atmDHead = document.getElementById('atmDHead');
    const atmDLat = document.getElementById('atmDLat'), atmDLng = document.getElementById('atmDLng');
    const atmDetailTitle = document.getElementById('atmDetailTitle');

    // Map
    let atmMap, atmMarker, atmCircle;

    function fmtCoord(n){ return (n>0? "" : "") + Number(n).toFixed(3); }
    const wrapParens = (s)=> `(${s})`;

    function highlight(text, q){
      if(!q) return text;
      const i = text.toLowerCase().indexOf(q);
      if(i<0) return text;
      return text.slice(0,i) + '<mark style="background:rgba(47,187,107,.3);color:inherit;border-radius:4px;padding:0 2px">'+ text.slice(i, i+q.length) +'</mark>' + text.slice(i+q.length);
    }

    function renderATMTable(){
      const query = atmQ.value.trim().toLowerCase();
      const filtered = atmRows.filter(r => !query || r.codigo.includes(query) || r.nombre.toLowerCase().includes(query));
      if (atmSortBy){
        filtered.sort((a,b)=>{
          const va = atmSortBy==="codigo"? +a.codigo : atmSortBy==="nombre"? a.nombre : atmSortBy==="lat"? a.lat : a.lng;
          const vb = atmSortBy==="codigo"? +b.codigo : atmSortBy==="nombre"? b.nombre : atmSortBy==="lat"? b.lat : b.lng;
          return va>vb? atmSortDir : va<vb? -atmSortDir : 0;
        });
      }
      atmTbody.innerHTML = "";
      filtered.forEach((r, i)=>{
        const tr = document.createElement('tr');
        tr.className = "hoverable";
        tr.tabIndex = 0;
        const isSel = atmRows[atmSelectedIndex] && r.codigo===atmRows[atmSelectedIndex].codigo;
        if (isSel) tr.classList.add('selected');
        tr.setAttribute('data-codigo', r.codigo);
        tr.innerHTML = `
          <td>${r.codigo}</td>
          <td>${highlight(r.nombre, query)}</td>
          <td class="right coord">${wrapParens(fmtCoord(r.lat))}</td>
          <td class="right coord">${wrapParens(fmtCoord(r.lng))}</td>
        `;
        tr.addEventListener('click', (ev)=>{ selectATMByCodigo(r.codigo); ripple(ev); });
        tr.addEventListener('keydown', (ev)=>{ if(ev.key==="Enter"){ selectATMByCodigo(r.codigo); } });
        atmTbody.appendChild(tr);
      });
      atmCountEl.textContent = filtered.length;
    }

    function selectATMByCodigo(codigo){
      const idx = atmRows.findIndex(r=> r.codigo===codigo);
      if (idx<0) return;
      atmSelectedIndex = idx;
      [...atmTbody.querySelectorAll('tr')].forEach(tr=> tr.classList.remove('selected'));
      const rowEl = [...atmTbody.querySelectorAll('tr')].find(tr=> tr.dataset.codigo===codigo);
      if(rowEl) rowEl.classList.add('selected');
      updateATMDetail();
      panATMMap();
    }

    function updateATMDetail(){
      const r = atmRows[atmSelectedIndex]; if(!r) return;
      atmDetailTitle.textContent = r.nombre;
      atmDId.textContent = r.codigo; atmDHead.textContent = r.nombre;
      atmDLat.textContent = fmtCoord(r.lat); atmDLng.textContent = fmtCoord(r.lng);
      atmQuickRow.children[0].textContent = r.codigo;
      atmQuickRow.children[1].textContent = r.nombre.length>18? r.nombre.slice(0,18)+"…" : r.nombre;
      atmQuickRow.children[2].textContent = fmtCoord(r.lat);
      atmQuickRow.children[3].textContent = fmtCoord(r.lng);
    }

    function initATMMap(){
      const mapEl = document.getElementById('atmMap');
      document.getElementById('atmMapSkeleton').classList.add('hidden');
      mapEl.classList.remove('hidden');

      atmMap = L.map('atmMap', { zoomControl:false, minZoom: 3});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:'&copy; OpenStreetMap',
        maxZoom:19
      }).addTo(atmMap);

      L.control.zoom({ position:'bottomright' }).addTo(atmMap);

      const divIcon = L.divIcon({
        className:'', html:`<div style="display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:rgba(47,187,107,.2);box-shadow:inset 0 0 0 2px rgba(47,187,107,.55)"><div class="pulse"></div></div>`,
        iconSize:[36,36], iconAnchor:[18,18]
      });

      atmMarker = L.marker([atmRows[atmSelectedIndex].lat, atmRows[atmSelectedIndex].lng], {icon:divIcon}).addTo(atmMap);
      atmCircle = L.circle([atmRows[atmSelectedIndex].lat, atmRows[atmSelectedIndex].lng], {radius:3000, color:'#2fbb6b', fillColor:'#2fbb6b', fillOpacity:.08, weight:1}).addTo(atmMap);

      panATMMap(13, true);
    }
    function clamp(i, min, max){ return Math.max(min, Math.min(max, i)); }
    function panATMMap(zoom=13, snap=false){
      const r = atmRows[atmSelectedIndex]; if(!r || !atmMap) return;
      const latlng = [r.lat, r.lng];
      atmMarker.setLatLng(latlng);
      atmCircle.setLatLng(latlng);
      if(snap) atmMap.setView(latlng, zoom);
      else {
        const z = clamp(atmMap.getZoom()+1, 5, 15);
        atmMap.flyTo(latlng, z, { duration: .8, easeLinearity:.3 });
      }
    }

    // CRUD modal ATMs
    const atmModal = document.getElementById('atmModal');
    const atmSheetTitle = document.getElementById('atmSheetTitle');
    const atmCodigo = document.getElementById('atmCodigo');
    const atmNombre = document.getElementById('atmNombre');
    const atmLat = document.getElementById('atmLat');
    const atmLng = document.getElementById('atmLng');

    let atmEditingExisting = true;
    function openATMModal(mode="edit"){
      atmEditingExisting = (mode==="edit");
      atmSheetTitle.textContent = atmEditingExisting ? "Editar ATM" : "Nuevo ATM";
      const r = atmRows[atmSelectedIndex] || {codigo:"", nombre:"", lat:"", lng:""};
      atmCodigo.value = atmEditingExisting ? r.codigo : "";
      atmNombre.value = atmEditingExisting ? r.nombre : "";
      atmLat.value    = atmEditingExisting ? r.lat : "";
      atmLng.value    = atmEditingExisting ? r.lng : "";
      atmModal.classList.add('open');
      atmCodigo.focus();
    }
    function closeATMModal(){ atmModal.classList.remove('open'); }
    function saveATMModal(){
      const data = {
        codigo: atmCodigo.value.trim(),
        nombre: atmNombre.value.trim(),
        lat: parseFloat(atmLat.value),
        lng: parseFloat(atmLng.value)
      };
      if(!/^\\d{5}$/.test(data.codigo) || !data.nombre || isNaN(data.lat) || isNaN(data.lng)){
        showToast("Completa los campos correctamente"); return;
      }
      const existingIdx = atmRows.findIndex(r=> r.codigo===data.codigo);
      if(atmEditingExisting){
        atmRows[atmSelectedIndex] = data;
        if(existingIdx>=0 && existingIdx!==atmSelectedIndex){ showToast("Código ya existente"); return; }
      }else{
        if(existingIdx>=0){ showToast("Código ya existente"); return; }
        atmRows.push(data);
        atmSelectedIndex = atmRows.length-1;
      }
      saveATMToStorage(atmRows);
      renderATMTable();
      selectATMByCodigo(data.codigo);
      showToast("Guardado");
      closeATMModal();
    }

    // Export/Import ATMs
    function exportATM(){ exportCSV_ATM(atmRows); }
    const atmImportInput = document.getElementById('atmImportInput');
    function importATMFromFile(file){
      const reader = new FileReader();
      reader.onload = (ev)=>{
        try{
          const text = ev.target.result;
          const arr = parseCSV_ATM(text);
          if(!arr.length) return showToast('CSV vacío o inválido');
          atmRows = arr;
          atmSelectedIndex = 0;
          saveATMToStorage(atmRows);
          renderATMTable();
          selectATMByCodigo(atmRows[0].codigo);
          showToast('CSV importado');
        }catch(e){ showToast('No se pudo importar'); }
      };
      reader.readAsText(file);
    }

    document.getElementById('atmClear').onclick = ()=>{ atmQ.value=''; atmQ.focus(); renderATMTable(); };
    document.getElementById('atmNew').onclick = ()=> openATMModal('new');
    document.getElementById('atmExport').onclick = exportATM;
    document.getElementById('atmImport').onclick = ()=> atmImportInput.click();
    atmImportInput.addEventListener('change', (ev)=>{ const f = ev.target.files?.[0]; if(f) importATMFromFile(f); ev.target.value=''; });
    document.getElementById('atmLocate').onclick = ()=>{
      if(!navigator.geolocation) return showToast("Sin geolocalización");
      navigator.geolocation.getCurrentPosition(pos=>{
        const {latitude, longitude} = pos.coords;
        atmMap && atmMap.flyTo([latitude, longitude], 12, { duration: .8 });
        showToast("Centrado en tu ubicación");
      }, ()=> showToast("No se pudo obtener ubicación"));
    };

    document.getElementById('atmEdit').onclick = ()=> openATMModal('edit');
    document.getElementById('atmDuplicate').onclick = ()=>{
      const s = atmRows[atmSelectedIndex]; if(!s) return;
      const nextCode = String(Math.max(...atmRows.map(r=>+r.codigo))+1).padStart(5,"0");
      const dup = {...s, codigo: nextCode, nombre: s.nombre + " (copiado)"};
      atmRows.push(dup); saveATMToStorage(atmRows); renderATMTable(); selectATMByCodigo(dup.codigo); showToast("Duplicado");
    };
    document.getElementById('atmDelete').onclick = ()=>{
      const s = atmRows[atmSelectedIndex]; if(!s) return;
      if(confirm(`¿Eliminar ${s.nombre} (${s.codigo})?`)){
        atmRows.splice(atmSelectedIndex,1); saveATMToStorage(atmRows);
        atmSelectedIndex = clamp(atmSelectedIndex, 0, atmRows.length-1);
        renderATMTable(); if(atmRows[atmSelectedIndex]) selectATMByCodigo(atmRows[atmSelectedIndex].codigo);
        showToast("Eliminado");
      }
    };

    document.getElementById('atmModal').addEventListener('click', (e)=>{ if(e.target.id==='atmModal') closeATMModal(); });
    document.getElementById('atmCloseModal').onclick = closeATMModal;
    document.getElementById('atmCancelModal').onclick = closeATMModal;
    document.getElementById('atmSaveModal').onclick = saveATMModal;

    atmQ.addEventListener('input', renderATMTable);

    document.addEventListener('keydown', (e)=>{
      const visible = !document.getElementById('atmsSection').classList.contains('hidden');
      if(!visible) return;
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); atmQ.focus(); atmQ.select(); }
      if(e.key==='Escape'){ if(document.activeElement===atmQ){ atmQ.value=''; renderATMTable(); } }
      if(e.key==='n' && !e.ctrlKey && !e.metaKey){ openATMModal('new'); }
      if(e.key.toLowerCase()==='r' && !e.ctrlKey && !e.metaKey){ showToast("Sincronizado"); }
      if(['ArrowDown','ArrowUp','Enter'].includes(e.key) && !atmModal.classList.contains('open')){
        const trs = [...atmTbody.querySelectorAll('tr')];
        if(!trs.length) return;
        let idx = trs.findIndex(tr=> tr.classList.contains('selected'));
        if(e.key==='ArrowDown') { idx = clamp(idx+1, 0, trs.length-1); trs[idx].focus(); selectATMByCodigo(trs[idx].dataset.codigo); }
        if(e.key==='ArrowUp')   { idx = clamp(idx-1, 0, trs.length-1); trs[idx].focus(); selectATMByCodigo(trs[idx].dataset.codigo); }
        if(e.key==='Enter' && idx>=0){ selectATMByCodigo(trs[idx].dataset.codigo); }
      }
    });

    document.querySelectorAll('#atmTable th[data-sort]').forEach(th=>{
      th.addEventListener('click', ()=>{
        const key = th.getAttribute('data-sort');
        if(atmSortBy===key) atmSortDir *= -1; else { atmSortBy = key; atmSortDir = 1; }
        renderATMTable();
      });
    });

    function ripple(e){
      const target = e.currentTarget || e.target;
      const rect = target.getBoundingClientRect();
      const r = document.createElement('span');
      r.className = 'ripple';
      r.style.width = r.style.height = Math.max(rect.width, rect.height) + 'px';
      r.style.left = (e.clientX - rect.left) + 'px';
      r.style.top  = (e.clientY - rect.top)  + 'px';
      target.appendChild(r);
      setTimeout(()=> r.remove(), 600);
    }
    document.querySelectorAll('.icon-btn,.chip').forEach(b=> b.addEventListener('pointerdown', ripple));

    (async function initATMs(){
      let data = await tryFetchATMCSV();
      if(!data){
        const fromStorage = loadATMFromStorage();
        if(fromStorage){ data = fromStorage; } else { data = atmSeed.slice(); }
      }
      atmRows = data;
      saveATMToStorage(atmRows);
      renderATMTable();
      atmSelectedIndex = Math.min(2, atmRows.length-1);
      if(atmRows[atmSelectedIndex]) selectATMByCodigo(atmRows[atmSelectedIndex].codigo);
      initATMMap();
    
    // ==================== SUCURSALES: LÓGICA COMPLETA ====================
    const SUC_DB_KEY = "suc-ui-v1";
    const sucSeed = [
      {codigo:"10001", nombre:"Bahía Blanca - Centro", direccion:"Av. Colón 100", localidad:"Bahía Blanca", lat:-38.718, lng:-62.268},
      {codigo:"10002", nombre:"La Plata - Catedral",   direccion:"Calle 50 600",   localidad:"La Plata",       lat:-34.921, lng:-57.954},
      {codigo:"10003", nombre:"Mar del Plata",         direccion:"Av. Luro 2000",  localidad:"Mar del Plata",  lat:-38.002, lng:-57.556},
      {codigo:"10004", nombre:"Tandil",                direccion:"San Martín 800", localidad:"Tandil",         lat:-37.321, lng:-59.133},
      {codigo:"10005", nombre:"Campana",               direccion:"Rivadavia 450",  localidad:"Campana",        lat:-34.167, lng:-58.959},
      {codigo:"10006", nombre:"Quilmes",               direccion:"Mitre 700",      localidad:"Quilmes",        lat:-34.725, lng:-58.254}
    ];

    function loadSUCFromStorage(){
      try{ return JSON.parse(localStorage.getItem(SUC_DB_KEY)) ?? null; }
      catch(e){ return null; }
    }
    function saveSUCToStorage(data){ localStorage.setItem(SUC_DB_KEY, JSON.stringify(data)); }

    // CSV helpers (import/export) Sucursales
    function parseCSV_SUC(text){
      const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
      if(!lines.length) return [];
      const sep = (lines[0].includes(';') && !lines[0].includes(',')) ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
      const idx = { 
        codigo: headers.indexOf('codigo'), nombre: headers.indexOf('nombre'),
        lat: headers.indexOf('lat'), lng: headers.indexOf('lng'),
        direccion: headers.indexOf('direccion'), localidad: headers.indexOf('localidad')
      };
      return lines.slice(1).map(row=>{
        const cells = []; let cur = '', inQ = false;
        for(let i=0; i<row.length; i++){
          const ch = row[i];
          if(ch==='"'){ inQ = !inQ; continue; }
          if(ch===sep && !inQ){ cells.push(cur); cur=''; } else { cur+=ch; }
        }
        cells.push(cur);
        const get = (k)=> idx[k]>=0 ? (cells[idx[k]]??'').trim() : '';
        const lat = parseFloat(get('lat'));
        const lng = parseFloat(get('lng'));
        return { 
          codigo: (get('codigo')||'').padStart(5,'0'), 
          nombre: get('nombre'),
          lat: isNaN(lat)? null: lat,
          lng: isNaN(lng)? null: lng,
          direccion: get('direccion') || '',
          localidad: get('localidad') || ''
        };
      }).filter(r=> r.codigo && r.nombre && r.lat!==null && r.lng!==null);
    }
    function exportCSV_SUC(rows){
      const hdr = ["codigo","nombre","lat","lng","direccion","localidad"];
      const csv = [hdr.join(",")].concat(rows.map(r=> [
        r.codigo,
        `"${(r.nombre||'').replace(/"/g,'""')}"`,
        r.lat, r.lng,
        `"${(r.direccion||'').replace(/"/g,'""')}"`,
        `"${(r.localidad||'').replace(/"/g,'""')}"`
      ].join(","))).join("\n");
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href:url, download:"sucursales.csv" });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast("CSV exportado");
    }
    async function tryFetchSUCCSV(){
      try{
        const res = await fetch('sucursales.csv', {cache:'no-store'});
        if(!res.ok) throw new Error('not ok');
        const text = await res.text();
        const data = parseCSV_SUC(text);
        if(data.length){ return data; }
      }catch(e){ }
      return null;
    }

    // Estado Sucursales
    let sucRows = [];
    let sucSelectedIndex = 0;
    let sucSortBy = null;
    let sucSortDir = 1;

    // Refs Sucursales
    const sucTbody = document.getElementById('sucTbody');
    const sucCountEl = document.getElementById('sucCount');
    const sucQ = document.getElementById('sucQ');
    const sucQuickRow = document.getElementById('sucQuickRow');
    const sucDId = document.getElementById('sucDId');
    const sucDName = document.getElementById('sucDName');
    const sucDDir = document.getElementById('sucDDir');
    const sucDLoc = document.getElementById('sucDLoc');
    const sucDLat = document.getElementById('sucDLat');
    const sucDLng = document.getElementById('sucDLng');
    const sucDetailTitle = document.getElementById('sucDetailTitle');

    // Map
    let sucMap, sucMarker, sucCircle;

    function renderSUCTable(){
      const query = (sucQ.value||'').trim().toLowerCase();
      const filtered = sucRows.filter(r => !query || r.codigo.includes(query) || (r.nombre||'').toLowerCase().includes(query));
      if (sucSortBy){
        filtered.sort((a,b)=>{
          const va = sucSortBy==="codigo"? +a.codigo : sucSortBy==="nombre"? (a.nombre||'') : sucSortBy==="lat"? a.lat : a.lng;
          const vb = sucSortBy==="codigo"? +b.codigo : sucSortBy==="nombre"? (b.nombre||'') : sucSortBy==="lat"? b.lat : b.lng;
          return va>vb? sucSortDir : va<vb? -sucSortDir : 0;
        });
      }
      sucTbody.innerHTML = "";
      filtered.forEach((r)=>{
        const tr = document.createElement('tr');
        tr.className = "hoverable";
        tr.tabIndex = 0;
        const isSel = sucRows[sucSelectedIndex] && r.codigo===sucRows[sucSelectedIndex].codigo;
        if (isSel) tr.classList.add('selected');
        tr.setAttribute('data-codigo', r.codigo);
        tr.innerHTML = `
          <td>${r.codigo}</td>
          <td>${highlight(r.nombre||'', query)}</td>
          <td class="right coord">${('('+fmtCoord(r.lat)+')')}</td>
          <td class="right coord">${('('+fmtCoord(r.lng)+')')}</td>
        `;
        tr.addEventListener('click', (ev)=>{ selectSUCByCodigo(r.codigo); ripple(ev); });
        tr.addEventListener('keydown', (ev)=>{ if(ev.key==="Enter"){ selectSUCByCodigo(r.codigo); } });
        sucTbody.appendChild(tr);
      });
      sucCountEl.textContent = filtered.length;
    }

    function selectSUCByCodigo(codigo){
      const idx = sucRows.findIndex(r=> r.codigo===codigo);
      if (idx<0) return;
      sucSelectedIndex = idx;
      [...sucTbody.querySelectorAll('tr')].forEach(tr=> tr.classList.remove('selected'));
      const rowEl = [...sucTbody.querySelectorAll('tr')].find(tr=> tr.dataset.codigo===codigo);
      if(rowEl) rowEl.classList.add('selected');
      updateSUCDetail();
      panSUCMap();
    }

    function updateSUCDetail(){
      const r = sucRows[sucSelectedIndex]; if(!r) return;
      sucDetailTitle.textContent = r.nombre || '–';
      sucDId.textContent = r.codigo || '–';
      sucDName.textContent = r.nombre || '–';
      sucDDir.textContent = r.direccion || '–';
      sucDLoc.textContent = r.localidad || '–';
      sucDLat.textContent = fmtCoord(r.lat);
      sucDLng.textContent = fmtCoord(r.lng);
      sucQuickRow.children[0].textContent = r.codigo || '–';
      sucQuickRow.children[1].textContent = (r.nombre||'').length>18? (r.nombre||'').slice(0,18)+'…' : (r.nombre||'–');
      sucQuickRow.children[2].textContent = fmtCoord(r.lat);
      sucQuickRow.children[3].textContent = fmtCoord(r.lng);
    }

    function initSUCMap(){
      const mapEl = document.getElementById('sucMap');
      document.getElementById('sucMapSkeleton').classList.add('hidden');
      mapEl.classList.remove('hidden');

      sucMap = L.map('sucMap', { zoomControl:false, minZoom: 3});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:'&copy; OpenStreetMap',
        maxZoom:19
      }).addTo(sucMap);

      L.control.zoom({ position:'bottomright' }).addTo(sucMap);

      const divIcon = L.divIcon({
        className:'', html:`<div style="display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:rgba(47,187,107,.2);box-shadow:inset 0 0 0 2px rgba(47,187,107,.55)"><div class="pulse"></div></div>`,
        iconSize:[36,36], iconAnchor:[18,18]
      });

      sucMarker = L.marker([sucRows[sucSelectedIndex].lat, sucRows[sucSelectedIndex].lng], {icon:divIcon}).addTo(sucMap);
      sucCircle = L.circle([sucRows[sucSelectedIndex].lat, sucRows[sucSelectedIndex].lng], {radius:3000, color:'#2fbb6b', fillColor:'#2fbb6b', fillOpacity:.08, weight:1}).addTo(sucMap);

      panSUCMap(13, true);
    }
    function panSUCMap(zoom=13, snap=false){
      const r = sucRows[sucSelectedIndex]; if(!r || !sucMap) return;
      const latlng = [r.lat, r.lng];
      sucMarker.setLatLng(latlng);
      sucCircle.setLatLng(latlng);
      if(snap) sucMap.setView(latlng, zoom);
      else {
        const z = clamp(sucMap.getZoom()+1, 5, 15);
        sucMap.flyTo(latlng, z, { duration: .8, easeLinearity:.3 });
      }
    }

    // CRUD modal Sucursales
    const sucModal = document.getElementById('sucModal');
    const sucSheetTitle = document.getElementById('sucSheetTitle');
    const sucCodigo = document.getElementById('sucCodigo');
    const sucNombre = document.getElementById('sucNombre');
    const sucDireccion = document.getElementById('sucDireccion');
    const sucLocalidad = document.getElementById('sucLocalidad');
    const sucLat = document.getElementById('sucLat');
    const sucLng = document.getElementById('sucLng');

    let sucEditingExisting = true;
    function openSUCModal(mode="edit"){
      sucEditingExisting = (mode==="edit");
      sucSheetTitle.textContent = sucEditingExisting ? "Editar sucursal" : "Nueva sucursal";
      const r = sucRows[sucSelectedIndex] || {codigo:"", nombre:"", direccion:"", localidad:"", lat:"", lng:""};
      sucCodigo.value = sucEditingExisting ? r.codigo : "";
      sucNombre.value = sucEditingExisting ? r.nombre : "";
      sucDireccion.value = sucEditingExisting ? r.direccion : "";
      sucLocalidad.value = sucEditingExisting ? r.localidad : "";
      sucLat.value    = sucEditingExisting ? r.lat : "";
      sucLng.value    = sucEditingExisting ? r.lng : "";
      sucModal.classList.add('open');
      sucCodigo.focus();
    }
    function closeSUCModal(){ sucModal.classList.remove('open'); }
    function saveSUCModal(){
      const data = {
        codigo: (sucCodigo.value||'').trim(),
        nombre: (sucNombre.value||'').trim(),
        direccion: (sucDireccion.value||'').trim(),
        localidad: (sucLocalidad.value||'').trim(),
        lat: parseFloat(sucLat.value),
        lng: parseFloat(sucLng.value)
      };
      const ok = /^\d{3,6}$/.test(data.codigo) && data.nombre && !isNaN(data.lat) && !isNaN(data.lng);
      if(!ok){ showToast("Completá los campos obligatorios correctamente"); return; }
      const existingIdx = sucRows.findIndex(r=> r.codigo===data.codigo);
      if(sucEditingExisting){
        if(existingIdx>=0 && existingIdx!==sucSelectedIndex){ showToast("Código ya existente"); return; }
        sucRows[sucSelectedIndex] = data;
      }else{
        if(existingIdx>=0){ showToast("Código ya existente"); return; }
        sucRows.push(data);
        sucSelectedIndex = sucRows.length-1;
      }
      saveSUCToStorage(sucRows);
      renderSUCTable();
      selectSUCByCodigo(data.codigo);
      showToast("Guardado");
      closeSUCModal();
    }

    // Export/Import Sucursales
    function exportSUC(){ exportCSV_SUC(sucRows); }
    const sucImportInput = document.getElementById('sucImportInput');
    function importSUCFromFile(file){
      const reader = new FileReader();
      reader.onload = (ev)=>{
        try{
          const text = ev.target.result;
          const arr = parseCSV_SUC(text);
          if(!arr.length) return showToast('CSV vacío o inválido');
          sucRows = arr;
          sucSelectedIndex = 0;
          saveSUCToStorage(sucRows);
          renderSUCTable();
          selectSUCByCodigo(sucRows[0].codigo);
          showToast('CSV importado');
        }catch(e){ showToast('No se pudo importar'); }
      };
      reader.readAsText(file);
    }

    document.getElementById('sucClear').onclick = ()=>{ sucQ.value=''; sucQ.focus(); renderSUCTable(); };
    document.getElementById('sucNew').onclick = ()=> openSUCModal('new');
    document.getElementById('sucExport').onclick = exportSUC;
    document.getElementById('sucImport').onclick = ()=> sucImportInput.click();
    sucImportInput.addEventListener('change', (ev)=>{ const f = ev.target.files?.[0]; if(f) importSUCFromFile(f); ev.target.value=''; });
    document.getElementById('sucLocate').onclick = ()=>{
      if(!navigator.geolocation) return showToast("Sin geolocalización");
      navigator.geolocation.getCurrentPosition(pos=>{
        const {latitude, longitude} = pos.coords;
        sucMap && sucMap.flyTo([latitude, longitude], 12, { duration: .8 });
        showToast("Centrado en tu ubicación");
      }, ()=> showToast("No se pudo obtener ubicación"));
    };

    document.getElementById('sucEdit').onclick = ()=> openSUCModal('edit');
    document.getElementById('sucDuplicate').onclick = ()=>{
      const s = sucRows[sucSelectedIndex]; if(!s) return;
      const nextCode = String(Math.max(...sucRows.map(r=>+r.codigo))+1).padStart(5,"0");
      const dup = {...s, codigo: nextCode, nombre: (s.nombre||'') + " (copiada)"};
      sucRows.push(dup); saveSUCToStorage(sucRows); renderSUCTable(); selectSUCByCodigo(dup.codigo); showToast("Duplicado");
    };
    document.getElementById('sucDelete').onclick = ()=>{
      const s = sucRows[sucSelectedIndex]; if(!s) return;
      if(confirm(`¿Eliminar ${s.nombre} (${s.codigo})?`)){
        sucRows.splice(sucSelectedIndex,1); saveSUCToStorage(sucRows);
        sucSelectedIndex = clamp(sucSelectedIndex, 0, sucRows.length-1);
        renderSUCTable(); if(sucRows[sucSelectedIndex]) selectSUCByCodigo(sucRows[sucSelectedIndex].codigo);
        showToast("Eliminado");
      }
    };

    document.getElementById('sucModal').addEventListener('click', (e)=>{ if(e.target.id==='sucModal') closeSUCModal(); });
    document.getElementById('sucCloseModal').onclick = closeSUCModal;
    document.getElementById('sucCancelModal').onclick = closeSUCModal;
    document.getElementById('sucSaveModal').onclick = saveSUCModal;

    sucQ.addEventListener('input', renderSUCTable);

    // sort handlers
    document.querySelectorAll('#sucTable th[data-sort]').forEach(th=>{
      th.addEventListener('click', ()=>{
        const key = th.getAttribute('data-sort');
        if(sucSortBy===key) sucSortDir *= -1; else { sucSortBy = key; sucSortDir = 1; }
        renderSUCTable();
      });
    });

    // Atajos de teclado sección Sucursales
    document.addEventListener('keydown', (e)=>{
      const visible = !document.getElementById('sucSection').classList.contains('hidden');
      if(!visible) return;
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); sucQ.focus(); sucQ.select(); }
      if(e.key==='Escape'){ if(document.activeElement===sucQ){ sucQ.value=''; renderSUCTable(); } }
      if(e.key==='n' && !e.ctrlKey && !e.metaKey){ openSUCModal('new'); }
      if(e.key.toLowerCase()==='r' && !e.ctrlKey && !e.metaKey){ showToast("Sincronizado"); }
      if(['ArrowDown','ArrowUp','Enter'].includes(e.key) && !sucModal.classList.contains('open')){
        const trs = [...sucTbody.querySelectorAll('tr')];
        if(!trs.length) return;
        let idx = trs.findIndex(tr=> tr.classList.contains('selected'));
        if(e.key==='ArrowDown') { idx = clamp(idx+1, 0, trs.length-1); trs[idx].focus(); selectSUCByCodigo(trs[idx].dataset.codigo); }
        if(e.key==='ArrowUp')   { idx = clamp(idx-1, 0, trs.length-1); trs[idx].focus(); selectSUCByCodigo(trs[idx].dataset.codigo); }
        if(e.key==='Enter' && idx>=0){ selectSUCByCodigo(trs[idx].dataset.codigo); }
      }
    });

    // INIT SUCURSALES (fetch -> storage -> seed)
    (async function initSUCs(){
      let data = await tryFetchSUCCSV();
      if(!data){
        const fromStorage = loadSUCFromStorage();
        if(fromStorage){ data = fromStorage; } else { data = sucSeed.slice(); }
      }
      sucRows = data;
      saveSUCToStorage(sucRows);
      renderSUCTable();
      sucSelectedIndex = Math.min(0, sucRows.length-1);
      if(sucRows[sucSelectedIndex]){ 
        selectSUCByCodigo(sucRows[sucSelectedIndex].codigo);
        initSUCMap();
      } else {
        // Map init delayed until there are rows
        document.getElementById('sucMapSkeleton').textContent = 'Sin datos';
      }
    })();
})();

    // ==================== CABECERAS: LÓGICA COMPLETA ====================
    const CAB_DB_KEY = "cabeceras-ui-v1";
    const cabSeed = [
      {codigo:"0101", nombre:"La Plata",       direccion:"Av. 7 925",       localidad:"La Plata",   supervisor:"J. Pérez",   telefono:"11-12348"},
      {codigo:"0102", nombre:"Nuevo León",     direccion:"Av. Queritaro",   localidad:"San Justo",  supervisor:"11-555-500", telefono:"11-12347"},
      {codigo:"0103", nombre:"Marnu'l",        direccion:"Av. Cadenas",     localidad:"Chicago",    supervisor:"11-1407-1111", telefono:"11-12344"},
      {codigo:"0104", nombre:"EsQundoz",       direccion:"Av. Ciesnes",     localidad:"Av. Aurle",  supervisor:"11-9983-1111", telefono:"11-12344"},
      {codigo:"0105", nombre:"San Isidro",     direccion:"San Fiornio",     localidad:"J.  Pérez",  supervisor:"11-7483-1111", telefono:"11-12346"},
      {codigo:"0106", nombre:"Quilmes",        direccion:"Av. Calchaquí",   localidad:"Quilmes",    supervisor:"M. Ruiz",     telefono:"11-23456"},
      {codigo:"0107", nombre:"Morón",          direccion:"Av. Rivadavia",   localidad:"Morón",      supervisor:"L. Gómez",    telefono:"11-34567"},
      {codigo:"0108", nombre:"Lomas",          direccion:"Av. Hipólito Y.", localidad:"Lomas",      supervisor:"C. López",    telefono:"11-22233"},
      {codigo:"0109", nombre:"Berazategui",    direccion:"C. 148",          localidad:"Bera",       supervisor:"F. Díaz",     telefono:"11-45566"},
      {codigo:"0110", nombre:"Tigre",          direccion:"Av. Cazón",       localidad:"Tigre",      supervisor:"S. Paz",      telefono:"11-99887"}
    ];

    function loadCABFromStorage(){
      try{ return JSON.parse(localStorage.getItem(CAB_DB_KEY)) ?? null; }
      catch(e){ return null; }
    }
    function saveCABToStorage(data){ localStorage.setItem(CAB_DB_KEY, JSON.stringify(data)); }

    function parseCSV_CAB(text){
      const lines = text.replace(/\\r/g,'').split('\\n').filter(Boolean);
      if(!lines.length) return [];
      const sep = (lines[0].includes(';') && !lines[0].includes(',')) ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
      const idx = {codigo: headers.indexOf('codigo'), nombre: headers.indexOf('nombre'), direccion: headers.indexOf('direccion'), localidad: headers.indexOf('localidad'), supervisor: headers.indexOf('supervisor'), telefono: headers.indexOf('telefono')};
      return lines.slice(1).map(row=>{
        const cells = []; let cur = '', inQ = false;
        for(let i=0; i<row.length; i++){
          const ch = row[i];
          if(ch==='\"'){ inQ = !inQ; continue; }
          if(ch===sep && !inQ){ cells.push(cur); cur=''; } else { cur+=ch; }
        }
        cells.push(cur);
        const get = (k)=> idx[k]>=0 ? (cells[idx[k]]??'').trim() : '';
        return {
          codigo: get('codigo'),
          nombre: get('nombre'),
          direccion: get('direccion'),
          localidad: get('localidad'),
          supervisor: get('supervisor'),
          telefono: get('telefono')
        };
      }).filter(r => r.codigo && r.nombre && r.direccion && r.localidad && r.telefono);
    }
    function exportCSV_CAB(rows){
      const hdr = ["codigo","nombre","direccion","localidad","supervisor","telefono"];
      const csv = [hdr.join(",")].concat(rows.map(r=> [
        r.codigo,
        `"${(r.nombre||'').replace(/"/g,'""')}"`,
        `"${(r.direccion||'').replace(/"/g,'""')}"`,
        `"${(r.localidad||'').replace(/"/g,'""')}"`,
        `"${(r.supervisor||'').replace(/"/g,'""')}"`,
        `"${(r.telefono||'').replace(/"/g,'""')}"`
      ].join(","))).join("\\n");
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href:url, download:"cabeceras.csv" });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast("CSV exportado");
    }
    async function tryFetchCABCSV(){
      try{
        const res = await fetch('cabeceras.csv', {cache:'no-store'});
        if(!res.ok) throw new Error('not ok');
        const text = await res.text();
        const data = parseCSV_CAB(text);
        if(data.length){ return data; }
      }catch(e){ }
      return null;
    }

    // Estado CABECERAS
    let cabRows = [];
    let cabSelectedCodigo = null;
    let cabSortBy = 'codigo';
    let cabSortDir = 1;
    let cabPage = 1;
    let cabPerPage = 8;

    // Refs CAB
    const cabTbody = document.getElementById('cabTbody');
    const cabCountEl = document.getElementById('cabCount');
    const cabQ = document.getElementById('cabQ');
    const cabClear = document.getElementById('cabClear');

    function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
    function highlightAny(text, q){ if(!q) return escapeHtml(text); const i = text.toLowerCase().indexOf(q); if(i<0) return escapeHtml(text); return escapeHtml(text.slice(0,i)) + '<mark style="background:rgba(47,187,107,.3);color:inherit;border-radius:4px;padding:0 2px">'+ escapeHtml(text.slice(i, i+q.length)) +'</mark>' + escapeHtml(text.slice(i+q.length)); }

    function filteredCAB(){
      const q = cabQ.value.trim().toLowerCase();
      return cabRows.filter(r => !q || Object.values(r).some(v => (''+v).toLowerCase().includes(q)));
    }
    function renderCABTable(){
      const arr = filteredCAB();
      cabCountEl.textContent = arr.length;

      // sort
      const sorted = [...arr].sort((a,b)=>{
        const A = (''+a[cabSortBy]).toLowerCase();
        const B = (''+b[cabSortBy]).toLowerCase();
        if(A<B) return -1*cabSortDir;
        if(A>B) return  1*cabSortDir;
        return 0;
      });

      // paginar
      const totalPages = Math.max(1, Math.ceil(sorted.length / cabPerPage));
      cabPage = Math.min(cabPage, totalPages);
      const start = (cabPage-1)*cabPerPage;
      const pageRows = sorted.slice(start, start+cabPerPage);

      // render filas
      const q = cabQ.value.trim().toLowerCase();
      cabTbody.innerHTML = pageRows.map(r => `
        <tr data-codigo="${escapeHtml(r.codigo)}" class="${r.codigo===cabSelectedCodigo?'selected':''}" tabindex="0">
          <td class="mono">${escapeHtml(r.codigo)}</td>
          <td>${highlightAny(r.nombre||'', q)}</td>
          <td>${highlightAny(r.direccion||'', q)}</td>
          <td>${highlightAny(r.localidad||'', q)}</td>
          <td>${highlightAny(r.supervisor||'', q)}</td>
          <td><div class="row-actions">
                <span class="mono">${escapeHtml(r.telefono||'')}</span>
              </div>
          </td>
        </tr>
      `).join('');

      // bind events
      [...cabTbody.querySelectorAll('tr')].forEach(tr=>{
        tr.addEventListener('click', (ev)=>{ cabSelectByCodigo(tr.dataset.codigo); ripple(ev); });
        tr.addEventListener('keydown', (ev)=>{ if(ev.key==="Enter"){ cabSelectByCodigo(tr.dataset.codigo); } });
      });

      // update pager buttons
      document.getElementById('cabFirst').disabled = cabPage===1;
      document.getElementById('cabPrev').disabled  = cabPage===1;
      document.getElementById('cabNext').disabled  = cabPage===totalPages;
      document.getElementById('cabLast').disabled  = cabPage===totalPages;
    }

    function cabSelectByCodigo(codigo){
      cabSelectedCodigo = codigo;
      [...cabTbody.querySelectorAll('tr')].forEach(tr=> tr.classList.toggle('selected', tr.dataset.codigo===codigo));
    }

    // Sort handlers
    document.querySelectorAll('#cabTable th[data-sort]').forEach(th=>{
      th.addEventListener('click', ()=>{
        const key = th.getAttribute('data-sort');
        if(cabSortBy===key) cabSortDir *= -1; else { cabSortBy = key; cabSortDir = 1; }
        renderCABTable();
      });
    });

    // Pager handlers
    document.getElementById('cabFirst').addEventListener('click', ()=>{ cabPage=1; renderCABTable(); });
    document.getElementById('cabPrev').addEventListener('click', ()=>{ cabPage=Math.max(1, cabPage-1); renderCABTable(); });
    document.getElementById('cabNext').addEventListener('click', ()=>{ cabPage=cabPage+1; renderCABTable(); });
    document.getElementById('cabLast').addEventListener('click', ()=>{
      const totalPages = Math.max(1, Math.ceil(filteredCAB().length / cabPerPage));
      cabPage=totalPages; renderCABTable();
    });

    // Search & controls
    cabQ.addEventListener('input', ()=>{ cabPage=1; renderCABTable(); });
    document.getElementById('cabClear').onclick = ()=>{ cabQ.value=''; cabQ.focus(); cabPage=1; renderCABTable(); };

    // CRUD cabeceras (modal)
    const cabModal = document.getElementById('cabModal');
    const cabSheetTitle = document.getElementById('cabSheetTitle');
    const cabCodigo = document.getElementById('cabCodigo');
    const cabNombre = document.getElementById('cabNombre');
    const cabDireccion = document.getElementById('cabDireccion');
    const cabLocalidad = document.getElementById('cabLocalidad');
    const cabSupervisor = document.getElementById('cabSupervisor');
    const cabTelefono = document.getElementById('cabTelefono');

    let cabEditingExisting = true;
    function openCABModal(mode="edit"){
      cabEditingExisting = (mode==="edit");
      cabSheetTitle.textContent = cabEditingExisting ? "Editar cabecera" : "Nueva cabecera";
      const r = cabRows.find(x=> x.codigo===cabSelectedCodigo) || {codigo:"",nombre:"",direccion:"",localidad:"",supervisor:"",telefono:""};
      cabCodigo.value = cabEditingExisting ? r.codigo : "";
      cabNombre.value = cabEditingExisting ? r.nombre : "";
      cabDireccion.value = cabEditingExisting ? r.direccion : "";
      cabLocalidad.value = cabEditingExisting ? r.localidad : "";
      cabSupervisor.value = cabEditingExisting ? r.supervisor : "";
      cabTelefono.value = cabEditingExisting ? r.telefono : "";
      cabModal.classList.add('open');
      cabCodigo.focus();
    }
    function closeCABModal(){ cabModal.classList.remove('open'); }
    function saveCABModal(){
      const data = {
        codigo: cabCodigo.value.trim(),
        nombre: cabNombre.value.trim(),
        direccion: cabDireccion.value.trim(),
        localidad: cabLocalidad.value.trim(),
        supervisor: cabSupervisor.value.trim(),
        telefono: cabTelefono.value.trim()
      };
      const ok = /^\\d{3,5}$/.test(data.codigo) && data.nombre && data.direccion && data.localidad && data.telefono;
      if(!ok){ showToast("Completá los campos correctamente"); return; }
      const existingIdx = cabRows.findIndex(r=> r.codigo===data.codigo);
      if(cabEditingExisting){
        const selIdx = cabRows.findIndex(r=> r.codigo===cabSelectedCodigo);
        if(existingIdx>=0 && existingIdx!==selIdx){ showToast("Código ya existente"); return; }
        if(selIdx>=0) cabRows[selIdx] = data;
      }else{
        if(existingIdx>=0){ showToast("Código ya existente"); return; }
        cabRows.push(data);
        cabSelectedCodigo = data.codigo;
      }
      saveCABToStorage(cabRows);
      renderCABTable();
      cabSelectByCodigo(data.codigo);
      showToast("Guardado");
      closeCABModal();
    }
    // Duplicar / Eliminar
    function cabNextCode(){
      const nums = cabRows.map(r=> parseInt(r.codigo, 10)).filter(n=> !isNaN(n));
      const next = (nums.length? Math.max(...nums)+1 : 101);
      return String(next).padStart(4,'0');
    }

    document.getElementById('cabNew').onclick = ()=> openCABModal('new');
    document.getElementById('cabEdit').onclick = ()=> {
      if(!cabSelectedCodigo){ showToast("Seleccioná una fila"); return;}
      openCABModal('edit');
    };
    document.getElementById('cabDuplicate').onclick = ()=>{
      const s = cabRows.find(r=> r.codigo===cabSelectedCodigo); if(!s) return showToast("Seleccioná una fila");
      const dup = {...s, codigo: cabNextCode(), nombre: (s.nombre||'') + " (copiado)"};
      cabRows.push(dup); saveCABToStorage(cabRows); renderCABTable(); cabSelectByCodigo(dup.codigo); showToast("Duplicado");
    };
    document.getElementById('cabDelete').onclick = ()=>{
      const idx = cabRows.findIndex(r=> r.codigo===cabSelectedCodigo);
      if(idx<0) return showToast("Seleccioná una fila");
      const s = cabRows[idx];
      if(confirm(`¿Eliminar ${s.nombre} (${s.codigo})?`)){
        cabRows.splice(idx,1); saveCABToStorage(cabRows);
        cabSelectedCodigo = null;
        renderCABTable();
        showToast("Eliminado");
      }
    };
    document.getElementById('cabModal').addEventListener('click', (e)=>{ if(e.target.id==='cabModal') closeCABModal(); });
    document.getElementById('cabCloseModal').onclick = closeCABModal;
    document.getElementById('cabCancelModal').onclick = closeCABModal;
    document.getElementById('cabSaveModal').onclick = saveCABModal;

    // Import/Export
    const cabImportInput = document.getElementById('cabImportInput');
    function importCABFromFile(file){
      const reader = new FileReader();
      reader.onload = (ev)=>{
        try{
          const text = ev.target.result;
          const arr = parseCSV_CAB(text);
          if(!arr.length) return showToast('CSV vacío o inválido');
          cabRows = arr; saveCABToStorage(cabRows);
          cabSelectedCodigo = (cabRows[0]||{}).codigo || null;
          cabPage=1; renderCABTable(); cabSelectedCodigo && cabSelectByCodigo(cabSelectedCodigo);
          showToast('CSV importado');
        }catch(e){ showToast('No se pudo importar'); }
      };
      reader.readAsText(file);
    }
    document.getElementById('cabImport').onclick = ()=> cabImportInput.click();
    cabImportInput.addEventListener('change', (ev)=>{ const f = ev.target.files?.[0]; if(f) importCABFromFile(f); ev.target.value=''; });
    document.getElementById('cabExport').onclick = ()=> exportCSV_CAB(cabRows);

    // Atajos teclado en sección Cabeceras
    document.addEventListener('keydown', (e)=>{
      const visible = !document.getElementById('cabSection').classList.contains('hidden');
      if(!visible) return;
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='/'){ e.preventDefault(); cabQ.focus(); cabQ.select(); }
      if(e.key==='Escape'){ if(document.activeElement===cabQ){ cabQ.value=''; cabPage=1; renderCABTable(); } }
      if(e.key==='n' && !e.ctrlKey && !e.metaKey){ openCABModal('new'); }
      if(['ArrowDown','ArrowUp','Enter'].includes(e.key) && !cabModal.classList.contains('open')){
        const trs = [...cabTbody.querySelectorAll('tr')]; if(!trs.length) return;
        let idx = trs.findIndex(tr=> tr.classList.contains('selected'));
        if(e.key==='ArrowDown') { idx = Math.min(idx+1, trs.length-1); cabSelectByCodigo(trs[idx].dataset.codigo); trs[idx].focus(); }
        if(e.key==='ArrowUp')   { idx = Math.max(idx-1, 0); cabSelectByCodigo(trs[idx].dataset.codigo); trs[idx].focus(); }
        if(e.key==='Enter' && idx>=0){ cabSelectByCodigo(trs[idx].dataset.codigo); }
      }
    });

    // INIT CABECERAS (fetch -> storage -> seed)
    (async function initCAB(){
      let data = await tryFetchCABCSV();
      if(!data){
        const fromStorage = loadCABFromStorage();
        if(fromStorage){ data = fromStorage; } else { data = cabSeed.slice(); }
      }
      cabRows = data;
      saveCABToStorage(cabRows);
      cabSelectedCodigo = (cabRows[0]||{}).codigo || null;
      renderCABTable();
      cabSelectedCodigo && cabSelectByCodigo(cabSelectedCodigo);
    })();
  
})();

(function(){

  (function(){
    const tilesEl = document.getElementById('repTiles');
    const drawer = document.getElementById('repDrawer');
    const formEl = document.getElementById('repForm');
    const titleEl = document.getElementById('repTitle');

    if(!tilesEl || !drawer || !formEl) return;

    const reports = [
      { id:'evolucion', label:'Evolución de Indicadores', icon:`<path d="M4 19h16v1H4zm2-4 4-4 3 3 5-6 1.5 1.2L13 16l-3-3-3.5 3.5z"/>`,
        fields:[
          {name:'desde', type:'date', label:'Desde', col:2, value:'2024-01-01'},
          {name:'hasta', type:'date', label:'Hasta', col:2, value:'2024-01-31'},
          {name:'indicador', type:'select', label:'Indicador', col:2, options:['Montos','Entregas Exitosas','Entregas Fallidas']},
          {name:'frecuencia', type:'select', label:'Frecuencia', col:2, options:['Diario','Semanal','Mensual']},
          {name:'etv', type:'switch', label:'Mostrar Ingresos ETV', col:3},
          {name:'formato', type:'select', label:'Formato', col:1, options:['CSV','XLSX']}
        ]
      },
      { id:'historia', label:'Historia', icon:`<path d="M4 5h16v4H4zM4 11h10v4H4zM4 17h8v2H4z"/>`,
        fields:[
          {name:'desde', type:'date', label:'Desde', col:2, value:'2024-01-01'},
          {name:'hasta', type:'date', label:'Hasta', col:2, value:'2024-01-31'},
          {name:'tipo', type:'select', label:'Tipo', col:2, options:['Principal','Secundario','Consolidado']},
          {name:'codigo', type:'text',  label:'Código', col:2, placeholder:'Cód. ruta'},
          {name:'cabecera', type:'text', label:'Cabecera de Origen', col:2, placeholder:'Ej. La Plata'}
        ]
      },
      { id:'rutas', label:'Rutas', icon:`<path d="M5 19c5 0 4-14 9-14h5v3h-5c-3 0-2 8-9 8v3z"/>`,
        fields:[
          {name:'desde', type:'date', label:'Desde', col:2, value:'2024-01-01'},
          {name:'hasta', type:'date', label:'Hasta', col:2, value:'2024-01-31'},
          {name:'estado', type:'select', label:'Estado', col:2, options:['Todas','Exitosas','Fallidas']},
          {name:'camion', type:'text', label:'Camión', col:2},
          {name:'chofer', type:'text', label:'Chofer', col:2},
          {name:'cabecera', type:'text', label:'Cabecera', col:2}
        ]
      },
      { id:'viajes', label:'Viajes Realizados', icon:`<path d="M10 17 6 13l1.4-1.4L10 14.2l6.6-6.6L18 9z"/>`,
        fields:[
          {name:'desde', type:'date', label:'Desde', col:2, value:'2024-01-01'},
          {name:'hasta', type:'date', label:'Hasta', col:2, value:'2024-01-31'},
          {name:'camion', type:'text', label:'Camión', col:2},
          {name:'chofer', type:'text', label:'Chofer', col:2},
          {name:'cabecera', type:'text', label:'Cabecera', col:2}
        ]
      },
      { id:'montos', label:'Histórico de Montos Transportados', icon:`<path d="M12 3a5 5 0 0 0-5 5h3a2 2 0 0 1 4 0c0 2-6 1.5-6 6a5 5 0 0 0 10 0h-3a2 2 0 0 1-4 0c0-2 6-1.5 6-6a5 5 0 0 0-5-5z"/>`,
        fields:[
          {name:'desde', type:'date', label:'Desde', col:2, value:'2024-01-01'},
          {name:'hasta', type:'date', label:'Hasta', col:2, value:'2024-01-31'},
          {name:'agrupacion', type:'select', label:'Agrupar por', col:2, options:['Día','Semana','Mes','Cabecera']},
          {name:'cabecera', type:'text', label:'Cabecera', col:2},
          {name:'etv', type:'switch', label:'Mostrar Ingresos ETV', col:3}
        ]
      },
      { id:'por_sucursal', label:'Por Sucursal', icon:`<path d="M3 4h18v4H3zM5 10h6v10H5zM13 10h6v6h-6z"/>`,
        fields:[
          {name:'desde', type:'date', label:'Desde', col:2, value:'2024-01-01'},
          {name:'hasta', type:'date', label:'Hasta', col:2, value:'2024-01-31'},
          {name:'sucursal', type:'text', label:'Sucursal', col:3, placeholder:'Nombre o código'},
          {name:'cabecera', type:'text', label:'Cabecera', col:3}
        ]
      },
      { id:'por_chofer', label:'Por Chofer', icon:`<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 9a7 7 0 0 1 14 0z"/>`,
        fields:[
          {name:'desde', type:'date', label:'Desde', col:2, value:'2024-01-01'},
          {name:'hasta', type:'date', label:'Hasta', col:2, value:'2024-01-31'},
          {name:'chofer', type:'text', label:'Chofer', col:2},
          {name:'cabecera', type:'text', label:'Cabecera', col:2}
        ]
      },
      { id:'por_camion', label:'Por Camión', icon:`<path d="M2 16V8h11v8H2zm11-5h3l3 3v2h-6v-5zM5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>`,
        fields:[
          {name:'desde', type:'date', label:'Desde', col:2, value:'2024-01-01'},
          {name:'hasta', type:'date', label:'Hasta', col:2, value:'2024-01-31'},
          {name:'camion', type:'text', label:'Camión', col:3},
          {name:'cabecera', type:'text', label:'Cabecera', col:3}
        ]
      },
      { id:'por_atm', label:'Por ATM', icon:`<path d="M3 5h18v14H3zM6 8h12v3H6zM8 13h8v2H8z"/>`,
        fields:[
          {name:'desde', type:'date', label:'Desde', col:2, value:'2024-01-01'},
          {name:'hasta', type:'date', label:'Hasta', col:2, value:'2024-01-31'},
          {name:'atm', type:'text', label:'ATM', col:3, placeholder:'Código o nombre'},
          {name:'cabecera', type:'text', label:'Cabecera', col:3}
        ]
      }
    ];

    let selected = null;

    function el(tag, attrs={}, html=''){
      const e = document.createElement(tag);
      Object.entries(attrs).forEach(([k,v])=>{
        if(k==='class') e.className = v;
        else if(k==='dataset') Object.entries(v).forEach(([dk,dv])=> e.dataset[dk]=dv);
        else if(k==='style') e.setAttribute('style', v);
        else e.setAttribute(k, v);
      });
      if(html!==undefined) e.innerHTML = html;
      return e;
    }

    // Build tiles
    reports.forEach((r,i)=>{
      const btn = el('button', {class:'rep-tile', 'aria-pressed':'false', dataset:{rid:r.id}},
        `<div class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">${r.icon}</svg></div>
         <div class="label">${r.label}</div>
         <div class="rep-small">#${i+1}</div>`);
      btn.addEventListener('click', (ev)=>{ selectReport(r.id); ev.currentTarget.blur(); });
      tilesEl.appendChild(btn);
    });

    function selectReport(id){
      selected = reports.find(x=> x.id===id) || null;
      [...tilesEl.querySelectorAll('.rep-tile')].forEach(b=> b.classList.toggle('selected', b.dataset.rid===id));
      if(!selected){ closeDrawer(); return; }
      titleEl.textContent = selected.label;
      buildForm(selected);
      openDrawer();
    }

    function openDrawer(){ drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); }
    function closeDrawer(){ drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }

    document.getElementById('repCollapse')?.addEventListener('click', closeDrawer);
    document.getElementById('repReset')?.addEventListener('click', ()=>{ if(selected) buildForm(selected, true); });

    function buildForm(rep, reset=false){
      formEl.innerHTML='';
      (rep.fields||[]).forEach(f=>{
        const wrap = el('div', {class:'field', dataset:{col: String(f.col||1)}});
        if(f.type!=='switch'){
          const id = 'rep_'+f.name;
          wrap.innerHTML = `<label for="${id}">${f.label||''}</label>`;
          if(f.type==='date' || f.type==='text'){
            const inp = el('input', {id, type: f.type==='date'?'date':'text', placeholder:f.placeholder||'', value: reset? (f.value||'') : (document.getElementById(id)?.value || f.value || '')});
            if(f.type==='date' && !inp.value) inp.value = f.value || '';
            wrap.appendChild(inp);
          }else if(f.type==='select'){
            const sel = el('select', {id});
            (f.options||[]).forEach(opt=>{
              const o = el('option', {}, opt); sel.appendChild(o);
            });
            if(!reset && document.getElementById(id)) sel.value = document.getElementById(id).value;
            wrap.appendChild(sel);
          }
        }else{
          // toggle
          const id = 'rep_'+f.name;
          wrap.dataset.col = String(f.col || 2);
          const label = el('label', {class:'toggle', for:id});
          const sw = el('div', {class:'switch', id, role:'switch', tabindex:'0', 'aria-checked':'false'});
          sw.innerHTML = '<div class="knob"></div>';
          const txt = el('span', {}, f.label||'');
          label.appendChild(sw); label.appendChild(txt);
          label.addEventListener('click', ()=> toggleSwitch(sw));
          label.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggleSwitch(sw); } });
          wrap.appendChild(el('div', {}, '<label style="opacity:.0">_</label>')); // align
          wrap.appendChild(label);
        }
        formEl.appendChild(wrap);
      });
    }

    function toggleSwitch(sw){
      const on = !sw.classList.contains('on');
      sw.classList.toggle('on', on);
      sw.setAttribute('aria-checked', on? 'true':'false');
      if(typeof showToast==='function'){ showToast((on?'Activado: ':'Desactivado: ') + (sw.id||'').replace('rep_','')); }
    }

    function getFilters(){
      if(!selected) return {};
      const out = { reporte: selected.label, id: selected.id };
      (selected.fields||[]).forEach(f=>{
        if(f.type==='switch'){
          const sw = document.getElementById('rep_'+f.name);
          out[f.name] = !!sw?.classList.contains('on');
        }else{
          const el = document.getElementById('rep_'+f.name);
          out[f.name] = el ? el.value : null;
        }
      });
      return out;
    }

    function parseDate(s){ const d = new Date(s||''); return isNaN(d.getTime())? null : d; }
    function daysBetween(a,b){ const ms = (b-a); return Math.max(1, Math.round(ms/86400000)); }

    function buildDataset(id, f){
      // returns { columns:[], rows:[], chart?:{labels:[],data:[],type} }
      const ds = { columns:[], rows:[] };
      const desde = parseDate(f.desde) || new Date();
      const hasta = parseDate(f.hasta) || new Date();
      const n = Math.min(60, daysBetween(desde, hasta));
      const fmt = d=> d.toISOString().slice(0,10);

      function pushRow(row){ ds.rows.push(row); }
      function rnd(min, max){ return Math.round(min + Math.random()*(max-min)); }

      if(id==='evolucion'){
        ds.columns = ['Fecha','Indicador','ETV','Valor'];
        const labels=[], data=[];
        for(let i=0;i<n;i++){
          const d = new Date(desde.getTime()+i*86400000);
          const v = rnd(10, 100);
          labels.push(fmt(d)); data.push(v);
          pushRow([fmt(d), f.indicador, f.etv?'Sí':'No', v]);
        }
        ds.chart = { type:'line', labels, data, label: f.indicador || 'Serie' };
      }else if(id==='montos'){
        ds.columns = ['Fecha','Cabecera','ETV','Monto (M)'];
        const labels=[], data=[];
        for(let i=0;i<n;i++){
          const d = new Date(desde.getTime()+i*86400000);
          const v = (rnd(8, 45)/10);
          labels.push(fmt(d)); data.push(v);
          pushRow([fmt(d), (f.cabecera||'General'), f.etv?'Sí':'No', v.toFixed(1).replace('.',',')]);
        }
        ds.chart = { type:'bar', labels, data, label:'Montos (M)' };
      }else if(id==='historia'){
        ds.columns = ['Fecha','Tipo','Código','Origen','Depósito','ATM/Sucursal','ETV','Monto'];
        for(let i=0;i<Math.min(30,n+5);i++){
          const d = new Date(desde.getTime()+i*86400000);
          pushRow([fmt(d), f.tipo||'Principal', f.codigo||('C'+(1000+i)), f.cabecera||'Cabecera A', 'Depósito 01', 'ATM '+(100+i), f.etv?'Sí':'No', rnd(10000, 250000).toLocaleString('es-AR') ]);
        }
      }else if(id==='rutas'){
        ds.columns = ['Fecha','Ruta','Estado','Camión','Chofer','Cabecera','Km','Horas'];
        for(let i=0;i<Math.min(30,n+5);i++){
          const d = new Date(desde.getTime()+i*86400000);
          pushRow([fmt(d), 'R-'+(200+i), f.estado||'Todas', f.camion||'101', f.chofer||'Pérez', f.cabecera||'La Plata', rnd(50,800), (rnd(4,26)+'.'+rnd(0,9)) ]);
        }
      }else if(id==='viajes'){
        ds.columns = ['Fecha','Viaje','Camión','Chofer','Cabecera','Paradas','Km'];
        for(let i=0;i<Math.min(30,n+5);i++){
          const d = new Date(desde.getTime()+i*86400000);
          pushRow([fmt(d), 'V-'+(1200+i), f.camion||'102', f.chofer||'Gómez', f.cabecera||'Quilmes', rnd(3,18), rnd(40,950) ]);
        }
      }else if(id==='por_sucursal'){
        ds.columns = ['Fecha','Sucursal','Cabecera','Operaciones','Monto (M)'];
        for(let i=0;i<Math.min(20,n);i++){
          const d = new Date(desde.getTime()+i*86400000);
          pushRow([fmt(d), f.sucursal||('SUC '+(i+1)), f.cabecera||'Mar del Plata', rnd(2,20), (rnd(10,80)/10).toFixed(1).replace('.',',') ]);
        }
      }else if(id==='por_chofer'){
        ds.columns = ['Fecha','Chofer','Viajes','Km','Horas'];
        for(let i=0;i<Math.min(20,n);i++){
          const d = new Date(desde.getTime()+i*86400000);
          pushRow([fmt(d), f.chofer||'Sin asignar', rnd(1,5), rnd(50,700), rnd(4,24) ]);
        }
      }else if(id==='por_camion'){
        ds.columns = ['Fecha','Camión','Viajes','Paradas','Km'];
        for(let i=0;i<Math.min(20,n);i++){
          const d = new Date(desde.getTime()+i*86400000);
          pushRow([fmt(d), f.camion||'101', rnd(1,4), rnd(4,22), rnd(40,750) ]);
        }
      }else if(id==='por_atm'){
        ds.columns = ['Fecha','ATM','Cabecera','Operaciones','Monto'];
        for(let i=0;i<Math.min(20,n);i++){
          const d = new Date(desde.getTime()+i*86400000);
          pushRow([fmt(d), f.atm||('500'+(10+i)), f.cabecera||'Bahía Blanca', rnd(10,90), rnd(15000,220000).toLocaleString('es-AR') ]);
        }
      }else{
        ds.columns = ['Mensaje']; pushRow(['Seleccione un reporte']);
      }
      return ds;
    }

    function datasetToCSV(ds){
      const rows = [ds.columns].concat(ds.rows);
      return rows.map(r=> r.map(cell=> {
        const s = String(cell);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
      }).join(',')).join('\\n');
    }

    function downloadCSV(ds, name='reporte.csv'){
      const csv = datasetToCSV(ds);
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href:url, download:name });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      if(typeof showToast==='function') showToast('CSV exportado');
    }

    function doPrint(){
      if(typeof showToast==='function') showToast('Abriendo cuadro de impresión…');
      setTimeout(()=> window.print(), 300);
    }

    // Actions
    document.getElementById('repExportCSV')?.addEventListener('click', ()=>{
      if(!selected) return showToast('Elegí un reporte');
      const ds = buildDataset(selected.id, getFilters());
      const f = getFilters();
      const name = (f.id||'reporte') + '_' + (f.desde||'') + '_' + (f.hasta||'') + '.csv';
      downloadCSV(ds, name);
    });
    document.getElementById('repExportPDF')?.addEventListener('click', ()=> doPrint() );
    document.getElementById('repPreview')?.addEventListener('click', ()=> openPreview());

    function openPreview(){
      if(!selected) return showToast('Elegí un reporte');
      const f = getFilters();
      const ds = buildDataset(selected.id, f);

      const modal = document.getElementById('reportModal');
      const body  = document.getElementById('reportModalBody');
      const title = document.getElementById('reportModalTitle');
      title.textContent = 'Vista previa · ' + (selected.label||'');

      // Build content
      body.innerHTML = '';
      // Chart (opcionales)
      if(ds.chart && window.Chart){
        const wrap = document.createElement('div');
        wrap.className = 'card';
        wrap.style.padding = '12px';
        const cvs = document.createElement('canvas');
        cvs.id = 'repChartCanvas';
        cvs.height = 160;
        wrap.appendChild(cvs);
        body.appendChild(wrap);

        const ctx = cvs.getContext('2d');
        const text = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#6b7a8c';
        const grid = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#ebeff3';
        const isBar = ds.chart.type==='bar';
        const grad = ctx.createLinearGradient(0,0,0,160);
        grad.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--chart-accent-soft') || 'rgba(67,164,109,.18)');
        grad.addColorStop(1,'rgba(0,0,0,0)');
        new Chart(ctx, {
          type: isBar? 'bar':'line',
          data: { labels: ds.chart.labels, datasets: [{
            label: ds.chart.label || 'Serie', data: ds.chart.data,
            borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-accent-2') || '#3b9562',
            backgroundColor: isBar ? (getComputedStyle(document.documentElement).getPropertyValue('--chart-accent') || 'rgba(67,164,109,.85)') : grad,
            borderWidth: isBar? 0: 2, pointBackgroundColor:'#fff', pointBorderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-accent-2') || '#3b9562', pointBorderWidth:2, pointRadius:3, tension:.35, fill: !isBar
          }]},
          options: {
            plugins:{ legend:{display:false} },
            scales: {
              x: { grid:{ display:false }, ticks:{ color:text } },
              y: { grid:{ color:grid, borderColor:grid, drawTicks:false }, ticks:{ color:text } }
            }
          }
        });
      }

      // Table
      const tableCard = document.createElement('section');
      tableCard.className = 'table card';
      tableCard.innerHTML = `<header><h3>Datos (${ds.rows.length})</h3></header>`;
      const tb = document.createElement('div');
      tb.className = 'body';
      const tbl = document.createElement('table');
      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      ds.columns.forEach(c=>{
        const th = document.createElement('th'); th.textContent = c; trh.appendChild(th);
      }); thead.appendChild(trh); tbl.appendChild(thead);
      const tbody = document.createElement('tbody');
      ds.rows.forEach(r=>{
        const tr = document.createElement('tr');
        r.forEach(cell=>{ const td = document.createElement('td'); td.textContent = cell; tr.appendChild(td); });
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      tb.appendChild(tbl);
      tableCard.appendChild(tb);
      body.appendChild(tableCard);

      modal.classList.add('open');
    }

    function closePreview(){ document.getElementById('reportModal').classList.remove('open'); }
    document.getElementById('reportCloseModal')?.addEventListener('click', closePreview);
    document.getElementById('reportModalClose')?.addEventListener('click', closePreview);
    document.getElementById('reportModal').addEventListener('click', (e)=>{ if(e.target.id==='reportModal') closePreview(); });

    document.getElementById('reportModalCSV')?.addEventListener('click', ()=>{
      if(!selected) return;
      const ds = buildDataset(selected.id, getFilters());
      const name = (selected.id||'reporte') + '_' + (getFilters().desde||'') + '_' + (getFilters().hasta||'') + '.csv';
      downloadCSV(ds, name);
    });
    document.getElementById('reportModalPDF')?.addEventListener('click', ()=> doPrint() );

    // Keyboard: 1..9 selects report, Esc closes preview, F focuses filters
    document.addEventListener('keydown', (e)=>{
      const visible = !document.getElementById('reportesSection').classList.contains('hidden');
      if(!visible) return;
      if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
      const modal = document.getElementById('reportModal');
      if(e.key === 'Escape' && modal.classList.contains('open')){ e.preventDefault(); closePreview(); return; }
      const n = parseInt(e.key,10);
      if(n>=1 && n<=9){ e.preventDefault(); const r = reports[n-1]; if(r) selectReport(r.id); }
      if(e.key.toLowerCase()==='f'){ e.preventDefault(); const first = formEl.querySelector('input,select,button'); first && first.focus(); }
    });

  })();
  
})();

(function(){

// ===== Sincronización de COSTOS con cfg (persistencia v8) =====
(function(){
  const root = document.getElementById('costosSection');
  if(!root || !window.save || typeof cfg === 'undefined') return;
  const fmtN = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Estructura por defecto
  cfg.costs = Object.assign({
    atm: { propios:{ stop:750, km_caba:50, km_amba:55 }, etv:{ stop:900, km_caba:60, km_amba:65 } },
    suc: { propios:{ stop:600, km_caba:48, km_amba:52 }, etv:{ stop:760, km_caba:58, km_amba:62 } },
    cab: {} // { '1550 - Mar del Plata': { atms:0, sucursales:0 } }
  }, cfg.costs || {});
  save(DB.cfg, cfg);

  function toNumber(v){
    if(v==null) return 0;
    const s = String(v).replace(/\s/g,'').replace(/\./g,'').replace(',', '.').replace(/[^\d.\-]/g,'');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  function setVal(inp, n){
    if(!inp) return;
    inp.value = fmtN.format(+n || 0);
    // trigger visual validation
    const wrap = inp.closest('.c-input'); if(wrap) wrap.classList.add('valid');
  }

  function panelByTitle(tabSel, title){
    const panels = Array.from(root.querySelectorAll(tabSel+' .panel'));
    return panels.find(p => (p.querySelector('h3')?.textContent || '').toLowerCase().includes(title.toLowerCase()));
  }
  function rowsToInputs(panel){
    if(!panel) return {};
    const rows = Array.from(panel.querySelectorAll('.c-row'));
    return {
      stop: rows[0]?.querySelector('input'),
      km_caba: rows[1]?.querySelector('input'),
      km_amba: rows[2]?.querySelector('input')
    };
  }

  // Mapear inputs en pestaña ATMs
  const atmsProp = rowsToInputs(panelByTitle('#c-tab-atms','Medios Propios'));
  const atmsETV  = rowsToInputs(panelByTitle('#c-tab-atms','ETV'));

  // Mapear inputs en pestaña Sucursales
  const sucProp  = rowsToInputs(panelByTitle('#c-tab-suc','Medios Propios'));
  const sucETV   = rowsToInputs(panelByTitle('#c-tab-suc','ETV'));

  // Inicializar con cfg
  setVal(atmsProp.stop, cfg.costs.atm.propios.stop);
  setVal(atmsProp.km_caba, cfg.costs.atm.propios.km_caba);
  setVal(atmsProp.km_amba, cfg.costs.atm.propios.km_amba);

  setVal(atmsETV.stop, cfg.costs.atm.etv.stop);
  setVal(atmsETV.km_caba, cfg.costs.atm.etv.km_caba);
  setVal(atmsETV.km_amba, cfg.costs.atm.etv.km_amba);

  setVal(sucProp.stop, cfg.costs.suc.propios.stop);
  setVal(sucProp.km_caba, cfg.costs.suc.propios.km_caba);
  setVal(sucProp.km_amba, cfg.costs.suc.propios.km_amba);

  setVal(sucETV.stop, cfg.costs.suc.etv.stop);
  setVal(sucETV.km_caba, cfg.costs.suc.etv.km_caba);
  setVal(sucETV.km_amba, cfg.costs.suc.etv.km_amba);

  function onChangeCost(path, ev){
    const n = toNumber(ev.target.value);
    // Navegar y asignar: path ej 'costs.atm.propios.stop'
    const keys = path.split('.');
    let obj = cfg;
    for(let i=0; i<keys.length-1; i++){ obj = obj[keys[i]] = (obj[keys[i]] ?? {}); }
    obj[keys[keys.length-1]] = n;
    save(DB.cfg, cfg);
  }

  atmsProp.stop?.addEventListener('input', onChangeCost.bind(null,'costs.atm.propios.stop'));
  atmsProp.km_caba?.addEventListener('input', onChangeCost.bind(null,'costs.atm.propios.km_caba'));
  atmsProp.km_amba?.addEventListener('input', onChangeCost.bind(null,'costs.atm.propios.km_amba'));

  atmsETV.stop?.addEventListener('input', onChangeCost.bind(null,'costs.atm.etv.stop'));
  atmsETV.km_caba?.addEventListener('input', onChangeCost.bind(null,'costs.atm.etv.km_caba'));
  atmsETV.km_amba?.addEventListener('input', onChangeCost.bind(null,'costs.atm.etv.km_amba'));

  sucProp.stop?.addEventListener('input', onChangeCost.bind(null,'costs.suc.propios.stop'));
  sucProp.km_caba?.addEventListener('input', onChangeCost.bind(null,'costs.suc.propios.km_caba'));
  sucProp.km_amba?.addEventListener('input', onChangeCost.bind(null,'costs.suc.propios.km_amba'));

  sucETV.stop?.addEventListener('input', onChangeCost.bind(null,'costs.suc.etv.stop'));
  sucETV.km_caba?.addEventListener('input', onChangeCost.bind(null,'costs.suc.etv.km_caba'));
  sucETV.km_amba?.addEventListener('input', onChangeCost.bind(null,'costs.suc.etv.km_amba'));

  // Tabla Cabeceras
  const cabTable = root.querySelector('#c-table');
  function hydrateCab(){
    if(!cabTable) return;
    Array.from(cabTable.querySelectorAll('.c-row')).forEach(row=>{
      const nameEl = row.querySelector('.name'); 
      const name = nameEl ? nameEl.textContent.trim() : '';
      if(!name) return;
      const atmInp = row.children[1]?.querySelector('input');
      const sucInp = row.children[2]?.querySelector('input');
      const conf = (cfg.costs.cab[name] ||= { atms:0, sucursales:0 });
      setVal(atmInp, conf.atms);
      setVal(sucInp, conf.sucursales);
    });
  }
  function onCabInput(ev){
    const row = ev.target.closest('.c-row'); if(!row) return;
    const name = row.querySelector('.name')?.textContent.trim() || '';
    if(!name) return;
    const idx = Array.from(row.children).indexOf(ev.target.closest('[role="cell"]'));
    const key = (idx===1)? 'atms' : 'sucursales';
    const conf = (cfg.costs.cab[name] ||= { atms:0, sucursales:0 });
    conf[key] = toNumber(ev.target.value);
    save(DB.cfg, cfg);
  }
  cabTable?.addEventListener('input', (ev)=>{
    if(ev.target && ev.target.tagName==='INPUT') onCabInput(ev);
  });

  // Inicializar tabla con cfg
  hydrateCab();

  // Exponer hook de "on show" para reposicionar barra activa y rehidratar
  window.costosOnShow = (function(prev){
    return function(){
      try{ if(prev) prev(); }catch(e){}
      hydrateCab();
    };
  })(window.costosOnShow);

})();

(function(){
  window.reportesOnShow = (function(prev){
    return function(){
      try{ if(prev) prev(); }catch(e){}
      // for Chart.js autoresize when shown
      try{
        const canvases = document.querySelectorAll('#reportesSection canvas');
        canvases.forEach(cv=>{
          const ctx = cv.getContext('2d');
          // trigger a simple resize by assigning width = width
          cv.width = cv.width;
        });
      }catch(e){}
    };
  })(window.reportesOnShow);
})();
})();
