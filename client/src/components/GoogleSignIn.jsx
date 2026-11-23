import {GoogleLogin} from '@react-oauth/google';
import {useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
export default function GoogleSignIn(){const {signIn}=useAuth(),[error,setError]=useState('');
  if(!import.meta.env.VITE_GOOGLE_CLIENT_ID)return <div className="notice warn">Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to client/.env and GOOGLE_CLIENT_ID to server/.env.</div>;
  return <div className="space-y-3"><GoogleLogin onSuccess={async r=>{try{setError('');await signIn(r.credential);}catch(e){setError(e.message);}}} onError={()=>setError('Google sign-in was not completed')} useOneTap={false}/>{error&&<p className="text-sm text-red-500">{error}</p>}</div>;
}
