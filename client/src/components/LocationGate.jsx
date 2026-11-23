import {MapPin,Navigation,ShieldAlert,RefreshCw} from 'lucide-react';
import {useLocation} from '../contexts/LocationContext';
import {useState} from 'react';
export default function LocationGate({children}){const {position,checking,error,refresh}=useLocation();const [busy,setBusy]=useState(false);
  if(position)return children;
  return <div className="gate-bg"><div className="gate-card"><div className="gate-icon"><MapPin size={28}/></div><span className="eyebrow">LOCATION-BASED SAFETY NETWORK</span><h1>Know what's happening <em>around you.</em></h1><p>CivicAlert uses your location to show nearby hazards and request community verification. Location access is required to use the application.</p><div className="gate-steps"><div><Navigation size={18}/> Discover local hazards</div><div><ShieldAlert size={18}/> Get relevant safety alerts</div></div>{error&&<div className="notice warn">{error}</div>}<button className="btn primary w-full justify-center" disabled={busy||checking} onClick={async()=>{setBusy(true);try{await refresh();}catch{}finally{setBusy(false);}}}>{checking||busy?<RefreshCw size={16} className="animate-spin"/>:<Navigation size={16}/>} {checking||busy?'Checking location…':'Enable location & continue'}</button><p className="gate-foot">Location permission is controlled by your browser. We cannot turn on GPS remotely.</p></div></div>;
}
