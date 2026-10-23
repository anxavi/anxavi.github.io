const CATEGORIES = ['top', 'bottom', 'footwear', 'outerwear'];
const REQUIRED = ['top', 'bottom', 'footwear'];
export const ACTIVITIES = Object.freeze([
 {id:'gym',sport:true,indoor:true,target:3,labels:{es:'+ Gym',en:'+ Gym',ca:'+ Gym'}},
 {id:'running',sport:true,indoor:false,target:3,labels:{es:'+ Running',en:'+ Running',ca:'+ Running'}},
 {id:'hiking',sport:true,indoor:false,target:3,labels:{es:'+ Senderismo',en:'+ Hiking',ca:'+ Senderisme'}},
 {id:'dinner_work',sport:false,target:8,labels:{es:'+ Cena de trabajo',en:'+ Work dinner',ca:'+ Sopar de feina'}},
 {id:'dinner_friends',sport:false,target:5,labels:{es:'+ Cena con amigos',en:'+ Dinner with friends',ca:'+ Sopar amb amics'}},
 {id:'afterwork',sport:false,target:6,labels:{es:'+ Afterwork',en:'+ Afterwork',ca:'+ Afterwork'}}
]);
export const activityDefinition = id => ACTIVITIES.find(activity => activity.id === ({dinner:'dinner_friends',party:'afterwork'}[id] || id)) || null;
export const normalizeActivities = value => Array.isArray(value) ? [...new Set(value.filter(id=>ACTIVITIES.some(activity=>activity.sport&&activity.id===id)))] : [];
export const activityLabel = (id,lang='es') => { const activity=activityDefinition(id); return activity ? activity.labels[lang] || activity.labels.es : ''; };
export function supportsActivity(garment,id) {
 const activity=activityDefinition(id);
 return Boolean(garment && activity && (!activity.sport || normalizeActivities(garment.activities).includes(activity.id)));
}
const clone = value => JSON.parse(JSON.stringify(value));
const garments = outfit => CATEGORIES.map(category=>outfit?.[category]).filter(Boolean);
function checkedOutfit(outfit,inventory) {
 if(!outfit || typeof outfit!=='object') return null;
 const result={}; const seen=new Set();
 for(const category of CATEGORIES){
  const selected=outfit[category];
  if(!selected){ if(REQUIRED.includes(category))return null; result[category]=null; continue; }
  const source=inventory.find(item=>item.id===selected.id);
  if(!source || source.state!=='available' || source.category!==category || seen.has(source.id))return null;
  seen.add(source.id);result[category]=source;
 }
 return result;
}
function temperature(context,activity) {
 if(activity.indoor)return null;
 const value=context.secondaryTempC ?? context.tempC;
 return value!=null && Number.isFinite(Number(value)) ? Number(value) : null;
}
function thermalFit(garment,temp,margin=0) {
 if(temp==null)return true;
 if(garment.thermalRange?.minTempC==null||garment.thermalRange?.maxTempC==null)return false;
 const min=Number(garment.thermalRange.minTempC),max=Number(garment.thermalRange.maxTempC);
 return Number.isFinite(min)&&Number.isFinite(max)&&min<=max&&temp>=min-margin&&temp<=max+margin;
}
function averageFormality(outfit) {
 const values=garments(outfit).map(item=>item.formality==null?NaN:Number(item.formality));
 if(values.some(value=>!Number.isFinite(value)||value<0||value>10))return null;
 return values.reduce((a,b)=>a+b,0)/values.length;
}
function suitable(outfit,activity,temp) {
 if(!REQUIRED.every(category=>outfit[category]&&supportsActivity(outfit[category],activity.id)))return false;
 if(outfit.outerwear&&!supportsActivity(outfit.outerwear,activity.id))return false;
 if(activity.indoor&&outfit.outerwear)return false;
 if(!garments(outfit).every(item=>thermalFit(item,temp,4)))return false;
 const formality=averageFormality(outfit);
 return activity.sport || (formality!=null && Math.abs(formality-activity.target)<=1.5);
}
export function outfitChanges(primary,secondary) {
 return CATEGORIES.filter(category=>(primary[category]?.id||null)!==(secondary[category]?.id||null)).map(category=>({
  category,action:!secondary[category]?'remove':!primary[category]?'add':'replace',
  fromId:primary[category]?.id||null,toId:secondary[category]?.id||null
 }));
}
function extraGarments(primary,secondary) {
 const ids=new Set(garments(primary).map(item=>item.id));
 return garments(secondary).filter(item=>!ids.has(item.id));
}
function quality(outfit,activity) {
 const formality=averageFormality(outfit)??activity.target;
 const usage=garments(outfit).reduce((sum,item)=>sum+Math.max(0,Number(item.timesWorn)||0),0)/garments(outfit).length;
 return 100-Math.abs(formality-activity.target)*10-Math.min(20,usage/5);
}
export function buildJourneyPlan({primaryOutfit,wardrobe,context={},maxCandidatesPerCategory=6,maxCombinations=512}) {
 const enabled=Boolean(context.dualJourney?.enabled);
 const empty={version:'1.0.0',status:enabled?'invalid':'disabled',activityId:null,primaryOutfit:null,secondaryOutfit:null,additionalGarments:[],changes:[],missing:[],limited:false,evaluated:0};
 if(!enabled)return empty;
 const activity=activityDefinition(context.dualJourney?.type);
 if(!activity)return {...empty,reason:'UNKNOWN_ACTIVITY'};
 if(!Array.isArray(wardrobe)||wardrobe.some(item=>!item||typeof item.id!=='string')||new Set(wardrobe.map(item=>item.id)).size!==wardrobe.length)return {...empty,activityId:activity.id,reason:'INVALID_INVENTORY'};
 const primary=checkedOutfit(primaryOutfit,wardrobe);
 if(!primary)return {...empty,activityId:activity.id,reason:'INVALID_PRIMARY_OUTFIT'};
 const temp=temperature(context,activity);
 const result={...empty,activityId:activity.id,primaryOutfit:primary,secondaryTempC:temp,weatherBasis:activity.indoor?'indoor_temperature_unknown':context.secondaryTempC!=null?'secondary_temperature':'shared_context_temperature'};
 const pools={}; const missing=[];
 const candidateLimit=Math.max(1,Math.min(12,Number.isFinite(Number(maxCandidatesPerCategory))?Math.floor(Number(maxCandidatesPerCategory)):6));
 const combinationLimit=Math.max(1,Math.min(5000,Number.isFinite(Number(maxCombinations))?Math.floor(Number(maxCombinations)):512));
 for(const category of CATEGORIES){
  const available=wardrobe.filter(item=>item.category===category&&item.state==='available');
  const marked=available.filter(item=>supportsActivity(item,activity.id));
  const strict=marked.filter(item=>thermalFit(item,temp));
  const compatible=strict.length?strict:marked.filter(item=>thermalFit(item,temp,4));
  const ordered=[...compatible].sort((a,b)=>Math.abs((Number(a.formality)||0)-activity.target)-Math.abs((Number(b.formality)||0)-activity.target)||(Number(a.timesWorn)||0)-(Number(b.timesWorn)||0)||a.id.localeCompare(b.id));
  pools[category]=ordered.slice(0,candidateLimit);
  if(primary[category]&&compatible.some(item=>item.id===primary[category].id)&&!pools[category].some(item=>item.id===primary[category].id))pools[category]=[primary[category],...pools[category].slice(0,candidateLimit-1)];
  if(REQUIRED.includes(category)&&!compatible.length)missing.push({category,reason:!available.length?'NO_AVAILABLE_GARMENT':!marked.length?'ACTIVITY_NOT_CONFIRMED':'NO_THERMAL_MATCH'});
 }
 if(missing.length)return clone({...result,status:'incomplete',missing,reason:'MISSING_SECONDARY_COVERAGE'});
 const options=activity.indoor?[null]:[null,...pools.outerwear.slice(0,3)];
 let best=null,evaluated=0,limited=false;
 const seen=new Set();
 const consider=outfit=>{
  const key=CATEGORIES.map(category=>outfit[category]?.id||'none').join('|');
  if(seen.has(key))return;
  seen.add(key);
  if(evaluated>=combinationLimit){limited=true;return;}
  evaluated++;
  if(!suitable(outfit,activity,temp))return;
  const changes=outfitChanges(primary,outfit),extras=extraGarments(primary,outfit),score=quality(outfit,activity);
  if(!best||changes.length<best.changes.length||changes.length===best.changes.length&&(score>best.score||score===best.score&&key<best.key))best={outfit,changes,extras,score,key};
 };
 consider(primary);
 if(best&&best.changes.length===0)return clone({...result,status:'compatible',secondaryOutfit:best.outfit,evaluated});
 outer:for(const top of pools.top)for(const bottom of pools.bottom)for(const footwear of pools.footwear)for(const outerwear of options){
  consider({top,bottom,footwear,outerwear});if(limited)break outer;
 }
 if(!best)return clone({...result,status:'incomplete',reason:limited?'SEARCH_LIMIT_REACHED':'NO_SUITABLE_SECONDARY_OUTFIT',limited,evaluated});
 return clone({...result,status:best.changes.length?'ready':'compatible',secondaryOutfit:best.outfit,additionalGarments:best.extras,changes:best.changes,limited,evaluated});
}
export function validateJourneyPlan(plan,wardrobe) {
 const errors=[];
 if(!plan||plan.version!=='1.0.0'||!Array.isArray(wardrobe)||!Array.isArray(plan.additionalGarments)||!Array.isArray(plan.changes))return ['INVALID_PLAN'];
 if(wardrobe.some(item=>!item||typeof item.id!=='string')||new Set(wardrobe.map(item=>item.id)).size!==wardrobe.length)return ['INVALID_INVENTORY'];
 if(plan.status==='disabled')return plan.secondaryOutfit||plan.additionalGarments?.length||plan.changes?.length?['INVALID_DISABLED_PLAN']:[];
 if(!['ready','compatible'].includes(plan.status))return ['INCOMPLETE_PLAN'];
 const activity=activityDefinition(plan.activityId);
 const primary=checkedOutfit(plan.primaryOutfit,wardrobe),secondary=checkedOutfit(plan.secondaryOutfit,wardrobe);
 if(!activity)return ['UNKNOWN_ACTIVITY'];
 if(!primary||!secondary)return ['INVALID_PLAN_GARMENTS'];
 if(plan.secondaryTempC!==null&&(typeof plan.secondaryTempC!=='number'||!Number.isFinite(plan.secondaryTempC)))return ['INVALID_SECONDARY_TEMPERATURE'];
 if(!suitable(secondary,activity,plan.secondaryTempC))errors.push('UNSUITABLE_SECONDARY_OUTFIT');
 if(!REQUIRED.every(category=>supportsActivity(secondary[category],activity.id))||secondary.outerwear&&!supportsActivity(secondary.outerwear,activity.id)||activity.indoor&&secondary.outerwear)errors.push('ACTIVITY_NOT_CONFIRMED');
 const expected=extraGarments(primary,secondary).map(item=>item.id).sort();
 const actual=(plan.additionalGarments||[]).map(item=>item?.id).sort();
 if(JSON.stringify(expected)!==JSON.stringify(actual))errors.push('INVALID_ADDITIONAL_GARMENTS');
 if(JSON.stringify(outfitChanges(primary,secondary))!==JSON.stringify(plan.changes))errors.push('INVALID_CHANGES');
 if((plan.status==='compatible')!==(outfitChanges(primary,secondary).length===0))errors.push('INVALID_PLAN_STATUS');
 return errors;
}
export function journeyGarments(plan) {
 return [...new Map([...garments(plan?.primaryOutfit),...garments(plan?.secondaryOutfit)].map(item=>[item.id,item])).values()];
}
