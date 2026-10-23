import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {localDay,validDay,outfitUsageId,usageGarments,createUsageLedger,usageRecord,garmentUsedOn,outfitUseCount,registerUsage,revokeUsage} from '../src/engine/usage.js';
const day='2026-10-23';
const wardrobe=()=>[{id:'t',category:'top',state:'available',timesWorn:14},{id:'b',category:'bottom',state:'available',timesWorn:3},{id:'s',category:'footwear',state:'available',timesWorn:1},{id:'j',category:'outerwear',state:'available',timesWorn:8},{id:'x',category:'top',state:'unavailable',timesWorn:0}];
const look=(items,id='o1')=>({id,top:items[0],bottom:items[1],footwear:items[2],outerwear:items[3]});
const register=(l,w,o,ids,date=day)=>registerUsage(l,w,o,ids,date);
const counts=w=>w.map(g=>g.timesWorn);
test('partial use changes only the selected garments and preserves historical counts',()=>{
 const w=wardrobe(),l=createUsageLedger(2),before=JSON.stringify({w,l});const r=register(l,w,look(w),['t','s']);
 assert.ok(r.ok);assert.deepEqual(counts(r.wardrobe),[15,3,2,8,0]);assert.equal(JSON.stringify({w,l}),before);assert.equal(outfitUseCount(r.ledger),3);
});
test('every garment is counted once even when selected IDs repeat',()=>{
 const w=wardrobe(),r=register(createUsageLedger(),w,look(w),['t','t']);assert.ok(r.ok);assert.deepEqual(r.entry.garmentIds,['t']);assert.equal(r.wardrobe[0].timesWorn,15);
});
test('repeating a record is idempotent and cannot silently change its selection',()=>{
 const w=wardrobe(),o=look(w),first=register(createUsageLedger(),w,o,['t','s']);
 const repeat=register(first.ledger,first.wardrobe,o,['s','t']);assert.ok(repeat.duplicate);assert.equal(repeat.ledger,first.ledger);assert.equal(repeat.wardrobe,first.wardrobe);
 assert.equal(register(first.ledger,first.wardrobe,o,['b']).reason,'already_recorded');
});
test('saved and active copies of the same outfit share one usage identity',()=>{
 const w=wardrobe(),o=look(w),r=register(createUsageLedger(),w,o,['t']);
 const saved={...o,id:'saved_o1',sourceOutfitId:'o1'};assert.equal(outfitUsageId(saved),'o1');
 assert.ok(register(r.ledger,r.wardrobe,saved,['t']).duplicate);assert.equal(usageRecord(r.ledger,saved,day).outfitId,'o1');
});
test('two outfits on the same day share one garment increment',()=>{
 const w=wardrobe(),a=register(createUsageLedger(),w,look(w),['t','b']);
 const b=register(a.ledger,a.wardrobe,look(w,'o2'),['t','s']);assert.ok(b.ok);assert.deepEqual(counts(b.wardrobe),[15,4,2,8,0]);assert.equal(outfitUseCount(b.ledger),2);
 const undoA=revokeUsage(b.ledger,b.wardrobe,'o1',day);assert.deepEqual(counts(undoA.wardrobe),[15,3,2,8,0]);assert.ok(garmentUsedOn(undoA.ledger,'t',day));
 const undoB=revokeUsage(undoA.ledger,undoA.wardrobe,'o2',day);assert.deepEqual(counts(undoB.wardrobe),counts(w));assert.equal(outfitUseCount(undoB.ledger),0);
});
test('shared garments also work when records are revoked in the reverse order',()=>{
 const w=wardrobe(),a=register(createUsageLedger(),w,look(w),['t']);const b=register(a.ledger,a.wardrobe,look(w,'o2'),['t']);
 const first=revokeUsage(b.ledger,b.wardrobe,'o2',day);assert.equal(first.wardrobe[0].timesWorn,15);
 const last=revokeUsage(first.ledger,first.wardrobe,'o1',day);assert.equal(last.wardrobe[0].timesWorn,14);
});
test('another day adds another use and undoing one day preserves the other',()=>{
 const w=wardrobe(),o=look(w),a=register(createUsageLedger(),w,o,['t']);const b=register(a.ledger,a.wardrobe,o,['t'],'2026-10-24');assert.equal(b.wardrobe[0].timesWorn,16);
 const r=revokeUsage(b.ledger,b.wardrobe,o,day);assert.equal(r.wardrobe[0].timesWorn,15);assert.ok(usageRecord(r.ledger,o,'2026-10-24'));
});
test('empty selections and foreign or missing IDs never change state',()=>{
 const w=wardrobe(),l=createUsageLedger(),o=look(w);
 for(const [ids,reason] of [[[],'empty_selection'],[['foreign'],'foreign_garment'],[[''],'invalid_selection']]){const r=register(l,w,o,ids);assert.equal(r.reason,reason);assert.equal(r.ledger,l);assert.equal(r.wardrobe,w);}
 const r=register(l,w.filter(g=>g.id!=='t'),o,['t']);assert.equal(r.reason,'unavailable_selection');
});
test('unselected unavailable garments do not block recording selected available ones',()=>{
 const w=wardrobe(),o=look(w);const changed=w.map(g=>g.id==='b'?{...g,state:'unavailable'}:g);
 assert.ok(register(createUsageLedger(),changed,o,['t']).ok);assert.equal(register(createUsageLedger(),changed,o,['b']).reason,'unavailable_selection');
});
test('changed category is rejected instead of trusting an old snapshot',()=>{
 const w=wardrobe(),o=look(w),changed=w.map(g=>g.id==='t'?{...g,category:'bottom'}:g);assert.equal(register(createUsageLedger(),changed,o,['t']).reason,'unavailable_selection');
});
test('reversion uses the recorded IDs even after availability changes',()=>{
 const w=wardrobe(),o=look(w),r=register(createUsageLedger(),w,o,['t','s']);
 const changed=r.wardrobe.map(g=>g.id==='t'?{...g,state:'unavailable'}:g);const undo=revokeUsage(r.ledger,changed,o,day);
 assert.ok(undo.ok);assert.deepEqual(counts(undo.wardrobe),counts(w));assert.equal(undo.wardrobe[0].state,'unavailable');
});
test('reversion tolerates a removed garment and repeated undo is a no-op',()=>{
 const w=wardrobe(),r=register(createUsageLedger(),w,look(w),['t','s']);
 const undo=revokeUsage(r.ledger,r.wardrobe.filter(g=>g.id!=='t'),'o1',day);assert.ok(undo.ok);assert.equal(undo.wardrobe.find(g=>g.id==='s').timesWorn,1);
 const repeat=revokeUsage(undo.ledger,undo.wardrobe,'o1',day);assert.ok(repeat.duplicate);assert.equal(repeat.wardrobe,undo.wardrobe);
});
test('reversion never produces negative counters',()=>{
 const w=wardrobe(),r=register(createUsageLedger(),w,look(w),['t']);const inconsistent=r.wardrobe.map(g=>g.id==='t'?{...g,timesWorn:0}:g);
 const undo=revokeUsage(r.ledger,inconsistent,'o1',day);assert.ok(undo.ok);assert.equal(undo.wardrobe[0].timesWorn,0);
});
test('usage survives deletion of a saved item because no history is consulted',()=>{
 const w=wardrobe(),o=look(w),saved=[{...o,id:'saved_o1',sourceOutfitId:'o1'}];const r=register(createUsageLedger(2),w,saved[0],['t']);
 saved.splice(0,1);assert.equal(usageRecord(r.ledger,'o1',day).garmentIds[0],'t');assert.equal(r.wardrobe[0].timesWorn,15);assert.equal(outfitUseCount(r.ledger),3);
});
test('historical metrics remain a baseline without invented garment dates',()=>{
 const l=createUsageLedger(7);assert.equal(outfitUseCount(l),7);assert.equal(l.records.length,0);assert.equal(garmentUsedOn(l,'t',day),false);
 assert.throws(()=>createUsageLedger(-1));assert.throws(()=>createUsageLedger(1.5));
});
test('transition garments are selectable and deduplicated against the base outfit',()=>{
 const w=wardrobe(),o={...look(w),transitionLayer:{item:w[3]}};assert.equal(usageGarments(o).filter(g=>g.id==='j').length,1);
 const r=register(createUsageLedger(),w,o,['j']);assert.ok(r.ok);assert.equal(r.wardrobe[3].timesWorn,9);
});
test('object garment lists work but string-only legacy lists do not invent inventory',()=>{
 const w=wardrobe();assert.ok(register(createUsageLedger(),w,{id:'list',garments:[w[0]]},['t']).ok);
 assert.equal(register(createUsageLedger(),w,{id:'legacy',garments:['t']},['t']).reason,'foreign_garment');
});
test('dates are real calendar dates and invalid input fails without mutations',()=>{
 assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2028-02-29'),true);assert.equal(validDay('2026-2-01'),false);
 const w=wardrobe(),l=createUsageLedger(),o=look(w);assert.equal(register(l,w,o,['t'],'bad').reason,'invalid_request');assert.equal(revokeUsage(l,w,o,'bad').reason,'invalid_request');
 assert.throws(()=>localDay(new Date('invalid')));
});
test('local date follows Europe Madrid rather than UTC at midnight',()=>{
 const url=new URL('../src/engine/usage.js',import.meta.url).href;
 const result=spawnSync(process.execPath,['--input-type=module','-e',`import {localDay} from ${JSON.stringify(url)};process.stdout.write(localDay(new Date('2026-10-22T22:30:00Z')));`],{env:{...process.env,TZ:'Europe/Madrid'},encoding:'utf8'});
 assert.equal(result.status,0);assert.equal(result.stdout,'2026-10-23');
});
test('corrupt ledgers, duplicate inventory IDs and unsafe counters are rejected',()=>{
 const w=wardrobe(),o=look(w);assert.equal(register({},w,o,['t']).reason,'invalid_ledger');assert.equal(register(createUsageLedger(),[...w,w[0]],o,['t']).reason,'invalid_wardrobe');
 const big=w.map(g=>g.id==='t'?{...g,timesWorn:Number.MAX_SAFE_INTEGER}:g);assert.equal(register(createUsageLedger(),big,o,['t']).reason,'counter_overflow');
 const bad={version:1,legacyCount:0,records:[{outfitId:'o1',day,garmentIds:['t','t']}]};assert.equal(register(bad,w,o,['t']).reason,'invalid_ledger');
});
