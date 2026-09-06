const assert=require('assert');
const core=require('../cheer-fx-pattern-core.js');

function plan(events,status='preview-ready'){
  return {kind:'cheer-fx-count-rhythm-plan',status,bpm:152,riskFlags:[],events};
}

{
  const result=core.createCheerFxPatternPlan(plan([
    {eight:3,sectionType:'tumbling',kind:'impact',count:1,intensityScore:.9,priority:.9},
    {eight:3,sectionType:'tumbling',kind:'impact',count:5,intensityScore:.8,priority:.8},
    {eight:3,sectionType:'tumbling',kind:'impact',count:7,intensityScore:.7,priority:.7},
    {eight:3,sectionType:'tumbling',kind:'whoosh',count:8,intensityScore:.5,priority:.5}
  ]));
  assert.equal(result.status,'preview-ready');
  assert.deepEqual(result.events.filter(e=>e.kind==='impact').map(e=>e.count),[1,3,5]);
  assert.equal(result.events.find(e=>e.kind==='whoosh').count,8);
  assert.equal(result.groups[0].pattern.name,'tumbling-drive');
}

{
  const result=core.createCheerFxPatternPlan(plan([
    {eight:8,sectionType:'ending',kind:'impact',count:2,intensityScore:.98,priority:1},
    {eight:8,sectionType:'ending',kind:'impact',count:4,intensityScore:.9,priority:.9},
    {eight:8,sectionType:'ending',kind:'impact',count:6,intensityScore:.8,priority:.8},
    {eight:8,sectionType:'ending',kind:'impact',count:8,intensityScore:.7,priority:.7}
  ]));
  assert.deepEqual(result.events.map(e=>e.count),[1,5,7,8]);
  assert.equal(result.summary.aligned,4);
}

{
  const result=core.createCheerFxPatternPlan(plan([
    {eight:2,sectionType:'stunt',kind:'impact',count:1,intensityScore:.9,priority:.9},
    {eight:2,sectionType:'stunt',kind:'riser',count:8,intensityScore:.7,priority:.7},
    {eight:2,sectionType:'stunt',kind:'whoosh',count:8,intensityScore:.6,priority:.6}
  ]));
  const transitionCounts=result.events.filter(e=>e.kind==='riser'||e.kind==='whoosh').map(e=>e.count);
  assert.deepEqual(transitionCounts,[4,8]);
  assert.equal(result.patternRisks.length,0);
}

{
  const result=core.createCheerFxPatternPlan(plan([
    {eight:5,sectionType:'stunt',kind:'impact',count:1,intensityScore:.9,priority:.9},
    {eight:5,sectionType:'stunt',kind:'impact',count:3,intensityScore:.8,priority:.8},
    {eight:5,sectionType:'stunt',kind:'impact',count:5,intensityScore:.7,priority:.7},
    {eight:5,sectionType:'stunt',kind:'impact',count:7,intensityScore:.6,priority:.6}
  ]));
  assert.equal(result.events.filter(e=>e.patternDecision==='review').length,1);
}

{
  const result=core.createCheerFxPatternPlan(plan([], 'review-required'));
  assert.equal(result.status,'review-required');
  assert(result.riskFlags.includes('no-fx-events-to-pattern'));
}

{
  const result=core.createCheerFxPatternPlan(null);
  assert.equal(result.status,'blocked');
  assert.equal(result.reason,'cheer-fx-count-rhythm-plan-required');
  assert.equal(result.executable,false);
}

console.log('cheer-fx-pattern-core tests passed');
