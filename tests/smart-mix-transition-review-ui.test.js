const assert=require('assert');
const ui=require('../smart-mix-transition-review-ui.js');

const target={
  kind:'transition',
  fromSectionId:'stunt',
  toSectionId:'ending',
  reason:'weak-section-transition',
  severity:.69,
  evidence:{
    score:.31,
    energyDelta:{score:.42,targetDelta:0,actualDelta:-.3,error:.3},
    boundarySupport:.29,
    transitionSupport:.24,
    sourceSwitch:true,
    fromSource:'B',
    toSource:'C',
    reasons:['energy-jump-mismatch','weak-boundary','weak-transition-entry','source-switch-weak-handoff']
  }
};

const view=ui.buildTransitionReview(target);
assert.equal(view.available,true);
assert.equal(view.title,'Siirtymä stunt → ending · miksi tarkistettava');
assert.equal(view.scorePercent,31);
assert.equal(view.rows.length,4);
assert.deepEqual(view.rows.map(row=>row.code),['energyDelta','boundarySupport','transitionSupport','sourceSwitch']);
assert.equal(view.rows[0].value,'toteutunut -30% · tavoite 0%');
assert.equal(view.rows[0].scorePercent,42);
assert.equal(view.rows[1].value,'29%');
assert.equal(view.rows[2].value,'24%');
assert.equal(view.rows[3].value,'B → C');
assert.equal(view.issues.length,4);
assert.equal(view.issues[0].label,'Energiahyppy ei vastaa seuraavan osuuden tavoitetta');
assert.equal(view.issues[1].label,'Fraasi- tai leikkausraja on liian heikko');
assert.equal(view.issues[2].label,'Break/drop-sisääntulo ei tue siirtymää riittävästi');
assert.equal(view.issues[3].label,'Kappaleenvaihdon handoff on liian heikko');
assert.equal(view.nonDestructive,true);

const unknown=ui.buildTransitionReview({
  kind:'transition',fromSectionId:'a',toSectionId:'b',reason:'weak-section-transition',
  evidence:{reasons:['custom-transition-risk']}
});
assert.equal(unknown.available,true);
assert.equal(unknown.issues[0].label,'custom-transition-risk');

const wrongReason=ui.buildTransitionReview({kind:'transition',reason:'source-overuse'});
assert.equal(wrongReason.available,false);
assert.equal(wrongReason.nonDestructive,true);

const wrongKind=ui.buildTransitionReview({kind:'section',reason:'weak-section-transition'});
assert.equal(wrongKind.available,false);

const incomplete=ui.buildTransitionReview({
  kind:'transition',fromSectionId:'a',toSectionId:'b',reason:'weak-section-transition',evidence:{score:'bad'}
});
assert.equal(incomplete.available,false);
assert.equal(incomplete.scorePercent,null);

assert.equal(ui.renderTransitionReview(null,target),false);
assert.equal(ui.enhanceRow(null),false);

console.log('smart-mix transition review UI tests passed');
