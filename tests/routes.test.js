const request = require('supertest');
const app = require('../server');

beforeEach(() => {
  app.locals.orders.length = 0;
  app.locals.routes.length = 0;
  app.locals.stops.length = 0;
});

describe('Rutas y Paradas', () => {
  test('CRUD y métricas', async () => {
    let res = await request(app)
      .post('/ordenes')
      .send({ sucursalId: 1, descripcion: 'Orden' });
    const ordenId = res.body.id;

    res = await request(app)
      .post('/rutas')
      .send({ descripcion: 'Ruta 1', orden: 1 });
    expect(res.status).toBe(201);
    const rutaId = res.body.id;

    res = await request(app)
      .post(`/rutas/${rutaId}/paradas`)
      .send({ ordenId, orden: 1, distanciaKm: 10, tiempoMin: 20 });
    expect(res.status).toBe(201);
    const paradaId = res.body.id;

    res = await request(app).post(`/rutas/${rutaId}/recalcular`);
    expect(res.body.km).toBe(10);
    expect(res.body.min).toBe(20);
    expect(res.body.costo).toBeCloseTo(20);

    res = await request(app)
      .put(`/rutas/${rutaId}/paradas/${paradaId}`)
      .send({ distanciaKm: 15 });
    expect(res.status).toBe(200);

    await request(app).post(`/rutas/${rutaId}/recalcular`);
    res = await request(app).get(`/rutas/${rutaId}`);
    expect(res.body.km).toBe(15);

    res = await request(app).delete(`/rutas/${rutaId}`);
    expect(res.status).toBe(200);
    res = await request(app).get('/rutas');
    expect(res.body.length).toBe(0);
  });
});

