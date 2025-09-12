export function greedyRoute(origen, pts, haversine){
  const remaining = pts.map((p,i)=>({...p,_idx:i}));
  const order = [];
  let last = {lat: parseFloat(origen.lat), lng: parseFloat(origen.lng)};
  while(remaining.length){
    let bestIdx = 0;
    let bestDist = Infinity;
    for(let i=0;i<remaining.length;i++){
      const p = remaining[i];
      const d = haversine(last.lat,last.lng,p.lat,p.lng);
      if(d < bestDist){ bestDist = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx,1)[0];
    order.push(next._idx);
    last = next;
  }
  return order;
}
