import {createContext,useContext,useEffect,useState} from 'react';
import {api} from '../lib/api';
const C=createContext(null);
export function AuthProvider({children}){
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
  useEffect(()=>{api('/auth/me').then(d=>setUser(d.user)).catch(()=>{}).finally(()=>setLoading(false));},[]);
  async function signIn(credential){const d=await api('/auth/google',{method:'POST',body:{credential}});setUser(d.user);return d.user;}
  async function logout(){await api('/auth/logout',{method:'POST'});setUser(null);}
  async function updatePrefs(changes){const d=await api('/auth/preferences',{method:'PATCH',body:changes});setUser(d.user);}
  return <C.Provider value={{user,loading,signIn,logout,updatePrefs,refresh:()=>api('/auth/me').then(d=>setUser(d.user))}}>{children}</C.Provider>;
}
export const useAuth=()=>useContext(C);
