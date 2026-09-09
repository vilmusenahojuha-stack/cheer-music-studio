const assert=require('assert');
const {PROFILE,normalizeSections,overlapSeconds,buildSectionClarity}=require('../competition-master-section-clarity-core');

const clarity={
  voiceover:{items:[
    {id:'vo-stunt',start:1,end:1.5,score:.84},
    {id:'vo-dance',start:5,end:5.4,score:.61},
    {id:'vo-dance-2',start:6,end:6.3,score:.67}
  ]},
  fx:{items:[
    {id:'fx-stunt',start:2,end:2.2,score:.76},
    {id:'fx-ending',start:8.1,end:8.35,score:.55}
  ]}
};
const sections=[
  {id:'stunt',label:'Stunt',type:'stunt',start:0,end:3,energy:.8},
  {id:'dance',label:'Dance',type:'dance',start:3,end:7,energy:.9},
  {id:'ending',label:'Ending',type:'ending',start:7,end:10,energy:1}
];

{
  const result=buildSectionClarity(clarity,sections,{durationSeconds:10});
  assert.equal(result.kind,'cheer-competition-master-section-clarity');
  assert.equal(result.version,2);
  assert.equal(result.stage,'post-voiceover-mix');
  assert.equal(result.nonDestructive,true);
  assert.equal(result.sections.length,3);
  assert.equal(result.sections[0].status,'clear');
  assert.equal(result.sections[0].voiceover.ready,true);
  assert.equal(result.sections[0].fx.ready,true);
  assert.equal(result.sections[1].status,'review-required');
  assert(result.sections[1].riskFlags.includes('section-voiceover-clarity-failed'));
  assert.equal(result.sections[1].voiceover.itemsMeasured,2);
  assert.deepEqual(result.sections[1].voiceover.weakestItem,{id:'vo-dance',start:5,end:5.4,score:.61,sectionOverlapSeconds:.4});
  assert.equal(result.sections[2].status,'review-required');
  assert(result.sections[2].riskFlags.includes('section-fx-clarity-failed'));
  assert.deepEqual(result.sections[2].fx.weakestItem,{id:'fx-ending',start:8.1,end:8.35,score:.55,sectionOverlapSeconds:.25});
  assert.equal(result.summary.sectionsMeasured,3);
  assert.equal(result.summary.sectionsReviewRequired,2);
  assert.equal(result.summary.weakestSectionId,'ending');
  assert.equal(result.summary.weakestSectionLabel,'Ending');
  assert.equal(result.summary.status,'review-required');
}
{
  const normalized=normalizeSections([{id:'a',startSeconds:1,durationSeconds:4}],3);
  assert.deepEqual(normalized,[{id:'a',label:'Section 1',type:'section',start:1,end:3,energy:null}]);
  assert.equal(overlapSeconds({start:.5,end:1.5},{start:1,end:2}),.5);
}
{
  const result=buildSectionClarity({voiceover:{items:[]},fx:{items:[]}},sections);
  assert.equal(result.summary.status,'unmeasured');
  assert.equal(result.summary.weakestSectionId,null);
  assert(result.sections.every(section=>section.status==='unmeasured'));
  assert(result.sections.every(section=>section.voiceover.weakestItem===null&&section.fx.weakestItem===null));
}
{
  const crossing={voiceover:{items:[{id:'cross',start:2.8,end:3.6,score:.8}]},fx:{items:[]}};
  const result=buildSectionClarity(crossing,sections);
  assert.equal(result.sections.find(section=>section.id==='dance').voiceover.itemsMeasured,1);
  assert.equal(result.sections.find(section=>section.id==='stunt').voiceover.itemsMeasured,0);
}
assert.equal(PROFILE.id,'fi-cheer-master-section-clarity-v2');
console.log('competition-master-section-clarity-core tests passed');
