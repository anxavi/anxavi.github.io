import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index-preview.html',import.meta.url),'utf8');
const start='// ARACHNE_P2_FABRIC_START',end='// ARACHNE_P2_FABRIC_END';
assert.equal(html.split(start).length,2);assert.equal(html.split(end).length,2);
const code=html.split(start)[1].split(end)[0];
const {FABRIC_COPY,fabricText,editFabric}=vm.runInNewContext(code+'\n;({FABRIC_COPY,fabricText,editFabric})',{}, {timeout:1000});
const fixture=name=>vm.runInNewContext('('+html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]+')',{}, {timeout:1000});
test('all nineteen default compositions have ES EN CA text',()=>{
 assert.equal(Object.keys(FABRIC_COPY).length,19);
 for(const [key,entry] of Object.entries(FABRIC_COPY))for(const lang of ['es','en','ca'])assert.ok(entry[lang],key+':'+lang);
});
test('all seven initial garments use translated composition keys',()=>{
 const items=fixture('INITIAL_WARDROBE');assert.equal(items.length,7);
 for(const item of items)for(const lang of ['es','en','ca'])assert.equal(fabricText(item,lang),FABRIC_COPY[item.fabricKey][lang]);
});
test('all nine essentials retain their canonical value and translation key',()=>{
 const items=fixture('GENERIC_ESSENTIAL_TEMPLATES');assert.equal(items.length,9);
 for(const item of items){const g={fabric:item.defaultFabric,fabricKey:item.defaultFabricKey};assert.equal(g.fabric,FABRIC_COPY[g.fabricKey].es);assert.notEqual(fabricText(g,'en'),g.fabric);assert.notEqual(fabricText(g,'ca'),g.fabric);}
});
test('percentages are preserved in every translation',()=>{
 for(const [fabricKey,entry] of Object.entries(FABRIC_COPY))for(const lang of ['es','en','ca'])assert.equal((fabricText({fabric:entry.es,fabricKey},lang).match(/\d+(?:[.,]\d+)?%/g)||[]).join('|'),(entry.es.match(/\d+(?:[.,]\d+)?%/g)||[]).join('|'));
});
test('language changes do not modify the stored garment',()=>{
 const g=Object.freeze({fabric:FABRIC_COPY.combed_cotton.es,fabricKey:'combed_cotton',brand:'Original'});
 for(const lang of ['en','ca','es'])fabricText(g,lang);
 assert.equal(g.fabric,FABRIC_COPY.combed_cotton.es);assert.equal(g.brand,'Original');
});
test('manual composition edits become literal text without changing the original',()=>{
 const g={fabric:FABRIC_COPY.organic_cotton.es,fabricKey:'organic_cotton',brand:'Original'};
 const edited=editFabric(g,'  72% lino / 28% seda  ');
 assert.equal(edited.fabricKey,null);assert.equal(edited.brand,'Original');
 for(const lang of ['es','en','ca'])assert.equal(fabricText(edited,lang),'  72% lino / 28% seda  ');
 assert.equal(g.fabricKey,'organic_cotton');
});
test('custom text equal to a default is not automatically translated',()=>{
 const edited=editFabric({fabric:'Other'},FABRIC_COPY.organic_cotton.es);
 assert.equal(fabricText(edited,'en'),FABRIC_COPY.organic_cotton.es);
});
test('editing another attribute keeps translations and discarding a draft keeps the original',()=>{
 const g={fabric:FABRIC_COPY.boxcalf.es,fabricKey:'boxcalf',brand:'Original'};
 const changed={...g,brand:'New'};assert.equal(fabricText(changed,'en'),FABRIC_COPY.boxcalf.en);
 editFabric({...g},'draft');assert.equal(fabricText(g,'ca'),FABRIC_COPY.boxcalf.ca);
});
test('unknown keys and stale metadata never replace user text',()=>{
 for(const fabricKey of ['unknown','__proto__','constructor','organic_cotton'])assert.equal(fabricText({fabric:'Personal composition',fabricKey},'en'),'Personal composition');
});
test('missing or non-string data is safe and unsupported languages fall back to ES',()=>{
 for(const g of [null,undefined,{}, {fabric:null},{fabric:42}])assert.equal(fabricText(g,'en'),'');
 const g={fabric:FABRIC_COPY.organic_cotton.es,fabricKey:'organic_cotton'};assert.equal(fabricText(g,'fr'),g.fabric);
});
test('capture and essential save paths carry the provenance key',()=>{
 assert.match(html,/fabric: "Algodón orgánico",\s*fabricKey: "organic_cotton"/);
 assert.match(html,/fabric: "Algodón sarga denso",\s*fabricKey: "dense_twill"/);
 assert.match(html,/fabricKey: capturedGarmentData\.fabricKey/);
 assert.match(html,/fabricKey: template\.defaultFabricKey/);
 assert.match(html,/fabricKey: customizingEssential\.fabric\.trim\(\) \? customizingEssential\.fabricKey : "essential"/);
});
test('detail and editable fields use the resolver and manual edits clear provenance',()=>{
 for(const name of ['selectedGarmentModal','customizingEssential','editedGarmentData'])assert.ok(html.includes('fabricText('+name+', lang)'));
 for(const name of ['customizingEssential','editedGarmentData'])assert.ok(html.includes('editFabric('+name+', e.target.value)'));
 assert.ok(!html.includes('{selectedGarmentModal.fabric}'));
});
