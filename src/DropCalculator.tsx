import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Activity, AlertCircle, ArrowRight, Check, Compass, ExternalLink, Flag, Gauge, Info, Map, MapPin, RotateCcw, Save, Settings2, Target, Trash2, Zap } from 'lucide-react';
import {
  defaultState, defaultPhysics,
  nearestOnBus, solve, styles, lerp, type DiveStyle, type DropState, type Point,
} from './dropPhysics';
import './drop-calculator.css';

type Marker='target'|'busStart'|'busEnd'|'ridge';
type StoredPlan={id:string;name:string;created:string;state:DropState};
type Calibration={id:string;date:string;estimated:number;actual:number;name:string};
const STORE='maqs-drop-physics-plans-v2';
const SETTINGS='maqs-drop-physics-settings-v2';
const CALIBRATION='maqs-drop-physics-calibration-v2';
const floor=(v:number,low:number,high:number)=>Math.max(low,Math.min(high,v));
const asPoint=(value:unknown,fallback:Point):Point=>{
  if(!value||typeof value!=='object')return fallback;
  const p=value as Record<string,unknown>;
  return Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:floor(Number(p.x),0,100),y:floor(Number(p.y),0,100)}:fallback;
};
function readArray<T>(key:string):T[]{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
function readState():DropState{
  try{
    const raw=JSON.parse(localStorage.getItem(SETTINGS)||'null') as Partial<DropState>|null;
    if(!raw)return defaultState;
    return {
      busStart:asPoint(raw.busStart,defaultState.busStart),busEnd:asPoint(raw.busEnd,defaultState.busEnd),
      target:asPoint(raw.target,defaultState.target),
      dive:raw.dive==='steep'||raw.dive==='balanced'||raw.dive==='shallow'?raw.dive:'auto',
      terrain:{...defaultState.terrain,...raw.terrain,ridge:asPoint(raw.terrain?.ridge,defaultState.terrain.ridge)},
      physics:{...defaultPhysics,...raw.physics},
    };
  }catch{return defaultState}
}
const fmt=(s:number)=>Number.isFinite(s)?`${s.toFixed(1)}s`:'—';
const meters=(s:number)=>`${Math.round(s).toLocaleString('en-GB')}m`;
const pct=(p:Point)=>`${p.x.toFixed(1)}%, ${p.y.toFixed(1)}%`;
const nodes:Record<Marker,{label:string;abbr:string}>={
  busStart:{label:'BUS START',abbr:'S'},busEnd:{label:'BUS END',abbr:'E'},target:{label:'LANDING TARGET',abbr:'T'},ridge:{label:'TERRAIN RIDGE',abbr:'R'},
};
const physicsFields: {key:keyof typeof defaultPhysics;label:string;unit:string;min:number;max:number;step:number;description:string}[]=[
  {key:'mapWidth',label:'Map width',unit:'m',min:2000,max:6000,step:50,description:'Scale of the visible island map, left to right'},
  {key:'busSpeed',label:'Bus speed',unit:'m/s',min:30,max:130,step:1,description:'Speed of the Battle Bus along its line'},
  {key:'busAltitude',label:'Bus height',unit:'m',min:450,max:1400,step:10,description:'Height at jump relative to ground baseline'},
  {key:'fallVertical',label:'Nosedive descent',unit:'m/s',min:25,max:90,step:.5,description:'Maximum steep-dive vertical descent rate'},
  {key:'fallHorizontal',label:'Steering travel',unit:'m/s',min:5,max:48,step:.5,description:'Balanced freefall horizontal steering speed'},
  {key:'glideHorizontal',label:'Glide travel',unit:'m/s',min:8,max:42,step:.5,description:'Horizontal travel rate with deployed glider'},
  {key:'glideVertical',label:'Glide descent',unit:'m/s',min:3,max:16,step:.1,description:'Altitude lost each second gliding'},
  {key:'autoDeploy',label:'Auto deploy AGL',unit:'m',min:30,max:300,step:5,description:'Height above the terrain below the player'},
];

export function DropCalculator(){
  const [state,setState]=useState<DropState>(readState);
  const [marker,setMarker]=useState<Marker>('target');
  const [dragging,setDragging]=useState<Marker|null>(null);
  const [mapUrl,setMapUrl]=useState('');
  const [mapReady,setMapReady]=useState(false);
  const [mapError,setMapError]=useState('');
  const [showModel,setShowModel]=useState(false);
  const [showTerrain,setShowTerrain]=useState(false);
  const [planName,setPlanName]=useState('GRAND FINALS DROP');
  const [saved,setSaved]=useState<StoredPlan[]>(()=>readArray<StoredPlan>(STORE));
  const [runs,setRuns]=useState<Calibration[]>(()=>readArray<Calibration>(CALIBRATION));
  const [actualTime,setActualTime]=useState('');
  const [elapsed,setElapsed]=useState(0);
  const [playing,setPlaying]=useState(false);
  const mapRef=useRef<SVGSVGElement>(null);
  const output=useMemo(()=>solve(state),[state]);
  const best=output.best;
  useEffect(()=>{setPlaying(false);setElapsed(0)},[best?.totalSeconds,best?.jumpFraction,best?.dive]);
  useEffect(()=>{
    if(!playing||!best)return;
    const id=window.setInterval(()=>setElapsed(t=>{
      const next=t+.1;
      if(next>=best.totalSeconds){setPlaying(false);return best.totalSeconds}
      return next;
    }),100);
    return ()=>window.clearInterval(id);
  },[playing,best]);
  const playbackPoint=best?elapsed<=best.busSeconds
    ?lerp(state.busStart,best.jump,best.busSeconds>0?elapsed/best.busSeconds:1)
    :elapsed<=best.busSeconds+best.fallSeconds
    ?lerp(best.jump,best.deploy,best.fallSeconds>0?(elapsed-best.busSeconds)/best.fallSeconds:1)
    :lerp(best.deploy,state.target,best.glideSeconds>0?(elapsed-best.busSeconds-best.fallSeconds)/best.glideSeconds:1)
    :null;
  const playbackPhase=best?(elapsed<best.busSeconds?'BUS':elapsed<best.busSeconds+best.fallSeconds?'FREEFALL':'GLIDER'):'—';
  const nearest=nearestOnBus(state.busStart,state.busEnd,state.target);
  const predicted=best?.totalSeconds??null;
  const calibrationBias=runs.length?runs.reduce((sum,r)=>sum+r.actual-r.estimated,0)/runs.length:null;

  useEffect(()=>{localStorage.setItem(SETTINGS,JSON.stringify(state))},[state]);
  useEffect(()=>{localStorage.setItem(STORE,JSON.stringify(saved))},[saved]);
  useEffect(()=>{localStorage.setItem(CALIBRATION,JSON.stringify(runs))},[runs]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('https://fortnite-api.com/v1/map?language=en',{signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error(`Map API ${r.status}`);return r.json()})
      .then(json=>{
        const url=json?.data?.images?.blank||json?.data?.images?.pois;
        if(typeof url==='string'&&url.startsWith('https://'))setMapUrl(url);
        else throw Error('No minimap image available');
      })
      .catch(e=>{if(!controller.signal.aborted)setMapError(String(e))});
    return ()=>controller.abort();
  },[]);

  const putPoint=(type:Marker,point:Point)=>{
    setState(prev=>type==='ridge'?{...prev,terrain:{...prev.terrain,ridge:point}}:{...prev,[type]:point});
  };
  const coordsFromEvent=(e:PointerEvent<SVGSVGElement>):Point=>{
    const svg=mapRef.current;
    if(!svg)return {x:50,y:50};
    const rect=svg.getBoundingClientRect();
    // viewBox remains square and is rendered in a square container.
    return {x:floor((e.clientX-rect.left)*100/rect.width,0,100),y:floor((e.clientY-rect.top)*100/rect.height,0,100)};
  };
  const onPointerDown=(e:PointerEvent<SVGSVGElement>)=>{
    if(e.button!==0)return;
    const element=e.target as Element;
    const type=element.closest('[data-marker]')?.getAttribute('data-marker') as Marker|null;
    const chosen=type||marker;
    setDragging(chosen);
    e.currentTarget.setPointerCapture(e.pointerId);
    putPoint(chosen,coordsFromEvent(e));
  };
  const onPointerMove=(e:PointerEvent<SVGSVGElement>)=>{
    if(dragging)putPoint(dragging,coordsFromEvent(e));
  };
  const stopDrag=()=>setDragging(null);
  const setNum=(key:keyof typeof defaultPhysics,num:number,min:number,max:number)=>{
    if(Number.isNaN(num))return;
    setState(prev=>({...prev,physics:{...prev.physics,[key]:floor(num,min,max)}}));
  };
  const setTerrain=(key:'targetElevation'|'ridgeHeight'|'ridgeRadius',num:number,min:number,max:number)=>{
    if(Number.isNaN(num))return;
    setState(prev=>({...prev,terrain:{...prev.terrain,[key]:floor(num,min,max)}}));
  };
  const reset=()=>{setState(defaultState);setMarker('target')};
  const save=()=>setSaved(prev=>[{id:String(Date.now()),name:planName.trim()||'MY DROP',created:new Date().toISOString(),state:structuredClone(state)},...prev].slice(0,35));
  const load=(p:StoredPlan)=>{
    const s=p.state;
    if(!s||!s.target||!s.busStart||!s.busEnd)return;
    setState({...defaultState,...s,physics:{...defaultPhysics,...s.physics},terrain:{...defaultState.terrain,...s.terrain}});
    setPlanName(p.name);
  };
  const logAttempt=()=>{
    const actual=Number(actualTime);
    if(!predicted||!Number.isFinite(actual)||actual<5||actual>300)return;
    setRuns(prev=>[{id:String(Date.now()),date:new Date().toISOString(),name:planName,actual,estimated:predicted},...prev].slice(0,30));
    setActualTime('');
  };
  const glideMax=best?best.glideSeconds*state.physics.glideHorizontal:0;
  const labelText=mapReady?'LIVE MINIMAP IMAGE · NOT A TERRAIN HEIGHTMAP':'FALLBACK MAP GRID · LIVE IMAGE UNAVAILABLE';
  return <section className="dc-page">
    <header className="dc-heading">
      <div><div className="dc-overline"><Zap size={13}/> MAQ'S PASSION / DROP ENGINE V2</div><h1>DROP CALCULATOR<span>.</span></h1><p>Optimise your jump, dive profile and glider deployment across the full bus route. Every candidate is simulated against flight speeds, height and optional terrain obstacles.</p></div>
      <span className="dc-mode-label"><Activity size={15}/> CUSTOM PHYSICS MODEL</span>
    </header>

    <div className="dc-banner"><Info size={17}/><p><strong>Physics-informed, not game-file exact.</strong> Fortnite's live movement constants and terrain heightmap are not available through this app. Default rates are community-informed estimates; tune them against your own recorded drops. The live map image is visual only.</p></div>

    <div className="dc-layout">
      <div className="dc-primary">
        <div className="dc-map-card">
          <div className="dc-card-top"><div><strong>FLIGHT PLANNER</strong><small>DRAG MARKERS OR CLICK THE MAP</small></div><button className="dc-outline" onClick={reset}><RotateCcw size={14}/> RESET</button></div>
          <div className="dc-marker-toolbar">
            {(['target','busStart','busEnd',...(state.terrain.ridgeEnabled?['ridge' as Marker]:[])] as Marker[]).map((id)=><button key={id} className={marker===id?'is-active':''} onClick={()=>setMarker(id)}><span>{nodes[id].abbr}</span>{nodes[id].label}</button>)}
          </div>
          <div className="dc-map-container"><svg ref={mapRef} className="dc-svg" viewBox="0 0 1000 1000" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} role="img" aria-label="Interactive Fortnite map with Battle Bus start, end, target and calculated jump and deployment markers">
            <defs><pattern id="dc-map-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#393939" strokeWidth="1"/></pattern><radialGradient id="dc-sea"><stop stopColor="#303030"/><stop offset="1" stopColor="#111111"/></radialGradient></defs>
            <rect width="1000" height="1000" fill="url(#dc-sea)"/>
            {mapUrl&&<image href={mapUrl} x="0" y="0" width="1000" height="1000" preserveAspectRatio="none" opacity="0.81" onLoad={()=>{setMapReady(true);setMapError('')}} onError={()=>{setMapReady(false);setMapError('Unable to display the current minimap')}} style={{pointerEvents:'none'}}/>}
            <rect width="1000" height="1000" fill="url(#dc-map-grid)" opacity={mapReady ? 0.30 : 0.70}/>
            {state.terrain.ridgeEnabled&&<g style={{pointerEvents:'none'}}><circle cx={state.terrain.ridge.x*10} cy={state.terrain.ridge.y*10} r={state.terrain.ridgeRadius*10000/state.physics.mapWidth} fill="#d4d4d4" fillOpacity=".1" stroke="#d4d4d4" strokeWidth="2" strokeDasharray="12 7"/><text x={state.terrain.ridge.x*10} y={state.terrain.ridge.y*10-30} fill="white" stroke="black" strokeWidth="4" paintOrder="stroke" textAnchor="middle" fontSize="19" fontWeight="900">RIDGE {state.terrain.ridgeHeight}m</text></g>}
            <path d={`M${state.busStart.x*10},${state.busStart.y*10} L${state.busEnd.x*10},${state.busEnd.y*10}`} stroke="#000" strokeWidth="10" strokeLinecap="round" opacity=".7"/>
            <path d={`M${state.busStart.x*10},${state.busStart.y*10} L${state.busEnd.x*10},${state.busEnd.y*10}`} stroke="#fff" strokeWidth="5" strokeDasharray="15 9" strokeLinecap="round"/>
            {best&&<><path d={`M${best.jump.x*10},${best.jump.y*10} L${best.deploy.x*10},${best.deploy.y*10}`} stroke="#000" strokeWidth="11"/><path d={`M${best.jump.x*10},${best.jump.y*10} L${best.deploy.x*10},${best.deploy.y*10}`} stroke="#ededed" strokeWidth="5"/><path d={`M${best.deploy.x*10},${best.deploy.y*10} L${state.target.x*10},${state.target.y*10}`} stroke="#000" strokeWidth="11"/><path d={`M${best.deploy.x*10},${best.deploy.y*10} L${state.target.x*10},${state.target.y*10}`} stroke="#9b9b9b" strokeWidth="6" strokeDasharray="11 7"/></>}
            {!best&&<line x1={nearest.point.x*10} y1={nearest.point.y*10} x2={state.target.x*10} y2={state.target.y*10} stroke="#999" strokeWidth="4" strokeDasharray="7 9"/>}
            {best&&<g transform={`translate(${best.deploy.x*10},${best.deploy.y*10})`} style={{pointerEvents:'none'}}><circle r="15" fill="#e9e9e9" stroke="#000" strokeWidth="5"/><text y="-22" fontSize="19" textAnchor="middle" fill="#fff" stroke="#000" strokeWidth="5" paintOrder="stroke" fontWeight="900">DEPLOY</text></g>}
            {best&&<g transform={`translate(${best.jump.x*10},${best.jump.y*10})`} style={{pointerEvents:'none'}}><circle r="15" fill="#fff" stroke="#111" strokeWidth="5"/><text y="-22" fontSize="19" textAnchor="middle" fill="#fff" stroke="#000" strokeWidth="5" paintOrder="stroke" fontWeight="900">JUMP</text></g>}
            {playbackPoint&&<g transform={`translate(${playbackPoint.x*10},${playbackPoint.y*10})`} style={{pointerEvents:'none'}}><circle r="25" fill="#fff" fillOpacity=".22" stroke="#fff" strokeWidth="2"/><circle r="8" fill="#fff"/><text y="-37" textAnchor="middle" fontWeight="900" fontSize="17" fill="#fff" stroke="#000" paintOrder="stroke" strokeWidth="5">{playbackPhase}</text></g>}
            {(['busStart','busEnd','target',...(state.terrain.ridgeEnabled?['ridge' as Marker]:[])] as Marker[]).map(id=>{
              const point=id==='ridge'?state.terrain.ridge:state[id];
              return <g key={id} data-marker={id} transform={`translate(${point.x*10},${point.y*10})`} className="dc-map-marker"><circle r="26" fill="transparent"/><circle r={id==='target'?18:14} fill={id==='target'?'#fff':'#202020'} stroke="#fff" strokeWidth="5"/><text x="0" y="6" fontSize="18" textAnchor="middle" fill={id==='target'?'#111':'#fff'} fontWeight="900">{nodes[id].abbr}</text><text y={id==='target'?'-26':'-23'} textAnchor="middle" fontSize="18" fill="white" paintOrder="stroke" stroke="#000" strokeWidth="5" fontWeight="900">{nodes[id].label}</text></g>;
            })}
          </svg>
          <div className="dc-map-flag"><Map size={14}/>{labelText}</div>
          <div className="dc-map-scale">MAP WIDTH {state.physics.mapWidth.toLocaleString('en-GB')} m · MODEL COORDINATES</div>
          </div>
          <div className="dc-map-legend"><span><i className="dc-line solid"/> FREEFALL</span><span><i className="dc-line dash"/> GLIDER</span><span>SELECTED: {nodes[marker].label}</span></div>
        </div>
        <div className="dc-results-card">
          <div className="dc-card-top"><div><strong>OPTIMISED DROP PLAN</strong><small>{best?'FASTEST VALID PATH IN SIMULATION':'NO FEASIBLE PATH WITH THESE SETTINGS'}</small></div><span className="dc-status">{best?<><Check size={13}/> SOLVED</>:<><AlertCircle size={13}/> REVIEW ROUTE</>}</span></div>
          {best?<>
            <div className="dc-stats-grid">
              <div className="dc-stat dc-stat-main"><span>JUMP AFTER BUS START</span><strong>{fmt(best.busSeconds)}</strong><small>{(best.jumpFraction*100).toFixed(1)}% along the bus route</small></div>
              <div className="dc-stat dc-stat-main"><span>EST. TOTAL TIME</span><strong>{fmt(best.totalSeconds)}</strong><small>Bus + falling + gliding</small></div>
              <div className="dc-stat"><span>AUTO / MANUAL DEPLOY</span><strong>{fmt(best.fallSeconds)}</strong><small>After jumping</small></div>
              <div className="dc-stat"><span>GLIDER FLIGHT</span><strong>{fmt(best.glideSeconds)}</strong><small>{meters(best.glideDistance)} remaining</small></div>
            </div>
            <div className="dc-replay"><div className="dc-replay-head"><span><Activity size={14}/> FLIGHT REPLAY · {playbackPhase}</span><b>{fmt(elapsed)} / {fmt(best.totalSeconds)}</b></div><input aria-label="Scrub through simulated flight" type="range" min="0" max={best.totalSeconds} step="0.1" value={Math.min(elapsed,best.totalSeconds)} onChange={e=>{setPlaying(false);setElapsed(Number(e.target.value))}}/><div className="dc-replay-buttons"><button onClick={()=>{if(elapsed>=best.totalSeconds)setElapsed(0);setPlaying(v=>!v)}}>{playing?'PAUSE FLIGHT':'PLAY FLIGHT'}</button><button onClick={()=>{setPlaying(false);setElapsed(0)}}>RESTART</button></div></div>
            <div className="dc-flight-steps">
              <div><span className="dc-number">01</span><div><strong>JUMP</strong><p>Exit {best.busSeconds.toFixed(1)}s after entering the route ({pct(best.jump)}).</p></div></div>
              <div><span className="dc-number">02</span><div><strong>DIVE · {best.dive.toUpperCase()}</strong><p>Head towards the landing mark at ~{best.angle.toFixed(0)}° below horizontal. Estimated dive travel: {meters(best.diveDistance)}.</p></div></div>
              <div><span className="dc-number">03</span><div><strong>GLIDER DEPLOY</strong><p>At {pct(best.deploy)} after {best.fallSeconds.toFixed(1)}s airborne. Estimated altitude {Math.round(best.deployAltitude)}m above model baseline.</p></div></div>
              <div><span className="dc-number">04</span><div><strong>LAND</strong><p>Glide for ~{best.glideSeconds.toFixed(1)}s. Full landing ETA: {fmt(best.totalSeconds)} from bus start.</p></div></div>
            </div>
            <div className="dc-secondary-stats"><div><span>FREEFALL ANGLE</span><b>{best.angle.toFixed(0)}°</b></div><div><span>GLIDER CAPACITY</span><b>{meters(glideMax)}</b></div><div><span>NEAREST POINT ETA</span><b>{output.nearest?fmt(output.nearest.totalSeconds):'Unreachable'}</b></div><div><span>MODEL SAVING</span><b>{output.nearest?`${Math.max(0,output.nearest.totalSeconds-best.totalSeconds).toFixed(1)}s`:'N/A'}</b></div></div>
          </>:<div className="dc-no-solution"><AlertCircle size={27}/><strong>NO PHYSICALLY FEASIBLE LANDING FOUND</strong><p>Under these speed, height and ridge assumptions, none of {output.checked} candidate paths can reach your target before reaching terrain. Try a closer bus route, higher altitude, another dive profile or lower ridge.</p></div>}
        </div>
      </div>
      <aside className="dc-side">
        <div className="dc-panel"><div className="dc-panel-heading"><Compass size={17}/> FLIGHT CONTROLS</div>
          <label className="dc-field"><span>DIVE PROFILE</span><select value={state.dive} onChange={e=>setState(s=>({...s,dive:e.target.value as DropState['dive']}))}><option value="auto">AUTO — OPTIMISE ALL 3</option><option value="steep">STEEP · FAST DESCENT</option><option value="balanced">BALANCED · STANDARD</option><option value="shallow">SHALLOW · MORE DRIFT</option></select></label>
          <div className="dc-hint">{state.dive==='auto'?'The solver compares all three dive profiles to pick the earliest feasible landing.':styles[state.dive as DiveStyle].description}</div>
          <div className="dc-toggle-row"><div><b>EARLY GLIDER DEPLOY</b><small>Manually open above the auto-deploy threshold</small></div><input type="checkbox" checked={state.physics.earlyDeploy} onChange={e=>setState(s=>({...s,physics:{...s.physics,earlyDeploy:e.target.checked}}))}/></div>
          {state.physics.earlyDeploy&&<label className="dc-field"><span>MANUAL DEPLOY HEIGHT · {state.physics.manualDeploy}m AGL</span><input type="range" min={state.physics.autoDeploy} max="380" step="5" value={Math.max(state.physics.autoDeploy,state.physics.manualDeploy)} onChange={e=>setNum('manualDeploy',Number(e.target.value),state.physics.autoDeploy,380)}/></label>}
          <div className="dc-twin-buttons"><button onClick={()=>setState(s=>({...s,busStart:{x:8,y:50},busEnd:{x:92,y:50}}))}>WEST → EAST BUS</button><button onClick={()=>setState(s=>({...s,busStart:{x:50,y:8},busEnd:{x:50,y:92}}))}>NORTH → SOUTH BUS</button></div>
        </div>
        <div className="dc-panel"><button className="dc-expander" onClick={()=>setShowTerrain(v=>!v)} aria-expanded={showTerrain}><span><MapPin size={16}/> TERRAIN & HEIGHT</span><b>{showTerrain?'−':'+'}</b></button>
          <div className="dc-hint">Landing elevation changes the glide path. Optionally position a ridge to model early deploy or blocked glide lines. This is manually defined geometry, not an automatically surveyed Fortnite terrain map.</div>
          {showTerrain&&<div className="dc-expanded">
            <label className="dc-field"><span>LANDING ELEVATION · {state.terrain.targetElevation}m</span><input type="range" min="0" max="350" step="5" value={state.terrain.targetElevation} onChange={e=>setTerrain('targetElevation',Number(e.target.value),0,350)}/></label>
            <div className="dc-toggle-row"><div><b>ADD TERRAIN RIDGE</b><small>Drag R marker on the map</small></div><input type="checkbox" checked={state.terrain.ridgeEnabled} onChange={e=>setState(s=>({...s,terrain:{...s.terrain,ridgeEnabled:e.target.checked}}))}/></div>
            {state.terrain.ridgeEnabled&&<><label className="dc-field"><span>RIDGE SUMMIT · {state.terrain.ridgeHeight}m</span><input type="range" min="20" max="500" step="5" value={state.terrain.ridgeHeight} onChange={e=>setTerrain('ridgeHeight',Number(e.target.value),20,500)}/></label><label className="dc-field"><span>RIDGE RADIUS · {state.terrain.ridgeRadius}m</span><input type="range" min="70" max="500" step="10" value={state.terrain.ridgeRadius} onChange={e=>setTerrain('ridgeRadius',Number(e.target.value),70,500)}/></label></>}
          </div>}
        </div>
        <div className="dc-panel"><button className="dc-expander" onClick={()=>setShowModel(v=>!v)} aria-expanded={showModel}><span><Settings2 size={16}/> PHYSICS ENGINE</span><b>{showModel?'−':'+'}</b></button>
          <div className="dc-hint">Starting assumptions are editable. The optimizer recalculates as soon as you change a number.</div>
          {showModel&&<div className="dc-expanded">{physicsFields.map(f=><label className="dc-physics-field" key={f.key}><span>{f.label}</span><div><input type="number" min={f.min} max={f.max} step={f.step} value={Number(state.physics[f.key])} onChange={e=>setNum(f.key,Number(e.target.value),f.min,f.max)}/><small>{f.unit}</small></div><em>{f.description}</em></label>)}<button className="dc-outline dc-full" onClick={()=>setState(s=>({...s,physics:defaultPhysics}))}><RotateCcw size={14}/> RESTORE MODEL DEFAULTS</button></div>}
        </div>
        <div className="dc-panel"><div className="dc-panel-heading"><Save size={17}/> SAVED DROPS</div>
          <label className="dc-field"><span>DROP NAME</span><input value={planName} maxLength={40} onChange={e=>setPlanName(e.target.value)} placeholder="Name this drop"/></label><button className="dc-primary-btn" onClick={save}><Save size={14}/> SAVE CURRENT ROUTE</button>
          <div className="dc-saved-list">{saved.length===0?<p>No saved drops yet.</p>:saved.map(p=><div className="dc-saved-row" key={p.id}><button onClick={()=>load(p)} title="Load this route"><Target size={15}/><span>{p.name}</span><ArrowRight size={14}/></button><button onClick={()=>setSaved(prev=>prev.filter(x=>x.id!==p.id))} aria-label={`Delete ${p.name}`}><Trash2 size={14}/></button></div>)}</div>
        </div>
      </aside>
    </div>
    <div className="dc-bottom-panels">
      <div className="dc-panel"><div className="dc-panel-heading"><Gauge size={18}/> REAL-DROP CALIBRATION</div><p className="dc-subtext">Time one of your own drops from the start of the bus route to touching down. Compare against the calculated result to track model error over multiple games.</p><div className="dc-calibration-form"><input type="number" min="5" max="300" step="0.1" placeholder="Observed landing time (seconds)" aria-label="Observed landing time seconds" value={actualTime} onChange={e=>setActualTime(e.target.value)}/><button onClick={logAttempt} disabled={!best||!actualTime||Number(actualTime)<5||Number(actualTime)>300}>LOG RESULT</button></div>
        <div className="dc-calibration-stats"><div><span>OBSERVATIONS</span><strong>{runs.length}</strong></div><div><span>AVERAGE TIME ERROR</span><strong>{calibrationBias===null?'—':`${calibrationBias>=0?'+':''}${calibrationBias.toFixed(1)}s`}</strong></div><div><span>EST. ADJUSTED ETA</span><strong>{best&&calibrationBias!==null?fmt(best.totalSeconds+calibrationBias):'—'}</strong></div></div>
        <div className="dc-calibration-history">{runs.slice(0,5).map(r=><div key={r.id}><span>{r.name}</span><b>EST {fmt(r.estimated)} / ACTUAL {fmt(r.actual)}</b></div>)}</div>
        {runs.length>0&&<button className="dc-reset-history" onClick={()=>setRuns([])}><Trash2 size={12}/> CLEAR CALIBRATION HISTORY</button>}
      </div>
      <div className="dc-panel"><div className="dc-panel-heading"><Flag size={18}/> HOW TO USE / ACCURACY</div>
        <ol className="dc-howto"><li>Drag S and E to match the Battle Bus route on the current map.</li><li>Drag T onto the exact roof, chest or landing point.</li><li>Enter landing elevation and model a ridge if your destination has high terrain.</li><li>Use the estimated jump time, dive style and deployment marker as your training route.</li><li>Record actual drop times to see how far the model differs from real gameplay.</li></ol>
        <div className="dc-limitations"><AlertCircle size={16}/><span>NOT pixel-perfect: terrain, game-update speed changes, server tick, bus-entry timing, inputs and glide controls may all affect real drops. Use this to practise, then calibrate.</span></div>
        <div className="dc-source-links"><a href="https://dev.epicgames.com/documentation/fortnite/battle-bus" target="_blank" rel="noreferrer">EPIC GLIDER MECHANICS <ExternalLink size={13}/></a><a href="https://fortnite-api.com/" target="_blank" rel="noreferrer">MAP IMAGE SOURCE <ExternalLink size={13}/></a></div>
        {mapError&&<p className="dc-map-error">Map image unavailable: {mapError}. The calculator remains functional on a coordinate grid.</p>}
      </div>
    </div>
  </section>;
}
