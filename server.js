const express = require('express');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Data stores
const sucursales = [
  { id: 1, nombre: 'Sucursal Centro', direccion: 'Av. Principal 123' },
  { id: 2, nombre: 'Sucursal Norte', direccion: 'Calle Secundaria 456' }
];
const orders = [];
const importReports = [];
const routes = [];
const stops = [];
const nextId = arr => arr.length ? Math.max(...arr.map(o => o.id)) + 1 : 1;

// Main HTML entry
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Sucursales API
app.get('/sucursales', (req, res) => {
  res.json(sucursales);
});

// CRUD de órdenes
app.get('/ordenes', (req, res) => {
  res.json(orders);
});

app.get('/ordenes/:id', (req, res) => {
  const order = orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).end();
  res.json(order);
});

app.post('/ordenes', (req, res) => {
  const { sucursalId, descripcion, estado = 'pendiente' } = req.body;
  if (!sucursalId || !descripcion) {
    return res.status(400).json({ error: 'datos incompletos' });
  }
  if (!sucursales.find(s => s.id === Number(sucursalId))) {
    return res.status(400).json({ error: 'sucursal inexistente' });
  }
  const order = { id: nextId(orders), sucursalId: Number(sucursalId), descripcion, estado };
  orders.push(order);
  res.status(201).json(order);
});

app.put('/ordenes/:id', (req, res) => {
  const order = orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).end();
  const { sucursalId, descripcion, estado } = req.body;
  if (sucursalId !== undefined) {
    if (!sucursales.find(s => s.id === Number(sucursalId))) {
      return res.status(400).json({ error: 'sucursal inexistente' });
    }
    order.sucursalId = Number(sucursalId);
  }
  if (descripcion !== undefined) order.descripcion = descripcion;
  if (estado !== undefined) order.estado = estado;
  res.json(order);
});

app.delete('/ordenes/:id', (req, res) => {
  const idx = orders.findIndex(o => o.id === Number(req.params.id));
  if (idx === -1) return res.status(404).end();
  const [deleted] = orders.splice(idx, 1);
  res.json(deleted);
});

function recalcRouteMetrics(routeId) {
  const route = routes.find(r => r.id === routeId);
  if (!route) return null;
  const rs = stops.filter(p => p.rutaId === routeId);
  route.km = rs.reduce((sum, p) => sum + (Number(p.distanciaKm) || 0), 0);
  route.min = rs.reduce((sum, p) => sum + (Number(p.tiempoMin) || 0), 0);
  route.costo = route.km * 1 + route.min * 0.5;
  return route;
}

// CRUD de rutas
app.get('/rutas', (req, res) => {
  const data = routes.map(r => ({
    ...r,
    paradas: stops
      .filter(p => p.rutaId === r.id)
      .sort((a, b) => a.orden - b.orden)
  }));
  res.json(data);
});

app.get('/rutas/:id', (req, res) => {
  const id = Number(req.params.id);
  const route = routes.find(r => r.id === id);
  if (!route) return res.status(404).end();
  const paradas = stops
    .filter(p => p.rutaId === id)
    .sort((a, b) => a.orden - b.orden);
  res.json({ ...route, paradas });
});

app.post('/rutas', (req, res) => {
  const { descripcion, orden = 0 } = req.body;
  if (!descripcion) return res.status(400).json({ error: 'datos incompletos' });
  const route = {
    id: nextId(routes),
    descripcion,
    orden: Number(orden),
    km: 0,
    min: 0,
    costo: 0
  };
  routes.push(route);
  res.status(201).json(route);
});

app.put('/rutas/:id', (req, res) => {
  const route = routes.find(r => r.id === Number(req.params.id));
  if (!route) return res.status(404).end();
  const { descripcion, orden } = req.body;
  if (descripcion !== undefined) route.descripcion = descripcion;
  if (orden !== undefined) route.orden = Number(orden);
  res.json(route);
});

app.delete('/rutas/:id', (req, res) => {
  const idx = routes.findIndex(r => r.id === Number(req.params.id));
  if (idx === -1) return res.status(404).end();
  const [deleted] = routes.splice(idx, 1);
  for (let i = stops.length - 1; i >= 0; i--) {
    if (stops[i].rutaId === deleted.id) stops.splice(i, 1);
  }
  res.json(deleted);
});

// CRUD de paradas
app.get('/rutas/:rutaId/paradas', (req, res) => {
  const rutaId = Number(req.params.rutaId);
  const list = stops
    .filter(p => p.rutaId === rutaId)
    .sort((a, b) => a.orden - b.orden);
  res.json(list);
});

app.post('/rutas/:rutaId/paradas', (req, res) => {
  const rutaId = Number(req.params.rutaId);
  const route = routes.find(r => r.id === rutaId);
  if (!route) return res.status(404).json({ error: 'ruta inexistente' });
  const { ordenId, orden = 0, distanciaKm = 0, tiempoMin = 0 } = req.body;
  if (!ordenId || !orders.find(o => o.id === Number(ordenId))) {
    return res.status(400).json({ error: 'orden inexistente' });
  }
  const stop = {
    id: nextId(stops),
    rutaId,
    orden: Number(orden),
    ordenId: Number(ordenId),
    distanciaKm: Number(distanciaKm),
    tiempoMin: Number(tiempoMin)
  };
  stops.push(stop);
  recalcRouteMetrics(rutaId);
  res.status(201).json(stop);
});

app.get('/rutas/:rutaId/paradas/:id', (req, res) => {
  const stop = stops.find(
    p => p.id === Number(req.params.id) && p.rutaId === Number(req.params.rutaId)
  );
  if (!stop) return res.status(404).end();
  res.json(stop);
});

app.put('/rutas/:rutaId/paradas/:id', (req, res) => {
  const stop = stops.find(
    p => p.id === Number(req.params.id) && p.rutaId === Number(req.params.rutaId)
  );
  if (!stop) return res.status(404).end();
  const { ordenId, orden, distanciaKm, tiempoMin } = req.body;
  if (ordenId !== undefined) {
    if (!orders.find(o => o.id === Number(ordenId))) {
      return res.status(400).json({ error: 'orden inexistente' });
    }
    stop.ordenId = Number(ordenId);
  }
  if (orden !== undefined) stop.orden = Number(orden);
  if (distanciaKm !== undefined) stop.distanciaKm = Number(distanciaKm);
  if (tiempoMin !== undefined) stop.tiempoMin = Number(tiempoMin);
  recalcRouteMetrics(stop.rutaId);
  res.json(stop);
});

app.delete('/rutas/:rutaId/paradas/:id', (req, res) => {
  const idx = stops.findIndex(
    p => p.id === Number(req.params.id) && p.rutaId === Number(req.params.rutaId)
  );
  if (idx === -1) return res.status(404).end();
  const [deleted] = stops.splice(idx, 1);
  recalcRouteMetrics(deleted.rutaId);
  res.json(deleted);
});

app.post('/rutas/:id/recalcular', (req, res) => {
  const route = recalcRouteMetrics(Number(req.params.id));
  if (!route) return res.status(404).end();
  res.json(route);
});

// Importar órdenes desde CSV
app.post('/ordenes/import', (req, res) => {
  const user = req.headers['x-user'] || 'anon';
  const errores = [];
  let total = 0;

  req.pipe(csv())
    .on('data', row => {
      total++;
      const { sucursalId, descripcion, estado = 'pendiente' } = row;
      if (!sucursalId || !descripcion || !sucursales.find(s => s.id === Number(sucursalId))) {
        errores.push({ fila: total, mensaje: 'datos inválidos' });
        return;
      }
      const order = { id: nextId(orders), sucursalId: Number(sucursalId), descripcion, estado };
      orders.push(order);
    })
    .on('end', () => {
      const reporte = {
        id: nextId(importReports),
        usuario: user,
        total,
        errores,
        timestamp: new Date().toISOString()
      };
      importReports.push(reporte);
      res.json(reporte);
    })
    .on('error', err => {
      res.status(400).json({ error: err.message });
    });
});

app.get('/import-reports', (req, res) => {
  res.json(importReports);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

// Expose for tests
app.locals.orders = orders;
app.locals.importReports = importReports;
app.locals.sucursales = sucursales;
app.locals.routes = routes;
app.locals.stops = stops;
app.locals.recalcRouteMetrics = recalcRouteMetrics;

module.exports = app;
