const request = require('supertest');
const app = require('../server');

beforeEach(() => {
  app.locals.orders.length = 0;
  app.locals.importReports.length = 0;
});

describe('CRUD de órdenes', () => {
  it('crea y actualiza una orden', async () => {
    let res = await request(app)
      .post('/ordenes')
      .send({ sucursalId: 1, descripcion: 'Prueba' });
    expect(res.status).toBe(201);
    const id = res.body.id;

    res = await request(app)
      .put(`/ordenes/${id}`)
      .send({ estado: 'asignada' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('asignada');

    res = await request(app).get('/ordenes');
    expect(res.body.length).toBe(1);
  });
});

describe('Importación de órdenes', () => {
  it('procesa CSV y genera reporte', async () => {
    const csv = 'sucursalId,descripcion\n1,Valida\n99,Invalida';
    const res = await request(app)
      .post('/ordenes/import')
      .set('Content-Type', 'text/csv')
      .set('x-user', 'tester')
      .send(csv);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.errores.length).toBe(1);
    expect(res.body.usuario).toBe('tester');

    const ordersRes = await request(app).get('/ordenes');
    expect(ordersRes.body.length).toBe(1);

    const reportsRes = await request(app).get('/import-reports');
    expect(reportsRes.body.length).toBe(1);
  });
});
