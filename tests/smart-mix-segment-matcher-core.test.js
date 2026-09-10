const assert=require('assert');
const core=require('../smart-mix-segment-matcher-core.js');

const profile=[];
for(let eight=1;eight<=16;eight++){
  let energy=.35,activity=.45,delta=0,crestDb=9;
  if(eight>=5&&eight<=8){energy=.62+(eight-5)*.08;activity=.72;crestDb=13;delta=eight===5?.28:.08;}
  if(eight>=9&&eight<=12){energy=.88;activity=.68;crestDb=15;delta=eight===9?.30:0;}
  if(eight>=13){energy=.55;activity=.86;crestDb=10;delta=eight===13?-.33:0;}
  profile.push({sourceName:'track-a.wav',trackId:'track-a',eight,start:(eight-1)*3.2,end:eight*3.2,energyScore:energy,activity,crestDb,energyDelta:delta});
}

const stunt={id:'stunt',type:'stunt',energy:'peak',energyTrend:'steady',durationEights:4};
const dance={id:'dance',type:'dance',energy:'high',energyTrend:'steady',durationEights:4};

const stuntRanks=core.rankSegments(stunt,profile,{limit:3});
assert.equal(stuntRanks[0].sourceName,'track-a.wav');
assert.equal(stuntRanks[0].trackId,'track-a');
assert.equal(stuntRanks[0].startEight,9);
assert.equal(stuntRanks[0].endEight,12);
assert.ok(stuntRanks[0].score>stuntRanks[1].score);
assert.ok(stuntRanks[0].components.energy>.9);
assert.equal(stuntRanks[0].transitionIntent,'drop');
assert.equal(stuntRanks[0].features.entryTransitionType,'drop');

const danceRanks=core.rankSegments(dance,profile,{limit:3});
assert.equal(danceRanks[0].startEight,13);
assert.equal(danceRanks[0].endEight,16);
assert.ok(danceRanks[0].components.activity>.9);

const plan=core.matchPlanSections([stunt,dance],profile,{avoidReuse:true,minScore:.4});
assert.equal(plan.matchedSections,2);
assert.equal(plan.coverage,1);
assert.equal(plan.matches[0].best.startEight,9);
assert.equal(plan.matches[1].best.startEight,13);
assert.equal(plan.nonDestructive,true);
assert.ok(plan.averageScore>.6);

const reused=core.matchPlanSections([stunt,stunt],profile,{avoidReuse:true,minScore:.4});
assert.notEqual(reused.matches[0].best.startEight,reused.matches[1].best.startEight);

const sparse=profile.filter(r=>r.eight!==7);
assert.equal(core.candidateSegments(sparse,4).some(c=>c.startEight===5),false);

const secondTrack=profile.slice(0,4).map(row=>({...row,sourceName:'track-b.wav',trackId:'track-b'}));
const multiTrack=[...profile.slice(0,4),...secondTrack];
const candidates=core.candidateSegments(multiTrack,4);
assert.equal(candidates.length,2,'each source track should produce its own candidate');
assert.deepEqual(candidates.map(c=>c.trackId).sort(),['track-a','track-b']);
assert.ok(candidates.every(c=>c.startEight===1&&c.endEight===4));

const crossSource=core.candidateSegments([
  {...profile[0],sourceName:'track-a.wav',trackId:'track-a'},
  {...profile[1],sourceName:'track-b.wav',trackId:'track-b'},
  {...profile[2],sourceName:'track-b.wav',trackId:'track-b'},
  {...profile[3],sourceName:'track-b.wav',trackId:'track-b'}
],4);
assert.equal(crossSource.length,0,'candidate must never cross source-track boundary');

const sameEightDifferentTracks=core.matchPlanSections([stunt,stunt],[...profile,...profile.map(row=>({...row,sourceName:'track-b.wav',trackId:'track-b'}))],{avoidReuse:true,minScore:.4});
assert.equal(sameEightDifferentTracks.matchedSections,2);
assert.notEqual(sameEightDifferentTracks.matches[0].best.trackId,sameEightDifferentTracks.matches[1].best.trackId,'reuse guard must be source-aware');

const dropRows=[
  {sourceName:'drop.wav',trackId:'drop',eight:1,start:0,end:3.2,energyScore:.90,activity:.62,crestDb:14,energyDelta:.35},
  {sourceName:'drop.wav',trackId:'drop',eight:2,start:3.2,end:6.4,energyScore:.90,activity:.62,crestDb:14,energyDelta:0}
];
const breakRows=[
  {sourceName:'break.wav',trackId:'break',eight:1,start:0,end:3.2,energyScore:.90,activity:.62,crestDb:14,energyDelta:-.35},
  {sourceName:'break.wav',trackId:'break',eight:2,start:3.2,end:6.4,energyScore:.90,activity:.62,crestDb:14,energyDelta:0}
];

assert.deepEqual(core.classifyEntryTransition(dropRows),{type:'drop',strength:.7,delta:.35});
assert.deepEqual(core.classifyEntryTransition(breakRows),{type:'break',strength:.7,delta:-.35});
assert.equal(core.transitionIntent(stunt),'drop');
assert.equal(core.transitionIntent({type:'transition'}),'break');
assert.equal(core.transitionIntent(dance),'neutral');

const stuntDropScore=core.scoreSegment({...stunt,durationEights:2},dropRows);
const stuntBreakScore=core.scoreSegment({...stunt,durationEights:2},breakRows);
assert.ok(stuntDropScore.components.transition>stuntBreakScore.components.transition,'stunt should prefer a drop entry over a break entry');

const transitionSection={id:'transition',type:'transition',energy:'medium',energyTrend:'steady',durationEights:2};
const transitionDropScore=core.scoreSegment(transitionSection,dropRows);
const transitionBreakScore=core.scoreSegment(transitionSection,breakRows);
assert.ok(transitionBreakScore.components.transition>transitionDropScore.components.transition,'transition should prefer a break entry over a drop entry');

const aligned=core.phraseBoundaryFit(5,8);
assert.deepEqual(aligned,{phraseEights:4,startAligned:true,endAligned:true,aligned:true,score:1});
const midPhrase=core.phraseBoundaryFit(6,9);
assert.equal(midPhrase.aligned,false);
assert.equal(midPhrase.score,.2);

const uniform=Array.from({length:8},(_,i)=>({
  sourceName:'uniform.wav',trackId:'uniform',eight:i+1,start:i*3.2,end:(i+1)*3.2,
  energyScore:.6,activity:.62,crestDb:11,energyDelta:0
}));
const phraseRanks=core.rankSegments({type:'other',energy:'medium',energyTrend:'steady',durationEights:4},uniform,{limit:5});
assert.equal(phraseRanks[0].startEight,1,'equal musical candidates should prefer a complete phrase boundary');
assert.equal(phraseRanks[0].endEight,4);
assert.equal(phraseRanks[0].phraseBoundary.aligned,true);
assert.ok(phraseRanks[0].score>phraseRanks.find(row=>row.startEight===2).score,'mid-phrase candidate must receive a boundary penalty');

const legacyPhraseRanks=core.rankSegments({type:'other',energy:'medium',energyTrend:'steady',durationEights:4},uniform,{limit:5,preferPhraseBoundaries:false});
assert.equal(legacyPhraseRanks[0].score,legacyPhraseRanks[0].baseScore,'preference can be disabled without changing base scoring');

const shortSectionRanks=core.rankSegments({type:'transition',energy:'medium',energyTrend:'steady',durationEights:2},uniform,{limit:3});
assert.ok(shortSectionRanks.length>0,'short sections must retain candidates even when both phrase edges cannot align');
assert.equal(shortSectionRanks[0].phraseBoundary.startAligned,true,'short sections should prefer entering on a phrase boundary');

console.log('smart-mix-segment-matcher-core tests passed');
