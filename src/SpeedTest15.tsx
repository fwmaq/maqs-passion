import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Activity, ArrowDownToLine, ArrowUpFromLine, Gauge, Wifi, ShieldCheck } from 'lucide-react';
import './speed-test-15.css';

type Phase='idle'|'latency'|'download'|'upload'|'done'|'failed';
type Sample={mbps:number;bytes:number;seconds:number;samples:number};
type Latency={latency_ms:number;jitter_ms:number;samples:number};
const timeMs=15000;
const fmt=(n:number|null,d=1)=>n===null?'—':n.toFixed(d);
function assessment(download:number,upload:number,ping:number,jitter:number){
 const notes:{title:string;grade:string;note:string}[]=[];
 const adequateDownload=download>=15, adequateUpload=upload>=5;
 notes.push({title:'Download headroom',grade:download>=50?'STRONG':adequateDownload?'SUFFICIENT':'LIMITED',note:adequateDownload?'Enough bandwidth for Fortnite itself under normal conditions. Network contention from downloads can still hurt latency.':'Low download headroom. Pause launchers, streams and background transfers before competing.'});
 notes.push({title:'Upload headroom',grade:upload>=15?'STRONG':adequateUpload?'SUFFICIENT':'LIMITED',note:adequateUpload?'Generally sufficient upload capacity for online matches and voice communication. Keep cloud sync off during tournaments.':'Upload saturation could increase delay, particularly during streaming, uploads or cloud backups.'});
 notes.push({title:'Network responsiveness',grade:ping<=35?'PROMISING':ping<=70?'VARIABLE':'HIGH RTT',note:ping<=35?'HTTP round-trip latency to this test server is low. In-game ping can be very different.':ping<=70?'Some response delay to the test server. Check your actual Fortnite matchmaking region and in-game network graph.':'High measured HTTP round-trip latency. Check router congestion, Wi-Fi interference, VPNs and game-region selection.'});
 notes.push({title:'Timing stability',grade:jitter<=5?'STABLE':jitter<=15?'MODERATE':'UNSTABLE',note:jitter<=5?'Small variation between idle HTTP round trips. This does not guarantee low loaded latency or zero packet loss.':jitter<=15?'Moderate timing variation. Test a wired connection and avoid competing uploads/downloads.':'Large latency variations may correspond to inconsistent game feel. Try Ethernet and diagnose local congestion.'});
 const total=notes.filter(n=>['STRONG','SUFFICIENT','PROMISING','STABLE'].includes(n.grade)).length;
 const heading=total===4?'PROMISING FOR COMP':total>=2?'POTENTIALLY SUITABLE':'NEEDS INVESTIGATION';
 const verdict='This is a preliminary connection assessment, not a Fortnite server or packet-loss test. Raw Mbps alone does not predict edit registration, input delay, or tournament ping.';
 return {heading,notes,verdict};
}
export function SpeedTest15(){
 const [phase,setPhase]=useState<Phase>('idle');
 const [seconds,setSeconds]=useState(15);
 const [download,setDownload]=useState<Sample|null>(null);
 const [upload,setUpload]=useState<Sample|null>(null);
 const [latency,setLatency]=useState<Latency|null>(null);
 const [error,setError]=useState('');
 const [liveDownload,setLiveDownload]=useState<number|null>(null);
 const [liveUpload,setLiveUpload]=useState<number|null>(null);
 const [liveBytes,setLiveBytes]=useState(0);
 const [trace,setTrace]=useState<number[]>([]);
 const running=useRef(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;let disposed=false;let unlisten:undefined|(()=>void);listen<{phase:string;mbps:number;bytes:number;seconds:number;samples:number}>('speed-progress',event=>{if(!mounted.current)return;const p=event.payload;if(p.phase==='download')setLiveDownload(p.mbps);else setLiveUpload(p.mbps);setLiveBytes(p.bytes);setTrace(old=>[...old.slice(-69),p.mbps]);}).then(fn=>{if(disposed)fn();else unlisten=fn}).catch(console.error);return ()=>{mounted.current=false;disposed=true;unlisten?.();}},[]);
 const clock=async(job:Promise<Sample>,name:'download'|'upload')=>{
  const start=performance.now(); setPhase(name); setSeconds(15);setLiveBytes(0);setTrace([]);
  const ticker=window.setInterval(()=>{if(mounted.current)setSeconds(Math.max(0,Math.ceil((timeMs-(performance.now()-start))/1000)))},100);
  try{const result=await job; if(name==='download')setDownload(result);else setUpload(result);setSeconds(0);return result;}
  finally{window.clearInterval(ticker)}
 };
 const run=async()=>{
  if(running.current)return;
  running.current=true;setError('');setDownload(null);setUpload(null);setLatency(null);setPhase('latency');
  try{
   const l=await invoke<Latency>('speed_latency');if(!mounted.current)return;setLatency(l);
   await clock(invoke<Sample>('speed_phase',{phase:'download'}),'download');if(!mounted.current)return;
   await clock(invoke<Sample>('speed_phase',{phase:'upload'}),'upload');if(!mounted.current)return;
   setPhase('done');
  }catch(e){if(mounted.current){setPhase('failed');setError(String(e))}}
  finally{running.current=false}
 };
 const report=phase==='done'&&download&&upload&&latency?assessment(download.mbps,upload.mbps,latency.latency_ms,latency.jitter_ms):null;
 return <section className="st-page">
  <header className="st-head"><span>REAL NETWORK MEASUREMENT</span><h1>INTERNET SPEED<span>.</span></h1><p>15 seconds of sustained downloading followed by 15 seconds of sustained uploading to Cloudflare. Includes idle HTTP latency, jitter and a Fortnite competitive suitability report.</p></header>
  <div className="st-layout"><section className="st-main"><div className="st-phase"><span>{phase==='idle'?'READY TO MEASURE':phase==='latency'?'MEASURING IDLE LATENCY':phase==='download'?'TEST 01 / DOWNLOAD':phase==='upload'?'TEST 02 / UPLOAD':phase==='failed'?'TEST FAILED':'RESULTS READY'}</span><span>{phase==='download'||phase==='upload'?`${seconds}s REMAINING`:phase==='done'?'COMPLETE':''}</span></div>
   <div className="st-ring"><svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="95" stroke="#292929" strokeWidth="12" fill="none"/><circle cx="120" cy="120" r="95" stroke="#f2f2f2" strokeWidth="12" fill="none" strokeDasharray="597" strokeDashoffset={597*(1-(phase==='done'?1:phase==='upload'?1-seconds/30:phase==='download'?(15-seconds)/30:0))} strokeLinecap="round" transform="rotate(-90 120 120)" style={{transition:'stroke-dashoffset .12s linear'}}/></svg><div className="st-ringtext"><strong>{phase==='download'||phase==='upload'?seconds:phase==='done'?'30':'—'}</strong><span>{phase==='download'||phase==='upload'?'SECONDS':phase==='done'?'SECONDS TESTED':'START A TEST'}</span></div></div>
   {(phase==='download'||phase==='upload')&&<div className='st-live-readout'><span>LIVE {phase.toUpperCase()} THROUGHPUT</span><strong>{fmt(phase==='download'?liveDownload:liveUpload)} <small>Mbps</small></strong><span>{(liveBytes/1e6).toFixed(1)} MB transferred · updated after every completed transfer</span><svg viewBox='0 0 520 60' preserveAspectRatio='none' aria-label='Live speed graph'><polyline points={trace.map((v,i)=>`${i*520/Math.max(1,trace.length-1)},${60-Math.min(59,v/Math.max(1,...trace)*54)}`).join(' ')} stroke='#fff' strokeWidth='2' fill='none'/></svg></div>}
   <div className="st-progressbars"><div><span>DOWNLOAD / 15 SECONDS</span><strong>{fmt(phase==='download'?liveDownload:download?.mbps??null)} Mbps</strong><div><i style={{width:`${phase==='upload'||phase==='done'?100:phase==='download'?(15-seconds)/15*100:0}%`}}/></div></div><div><span>UPLOAD / 15 SECONDS</span><strong>{fmt(phase==='upload'?liveUpload:upload?.mbps??null)} Mbps</strong><div><i style={{width:`${phase==='done'?100:phase==='upload'?(15-seconds)/15*100:0}%`}}/></div></div></div>
   <button className="st-run" disabled={running.current||phase==='latency'||phase==='download'||phase==='upload'} onClick={run}><Gauge size={20}/>{phase==='idle'?'START 30-SECOND TEST':phase==='done'||phase==='failed'?'RUN AGAIN':'MEASURING...'}</button>
   {error&&<p className="st-error">Test couldn't finish: {error}. The connection to the test server may be unavailable. No speed results have been invented.</p>}
   <p className="st-small">The full run takes about 30 seconds plus a short latency pre-check. It consumes real bandwidth and mobile hotspot data. Upload and download tests run separately.</p>
  </section><aside className="st-aside"><div className="st-card"><ArrowDownToLine size={20}/><span>DOWNLOAD</span><strong>{fmt(phase==='download'?liveDownload:download?.mbps??null)} <small>Mbps</small></strong></div><div className="st-card"><ArrowUpFromLine size={20}/><span>UPLOAD</span><strong>{fmt(phase==='upload'?liveUpload:upload?.mbps??null)} <small>Mbps</small></strong></div><div className="st-card"><Wifi size={20}/><span>IDLE HTTP LATENCY</span><strong>{fmt(latency?.latency_ms??null,0)} <small>ms</small></strong></div><div className="st-card"><Activity size={20}/><span>IDLE JITTER</span><strong>{fmt(latency?.jitter_ms??null,0)} <small>ms</small></strong></div></aside></div>
  {report&&<section className="st-report"><div className="st-reporthead"><ShieldCheck size={23}/><div><small>MAQ'S PASSION / COMPETITIVE NETWORK ANALYSIS</small><h2>{report.heading}</h2></div></div><p>{report.verdict}</p><div className="st-reportgrid">{report.notes.map(n=><div key={n.title}><div className="st-reporttitle"><strong>{n.title}</strong><span>{n.grade}</span></div><p>{n.note}</p></div>)}</div><div className="st-recommendations"><h3>BEFORE AN FNCS SESSION</h3><ol><li>Check your ping and packet loss in Fortnite's own Net Debug Stats during an actual match.</li><li>Test Ethernet against Wi-Fi, and stop background downloads, streaming uploads or cloud sync.</li><li>Compare latency when your household connection is busy; bufferbloat may cause spikes even with high Mbps.</li><li>If your game ping is inconsistent, test different supported matchmaking regions and check for packet loss.</li></ol></div><p className="st-small">Download: {(download!.bytes/1e6).toFixed(1)} MB transferred in {download!.seconds.toFixed(1)} s across {download!.samples} samples. Upload: {(upload!.bytes/1e6).toFixed(1)} MB sent in {upload!.seconds.toFixed(1)} s across {upload!.samples} samples. Measurements are to Cloudflare, not Epic.</p></section>}
 </section>
}
