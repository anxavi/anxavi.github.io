import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryPanel } from '../src/ui/inventory-panel.js';
import { copy } from '../src/engine/availability.js';

const seed = () => [
  {id:'t',category:'top',state:'available',name:'Top'},
  {id:'b',category:'bottom',state:'available',name:'Bottom'},
  {id:'s',category:'footwear',state:'available',name:'Shoes'},
  {id:'x',category:'top',state:'unavailable',name:'Other top'}
];
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : [];
const text = tree => tree && typeof tree === 'object' ? tree.children.map(text).join(' ') : String(tree ?? '');
function mount(lang = 'es') {
  let slots = [], deps = [], cursor, effects, dirty, tree, opened = [];
  let props = {wardrobe:seed(),filteredGarments:seed(),categoryKey:'all',lang,onOpen:g=>opened.push(g.id)};
  props.onChange = update => {
    props.wardrobe = update(props.wardrobe);
    props.filteredGarments = props.wardrobe.filter(g => props.categoryKey === 'all' || g.category === props.categoryKey);
  };
  const react = {
    createElement:(type,attributes,...children)=>({type,props:attributes || {},children:children.flat(Infinity).filter(x=>x!==false && x!==null && x!==undefined)}),
    useState:initial=>{
      const i=cursor++;
      if (!(i in slots)) slots[i]=typeof initial==='function'?initial():initial;
      return [slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;if(!Object.is(next,slots[i])){slots[i]=next;dirty=true;}}];
    },
    useEffect:(effect,next)=>{
      const i=cursor++;
      if(!deps[i] || next.some((value,j)=>!Object.is(value,deps[i][j]))){deps[i]=next;effects.push(effect);}
    }
  };
  function render(patch={}) {
    Object.assign(props,patch);
    globalThis.React=react;
    let attempts=0;
    do {
      dirty=false;cursor=0;effects=[];tree=InventoryPanel(props);
      effects.forEach(effect=>effect());
      assert.ok(++attempts<12,'render must settle');
    } while(dirty);
    return tree;
  }
  render();
  return {
    render, opened, get wardrobe(){return props.wardrobe;},
    all:()=>nodes(tree),
    panel:()=>nodes(tree).find(n=>n.props['data-inventory-selection']),
    choose:id=>{nodes(tree).find(n=>n.props['data-garment-select']===id).props.onClick({stopPropagation(){}});render();},
    click:label=>{const item=nodes(tree).find(n=>n.type==='button' && text(n)===label);assert.ok(item,label);item.props.onClick();render();},
    open:id=>{const article=nodes(tree).find(n=>n.type==='article' && n.props.key===id);article.children.find(n=>n.type==='button' && !n.props['data-garment-select']).props.onClick();render();}
  };
}
test('selection actions appear on first selection and disappear on last deselection',()=>{
  const view=mount();assert.equal(view.panel(),undefined);
  view.choose('t');assert.ok(view.panel());
  view.choose('t');assert.equal(view.panel(),undefined);
});
test('circular controls are top-left and expose their pressed state in ES EN CA',()=>{
  for(const lang of ['es','en','ca']){
    const view=mount(lang),t=copy(lang);
    let control=view.all().find(n=>n.props['data-garment-select']==='t');
    assert.equal(control.type,'button');assert.equal(control.props['aria-pressed'],false);
    assert.match(control.props.className,/top-2 left-2/);assert.match(control.props.className,/rounded-full/);assert.match(control.props.className,/bg-white\/70/);
    view.choose('t');control=view.all().find(n=>n.props['data-garment-select']==='t');assert.equal(control.props['aria-pressed'],true);
    assert.ok(!view.all().some(n=>n.type==='button' && [t.select,t.cancel,t.undo].includes(text(n))));
  }
});
test('opening a card still opens its sheet while another garment is selected',()=>{
  const view=mount();view.choose('t');view.open('b');assert.deepEqual(view.opened,['b']);assert.ok(view.panel());
});
test('batch action changes only selected garments and clears selection',()=>{
  const view=mount();view.choose('t');view.click(copy('es').toUnavailable);
  assert.equal(view.wardrobe.find(g=>g.id==='t').state,'unavailable');
  assert.equal(view.wardrobe.find(g=>g.id==='b').state,'available');assert.equal(view.panel(),undefined);
});
test('select visible and clear selection stay contextual',()=>{
  const view=mount();view.choose('t');view.click(copy('es').selectVisible);
  assert.equal(view.all().filter(n=>n.props['data-garment-select'] && n.props['aria-pressed']).length,3);
  view.click(copy('es').clear);assert.equal(view.panel(),undefined);
});
test('changing category or status clears selection',()=>{
  const view=mount();view.choose('t');view.render({categoryKey:'top',filteredGarments:seed().filter(g=>g.category==='top')});
  assert.equal(view.panel(),undefined);view.choose('t');view.click('No disponibles (1)');assert.equal(view.panel(),undefined);
});
test('selection is pruned when a garment leaves the visible inventory',()=>{
  const view=mount();view.choose('t');const wardrobe=seed().filter(g=>g.id!=='t');
  view.render({wardrobe,filteredGarments:wardrobe});assert.equal(view.panel(),undefined);
});
test('unavailable garments can be reactivated individually',()=>{
  const view=mount();view.click('No disponibles (1)');view.choose('x');view.click(copy('es').toAvailable);
  assert.equal(view.wardrobe.find(g=>g.id==='x').state,'available');assert.equal(view.panel(),undefined);
});
test('global reactivation preserves confirmation and covers hidden categories',()=>{
  const view=mount();view.click('No disponibles (1)');
  const wardrobe=seed().map(g=>g.id==='b'?{...g,state:'unavailable'}:g);
  view.render({wardrobe,categoryKey:'top',filteredGarments:wardrobe.filter(g=>g.category==='top')});
  const previous=globalThis.confirm;let prompts=0;
  try {
    globalThis.confirm=()=>{prompts++;return false;};view.click(copy('es').allAvailable);
    assert.equal(view.wardrobe.filter(g=>g.state==='unavailable').length,2);
    globalThis.confirm=()=>{prompts++;return true;};view.click(copy('es').allAvailable);
    assert.equal(view.wardrobe.filter(g=>g.state==='unavailable').length,0);assert.equal(prompts,2);
  } finally {globalThis.confirm=previous;}
});
test('empty inventory has no selection actions or garment selectors',()=>{
  const view=mount();view.render({wardrobe:[],filteredGarments:[]});
  assert.equal(view.panel(),undefined);assert.equal(view.all().filter(n=>n.props['data-garment-select']).length,0);
});
