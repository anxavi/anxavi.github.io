import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVITIES,normalizeActivities,supportsActivity,activityLabel,buildJourneyPlan,validateJourneyPlan,journeyGarments} from '../src/engine/journey.js';
const garment=(id,category,formality=8,activities=[])=>({id,category,formality,activities,state:'available',timesWorn:0,thermalRange:{minTempC:5,maxTempC:28}});
const primary={top:garment('office_top','top'),bottom:garment('office_bottom','bottom'),footwear:garment('office_shoes','footwear'),outerwear:null};
const base=[primary.top,primary.bottom,primary.footwear];
const sports=['top','bottom','footwear'].map(category=>garment('gym_'+category,category,3,['gym']));
const context=type=>({occasion:'office',tempC:17,dualJourney:{enabled:true,type}});
const build=(wardrobe=[...base,...sports],type='gym',extra={})=>buildJourneyPlan({primaryOutfit:primary,wardrobe,context:context(type),...extra});
test('catalogue has six activities with three languages',()=>{
 assert.equal(ACTIVITIES.length,6);
 for(const activity of ACTIVITIES)for(const lang of ['es','en','ca'])assert.ok(activityLabel(activity.id,lang).startsWith('+ '));
});
test('activity markings are explicit and normalized',()=>{
 assert.deepEqual(normalizeActivities(['gym','gym','running','unknown','afterwork']),['gym','running']);
 assert.equal(supportsActivity(garment('shoe','footwear',3),'running'),false);
});
test('disabled journey adds no clothes',()=>{
 const plan=buildJourneyPlan({primaryOutfit:primary,wardrobe:base,context:{dualJourney:{enabled:false}}});
 assert.equal(plan.status,'disabled');assert.deepEqual(plan.additionalGarments,[]);
});
test('gym can require three replacements',()=>{
 const plan=build();assert.equal(plan.status,'ready');assert.equal(plan.changes.length,3);assert.equal(plan.additionalGarments.length,3);assert.deepEqual(validateJourneyPlan(plan,[...base,...sports]),[]);
});
test('primary outfit remains unchanged and plan is a snapshot',()=>{
 const before=JSON.stringify(primary);const plan=build();
 assert.equal(JSON.stringify(primary),before);assert.notEqual(plan.primaryOutfit.top,primary.top);assert.equal(plan.primaryOutfit.top.id,'office_top');
});
test('sports eligibility is not inferred from sneakers or garment name',()=>{
 const unknown=base.map(g=>({...g,name:'Running sports sneakers',subCategory:'sneakers',attributes:['active']}));
 const plan=build(unknown);assert.equal(plan.status,'incomplete');assert.equal(plan.missing.length,3);assert.ok(plan.missing.every(item=>item.reason==='ACTIVITY_NOT_CONFIRMED'));
});
test('unavailable sports clothing is never selected',()=>{
 const inventory=[...base,...sports.map(g=>g.category==='bottom'?{...g,state:'unavailable'}:g)];
 const plan=build(inventory);assert.equal(plan.status,'incomplete');assert.equal(plan.secondaryOutfit,null);
});
test('same suitable outfit needs no additional garments',()=>{
 const compatible=build(base,'dinner_work');assert.equal(compatible.status,'compatible');assert.equal(compatible.changes.length,0);assert.equal(compatible.additionalGarments.length,0);
});
test('friends dinner may require more than one change',()=>{
 const casual=['top','bottom','footwear'].map(category=>garment('casual_'+category,category,5));
 const plan=build([...base,...casual],'dinner_friends');assert.equal(plan.status,'ready');assert.ok(plan.changes.length>=2);
});
test('removal of office outerwear is represented explicitly',()=>{
 const coat=garment('coat','outerwear');
 const plan=buildJourneyPlan({primaryOutfit:{...primary,outerwear:coat},wardrobe:[...base,coat,...sports],context:context('gym')});
 assert.ok(plan.changes.some(change=>change.category==='outerwear'&&change.action==='remove'));assert.equal(plan.secondaryOutfit.outerwear,null);
});
test('unknown activities and invalid primary outfit are rejected',()=>{
 assert.equal(build(base,'unknown').reason,'UNKNOWN_ACTIVITY');
 assert.equal(build(base,'gym',{primaryOutfit:{...primary,footwear:{id:'foreign'}}}).reason,'INVALID_PRIMARY_OUTFIT');
});
test('duplicate inventory IDs are rejected',()=>assert.equal(build([...base,base[0]]).reason,'INVALID_INVENTORY'));
test('plan validation rejects later unavailability and forged extras',()=>{
 const inventory=[...base,...sports],plan=build(inventory);
 assert.ok(validateJourneyPlan(plan,inventory.map(g=>g.id==='gym_top'?{...g,state:'unavailable'}:g)).length);
 assert.ok(validateJourneyPlan({...plan,additionalGarments:[{id:'foreign'}]},inventory).includes('INVALID_ADDITIONAL_GARMENTS'));
});
test('plan validation rejects changed activity markings',()=>{
 const inventory=[...base,...sports],plan=build(inventory);
 assert.ok(validateJourneyPlan(plan,inventory.map(g=>g.id==='gym_top'?{...g,activities:[]}:g)).includes('ACTIVITY_NOT_CONFIRMED'));
});
test('bounded search reports its limit instead of claiming exhaustive failure',()=>{
 const casual=['top','bottom','footwear'].map(category=>garment('casual_'+category,category,5));
 const plan=build([...base,...casual],'dinner_friends',{maxCombinations:1});
 assert.equal(plan.status,'incomplete');assert.equal(plan.reason,'SEARCH_LIMIT_REACHED');assert.ok(plan.evaluated<=1);
});
test('reuse is counted once across both outfits',()=>{
 const plan=build(base,'dinner_work');assert.equal(journeyGarments(plan).length,3);
});
test('outdoor thermal incompatibility is explicit',()=>{
 const running=sports.map(g=>({...g,activities:['running'],thermalRange:{minTempC:30,maxTempC:40}}));
 const plan=build([...base,...running],'running');assert.equal(plan.status,'incomplete');assert.ok(plan.missing.every(item=>item.reason==='NO_THERMAL_MATCH'));
});
test('legacy activity names have explicit mappings',()=>{
 assert.equal(build(base,'dinner').activityId,'dinner_friends');assert.equal(build(base,'party').activityId,'afterwork');
});
test('malformed plans do not throw and unsupported versions are rejected',()=>{
 assert.deepEqual(validateJourneyPlan({version:'wrong'},base),['INVALID_PLAN']);
 const plan=build();assert.deepEqual(validateJourneyPlan({...plan,additionalGarments:{}},[...base,...sports]),['INVALID_PLAN']);
});
test('social plan is rechecked against current formality',()=>{
 const plan=build(base,'dinner_work');
 assert.ok(validateJourneyPlan(plan,base.map(g=>({...g,formality:1}))).includes('UNSUITABLE_SECONDARY_OUTFIT'));
});
test('outdoor plans are rechecked against current thermal ranges',()=>{
 const inventory=[...base,...sports.map(g=>({...g,activities:['running']}))];
 const plan=build(inventory,'running');assert.equal(plan.status,'ready');
 const changed=inventory.map(g=>g.id==='gym_top'?{...g,thermalRange:{minTempC:30,maxTempC:40}}:g);
 assert.ok(validateJourneyPlan(plan,changed).includes('UNSUITABLE_SECONDARY_OUTFIT'));
});
test('no garment is suitable if it is absent',()=>assert.equal(supportsActivity(null,'dinner_work'),false));
