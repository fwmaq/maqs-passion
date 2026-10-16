/**
 * PASSION AIM: small self-contained WebGL2 training range. No third-party engine,
 * online assets or Rust commands. Intentional: high refresh rates depend on WebView2,
 * monitor, GPU and OS input facilities; they cannot be guaranteed by this renderer.
 */
export type AimDrill = 'frenzy' | 'sixshot' | 'micro' | 'smooth' | 'strafe' | 'switch' | 'bounce';
export type AimDifficulty = 'standard' | 'competitive' | 'elite';
export type AimSettings = {
  dpi: number; x: number; y: number; fov: number; targetScale: number; speedScale: number;
  fpsLimit: number; renderScale: number; antialias: boolean;
  quality: 'performance' | 'balanced' | 'high';
  crosshair: 'dot' | 'cross' | 'ring'; crosshairColor: string;
  sound: boolean;
};
export type AimStats = {
  remaining: number; score: number; hits: number; shots: number;
  accuracy: number; avgKillMs: number; targetHitsPerMinute: number;
  fps: number; frameMs: number; elapsed: number; holdMs: number; onTargetMs: number;
};
export const DEFAULT_AIM_SETTINGS: AimSettings = {
  dpi: 800, x: 6.5, y: 6.5, fov: 103, targetScale: 1, speedScale: 1, fpsLimit: 0,
  renderScale: 1, antialias: false, quality: 'performance',
  crosshair: 'cross', crosshairColor: '#ffffff', sound: false,
};
export const DRILLS: Record<AimDrill, { name: string; kicker: string; description: string; count: number; tracking: boolean; duration: number }> = {
  frenzy: { name: 'TILE FRENZY', kicker: 'SPEED / ACQUISITION', description: 'Three fast respawning targets. Prioritise controlled, high-speed flicks.', count: 3, tracking: false, duration: 60 },
  sixshot: { name: 'SIXSHOT PRECISION', kicker: 'SMALL TARGET CONTROL', description: 'Six small targets. Keep the crosshair steady and make every click deliberate.', count: 6, tracking: false, duration: 60 },
  micro: { name: 'MICRO CORRECTIONS', kicker: 'SUBTLE FLICKS', description: 'Single compact target that respawns near your central field of view.', count: 1, tracking: false, duration: 60 },
  smooth: { name: 'SMOOTH TRACKING', kicker: 'CONTINUOUS AIM', description: 'Hold fire and stay on a smooth moving target without overcorrecting.', count: 1, tracking: true, duration: 60 },
  strafe: { name: 'STRAFE REACTIVE', kicker: 'DIRECTION CHANGES', description: 'A side-to-side target changes direction. Hold fire and react quickly.', count: 1, tracking: true, duration: 60 },
  switch: { name: 'TARGET SWITCH', kicker: 'TRANSFER SPEED', description: 'Strike only the bright target, then switch immediately to the next.', count: 4, tracking: false, duration: 60 },
  bounce: { name: 'AIRBORNE TARGETS', kicker: 'VERTICAL REACTION', description: 'Two moving targets bounce across the arena. Read their trajectories.', count: 2, tracking: false, duration: 60 },
};
export const DIFFICULTIES: Record<AimDifficulty, {size:number;speed:number;label:string}> = {
  standard: {size:1.22,speed:.75,label:'STANDARD'},
  competitive: {size:1,speed:1,label:'COMPETITIVE'},
  elite: {size:.75,speed:1.55,label:'ELITE'},
};
export const initialAimStats = (seconds = 60): AimStats => ({remaining:seconds,score:0,hits:0,shots:0,accuracy:0,avgKillMs:0,targetHitsPerMinute:0,fps:0,frameMs:0,elapsed:0,holdMs:0,onTargetMs:0});
// Fortnite commonly uses a 0.555 yaw factor with slider percentage. This is a
// calibration estimate, NOT a claim of input parity with Fortnite/Unreal Engine.
export function estimatedCm360(dpi: number, percent: number) {
  return dpi > 0 && percent > 0 ? (360 * 2.54)/(dpi * .555 * percent / 100) : 0;
}

type Vec3 = [number,number,number];
type Mat4 = Float32Array;
type Target = {x:number;y:number;z:number;r:number;vx:number;vy:number;spawnedAt:number;phase:number;};
const clamp = (n:number, a:number, b:number) => Math.min(b,Math.max(a,n));
const rnd = (a:number,b:number) => a + Math.random()*(b-a);
const rad = Math.PI / 180;
function matIdentity(): Mat4 {const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m;}
function model(x:number,y:number,z:number,sx:number,sy:number,sz:number):Mat4 {
  const m=matIdentity();m[0]=sx;m[5]=sy;m[10]=sz;m[12]=x;m[13]=y;m[14]=z;return m;
}
function multiply(a: Mat4,b: Mat4):Mat4 {
  const out=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++){
    out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  }
  return out;
}
function perspective(fovY:number,aspect:number,near:number,far:number):Mat4 {
  const f=1/Math.tan(fovY/2),m=new Float32Array(16);
  m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m;
}
function normalize(v:Vec3):Vec3 {const l=Math.hypot(...v)||1;return [v[0]/l,v[1]/l,v[2]/l];}
function cross(a:Vec3,b:Vec3):Vec3 {return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function lookAt(eye:Vec3,dir:Vec3):Mat4 {
  const right=normalize(cross(dir,[0,1,0])); const up=normalize(cross(right,dir)); const m=matIdentity();
  m[0]=right[0];m[4]=right[1];m[8]=right[2];
  m[1]=up[0];m[5]=up[1];m[9]=up[2];
  m[2]=-dir[0];m[6]=-dir[1];m[10]=-dir[2];
  m[12]=-(right[0]*eye[0]+right[1]*eye[1]+right[2]*eye[2]);
  m[13]=-(up[0]*eye[0]+up[1]*eye[1]+up[2]*eye[2]);
  m[14]=dir[0]*eye[0]+dir[1]*eye[1]+dir[2]*eye[2];return m;
}
function geometryCube():Float32Array {
  const pts:number[]=[];
  const faces: Array<{n:Vec3, p:Vec3[]}> = [
    {n:[0,0,1],p:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]},
    {n:[0,0,-1],p:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]},
    {n:[1,0,0],p:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]},
    {n:[-1,0,0],p:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]},
    {n:[0,1,0],p:[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]},
    {n:[0,-1,0],p:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]},
  ];
  for(const {n,p} of faces)for(const idx of [0,1,2,0,2,3])pts.push(...p[idx],...n);
  return new Float32Array(pts);
}
function geometrySphere(segments:number,rings:number):Float32Array {
  const vertices:number[]=[];
  for(let i=0;i<rings;i++){
    const t0=Math.PI*i/rings, t1=Math.PI*(i+1)/rings;
    for(let j=0;j<segments;j++){
      const p0=2*Math.PI*j/segments, p1=2*Math.PI*(j+1)/segments;
      const pt=(t:number,p:number):Vec3=>[Math.sin(t)*Math.cos(p),Math.cos(t),Math.sin(t)*Math.sin(p)];
      const a=pt(t0,p0),b=pt(t1,p0),c=pt(t1,p1),d=pt(t0,p1);
      for(const v of [a,b,c,a,c,d])vertices.push(...v,...v);
    }
  }
  return new Float32Array(vertices);
}
const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uVP; uniform mat4 uModel;
out vec3 vNormal; out vec3 vWorld; out float vDist;
void main(){vec4 world=uModel*vec4(aPos,1.);vWorld=world.xyz;vNormal=normalize(mat3(uModel)*aNormal);vDist=length(world.xyz-vec3(0.,1.65,0.));gl_Position=uVP*world;}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal; in vec3 vWorld; in float vDist;
uniform vec3 uColor; uniform float uEmission; uniform int uMaterial;
out vec4 fragColor;
void main(){
 float light=0.39+0.61*max(0.,dot(normalize(vNormal),normalize(vec3(-.28,.84,.46))));
 vec3 col=uColor*(light+uEmission);
 if(uMaterial==1){vec2 g=abs(fract(vWorld.xz)-.5);float line=1.-smoothstep(.478,.499,max(g.x,g.y));col+=vec3(.055,.055,.06)*line;}
 if(uMaterial==2){vec2 q=abs(fract(vWorld.xy*1.8)-.5);float line=1.-smoothstep(.475,.5,max(q.x,q.y));col+=vec3(.025,.025,.03)*line;}
 float fog=clamp((vDist-9.)/42.,0.,.44);col=mix(col,vec3(.022,.022,.026),fog);
 fragColor=vec4(col,1.);
}`;
function compile(gl:WebGL2RenderingContext,type:number,source:string) {
  const shader=gl.createShader(type);if(!shader)throw Error('Unable to create WebGL shader');
  gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(`Graphics shader failed: ${error}`);}
  return shader;
}
function programFor(gl:WebGL2RenderingContext){
  const vs=compile(gl,gl.VERTEX_SHADER,VERTEX),fs=compile(gl,gl.FRAGMENT_SHADER,FRAGMENT),p=gl.createProgram();
  if(!p)throw Error('Unable to create WebGL program');
  gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(`Graphics program failed: ${gl.getProgramInfoLog(p)}`);
  return p;
}
type Mesh={vao:WebGLVertexArrayObject;buffer:WebGLBuffer;vertices:number};
function createMesh(gl:WebGL2RenderingContext,geometry:Float32Array):Mesh {
  const vao=gl.createVertexArray(),buffer=gl.createBuffer();if(!vao||!buffer)throw Error('Could not allocate graphics buffers');
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,geometry,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
  gl.bindVertexArray(null);return {vao,buffer,vertices:geometry.length/6};
}
const EYE:Vec3=[0,1.65,0];
function targetColor(active:boolean,tracking:boolean):Vec3 {
  return active?(tracking?[.79,.88,.95]:[.92,.94,.98]):[.21,.24,.28];
}
export class AimEngine {
  private canvas:HTMLCanvasElement;
  private gl:WebGL2RenderingContext;
  private shader:WebGLProgram;
  private cube:Mesh;
  private ball:Mesh;
  private vpLoc:WebGLUniformLocation|null;
  private modelLoc:WebGLUniformLocation|null;
  private colorLoc:WebGLUniformLocation|null;
  private emissionLoc:WebGLUniformLocation|null;
  private materialLoc:WebGLUniformLocation|null;
  private raf=0; private resizeObserver:ResizeObserver;
  private settings:AimSettings;
  private callbacks:{onUpdate:(data:AimStats)=>void;onFinish:(data:AimStats)=>void;onLock:(locked:boolean)=>void;onError:(message:string)=>void};
  private targets:Target[]=[];
  private drill:AimDrill='frenzy';private difficulty:AimDifficulty='competitive';private duration=60;
  private state:'ready'|'running'|'paused'|'results'='ready';
  private yaw=0;private pitch=0;private mouseHeld=false;
  private elapsed=0;private score=0;private hits=0;private shots=0;private killSumMs=0;private holdMs=0;private onTargetMs=0;
  private cursorActive=0;private lastFrame=0;private lastPaint=0;private lastHud=0;
  // Count frames actually submitted by render(), not requested/capped FPS.
  // WebView2's requestAnimationFrame is normally synced to the display refresh rate.
  // GPU presentation timing itself is not exposed reliably by the WebView.
  private fps=0;private frameMs=0;private recentPaints:number[]=[];
  private previousTrackScore=0;private audio:AudioContext|null=null;
  private destroyed=false;
  constructor(canvas:HTMLCanvasElement,settings:AimSettings,callbacks:AimEngine['callbacks']){
    this.canvas=canvas;this.settings=settings;this.callbacks=callbacks;
    const gl=canvas.getContext('webgl2',{alpha:false,depth:true,stencil:false,antialias:settings.antialias,powerPreference:'high-performance',preserveDrawingBuffer:false});
    if(!gl)throw Error('WebGL2 is unavailable. Update Microsoft Edge WebView2 and enable GPU acceleration.');
    this.gl=gl;this.shader=programFor(gl);this.cube=createMesh(gl,geometryCube());
    this.ball=createMesh(gl,geometrySphere(settings.quality==='performance'?12:settings.quality==='balanced'?20:28,settings.quality==='performance'?8:16));
    this.vpLoc=gl.getUniformLocation(this.shader,'uVP');this.modelLoc=gl.getUniformLocation(this.shader,'uModel');
    this.colorLoc=gl.getUniformLocation(this.shader,'uColor');this.emissionLoc=gl.getUniformLocation(this.shader,'uEmission');this.materialLoc=gl.getUniformLocation(this.shader,'uMaterial');
    gl.clearColor(.015,.023,.035,1);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
    document.addEventListener('pointerlockchange',this.onLockChange);
    document.addEventListener('pointerlockerror',this.onPointerError);
    document.addEventListener('mousemove',this.onMouseMove);
    document.addEventListener('mousedown',this.onMouseDown);
    document.addEventListener('mouseup',this.onMouseUp);
    window.addEventListener('blur',this.onBlur);
    document.addEventListener('visibilitychange',this.onVisibility);
    canvas.addEventListener('webglcontextlost',this.onContextLost);
    this.prepare('frenzy','competitive',60);
    this.lastFrame=performance.now();this.raf=requestAnimationFrame(this.loop);
  }
  setSettings(settings:AimSettings){this.settings=settings;this.resize();}
  private resize(){
    const scale=Math.min(window.devicePixelRatio||1,2)*this.settings.renderScale;
    const w=Math.min(3400,Math.max(2,Math.floor(this.canvas.clientWidth*scale)));
    const h=Math.min(2200,Math.max(2,Math.floor(this.canvas.clientHeight*scale)));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h);}
  }
  prepare(drill:AimDrill,difficulty:AimDifficulty,duration:number) {
    this.drill=drill;this.difficulty=difficulty;this.duration=duration;this.state='ready';this.mouseHeld=false;
    this.score=this.hits=this.shots=this.elapsed=this.killSumMs=this.holdMs=this.onTargetMs=this.previousTrackScore=0;
    this.yaw=this.pitch=0;this.cursorActive=0;this.populate();this.callbacks.onUpdate(this.snapshot());
  }
  private radius(){
    const standard:Record<AimDrill,number>={frenzy:.51,sixshot:.23,micro:.24,smooth:.46,strafe:.42,switch:.40,bounce:.41};
    return standard[this.drill]*DIFFICULTIES[this.difficulty].size*clamp(this.settings.targetScale,.5,1.75);
  }
  private spawn(index:number){
    const now=performance.now();const radSize=this.radius(),d=this.drill;
    let x=rnd(-3.9,3.9),y=rnd(1.05,4.25),z=-10;
    if(d==='micro'){x=rnd(-2.5,2.5);y=rnd(1.05,2.85);z=-10;}
    if(d==='sixshot'){x=rnd(-3.7,3.7);y=rnd(.75,4.1);z=-9;}
    if(d==='switch'){x=rnd(-4,4);y=rnd(1,4);z=-10;}
    if(d==='smooth'||d==='strafe'){x=rnd(-2,2);y=2.25;z=-10;}
    if(d==='bounce'){x=rnd(-3.2,3.2);y=rnd(1.2,3.5);z=-10;}
    // Avoid stacking targets or spawning a target directly on the crosshair.
    for(let i=0;i<25 && (this.targets.some((t,j)=>j!==index&&Math.hypot(t.x-x,t.y-y)<radSize*3.2)||
      (d!=='smooth'&&d!=='strafe'&&Math.hypot(x,y-1.65)<radSize*1.9));i++){
      x=rnd(d==='micro'?-2.5:-4,d==='micro'?2.5:4);
      y=rnd(d==='micro'?.95:.8,d==='micro'?2.9:4.1);
    }
    const target:Target={x,y,z,r:radSize,vx:rnd(1.3,2.8)*(Math.random()<.5?-1:1),vy:rnd(.7,1.7)*(Math.random()<.5?-1:1),spawnedAt:now,phase:rnd(0,Math.PI*2)};
    this.targets[index]=target;
  }
  private populate(){this.targets=[];for(let i=0;i<DRILLS[this.drill].count;i++)this.spawn(i);}
  async requestLock() {
    try{
      if(document.pointerLockElement!==this.canvas){
        // Chromium-based WebView2 may provide unadjusted raw pointer input.
        // It is not guaranteed, so fall back to normal pointer lock.
        try{await this.canvas.requestPointerLock({unadjustedMovement:true});}
        catch{await this.canvas.requestPointerLock();}
      }else{this.state='running';this.callbacks.onLock(true);}
    }catch(e){this.callbacks.onError(`Mouse capture failed: ${e instanceof Error?e.message:String(e)}. Click the arena and try again.`);}
  }
  private onPointerError=()=>{this.callbacks.onError('Mouse capture was blocked. Click inside the arena to resume, or check WebView2 pointer-lock permissions.');};
  private onLockChange=()=>{
    if(this.destroyed)return;
    const locked=document.pointerLockElement===this.canvas;
    if(locked){if(this.state!=='results'){this.state='running';this.lastFrame=performance.now();this.callbacks.onLock(true);}}
    else {this.mouseHeld=false;if(this.state==='running'){this.state='paused';this.callbacks.onLock(false);}}
  };
  private onMouseMove=(e:MouseEvent)=>{
    if(this.state!=='running'||document.pointerLockElement!==this.canvas)return;
    // movementX/Y originate from the host; DPI is entered for calibration only.
    const factor=.555*rad/100;
    this.yaw+=clamp(e.movementX,-600,600)*this.settings.x*factor;
    this.pitch=clamp(this.pitch-clamp(e.movementY,-600,600)*this.settings.y*factor,-1.49,1.49);
    // Allow genuine unrestricted 360-degree rotation, wrapping only for precision.
    if(Math.abs(this.yaw)>Math.PI*2)this.yaw%=Math.PI*2;
  };
  private raycast():number {
    const dir:Vec3=[Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)];
    let nearest=Infinity,result=-1;
    for(let i=0;i<this.targets.length;i++){
      const t=this.targets[i],offset:Vec3=[EYE[0]-t.x,EYE[1]-t.y,EYE[2]-t.z];
      const b=offset[0]*dir[0]+offset[1]*dir[1]+offset[2]*dir[2];
      const c=offset[0]**2+offset[1]**2+offset[2]**2-t.r**2;
      const disc=b*b-c;if(disc<0)continue;
      const dist=-b-Math.sqrt(disc);
      if(dist>0&&dist<nearest){nearest=dist;result=i;}
    }
    return result;
  }
  private onMouseDown=(e:MouseEvent)=>{
    if(this.state!=='running'||document.pointerLockElement!==this.canvas||e.button!==0)return;
    e.preventDefault();this.mouseHeld=true;
    if(DRILLS[this.drill].tracking)return;
    this.shots++;
    const targetIndex=this.raycast();
    if(targetIndex<0||(this.drill==='switch'&&targetIndex!==this.cursorActive))return;
    const target=this.targets[targetIndex];this.hits++;
    const killTime=performance.now()-target.spawnedAt;
    this.killSumMs+=killTime;
    this.score+=100+Math.max(0,Math.round(60-Math.min(60,killTime/20)));
    this.playHit();
    if(this.drill==='switch')this.cursorActive=(this.cursorActive+1)%this.targets.length;
    this.spawn(targetIndex);this.callbacks.onUpdate(this.snapshot());
  };
  private playHit(){
    if(!this.settings.sound)return;
    try{
      if(!this.audio)this.audio=new AudioContext({latencyHint:'interactive'});
      if(this.audio.state==='suspended')void this.audio.resume();
      const osc=this.audio.createOscillator(),gain=this.audio.createGain(),t=this.audio.currentTime;
      osc.type='sine';osc.frequency.setValueAtTime(820,t);osc.frequency.exponentialRampToValueAtTime(1250,t+.048);
      gain.gain.setValueAtTime(.06,t);gain.gain.exponentialRampToValueAtTime(.001,t+.06);
      osc.connect(gain);gain.connect(this.audio.destination);osc.start(t);osc.stop(t+.065);
      osc.addEventListener('ended',()=>{osc.disconnect();gain.disconnect();},{once:true});
    }catch{/* Audio should never block aim input. */}
  }
  private onMouseUp=(e:MouseEvent)=>{if(e.button===0)this.mouseHeld=false;};
  private onBlur=()=>{if(document.pointerLockElement===this.canvas)document.exitPointerLock();};
  private onVisibility=()=>{if(document.hidden&&document.pointerLockElement===this.canvas)document.exitPointerLock();};
  private onContextLost=(e:Event)=>{e.preventDefault();this.state='paused';this.callbacks.onError('Graphics context was lost. Leave and reopen the Aim Trainer tab.');};
  private snapshot():AimStats {
    const tracking=DRILLS[this.drill].tracking;
    const accuracy=tracking?(this.holdMs>0?this.onTargetMs/this.holdMs*100:0):this.shots>0?this.hits/this.shots*100:0;
    return {remaining:Math.max(0,this.duration-this.elapsed),elapsed:this.elapsed,
      score:this.score,hits:this.hits,shots:this.shots,accuracy,
      avgKillMs:this.hits?this.killSumMs/this.hits:0,
      targetHitsPerMinute:this.elapsed?this.hits*60/this.elapsed:0,
      fps:this.fps,frameMs:this.frameMs,holdMs:this.holdMs,onTargetMs:this.onTargetMs};
  }
  getStats(){return this.snapshot();}
  private loop=(now:number)=>{
    if(this.destroyed)return;
    this.raf=requestAnimationFrame(this.loop);
    if(this.settings.fpsLimit>0 && now-this.lastPaint<1000/this.settings.fpsLimit-1.2)return;
    const elapsedMs=this.lastFrame?Math.max(0,now-this.lastFrame):0;
    const dt=Math.min(.2,elapsedMs/1000);
    const elapsedWall=Math.min(2,elapsedMs/1000);
    this.lastFrame=now;this.lastPaint=now;
    if(this.state==='running'){
      this.elapsed+=elapsedWall;
      const speed=DIFFICULTIES[this.difficulty].speed*clamp(this.settings.speedScale,.5,2.5);
      for(const t of this.targets){
        if(this.drill==='smooth'){
          t.phase+=dt*speed;t.x=Math.sin(t.phase*1.75)*3.35;t.y=2.4+Math.sin(t.phase*.91)*1.05;
        }else if(this.drill==='strafe'||this.drill==='bounce'){
          t.x+=t.vx*dt*speed*1.45;t.y+=(this.drill==='bounce'?t.vy*dt*speed*1.2:0);
          if(t.x>4.2-t.r){t.x=4.2-t.r;t.vx=-Math.abs(t.vx)*rnd(.8,1.18);}
          if(t.x< -4.2+t.r){t.x=-4.2+t.r;t.vx=Math.abs(t.vx)*rnd(.8,1.18);}
          if(this.drill==='bounce'){
            if(t.y>4.15-t.r){t.y=4.15-t.r;t.vy=-Math.abs(t.vy);}
            if(t.y<.8+t.r){t.y=.8+t.r;t.vy=Math.abs(t.vy);}
          }
        }
      }
      if(DRILLS[this.drill].tracking&&this.mouseHeld){
        this.holdMs+=dt*1000;
        if(this.raycast()>=0){this.onTargetMs+=dt*1000;const earned=Math.floor(this.onTargetMs/25);
          this.score+=(earned-this.previousTrackScore)*4;this.previousTrackScore=earned;}
      }
      if(this.elapsed>=this.duration){
        this.elapsed=this.duration;this.state='results';this.mouseHeld=false;
        if(document.pointerLockElement===this.canvas)document.exitPointerLock();
        this.callbacks.onFinish(this.snapshot());
      }
    }
    this.render();
    // Called after the WebGL draw commands were submitted for this frame.
    // A 750ms rolling sample reflects actual submitted frames (including cap,
    // throttling, stutter and tab visibility), not the selected graphics preset.
    const paintedAt=performance.now();
    if(this.recentPaints.length && paintedAt-this.recentPaints[this.recentPaints.length-1]>1500) this.recentPaints=[];
    this.recentPaints.push(paintedAt);
    while(this.recentPaints.length>2 && paintedAt-this.recentPaints[0]>750) this.recentPaints.shift();
    if(this.recentPaints.length>=3){
      const observed=paintedAt-this.recentPaints[0];
      this.fps=observed>0?(this.recentPaints.length-1)*1000/observed:0;
      this.frameMs=this.fps>0?1000/this.fps:0;
    }
    if(now-this.lastHud>180){this.callbacks.onUpdate(this.snapshot());this.lastHud=now;}
  };
  private draw(mesh:Mesh,m:Mat4,color:Vec3,emission=0,material=0){
    const gl=this.gl;
    gl.uniformMatrix4fv(this.modelLoc,false,m);gl.uniform3fv(this.colorLoc,color);
    gl.uniform1f(this.emissionLoc,emission);gl.uniform1i(this.materialLoc,material);
    gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.vertices);
  }
  private drawBox(x:number,y:number,z:number,sx:number,sy:number,sz:number,c:Vec3,glow=0,material=0) {
    this.draw(this.cube,model(x,y,z,sx,sy,sz),c,glow,material);
  }
  private render(){
    const gl=this.gl; if(gl.isContextLost())return;
    this.resize();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.shader);
    const aspect=Math.max(.1,this.canvas.width/this.canvas.height);
    // User-facing FOV is horizontal; perspective() expects vertical.
    const vfov=2*Math.atan(Math.tan(clamp(this.settings.fov,65,120)*rad/2)/aspect);
    const dir:Vec3=[Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)];
    gl.uniformMatrix4fv(this.vpLoc,false,multiply(perspective(vfov,aspect,.04,90),lookAt(EYE,dir)));
    // Minimal indoor sci-fi arena. Solid 3D geometry, no online textures.
    this.drawBox(0,-.14,-13,32,.25,50,[.065,.065,.072],0,1);
    this.drawBox(0,8,-13,32,.24,50,[.042,.042,.05]);
    this.drawBox(-10,4,-13,.25,8,50,[.065,.065,.07],0,2);
    this.drawBox(10,4,-13,.25,8,50,[.065,.065,.07],0,2);
    this.drawBox(0,4,-22,32,8,.3,[.067,.067,.075],0,2);
    this.drawBox(0,.1,-12,30,.15,.24,[.31,.31,.35],.3);
    for(let x=-8;x<=8;x+=4){
      this.drawBox(x,4.25,-21.75,.07,7.5,.10,[.24,.24,.27],.6);
    }
    for(const z of [-7,-14,-20]){
      this.drawBox(-9.75,4,z,.1,8,.20,[.16,.16,.19],.3);
      this.drawBox(9.75,4,z,.1,8,.20,[.16,.16,.19],.3);
      this.drawBox(0,7.7,z,20,.08,.22,[.28,.28,.32],.4);
    }
    if(this.settings.quality!=='performance'){
      for(let x=-8;x<=8;x+=4){this.drawBox(x,.06,-13,.025,.045,42,[.22,.22,.25],.3);}
      for(let z=-20;z<=6;z+=4){this.drawBox(0,.065,z,20,.04,.035,[.22,.22,.25],.2);}
    }
    if(this.settings.quality==='high'){
      for(let z=-5;z>=-19;z-=7){this.drawBox(0,7.55,z,7,.10,.28,[.52,.52,.59],.5);}
    }
    // Target geometry is rendered with depth testing; crosshair raycast shares
    // these world coordinates so hit detection aligns with the visible sphere.
    for(let i=0;i<this.targets.length;i++){
      const t=this.targets[i], active=this.drill!=='switch'||i===this.cursorActive;
      const color=targetColor(active,DRILLS[this.drill].tracking);
      this.draw(this.ball,model(t.x,t.y,t.z,t.r,t.r,t.r),color,active ? .9 : .02);
      if(active){
        // Smaller core makes hitboxes easier to read in motion.
        this.draw(this.ball,model(t.x,t.y,t.z+t.r*.86,t.r*.29,t.r*.29,t.r*.29),[1,1,1],.55);
      }
    }
    gl.bindVertexArray(null);
  }
  destroy(){
    this.destroyed=true;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();
    if(document.pointerLockElement===this.canvas)document.exitPointerLock();
    document.removeEventListener('pointerlockchange',this.onLockChange);
    document.removeEventListener('pointerlockerror',this.onPointerError);
    document.removeEventListener('mousemove',this.onMouseMove);
    document.removeEventListener('mousedown',this.onMouseDown);
    document.removeEventListener('mouseup',this.onMouseUp);
    document.removeEventListener('visibilitychange',this.onVisibility);
    window.removeEventListener('blur',this.onBlur);
    this.canvas.removeEventListener('webglcontextlost',this.onContextLost);
    const gl=this.gl;gl.deleteBuffer(this.cube.buffer);gl.deleteVertexArray(this.cube.vao);
    gl.deleteBuffer(this.ball.buffer);gl.deleteVertexArray(this.ball.vao);gl.deleteProgram(this.shader);
    if(this.audio){void this.audio.close().catch(()=>{});this.audio=null;}
  }
}
