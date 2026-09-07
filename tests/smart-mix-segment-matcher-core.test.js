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

console.log('smart-mix-segment-matcher-core tests passed');
