import {ACTIVITIES} from '../engine/journey.js';
const PIECES={
 shirt:['top','Camisa','Shirt','Camisa'],chinos:['bottom','Pantalón chino','Chinos','Pantaló xinès'],loafers:['footwear','Zapatos','Shoes','Sabates'],tee:['top','Camiseta','T-shirt','Samarreta'],jeans:['bottom','Vaqueros','Jeans','Texans'],sneakers:['footwear','Zapatillas','Sneakers','Sabatilles'],dark:['bottom','Pantalón oscuro','Dark trousers','Pantaló fosc'],
 gymTop:['top','Camiseta deportiva','Training top','Samarreta esportiva'],gymBottom:['bottom','Pantalón deportivo','Training shorts','Pantaló esportiu'],gymShoes:['footwear','Calzado de entrenamiento','Training shoes','Calçat d’entrenament'],
 runTop:['top','Camiseta de running','Running top','Samarreta de running'],runBottom:['bottom','Pantalón de running','Running shorts','Pantaló de running'],runShoes:['footwear','Calzado de running','Running shoes','Calçat de running'],
 hikeTop:['top','Parte superior de senderismo','Hiking top','Part superior de senderisme'],hikeBottom:['bottom','Pantalón de senderismo','Hiking trousers','Pantaló de senderisme'],hikeShoes:['footwear','Calzado de senderismo','Hiking footwear','Calçat de senderisme']
};
const PRIMARY={office:['shirt','chinos','loafers'],casual:['tee','jeans','sneakers'],dinner:['shirt','dark','loafers'],weekend:['tee','jeans','sneakers']};
const SECONDARY={gym:['gymTop','gymBottom','gymShoes'],running:['runTop','runBottom','runShoes'],hiking:['hikeTop','hikeBottom','hikeShoes'],dinner_work:['shirt','dark','loafers'],dinner_friends:['tee','chinos','sneakers'],afterwork:['shirt','chinos','loafers']};
export function buildVisualJourney({occasion,activityId}={}){
 if(!Object.hasOwn(PRIMARY,occasion)||!Object.hasOwn(SECONDARY,activityId))return null;
 const make=id=>{const p=PIECES[id];return{id:'demo:'+id,category:p[0],name:{es:p[1],en:p[2],ca:p[3]}};};
 const first=PRIMARY[occasion].map(make),second=SECONDARY[activityId].map(make),ids=new Set(first.map(g=>g.id));
 return{kind:'journey-visual-example',occasion,activityId,primary:{context:occasion,garments:first},secondary:{context:activityId,garments:second},additionalGarments:second.filter(g=>!ids.has(g.id)),reusedGarments:second.filter(g=>ids.has(g.id)),dayGarments:[...new Map([...first,...second].map(g=>[g.id,g])).values()],changes:second.filter((g,i)=>g.id!==first[i].id).map(g=>({category:g.category,from:first.find(p=>p.category===g.category),to:g}))};
}
const COPY={
 es:{primary:'Outfit 1',secondary:'Outfit 2',bring:'Lleva también',reuse:'Reutilizas',changes:'Cambios entre conjuntos',noneBring:'No necesitas llevar prendas adicionales en este ejemplo.',noneReuse:'En este ejemplo no hay prendas compartidas.',noneChanges:'El mismo conjunto cubre los dos contextos de este ejemplo.',note:'Ejemplo de maquetado con prendas ficticias. No utiliza tu armario ni evalúa aptitud deportiva.',total:'Prendas distintas en este ejemplo',invalid:'No hay un ejemplo disponible para estos contextos.',categories:{top:'Superior',bottom:'Inferior',footwear:'Calzado'},occasions:{office:'Oficina y trabajo',casual:'Plan informal',dinner:'Cena',weekend:'Fin de semana'}},
 en:{primary:'Outfit 1',secondary:'Outfit 2',bring:'Bring as well',reuse:'Reuse',changes:'Changes between outfits',noneBring:'No additional garments are needed in this example.',noneReuse:'There are no shared garments in this example.',noneChanges:'The same outfit covers both contexts in this example.',note:'Layout example with fictional garments. It does not use your wardrobe or assess sports suitability.',total:'Distinct garments in this example',invalid:'No example is available for these contexts.',categories:{top:'Top',bottom:'Bottom',footwear:'Footwear'},occasions:{office:'Office and work',casual:'Casual plan',dinner:'Dinner',weekend:'Weekend'}},
 ca:{primary:'Outfit 1',secondary:'Outfit 2',bring:'Porta també',reuse:'Reutilitzes',changes:'Canvis entre conjunts',noneBring:'No cal portar peces addicionals en aquest exemple.',noneReuse:'En aquest exemple no hi ha peces compartides.',noneChanges:'El mateix conjunt cobreix els dos contextos d’aquest exemple.',note:'Exemple de maquetat amb peces fictícies. No fa servir l’armari ni avalua aptitud esportiva.',total:'Peces diferents en aquest exemple',invalid:'No hi ha cap exemple disponible per a aquests contextos.',categories:{top:'Superior',bottom:'Inferior',footwear:'Calçat'},occasions:{office:'Oficina i feina',casual:'Pla informal',dinner:'Sopar',weekend:'Cap de setmana'}}
};
export function VisualJourney({lang='es',occasion,activityId,plan=null}){
 const h=globalThis.React.createElement,t=COPY[lang]||COPY.es,p=plan||buildVisualJourney({occasion,activityId});
 if(!p||p.kind!=='journey-visual-example')return h('p',{role:'status'},t.invalid);
 const name=g=>g.name[lang]||g.name.es;
 const activity=ACTIVITIES.find(a=>a.id===p.activityId),activityName=activity?(activity.labels[lang]||activity.labels.es).replace(/^\+\s*/,''):'';
 const box='rounded-xl border border-arachne-border bg-white p-3 space-y-2';
 const list=(items,empty)=>items.length?h('ul',{className:'space-y-1'},...items.map(g=>h('li',{key:g.id,className:'text-xs break-words'},name(g)))):h('p',{className:'text-xs text-arachne-inkMuted'},empty);
 const outfit=(which,title,context,items)=>h('article',{'data-visual-outfit':which,className:box},h('h4',{className:'text-sm font-semibold'},title+' · '+context),h('ul',{className:'space-y-2'},...items.map(g=>h('li',{key:g.id,className:'rounded-lg bg-arachne-surface p-2 min-w-0'},h('p',{className:'text-[10px] text-arachne-inkMuted'},t.categories[g.category]),h('p',{className:'text-xs font-medium break-words'},name(g))))));
 return h('section',{'data-visual-journey':'true',className:'space-y-3'},
  h('p',{role:'note',className:'text-[10px] text-arachne-inkMuted'},t.note),
  h('div',{className:'grid sm:grid-cols-2 gap-3'},outfit('primary',t.primary,t.occasions[p.occasion],p.primary.garments),outfit('secondary',t.secondary,activityName,p.secondary.garments)),
  h('div',{'data-packing-list':'true',className:box},h('h4',{className:'text-xs font-semibold'},t.bring),list(p.additionalGarments,t.noneBring)),
  h('div',{'data-reused-list':'true',className:box},h('h4',{className:'text-xs font-semibold'},t.reuse),list(p.reusedGarments,t.noneReuse)),
  h('div',{className:box},h('h4',{className:'text-xs font-semibold'},t.changes),p.changes.length?h('ul',{className:'space-y-1'},...p.changes.map(c=>h('li',{key:c.category,className:'text-xs break-words'},t.categories[c.category]+': '+name(c.from)+' → '+name(c.to)))):h('p',{className:'text-xs text-arachne-inkMuted'},t.noneChanges)),
  h('p',{className:'text-[10px] text-arachne-inkMuted'},t.total+': '+p.dayGarments.length)
 );
}
