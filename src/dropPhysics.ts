/** MAQ'S PASSION — independently implemented, editable physics approximation.
 * These constants are NOT authenticated game values; they are a starting model.
 * All horizontal coordinates are percentages of a square map of `mapWidth` metres.
 */
export type Point = { x: number; y: number };
export type DiveStyle = 'steep' | 'balanced' | 'shallow';
export type Terrain = { targetElevation: number; ridgeEnabled: boolean; ridge: Point; ridgeHeight: number; ridgeRadius: number };
export type Physics = {
  mapWidth: number; busSpeed: number; busAltitude: number;
  fallVertical: number; fallHorizontal: number;
  glideHorizontal: number; glideVertical: number; autoDeploy: number;
  earlyDeploy: boolean; manualDeploy: number;
};
export type DropState = { busStart: Point; busEnd: Point; target: Point; terrain: Terrain; physics: Physics; dive: 'auto' | DiveStyle };
export type Result = {
  jump: Point; deploy: Point; jumpFraction: number; busSeconds: number;
  fallSeconds: number; glideSeconds: number; totalSeconds: number;
  landingSecondsAfterJump: number; dive: DiveStyle; angle: number;
  diveDistance: number; glideDistance: number; approachDistance: number;
  deployAltitude: number; landingAltitude: number; clearance: number;
};
export const defaultPhysics: Physics = {
  mapWidth: 3000, busSpeed: 75, busAltitude: 920,
  fallVertical: 56.5, fallHorizontal: 21,
  glideHorizontal: 18, glideVertical: 6.0, autoDeploy: 100,
  earlyDeploy: false, manualDeploy: 145,
};
export const defaultTerrain: Terrain = {
  targetElevation: 0, ridgeEnabled: false, ridge: { x: 56, y: 47 }, ridgeHeight: 165, ridgeRadius: 235,
};
export const defaultState: DropState = {
  busStart: { x: 8, y: 82 }, busEnd: { x: 88, y: 14 },
  target: { x: 70, y: 43 }, terrain: defaultTerrain, physics: defaultPhysics, dive: 'auto',
};
export const styles: Record<DiveStyle, {vertical: number; horizontal: number; description: string}> = {
  steep: { vertical: 1, horizontal: 0.38, description: 'Steep nosedive · faster descent, less horizontal travel' },
  balanced: { vertical: 0.80, horizontal: 1, description: 'Balanced angle · moderate descent and forward travel' },
  shallow: { vertical: 0.60, horizontal: 1.36, description: 'Shallow dive · slower descent, more horizontal travel' },
};
const cap=(value: number, min: number, max: number)=>Math.min(max,Math.max(min,value));
const plus=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y});
const minus=(a:Point,b:Point):Point=>({x:a.x-b.x,y:a.y-b.y});
const mul=(a:Point,k:number):Point=>({x:a.x*k,y:a.y*k});
export const length=(a:Point)=>Math.hypot(a.x,a.y);
export const distance=(a:Point,b:Point)=>length(minus(a,b));
export const lerp=(a:Point,b:Point,t:number)=>plus(a,mul(minus(b,a),t));
export function toMetres(p:Point, mapWidth:number):Point {return mul(p,mapWidth/100)}
export function fromMetres(p:Point, mapWidth:number):Point {return mul(p,100/mapWidth)}
export function distanceMetres(a:Point,b:Point,mapWidth:number) {return distance(a,b)*mapWidth/100}
export function nearestOnBus(start:Point,end:Point,target:Point) {
  const v=minus(end,start); const d=length(v)**2;
  const fraction=d>1e-8?cap((minus(target,start).x*v.x+minus(target,start).y*v.y)/d,0,1):0;
  return {point:lerp(start,end,fraction),fraction};
}
/** User-drawn terrain is *not* a Fortnite heightmap. */
export function groundElevation(p:Point, target:Point, terrain:Terrain, mapWidth:number):number {
  const d=distanceMetres(p,target,mapWidth);
  const nearTarget=Math.max(0,1-d/125);
  let h=terrain.targetElevation*nearTarget*nearTarget;
  if(terrain.ridgeEnabled){
    const dr=distanceMetres(p,terrain.ridge,mapWidth);
    const rise=Math.max(0,1-dr/Math.max(30,terrain.ridgeRadius));
    h=Math.max(h,terrain.ridgeHeight*rise*rise);
  }
  return h;
}
export function simulate(state:DropState,jumpFraction:number,dive:DiveStyle):Result|null {
  const {busStart,busEnd,target,terrain,physics}=state;
  const {mapWidth,busSpeed,busAltitude,fallHorizontal,fallVertical,glideHorizontal,glideVertical,autoDeploy}=physics;
  if(busSpeed<=0||fallVertical<=0||glideVertical<=0||glideHorizontal<=0||mapWidth<=0)return null;
  const jump=lerp(busStart,busEnd,jumpFraction);
  const jumpM=toMetres(jump,mapWidth),targetM=toMetres(target,mapWidth);
  const path=minus(targetM,jumpM),dist=length(path);
  const unit=dist>0.01?mul(path,1/dist):{x:0,y:0};
  const phase=styles[dive];
  const horizontal=fallHorizontal*phase.horizontal,vertical=fallVertical*phase.vertical;
  const threshold=physics.earlyDeploy?Math.max(autoDeploy,physics.manualDeploy):autoDeploy;
  const dt=0.25;let fallSeconds=0,along=0,altitude=busAltitude;
  let deployGround=0;
  const groundAt=(metres:Point)=>groundElevation(fromMetres(metres,mapWidth),target,terrain,mapWidth);
  // Numerical descent with collision/deployment checked at each short timestep.
  // We deliberately do not model acceleration, wind, map meshes or action animations.
  for(let i=0;i<250;i++) {
    const pos=plus(jumpM,mul(unit,along));
    deployGround=groundAt(pos);
    if(altitude <= deployGround+threshold)break;
    const step=Math.min(dt,(altitude-deployGround-threshold)/vertical);
    if(step<=0) break;
    fallSeconds+=step;
    along+=horizontal*step;
    altitude-=vertical*step;
    if(along>dist+1 || altitude<0) return null;
    if(i===249) return null;
  }
  const deployM=plus(jumpM,mul(unit,along));
  const deploy=fromMetres(deployM,mapWidth);
  const landingAltitude=groundElevation(target,target,terrain,mapWidth);
  const availableHeight=altitude-landingAltitude;
  if(availableHeight<-0.01)return null;
  const glideSeconds=Math.max(0,availableHeight/glideVertical);
  const remaining=Math.max(0,dist-along);
  if(glideSeconds*glideHorizontal+1e-4<remaining)return null;
  // Detect collisions with any manually supplied terrain ridge before target.
  let clearance=Infinity;
  for(let i=1;i<36;i++) {
    const f=i/36;
    const pos=lerp(deployM,targetM,f);
    const z=altitude-availableHeight*f;
    const over=z-groundAt(pos);
    clearance=Math.min(clearance,over);
    if(over<2 && f<0.94)return null;
  }
  const busDistance=distanceMetres(busStart,busEnd,mapWidth);
  const busSeconds=busDistance*jumpFraction/busSpeed;
  const totalSeconds=busSeconds+fallSeconds+glideSeconds;
  if(!Number.isFinite(totalSeconds)||totalSeconds<0)return null;
  return {jump,deploy,jumpFraction,busSeconds,fallSeconds,glideSeconds,totalSeconds,
    landingSecondsAfterJump:fallSeconds+glideSeconds,dive,
    angle:Math.atan2(vertical,horizontal)*180/Math.PI,
    diveDistance:along,glideDistance:remaining,approachDistance:dist,
    deployAltitude:altitude,landingAltitude,clearance:Math.min(clearance,altitude-deployGround)};
}
export function solve(state:DropState) {
  const available:DiveStyle[]=state.dive==='auto'?['steep','balanced','shallow']:[state.dive];
  let best:Result|null=null;
  let feasible=0;
  const samples=180;
  const busDistance=distanceMetres(state.busStart,state.busEnd,state.physics.mapWidth);
  if(busDistance<20)return {best:null,nearest:null,feasible:0,checked:0};
  for(let i=0;i<=samples;i++){
    for(const dive of available){
      const result=simulate(state,i/samples,dive);
      if(!result)continue;
      feasible++;
      if(!best||result.totalSeconds<best.totalSeconds)best=result;
    }
  }
  // One-dimensional local refinement around the best sample, for sub-second timing.
  if(best){
    for(let i=-30;i<=30;i++){
      const fraction=cap(best.jumpFraction+i/(samples*32),0,1);
      for(const dive of available){
        const result=simulate(state,fraction,dive);
        if(result&&result.totalSeconds<best.totalSeconds)best=result;
      }
    }
  }
  const closest=nearestOnBus(state.busStart,state.busEnd,state.target);
  let nearest:Result|null=null;
  for(const dive of available){
    const result=simulate(state,closest.fraction,dive);
    if(result&&(!nearest||result.totalSeconds<nearest.totalSeconds))nearest=result;
  }
  return {best,nearest,feasible,checked:(samples+1)*available.length};
}
