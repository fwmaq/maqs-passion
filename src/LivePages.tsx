import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, ImageOff, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import { parseShop } from './shopParser';
import type { ShopEntry } from './shopParser';
import './live-pages.css';
import './shop-v213.css';
const API = 'https://fortnite-api.com/v2/shop?language=en';
const CACHE_KEY = 'mp:shop:cache:v3';
const readCache = ():ShopEntry[] => {try{const entries=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');return Array.isArray(entries)?entries:[];}catch{return [];}};
function resetCountdown(now:number) {
  const reset=new Date(now);reset.setUTCHours(24,0,0,0);
  const s=Math.max(0,Math.floor((reset.getTime()-now)/1000));
  return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function ShopArtwork({item}:{item:ShopEntry}) {
  const [idx,setIdx]=useState(0);
  useEffect(()=>setIdx(0),[item.id,item.images]);
  const current=item.images[idx];
  return <div className="shop-v3-art">{current
    ? <img src={current} alt={`${item.title} cosmetic`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setIdx(n=>n+1)}/>
    : <span className="shop-v3-noart"><ImageOff size={25}/><small>Preview unavailable</small></span>}</div>;
}
export function ItemShop() {
  const [items,setItems]=useState<ShopEntry[]>(readCache);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [updated,setUpdated]=useState('');
  const [now,setNow]=useState(Date.now());
  const [category,setCategory]=useState('All');
  const [search,setSearch]=useState('');
  const [visibleCount,setVisibleCount]=useState(36);
  const load=async(signal?:AbortSignal)=>{
    setBusy(true);setError('');
    try {
      const r=await fetch(API,{signal,cache:'no-store'});
      if(!r.ok)throw new Error(`Service returned HTTP ${r.status}`);
      const parsed=parseShop(await r.json());
      if(!parsed.length)throw new Error('No named cosmetic offers were returned');
      if(signal?.aborted)return;
      setItems(parsed);setUpdated(new Date().toLocaleString('en-GB'));
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(parsed));}catch{/* cached results are optional */}
    }catch(err){if(!signal?.aborted)setError(err instanceof Error ? err.message : 'Could not load shop');}
    finally{if(!signal?.aborted)setBusy(false);}
  };
  useEffect(()=>{const ctrl=new AbortController();void load(ctrl.signal);return()=>ctrl.abort();},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{const timer=window.setInterval(()=>void load(),5*60*1000);return()=>clearInterval(timer);},[]);
  const categories=useMemo(()=>['All',...Array.from(new Set(items.map(x=>x.section)))], [items]);
  const matching=useMemo(()=>items.filter(x=>(category==='All'||x.section===category)&&(!search.trim()||`${x.title} ${x.section}`.toLowerCase().includes(search.trim().toLowerCase()))),[items,category,search]);
  useEffect(()=>setVisibleCount(36),[category,search]);
  useEffect(()=>{if(!categories.includes(category))setCategory('All');},[categories,category]);
  return <section className="shop-v3-page">
    <header className="shop-v3-header"><div><span className="shop-v3-label">FORTNITE · LIVE ROTATION</span><h1>Item Shop<span>.</span></h1><p>Clean previews, real names and current V-Bucks prices.</p></div>
      <div className="shop-v3-reset"><small>NEXT DAILY RESET · 00:00 UTC</small><strong>{resetCountdown(now)}</strong></div></header>
    <div className="shop-v3-toolbar">
      <label className="shop-v3-search"><Search size={17}/><input aria-label="Search shop" placeholder="Find a cosmetic..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <select aria-label="Shop category" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(cat=><option key={cat} value={cat}>{cat}</option>)}</select>
      <button type="button" className="shop-v3-refresh" disabled={busy} onClick={()=>void load()}><RefreshCw size={16} className={busy?'spinning':''}/><span>Refresh</span></button>
    </div>
    <div className="shop-v3-meta"><span>{matching.length} offers {category!=='All'?`· ${category}`:''}</span><span>{busy?'Updating…':updated?`Checked ${updated}`:items.length?'Saved shop snapshot':'Live shop'}</span></div>
    {error&&<div className="shop-v3-warning" role="status">{items.length?'Could not refresh. Showing the last saved shop.':'Live shop unavailable.'} {error} <button type="button" onClick={()=>void load()}>Retry</button></div>}
    {!items.length&&!error&&<div className="shop-v3-empty">Loading the latest Fortnite shop…</div>}
    {items.length>0&&matching.length===0&&<div className="shop-v3-empty">No items match your filters.</div>}
    <div className="shop-v3-grid">{matching.slice(0,visibleCount).map(item=><article key={item.id} className="shop-v3-card">
      <ShopArtwork item={item}/><div className="shop-v3-copy"><span title={item.section}>{item.section}</span><h2 title={item.title}>{item.title}</h2><strong>{item.price===null?'Price unavailable':`${item.price.toLocaleString('en-GB')} V-Bucks`}</strong></div>
    </article>)}</div>
    {matching.length>visibleCount&&<button type="button" className="shop-v3-more" onClick={()=>setVisibleCount(v=>v+36)}>Show more <span>({matching.length-visibleCount} remaining)</span></button>}
    <footer className="shop-v3-foot"><ShoppingBag size={16}/> Offers provided by <a href="https://fortnite-api.com/" target="_blank" rel="noreferrer">Fortnite-API <ExternalLink size={12}/></a>. Unsupported internal/promotional offers are hidden. Images may be unavailable upstream.</footer>
  </section>;
}
