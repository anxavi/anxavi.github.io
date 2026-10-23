const fs=require('node:fs'),crypto=require('node:crypto'),parser=require('@babel/parser');
const expected={"index-preview.html":"331df179995507e728e0d6fe87972f636d72161b","index.html":"2142d0bd6d20e2d50d4864eaf2d33560bb00cec9","src/engine/browser.js":"47e029192a87ce94304d7323b6bbac5dc5dec4a3","src/ui/journey-panel.js":"d94d1edc2f7c2b4957f9d29b6e6eda64c86e1d63","src/ui/journey-records.js":"e1678b177c96c6d9d640ff665407f5744007a409","tools/block4-records.test.mjs":"eca229d13d7dc76fb9513fc74af20366004b2437"};
const blob=data=>crypto.createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
for(const [file,sha]of Object.entries(expected))if(fs.lstatSync(file).isSymbolicLink()||blob(fs.readFileSync(file))!==sha)throw Error('Version changed: '+file);
try{fs.lstatSync('test/block4-records.test.mjs');throw Error('Test target already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
let panel=fs.readFileSync('src/ui/journey-panel.js','utf8');
for(const [before,after]of [["es:{title:","es:{save:'Guardar ejemplo',title:"],["en:{title:","en:{save:'Save example',title:"],["ca:{title:","ca:{save:'Desar exemple',title:"],["onReview=()=>{},disabled=false","onReview=()=>{},onSave=()=>{},disabled=false"],["tu armario, Guardados ni los contadores","tu armario ni los contadores de uso real"],["wardrobe, Saved, or counters","wardrobe or real wear counters"],["l’armari, Desats ni els comptadors","l’armari ni els comptadors d’ús real"],["Este primer paso prueba la navegación y el diseño. El guardado del plan y el marcado deportivo se conectarán en el siguiente paso del bloque 4.","Puedes guardar ejemplos en la sección de demostración de Guardados. Solo se conservan mientras esta sesión permanezca abierta."],["This first step tests navigation and layout. Plan saving and sports markings will be connected in the next step of block 4.","You can save examples in the demonstration section of Saved. They last only while this session remains open."],["Aquest primer pas prova la navegació i el disseny. El desament del pla i el marcatge esportiu es connectaran al pas següent del bloc 4.","Pots desar exemples a la secció de demostració de Desats. Només es conserven mentre aquesta sessió continuï oberta."],["},t.review)\n   ):null,","},t.review),\n    h('button',{type:'button','data-action':'save-example',disabled,'aria-disabled':disabled,onClick:()=>{if(!disabled)onSave();},className:'rounded-lg bg-arachne-ink text-white px-3 py-2 text-xs disabled:opacity-50'},t.save)\n   ):null,"]]){if(panel.split(before).length!==2)throw Error('Panel anchor changed: '+before);panel=panel.replace(before,after);}
if(blob(Buffer.from(panel))!=='49dca7959cd855e196a1a245c8b4fb4846ecc766')throw Error('Unexpected panel result');
let html=fs.readFileSync('index-preview.html','utf8');
const match=html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);if(!match)throw Error('JSX missing');
let code=match[1];const offset=match.index+match[0].indexOf(match[1]);
const ast=parser.parse(code,{sourceType:'script',plugins:['jsx']}),nodes=[];
function walk(node){if(!node||typeof node!=='object')return;if(node.type)nodes.push(node);for(const [key,value]of Object.entries(node)){if(['loc','start','end','extra','comments','tokens'].includes(key))continue;for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object')walk(child);}}
walk(ast);
const text=node=>code.slice(node.start,node.end),has=(node,name)=>nodes.some(n=>n.type==='Identifier'&&n.name===name&&n.start>=node.start&&n.end<=node.end);
const one=(list,name)=>{if(list.length!==1)throw Error('Unexpected '+name+': '+list.length);return list[0];};
const declaration=name=>one(nodes.filter(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.type==='ArrayPattern'&&d.id.elements.some(e=>e?.name===name))),name);
const state=declaration('journeyPreview'),auth=declaration('isAuthenticated'),edits=[];
const edit=(start,end,value)=>edits.push({start,end,value});
edit(state.start,state.start,'const [journeyExamples, setJourneyExamples] = useState([]);\n      const [journeyExampleOpen, setJourneyExampleOpen] = useState(null);\n      ');
const effectPosition=Math.max(state.end,auth.end);
edit(effectPosition,effectPosition,'\n      useEffect(() => { setJourneyExamples([]); setJourneyExampleOpen(null); }, [isAuthenticated]);');
const call=one(nodes.filter(n=>n.type==='CallExpression'&&text(n.callee)==='React.createElement'&&n.arguments[0]&&text(n.arguments[0])==='window.__ARACHNE_JOURNEY_PANEL__'),'journey component call');
const props=call.arguments[1];if(props?.type!=='ObjectExpression')throw Error('Journey props changed');
edit(props.end-1,props.end-1,`, onSave: () => {
 if(isGenerating)return;
 const api=window.__ARACHNE_JOURNEY_RECORDS__,input={occasion:eventContext,type:journeyPreview.type},now=new Date();
 if(!api)return;
 const result=api.saveExample([],input,now);if(!result.ok)return;
 setJourneyExamples(previous=>api.saveExample(previous,input,now).items);
 setJourneyExampleOpen(result.entry.id);setCurrentView('history');
}`);
const history=one(nodes.filter(n=>n.type==='LogicalExpression'&&n.operator==='&&'&&n.left?.type==='BinaryExpression'&&n.left.left?.name==='currentView'&&n.left.right?.value==='history'&&n.right?.type==='JSXElement'),'history view');
const empty=one(nodes.filter(n=>n.type==='JSXExpressionContainer'&&n.start>=history.right.start&&n.end<=history.right.end&&n.expression?.type==='ConditionalExpression'&&text(n.expression.test).replace(/\s/g,'')==='history.length===0'),'history empty state');
edit(empty.start,empty.start,`{window.__ARACHNE_JOURNEY_RECORDS__ && React.createElement(window.__ARACHNE_JOURNEY_RECORDS__.JourneyExamples, {lang,items:journeyExamples,selectedId:journeyExampleOpen,onSelect:setJourneyExampleOpen,onToday:()=>setCurrentView('today'),onRemove:(id)=>{setJourneyExamples(previous=>window.__ARACHNE_JOURNEY_RECORDS__.removeExample(previous,id));if(journeyExampleOpen===id)setJourneyExampleOpen(null);},disabled:isGenerating})}\n`);
edit(empty.expression.test.start,empty.expression.test.end,'history.length === 0 && journeyExamples.length === 0');
const modal=one(nodes.filter(n=>n.type==='LogicalExpression'&&n.operator==='&&'&&n.left?.type==='Identifier'&&n.left.name==='selectedGarmentModal'&&n.right?.type==='JSXElement'),'garment modal');
const content=modal.right.children.find(n=>n.type==='JSXElement');if(!content?.closingElement)throw Error('Garment content missing');
const form=one(content.children.filter(n=>n.type&&has(n,'handleSaveGarmentEdits')),'garment actions');
edit(form.start,form.start,`{window.__ARACHNE_JOURNEY_RECORDS__ && React.createElement(window.__ARACHNE_JOURNEY_RECORDS__.ActivityFields, {lang,garment:isEditingGarment?editedGarmentData:(wardrobe.find(item=>item.id===selectedGarmentModal.id)||selectedGarmentModal),editing:isEditingGarment,onChange:activities=>setEditedGarmentData(previous=>({...previous,activities})),disabled:isGenerating})}\n`);
const classes=content.openingElement.attributes.find(n=>n.type==='JSXAttribute'&&n.name.name==='className');if(classes?.value?.type!=='StringLiteral')throw Error('Garment layout changed');
edit(classes.value.start,classes.value.end,JSON.stringify(classes.value.value.replace(/\boverflow-hidden\b/,'overflow-y-auto')+' max-h-[85dvh]'));
let limit=code.length;
for(const change of edits.sort((a,b)=>b.start-a.start||b.end-a.end)){if(change.end>limit)throw Error('Overlapping edits');code=code.slice(0,change.start)+change.value+code.slice(change.end);limit=change.start;}
parser.parse(code,{sourceType:'script',plugins:['jsx']});
html=(html.slice(0,offset)+code+html.slice(offset+match[1].length)).replace(/^[ \t]+$/gm,'');
let browser=fs.readFileSync('src/engine/browser.js','utf8');const anchor='globalThis.__ARACHNE_ENGINE__ = engine;';if(browser.split(anchor).length!==2)throw Error('Browser anchor changed');
browser="import * as journeyRecords from '../ui/journey-records.js';\n"+browser.replace(anchor,'globalThis.__ARACHNE_JOURNEY_RECORDS__ = journeyRecords;\n'+anchor);
fs.writeFileSync('index-preview.html',html);fs.writeFileSync('src/ui/journey-panel.js',panel);fs.writeFileSync('src/engine/browser.js',browser);fs.copyFileSync('tools/block4-records.test.mjs','test/block4-records.test.mjs');
if(blob(fs.readFileSync('index.html'))!==expected['index.html'])throw Error('Original changed');
