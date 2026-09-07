const assert=require('assert');
const {DEFAULTS,buildCompetitionMasterPreview}=require('../competition-master-preview-core');

function readiness(status='preview-ready',riskFlags=[],recommendations=[]){
  return {kind:'cheer-competition-master-readiness',status,riskFlags,recommendations};
}

{
  const result=buildCompetitionMasterPreview({
    readiness:readiness(),
    metrics:{truePeakDbtp:-1.4,loudnessRangeLu:5.1,sectionPeaksDb:[-2.5,-2.1,-2.8]}
  });
  assert.equal(result.status,'preview-ready');
  assert.equal(result.actions[0].type,'preserve-preview');
  assert.equal(result.preview.renderAllowed,false);
  assert.equal(result.executable,false);
  assert.equal(DEFAULTS.advisoryOnly,true);
}

{
  const result=buildCompetitionMasterPreview({
    readiness:readiness('review-required',['insufficient-true-peak-headroom'],['create-peak-headroom']),
    metrics:{truePeakDbtp:-0.2,loudnessRangeLu:5,sectionPeaksDb:[-2,-2.4]}
  });
  assert.equal(result.status,'review-required');
  const action=result.actions.find(x=>x.id==='peak-headroom');
  assert(action);
  assert.equal(action.suggestedDb,-0.8);
}

{
  const result=buildCompetitionMasterPreview({
    readiness:readiness('review-required',['master-overcompressed'],['restore-macro-dynamics']),
    metrics:{truePeakDbtp:-1.2,loudnessRangeLu:2.2,sectionPeaksDb:[-2,-2.4]}
  });
  assert(result.actions.some(x=>x.type==='dynamics-relief-preview'));
}

{
  const result=buildCompetitionMasterPreview({
    readiness:readiness('review-required',['section-peak-balance-wide'],['rebalance-section-peaks']),
    metrics:{truePeakDbtp:-1.2,loudnessRangeLu:5,sectionPeaksDb:[-8,-2]}
  });
  const action=result.actions.find(x=>x.type==='section-gain-balance-preview');
  assert(action);
  assert.equal(action.referenceDb,-5);
}

{
  const result=buildCompetitionMasterPreview({
    readiness:readiness('review-required',['voiceover-master-review-required'],['resolve-voiceover-review-before-master']),
    metrics:{truePeakDbtp:-1.2,loudnessRangeLu:5,sectionPeaksDb:[-2,-2.4]}
  });
  assert.equal(result.topPriority.type,'pre-master-hold');
  assert.equal(result.summary.nextStep,'review-master-preview');
}

assert.equal(buildCompetitionMasterPreview({}).reason,'master-readiness-required');
assert.equal(buildCompetitionMasterPreview({readiness:readiness('blocked')}).reason,'master-readiness-blocked');
assert.equal(buildCompetitionMasterPreview({readiness:readiness()}).reason,'master-metrics-required');
assert.equal(buildCompetitionMasterPreview({readiness:readiness(),metrics:{truePeakDbtp:null,loudnessRangeLu:5}}).reason,'true-peak-required');

console.log('competition-master-preview-core tests passed');
