import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, ExternalLink, Play, Search, X } from 'lucide-react';
import { lessons, fallback, playlist, sections, videoMetadata } from './masterclasses-library';
import type { Lesson, VideoInfo } from './masterclasses-library';
import './masterclasses.css';

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
const safeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

function Thumbnail({id, className = ''}: {id:string;className?:string}) {
  const [src, setSrc] = useState(thumb(id));
  const [broken, setBroken] = useState(false);
  useEffect(()=>{setSrc(thumb(id));setBroken(false);},[id]);
  return broken ? <div className={`stream-fallback ${className}`}><BookOpen size={29}/></div>
    : <img className={className} src={src} alt="" loading="lazy" onError={()=>src===thumb(id)?setSrc(safeThumb(id)):setBroken(true)}/>;
}

function Poster({lesson, info, onPlay}:{lesson:Lesson; info:VideoInfo;onPlay:()=>void}) {
  return <button type="button" className="stream-tile" onClick={onPlay} title={info.title}>
    <div className="stream-art"><Thumbnail id={lesson.videoId}/><span className="stream-hover-play"><Play size={25} fill="currentColor"/></span><span className="stream-tag">MASTERCLASS</span></div>
    <strong>{info.title}</strong><small>{info.author}</small>
  </button>;
}

function VideoRail({title, description, items, meta, play}:{title:string;description:string;items:readonly Lesson[];meta:Record<string,VideoInfo>;play:(v:Lesson)=>void}){
  const railId=`rail-${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
  if (!items.length) return null;
  return <section className="stream-section"><div className="stream-section-head"><div><h2>{title}</h2><p>{description}</p></div><div className="stream-arrows"><button type="button" aria-label={`Scroll ${title} left`} onClick={()=>document.getElementById(railId)?.scrollBy({left:-660,behavior:'smooth'})}><ChevronLeft size={20}/></button><button type="button" aria-label={`Scroll ${title} right`} onClick={()=>document.getElementById(railId)?.scrollBy({left:660,behavior:'smooth'})}><ChevronRight size={20}/></button></div></div><div className="stream-rail" id={railId}>{items.map(lesson=><Poster key={lesson.videoId} lesson={lesson} info={meta[lesson.videoId] ?? fallback(lesson)} onPlay={()=>play(lesson)}/>)}</div></section>;
}

export function Masterclasses({ initialVideoId }: { initialVideoId?: string | null }) {
  const [query,setQuery] = useState('');
  const [meta,setMeta] = useState<Record<string,VideoInfo>>({});
  const [playing,setPlaying] = useState<Lesson | 'playlist' | null>(() => lessons.find(lesson => lesson.videoId === initialVideoId) ?? null);
  const [active,setActive] = useState('all');
  const featured = lessons[0];
  useEffect(()=>{
    const controller = new AbortController();
    let stopped = false;
    async function fetchOne(lesson: Lesson) { try {
      const info=await videoMetadata(lesson,controller.signal);
      if(!stopped) setMeta(previous=>({...previous,[lesson.videoId]:info}));
    } catch { /* Keep the title neutral if metadata can't be fetched. */ } }
    // Fetch at most four at a time instead of 20 simultaneous connections.
    async function load(){for(let i=0;i<lessons.length;i+=4){if(stopped)break;await Promise.all(lessons.slice(i,i+4).map(fetchOne));}}
    void load();return ()=>{stopped=true;controller.abort();};
  },[]);
  const filtered = useMemo(()=>{
    const text = query.trim().toLowerCase();
    return lessons.filter(l=>!text || (`${meta[l.videoId]?.title??''} ${meta[l.videoId]?.author??''} ${fallback(l).title}`).toLowerCase().includes(text));
  },[query,meta]);
  const heroInfo=meta[featured.videoId]??fallback(featured);
  const activeLesson = typeof playing === 'object' ? playing : null;
  const activeInfo=activeLesson?(meta[activeLesson.videoId]??fallback(activeLesson)):null;
  return <section className="stream-page">
    <div className="stream-masthead"><div className="stream-brand"><span>MAQ'S PASSION / VIDEO LIBRARY</span><h1>MASTERCLASSES<span>.</span></h1></div><label className="stream-search"><Search size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search masterclasses" aria-label="Search masterclasses"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search"><X size={17}/></button>}</label></div>
    {!query && <div className="stream-hero"><div className="stream-hero-image"><Thumbnail id={featured.videoId}/></div><div className="stream-hero-shade"/><div className="stream-hero-content"><span className="stream-feature-label">FEATURED MASTERCLASS</span><h2>{heroInfo.title}</h2><p>Watch competitive Fortnite breakdowns, strategies and coaching inside Maq's Passion.</p><div className="stream-hero-buttons"><button type="button" className="stream-hero-play" onClick={()=>setPlaying(featured)}><Play size={18} fill="currentColor"/> PLAY NOW</button><button type="button" className="stream-hero-secondary" onClick={()=>setPlaying('playlist')}>EXPLORE PLAYLIST <ArrowRight size={17}/></button></div></div></div>}
    <nav className="stream-categories" aria-label="Video categories"><button className={active==='all'?'active':''} onClick={()=>setActive('all')}>All</button>{sections.map(s=><button key={s.id} className={active===s.id?'active':''} onClick={()=>setActive(s.id)}>{s.title}</button>)}</nav>
    <div className="stream-rows">
      {(active==='all') && <VideoRail title="TOP PICKS" description="Watch next" items={filtered.slice(0,12)} meta={meta} play={setPlaying}/>}
      {sections.filter(s=>active==='all'||active===s.id).map(section=><VideoRail key={section.id} title={section.title} description={section.subtitle} items={filtered.filter(l=>l.categories.includes(section.id))} meta={meta} play={setPlaying}/>)}
      {!filtered.length && <div className="stream-empty">No matching videos found.</div>}
    </div>
    {playing&&<div className="stream-player-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPlaying(null)}}><div className="stream-player" role="dialog" aria-modal="true" aria-label="Masterclass player"><div className="stream-player-head"><div><span>NOW PLAYING</span><h2>{activeInfo?.title??playlist.title}</h2><small>{activeInfo?.author??'MAQ’S PASSION'}</small></div><button type="button" aria-label="Close video" onClick={()=>setPlaying(null)}><X size={24}/></button></div><div className="stream-player-video"><iframe key={activeLesson?.videoId??'playlist'} title={activeInfo?.title??playlist.title} src={activeLesson?`https://www.youtube-nocookie.com/embed/${activeLesson.videoId}?start=${activeLesson.startSeconds}&rel=0&autoplay=1`:`https://www.youtube-nocookie.com/embed/videoseries?list=${playlist.id}`} referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen/></div><div className="stream-player-bottom"><span>{activeInfo?.author??'YouTube playlist'}</span><a href={activeLesson?.url??playlist.url} rel="noopener noreferrer" target="_blank">OPEN ON YOUTUBE <ExternalLink size={15}/></a></div></div></div>}
  </section>;
}
