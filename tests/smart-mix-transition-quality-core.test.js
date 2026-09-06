const assert=require('assert');
const core=require('../smart-mix-transition-quality-core.js');

function step(sectionId,sectionType,startEight,endEight,score,features,boundary={}){
  return {sectionId,sectionType,candidate:{startEight,endEight,score,features,boundary},transition:{score:1,gapEights:0}};
}

const intro=step('intro','intro',1,4,.9,{averageEnergy:.42,entryTransitionStrength:.25,continuity:.9},{cutConfidence:.7});
const stunt=step('stunt','stunt',5,8,.92,{averageEnergy:.82,entryTransitionStrength:.92,continuity:.72},{dropConfidence:.95,cutConfidence:.8});
const strong=core.scoreTransition(intro,stunt);
assert.equal(strong.rating,'strong');
assert.ok(strong.score>.82);
assert.ok(strong.components.energy>.8);
assert.ok(strong.components.structure>.8);
assert.equal(strong.reasons.length,0);
assert.equal(strong.nonDestructive,true);

const flatStunt=step('stunt2','stunt',5,8,.9,{averageEnergy:.44,entryTransitionStrength:.08,continuity:.95},{});
const weak=core.scoreTransition(intro,flatStunt);
assert.ok(['weak','risky'].includes(weak.rating));
assert.ok(weak.components.energy<.55);
assert.ok(weak.components.structure<.55);
assert.ok(weak.reasons.includes('energy-mismatch'));
assert.ok(weak.reasons.includes('weak-break-drop-structure'));

const danceA=step('dance-a','dance',9,12,.88,{averageEnergy:.72,entryTransitionStrength:.2,continuity:.92},{cutConfidence:.72});
const danceB=step('dance-b','dance',13,16,.87,{averageEnergy:.70,entryTransitionStrength:.18,continuity:.94},{cutConfidence:.74});
const flow=core.scoreTransition(danceA,danceB);
assert.ok(flow.components.energy>.9);
assert.ok(flow.score>.68);

const gapped=step('ending','ending',25,28,.9,{averageEnergy:.9,entryTransitionStrength:.9,continuity:.7},{dropConfidence:.9});
gapped.transition={score:.35,gapEights:8};
const gapQuality=core.scoreTransition(danceB,gapped);
assert.ok(gapQuality.components.timing<.6);
assert.ok(gapQuality.reasons.includes('timing-gap'));

const sequence=core.evaluateSequence([intro,stunt,danceA,danceB]);
assert.equal(sequence.transitions.length,3);
assert.ok(sequence.averageScore>0&&sequence.averageScore<=1);
assert.ok(sequence.weakestTransition);
assert.equal(sequence.nonDestructive,true);
assert.equal(sequence.transitions[0].fromSectionId,'intro');
assert.equal(sequence.transitions[0].toSectionId,'stunt');

const missing=core.scoreTransition(intro,{sectionId:'missing',candidate:null});
assert.equal(missing.rating,'unavailable');
assert.deepEqual(missing.reasons,['missing-candidate']);

console.log('smart-mix-transition-quality-core tests passed');
