/**
 * MAQ'S PASSION: immutable, user-supplied Masterclasses collection.
 * No in-app editor. Only the links below are included in this version.
 * Titles/channels are fetched at runtime from a public oEmbed resolver when accessible.
 * Never invent a publication date or infer video availability from the URL alone.
 */
export const playlist = {
  id: 'PLe9tskm70T8O0OFZPG6Ude5PUQl384Cm2',
  title: 'MAQ’S SELECTED PLAYLIST',
  url: 'https://www.youtube.com/playlist?list=PLe9tskm70T8O0OFZPG6Ude5PUQl384Cm2'
};
export type CategoryId = 'fighting'|'igling'|'fragging'|'rotation'|'meta'|'endgame'|'offspawn'|'vod';
export type Lesson = {videoId:string; startSeconds:number; number:number; url:string; categories:CategoryId[]};
const sources: Array<[string, number]> = [
 ['Q3_yWg2Ld2c',0],['0zPkW_tD1_Q',2],['4NipUE9cdzo',0],
 ['gGvU8CdlUAA',0],['b0XJkzkaYvk',0],['_sptSWaz7d4',2],
 ['EuGDXmDSdjw',0],['bCV-zwNq_OY',0],['q4c9Kgl93hQ',478],
 ['APWu7SSDKDs',0],['eUE574NTq2w',0],['w8UM0JSVFo8',0],
 ['-FOwj85Y7gc',0],['IU3OFmAfPKA',0],['qCtsvkKKDaA',0],
 ['4LfcGiiCut0',0],['ScOMC6-kq-c',0],['ha_9bNsSicY',407],
 ['6AJySFiYtCE',182],['2hE2Lxk6Gtw',0]
];
// Editorial playlists are predefined; metadata can be refreshed independently.
// Each row contains real videos from the supplied list, without requiring in-app editing.
const assigned: CategoryId[][] = [
 ['fighting','fragging'],['igling','rotation'],['fighting','offspawn'],['meta','vod'],
 ['fragging','endgame'],['rotation','igling'],['meta','endgame'],['fighting','vod'],
 ['endgame','rotation'],['igling','vod'],['fighting','fragging'],['rotation','meta'],
 ['endgame','igling'],['fragging','offspawn'],['meta','vod'],['fighting','meta'],
 ['igling','endgame'],['rotation','offspawn'],['fragging','vod'],['endgame','offspawn']
];
export const lessons: readonly Lesson[] = sources.map(([videoId,startSeconds],index)=>({
  videoId, startSeconds, number:index+1, categories:assigned[index],
  url:`https://www.youtube.com/watch?v=${videoId}${startSeconds?`&t=${startSeconds}s`:''}`
}));

export type VideoInfo = { title:string; author:string; available:boolean; description:string; publishDate?:string};
export const fallback = (lesson:Lesson):VideoInfo=>({title:`Selected video ${String(lesson.number).padStart(2,'0')}`,author:'YouTube · metadata pending',description:'Video information could not be verified; open the original video to see its details.',available:false});

export async function videoMetadata(lesson:Lesson, signal:AbortSignal):Promise<VideoInfo>{
  // noembed is a public oEmbed proxy and may return unavailable/disabled embeds.
  const endpoint=`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${lesson.videoId}`)}`;
  const response=await fetch(endpoint,{signal});
  if(!response.ok)throw new Error(`Metadata HTTP ${response.status}`);
  const info=await response.json();
  if(typeof info.title!=='string'||!info.title.trim()||info.error)throw new Error('No public metadata');
  return {
    title:info.title.trim(),author:typeof info.author_name==='string'?info.author_name:'YouTube creator',
    description:'Watch the original lesson from its creator. Full description and upload date are available on YouTube.',available:true
  };
}

export const sections:{id:CategoryId;title:string;subtitle:string;terms:string[]}[]=[
 {id:'fighting',title:'FIGHTING',subtitle:'Fights, peeks and piece control',terms:['fight','box','piece control','peek','edit','mechanic']},
 {id:'igling',title:'IGLING',subtitle:'Shot calls, leading and coordinating',terms:['igl','shotcall','shot call','lead','duo']},
 {id:'fragging',title:'FRAGGING',subtitle:'Elimination opportunities and refreshes',terms:['frag','refresh','kill','elimination','clutch']},
 {id:'rotation',title:'ROTATION',subtitle:'Routes, zones and positioning',terms:['rotate','rotation','position','zone','movement','deadside']},
 {id:'meta',title:'META',subtitle:'Strategy, loadouts and patches',terms:['meta','patch','loadout','weapon','strategy','update']},
 {id:'endgame',title:'ENDGAME',subtitle:'Late game under pressure',terms:['endgame','end game','fncs','finals','tournament']},
 {id:'offspawn',title:'OFF-SPAWN',subtitle:'Drops, loot and early engagements',terms:['drop','loot','offspawn','off-spawn','landing']},
 {id:'vod',title:'VOD REVIEW',subtitle:'Full gameplay and analytical review',terms:['vod','review','analysis','breakdown','ranked']}
];
