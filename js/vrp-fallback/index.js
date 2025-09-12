import { greedyRoute } from './greedy.js';
import { twoOpt } from './two-opt.js';
import { calcRouteStats } from '../services/route-utils.mjs';

export async function computeFallback(origen, pts, cfg, utils){
  let order = greedyRoute(origen, pts, utils.haversine);
  order = twoOpt(origen, pts, order, utils.haversine);
  const ordered = order.map(i => pts[i]);
  const stats = calcRouteStats(origen, ordered, cfg, utils);
  return { ordered, stats };
}

export async function fetchBackendRoutes(){
  const res = await fetch('/rutas');
  if(!res.ok) throw new Error('backend rutas unavailable');
  return res.json();
}
