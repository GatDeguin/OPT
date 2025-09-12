export function twoOpt(origen, pts, order, haversine){
  function routeLength(order){
    let total = 0;
    let last = {lat: parseFloat(origen.lat), lng: parseFloat(origen.lng)};
    for(const i of order){
      const p = pts[i];
      total += haversine(last.lat,last.lng,p.lat,p.lng);
      last = p;
    }
    total += haversine(last.lat,last.lng, parseFloat(origen.lat), parseFloat(origen.lng));
    return total;
  }
  let best = order.slice();
  let bestLen = routeLength(best);
  let improved = true;
  while(improved){
    improved = false;
    for(let i=0;i<best.length-1;i++){
      for(let k=i+1;k<best.length;k++){
        const candidate = best.slice(0,i)
          .concat(best.slice(i,k+1).reverse(), best.slice(k+1));
        const len = routeLength(candidate);
        if(len + 1e-6 < bestLen){
          bestLen = len;
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}
