const request = require('supertest');
const app = require('../server');

describe('Reportes', () => {
  beforeEach(() => {
    app.locals.orders.length = 0;
    app.locals.routes.length = 0;
    app.locals.stops.length = 0;
  });

  test('exporta CSV con totales', async () => {
    await request(app).post('/ordenes').send({ sucursalId: 1, descripcion: 'o1' });
    const resRuta = await request(app).post('/rutas').send({ descripcion: 'r1' });
    const r1 = resRuta.body.id;
    await request(app)
      .post(`/rutas/${r1}/paradas`)
      .send({ ordenId: 1, distanciaKm: 10, tiempoMin: 20 });

    const res = await request(app).get('/reports/csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toMatch(/Centro de Costo/);
  });

  test('genera PDF resumido', async () => {
    await request(app).post('/ordenes').send({ sucursalId: 1, descripcion: 'o1' });
    const resRuta = await request(app).post('/rutas').send({ descripcion: 'r1' });
    const r1 = resRuta.body.id;
    await request(app)
      .post(`/rutas/${r1}/paradas`)
      .send({ ordenId: 1, distanciaKm: 5, tiempoMin: 5 });

    const res = await request(app).get('/reports/pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
