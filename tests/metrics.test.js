const request = require('supertest');
const app = require('../server');

describe('Métricas agregadas', () => {
  beforeEach(() => {
    app.locals.orders.length = 0;
    app.locals.routes.length = 0;
    app.locals.stops.length = 0;
  });

  test('calcula km, costo, SLA, utilización y top rutas', async () => {
    await request(app).post('/ordenes').send({ sucursalId: 1, descripcion: 'o1', estado: 'entregado' });
    await request(app).post('/ordenes').send({ sucursalId: 1, descripcion: 'o2' });

    let res = await request(app).post('/rutas').send({ descripcion: 'r1' });
    const r1 = res.body.id;
    res = await request(app).post('/rutas').send({ descripcion: 'r2' });
    const r2 = res.body.id;

    await request(app).post(`/rutas/${r1}/paradas`).send({ ordenId: 1, distanciaKm: 10, tiempoMin: 20 });
    await request(app).post(`/rutas/${r2}/paradas`).send({ ordenId: 2, distanciaKm: 5, tiempoMin: 0 });

    res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body.km).toBe(15);
    expect(res.body.costo).toBeCloseTo(25);
    expect(res.body.sla).toBeCloseTo(0.5);
    expect(res.body.utilizacion).toBeCloseTo(1);
    expect(res.body.topRutas[0].km).toBe(10);
    expect(res.body.rutas).toBe(2);
  });
});
