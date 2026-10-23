import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index-preview.html',import.meta.url),'utf8');
const section=(a,b)=>{assert.equal(html.split(a).length,2);return html.split(a)[1].split(b)[0];};
const helper=section('// ARACHNE_P3_DETAIL_START','// ARACHNE_P3_DETAIL_END');
const handlers=section('// ARACHNE_P3_HANDLERS_START','// ARACHNE_P3_HANDLERS_END');
function session(options={}){
 const states={},notices=[],effects=[];
 const trigger={isConnected:true,focus(){states.focusRestored=true;}};
 const document={activeElement:trigger};
 const context={
  useState:initial=>[initial,value=>{states.readOnly=value;}],useRef:value=>({current:value}),useEffect:fn=>effects.push(fn),
  selectedGarmentModal:options.active||null,isGenerating:options.generating||false,lang:options.lang||'es',
  wardrobe:options.wardrobe||[{id:'t',name:'Current top',fabric:'Current fabric',state:'available',timesWorn:7}],document,
  setSelectedGarmentModal:v=>{states.selected=v;},setEditedGarmentData:v=>{states.draft=v;},
  setIsEditingGarment:v=>{states.editing=v;},setSwipeState:v=>{states.swipe=v;},showToast:v=>notices.push(v),
  requestAnimationFrame:fn=>fn()
 };
 vm.createContext(context);
 const api=vm.runInContext(helper+'\n'+handlers+'\n;({resolveGarmentDetail,garmentDetailLabel,openGarmentDetails,closeGarmentDetails,handleOutfitGarmentClick,handleGarmentDetailKeyDown,outfitGestureRef,garmentDialogRef})',context,{timeout:1000});
 return {api,states,notices,context,trigger,effects};
}
const click=(detail=1,trigger=null)=>({detail,currentTarget:trigger,stopPropagation(){}});
test('details resolve current inventory by ID instead of an old outfit snapshot',()=>{
 const s=session();s.api.openGarmentDetails({id:'t',name:'Old snapshot'},true,s.trigger);
 assert.equal(s.states.selected.name,'Current top');assert.equal(s.states.selected.timesWorn,7);
 assert.equal(s.states.readOnly,true);assert.equal(s.states.editing,false);assert.equal(s.states.swipe.offsetX,0);
 assert.notEqual(s.states.selected,s.context.wardrobe[0]);
});
test('missing garments do not open a wrong or fictional sheet in ES EN CA',()=>{
 for(const lang of ['es','en','ca']){const s=session({lang});s.api.openGarmentDetails({id:'missing'},true);assert.equal(s.states.selected,undefined);assert.equal(s.notices.length,1);assert.ok(s.notices[0].length>10);}
});
test('wardrobe opening explicitly enables management again',()=>{
 const s=session();s.api.openGarmentDetails({id:'t'},false);assert.equal(s.states.readOnly,false);assert.equal(s.states.editing,false);
 assert.ok(html.includes('onOpen: (item) => openGarmentDetails(item, false)'));
});
test('opening and closing details do not mutate wardrobe or usage counts',()=>{
 const s=session(),before=JSON.stringify(s.context.wardrobe);s.api.openGarmentDetails({id:'t'},true,s.trigger);s.api.closeGarmentDetails();
 assert.equal(JSON.stringify(s.context.wardrobe),before);assert.equal(s.states.selected,null);assert.equal(s.states.draft,null);assert.equal(s.states.focusRestored,true);
});
test('a click opens read-only details but a completed drag does not',()=>{
 const s=session();s.api.outfitGestureRef.current.moved=true;s.api.handleOutfitGarmentClick({id:'t'},click(1,s.trigger));assert.equal(s.states.selected,undefined);
 s.api.handleOutfitGarmentClick({id:'t'},click(1,s.trigger));assert.equal(s.states.readOnly,true);
});
test('keyboard activation is not blocked by a previous pointer drag',()=>{
 const s=session();s.api.outfitGestureRef.current.moved=true;s.api.handleOutfitGarmentClick({id:'t'},click(0,s.trigger));assert.equal(s.states.readOnly,true);
});
test('generation in progress prevents opening another detail sheet',()=>{
 const s=session({generating:true});s.api.openGarmentDetails({id:'t'},true);assert.equal(s.states.selected,undefined);
});
test('Escape closes the sheet and returns focus',()=>{
 const s=session();s.api.openGarmentDetails({id:'t'},true,s.trigger);let prevented=false;
 s.api.handleGarmentDetailKeyDown({key:'Escape',preventDefault(){prevented=true;},stopPropagation(){}});
 assert.equal(prevented,true);assert.equal(s.states.selected,null);assert.equal(s.states.focusRestored,true);
});
test('Tab and Shift Tab stay inside the dialog',()=>{
 const s=session();let focused='';const first={focus(){focused='first';}},last={focus(){focused='last';}};
 const dialog={querySelectorAll(){return[first,last];}};s.context.document.activeElement=last;
 s.api.handleGarmentDetailKeyDown({key:'Tab',currentTarget:dialog,shiftKey:false,preventDefault(){}});assert.equal(focused,'first');
 s.context.document.activeElement=first;s.api.handleGarmentDetailKeyDown({key:'Tab',currentTarget:dialog,shiftKey:true,preventDefault(){}});assert.equal(focused,'last');
});
test('labels use the requested language and localized names safely',()=>{
 const s=session();for(const lang of ['es','en','ca']){const label=s.api.garmentDetailLabel({id:'t',name:{es:'Camisa',en:'Shirt',ca:'Camisa'}},lang);assert.ok(label.length>10);assert.ok(!label.includes('undefined'));}
 assert.ok(s.api.garmentDetailLabel({name:'Custom name'},'en').includes('Custom name'));
});
test('five native garment buttons are wired and images disable native dragging',()=>{
 for(const slot of ['outerwear','top','bottom','footwear','transition'])assert.ok(html.includes('data-outfit-garment="'+slot+'"'));
 assert.equal((html.match(/<button[^>]*data-outfit-garment=|<button\s+[\s\S]*?data-outfit-garment=/g)||[]).length,5);
 assert.equal((html.match(/<img draggable=\{false\} src=\{currentOutfit\./g)||[]).length,4);
 assert.ok(html.includes('gesture.moved = true'));assert.ok(html.includes('outfitGestureRef.current = {startX:point.clientX,startY:point.clientY,moved:false}'));
});
test('read-only mode guards editing, availability, activities and save',()=>{
 assert.ok(html.includes('{!garmentReadOnly && ('));
 assert.ok(html.includes('if (garmentReadOnly || !editedGarmentData) return;'));
 assert.ok(html.includes('if (garmentReadOnly) return;'));
 assert.ok(html.includes('editing:isEditingGarment && !garmentReadOnly'));
 assert.ok(html.includes('{!isEditingGarment || garmentReadOnly ? ('));
 assert.ok(html.includes('role="dialog" aria-modal="true"'));
 assert.ok(html.includes('{fabricText(selectedGarmentModal, lang)}'));
});
