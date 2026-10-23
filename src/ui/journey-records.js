import {ACTIVITIES,normalizeActivities} from '../engine/journey.js';
const OCCASIONS=['office','casual','dinner','weekend'];
export function saveExample(items,input,now=new Date()){
 if(!Array.isArray(items)||items.some(item=>item.kind!=='journey-demo')||!OCCASIONS.includes(input?.occasion)||!ACTIVITIES.some(a=>a.id===input?.type)||!(now instanceof Date)||!Number.isFinite(now.getTime()))return{ok:false,items};
 const id='journey-demo:'+input.occasion+':'+input.type,existing=items.find(item=>item.id===id);
 if(existing)return{ok:true,items,entry:existing,duplicate:true};
 const entry={id,kind:'journey-demo',occasion:input.occasion,activityId:input.type,savedAt:now.toISOString()};
 return{ok:true,items:[entry,...items],entry};
}
export const removeExample=(items,id)=>items.filter(item=>item.kind!=='journey-demo'||item.id!==id);
const COPY={
 es:{heading:'Ejemplos de jornada doble',note:'Demostración local: estos ejemplos no son looks reales, no registran puestas y se borran al recargar o cerrar esta sesión.',empty:'Todavía no has guardado ejemplos de jornada doble.',today:'Volver a Hoy',open:'Abrir ejemplo',remove:'Eliminar ejemplo',close:'Cerrar detalle',detail:'Detalle del ejemplo',first:'Primer contexto',second:'Después',pieces:'Espacios de prendas de ejemplo',categories:['Parte superior','Parte inferior','Calzado'],markTitle:'Actividades declaradas',markNote:'Marcado manual para la maqueta. No certifica aptitud técnica ni activa IA.',none:'Sin actividades marcadas',occasions:{office:'Oficina y trabajo',casual:'Plan informal',dinner:'Cena',weekend:'Fin de semana'}},
 en:{heading:'Dual journey examples',note:'Local demonstration: these are not real outfits, do not record wear, and disappear when you reload or close this session.',empty:'No dual journey examples saved yet.',today:'Back to Today',open:'Open example',remove:'Delete example',close:'Close details',detail:'Example details',first:'First context',second:'Afterwards',pieces:'Example garment slots',categories:['Top','Bottom','Footwear'],markTitle:'Declared activities',markNote:'Manual markings for the prototype. They do not certify technical suitability or activate AI.',none:'No activities marked',occasions:{office:'Office and work',casual:'Casual plan',dinner:'Dinner',weekend:'Weekend'}},
 ca:{heading:'Exemples de jornada doble',note:'Demostració local: aquests exemples no són looks reals, no registren usos i s’esborren en recarregar o tancar aquesta sessió.',empty:'Encara no has desat exemples de jornada doble.',today:'Tornar a Avui',open:'Obrir exemple',remove:'Eliminar exemple',close:'Tancar detall',detail:'Detall de l’exemple',first:'Primer context',second:'Després',pieces:'Espais de peces d’exemple',categories:['Part superior','Part inferior','Calçat'],markTitle:'Activitats declarades',markNote:'Marcatge manual per a la maqueta. No certifica aptitud tècnica ni activa IA.',none:'Sense activitats marcades',occasions:{office:'Oficina i feina',casual:'Pla informal',dinner:'Sopar',weekend:'Cap de setmana'}}
};
export const copy=lang=>COPY[lang]||COPY.es;
const label=(id,lang)=>{const a=ACTIVITIES.find(a=>a.id===id);return a?(a.labels[lang]||a.labels.es).replace(/^\+\s*/,''):'';};
const button='rounded-lg border border-arachne-border px-3 py-2 text-xs disabled:opacity-50';
export function JourneyExamples({lang='es',items=[],selectedId=null,onSelect=()=>{},onRemove=()=>{},onToday=()=>{},disabled=false}){
 const h=globalThis.React.createElement,t=copy(lang),examples=items.filter(item=>item.kind==='journey-demo'),selected=examples.find(item=>item.id===selectedId);
 return h('section',{'data-journey-examples':'true','aria-label':t.heading,className:'rounded-xl border border-arachne-border bg-arachne-surface p-4 space-y-3'},
  h('h3',{className:'text-sm font-semibold'},t.heading),h('p',{className:'text-[11px] text-arachne-inkMuted',role:'note'},t.note),
  examples.length?h('div',{className:'space-y-2'},...examples.map(item=>h('article',{key:item.id,className:'rounded-lg bg-white border border-arachne-border p-3 space-y-2'},
   h('p',{className:'text-xs font-semibold'},(t.occasions[item.occasion]||t.first)+' → '+label(item.activityId,lang)),
   h('div',{className:'flex flex-wrap gap-2'},h('button',{type:'button','data-open-example':item.id,disabled,'aria-expanded':selectedId===item.id,onClick:()=>{if(!disabled)onSelect(item.id);},className:button},t.open),h('button',{type:'button','data-remove-example':item.id,disabled,onClick:()=>{if(!disabled)onRemove(item.id);},className:button},t.remove))
  ))):h('p',{className:'text-xs'},t.empty),
  selected?h('article',{'data-example-detail':selected.id,className:'rounded-xl border border-arachne-border bg-white p-3 space-y-2'},
   h('h4',{className:'text-xs font-semibold'},t.detail),h('p',{className:'text-xs'},t.first+': '+t.occasions[selected.occasion]),h('p',{className:'text-xs'},t.second+': '+label(selected.activityId,lang)),
   h('p',{className:'text-xs font-semibold'},t.pieces),h('div',{className:'grid grid-cols-3 gap-2'},...t.categories.map(name=>h('div',{key:name,className:'bg-arachne-surface p-3 rounded-lg text-[10px] text-center'},name))),
   h('button',{type:'button','data-close-example':'true',disabled,onClick:()=>{if(!disabled)onSelect(null);},className:button},t.close)
  ):null,
  h('button',{type:'button','data-example-today':'true',disabled,onClick:()=>{if(!disabled)onToday();},className:button},t.today)
 );
}
export function ActivityFields({lang='es',garment={},editing=false,onChange=()=>{},disabled=false}){
 const h=globalThis.React.createElement,t=copy(lang),values=normalizeActivities(garment?.activities),sports=ACTIVITIES.filter(a=>a.sport);
 return h('fieldset',{'data-activity-fields':'true',className:'rounded-xl border border-arachne-border p-3 space-y-2'},h('legend',{className:'text-xs font-semibold px-1'},t.markTitle),
  h('p',{className:'text-[10px] text-arachne-inkMuted'},t.markNote),
  editing?h('div',{className:'flex flex-wrap gap-3'},...sports.map(activity=>h('label',{key:activity.id,className:'flex items-center gap-1 text-xs'},h('input',{type:'checkbox','data-sport':activity.id,checked:values.includes(activity.id),disabled,onChange:event=>{if(!disabled)onChange(normalizeActivities(event.target.checked?[...values,activity.id]:values.filter(id=>id!==activity.id)));}}),label(activity.id,lang)))):h('p',{className:'text-xs'},values.length?values.map(id=>label(id,lang)).join(' · '):t.none)
 );
}
