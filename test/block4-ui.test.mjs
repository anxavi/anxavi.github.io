import test from 'node:test';
import assert from 'node:assert/strict';
import {JourneyPanel} from '../src/ui/journey-panel.js';
import {ACTIVITIES} from '../src/engine/journey.js';
globalThis.React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(value=>value!==null&&value!==false)})};
function nodes(tree){return tree&&typeof tree==='object'?[tree,...tree.children.flatMap(nodes)]:[];}
function text(tree){return tree&&typeof tree==='object'?tree.children.map(text).join(' '):String(tree??'');}
function setup(extra={}){
 let value={enabled:false,type:'gym',showExample:false},reviewed=0;
 return{render:()=>JourneyPanel({activities:ACTIVITIES,value,onChange:next=>{value=next;},onReview:()=>reviewed++,...extra}),value:()=>value,reviewed:()=>reviewed};
}
test('journey preview starts disabled and enables six choices',()=>{
 const h=setup();let tree=h.render();assert.equal(nodes(tree).filter(n=>n.props['data-activity']).length,0);
 nodes(tree).find(n=>n.type==='input').props.onChange({target:{checked:true}});
 assert.equal(nodes(h.render()).filter(n=>n.props['data-activity']).length,6);
});
test('selection and example visibility are controlled by parent state',()=>{
 const h=setup();nodes(h.render()).find(n=>n.type==='input').props.onChange({target:{checked:true}});
 nodes(h.render()).find(n=>n.props['data-activity']==='running').props.onClick();
 assert.equal(h.value().type,'running');
 nodes(h.render()).find(n=>n.props['data-action']==='example').props.onClick();
 assert.equal(h.value().showExample,true);
 assert.ok(nodes(h.render()).some(n=>n.props['data-journey-example']));
});
test('all visible controls lock while generation is active',()=>{
 let changed=false,reviewed=false;
 const tree=JourneyPanel({activities:ACTIVITIES,value:{enabled:true,type:'gym',showExample:true},disabled:true,onChange:()=>changed=true,onReview:()=>reviewed=true});
 for(const node of nodes(tree).filter(n=>['input','button'].includes(n.type))){assert.equal(node.props.disabled,true);assert.equal(node.props['aria-disabled'],true);if(node.type==='button')node.props.onClick();else node.props.onChange({target:{checked:false}});}
 assert.equal(changed,false);assert.equal(reviewed,false);
});
test('example has a real wardrobe navigation action without saving garments',()=>{
 const h=setup();nodes(h.render()).find(n=>n.type==='input').props.onChange({target:{checked:true}});
 nodes(h.render()).find(n=>n.props['data-action']==='example').props.onClick();
 nodes(h.render()).find(n=>n.props['data-action']==='wardrobe').props.onClick();
 assert.equal(h.reviewed(),1);assert.match(text(h.render()),/ficticias/);
});
test('ES EN CA labels and explicit example notice are available',()=>{
 for(const [lang,label]of [['es','Jornada doble'],['en','Dual journey'],['ca','Jornada doble']]){
  const tree=JourneyPanel({lang,activities:ACTIVITIES,value:{enabled:true,type:'dinner_work',showExample:true}});
  assert.equal(tree.props['aria-label'],label);assert.match(text(tree),/IA|AI/);assert.ok(!text(tree).includes('undefined'));
 }
});
test('rendering and selecting do not mutate the shared activity catalogue',()=>{
 const before=JSON.stringify(ACTIVITIES),h=setup();nodes(h.render()).find(n=>n.type==='input').props.onChange({target:{checked:true}});
 nodes(h.render()).find(n=>n.props['data-activity']==='hiking').props.onClick();assert.equal(JSON.stringify(ACTIVITIES),before);
});
