/** Copy already downloaded real portraits from nearby Maq's Passion projects.
 * Runs automatically before development builds. Never downloads, forges or substitutes a portrait.
 */
import { readdir, readFile, copyFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const folder=join(root,'public','players');
const manifest=join(root,'src','photo-manifest.json');
const ids=['peterbot','pollo','veno','clix','bugha','mongraal','mrsavage','malibuca','kami','reet'];
const candidates=[folder];
const parents=[dirname(root),dirname(dirname(root))];
for (const parent of parents){
  try {for(const entry of await readdir(parent,{withFileTypes:true})){
    if(!entry.isDirectory()||!entry.name.toLowerCase().includes('maq'))continue;
    const p=join(parent,entry.name,'public','players');
    if(p!==folder)candidates.push(p);
  }}catch {/**/}
}
const isImage=b=>b.length>1000&&((b[0]===0xff&&b[1]===0xd8)||(b[0]===0x89&&b[1]===0x50)||(b[0]===0x52&&b[1]===0x49&&b[8]===0x57));
await mkdir(folder,{recursive:true});
const items=[];
for(const id of ids){
  for(const source of candidates){
    let got=false;
    for(const ext of ['jpg','jpeg','png','webp']){
      const filename=`${id}.${ext}`;
      try{
        const src=join(source,filename);const data=await readFile(src);
        if(!isImage(data))continue;
        if(source!==folder)await copyFile(src,join(folder,filename));
        items.push({id,file:filename});got=true;break;
      }catch{/**/}
    }
    if(got)break;
  }
}
await writeFile(manifest,JSON.stringify({players:items},null,2)+'\n');
console.log(`Maq's Passion: ${items.length}/${ids.length} real portraits found in local project folders.`);
if(!items.length)console.log('No real photo files are present. None will be fabricated. Place licensed images in public/players to bundle them.');
