import {VisualJourney} from './journey-outfits.js';
const COPY={
 es:{title:'Jornada doble',enable:'Añadir una segunda actividad',intro:'Un conjunto para cada actividad y una lista de lo que llevarías.',demo:'Ejemplo visual · sin IA',notice:'Las prendas de este ejemplo son ficticias. No cambian tu outfit, tu armario ni los contadores de uso real.',show:'Ver ejemplo del recorrido',hide:'Ocultar ejemplo',review:'Ir a Armario',save:'Guardar ejemplo',pending:'Puedes guardar el ejemplo completo en la sección de demostración de Guardados. Solo dura esta sesión.'},
 en:{title:'Dual journey',enable:'Add a second activity',intro:'An outfit for each activity and a list of what you would bring.',demo:'Visual example · no AI',notice:'These example garments are fictional. They do not change your outfit, wardrobe or real wear counters.',show:'Show journey example',hide:'Hide example',review:'Go to Wardrobe',save:'Save example',pending:'Save the complete example in the demonstration section of Saved. It lasts only for this session.'},
 ca:{title:'Jornada doble',enable:'Afegir una segona activitat',intro:'Un conjunt per a cada activitat i una llista del que portaries.',demo:'Exemple visual · sense IA',notice:'Les peces d’aquest exemple són fictícies. No canvien l’outfit, l’armari ni els comptadors d’ús real.',show:'Veure exemple del recorregut',hide:'Amagar exemple',review:'Anar a Armari',save:'Desar exemple',pending:'Pots desar l’exemple complet a la secció de demostració de Desats. Només dura aquesta sessió.'}
};
export function JourneyPanel({lang='es',occasion='office',activities=[],value={enabled:false,type:'gym',showExample:false},onChange=()=>{},onReview=()=>{},onSave=()=>{},disabled=false}){
 const h=globalThis.React.createElement,t=COPY[lang]||COPY.es,selected=activities.find(a=>a.id===value.type)||activities[0];
 const update=patch=>{if(!disabled)onChange({...value,...patch});};
 return h('section',{'aria-label':t.title,'data-arachne-journey-preview':'true',className:'mt-4 border-t border-arachne-border pt-4 space-y-3'},
  h('div',{className:'flex items-center justify-between gap-3'},h('h3',{className:'text-sm font-semibold'},t.title),h('span',{className:'text-[10px] text-arachne-inkMuted'},t.demo)),
  h('p',{className:'text-xs text-arachne-inkMuted'},t.intro),
  h('label',{className:'flex items-center gap-2 text-xs'},h('input',{type:'checkbox',checked:Boolean(value.enabled),disabled,'aria-disabled':disabled,onChange:event=>update({enabled:event.target.checked,showExample:false})}),t.enable),
  value.enabled?h('div',{className:'space-y-3'},
   h('div',{className:'grid grid-cols-2 sm:grid-cols-3 gap-2'},...activities.map(activity=>h('button',{key:activity.id,type:'button','data-activity':activity.id,'aria-pressed':selected?.id===activity.id,disabled,'aria-disabled':disabled,onClick:()=>update({type:activity.id,showExample:false}),className:'rounded-lg border px-2 py-2 text-xs disabled:opacity-50 '+(selected?.id===activity.id?'bg-arachne-sageLight border-arachne-sage text-arachne-sage':'bg-white border-arachne-border')},activity.labels[lang]||activity.labels.es))),
   h('p',{className:'text-[11px] text-arachne-inkMuted',role:'note'},t.notice),
   h('button',{type:'button','data-action':'example','aria-expanded':Boolean(value.showExample),disabled,'aria-disabled':disabled,onClick:()=>update({showExample:!value.showExample}),className:'w-full rounded-xl bg-arachne-ink text-white py-2.5 text-xs disabled:opacity-50'},value.showExample?t.hide:t.show),
   value.showExample?h('div',{'data-journey-example':'true',className:'space-y-3'},
    h(VisualJourney,{lang,occasion,activityId:selected?.id}),
    h('div',{className:'flex flex-wrap gap-2'},h('button',{type:'button','data-action':'wardrobe',disabled,'aria-disabled':disabled,onClick:()=>{if(!disabled)onReview();},className:'rounded-lg border border-arachne-border px-3 py-2 text-xs disabled:opacity-50'},t.review),h('button',{type:'button','data-action':'save-example',disabled,'aria-disabled':disabled,onClick:()=>{if(!disabled)onSave();},className:'rounded-lg bg-arachne-ink text-white px-3 py-2 text-xs disabled:opacity-50'},t.save))
   ):null,
   h('p',{className:'text-[10px] text-arachne-inkMuted'},t.pending)
  ):null
 );
}
