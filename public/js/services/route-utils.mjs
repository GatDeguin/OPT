export function calcRouteStats(origen, pts, cfg, { haversine, stopTimeFor, parseNumber }) {
  let maxMonto = 0;
  let carga = 0;
  let distKm = 0;
  let min = 0;
  let last = origen ? { lat: parseNumber(origen.lat), lng: parseNumber(origen.lng) } : null;
  for (const p of pts) {
    if (last) distKm += haversine(last.lat, last.lng, p.lat, p.lng);
    min += stopTimeFor(p.tipo);
    if ((p.monto || 0) > 0) carga += (p.monto || 0);
    maxMonto = Math.max(maxMonto, carga);
    last = p;
  }
  if (last && origen) {
    distKm += haversine(last.lat, last.lng, parseNumber(origen.lat), parseNumber(origen.lng));
  }
  const tiempoTraslado = distKm / (cfg.vel || 40) * 60 * (cfg.trafficFactor || 1);
  const totalMin = Math.round(min + tiempoTraslado);
  return { maxMonto, totalMin, distKm };
}
