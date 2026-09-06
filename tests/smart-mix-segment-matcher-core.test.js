const assert=require('assert');
const core=require('../smart-mix-segment-matcher-core.js');

const profile=[];
for(let eight=1;eight<=16;eight++){
  let energy=.35,activity=.45,delta=0,crestDb=9;
  if(eight>=5&&eight<=8){energy=.62+(eight-5)*.08;activity=.72;crestDb=13;delta=eight===5?.28:.08;}
  if(eight>=9&&eight<=12){energy=.88;activity=.68;crestDb=15;delta=eight===9?.30:0;}
  if(eight>=13){energy=.55;activity=.86;crestDb=10;delta=eight===13?-.33:0;}
  profile.push({eight,start:(eight-1)*3.2,end:eight*3.2,energyScore:energy,activity,crestDb,energyDelta:delta});
}

const stunt={id:'stunt',type:'stunt',energy:'peak',energyTrend:'steady',durationEights:4};
const dance={id:'dance',type:'dance',energy:'high',energyTrend:'steady',durationEights:4};

const stuntRanks=core.rankSegments(stunt,profile,{limit:3});
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

console.log('smart-mix-segment-matcher-core tests passed');
