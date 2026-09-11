const assert=require('assert');
const core=require('../smart-mix-source-structure-core.js');

const profile=Array.from({length:12},(_,i)=>({
  eight:i+1,
  start:i*3.2,
  end:(i+1)*3.2,
  sourceName:'A.wav',
  trackId:'A',
  energyScore:[.4,.45,.5,.52,.2,.22,.25,.3,.8,.84,.86,.88][i]
}));

const profileCore={
  detectAudioEnergyEvents:()=>[
    {type:'break',atEight:5,time:12.8,confidence:.91,sourceName:'A.wav',trackId:'A'},
    {type:'drop',atEight:9,time:25.6,confidence:.94,sourceName:'A.wav',trackId:'A'}
  ]
};

const result=core.inferSourceStructure(profile,{minEventConfidence:.72,phraseEights:4},{profileCore});
assert.equal(result.nonDestructive,true);
assert.equal(result.source,'energy-transitions');
assert.equal(result.events.length,2);
assert.deepEqual(result.sections.map(section=>[section.startEight,section.endEight,section.boundaryType]),[
  [1,4,'track-start'],[5,8,'break'],[9,12,'drop']
]);
assert.deepEqual(result.sections.map(section=>section.purpose),['buildup','reset','peak']);
assert(result.sections[0].energyDelta>.1,'rising energy should mark the opening section as buildup');
assert(result.sections[1].energyAverage<.34,'break section should expose its low energy average');
assert(result.sections[2].energyAverage>.72,'drop section should expose its high energy average');
assert.deepEqual(result.phrases.map(phrase=>[phrase.startEight,phrase.endEight]),[[1,4],[5,8],[9,12]]);
assert.deepEqual(result.phrases.map(phrase=>phrase.sectionPurpose),['buildup','reset','peak']);
assert.equal(result.sections[1].sourceName,'A.wav');
assert.equal(result.sections[1].trackId,'A');
assert(result.confidence>.9);

const impactRows=profile.map((row,i)=>({...row,energyScore:i<8?.5:.6}));
assert.equal(core.classifySection({startEight:9,endEight:12,incomingEvent:'drop'},impactRows).purpose,'impact');

const neutralRows=profile.map(row=>({...row,energyScore:.5}));
assert.equal(core.classifySection({startEight:1,endEight:4,incomingEvent:'break'},neutralRows).purpose,'transition');

const lowConfidence=core.inferSourceStructure(profile,{minEventConfidence:.95},{profileCore});
assert.equal(lowConfidence.source,'fallback');
assert.deepEqual(lowConfidence.sections,[],'weak structural events must preserve the existing matcher fallback');
assert.deepEqual(lowConfidence.phrases,[]);

const mixedCore={detectAudioEnergyEvents:()=>[
  {type:'break',atEight:5,confidence:.93,sourceName:'B.wav',trackId:'B'},
  {type:'drop',atEight:9,confidence:.9,sourceName:'A.wav',trackId:'A'}
]};
const isolated=core.inferSourceStructure(profile,{minEventConfidence:.72},{profileCore:mixedCore});
assert.equal(isolated.events.length,1,'events from another source must not affect this track');
assert.equal(isolated.events[0].atEight,9);

const duplicateCore={detectAudioEnergyEvents:()=>[
  {type:'break',atEight:5,confidence:.8,sourceName:'A.wav',trackId:'A'},
  {type:'drop',atEight:5,confidence:.9,sourceName:'A.wav',trackId:'A'}
]};
const deduped=core.inferSourceStructure(profile,{minEventConfidence:.72},{profileCore:duplicateCore});
assert.equal(deduped.events.length,1);
assert.equal(deduped.events[0].type,'drop','strongest event at the same boundary must win');

const short=core.inferSourceStructure([profile[0]],{}, {profileCore});
assert.equal(short.source,'fallback');
assert.equal(short.nonDestructive,true);

console.log('smart-mix-source-structure-core tests passed');