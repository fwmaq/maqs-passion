import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const folder = join(root, 'public', 'players');
const manifestPath = join(root, 'src', 'photo-manifest.json');
const players = [
  ['peterbot', 'peterbot'], ['pollo', 'pollofn'], ['veno', 'veno'],
  ['clix', 'clix'], ['bugha', 'bugha'], ['mongraal', 'mongraal'],
  ['mrsavage', 'mrsavage'], ['malibuca', 'malibuca'],
  ['kami', 'kami'], ['reet', 'reet']
];
const signature = bytes => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
  return null;
};
function attrsOf(tag){
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(([,key,,value]) => [key.toLowerCase(),value.replaceAll('&amp;','&')]));
}
function getMeta(html, property) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs=attrsOf(tag);
    if (attrs.property === property || attrs.name === property) return attrs.content;
  }
}
function photoCandidates(html, slug, pageUrl) {
  // Prioritise an actual player headshot from the player's own page, not an og:image logo.
  const candidates=[];
  for(const tag of html.match(/<img\b[^>]*>/gi)||[]){
    const attrs=attrsOf(tag);
    const alt=(attrs.alt||'').toLowerCase();
    const name = slug === 'pollofn' ? 'pollo' : slug;
    if (!alt.includes(name) || alt.includes('logo') || alt.includes('team')) continue;
    const src=attrs['data-src']||attrs['data-lazy-src']||attrs.src||attrs.srcset?.split(',')[0]?.trim().split(' ')[0];
    if(src && !src.startsWith('data:'))candidates.push(new URL(src,pageUrl).href);
  }
  for(const url of [getMeta(html,'og:image'),getMeta(html,'twitter:image')]){
    if(url)candidates.push(new URL(url,pageUrl).href);
  }
  return [...new Set(candidates)].filter(url=>url.startsWith('https://'));
}
const fetchWithTimeout = async url => fetch(url, { signal: AbortSignal.timeout(18000), headers: { 'Accept': 'text/html,image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' } });
await mkdir(folder, {recursive: true});
const available = [];
for (const [id, slug] of players) {
  // If a user has already saved a portrait, keep it regardless of source.
  let saved = false;
  for (const ext of ['jpg','png','webp']) {
    try {
      const bytes = new Uint8Array(await readFile(join(folder, `${id}.${ext}`)));
      if (bytes.length > 1500 && signature(bytes)) {
        available.push({id, file:`${id}.${ext}`});
        console.log(`✓ ${id}: using existing local file`);
        saved = true;
        break;
      }
    } catch { /* not installed yet */ }
  }
  if (saved) continue;
  try {
    const pageURL = `https://prosettings.net/players/${slug}/`;
    const page = await fetchWithTimeout(pageURL);
    if (!page.ok) throw new Error(`profile returned HTTP ${page.status}`);
    const html = await page.text();
    const candidates=photoCandidates(html,slug,pageURL);
    if (!candidates.length) throw new Error('no portrait image candidates found');
    let downloaded=null;
    for(const url of candidates){
      try {
        const response=await fetchWithTimeout(url);
        if(!response.ok)continue;
        const bytes=new Uint8Array(await response.arrayBuffer());
        const ext=signature(bytes);
        if(ext && bytes.length>=1500){downloaded={bytes,ext};break;}
      }catch { /* try the next candidate */ }
    }
    if(!downloaded) throw new Error('all portrait candidates failed or were not images');
    const {bytes,ext}=downloaded;
    await writeFile(join(folder, `${id}.${ext}`), bytes);
    available.push({id, file:`${id}.${ext}`});
    console.log(`✓ ${id}: saved ${ext.toUpperCase()} (${Math.round(bytes.length/1024)} KB)`);
  } catch (error) {
    console.warn(`✗ ${id}: ${error.message}`);
  }
}
await writeFile(manifestPath, JSON.stringify({players:available}, null, 2)+'\n');
console.log(`\n${available.length}/${players.length} portraits available.`);
if (!available.length) console.log('No photos could be downloaded. ProSettings may restrict requests. You can save player portraits yourself into public/players/<name>.jpg (or .png/.webp) and run npm run photos again.');
