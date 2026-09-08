const assert=require('assert');
const core=require('../cheer-fx-render-core.js');

assert.equal(core.PHRASE_FX_BUDGET.maxSupportImpacts,1,'default phrase budget should allow one support impact');

const anchors=[
  {id:'stunt-riser',kind:'riser',at:1.6,endAt:2,duration:.4,sectionId:'stunt-a',sectionType:'stunt',routineEight:1,sectionArcStage:'drive',confidence:.85,intensityScore:.76},
  {id:'stunt-hit',kind:'impact',at:2,sectionId:'stunt-a',sectionType:'stunt',routineEight:1,sectionArcStage:'drive',confidence:.85,intensityScore:.76},
  {id:'basket-riser',kind:'riser',at:4.6,endAt:5,duration:.4,sectionId:'basket-a',sectionType:'basket',routineEight:2,sectionArcStage:'drive',confidence:.9,intensityScore:.88},
  {id:'basket-hit',kind:'impact',at:5,sectionId:'basket-a',sectionType:'basket',routineEight:2,sectionArcStage:'drive',confidence:.9,intensityScore:.88},
  {id:'peak-riser',kind:'riser',at:8.6,endAt:9,duration:.4,sectionId:'pyramid-peak',sectionType:'pyramid',routineEight:4,sectionArcStage:'peak',phraseHeroEligible:true,confidence:.96,intensityScore:.98},
  {id:'peak-hit',kind:'impact',at:9,sectionId:'pyramid-peak',sectionType:'pyramid',routineEight:4,sectionArcStage:'peak',phraseHeroEligible:true,confidence:.96,intensityScore:.98}
];
const snapshot=JSON.stringify(anchors);
const selected=core.selectPatternHits(anchors);
assert.equal(selected.find(a=>a.id==='peak-hit').hitRole,'principal');
assert.equal(selected.find(a=>a.id==='basket-hit').hitRole,'support');
assert.equal(selected.find(a=>a.id==='stunt-hit').hitRole,'support');
assert.ok(core.supportHitScore(selected.find(a=>a.id==='basket-hit'))>core.supportHitScore(selected.find(a=>a.id==='stunt-hit')),'stronger basket support should win the phrase support budget');

const balanced=core.enforcePhraseFxBudget(selected);
const byId=id=>balanced.find(a=>a.id===id);
assert.equal(byId('peak-hit').hitRole,'principal','principal hit must always survive support budgeting');
assert.notEqual(byId('peak-hit').executable,false);
assert.equal(byId('basket-hit').hitRole,'support');
assert.equal(byId('basket-hit').fxBudgetDecision,'keep');
assert.equal(byId('stunt-hit').hitRole,'omit');
assert.equal(byId('stunt-hit').executable,false);
assert.equal(byId('stunt-hit').fxBudgetDecision,'drop');
assert.equal(byId('stunt-riser').hitRole,'omit','paired riser must follow a budget-dropped support impact');
assert.equal(byId('stunt-riser').executable,false);
assert.equal(byId('stunt-riser').fxBudgetReason,'paired-impact-budget-drop');
assert.equal(JSON.stringify(anchors),snapshot,'phrase budgeting must not mutate source anchors');

const events=core.buildRenderEvents(anchors,12);
assert.deepEqual(events.map(e=>e.id),['basket-riser','basket-hit','peak-riser','peak-hit'],'phrase budget should render one support pair plus the principal pair');
assert.equal(events.find(e=>e.id==='basket-hit').at,5,'budgeting must not move kept support timing');
assert.equal(events.find(e=>e.id==='peak-hit').at,9,'budgeting must not move principal timing');
assert.equal(events.find(e=>e.id==='basket-riser').endAt,5,'support riser must still end exactly on its impact');
assert.equal(events.find(e=>e.id==='peak-riser').endAt,9,'principal riser must still end exactly on its impact');

const noSupports=core.enforcePhraseFxBudget(selected,{maxSupportImpacts:0});
assert.equal(noSupports.find(a=>a.id==='basket-hit').executable,false,'zero-support budget should still preserve principal while removing supports');
assert.notEqual(noSupports.find(a=>a.id==='peak-hit').executable,false);

console.log('cheer-fx phrase budget tests passed');
