const API=(import.meta.env.VITE_API_URL||'http://localhost:4000').replace(/\/$/,'');
export async function api(path,{method='GET',body,...opts}={}){let r;try{r=await fetch(API+'/api/admin'+path,{method,credentials:'include',headers:{...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,...opts});}catch{throw Error('Cannot reach API; start Express first');}const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d;}
export const formatDate=s=>s?new Date(s).toLocaleString():'—';
export const truncate=(s,n=90)=>s?.length>n?s.slice(0,n)+'…':s;
