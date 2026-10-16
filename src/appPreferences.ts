export type AppPreferences={
  animations:boolean; compactUI:boolean; launchFullscreen:boolean;
  showNews:boolean; membersDefault:boolean; autoUpdates:boolean;
};
export const DEFAULT_PREFERENCES:AppPreferences={
  animations:true,compactUI:false,launchFullscreen:true,showNews:false,membersDefault:false,autoUpdates:true,
};
const KEY='mp:preferences:v213';
export function loadPreferences():AppPreferences{
  try {
    const decoded:unknown=JSON.parse(localStorage.getItem(KEY)||'{}');
    const value=(decoded&&typeof decoded==='object'&&!Array.isArray(decoded)?decoded:{}) as Partial<AppPreferences>;
    return Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key,def])=>[key,typeof value[key as keyof AppPreferences]==='boolean'?value[key as keyof AppPreferences]:def])) as AppPreferences;
  }catch{return {...DEFAULT_PREFERENCES};}
}
export function savePreferences(next:AppPreferences) {
  try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* optional */}
  window.dispatchEvent(new CustomEvent<AppPreferences>('mp:preferences-changed',{detail:next}));
}
