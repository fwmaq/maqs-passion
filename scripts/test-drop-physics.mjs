/* Run with npm run test:drop after npm install. Pure math; no desktop window needed. */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'maqs-drop-'));
try {
  const source=await readFile(new URL('../src/dropPhysics.ts',import.meta.url),'utf8');
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}});
  const compiled=join(dir,'dropPhysics.mjs');
  await writeFile(compiled,outputText);
  const {defaultState,solve,nearestOnBus}=await import(`file://${compiled}`);
  const assert=(condition,message)=>{if(!condition)throw new Error(`FAILED: ${message}`)};
  const base=structuredClone(defaultState);
  const result=solve(base);
  assert(result.best,'default route gives a feasible answer');
  assert(result.best.jumpFraction>=0&&result.best.jumpFraction<=1,'jump remains on the bus route');
  assert(result.best.totalSeconds>result.best.busSeconds,'total time exceeds bus time');
  assert(result.best.glideDistance<=result.best.glideSeconds*base.physics.glideHorizontal+.01,'glider must cover remaining distance');
  for(const style of ['steep','balanced','shallow'])assert(solve({...base,dive:style}).best,`${style} produces a route`);
  assert(solve({...base,physics:{...base.physics,earlyDeploy:true,manualDeploy:180}}).best,'manual early deployment is solved');
  assert(!solve({...base,target:{x:5,y:5}}).best,'unreachable route is rejected');
  assert(!solve({...base,terrain:{...base.terrain,ridgeEnabled:true,ridge:base.target,ridgeHeight:900,ridgeRadius:700}}).best,'blocking terrain makes route infeasible');
  const projection=nearestOnBus({x:0,y:0},{x:100,y:0},{x:45,y:30});
  assert(Math.abs(projection.fraction-.45)<.0001,'closest point projection');
  console.log('PASS: default solution, all dive profiles, early deploy, range limits, terrain and projection');
} finally {await rm(dir,{recursive:true,force:true})}
