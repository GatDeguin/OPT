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

module.exports = app;
