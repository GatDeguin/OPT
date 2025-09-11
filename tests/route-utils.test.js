const helpers = {
  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
  stopTimeFor(tipo) {
    if (/suc/i.test(tipo)) return 5;
    if (/atm/i.test(tipo)) return 15;
    return 10;
  },
  parseNumber: x => x
};

describe('calcRouteStats', () => {
  test('calcula monto pico y tiempo estimado', async () => {
    const { calcRouteStats } = await import('../public/js/services/route-utils.mjs');
    const origen = { lat: 0, lng: 0 };
    const pts = [
      { tipo: 'Sucursal', lat: 0, lng: 0.1, monto: 100 },
      { tipo: 'ATM', lat: 0, lng: 0.2, monto: 50 }
    ];
    const cfg = { vel: 60, trafficFactor: 1 };
    const stats = calcRouteStats(origen, pts, cfg, helpers);
    expect(stats.maxMonto).toBe(150);
    expect(stats.totalMin).toBeGreaterThan(60);
    expect(stats.totalMin).toBeLessThan(70);
  });
});
