const fs=require('node:fs'),crypto=require('node:crypto'),parser=require('@babel/parser');
const expected={"index-preview.html":"a0cc250c6afdb20c52b9b34a65ae68d3a1977e00","index.html":"2142d0bd6d20e2d50d4864eaf2d33560bb00cec9","src/engine/browser.js":"2ac9590f500e28223b1b6ea64db6a7da2d3b2ab4","test/block1.test.mjs":"288c5ded674c9d1d5956998121dd1b6d0481a04a","src/ui/journey-panel.js":"d94d1edc2f7c2b4957f9d29b6e6eda64c86e1d63","test/block4-ui.test.mjs":"fe1b8ae3ebebb1f3dfb1d0380d14e4b4ceb0a3f9"};
const blob=data=>crypto.createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
for(const [file,sha]of Object.entries(expected))if(fs.lstatSync(file).isSymbolicLink()||blob(fs.readFileSync(file))!==sha)throw Error('Version changed: '+file);
let html=fs.readFileSync('index-preview.html','utf8');
const match=html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if(!match)throw Error('JSX missing');
let code=match[1];const offset=match.index+match[0].indexOf(match[1]);
const ast=parser.parse(code,{sourceType:'script',plugins:['jsx']}),nodes=[];
function walk(node,parents=[]){
 if(!node||typeof node!=='object')return;
 if(node.type)nodes.push({node,parents});
 for(const [key,value]of Object.entries(node)){
  if(['loc','start','end','extra','comments','tokens'].includes(key))continue;
  for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object')walk(child,[...parents,node]);
 }
}
walk(ast);
const text=node=>code.slice(node.start,node.end);
const hasId=(node,name)=>nodes.some(entry=>entry.node.type==='Identifier'&&entry.node.name===name&&entry.node.start>=node.start&&entry.node.end<=node.end);
const candidates=nodes.filter(({node})=>node.type==='JSXElement'&&text(node).includes('t.dualJourneyTitle')&&hasId(node,'setDualJourney')&&hasId(node,'setDualJourneyType')).sort((a,b)=>(a.node.end-a.node.start)-(b.node.end-b.node.start));
if(!candidates.length)throw Error('Journey section missing');
const target=candidates[0];
if(target.node.end-target.node.start>10000||hasId(target.node,'setEventContext')||text(target.node).includes('t.generateActionBtn')||!['JSXElement','JSXFragment'].includes(target.parents.at(-1)?.type))throw Error('Unsafe journey boundary');
const declaration=nodes.filter(({node})=>node.type==='VariableDeclaration'&&node.declarations.some(d=>d.id.type==='ArrayPattern'&&d.id.elements.some(e=>e?.name==='dualJourney')));
if(declaration.length!==1||!hasId(ast,'setCurrentView'))throw Error('Unexpected app state');
const markup='{window.__ARACHNE_JOURNEY_PANEL__ && React.createElement(window.__ARACHNE_JOURNEY_PANEL__, {lang, occasion: eventContext, activities: window.__ARACHNE_JOURNEY_ACTIVITIES__, value: journeyPreview, onChange: setJourneyPreview, onReview: () => setCurrentView("wardrobe"), disabled: isGenerating})}';
const state='const [journeyPreview, setJourneyPreview] = useState({enabled: false, type: "gym", showExample: false});\n      ';
const edits=[{start:target.node.start,end:target.node.end,value:markup},{start:declaration[0].node.start,end:declaration[0].node.start,value:state}].sort((a,b)=>b.start-a.start);
for(const edit of edits)code=code.slice(0,edit.start)+edit.value+code.slice(edit.end);
parser.parse(code,{sourceType:'script',plugins:['jsx']});
html=(html.slice(0,offset)+code+html.slice(offset+match[1].length)).replace(/^[ \t]+$/gm,'');
let browser=fs.readFileSync('src/engine/browser.js','utf8');
const anchor='globalThis.__ARACHNE_ENGINE__ = engine;';
if(browser.split(anchor).length!==2)throw Error('Browser anchor changed');
browser="import { JourneyPanel } from '../ui/journey-panel.js';\nimport { ACTIVITIES } from './journey.js';\n"+browser.replace(anchor,'globalThis.__ARACHNE_JOURNEY_PANEL__ = JourneyPanel;\nglobalThis.__ARACHNE_JOURNEY_ACTIVITIES__ = ACTIVITIES;\n'+anchor);
let tests=fs.readFileSync('test/block1.test.mjs','utf8');
const old=String.raw`test('three context controls have disabled attribute', () => {
  assert.equal((html.match(/disabled=\{isGenerating\}\s+aria-disabled=\{isGenerating\}/g) || []).length, 3);
});`;
const updated=String.raw`test('primary context and visual journey receive the generation lock', () => {
  assert.equal((html.match(/disabled=\{isGenerating\}\s+aria-disabled=\{isGenerating\}/g) || []).length, 1);
  assert.match(html, /__ARACHNE_JOURNEY_PANEL__[\s\S]{0,500}disabled: isGenerating/);
});`;
if(tests.split(old).length!==2)throw Error('Generation-lock test changed');
tests=tests.replace(old,updated);
if((html.match(/disabled=\{isGenerating\}\s+aria-disabled=\{isGenerating\}/g)||[]).length!==1)throw Error('Unexpected primary controls');
fs.writeFileSync('index-preview.html',html);fs.writeFileSync('src/engine/browser.js',browser);fs.writeFileSync('test/block1.test.mjs',tests);
if(blob(fs.readFileSync('index.html'))!==expected['index.html'])throw Error('Original changed');
