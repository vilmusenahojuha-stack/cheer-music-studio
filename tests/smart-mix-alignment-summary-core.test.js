const assert=require('assert');
const core=require('../smart-mix-alignment-summary-core.js');

function profile(name,alignment){
  const rows=[{sourceName:name,startEight:1,endEight:1}];
  Object.defineProperty(rows,'eightAlignment',{value:alignment,enumerable:false});
  return rows;
}

const summary=core.summarizeProfiles([
  profile('A.wav',{
    reliabilityLevel:'strong',
    confidence:.91,
    support:4,
    canAutoUse:true,
    reanalyzed:true,
    originalOneOffset:.1,
    oneOffset:.48
  }),
  profile('B.wav',{
    reliabilityLevel:'review',
    confidence:.73,
    support:2,
    needsReview:true,
    originalOneOffset:.2,
    oneOffset:.2
  }),
  profile('C.wav',{
    reliabilityLevel:'manual',
    confidence:.31,
    support:1,
    useManualCountOne:true,
    originalOneOffset:.3,
    oneOffset:.3
  })
]);

assert.equal(summary.nonDestructive,true);
assert.equal(summary.total,3);
assert.deepEqual(summary.counts,{strong:1,review:1,manual:1});
assert.equal(summary.allStrong,false);
assert.equal(summary.hasReview,true);
assert.equal(summary.hasManual,true);

assert.deepEqual(summary.tracks[0],{
  index:0,
  name:'A.wav',
  level:'strong',
  confidence:.91,
  support:4,
  canAutoUse:true,
  needsReview:false,
  useManualCountOne:false,
  reanalyzed:true,
  originalOneOffset:.1,
  oneOffset:.48
});

assert.equal(summary.tracks[1].needsReview,true);
assert.equal(summary.tracks[2].useManualCountOne,true);
assert.equal(core.statusText(summary),'8-count-kohdistus: 1 vahva · 1 tarkistettava · 1 manuaalinen.');
assert.equal(core.trackStatusText(summary.tracks[0]),'A.wav: vahva 8-count-kohdistus');
assert.equal(core.trackStatusText(summary.tracks[1]),'B.wav: tarkista 1-lasku');
assert.equal(core.trackStatusText(summary.tracks[2]),'C.wav: käytä manuaalista 1-laskua');

const unknown=core.summarizeProfiles([profile('Legacy.wav',{reliabilityLevel:'unexpected',canAutoUse:true})]);
assert.equal(unknown.tracks[0].level,'manual','unknown/legacy states must fail safe');
assert.equal(unknown.tracks[0].canAutoUse,false);

const empty=core.summarizeProfiles([]);
assert.equal(empty.total,0);
assert.equal(empty.allStrong,false);
assert.equal(core.statusText(empty),'8-count-kohdistusta ei ole vielä analysoitu.');

console.log('smart-mix-alignment-summary-core tests passed');
