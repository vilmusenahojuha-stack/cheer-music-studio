'use strict';
const assert=require('assert');
const core=require('../cheer-fx-competition-balance-core.js');

function section(name,averageScore,impactCount=1,heroCount=0,activeCount=3){
  return {section:name,averageScore,impactCount,heroCount,activeCount,risks:[],directive:'hold'};
}
function plan(sections,status='preview-ready'){
  return {kind:'cheer-fx-arc-plan',status,bpm:152,riskFlags:[],sections};
}

{
  const result=core.balanceCompetitionArc(plan([
    section('intro',0.55,0,0,2),
    section('stunt',0.72,2,0,4),
    section('pyramid',0.78,2,1,5),
    section('ending',0.92,2,1,5)
  ]));
  assert.equal(result.status,'preview-ready');
  assert.equal(result.summary.risks,0);
  assert(result.sections[3].competitionIntensity>result.sections[0].competitionIntensity);
  assert.equal(result.sections[3].balanceDirective,'hold');
}

{
  const result=core.balanceCompetitionArc(plan([
    section('stunt',1,4,1,8),
    section('pyramid',1,4,1,8),
    section('ending',0.82,1,1,4)
  ]));
  assert.equal(result.status,'review-required');
  assert(result.balanceRisks.some(r=>r.type==='consecutive-major-peaks'));
  assert(result.balanceRisks.some(r=>r.type==='ending-lacks-final-headroom'));
}

{
  const result=core.balanceCompetitionArc(plan([
    section('pyramid',1,4,1,8),
    section('ending',0.9,2,1,5)
  ]));
  assert(result.balanceRisks.some(r=>r.type==='pyramid-consumes-ending-headroom'));
  assert.equal(result.sections[0].balanceDirective,'trim-pyramid-peak');
}

{
  const result=core.balanceCompetitionArc(plan([
    section('intro',1,4,1,8),
    section('ending',0.95,2,1,5)
  ]));
  assert(result.balanceRisks.some(r=>r.type==='section-over-ceiling'));
  assert.equal(result.sections[0].balanceDirective,'reduce-section-fx');
}

{
  const blocked=core.balanceCompetitionArc(null);
  assert.equal(blocked.status,'blocked');
  assert.equal(blocked.reason,'cheer-fx-arc-plan-required');
  assert.equal(blocked.executable,false);
}

{
  const inherited=core.balanceCompetitionArc(plan([section('ending',0.9,2,1,5)],'review-required'));
  assert.equal(inherited.status,'review-required');
  assert.equal(inherited.safePreviewOnly,true);
}

console.log('cheer-fx-competition-balance-core tests passed');
