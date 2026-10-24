import {
  createUsageLedger,
  registerUsage,
  revokeUsage,
  usageRecord,
  garmentUsedOn,
  outfitUseCount,
  usageGarments,
  outfitUsageId,
  localDay
} from './usage.js';

const COPY = {
 es:{save:'Guardar outfit',saved:'Outfit guardado',savedToast:'Outfit añadido a Guardados.',wear:'Me lo puse hoy',worn:'Uso registrado hoy',wornToast:'Uso registrado y contadores actualizados.',unavailable:'Este look contiene prendas no disponibles. Revisa tu armario.',overview:'Evaluación orientativa',sub:'Una estimación basada en los datos de tus prendas, no una garantía de estilo.',empty:'Los outfits que guardes aparecerán aquí.',historySub:'Tus combinaciones guardadas. Registrar su uso es una acción independiente.',partial:'La información de este apartado es parcial.',missing:'No hay datos suficientes para valorar este aspecto.',noPreference:'No has solicitado una preferencia concreta.',noComfort:'No se ha evaluado la comodidad para esta ocasión.',savedDate:'Guardado',labels:{formality:'Adecuación a la ocasión',thermal:'Confort térmico',color:'Combinación de colores',preferences:'Preferencias',rotation:'Rotación del armario',comfort:'Comodidad'},reasons:{formality:'Encaje con la ocasión elegida.',thermal:'Encaje con la temperatura y el tiempo indicados.',color:'Relación entre las familias de color registradas.',preferences:'Encaje con el ajuste solicitado.',rotation:'Rotación según los usos registrados.',comfort:'Comodidad según los atributos disponibles.'},occasions:{office:'la oficina',casual:'un plan informal',dinner:'una cena',weekend:'el fin de semana',gym:'el gimnasio',party:'una salida nocturna'}},
 en:{save:'Save outfit',saved:'Outfit saved',savedToast:'Outfit added to Saved.',wear:'Wore this today',worn:'Wear recorded today',wornToast:'Wear recorded and counters updated.',unavailable:'This look contains unavailable garments. Review your wardrobe.',overview:'Indicative assessment',sub:'An estimate based on your garment data, not a style guarantee.',empty:'Outfits you save will appear here.',historySub:'Your saved combinations. Recording wear is a separate action.',partial:'Information for this aspect is incomplete.',missing:'Not enough data to assess this aspect.',noPreference:'No specific preference was requested.',noComfort:'Comfort was not assessed for this occasion.',savedDate:'Saved',labels:{formality:'Occasion suitability',thermal:'Thermal comfort',color:'Color coordination',preferences:'Preferences',rotation:'Wardrobe rotation',comfort:'Comfort'},reasons:{formality:'Fit for the selected occasion.',thermal:'Fit for the specified temperature and weather.',color:'Relationship between recorded color families.',preferences:'Fit for the requested adjustment.',rotation:'Rotation based on recorded wear.',comfort:'Comfort based on available attributes.'},occasions:{office:'the office',casual:'a casual plan',dinner:'dinner',weekend:'the weekend',gym:'the gym',party:'a night out'}},
 ca:{save:'Desar outfit',saved:'Outfit desat',savedToast:'Outfit afegit a Desats.',wear:'Me’l poso avui',worn:'Ús registrat avui',wornToast:'Ús registrat i comptadors actualitzats.',unavailable:'Aquest look conté peces no disponibles. Revisa l’armari.',overview:'Avaluació orientativa',sub:'Una estimació basada en les dades de les peces, no una garantia d’estil.',empty:'Els outfits que desis apareixeran aquí.',historySub:'Les teves combinacions desades. Registrar-ne l’ús és una acció independent.',partial:'La informació d’aquest apartat és parcial.',missing:'No hi ha prou dades per valorar aquest aspecte.',noPreference:'No has demanat una preferència concreta.',noComfort:'No s’ha avaluat la comoditat per a aquesta ocasió.',savedDate:'Desat',labels:{formality:'Adequació a l’ocasió',thermal:'Confort tèrmic',color:'Combinació de colors',preferences:'Preferències',rotation:'Rotació de l’armari',comfort:'Comoditat'},reasons:{formality:'Adequació a l’ocasió triada.',thermal:'Adequació a la temperatura i al temps indicats.',color:'Relació entre les famílies de color registrades.',preferences:'Adequació al retoc demanat.',rotation:'Rotació segons els usos registrats.',comfort:'Comoditat segons els atributs disponibles.'},occasions:{office:'l’oficina',casual:'un pla informal',dinner:'un sopar',weekend:'el cap de setmana',gym:'el gimnàs',party:'una sortida nocturna'}}
};
export const copy = lang => COPY[lang] || COPY.es;
const clone = value => JSON.parse(JSON.stringify(value));
export function factorList(breakdown = {}, lang = 'es') {
 const t = copy(lang);
 return Object.entries(breakdown).filter(([key])=>Object.hasOwn(t.labels,key)).map(([key,value])=>{
  const coverage=Number(value?.coverage||0);
  let reason=t.reasons[key];
  if(coverage<=0)reason=key==='preferences'?t.noPreference:key==='comfort'?t.noComfort:t.missing;
  else if(coverage<1)reason+=' '+t.partial;
  if((value?.limitations||[]).includes('limited_color_data'))reason=t.missing;
  const measurable=coverage>0&&!(value?.limitations||[]).includes('limited_color_data')&&Number.isFinite(value?.score);
  return {key,label:t.labels[key],score:measurable?Math.round(Math.max(0,Math.min(1,value.score))*100):null,reason};
 });
}
export function limitationText(meta,lang){
 const t=copy(lang);if(!meta?.limitations?.length)return '';
 return t.sub+(meta.limitations.some(key=>['no_temperature','limited_color_data','limited_comfort_metadata'].includes(key))?' '+t.missing:'');
}
export function baseGarments(look){
 const explicit=['top','bottom','outerwear','footwear'].map(key=>look?.[key]).filter(Boolean);
 const all=explicit.length?explicit:(Array.isArray(look?.garments)?look.garments.filter(g=>g&&typeof g==='object'&&g.id):[]);
 return [...new Map(all.map(g=>[g.id,g])).values()];
}
function garmentName(garment,lang){
 const raw=typeof garment?.name==='string'?garment.name:garment?.name?.[lang]||garment?.name?.es;
 return raw?raw.replace(/[.!?\n\r]/g,' ').trim().split(/\s+/).slice(0,6).join(' '):'';
}
export function describe(look,lang='es'){
 const l=COPY[lang]?lang:'es',t=copy(l),context=look?.contextSnapshot||{};
 const occasion=t.occasions[context.occasion||look?.occasionKey]||({es:'tu día',en:'your day',ca:'el teu dia'})[l];
 const garments=baseGarments(look);
 const top=look?.top||garments.find(g=>g.category==='top'),bottom=look?.bottom||garments.find(g=>g.category==='bottom');
 const names=[garmentName(top,l),garmentName(bottom,l)].filter(Boolean);
 let intro;
 if(l==='en')intro=names.length===2?`For ${occasion}, pair ${names[0]} with ${names[1]}.`:`A combination selected for ${occasion}.`;
 else if(l==='ca')intro=names.length===2?`Per a ${occasion}, combina ${names[0]} amb ${names[1]}.`:`Una combinació triada per a ${occasion}.`;
 else intro=names.length===2?`Para ${occasion}, combina ${names[0]} con ${names[1]}.`:`Una combinación elegida para ${occasion}.`;
 const color=look?.scoreMeta?.factors?.color,thermal=look?.scoreMeta?.factors?.thermal;
 let second=({es:'La propuesta reúne las prendas seleccionadas para este plan.',en:'The proposal brings together the garments selected for this plan.',ca:'La proposta reuneix les peces triades per a aquest pla.'})[l];
 if(color?.coverage>0&&!(color.limitations||[]).includes('limited_color_data')&&color.score>=0.75)second=({es:'Las familias de color registradas mantienen una paleta sencilla.',en:'The recorded color families keep the palette simple.',ca:'Les famílies de color registrades mantenen una paleta senzilla.'})[l];
 else if(context.tempC!=null&&thermal?.coverage>0&&thermal.score>=0.75)second=({es:'Las prendas encajan con la temperatura indicada para el plan.',en:'The garments fit the temperature specified for this plan.',ca:'Les peces encaixen amb la temperatura indicada per al pla.'})[l];
 return intro+' '+second;
}
export const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function saved(history,look){return Boolean(look?.id&&history.some(entry=>entry.sourceOutfitId===look.id));}
export function wornToday(look,day=dayKey()){return(look?.wornDates||[]).includes(day);}
export function canUse(look,wardrobe){
 const garments=baseGarments(look),complete=['top','bottom','footwear'].every(category=>garments.some(g=>g.category===category));
 const transition=look?.transitionLayer?.item,all=transition?.id?[...garments,transition]:garments;
 return complete&&all.every(g=>wardrobe.some(item=>item.id===g.id&&item.category===g.category&&item.state==='available'));
}
export function saveLook(history,look,wardrobe,context={},now=new Date()){
 if(!look?.id||!canUse(look,wardrobe))return{ok:false,history,reason:'unavailable'};
 if(saved(history,look))return{ok:true,history,duplicate:true};
 const snapshot=clone(look),garments=baseGarments(snapshot);
 const entry={...snapshot,id:'saved_'+look.id,sourceOutfitId:look.id,savedAt:now.toISOString(),wornDates:[],garments,garmentNames:garments.map(g=>typeof g.name==='string'?g.name:g.id),contextSnapshot:clone(look.contextSnapshot||context),occasionKey:(look.contextSnapshot||context).occasion||'casual',tags:[(look.contextSnapshot||context).occasion||'casual']};
 if(entry.contextSnapshot.dualJourney?.enabled)entry.tags.push(entry.contextSnapshot.dualJourney.type);
 return{ok:true,history:[entry,...history],entry};
}
export function markWorn(history,wardrobe,id,day=dayKey()){
 const entry=history.find(look=>look.id===id);
 if(!entry||!canUse(entry,wardrobe))return{ok:false,history,wardrobe,reason:'unavailable'};
 if(wornToday(entry,day))return{ok:true,history,wardrobe,duplicate:true};
 const ids=new Set(baseGarments(entry).map(g=>g.id));
 return{ok:true,history:history.map(look=>look.id===id?{...look,legacyWearCount:Array.isArray(look.wornDates)?(Number(look.legacyWearCount)||0):1,wornDates:[...(look.wornDates||[]),day]}:look),wardrobe:wardrobe.map(g=>ids.has(g.id)?{...g,timesWorn:(Number(g.timesWorn)||0)+1}:g)};
}
export function wearCount(history){return history.reduce((sum,entry)=>sum+(Array.isArray(entry.wornDates)?entry.wornDates.length+(Number(entry.legacyWearCount)||0):1),0);}
export function dateLabel(look,lang){
 if(!look?.savedAt)return look?.date||'';
 return copy(lang).savedDate+' · '+new Intl.DateTimeFormat(({es:'es-ES',en:'en-GB',ca:'ca-ES'})[lang]||'es-ES',{day:'numeric',month:'short'}).format(new Date(look.savedAt));
}
export function occasionLabel(look,lang){return copy(lang).occasions[look?.occasionKey]||look?.occasion||'';}

// ARACHNE_P4_PRESENTATION_START
export function createUsageSession(history = []) {
  return createUsageLedger(wearCount(history));
}
export function usageState(ledger, outfit, day = localDay()) {
  const record = usageRecord(ledger, outfit, day);
  return {
    recorded: Boolean(record),
    garmentIds: record ? record.garmentIds : [],
    outfitId: outfitUsageId(outfit)
  };
}
export function usageOutfitGarments(outfit) {
  return usageGarments(outfit);
}
export function usageOutfitGarmentIds(outfit) {
  return usageGarments(outfit).map(garment => garment.id);
}
export function confirmUsage(ledger, wardrobe, outfit, garmentIds, day = localDay()) {
  return registerUsage(ledger, wardrobe, outfit, garmentIds, day);
}
export function undoUsage(ledger, wardrobe, outfit, day = localDay()) {
  return revokeUsage(ledger, wardrobe, outfit, day);
}
export function profileWearCount(ledger, history = []) {
  return ledger ? outfitUseCount(ledger) : wearCount(history);
}
// ARACHNE_P4_PRESENTATION_END
