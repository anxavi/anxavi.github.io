import test from 'node:test';
import assert from 'node:assert/strict';
import {factorList,describe,saveLook,markWorn,wearCount,dateLabel} from '../src/engine/presentation.js';
const wardrobe=[{id:'t',category:'top',state:'available',name:'Camisa azul',timesWorn:2},{id:'b',category:'bottom',state:'available',name:'Pantalón gris',timesWorn:3},{id:'s',category:'footwear',state:'available',name:'Zapatos',timesWorn:1}];
const look={id:'o1',top:wardrobe[0],bottom:wardrobe[1],footwear:wardrobe[2],contextSnapshot:{occasion:'office',tempC:17},scoreMeta:{factors:{color:{score:0.9,coverage:1,limitations:[]}}}};
test('harmony labels and explanations change language',()=>{
 const es=factorList({thermal:{score:0.8,coverage:1}},'es')[0],ca=factorList({thermal:{score:0.8,coverage:1}},'ca')[0],en=factorList({thermal:{score:0.8,coverage:1}},'en')[0];
 assert.equal(es.label,'Confort térmico');assert.notEqual(es.reason,en.reason);assert.notEqual(ca.reason,en.reason);
});
test('missing dimensions display no invented numeric assessment',()=>{
 assert.equal(factorList({thermal:{score:0.55,coverage:0}},'es')[0].score,null);
 assert.equal(factorList({color:{score:0.58,coverage:0.5,limitations:['limited_color_data']}},'es')[0].score,null);
});
test('description is short and does not leak diagnostic keys',()=>{
 for(const lang of ['es','en','ca']){const text=describe(look,lang);assert.ok(text.split(/\s+/).length<65);assert.ok(!/heuristic|formality|coverage|thermalFit|Target/.test(text));}
 assert.notEqual(describe(look,'es'),describe(look,'en'));
});
test('saving does not mutate wardrobe or increment wear',()=>{
 const before=JSON.stringify(wardrobe),result=saveLook([],look,wardrobe);
 assert.equal(result.ok,true);assert.deepEqual(result.entry.wornDates,[]);assert.equal(wearCount(result.history),0);assert.equal(JSON.stringify(wardrobe),before);
});
test('saving twice is idempotent and keeps a deep snapshot',()=>{
 const first=saveLook([],look,wardrobe),second=saveLook(first.history,look,wardrobe);
 assert.equal(second.history.length,1);assert.equal(second.duplicate,true);
 assert.notEqual(first.entry.top,look.top);assert.notEqual(first.entry.contextSnapshot,look.contextSnapshot);
});
test('unavailable outfits cannot be saved or marked worn',()=>{
 const unavailable=wardrobe.map(g=>g.id==='s'?{...g,state:'unavailable'}:g);
 assert.equal(saveLook([],look,unavailable).ok,false);
 const result=saveLook([],look,wardrobe);assert.equal(markWorn(result.history,unavailable,result.entry.id,'2026-10-23').ok,false);
});
test('marking worn increments only included garments once per day',()=>{
 const result=saveLook([],look,wardrobe),first=markWorn(result.history,wardrobe,result.entry.id,'2026-10-23');
 assert.equal(first.ok,true);assert.equal(first.wardrobe[0].timesWorn,3);assert.equal(wearCount(first.history),1);
 const repeat=markWorn(first.history,first.wardrobe,result.entry.id,'2026-10-23');assert.equal(repeat.duplicate,true);assert.equal(repeat.wardrobe[0].timesWorn,3);
 const next=markWorn(first.history,first.wardrobe,result.entry.id,'2026-10-24');assert.equal(next.wardrobe[0].timesWorn,4);
});
test('legacy history remains visible and counted separately from new saves',()=>{
 assert.equal(wearCount([{id:'legacy'},{id:'new',wornDates:[]}]),1);assert.equal(dateLabel({date:'Ayer'},'es'),'Ayer');
});
test('recording a new use preserves legacy wear count',()=>{
 const legacy={...look,id:'legacy'},result=markWorn([legacy],wardrobe,'legacy','2026-10-23');assert.equal(wearCount(result.history),2);
});
