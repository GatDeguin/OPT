const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const {
  atms,
  sucursales,
  cabeceras,
  otrosBancos,
  choferes,
  camiones,
  ordenes
} = require('./server/data');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function normalizeId(value) {
  if(value === undefined || value === null) return '';
  return String(value).trim().toLowerCase();
}

function createCrudRoutes({ basePath, collection, idKey, idFactory }) {
  const pathId = `${basePath}/:${idKey}`;

  app.get(basePath, (_req, res) => {
    res.json(collection);
  });

  app.get(pathId, (req, res) => {
    const id = normalizeId(req.params[idKey]);
    const item = collection.find(entry => normalizeId(entry[idKey]) === id);
    if(!item) {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    res.json(item);
  });

  app.post(basePath, (req, res) => {
    const payload = req.body;
    if(!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Cuerpo inválido' });
    }
    const record = { ...payload };
    if(record[idKey] === undefined || record[idKey] === null || normalizeId(record[idKey]) === '') {
      if(typeof idFactory === 'function') {
        record[idKey] = idFactory();
      } else {
        return res.status(400).json({ error: `El campo ${idKey} es obligatorio` });
      }
    }
    const id = normalizeId(record[idKey]);
    const exists = collection.some(entry => normalizeId(entry[idKey]) === id);
    if(exists) {
      return res.status(409).json({ error: 'El recurso ya existe' });
    }
    collection.push(record);
    res.status(201).json(record);
  });

  app.put(pathId, (req, res) => {
    const id = normalizeId(req.params[idKey]);
    const idx = collection.findIndex(entry => normalizeId(entry[idKey]) === id);
    if(idx === -1) {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    const payload = req.body;
    if(!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Cuerpo inválido' });
    }
    const next = { ...collection[idx], ...payload, [idKey]: collection[idx][idKey] };
    collection[idx] = next;
    res.json(next);
  });

  app.delete(pathId, (req, res) => {
    const id = normalizeId(req.params[idKey]);
    const idx = collection.findIndex(entry => normalizeId(entry[idKey]) === id);
    if(idx === -1) {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    collection.splice(idx, 1);
    res.status(204).send();
  });
}

createCrudRoutes({ basePath: '/api/atms', collection: atms, idKey: 'codigo' });
createCrudRoutes({ basePath: '/api/sucursales', collection: sucursales, idKey: 'codigo' });
createCrudRoutes({ basePath: '/api/cabeceras', collection: cabeceras, idKey: 'codigo' });
createCrudRoutes({ basePath: '/api/otros', collection: otrosBancos, idKey: 'codigo' });
createCrudRoutes({ basePath: '/api/choferes', collection: choferes, idKey: 'legajo' });
createCrudRoutes({ basePath: '/api/camiones', collection: camiones, idKey: 'id' });
createCrudRoutes({ basePath: '/api/ordenes', collection: ordenes, idKey: 'id', idFactory: () => `ORD-${randomUUID()}` });

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
