const assert=require('assert');
const core=require('../smart-mix-structural-boundary-core.js');

const phrases=[
  {phrase:1,startEight:1,endEight:4,confidence:.91,sourceName:'a.wav',trackId:'a'},
  {phrase:2,startEight:5,endEight:9,confidence:.88,sourceName:'a.wav',trackId:'a'},
  {phrase:3,startEight:10,endEight:12,confidence:.50,sourceName:'a.wav',trackId:'a'}
];
const sections=[
  {id:'stunt-a',startEight:5,endEight:8,confidence:.95,sourceName:'a.wav',trackId:'a'},
  {id:'dance-b',startEight:1,endEight:4,confidence:.97,sourceName:'b.wav',trackId:'b'}
];

const usable=core.detectedBoundaries({phrases,sections,minConfidence:.72});
assert.equal(usable.length,4,'low-confidence phrase must be excluded');
assert.equal(usable.some(row=>row.startEight===10),false);

const exact=core.structuralBoundaryFit(
  {startEight:5,endEight:8,sourceName:'a.wav',trackId:'a'},
  {phrases,sections,minConfidence:.72}
);
assert.equal(exact.source,'detected');
assert.equal(exact.start.matched,true);
assert.equal(exact.start.kind,'section','section boundary gets priority when stronger');
assert.equal(exact.end.matched,true);
assert.equal(exact.end.kind,'section');
assert.ok(exact.score>.9);

const phraseExact=core.structuralBoundaryFit(
  {startEight:1,endEight:4,sourceName:'a.wav',trackId:'a'},
  {phrases,sections,minConfidence:.72}
);
assert.equal(phraseExact.start.kind,'phrase');
assert.equal(phraseExact.end.kind,'phrase');
assert.ok(phraseExact.score>.8);

const mid=core.structuralBoundaryFit(
  {startEight:2,endEight:3,sourceName:'a.wav',trackId:'a'},
  {phrases,sections,minConfidence:.72}
);
assert.equal(mid.source,'detected');
assert.equal(mid.start.matched,false);
assert.equal(mid.end.matched,false);
assert.equal(mid.score,.15);

const otherTrack=core.structuralBoundaryFit(
  {startEight:5,endEight:8,sourceName:'c.wav',trackId:'c'},
  {phrases,sections,minConfidence:.72}
);
assert.equal(otherTrack.source,'fallback','boundaries from another source must not influence a track');
assert.equal(otherTrack.score,null);

const lowConfidenceOnly=core.structuralBoundaryFit(
  {startEight:10,endEight:12,sourceName:'a.wav',trackId:'a'},
  {phrases:[phrases[2]],sections:[],minConfidence:.72}
);
assert.equal(lowConfidenceOnly.source,'fallback');
assert.equal(lowConfidenceOnly.score,null);

const noDetected=core.structuralBoundaryFit(
  {startEight:1,endEight:4,trackId:'a'},
  {phrases:[],sections:[]}
);
assert.equal(noDetected.source,'fallback');
assert.equal(noDetected.score,null);

console.log('smart-mix-structural-boundary-core tests passed');
