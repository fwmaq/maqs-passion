import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BookOpen, ChevronRight, Crosshair, ExternalLink, Flame, Gauge, MapPinned, Play, RefreshCw, SlidersHorizontal, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import { lessons, fallback, videoMetadata } from './masterclasses-library';
import type { VideoInfo } from './masterclasses-library';
import './home-news.css';
import './home-dashboard.css';

type Page = 'aim-trainer' | 'masterclasses' | 'pro-setups' | 'drop' | 'sensitivity' | 'tweaks';
type NewsEntry = { title: string; body: string; image?: string; id: string };
const NEWS_URL = 'https://fortnite-api.com/v2/news/br?language=en';
const featured = lessons.slice(0, 3);

export function HomeNews({ navigate, openLesson, showNews = false }: { navigate: (page: Page) => void; openLesson: (videoId: string) => void; showNews?: boolean }) {
  const [meta, setMeta] = useState<Record<string, VideoInfo>>({});
  const [news, setNews] = useState<NewsEntry[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(false);
  const [showAllNews, setShowAllNews] = useState(false);
  const [thumbFallback, setThumbFallback] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(featured.map(async lesson => {
      try {
        const info = await videoMetadata(lesson, controller.signal);
        if (!controller.signal.aborted) setMeta(previous => ({ ...previous, [lesson.videoId]: info }));
      } catch { /* Offline metadata gracefully uses curated index labels. */ }
    }));
    return () => controller.abort();
  }, []);

  async function loadNews(signal?: AbortSignal) {
    setNewsLoading(true);
    setNewsError(false);
    try {
      const response = await fetch(NEWS_URL, {signal});
      if (!response.ok) throw Error(`News HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data?.data?.motds)) throw Error('Unexpected news response');
      if (signal?.aborted) return;
      setNews(data.data.motds.filter((item: any) => item && typeof item.title === 'string').map((item: any, index: number) => ({
        id: String(item.id ?? index), title: item.title, body: String(item.body ?? ''), image: typeof item.image === 'string' ? item.image : undefined,
      })));
    } catch { if (!signal?.aborted) setNewsError(true); }
    finally { if (!signal?.aborted) setNewsLoading(false); }
  }
  useEffect(() => {
    if (!showNews) return;
    const controller = new AbortController();
    void loadNews(controller.signal);
    const interval = window.setInterval(() => void loadNews(controller.signal), 10 * 60 * 1000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [showNews]);
  const newsItems = useMemo(() => showAllNews ? news : news.slice(0, 3), [showAllNews, news]);

  return <div className="news-home passion-dashboard">
    <div className="dash-overline"><span className="dash-live-dot"/> YOUR COMPETITIVE HQ <span className="dash-overline-spacer"/> TRAIN. LEARN. IMPROVE.</div>
    <div className="dash-heading"><div><h1>THE GRIND <span>STARTS HERE.</span></h1><p>Everything you need to get better. No distractions, just reps.</p></div><span className="dash-version"><Sparkles size={14}/> PASSION HQ / 2.13</span></div>

    <section className="dash-hero-grid" aria-label="Featured tools">
      <div className="dash-aim-feature">
        <div className="dash-aim-noise" aria-hidden="true"/><div className="dash-aim-target" aria-hidden="true"><i/><i/><i/><b>+</b></div>
        <div className="dash-aim-content">
          <div className="dash-chips"><span className="dash-feature-pill"><span className="dash-live-dot"/> FREE TO PLAY</span><span className="dash-chips-soft"><Crosshair size={12}/> 3D AIM ARENA</span></div>
          <h2>MAKE EVERY<br/><em>SHOT COUNT.</em></h2>
          <p>Precision flicks. Reactive tracking. Competitive drills. Your own aim trainer, right here in Maq's Passion.</p>
          <div className="dash-aim-actions"><button className="dash-primary-cta" type="button" onClick={() => navigate('aim-trainer')}><Play size={17} fill="currentColor"/> LAUNCH AIM TRAINER <ArrowRight size={17}/></button><span>NO SUBSCRIPTION. ALL SKILL.</span></div>
        </div>
        <div className="dash-feature-foot"><span><Target size={14}/> 7 TARGET DRILLS</span><span><Gauge size={14}/> REAL-TIME FRAME METER</span><span><SlidersHorizontal size={14}/> CUSTOM SENS</span></div>
      </div>
      <div className="dash-side-stack">
        <button className="dash-side-card dash-class-feature" type="button" onClick={() => navigate('masterclasses')}>
          <span className="dash-side-kicker"><BookOpen size={15}/> THE STUDY ROOM</span>
          <strong>STUDY THE<br/>BEST.</strong>
          <small>Real creator videos. Fighting, rotations, IGLing and endgames.</small>
          <span className="dash-side-link">WATCH MASTERCLASSES <ArrowRight size={16}/></span>
          <span className="dash-side-decoration" aria-hidden="true">01</span>
        </button>
        <button className="dash-side-card dash-setup-feature" type="button" onClick={() => navigate('pro-setups')}>
          <span className="dash-side-kicker"><Trophy size={15}/> PLAYER DATABASE</span>
          <strong>SET UP LIKE A PRO.</strong>
          <small>Explore competitive settings and gear.</small>
          <span className="dash-side-link">EXPLORE SETUPS <ArrowRight size={16}/></span>
        </button>
      </div>
    </section>

    <section className="dash-section dash-lessons-section" aria-label="Featured masterclasses">
      <header className="dash-section-header"><div><span className="dash-section-kicker"><Flame size={14}/> HANDPICKED CONTENT</span><h2>LEVEL UP YOUR GAME<span>.</span></h2><p>Selected competitive Fortnite lessons from the Masterclasses library.</p></div><button type="button" className="dash-text-action" onClick={() => navigate('masterclasses')}>VIEW THE LIBRARY <ArrowRight size={17}/></button></header>
      <div className="dash-lessons-row">
        {featured.map((lesson, index) => {
          const info = meta[lesson.videoId] ?? fallback(lesson);
          const mainCategory = lesson.categories[0]?.replace('igling', 'IGLING').replace('offspawn', 'OFF-SPAWN').toUpperCase() ?? 'MASTERCLASS';
          return <button type="button" key={lesson.videoId} className="dash-lesson" style={{animationDelay:`${index * 65}ms`}} onClick={() => openLesson(lesson.videoId)} title={`Watch ${info.title}`}>
            <div className="dash-lesson-image">
              {!thumbFallback[lesson.videoId] ? <img src={`https://i.ytimg.com/vi/${lesson.videoId}/hqdefault.jpg`} loading="lazy" alt="" onError={() => setThumbFallback(old => ({...old, [lesson.videoId]: true}))}/> : <div className="dash-video-fallback"><BookOpen size={30}/></div>}
              <span className="dash-play-overlay"><Play size={23} fill="currentColor"/></span><span className="dash-video-category">{mainCategory}</span>
            </div>
            <div className="dash-lesson-copy"><span>LESSON {String(lesson.number).padStart(2, '0')}</span><strong>{info.title}</strong><small>{info.available ? info.author : 'Open to watch on YouTube'}</small></div>
          </button>;
        })}
      </div>
    </section>

    <section className="dash-section dash-quick-section" aria-label="Quick access"><header className="dash-section-header"><div><span className="dash-section-kicker"><Zap size={14}/> GET TO WORK</span><h2>YOUR TOOLKIT<span>.</span></h2></div></header>
      <div className="dash-shortcut-grid">
        <button type="button" onClick={() => navigate('sensitivity')}><span className="dash-shortcut-icon"><SlidersHorizontal size={23}/></span><strong>SENSITIVITY</strong><small>Dial in your settings</small><ChevronRight size={18}/></button>
        <button type="button" onClick={() => navigate('drop')}><span className="dash-shortcut-icon"><MapPinned size={23}/></span><strong>DROP CALCULATOR</strong><small>Plan your landing</small><ChevronRight size={18}/></button>
        <button type="button" onClick={() => navigate('tweaks')}><span className="dash-shortcut-icon"><Activity size={23}/></span><strong>PC TWEAKS</strong><small>Optimisation checklist</small><ChevronRight size={18}/></button>
      </div>
    </section>

    {showNews&&<section className="dash-section dash-updates" aria-label="Fortnite news"><header className="dash-section-header"><div><span className="dash-section-kicker"><Activity size={14}/> OFFICIAL IN-GAME FEED</span><h2>IN THE LOOP<span>.</span></h2></div><button className="dash-refresh" type="button" disabled={newsLoading} onClick={() => void loadNews()}><RefreshCw size={15} className={newsLoading?'news-spin':''}/> REFRESH</button></header>
      {newsError && <div className="dash-news-note">The Fortnite news feed is temporarily unavailable. <a href="https://www.fortnite.com/news" target="_blank" rel="noreferrer">See Epic's newsroom <ExternalLink size={13}/></a></div>}
      {newsLoading && !news.length && !newsError && <div className="dash-news-note dash-news-loading">Loading official updates…</div>}
      <div className="dash-news-grid">{newsItems.map(item => <article className="dash-news-card" key={item.id}>{item.image && <div className="dash-news-cover"><img src={item.image} loading="lazy" alt=""/></div>}<div className="dash-news-copy"><span>FORTNITE UPDATE</span><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</div>
      {!newsLoading&&!newsError&&!news.length&&<div className="dash-news-note">No updates are available at the moment.</div>}
      {news.length > 3 && <button type="button" className="dash-more-news" onClick={() => setShowAllNews(value => !value)}>{showAllNews ? 'SHOW LESS' : `SHOW ALL ${news.length} UPDATES`} <ArrowRight size={15}/></button>}
    </section>}
    <footer className="dash-footer">MAQ'S PASSION <span>BUILT FOR THE GRIND</span><a href="https://www.fortnite.com/news" target="_blank" rel="noreferrer">FORTNITE NEWS <ExternalLink size={13}/></a></footer>
  </div>;
}
