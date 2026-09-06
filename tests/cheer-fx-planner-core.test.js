const assert=require('assert');
const core=require('../cheer-fx-planner-core.js');

const pkg={
  kind:'smart-mix-2-proposal-package',status:'preview-ready',bpm:152,
  editPlan:{actions:[
    {id:'drop-stunt',sourceDecisionId:'d1',type:'drop',eight:3,at:6.315,sectionId:'stunt',sectionType:'stunt',confidence:.92},
    {id:'build-pyramid',sourceDecisionId:'d2',type:'build',eight:8,at:14.21,sectionId:'pyramid',sectionType:'pyramid',confidence:.86},
    {id:'break-dance',sourceDecisionId:'d3',type:'break',eight:12,at:20.52,sectionId:'dance',sectionType:'dance',confidence:.8},
    {id:'cut-ending',sourceDecisionId:'d4',type:'cut',eight:16,at:26.84,sectionId:'ending',sectionType:'ending',confidence:.9},
    {id:'weak-drop',sourceDecisionId:'d5',type:'drop',eight:18,at:30,sectionType:'stunt',confidence:.4}
  ]}
};
const plan=core.createCheerFxPlan(pkg);
assert.equal(plan.kind,'cheer-fx-plan');
assert.equal(plan.status,'preview-ready');
assert.equal(plan.nonDestructive,true);
assert.equal(plan.executable,false);
assert.equal(plan.safePreviewOnly,true);
assert.equal(plan.events.length,4);
assert.deepEqual(plan.events.map(e=>e.kind),['impact','riser','downlifter','whoosh']);
assert.equal(plan.summary.impacts,1);
assert.equal(plan.summary.risers,1);
assert.equal(plan.summary.downlifters,1);
assert.equal(plan.summary.whooshes,1);
assert.equal(plan.events[0].eight,3);
assert.equal(plan.events[0].sectionType,'stunt');
assert(plan.events[0].priority>0.8);
assert.equal(plan.summary.readyForPreview,true);

const duplicatePkg={...pkg,editPlan:{actions:[
  {id:'a',type:'drop',eight:3,at:6.30,sectionType:'stunt',confidence:.9},
  {id:'b',type:'drop',eight:3,at:6.31,sectionType:'stunt',confidence:.8}
]}};
const deduped=core.createCheerFxPlan(duplicatePkg);
assert.equal(deduped.events.length,1);
assert.equal(deduped.events[0].sourceActionId,'a');

const reviewPkg={...pkg,status:'review-required'};
const review=core.createCheerFxPlan(reviewPkg);
assert.equal(review.status,'review-required');
assert(review.riskFlags.includes('source-package-review-required'));

const empty=core.createCheerFxPlan({...pkg,editPlan:{actions:[{id:'weak',type:'drop',eight:1,at:1,confidence:.2}]}});
assert.equal(empty.status,'review-required');
assert(empty.riskFlags.includes('no-confident-fx-anchors'));

const blocked=core.createCheerFxPlan({...pkg,status:'blocked'});
assert.equal(blocked.status,'blocked');
assert.equal(blocked.reason,'smart-mix-package-blocked');

const missing=core.createCheerFxPlan({});
assert.equal(missing.status,'blocked');
assert.equal(missing.reason,'smart-mix-package-required');

const noBpm=core.createCheerFxPlan({...pkg,bpm:null});
assert.equal(noBpm.status,'blocked');
assert.equal(noBpm.reason,'bpm-required');

const conflicts=core.detectConflicts([
  {kind:'impact',eight:5,at:10},
  {kind:'downlifter',eight:5,at:10.05}
]);
assert.equal(conflicts.length,1);
assert.equal(conflicts[0].type,'opposing-fx-at-same-anchor');

console.log('cheer-fx-planner-core tests passed');
