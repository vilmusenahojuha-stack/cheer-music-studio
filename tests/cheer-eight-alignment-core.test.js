const assert=require('assert');
const core=require('../cheer-eight-alignment-core.js');

assert.deepEqual(core.classifyAlignmentReliability({
  accepted:true,
  alignment:{confidence:.91,support:3}
}),{
  level:'strong',confidence:.91,support:3,accepted:true,
  canAutoUse:true,needsReview:false,useManualCountOne:false,
  reason:'strong-structural-alignment'
});

assert.equal(core.classifyAlignmentReliability({
  accepted:true,
  alignment:{confidence:.76,support:2}
}).level,'review');

assert.equal(core.classifyAlignmentReliability({
  accepted:false,
  alignment:{confidence:.63,support:3}
}).level,'review');

assert.equal(core.classifyAlignmentReliability({
  accepted:false,
  alignment:{confidence:.4,support:1}
}).level,'manual');

assert.equal(core.classifyAlignmentReliability({
  accepted:true,
  alignment:{confidence:.88,support:3}
},{strongConfidence:.9}).level,'review');

const normalized=core.normalizeTransitionAnchors([
  {type:'drop',time:10.02,confidence:.9,reason:'audio-energy-rise'},
  {type:'noise',time:12,confidence:1},
  {type:'cut',time:6.01,confidence:.8,source:'section-analysis'},
  {type:'break',time:-1,confidence:1},
  {type:'break',time:2.00,confidence:.95},
  {type:'drop',time:14,confidence:0}
]);
assert.deepEqual(normalized.map(x=>x.type),['break','cut','drop']);
assert.deepEqual(normalized.map(x=>x.time),[2,6.01,10.02]);

const profile=Array.from({length:4},(_,i)=>({eight:i+1,start:i*4,end:(i+1)*4,energyScore:.5}));
let detectorCalls=0;
const detector=()=>{
  detectorCalls++;
  return [
    {type:'break',time:2.01,confidence:.95},
    {type:'drop',time:6.02,confidence:.92}
  ];
};

let buildArgs=null;
const structureCore={
  buildIntelligentEightCountMap(args){
    buildArgs=args;
    return {
      accepted:true,
      source:'structural-anchors',
      reason:'alignment-accepted',
      oneOffset:2.01,
      alignment:{confidence:.91,support:3},
      map:Array.from({length:args.totalEights},(_,i)=>({eight:i+1,start:2.01+i*4,end:2.01+(i+1)*4}))
    };
  }
};

const result=core.alignProfileEightCounts(profile,{
  bpm:120,
  oneOffset:.1,
  additionalEvents:[{type:'cut',time:10.01,confidence:.88}],
  minAlignmentConfidence:.72,
  minAlignmentSupport:2
},{
  structureCore,
  profileCore:{detectAudioEnergyEvents:detector}
});

assert.equal(detectorCalls,1);
assert.equal(result.accepted,true);
assert.equal(result.nonDestructive,true);
assert.equal(result.diagnosticOnly,true);
assert.equal(result.reliability.level,'strong');
assert.equal(result.reliability.canAutoUse,true);
assert.equal(result.anchors.length,3);
assert.deepEqual(result.anchors.map(x=>x.type),['break','drop','cut']);
assert.equal(buildArgs.bpm,120);
assert.equal(buildArgs.oneOffset,.1);
assert.equal(buildArgs.totalEights,4);
assert.equal(buildArgs.minAlignmentConfidence,.72);
assert.equal(buildArgs.minAlignmentSupport,2);
assert.deepEqual(buildArgs.anchors.map(x=>x.time),[2.01,6.02,10.01]);

const rejected=core.alignProfileEightCounts(profile,{bpm:120,oneOffset:.15},{
  structureCore:{
    buildIntelligentEightCountMap(args){
      return {
        accepted:false,
        source:'fallback',
        reason:'insufficient-support',
        oneOffset:args.oneOffset,
        alignment:{confidence:0,support:0},
        map:[]
      };
    }
  },
  profileCore:{detectAudioEnergyEvents:()=>[]}
});
assert.equal(rejected.accepted,false);
assert.equal(rejected.oneOffset,.15);
assert.equal(rejected.anchors.length,0);
assert.equal(rejected.nonDestructive,true);
assert.equal(rejected.reliability.level,'manual');
assert.equal(rejected.reliability.useManualCountOne,true);

const unavailable=core.alignProfileEightCounts(profile,{bpm:120},{structureCore:null,profileCore:{}});
assert.equal(unavailable.accepted,false);
assert.equal(unavailable.reason,'structure-core-unavailable');
assert.equal(unavailable.reliability.level,'manual');
assert.equal(unavailable.diagnosticOnly,true);
assert.equal(unavailable.nonDestructive,true);

assert.throws(()=>core.alignProfileEightCounts(profile,{bpm:0},{structureCore}),/bpm/);

console.log('cheer-eight-alignment-core tests passed');
