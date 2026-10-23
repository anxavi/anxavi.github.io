const HANDLERS="const savedActionRef = useRef(false);\n      const handleSaveOutfit = () => {\n        const p = window.__ARACHNE_PRESENTATION__;\n        if (!p || !currentOutfit || isGenerating || savedActionRef.current) return;\n        const context = { occasion: eventContext, tempC: weather?.tempC, dualJourney: { enabled: dualJourney, type: dualJourneyType } };\n        const result = p.saveLook(history, currentOutfit, wardrobe, context);\n        if (!result.ok) { showToast(p.copy(lang).unavailable); return; }\n        savedActionRef.current = true;\n        setHistory(previous => p.saveLook(previous, currentOutfit, wardrobe, context).history);\n        resetInteractionState();\n        showToast(p.copy(lang).savedToast);\n        queueMicrotask(() => { savedActionRef.current = false; });\n      };\n      const handleMarkSavedWorn = (id) => {\n        const p = window.__ARACHNE_PRESENTATION__;\n        if (!p || savedActionRef.current) return;\n        const result = p.markWorn(history, wardrobe, id);\n        if (!result.ok) { showToast(p.copy(lang).unavailable); return; }\n        if (result.duplicate) return;\n        savedActionRef.current = true;\n        setHistory(result.history);\n        setWardrobe(result.wardrobe);\n        if (inspectedLook?.id === id) setInspectedLook(result.history.find(look => look.id === id));\n        showToast(p.copy(lang).wornToast);\n        queueMicrotask(() => { savedActionRef.current = false; });\n      };";
const SAVE_SECTION="{currentView === 'today' && currentOutfit && !isGenerating && inventoryReady && (\n              <div className=\"space-y-2 pb-3\">\n                <button type=\"button\" onClick={handleSaveOutfit}\n                  disabled={window.__ARACHNE_PRESENTATION__?.saved(history, currentOutfit) || unavailableCurrentIds.length > 0}\n                  className=\"w-full bg-arachne-ink text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50\">\n                  {window.__ARACHNE_PRESENTATION__?.saved(history, currentOutfit) ? window.__ARACHNE_PRESENTATION__?.copy(lang).saved : window.__ARACHNE_PRESENTATION__?.copy(lang).save}\n                </button>\n              </div>\n            )}\n";
const WEAR_BUTTON="<button type=\"button\" onClick={() => handleMarkSavedWorn(inspectedLook.id)}\n                  disabled={window.__ARACHNE_PRESENTATION__?.wornToday(inspectedLook) || !window.__ARACHNE_PRESENTATION__?.canUse(inspectedLook, wardrobe)}\n                  className=\"w-full bg-arachne-ink text-white py-3 rounded-xl text-xs font-semibold disabled:opacity-50\">\n                  {window.__ARACHNE_PRESENTATION__?.wornToday(inspectedLook) ? window.__ARACHNE_PRESENTATION__?.copy(lang).worn : window.__ARACHNE_PRESENTATION__?.copy(lang).wear}\n                </button>";
const FACTOR_MARKUP="{(window.__ARACHNE_PRESENTATION__?.factorList(currentOutfit?.breakdown || {}, lang) || []).map(factor => (\n                    <div key={factor.key} className=\"space-y-1\">\n                      <div className=\"flex justify-between text-xs\"><span>{factor.label}</span><span>{factor.score == null ? '—' : factor.score + '/100'}</span></div>\n                      {factor.score != null && <div className=\"h-1.5 bg-arachne-surface rounded-full\"><div className=\"h-full bg-arachne-terracotta rounded-full\" style={{width: factor.score + '%'}} /></div>}\n                      <p className=\"text-[10px] text-arachne-inkMuted\">{factor.reason}</p>\n                    </div>\n                  ))}";
const fs = require('node:fs');
const crypto = require('node:crypto');
const parser = require('@babel/parser');
const expected = {'index-preview.html':'18fc43ff6939a8a855cfa32f59de305bbe80c38a','src/engine/browser.js':'25f6e3bf4e2e22c1a98097dee791e509e248e55b','index.html':'2142d0bd6d20e2d50d4864eaf2d33560bb00cec9','src/engine/presentation.js':'08524a6a163d725cc4f22c8bdb8b44cf2f5e2ab2'};
const blob = data => crypto.createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
for (const [file,sha] of Object.entries(expected)) {
 if(fs.lstatSync(file).isSymbolicLink() || blob(fs.readFileSync(file))!==sha) throw Error('Version changed: '+file);
}
let html = fs.readFileSync('index-preview.html','utf8');
const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if(!match)throw Error('JSX missing');
let code=match[1]; const offset=match.index+match[0].indexOf(match[1]);
const ast=parser.parse(code,{sourceType:'script',plugins:['jsx']});
const nodes=[];
function walk(node,parents=[]) {
 if(!node||typeof node!=='object')return;
 if(node.type)nodes.push({node,parents});
 for(const [key,value] of Object.entries(node)){
  if(['loc','start','end','extra','comments','tokens'].includes(key))continue;
  for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object')walk(child,[...parents,node]);
 }
}
walk(ast);
const text=node=>code.slice(node.start,node.end), edits=[], removed=[];
const edit=(start,end,replacement)=>edits.push({start,end,replacement});
const hasId=(node,name)=>{
 let found=false;
 function scan(n){
  if(!n||typeof n!=='object')return;
  if(n.type==='Identifier'&&n.name===name)found=true;
  for(const [key,v]of Object.entries(n)){
   if(['loc','extra'].includes(key))continue;
   for(const c of Array.isArray(v)?v:[v])if(c&&typeof c==='object')scan(c);
  }
 }
 scan(node);return found;
};
const inside=node=>removed.some(range=>node.start>=range.start&&node.end<=range.end);
for(const {node}of nodes){
 if(node.type==='JSXExpressionContainer'&&node.expression?.type==='LogicalExpression'&&hasId(node.expression.left,'showPieceEditorModal')){
  removed.push(node);edit(node.start,node.end,'');
 }
}
for(const {node}of nodes){
 if(node.type!=='VariableDeclaration'||inside(node))continue;
 const ids=node.declarations.flatMap(d=>d.id.type==='ArrayPattern'?d.id.elements.filter(Boolean).map(x=>x.name):[d.id.name]);
 if(ids.some(id=>['showPieceEditorModal','swappingCategory','handleSwapGarment'].includes(id))){removed.push(node);edit(node.start,node.end,'');}
 else if(ids.includes('handleConfirmWearToday')){removed.push(node);edit(node.start,node.end,HANDLERS);}
}
for(const {node,parents}of nodes){
 if(inside(node)||node.type!=='JSXAttribute'||node.name?.name!=='onClick')continue;
 if(hasId(node,'setSwappingCategory')||hasId(node,'setShowPieceEditorModal')){
  const element=[...parents].reverse().find(p=>p.type==='JSXElement');
  if(element?.openingElement.name?.name==='button'){removed.push(element);edit(element.start,element.end,'');}
  else {removed.push(node);edit(node.start,node.end,'');}
 }
}
let factorCount=0,detailCount=0;
for(const {node,parents}of nodes){
 if(inside(node))continue;
 if(node.type==='CallExpression'&&node.callee.type==='Identifier'&&node.callee.name==='setShowPieceEditorModal'){edit(node.start,node.end,'handleSaveOutfit()');continue;}
 if(node.type==='VariableDeclarator'&&node.id.name==='mapEngineOutfitToUI'){
  const body=node.init.body;
  if(body.type!=='ObjectExpression')throw Error('Unexpected outfit mapper');
  edit(body.start+1,body.start+1,'contextSnapshot: { occasion: eventContext, tempC: weather?.tempC, dualJourney: { enabled: dualJourney, type: dualJourneyType } },');
 }
 if(node.type!=='JSXExpressionContainer')continue;
 const expression=node.expression;
 if(expression.type==='LogicalExpression'&&hasId(expression.left,'inspectedLook')&&text(node).includes('t.inspectUnifiedTitle')){
  const content=expression.right?.children?.find(child=>child.type==='JSXElement');
  if(!content?.closingElement)throw Error('Saved-look detail not found');
  edit(content.closingElement.start,content.closingElement.start,WEAR_BUTTON);detailCount++;
 }
 if(text(node).startsWith('{Object.entries(currentOutfit?.breakdown')){edit(node.start,node.end,FACTOR_MARKUP);factorCount++;continue;}
 if(expression.type==='LogicalExpression'&&text(expression.left).includes('scoreMeta')&&text(expression.left).includes('limitations')){
  edit(node.start,node.end,'{window.__ARACHNE_PRESENTATION__?.limitationText(currentOutfit?.scoreMeta, lang) && <p className="text-[10px] text-arachne-inkMuted">{window.__ARACHNE_PRESENTATION__?.limitationText(currentOutfit?.scoreMeta, lang)}</p>}');continue;
 }
 if(expression.type==='MemberExpression'&&expression.object.type==='Identifier'){
  const object=expression.object.name,property=expression.property.name;
  if(['currentOutfit','look','inspectedLook'].includes(object)&&property==='editorial')edit(node.start,node.end,'{window.__ARACHNE_PRESENTATION__?.describe('+object+', lang) || ""}');
  if(['look','inspectedLook'].includes(object)&&property==='occasion')edit(node.start,node.end,'{window.__ARACHNE_PRESENTATION__?.occasionLabel('+object+', lang) || ""}');
  if(object==='look'&&property==='date')edit(node.start,node.end,'{window.__ARACHNE_PRESENTATION__?.dateLabel(look, lang) || ""}');
  if(object==='t'&&['harmonyOptimal','harmonyModalSub','savedEmptySub','historySub','swipeRightLabel'].includes(property)){
   const keys={harmonyOptimal:'overview',harmonyModalSub:'sub',savedEmptySub:'empty',historySub:'historySub',swipeRightLabel:'save'};
   edit(node.start,node.end,'{window.__ARACHNE_PRESENTATION__?.copy(lang).'+keys[property]+' || ""}');
  }
  if(object==='history'&&property==='length'&&[...parents].reverse().some(p=>p.type==='JSXElement'&&text(p).includes('t.confirmedOutfitsMetric'))){
   edit(node.start,node.end,'{window.__ARACHNE_PRESENTATION__?.wearCount(history) ?? 0}');
  }
 }
}
if(factorCount!==1||detailCount!==1)throw Error('Unexpected harmony/detail structure: '+factorCount+'/'+detailCount);
let limit=code.length;
for(const change of edits.sort((a,b)=>b.start-a.start||b.end-a.end)){
 if(change.end>limit)throw Error('Overlapping JSX edits');
 code=code.slice(0,change.start)+change.replacement+code.slice(change.end);limit=change.start;
}
parser.parse(code,{sourceType:'script',plugins:['jsx']});
html=html.slice(0,offset)+code+html.slice(offset+match[1].length);
const anchor='            {/* VISTA 2: ARMARIO DIGITAL */}';
if(html.split(anchor).length!==2)throw Error('Wardrobe boundary changed');
html=html.replace(anchor,SAVE_SECTION+'\n'+anchor);
const opener='onOpen: (item) => { setSelectedGarmentModal(item); setIsEditingGarment(false); }';
if(html.split(opener).length!==2)throw Error('Wardrobe opener changed');
html=html.replace(opener,'onOpen: (item) => { setSelectedGarmentModal(item); setEditedGarmentData({ ...item }); setIsEditingGarment(false); }');
const finalCode=html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1];
parser.parse(finalCode,{sourceType:'script',plugins:['jsx']});
for(const name of ['showPieceEditorModal','setShowPieceEditorModal','swappingCategory','setSwappingCategory','handleSwapGarment']){
 if(new RegExp('\\b'+name+'\\b').test(finalCode))throw Error('Remaining editor reference: '+name);
}
let browser="import * as presentation from './presentation.js';\n"+fs.readFileSync('src/engine/browser.js','utf8');
const engineAnchor='globalThis.__ARACHNE_ENGINE__ = engine;';
if(browser.split(engineAnchor).length!==2)throw Error('Browser loader changed');
browser=browser.replace(engineAnchor,'globalThis.__ARACHNE_PRESENTATION__ = presentation;\n'+engineAnchor);
fs.writeFileSync('index-preview.html',html);fs.writeFileSync('src/engine/browser.js',browser);
if(blob(fs.readFileSync('index.html'))!==expected['index.html'])throw Error('Original changed');
