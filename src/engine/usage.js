const validId = value => typeof value === 'string' && value.trim().length > 0;
export function localDay(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('Invalid date');
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(day+'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === day;
}
export function outfitUsageId(outfit) {
  if (validId(outfit)) return outfit;
  if (validId(outfit?.sourceOutfitId)) return outfit.sourceOutfitId;
  return validId(outfit?.id) ? outfit.id : null;
}
export function usageGarments(outfit) {
  const explicit = ['top','bottom','outerwear','footwear'].map(key=>outfit?.[key]).filter(Boolean);
  const items = explicit.length ? explicit : Array.isArray(outfit?.garments) ? outfit.garments : [];
  const transition = outfit?.transitionLayer?.item;
  return [...new Map([...items,transition].filter(g=>g && typeof g==='object' && validId(g.id)).map(g=>[g.id,g])).values()];
}
export function createUsageLedger(legacyCount = 0) {
  if (!Number.isSafeInteger(legacyCount) || legacyCount < 0) throw new TypeError('Invalid legacy count');
  return {version:1,legacyCount,records:[]};
}
function validLedger(ledger) {
  if (ledger?.version !== 1 || !Number.isSafeInteger(ledger.legacyCount) || ledger.legacyCount < 0 || !Array.isArray(ledger.records)) return false;
  const keys = new Set();
  return ledger.records.every(entry=>{
    if (!validId(entry?.outfitId) || !validDay(entry.day) || !Array.isArray(entry.garmentIds) || !entry.garmentIds.length || !entry.garmentIds.every(validId) || new Set(entry.garmentIds).size !== entry.garmentIds.length) return false;
    const key = JSON.stringify([entry.outfitId,entry.day]);
    if (keys.has(key)) return false;
    keys.add(key); return true;
  });
}
export function usageRecord(ledger, outfit, day = localDay()) {
  const id = outfitUsageId(outfit);
  return validLedger(ledger) && validDay(day) && id ? ledger.records.find(entry=>entry.outfitId===id && entry.day===day) || null : null;
}
export function garmentUsedOn(ledger, garmentId, day = localDay()) {
  return validLedger(ledger) && validDay(day) && ledger.records.some(entry=>entry.day===day && entry.garmentIds.includes(garmentId));
}
export function outfitUseCount(ledger) {
  return validLedger(ledger) ? ledger.legacyCount + ledger.records.length : 0;
}
const failed = (reason,ledger,wardrobe) => ({ok:false,reason,ledger,wardrobe});
function validWardrobe(wardrobe) {
  if (!Array.isArray(wardrobe)) return false;
  const ids = new Set();
  return wardrobe.every(g=>{
    if (!validId(g?.id) || ids.has(g.id)) return false;
    ids.add(g.id);
    return Number.isSafeInteger(Number(g.timesWorn ?? 0)) && Number(g.timesWorn ?? 0)>=0;
  });
}
export function registerUsage(ledger, wardrobe, outfit, garmentIds, day = localDay()) {
  if (!validLedger(ledger)) return failed('invalid_ledger',ledger,wardrobe);
  if (!validWardrobe(wardrobe)) return failed('invalid_wardrobe',ledger,wardrobe);
  const id = outfitUsageId(outfit);
  if (!id || !validDay(day)) return failed('invalid_request',ledger,wardrobe);
  if (!Array.isArray(garmentIds) || !garmentIds.every(validId)) return failed('invalid_selection',ledger,wardrobe);
  const ids = [...new Set(garmentIds)];
  if (!ids.length) return failed('empty_selection',ledger,wardrobe);
  const previous = usageRecord(ledger,id,day);
  if (previous) {
    if (previous.garmentIds.length === ids.length && ids.every(value=>previous.garmentIds.includes(value))) return {ok:true,duplicate:true,ledger,wardrobe,entry:previous,incrementedIds:[]};
    return failed('already_recorded',ledger,wardrobe);
  }
  const allowed = new Map(usageGarments(outfit).map(g=>[g.id,g]));
  const available = new Map(wardrobe.map(g=>[g.id,g]));
  if (ids.some(value=>!allowed.has(value))) return failed('foreign_garment',ledger,wardrobe);
  if (ids.some(value=>!available.has(value) || available.get(value).state!=='available' || available.get(value).category!==allowed.get(value).category)) return failed('unavailable_selection',ledger,wardrobe);
  const incrementedIds = ids.filter(value=>!garmentUsedOn(ledger,value,day));
  if (incrementedIds.some(value=>Number(available.get(value).timesWorn ?? 0)>=Number.MAX_SAFE_INTEGER)) return failed('counter_overflow',ledger,wardrobe);
  const increments = new Set(incrementedIds);
  const entry = {outfitId:id,day,garmentIds:ids};
  return {ok:true,duplicate:false,entry,incrementedIds,
    ledger:{...ledger,records:[...ledger.records,entry]},
    wardrobe:increments.size ? wardrobe.map(g=>increments.has(g.id)?{...g,timesWorn:Number(g.timesWorn ?? 0)+1}:g) : wardrobe};
}
export function revokeUsage(ledger, wardrobe, outfit, day = localDay()) {
  if (!validLedger(ledger)) return failed('invalid_ledger',ledger,wardrobe);
  if (!validWardrobe(wardrobe)) return failed('invalid_wardrobe',ledger,wardrobe);
  const id = outfitUsageId(outfit);
  if (!id || !validDay(day)) return failed('invalid_request',ledger,wardrobe);
  const entry = usageRecord(ledger,id,day);
  if (!entry) return {ok:true,duplicate:true,ledger,wardrobe,decrementedIds:[]};
  const next = {...ledger,records:ledger.records.filter(item=>item!==entry)};
  const decrements = new Set(entry.garmentIds.filter(value=>!garmentUsedOn(next,value,day)));
  const decrementedIds = wardrobe.filter(g=>decrements.has(g.id) && Number(g.timesWorn ?? 0)>0).map(g=>g.id);
  return {ok:true,duplicate:false,ledger:next,decrementedIds,
    wardrobe:decrementedIds.length ? wardrobe.map(g=>decrements.has(g.id)?{...g,timesWorn:Math.max(0,Number(g.timesWorn ?? 0)-1)}:g) : wardrobe};
}
