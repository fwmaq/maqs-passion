/** Defensive decoder of fortnite-api.com/v2/shop. Epic regularly changes offer layouts. */
export type ShopEntry = {
  id: string; title: string; images: string[]; price: number | null;
  section: string; ends: string | null; kind: string;
};
type Obj = Record<string, unknown>;
const obj = (value:unknown):Obj => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
const arr = (value:unknown):unknown[] => Array.isArray(value) ? value : [];
const str = (value:unknown):string => typeof value === 'string' ? value.trim() : '';
const first = (...xs:unknown[]):string => xs.map(str).find(Boolean) || '';
const validImage = (v:unknown): v is string => typeof v === 'string' && /^https:\/\//i.test(v) && !/[\s<>]/.test(v);
const namesafe = (v:unknown):string => {
  const s = str(v).replace(/\s+/g, ' ');
  if (!s || /^\[?(?:virtual|placeholder|unknown|tbd)\]?\b/i.test(s) || /(?:SID_|MtxCurrency|FortItemStore|_C$|_636\b|AthenaItemShop)/i.test(s)) return '';
  return s.length > 95 ? s.slice(0,92) + '…' : s;
};
const collectImage = (value:unknown, found:string[]) => {
  if (validImage(value) && !found.includes(value)) found.push(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const o = obj(value);
    for(const k of ['image','url','offerImage','OfferImage','featured','icon','smallIcon','largeIcon','background','portrait']) {
      if(validImage(o[k]) && !found.includes(o[k] as string)) found.push(o[k] as string);
    }
  }
};
export function parseShop(data:unknown): ShopEntry[] {
  const body = obj(obj(data).data);
  const entries = arr(body.entries).length ? arr(body.entries) : arr(body.shop);
  const output:ShopEntry[] = [];
  const seen = new Set<string>();
  for(let i=0;i<entries.length;i++){
    const e=obj(entries[i]); const bundle=obj(e.bundle); const asset=obj(e.newDisplayAsset);
    const cosmeticTypes=['brItems','tracks','instruments','cars','legoKits','jamTracks','items'];
    const cosmetics=cosmeticTypes.flatMap(k=>arr(e[k])).map(obj);
    const displayNames=cosmetics.map(c=>namesafe(c.name)).filter(Boolean);
    const suppliedName=namesafe(bundle.name) || namesafe(e.displayName) || namesafe(e.name);
    // The developer label describes an offer contract, not a player-facing item.
    // Never show it as an item title (e.g. [VIRTUAL] 1x ... MtxCurrency).
    const title=suppliedName || (displayNames.length > 1 ? `${displayNames[0]} + ${displayNames.length-1} more` : displayNames[0] || '');
    if (!title) continue; // Skip placeholder/promotional entries without a known public name.
    const images:string[]=[];
    // Display art used by the actual shop has priority over legacy icon thumbnails.
    for(const render of arr(asset.renderImages)) collectImage(render,images);
    for(const material of arr(asset.materialInstances)) collectImage(obj(material).images,images);
    collectImage(bundle.image,images);
    for(const cosmetic of cosmetics){
      collectImage(obj(cosmetic.images).featured,images);
      collectImage(obj(cosmetic.images).icon,images);
      collectImage(obj(cosmetic.images).smallIcon,images);
      collectImage(obj(cosmetic.images).largeIcon,images);
      collectImage(cosmetic.images,images);
    }
    collectImage(e.image,images);
    const layout=obj(e.layout);
    const section=first(layout.name, layout.category, e.sectionId, 'Other');
    const priceValue=e.finalPrice;
    const price=typeof priceValue==='number' && Number.isFinite(priceValue) && priceValue>=0 ? priceValue : null;
    const date=str(e.outDate);
    const ends=date && !Number.isNaN(Date.parse(date)) ? date : null;
    const rawId=first(e.offerId,e.id);
    const id=rawId || `${title}-${section}-${i}`;
    const uniqueKey=rawId || `${title.toLowerCase()}-${section.toLowerCase()}`;
    if(seen.has(uniqueKey))continue;
    seen.add(uniqueKey);
    output.push({id,title,images,price,section,ends,kind:first(obj(cosmetics[0]).type,layout.category,'Cosmetic')});
  }
  return output;
}
