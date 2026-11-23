export const API_URL=(import.meta.env.VITE_API_URL||'http://localhost:4000').replace(/\/$/,'');
export async function api(path,{method='GET',body,headers,...options}={}){
  const isForm=body instanceof FormData;
  let res;
  try{res=await fetch(API_URL+'/api'+path,{method,credentials:'include',headers:{...(!isForm&&body?{'Content-Type':'application/json'}:{}),...headers},body:body?(isForm?body:JSON.stringify(body)):undefined,...options});}
  catch{throw Error('Cannot reach CivicAlert API. Check that the Express server is running.');}
  const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||`Request failed (${res.status})`);return data;
}
export function prettyCategory(s='other'){return s.replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());}
export function since(time){if(!time)return '';const n=Date.now()-new Date(time).getTime();if(n<60000)return 'Just now';if(n<3600000)return `${Math.floor(n/60000)}m ago`;if(n<86400000)return `${Math.floor(n/3600000)}h ago`;return new Date(time).toLocaleDateString();}
export function mapLink(coords){return `https://www.openstreetmap.org/?mlat=${coords?.[1]}&mlon=${coords?.[0]}#map=16/${coords?.[1]}/${coords?.[0]}`;}
