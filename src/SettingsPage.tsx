import { useState } from 'react';
import { Activity, Eye, Maximize, Monitor, Settings2, SlidersHorizontal, Users } from 'lucide-react';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from './appPreferences';
import type { AppPreferences } from './appPreferences';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './settings-v213.css';
import { UpdateSettings, type UpdaterControls } from './updater';

type Key=keyof AppPreferences;
const options:{id:Key;label:string;hint:string;icon:typeof Activity}[]=[
  {id:'animations',label:'Interface motion',hint:'Soft transitions and hover animations.',icon:Activity},
  {id:'compactUI',label:'Compact layout',hint:'Tighter spacing, with more content visible.',icon:SlidersHorizontal},
  {id:'launchFullscreen',label:'Launch fullscreen',hint:'Start the desktop app without window borders.',icon:Maximize},
  {id:'showNews',label:'Fortnite news on Home',hint:'Optional live news feed. Off by default for a quieter Home.',icon:Eye},
  {id:'membersDefault',label:'Show Members at startup',hint:'Keep the community dock visible after sign-in.',icon:Users},
  {id:'autoUpdates',label:'Download updates automatically',hint:'Check GitHub Releases on launch and prepare verified updates in the background.',icon:Activity},
];
export function SettingsPage({updater}:{updater:UpdaterControls}){
  const [prefs,setPrefs]=useState(loadPreferences);
  const [notice,setNotice]=useState('');
  const change=async(key:Key,value:boolean)=>{
    const next={...prefs,[key]:value};setPrefs(next);savePreferences(next);
    setNotice('Preferences saved locally on this device.');
    if(key==='launchFullscreen'){
      try{await getCurrentWindow().setFullscreen(value);}catch{setNotice('Preference saved. Fullscreen is only available in the desktop application.');}
    }
  };
  return <div className="settings-v3-page"><header className="settings-v3-heading"><span>YOUR WORKSPACE</span><h1>Settings<span>.</span></h1><p>Only what matters. Changes are saved automatically.</p></header>
    <div className="settings-v3-card"><div className="settings-v3-card-head"><Settings2 size={19}/><div><h2>Appearance & experience</h2><p>Fine-tune how Maq's Passion feels.</p></div></div>
      {options.map(item=>{const Icon=item.icon;return <label key={item.id} className="settings-v3-row"><Icon size={18}/><span><strong>{item.label}</strong><small>{item.hint}</small></span><input type="checkbox" checked={prefs[item.id]} onChange={event=>void change(item.id,event.target.checked)}/></label>})}
    </div>
    <UpdateSettings updater={updater}/>
    <div className="settings-v3-subgrid"><section><Monitor size={18}/><div><h3>Dark by design</h3><p>The default palette stays neutral black, graphite and white across every tool—including PASSION AIM.</p></div></section>
      <section><Activity size={18}/><div><h3>Competitive first</h3><p>Changing UI animations doesn't affect the aim trainer's simulation, input handling or graphics settings.</p></div></section></div>
    <div className="settings-v3-bottom"><span>{notice||'App settings stay on this computer. Account details are managed separately in Profile.'}</span><button type="button" onClick={()=>{setPrefs({...DEFAULT_PREFERENCES});savePreferences({...DEFAULT_PREFERENCES});setNotice('Default preferences restored.');}}>Restore defaults</button></div>
  </div>;
}
