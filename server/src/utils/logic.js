export function votingResult(yes,no){
  const total=yes+no;
  return {yes,no,total,ratio:total?yes/total:0,verified:yes>=5 && total>0 && yes/total>=0.75};
}
export function coordinatesValid(lat,lng){
  return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
}
export function distanceMeters(lat1,lng1,lat2,lng2){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dlat=toRad(lat2-lat1),dlng=toRad(lng2-lng1);
  const a=Math.sin(dlat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dlng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
export function similarity(a='',b=''){
  const tokens=s=>new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x.length>3));
  const x=tokens(a),y=tokens(b); if(!x.size||!y.size)return 0;
  return [...x].filter(t=>y.has(t)).length/new Set([...x,...y]).size;
}
export const safeText=(value,max=3000)=>typeof value==='string'?value.trim().slice(0,max):'';
