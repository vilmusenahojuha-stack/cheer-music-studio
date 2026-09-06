'use strict';
const assert=require('assert');
const core=require('../cheer-fx-arc-core.js');

function group(eight,section,phase,events=[]){
  return {eight,pattern:{sectionType:section},phraseEnergy:{phase},events};
}
function impact(score=0.9,hero=false){return {kind:'impact',phraseEnergyDecision:'keep',phraseEnergyScore:score,phraseEnergyRole:hero?'hero-candidate':'support'};}

{
  const plan=core.createCheerFxArcPlan({kind:'cheer-fx-phrase-energy-plan',status:'preview-ready',bpm:152,riskFlags:[],groups:[
    group(1,'intro','build',[{kind:'riser',phraseEnergyDecision:'keep',phraseEnergyScore:0.6}]),
    group(2,'intro','drive',[impact(0.7)]),
    group(3,'stunt','build',[{kind:'riser',phraseEnergyDecision:'keep',phraseEnergyScore:0.7}]),
    group(4,'stunt','peak',[impact(1,true)]),
    group(5,'ending','build',[{kind:'riser',phraseEnergyDecision:'keep',phraseEnergyScore:0.7}]),
    group(6,'ending','resolve',[impact(1,true)])
  ]});
  assert.equal(plan.status,'preview-ready');
  assert.equal(plan.sections.length,3);
  assert.deepEqual(plan.sections[1].targetArc,['build','peak']);
  assert.equal(plan.sections[1].directive,'hold');
  assert.equal(plan.summary.risks,0);
}

{
  const plan=core.createCheerFxArcPlan({kind:'cheer-fx-phrase-energy-plan',status:'preview-ready',riskFlags:[],groups:[
    group(1,'pyramid','peak',[impact()]),
    group(2,'pyramid','build',[impact()])
  ]});
  assert.equal(plan.status,'review-required');
  assert(plan.arcRisks.some(r=>r.type==='energy-arc-reverses'));
  assert.equal(plan.sections[0].directive,'rebuild-energy-rise');
}

{
  const plan=core.createCheerFxArcPlan({kind:'cheer-fx-phrase-energy-plan',status:'preview-ready',riskFlags:[],groups:[
    group(1,'stunt','build',[]),
    group(2,'stunt','peak',[])
  ]});
  assert(plan.arcRisks.some(r=>r.type==='section-missing-impact'));
  assert.equal(plan.sections[0].directive,'add-peak-impact');
}

{
  const plan=core.createCheerFxArcPlan({kind:'cheer-fx-phrase-energy-plan',status:'preview-ready',riskFlags:[],groups:[
    group(1,'ending','build',[impact(0.8)]),
    group(2,'ending','resolve',[impact(0.9)])
  ]});
  assert(plan.arcRisks.some(r=>r.type==='ending-missing-hero-candidate'));
  assert.equal(plan.sections[0].directive,'promote-ending-hero');
}

{
  const blocked=core.createCheerFxArcPlan(null);
  assert.equal(blocked.status,'blocked');
  assert.equal(blocked.reason,'cheer-fx-phrase-energy-plan-required');
  assert.equal(blocked.executable,false);
}

console.log('cheer-fx-arc-core tests passed');
