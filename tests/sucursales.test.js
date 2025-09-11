const request = require('supertest');
const app = require('../server');

describe('API de sucursales', () => {
  it('debe responder con una lista de sucursales', async () => {
    const res = await request(app).get('/sucursales');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, nombre: 'Sucursal Centro', direccion: 'Av. Principal 123' },
      { id: 2, nombre: 'Sucursal Norte', direccion: 'Calle Secundaria 456' }
    ]);
  });
});
