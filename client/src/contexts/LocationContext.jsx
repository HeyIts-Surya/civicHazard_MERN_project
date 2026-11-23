import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {api} from '../lib/api';
import {useAuth} from './AuthContext';
const C=createContext(null);
export function LocationProvider({children}){
  const {user}=useAuth(),[position,setPosition]=useState(null),[error,setError]=useState(''),[checking,setChecking]=useState(true);const lastSent=useRef(0);const userRef=useRef(user);
  useEffect(()=>{userRef.current=user;},[user]);
  useEffect(()=>{
    if(!navigator.geolocation){setChecking(false);setError('Your browser does not support location services.');return;}
    const onSuccess=p=>{const next={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};setPosition(next);setError('');setChecking(false);
      if(userRef.current&&p.coords.accuracy<=150&&Date.now()-lastSent.current>60000){lastSent.current=Date.now();api('/auth/location',{method:'POST',body:next}).catch(()=>{lastSent.current=0;});}};
    const onFailure=e=>{setError(e.code===1?'Location permission was denied. Enable it in browser settings and retry.':'Location unavailable. Please enable GPS and retry.');setChecking(false);};
    const watcher=navigator.geolocation.watchPosition(onSuccess,onFailure,{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
    return()=>navigator.geolocation.clearWatch(watcher);
  },[]);
  // Refresh last-known location while the signed-in citizen actively uses the page.
  // A passive watchPosition may stop producing events when a device is stationary.
  useEffect(()=>{
    if(!user?.id||!navigator.geolocation)return;
    const update=()=>{if(document.visibilityState!=='visible')return;
      navigator.geolocation.getCurrentPosition(p=>{
        const next={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};
        setPosition(next);setError('');
        if(p.coords.accuracy<=150){api('/auth/location',{method:'POST',body:next}).then(()=>{lastSent.current=Date.now();}).catch(()=>{});}
      },()=>{},{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
    };
    update();const timer=setInterval(update,60000);
    document.addEventListener('visibilitychange',update);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[user?.id]);
  async function refresh(){setChecking(true);return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(async p=>{
    const next={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};setPosition(next);setError('');setChecking(false);
    if(userRef.current){try{await api('/auth/location',{method:'POST',body:next});lastSent.current=Date.now();}catch(e){setError(e.message);reject(e);return;}}
    resolve(next);
  },e=>{setChecking(false);setError(e.message);reject(e);},{enableHighAccuracy:true,maximumAge:0,timeout:20000}));}
  return <C.Provider value={{position,error,checking,refresh}}>{children}</C.Provider>;
}
export const useLocation=()=>useContext(C);
