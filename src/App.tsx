import { HomeNews } from './HomeNews';
import { MembersPanel } from './MembersPanel';
import { Tweaks } from './ExtraPages';
import { Masterclasses } from './Masterclasses';
import { SpeedTest15 } from './SpeedTest15';
import proProfiles from './pro-profiles.json';
import { DropCalculator } from './DropCalculator';
import { AimTrainer } from './AimTrainer';
import { SettingsPage } from './SettingsPage';
import { useAppUpdater, UpdateToast } from './updater';
import { loadPreferences } from './appPreferences';
import type { AppPreferences } from './appPreferences';
import { useEffect, useMemo, useState } from 'react';
import type {User} from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AuthGate, ProfilePage, Avatar, displayName } from './Account';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { ChevronRight, Home, Monitor, MousePointer2, Keyboard, ExternalLink, SlidersHorizontal, Search, X, ShoppingBag, Calculator, LayoutGrid, Target, BookOpen, Wifi, Wrench, MapPinned, UserRound, Users, Crosshair, Settings2, ChevronDown } from 'lucide-react';
import './styles.css';
import './polish.css';
import './premium-v213.css';
import { ItemShop } from './LivePages';
import { SensitivityCalculator, KeybindVisualiser, AimLab } from './ToolsPages';

type Pro = {
  id: string; name: string; team: string; region: string; photo: string; imageCredit: string;
  dpi: string; x: string; y: string; targeting: string; scope: string; resolution: string; mode: string;
  binds: [string,string][]; gear: [string,string][]; source: string; updated: string;
};

// Player profiles stay visible; run `npm run photos` to install local portraits.
import photoManifest from './photo-manifest.json';
const photoPaths = new Map(photoManifest.players.map((item: {id: string; file: string}) => [item.id, `/players/${item.file}`]));
// Locally cached settings manually checked against ProSettings profiles in October 2026.
// These values can age. Images are NOT included until downloaded to public/players.
const allPlayers: Pro[] = proProfiles.map(entry=>({
  ...entry,
  photo: photoPaths.get(entry.id) || '',
  imageCredit: 'Player portrait saved locally from permitted source; absent until downloaded',
  binds: entry.binds as [string,string][],
  gear: entry.gear as [string,string][]
}));
const players: Pro[] = allPlayers;

function relevance(player: Pro, query: string) {
  const q = query.toLocaleLowerCase().trim();
  if (!q) return 0;
  const name = player.name.toLocaleLowerCase();
  if (name === q) return 1000;
  if (name.startsWith(q)) return 800 - (name.length - q.length);
  if (name.includes(q)) return 600 - name.indexOf(q);
  if (player.team.toLowerCase().includes(q)) return 350;
  if (player.region.toLowerCase().includes(q)) return 250;
  // Allow a single typo for longer queries.
  if (q.length >= 4 && Math.abs(name.length - q.length) <= 1) {
    for(let i=0;i<name.length;i++) {
      if (name.slice(0,i) + name.slice(i+1) === q) return 110;
    }
    for(let i=0;i<q.length;i++) {
      if (q.slice(0,i) + q.slice(i+1) === name) return 110;
    }
  }
  return -1;
}

function Portrait({ player }: {player:Pro}) {
  const [error,setError]=useState(false);
  useEffect(()=>setError(false),[player.id]);
  return <div className="portrait">{error || !player.photo ? <span className='photo-failed'>PHOTO NOT INSTALLED</span> : <img src={player.photo} alt={`${player.name} player portrait`} onError={()=>setError(true)} />}</div>;
}

export default function App() {
  const isSplash = window.location.hash === '#splash';
  const [loading,setLoading] = useState(isSplash);
  const [page,setPage] = useState<'home' | 'pro-setups' | 'shop' | 'sensitivity' | 'keybinds' | 'aim' | 'aim-trainer' | 'masterclasses' | 'speed' | 'tweaks' | 'drop' | 'profile' | 'settings'>('home');
  const [user,setUser] = useState<User | null>(null);
  const [prefs,setPrefs] = useState<AppPreferences>(loadPreferences);
  const [membersOpen, setMembersOpen] = useState(() => loadPreferences().membersDefault);
  const [moreOpen,setMoreOpen] = useState(false);
  const [featuredVideo, setFeaturedVideo] = useState<string | null>(null);
  useEffect(()=>{
    const onChange=(e:Event)=>setPrefs((e as CustomEvent<AppPreferences>).detail);
    window.addEventListener('mp:preferences-changed',onChange);
    return ()=>window.removeEventListener('mp:preferences-changed',onChange);
  },[]);
  useEffect(()=>{document.documentElement.dataset.mpMotion=prefs.animations?'on':'off';document.documentElement.dataset.mpDensity=prefs.compactUI?'compact':'comfortable';},[prefs]);
  useEffect(()=>setMembersOpen(prefs.membersDefault),[prefs.membersDefault]);
  const [authLoading,setAuthLoading] = useState(Boolean(supabase));
  useEffect(()=>{
    if (!supabase) return;
    let live=true;
    supabase.auth.getSession().then(({data,error})=>{
      if(!live)return;
      if(error)console.warn('Session restore failed:',error.message);
      setUser(data.session?.user??null);
      setAuthLoading(false);
    }).catch(err=>{console.error('Authentication check failed:',err);if(live)setAuthLoading(false)});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event, session)=>{
      if(live){setUser(session?.user??null);setAuthLoading(false)}
    });
    return ()=>{live=false;subscription.unsubscribe()};
  },[]);
  const updater = useAppUpdater(!loading && !authLoading && Boolean(user), prefs.autoUpdates);
  const [selected,setSelected] = useState<string | null>(null);
  const [query,setQuery] = useState('');
  const matches = useMemo(() => players.map(player=>({player,score:relevance(player,query)})).filter(item=>item.score>=0).sort((a,b)=>b.score-a.score || a.player.name.localeCompare(b.player.name)).map(item=>item.player), [query]);
  const player = players.find(p=>p.id===selected);

  useEffect(()=>{
    if(!isSplash){getCurrentWindow().setFullscreen(prefs.launchFullscreen).catch(console.warn);return;}
    const timer=window.setTimeout(async()=>{
      try{await invoke('finish_splash');}
      catch(error){console.error('Splash transition failed:',error);setLoading(false);}
    },3200);
    return ()=>clearTimeout(timer);
  },[isSplash,prefs.launchFullscreen]);

  useEffect(()=>{
    if(loading)return;
    const onKey=async(e:KeyboardEvent)=>{
      if(e.key==='Escape' && selected){setSelected(null);return;}
      if(e.key==='F11'){
        e.preventDefault();
        try{const win=getCurrentWindow();await win.setFullscreen(!(await win.isFullscreen()));}catch(error){console.warn(error);}
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[loading,selected]);

  if(loading)return <div className="splash"><div className="splash-content"><h1 className="splash-title">MAQ'S PASSION</h1></div><div className="loading-track"><div className="loading-fill"/></div></div>;

  if(authLoading)return <div className="auth-screen"><div className="auth-panel"><span className="auth-kicker">MAQ'S PASSION</span><h1>CONNECTING.</h1><p className="auth-lede">Restoring your session…</p></div></div>;
  if(!user)return <AuthGate/>;

  return <div className="app-layout">
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-title">MAQ'S PASSION.</span><span className="brand-subtitle">COMPETITIVE PLATFORM</span></div>
      <div className="sidebar-divider" />
      <button type="button" className="sidebar-profile" onClick={()=>{setPage('profile');setSelected(null)}}><Avatar user={user}/><span className="sidebar-profile-label"><strong>{displayName(user)}</strong><small>VIEW PROFILE</small></span><UserRound size={15} color="#777" style={{marginLeft:'auto'}}/></button>
      <nav className="sidebar-navigation" aria-label="Main navigation">
        <div className="mp-nav-primary">
          <button type="button" className={`nav-item ${page==='home'?'active':''}`} onClick={()=>{setPage('home');setSelected(null);}}><Home size={18}/><span>Home</span></button>
          <button type="button" className={`nav-item ${page==='aim-trainer'?'active':''}`} onClick={()=>{setPage('aim-trainer');setSelected(null);}}><Crosshair size={18}/><span>PASSION AIM</span></button>
          <button type="button" className={`nav-item ${page==='masterclasses'?'active':''}`} onClick={()=>{setPage('masterclasses');setFeaturedVideo(null);setSelected(null);}}><BookOpen size={18}/><span>Masterclasses</span></button>
          <button type="button" className={`nav-item ${page==='shop'?'active':''}`} onClick={()=>{setPage('shop');setSelected(null);}}><ShoppingBag size={18}/><span>Item Shop</span></button>
          <button type="button" className={`nav-item ${page==='pro-setups'?'active':''}`} onClick={()=>{setPage('pro-setups');setSelected(null);}}><SlidersHorizontal size={18}/><span>Pro Setups</span></button>
        </div>
        <div className="mp-nav-divider"/>
        <button type="button" className={`nav-item mp-tools-toggle ${(['sensitivity','keybinds','aim','speed','tweaks','drop'] as string[]).includes(page)?'active':''}`} onClick={()=>setMoreOpen(open=>!open)} aria-expanded={moreOpen}>
          <LayoutGrid size={18}/><span>More tools</span><ChevronDown size={14} className={`mp-tools-arrow ${moreOpen?'open':''}`}/>
        </button>
        {moreOpen&&<div className="mp-nav-tools">
          {([['sensitivity','Sensitivity',Calculator],['keybinds','Keybinds',Keyboard],['aim','Reaction Time',Target],['speed','Speed Test',Wifi],['tweaks','PC Tweaks',Wrench],['drop','Drop Calculator',MapPinned]] as const).map(([id,label,Icon])=><button key={id} type="button" className={`nav-item ${page===id?'active':''}`} onClick={()=>{setPage(id);setSelected(null);}}><Icon size={17}/><span>{label}</span></button>)}
        </div>}
        <div className="mp-nav-spacer"/>
        <div className="mp-nav-divider"/>
        <button type="button" className={`nav-item ${membersOpen?'member-inline-on':''}`} onClick={()=>setMembersOpen(v=>!v)} aria-expanded={membersOpen}><Users size={18}/><span>Members</span></button>
        <button type="button" className={`nav-item ${page==='settings'?'active':''}`} onClick={()=>{setPage('settings');setSelected(null);}}><Settings2 size={18}/><span>Settings</span></button>
        <button type="button" className={`nav-item ${page==='profile'?'active':''}`} onClick={()=>{setPage('profile');setSelected(null);}}><UserRound size={18}/><span>Profile</span></button>
      </nav>
      <div className="sidebar-footer"><span>MADE BY MAQ</span><span>V2.14.4</span></div>
    </aside>

    <main className="main-content">
      {page === 'settings' ? <SettingsPage updater={updater}/> : page === 'profile' ? <ProfilePage user={user}/> : page === 'aim-trainer' ? <AimTrainer/> : page === 'drop' ? <DropCalculator/> : page === 'masterclasses' ? <Masterclasses key={featuredVideo ?? 'library'} initialVideoId={featuredVideo}/> : page === 'speed' ? <SpeedTest15/> : page === 'tweaks' ? <Tweaks/> : page === 'shop' ? <ItemShop/> : page === 'sensitivity' ? <SensitivityCalculator/> : page === 'keybinds' ? <KeybindVisualiser/> : page === 'aim' ? <AimLab/> : page === 'pro-setups' && player ? <section className="detail" key={player.id}>
        <button className="back-button" type="button" onClick={()=>setSelected(null)}>← ALL PRO SETUPS</button>
        <div className="detail-header"><Portrait player={player}/><div><p className="eyebrow">PRO PLAYER PROFILE · {player.region}</p><h1>{player.name}</h1><p className="muted">{player.team}</p></div></div>
        <div className="unverified-notice">Reported settings last checked on {player.updated} from ProSettings.net. These may have changed; check the source before copying a pro's setup.</div><div className="detail-grid">
          <section className="detail-panel"><h2><MousePointer2 size={18}/> MOUSE SETTINGS</h2><div className="data-grid">{[['DPI',player.dpi],['X SENS',player.x],['Y SENS',player.y],['TARGETING',player.targeting],['SCOPE',player.scope]].map(([label,value])=><div key={label} className="data-item"><span>{label}</span><strong>{value}</strong></div>)}</div></section>
          <section className="detail-panel"><h2><Monitor size={18}/> VIDEO</h2><div className="data-list">{[['Resolution',player.resolution],['Rendering',player.mode]].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div></section>
          <section className="detail-panel"><h2><Keyboard size={18}/> KEYBINDS</h2><div className="data-list">{player.binds.length ? player.binds.map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>) : <p className='unavailable'>No verified keybinds available yet.</p>}</div></section>
          <section className="detail-panel"><h2><Monitor size={18}/> HARDWARE</h2><div className="data-list">{player.gear.length ? player.gear.map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>) : <p className='unavailable'>No verified hardware available yet.</p>}</div></section>
        </div>
        <div className="source-row"><span>SETTINGS DATA: {player.updated}. UNVERIFIED FIELDS ARE NOT ESTIMATES.</span><a href={player.source} target="_blank" rel="noopener noreferrer">VIEW ORIGINAL SOURCE <ExternalLink size={14}/></a></div>
        <p className="image-credit">{player.imageCredit}. Missing portraits are not included in this archive. Existing photos from nearby projects are restored automatically at launch; only verified local files will be shown.</p>
      </section> : page === 'pro-setups' ? <section className="pros-page">
        <header className="pros-page-heading"><p className="eyebrow">PLAYER DATABASE</p><h1>PRO SETUPS<span>.</span></h1><p className="pros-description">EXPLORE PROFESSIONAL FORTNITE PLAYERS' SETTINGS & HARDWARE</p></header>
        <div className="directory-search"><Search size={21} aria-hidden="true"/><input type="search" aria-label="Search pro players" placeholder="Search pro players, teams or regions..." value={query} onChange={e=>setQuery(e.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={()=>setQuery('')}><X size={18}/></button>}</div>
        <div className="directory-meta"><span>{matches.length} PLAYER{matches.length === 1 ? '' : 'S'} {query ? 'MATCHED' : 'IN DIRECTORY'}</span><span>BEST MATCH FIRST</span></div>
        <div className="pros-page-grid">{matches.map(p=><button key={p.id} type="button" className="pro-card" onClick={()=>setSelected(p.id)}><Portrait player={p}/><span className="pro-card-copy"><strong>{p.name}</strong><small>{p.team} · {p.region}</small></span><ChevronRight size={19}/></button>)}</div>
        {matches.length === 0 && <div className="directory-empty">"NO MATCHES FOUND. TRY ANOTHER NAME."</div>}
        <p className="pros-page-footnote">Select a profile and use VIEW ORIGINAL SOURCE to check their latest ProSettings details. 10 sourced competitor profiles are available even before photo download. Real photos from nearby projects are restored automatically, when available. Unavailable portraits are never fabricated. This is not a complete registry of all Fortnite pros.</p>
      </section> : <HomeNews showNews={prefs.showNews} navigate={next => {setFeaturedVideo(null);setPage(next);setSelected(null);}} openLesson={id => {setFeaturedVideo(id);setPage('masterclasses');setSelected(null);}}/>}
    </main>
    {membersOpen && <MembersPanel user={user} onClose={() => setMembersOpen(false)} />}
    <UpdateToast updater={updater}/>
  </div>;
}
