import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryGaps, missingMessage, availabilityChange, undoAvailability, unavailableOutfitIds } from '../src/engine/availability.js';
const inventory = [
 {id:'t',category:'top',state:'available',name:'Original'},
 {id:'b',category:'bottom',state:'available'},
 {id:'s',category:'footwear',state:'available'},
 {id:'x',category:'top',state:'unavailable'}
];
test('all required categories available',()=>assert.deepEqual(categoryGaps(inventory),[]));
test('empty wardrobe reports three missing categories',()=>assert.equal(categoryGaps([]).length,3));
test('registered unavailable differs from absent category',()=>{
 const gaps=categoryGaps(inventory.map(g=>g.id==='s'?{...g,state:'unavailable'}:g));
 assert.equal(gaps[0].total,1);
 assert.equal(categoryGaps(inventory.filter(g=>g.id!=='s'))[0].total,0);
});
test('preflight messages support ES EN CA',()=>{
 for(const lang of ['es','en','ca']) assert.ok(missingMessage([],lang).length>20);
 assert.notEqual(missingMessage([],'es'),missingMessage([],'en'));
});
test('batch changes only selected IDs without mutating input',()=>{
 const result=availabilityChange(inventory,['t','unknown','t'],'unavailable');
 assert.equal(result.count,1); assert.equal(result.wardrobe[0].state,'unavailable');
 assert.equal(inventory[0].state,'available'); assert.equal(result.wardrobe[1],inventory[1]);
});
test('reactivation and idempotent changes',()=>{
 assert.equal(availabilityChange(inventory,['x'],'available').count,1);
 assert.equal(availabilityChange(inventory,['t'],'available').count,0);
 assert.throws(()=>availabilityChange(inventory,['t'],'deleted'));
});
test('undo preserves unrelated garment edits',()=>{
 const result=availabilityChange(inventory,['t'],'unavailable');
 const changed=result.wardrobe.map(g=>g.id==='t'?{...g,name:'Edited'}:g);
 const restored=undoAvailability(changed,result.undo);
 assert.equal(restored[0].state,'available'); assert.equal(restored[0].name,'Edited');
});
test('undo only touches matching target states',()=>{
 const result=availabilityChange(inventory,['t'],'unavailable');
 const changed=result.wardrobe.map(g=>g.id==='t'?{...g,state:'available'}:g);
 assert.equal(undoAvailability(changed,result.undo)[0],changed[0]);
});
test('stale outfit checked against current inventory including transition',()=>{
 const outfit={top:inventory[0],bottom:inventory[1],footwear:inventory[2]};
 assert.deepEqual(unavailableOutfitIds(outfit,inventory),[]);
 assert.deepEqual(unavailableOutfitIds(outfit,availabilityChange(inventory,['s'],'unavailable').wardrobe),['s']);
 assert.deepEqual(unavailableOutfitIds({...outfit,transitionLayer:{item:{id:'x'}}},inventory),['x']);
});
