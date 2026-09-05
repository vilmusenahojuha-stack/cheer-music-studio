const assert=require('assert');
const core=require('../cheer-structure-core.js');

function close(actual,expected,eps=1e-9){assert.ok(Math.abs(actual-expected)<=eps,`${actual} != ${expected}`)}

close(core.beatSeconds(148),60/148);
close(core.eightCountSeconds(148),480/148);
close(core.eightCountSeconds(152),480/152);

const map=core.buildEightCountMap({
  bpm:148,
  oneOffset:0.05,
  totalEights:8,
  sections:[
    {id:'a',startEight:1,endEight:4,type:'intro',energy:'medium'},
    {id:'b',startEight:5,endEight:6,type:'transition',energy:'high'},
    {id:'c',startEight:7,endEight:8,type:'stunt',energy:'peak'}
  ]
});
assert.equal(map.length,8);
assert.equal(map[0].sectionType,'intro');
assert.equal(map[4].sectionType,'transition');
assert.equal(map[6].energy,'peak');
close(map[0].start,0.05);
close(map[1].start,0.05+480/148);

const phrases=core.buildPhrases(map,{phraseEights:4});
assert.equal(phrases.length,3);
assert.deepEqual(phrases.map(p=>[p.startEight,p.endEight]),[[1,4],[5,6],[7,8]]);
assert.equal(phrases[0].sectionType,'intro');

assert.equal(core.classifyEnergyTrend([{energy:'low'},{energy:'medium'},{energy:'high'}]),'rising');
assert.equal(core.classifyEnergyTrend([{energy:'peak'},{energy:'high'}]),'falling');
assert.equal(core.classifyEnergyTrend([{energy:'medium'},{energy:'medium'}]),'steady');

const energyMap=[
  {eight:1,start:0,energy:'low',sectionId:'a',sectionType:'intro'},
  {eight:2,start:3,energy:'medium',sectionId:'a',sectionType:'intro'},
  {eight:3,start:6,energy:'peak',sectionId:'b',sectionType:'stunt'},
  {eight:4,start:9,energy:'high',sectionId:'b',sectionType:'stunt'},
  {eight:5,start:12,energy:'low',sectionId:'c',sectionType:'transition'},
  {eight:6,start:15,energy:'peak',sectionId:'d',sectionType:'dance'}
];
const events=core.detectEnergyEvents(energyMap);
assert.equal(events.length,5);
assert.deepEqual(events.slice(0,3).map(e=>e.type),['energy-rise','energy-rise','energy-drop']);
assert.equal(events[1].strength,2);
assert.equal(events[1].sectionChanged,true);

const transitions=core.detectTransitionCandidates(energyMap);
const at3=transitions.filter(e=>e.atEight===3);
assert.ok(at3.some(e=>e.type==='cut'&&e.reason==='section-boundary'));
assert.ok(at3.some(e=>e.type==='drop'&&e.energyDelta===2));
const at5=transitions.filter(e=>e.atEight===5);
assert.ok(at5.some(e=>e.type==='break'&&e.energyDelta===-2));
assert.ok(at5.some(e=>e.type==='cut'));
const at6=transitions.filter(e=>e.atEight===6);
assert.ok(at6.some(e=>e.type==='drop'&&e.energyDelta===3));
assert.ok(transitions.every(e=>e.confidence>=0&&e.confidence<=1));

const filtered=core.detectTransitionCandidates(energyMap,{minEnergyStrength:3});
assert.ok(!filtered.some(e=>e.type==='drop'&&e.atEight===3));
assert.ok(filtered.some(e=>e.type==='drop'&&e.atEight===6));
assert.ok(filtered.some(e=>e.type==='cut'&&e.atEight===3));

const beat=60/152;
close(core.snapToCount(1.23,{bpm:152,oneOffset:0.04,mode:'beat'}),0.04+Math.round((1.23-0.04)/beat)*beat);

const valid=core.validateSections([{startEight:1,endEight:4,type:'intro'},{startEight:5,endEight:8,type:'stunt'}]);
assert.equal(valid.ok,true);
const overlap=core.validateSections([{startEight:1,endEight:4},{startEight:4,endEight:8}]);
assert.equal(overlap.ok,false);
assert.equal(overlap.issues[0].type,'overlap');

assert.throws(()=>core.beatSeconds(0));
console.log('cheer-structure-core tests passed');
