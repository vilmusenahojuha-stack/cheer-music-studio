const assert=require('assert');
const core=require('../cheer-fx-phrase-energy-core.js');

function patternPlan(groups,status='preview-ready'){
  return {kind:'cheer-fx-pattern-plan',status,bpm:152,riskFlags:[],groups};
}

function group(eight,sectionType,events,maxAccents=4){
  return {eight,pattern:{sectionType,maxAccents,name:`${sectionType}-pattern`},events};
}

{
  const result=core.createCheerFxPhraseEnergyPlan(patternPlan([
    group(1,'intro',[
      {kind:'impact',count:1,patternDecision:'align',intensityScore:.9},
      {kind:'impact',count:5,patternDecision:'align',intensityScore:.8},
      {kind:'riser',count:8,patternDecision:'align',intensityScore:.7}
    ],3)
  ]),{energyWindows:[{startEight:1,endEight:4,phase:'build',energy:.55}],phraseStartEight:1,phraseLength:4});
  assert.equal(result.status,'preview-ready');
  assert.equal(result.groups[0].phraseEnergy.phase,'build');
  assert.equal(result.groups[0].phraseEnergy.phraseSlot,1);
  assert(result.activeEvents.some(e=>e.kind==='riser'));
  assert.equal(result.summary.readyForPreview,true);
}

{
  const result=core.createCheerFxPhraseEnergyPlan(patternPlan([
    group(4,'pyramid',[
      {kind:'impact',count:1,patternDecision:'align',intensityScore:.98},
      {kind:'impact',count:5,patternDecision:'align',intensityScore:.9},
      {kind:'impact',count:7,patternDecision:'align',intensityScore:.82}
    ],3)
  ]),{energyWindows:[{startEight:1,endEight:4,phase:'peak',energy:1}],phraseStartEight:1,phraseLength:4});
  assert.equal(result.groups[0].phraseEnergy.phraseSlot,4);
  assert(result.activeEvents.some(e=>e.phraseEnergyRole==='hero-candidate'));
  assert.equal(result.deferredEvents.length,0);
}

{
  const result=core.createCheerFxPhraseEnergyPlan(patternPlan([
    group(6,'dance',[
      {kind:'impact',count:1,patternDecision:'align',intensityScore:.95},
      {kind:'impact',count:3,patternDecision:'align',intensityScore:.85},
      {kind:'impact',count:5,patternDecision:'align',intensityScore:.75},
      {kind:'impact',count:7,patternDecision:'align',intensityScore:.65}
    ],4)
  ]),{energyWindows:[{startEight:5,endEight:8,phase:'break',energy:.25}],phraseStartEight:5,phraseLength:4});
  assert(result.deferredEvents.length>=2);
  assert(result.activeEvents.filter(e=>e.kind==='impact').length<=2);
}

{
  const result=core.createCheerFxPhraseEnergyPlan(patternPlan([
    group(9,'stunt',[{kind:'impact',count:1,patternDecision:'align',intensityScore:.9}],3)
  ]));
  assert.equal(result.groups[0].phraseEnergy.phase,'peak');
  assert.equal(result.groups[0].phraseEnergy.source,'section-inference');
}

{
  assert.equal(core.phraseSlot(1,1,4),1);
  assert.equal(core.phraseSlot(4,1,4),4);
  assert.equal(core.phraseSlot(5,1,4),1);
}

{
  const result=core.createCheerFxPhraseEnergyPlan(patternPlan([], 'review-required'));
  assert.equal(result.status,'review-required');
  assert(result.riskFlags.includes('no-active-fx-after-phrase-energy-shaping'));
}

{
  const result=core.createCheerFxPhraseEnergyPlan(null);
  assert.equal(result.status,'blocked');
  assert.equal(result.reason,'cheer-fx-pattern-plan-required');
  assert.equal(result.executable,false);
}

console.log('cheer-fx-phrase-energy-core tests passed');
