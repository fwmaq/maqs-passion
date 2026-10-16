import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BarChart3, Crosshair, Gauge, Maximize2, MousePointer2, Pause, Play, RotateCcw, Settings2, Target, Trophy, Volume2, VolumeX, Zap } from 'lucide-react';
import { AimEngine, DEFAULT_AIM_SETTINGS, DIFFICULTIES, DRILLS, estimatedCm360, initialAimStats } from './aimEngine';
import type { AimDifficulty, AimDrill, AimSettings, AimStats } from './aimEngine';
import './aim-trainer.css';
import './aim-v213.css';

type Phase = 'ready' | 'running' | 'paused' | 'results';
type RecordItem = { drill:AimDrill; difficulty:AimDifficulty; score:number; accuracy:number; hits:number; date:string; duration:number; };
function readSaved<T>(key:string,defaultValue:T):T {
  try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:defaultValue;}catch{return defaultValue;}
}
const drills: AimDrill[]=['frenzy','sixshot','micro','smooth','strafe','switch','bounce'];
const labels: Record<AimDrill,string>={frenzy:'TF',sixshot:'6S',micro:'MC',smooth:'ST',strafe:'SR',switch:'TS',bounce:'AT'};
const safeNumber=(v:number,min:number,max:number,backup:number) => Number.isFinite(v)?Math.max(min,Math.min(max,v)):backup;
function displayTime(n:number){const seconds=Math.ceil(Math.max(0,n));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
const isTracking=(drill:AimDrill)=>DRILLS[drill].tracking;

export function AimTrainer(){
  const [settings,setSettings]=useState<AimSettings>(()=>({...DEFAULT_AIM_SETTINGS,...readSaved<Partial<AimSettings>>('mp:aim3d:settings',{})}));
  const [drill,setDrill]=useState<AimDrill>('frenzy');
  const [difficulty,setDifficulty]=useState<AimDifficulty>('competitive');
  const [duration,setDuration]=useState(60);
  const [phase,setPhase]=useState<Phase>('ready');
  const [stats,setStats]=useState<AimStats>(()=>initialAimStats());
  const [result,setResult]=useState<AimStats|null>(null);
  const [history,setHistory]=useState<RecordItem[]>(()=>readSaved<RecordItem[]>('mp:aim3d:history',[]));
  const [error,setError]=useState('');
  const [section,setSection]=useState<'drills'|'settings'>('drills');
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const stageRef=useRef<HTMLDivElement|null>(null);
  const engineRef=useRef<AimEngine|null>(null);
  const latestRef=useRef({drill,difficulty,duration});
  latestRef.current={drill,difficulty,duration};

  useEffect(()=>{
    try{localStorage.setItem('mp:aim3d:settings',JSON.stringify(settings));}catch{/* private mode */}
    engineRef.current?.setSettings(settings);
  },[settings]);
  useEffect(()=>{try{localStorage.setItem('mp:aim3d:history',JSON.stringify(history));}catch{/* private mode */}},[history]);

  useEffect(()=>{
    if(!canvasRef.current)return;
    let engine:AimEngine;
    try{
      engine=new AimEngine(canvasRef.current,settings,{
        onUpdate:data=>setStats(data),
        onFinish:data=>{
          const current=latestRef.current;
          setResult(data);setPhase('results');
          setHistory(previous=>[{
            drill:current.drill,difficulty:current.difficulty,score:data.score,
            accuracy:data.accuracy,hits:data.hits,date:new Date().toLocaleString('en-GB'),duration:current.duration,
          },...previous].slice(0,60));
        },
        onLock:locked=>setPhase(old=>locked?'running':old==='results'?'results':'paused'),
        onError:message=>{setError(message);setPhase(old=>old==='results'?'results':'paused');},
      });
      engineRef.current=engine;
      const current=latestRef.current;
      engine.prepare(current.drill,current.difficulty,current.duration);
      setError('');
    }catch(e){setError(e instanceof Error?e.message:String(e));return;}
    return ()=>{engine.destroy();if(engineRef.current===engine)engineRef.current=null;};
    // Canvas context attributes are fixed at creation. Graphics quality and MSAA
    // are only adjustable before a round, recreating the context intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[settings.antialias,settings.quality]);

  const update=useCallback(<K extends keyof AimSettings>(key:K,value:AimSettings[K])=>{
    setSettings(prev=>({...prev,[key]:value}));
  },[]);
  const start=()=>{
    const engine=engineRef.current;
    if(!engine){setError('The 3D renderer is unavailable on this system.');return;}
    setError('');setResult(null);setStats(initialAimStats(duration));
    engine.prepare(drill,difficulty,duration);
    setPhase('paused');
    void engine.requestLock();
  };
  const resume=()=>{setError('');void engineRef.current?.requestLock();};
  const leave=()=>{
    if(document.pointerLockElement)document.exitPointerLock();
    engineRef.current?.prepare(drill,difficulty,duration);
    setPhase('ready');setResult(null);setStats(initialAimStats(duration));
  };
  const selectDrill=(id:AimDrill)=>{
    if(phase==='running'||phase==='paused')return;
    setDrill(id);latestRef.current={drill:id,difficulty,duration};
    engineRef.current?.prepare(id,difficulty,duration);setStats(initialAimStats(duration));setResult(null);setPhase('ready');
  };
  const selectDifficulty=(id:AimDifficulty)=>{
    if(phase==='running'||phase==='paused')return;
    setDifficulty(id);latestRef.current={drill,difficulty:id,duration};
    engineRef.current?.prepare(drill,id,duration);setStats(initialAimStats(duration));setResult(null);setPhase('ready');
  };
  const selectDuration=(value:number)=>{
    if(phase==='running'||phase==='paused')return;
    setDuration(value);latestRef.current={drill,difficulty,duration:value};
    engineRef.current?.prepare(drill,difficulty,value);setStats(initialAimStats(value));setResult(null);setPhase('ready');
  };
  const best=history.filter(entry=>entry.drill===drill&&entry.difficulty===difficulty).reduce((maximum,entry)=>Math.max(maximum,entry.score),0);
  const cm360=estimatedCm360(settings.dpi,settings.x);
  const stageLocked=phase==='running';
  const roundCoaching=result ? (isTracking(drill) ? (result.accuracy>=80?'Your tracking is steady. Raise target speed for your next run.':'Stay relaxed and lead the target instead of overcorrecting.') : result.accuracy>=90 ? 'Great accuracy. Push your acquisition speed while keeping clean clicks.' : result.accuracy>=70 ? 'Solid base. Focus on cleaner transitions before increasing speed.' : 'Prioritise accuracy first. Slow each flick until you land consistently.') : '';
  const currentBest=history.filter(entry=>entry.drill===drill&&entry.difficulty===difficulty).reduce((maximum,entry)=>Math.max(maximum,entry.score),0);
  const canChange=phase==='ready'||phase==='results';
  const metrics=[
    {label:'SCORE',value:stats.score.toLocaleString('en-GB')},
    {label:isTracking(drill)?'ON TARGET':'ACCURACY',value:`${stats.accuracy.toFixed(1)}%`},
    {label:isTracking(drill)?'TRACK TIME':'CONFIRMED HITS',value:isTracking(drill)?`${(stats.onTargetMs/1000).toFixed(1)}s`:String(stats.hits)},
    {label:'RENDER FPS',value:stats.fps>0?stats.fps.toFixed(1):'—'},
  ];
  return <div className="passion-aim-page">
    <header className="passion-aim-header">
      <div><div className="passion-aim-overline"><span className="pa-signal"/> MAQ'S PASSION / TRAINING <span className="pa-header-sep">/</span> VERSION 2.0</div>
        <h1>PASSION <em>AIM.</em></h1><p>Focus on the target. Nothing else.</p></div>
      <div className="pa-header-right"><span className="pa-engine-chip"><Gauge size={14}/> {stats.fps?stats.fps.toFixed(1):'—'} FPS <small style={{opacity:.62,marginLeft:5}}>{stats.frameMs?`${stats.frameMs.toFixed(1)} MS`:'RENDER'}</small></span></div>
    </header>

    <div className={`pa-workspace ${detailsOpen?'':'pa-workspace-wide'}`}>
      <section className="pa-game-column" aria-label="3D aim training range">
        <div className="pa-top-strip"><span><Crosshair size={15}/> {DRILLS[drill].name}</span><span>{DIFFICULTIES[difficulty].label} <i>•</i> {duration} SEC</span><button type="button" onClick={()=>setDetailsOpen(v=>!v)} title="Show or hide training controls"><Settings2 size={14}/> {detailsOpen?'HIDE':'SHOW'} SETUP</button></div>
        <div className="pa-stage" ref={stageRef}>
          <canvas ref={canvasRef} className="pa-canvas" aria-label="Interactive three-dimensional target range" onContextMenu={event=>event.preventDefault()}/>
          <div className="pa-top-hud"><span className="pa-hud-timer">{displayTime(stats.remaining|| (phase==='ready'?duration:0))}</span><span className="pa-hud-score">{stats.score.toLocaleString('en-GB')} <small>PTS</small></span></div>
          <div className="pa-bottom-hud"><span><span className={`pa-online-dot ${stageLocked?'is-live':''}`}/>{phase==='running'?'MOUSE CAPTURED':phase==='paused'?'SESSION PAUSED':phase==='results'?'SESSION COMPLETE':'RANGE READY'}</span><span className="pa-runtime-meter">{stats.fps > 0 ? `${stats.fps.toFixed(1)} FPS · ${stats.frameMs.toFixed(1)} MS` : "MEASURING FRAMES…"}</span><span>ESC RELEASES MOUSE</span></div>
          <span className={`pa-crosshair pa-crosshair-${settings.crosshair}`} style={{color:settings.crosshairColor}} aria-hidden="true"/>
          {phase!=='running' && <div className="pa-screen-overlay">
            <div className="pa-overlay-inner">
              {phase==='results'&&result? <><div className="pa-mode-icon"><Trophy size={31}/></div><span className="pa-splash-eyebrow">ROUND COMPLETE / {DRILLS[drill].name}</span>
                <strong className="pa-overlay-main pa-finish-score">{result.score.toLocaleString('en-GB')}</strong><small className="pa-overlay-caption">TOTAL SCORE · {result.accuracy.toFixed(1)}% {isTracking(drill)?'ON-TARGET':'ACCURACY'}</small>{result.score>=currentBest&&result.score>0&&<span className="pa-new-best">PERSONAL BEST</span>}<p className="pa-coaching">{roundCoaching}</p>
                <div className="pa-result-details"><span><b>{isTracking(drill)?(result.onTargetMs/1000).toFixed(1)+'S':result.hits}</b><small>{isTracking(drill)?'TRACKED':'HITS'}</small></span><span><b>{isTracking(drill)?(result.holdMs/1000).toFixed(1)+'S':Math.round(result.targetHitsPerMinute)}</b><small>{isTracking(drill)?'HELD FIRE':'HITS / MIN'}</small></span><span><b>{isTracking(drill)?'—':result.avgKillMs?Math.round(result.avgKillMs)+'MS':'—'}</b><small>ACQUISITION</small></span></div>
                <div className="pa-overlay-actions"><button type="button" className="pa-primary" onClick={start}><RotateCcw size={16}/> RUN IT BACK</button><button className="pa-secondary" type="button" onClick={leave}>CHOOSE DRILL</button></div>
              </> : phase==='paused'?<><div className="pa-mode-icon"><Pause size={30}/></div><span className="pa-splash-eyebrow">SESSION PAUSED</span>
                <strong className="pa-overlay-main">LOCK IN.</strong><p>Click resume to capture your mouse. Press Escape to pause again.</p>
                <div className="pa-overlay-actions"><button type="button" className="pa-primary" onClick={resume}><Play size={16}/> RESUME SESSION</button><button className="pa-secondary" type="button" onClick={leave}>END SESSION</button></div>
              </> : <><div className="pa-mode-icon"><Target size={30}/></div><span className="pa-splash-eyebrow">FOCUSED TRAINING</span>
                <strong className="pa-overlay-main">ONE MORE<br/><em>GOOD REP.</em></strong><p>{DRILLS[drill].description}</p>
                <button type="button" className="pa-primary pa-start" onClick={start}><Play size={18} fill="currentColor"/> START TRAINING <ArrowRight size={16}/></button>
                <span className="pa-start-note">MOUSE TO AIM · LEFT CLICK TO FIRE · ESC TO PAUSE</span></>}
            </div>
          </div>}
          {error&&<div className="pa-error" role="alert">{error}</div>}
          <button type="button" className="pa-maximize" title="Toggle range fullscreen" onClick={()=>{
            const stage=stageRef.current;
            if(!stage)return;
            if(document.fullscreenElement)void document.exitFullscreen();
            else void stage.requestFullscreen().catch(()=>setError('Range fullscreen was blocked by the WebView. The desktop app is still fullscreen.'));
          }}><Maximize2 size={15}/></button>
        </div>
        <div className="pa-quick-drills" aria-label="Quick drills">
          <span>QUICK START</span>
          {(['frenzy','sixshot','smooth'] as AimDrill[]).map(id=><button key={id} type="button" disabled={!canChange} className={drill===id?'active':''} onClick={()=>selectDrill(id)}>{DRILLS[id].name}</button>)}
          <button type="button" disabled={!canChange} onClick={()=>{setDetailsOpen(true);setSection('drills');}}>ALL 7 <ArrowRight size={13}/></button>
        </div>
        <div className="pa-stat-grid">{metrics.map(item=><div className="pa-stat" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
        <div className="pa-underbar"><span><Crosshair size={15}/> {isTracking(drill)?'HOLD LEFT MOUSE ON TARGET':'AIM WITH MOUSE · LEFT CLICK TO HIT'}</span><span>PERSONAL BEST <strong>{best.toLocaleString('en-GB')} PTS</strong></span></div>
        <button type="button" className="pa-history-toggle" onClick={()=>setHistoryOpen(v=>!v)} aria-expanded={historyOpen}><span><BarChart3 size={15}/> RECENT RUNS · {history.length}</span><span>{historyOpen?'HIDE':'VIEW'} HISTORY <ArrowRight size={13}/></span></button>
        {historyOpen&&<div className="pa-history"><div className="pa-section-heading"><div><span>PERFORMANCE LOG</span><strong>RECENT RUNS</strong></div><span>{history.length} SESSIONS</span></div>
          {history.length?<div className="pa-history-entries">{history.slice(0,5).map((entry,i)=><div key={`${entry.date}-${i}`} className="pa-history-row"><span className="pa-history-badge">{labels[entry.drill]}</span><div><strong>{DRILLS[entry.drill]?.name??entry.drill}</strong><small>{entry.difficulty.toUpperCase()} · {entry.date}</small></div><b>{entry.score.toLocaleString('en-GB')}</b><small>{entry.accuracy.toFixed(1)}%</small></div>)}</div>:<p className="pa-empty">Complete your first round to start building a local training history.</p>}
        </div>}
      </section>

      {detailsOpen&&<aside className="pa-sidebar" aria-label="Training setup">
        <div className="pa-config-tabs"><button type="button" className={section==='drills'?'active':''} onClick={()=>setSection('drills')}><Crosshair size={15}/> DRILLS</button><button type="button" className={section==='settings'?'active':''} onClick={()=>setSection('settings')}><Settings2 size={15}/> SETTINGS</button></div>
        {section==='drills'?<div className="pa-sidebar-body"><div className="pa-section-heading"><div><span>CHOOSE YOUR FOCUS</span><strong>SCENARIOS</strong></div><span>07</span></div>
          <div className="pa-drill-list">{drills.map((id,index)=><button type="button" key={id} disabled={!canChange} className={`pa-drill ${drill===id?'active':''}`} onClick={()=>selectDrill(id)}>
            <span className="pa-drill-number">{String(index+1).padStart(2,'0')}</span><span><strong>{DRILLS[id].name}</strong><small>{DRILLS[id].kicker}</small></span>{drill===id&&<span className="pa-drill-selected"/>}</button>)}</div>
          <div className="pa-sidebar-rule"/>
          <label className="pa-input-label">DIFFICULTY</label><div className="pa-option-row">{(['standard','competitive','elite'] as const).map(id=><button key={id} type="button" disabled={!canChange} className={difficulty===id?'active':''} onClick={()=>selectDifficulty(id)}>{id==='competitive'?'COMP':id.toUpperCase()}</button>)}</div>
          <label className="pa-input-label">ROUND DURATION</label><div className="pa-option-row">{[30,60,90,120].map(value=><button key={value} type="button" disabled={!canChange} className={duration===value?'active':''} onClick={()=>selectDuration(value)}>{value}S</button>)}</div>
          <label className="pa-input-label">CUSTOM TARGET SIZE <strong>{Math.round(settings.targetScale*100)}%</strong></label>
          <input className="pa-range" type="range" min=".5" max="1.5" step=".05" value={settings.targetScale} disabled={!canChange} onChange={e=>{
            const value=Number(e.target.value);update('targetScale',value);
            engineRef.current?.setSettings({...settings,targetScale:value});
            engineRef.current?.prepare(drill,difficulty,duration);
          }}/>
          <label className="pa-input-label">MOVEMENT SPEED <strong>{Math.round(settings.speedScale*100)}%</strong></label>
          <input className="pa-range" type="range" min=".5" max="2.5" step=".1" value={settings.speedScale} disabled={!canChange} onChange={e=>update('speedScale',Number(e.target.value))}/>
          <p className="pa-sidebar-hint">Competitive and Elite reduce target sizes and increase movement speed. Use 100% custom settings for comparable scores. Results are stored on this device.</p>
        </div>:<div className="pa-sidebar-body"><div className="pa-section-heading"><div><span>GAMEPLAY INPUT</span><strong>MOUSE SENSITIVITY</strong></div><MousePointer2 size={15}/></div>
          <p className="pa-sidebar-hint pa-top-hint">Match your mouse DPI and Fortnite X/Y percentages. Browser mouse movement may not be raw input; verify your physical cm/360.</p>
          <div className="pa-setting-grid">
            <label className="pa-field"><span>MOUSE DPI</span><input disabled={!canChange} aria-label="Mouse DPI" type="number" min="100" max="32000" step="100" value={settings.dpi} onChange={e=>update('dpi',safeNumber(Number(e.target.value),100,32000,800))}/></label>
            <label className="pa-field"><span>HORIZONTAL X (%)</span><input disabled={!canChange} aria-label="Fortnite X sensitivity percentage" type="number" min=".1" max="100" step=".1" value={settings.x} onChange={e=>update('x',safeNumber(Number(e.target.value),.1,100,6.5))}/></label>
            <label className="pa-field"><span>VERTICAL Y (%)</span><input disabled={!canChange} aria-label="Fortnite Y sensitivity percentage" type="number" min=".1" max="100" step=".1" value={settings.y} onChange={e=>update('y',safeNumber(Number(e.target.value),.1,100,6.5))}/></label>
            <label className="pa-field"><span>HORIZONTAL FOV</span><input disabled={!canChange} aria-label="Horizontal field of view" type="number" min="65" max="120" step="1" value={settings.fov} onChange={e=>update('fov',safeNumber(Number(e.target.value),65,120,103))}/></label>
          </div>
          <div className="pa-sens-metric"><small>ESTIMATED 360° DISTANCE</small><strong>{cm360?cm360.toFixed(1):'—'} <em>CM</em></strong><span>{Math.round(settings.dpi*settings.x/100)} eDPI · approximate Fortnite yaw</span></div>
          <div className="pa-sidebar-rule"/><div className="pa-section-heading"><div><span>PERFORMANCE OPTIONS</span><strong>GRAPHICS & FPS</strong></div><Gauge size={15}/></div>
          <label className="pa-field pa-block-field"><span>FRAME RATE LIMIT</span><select disabled={!canChange} value={settings.fpsLimit} onChange={e=>update('fpsLimit',Number(e.target.value))}>{[0,60,120,144,165,180,240,360].map(v=><option key={v} value={v}>{v?v+' FPS':'UNLIMITED (DISPLAY-BOUND)'}</option>)}</select></label>
          <label className="pa-field pa-block-field"><span>RENDER SCALE</span><select disabled={!canChange} value={settings.renderScale} onChange={e=>update('renderScale',Number(e.target.value))}>{[[.5,'50% — LOW LATENCY'],[.75,'75% — PERFORMANCE'],[1,'100% — NATIVE'],[1.25,'125% — SHARPER']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
          <label className="pa-field pa-block-field"><span>GRAPHICS PRESET</span><select disabled={!canChange} value={settings.quality} onChange={e=>update('quality',e.target.value as AimSettings['quality'])}><option value="performance">COMPETITIVE / PERFORMANCE</option><option value="balanced">BALANCED</option><option value="high">HIGH VISUALS</option></select></label>
          <label className="pa-toggle"><span>MULTISAMPLE ANTIALIASING<small>May reduce FPS on low-end GPUs</small></span><input type="checkbox" disabled={!canChange} checked={settings.antialias} onChange={e=>update('antialias',e.target.checked)}/></label>
          <div className="pa-sidebar-rule"/><div className="pa-section-heading"><div><span>CROSSHAIR CUSTOMISATION</span><strong>VISUAL SETTINGS</strong></div><Crosshair size={15}/></div>
          <label className="pa-field pa-block-field"><span>CROSSHAIR STYLE</span><select disabled={!canChange} value={settings.crosshair} onChange={e=>update('crosshair',e.target.value as AimSettings['crosshair'])}><option value="cross">PLUS CROSSHAIR</option><option value="dot">CENTER DOT</option><option value="ring">CENTER RING</option></select></label>
          <label className="pa-field pa-block-field"><span>CROSSHAIR COLOUR</span><select disabled={!canChange} value={settings.crosshairColor} onChange={e=>update('crosshairColor',e.target.value)}><option value="#ffffff">WHITE</option><option value="#50f5d1">MINT</option><option value="#ffef65">YELLOW</option><option value="#ff6e79">RED</option></select></label>
          <label className="pa-toggle"><span>HIT CONFIRMATION SOUND<small>Minimal synthetic feedback</small></span><input type="checkbox" disabled={!canChange} checked={settings.sound} onChange={e=>update('sound',e.target.checked)}/>{settings.sound?<Volume2 size={16}/>:<VolumeX size={16}/>}</label>
          <button className="pa-reset-settings" type="button" disabled={!canChange} onClick={()=>setSettings(DEFAULT_AIM_SETTINGS)}><RotateCcw size={14}/> RESTORE DEFAULT SETTINGS</button>
          <p className="pa-sidebar-hint">Actual FPS is measured, not promised. WebView2, monitor refresh, Windows input and GPU all affect latency. Close other resource-intensive apps if performance drops.</p>
        </div>}
      </aside>}
    </div>
    <footer className="pa-foot"><span><Zap size={14}/> PRECISION OVER NOISE.</span><span><BarChart3 size={14}/> ORIGINAL AIM TRAINER · NOT AFFILIATED WITH KOVAAK'S OR EPIC GAMES</span></footer>
  </div>;
}
