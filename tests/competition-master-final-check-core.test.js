const assert=require('assert');
const {PROFILE,buildCompetitionMasterFinalCheck}=require('../competition-master-final-check-core');

function readiness(status='preview-ready',riskFlags=[]){
  return {kind:'cheer-competition-master-readiness',status,riskFlags};
}
function preview(status='preview-ready',actions=[],riskFlags=[]){
  return {kind:'cheer-competition-master-preview',status,actions,riskFlags,preview:{renderAllowed:false}};
}
function metrics(extra={}){
  return {truePeakDbtp:-1.3,loudnessRangeLu:5.2,sectionPeaksDb:[-2.4,-2.1,-2.7],voiceoverClarityScore:0.86,fxClarityScore:0.8,...extra};
}

{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics()});
  assert.equal(result.status,'preview-approved');
  assert.equal(result.summary.finalReady,true);
  assert.equal(result.renderAllowed,false);
  assert.equal(result.executable,false);
  assert.equal(PROFILE.advisoryOnly,true);
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({truePeakDbtp:-0.3})});
  assert.equal(result.status,'review-required');
  assert(result.riskFlags.includes('final-true-peak-headroom-failed'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({loudnessRangeLu:2.2})});
  assert(result.riskFlags.includes('final-dynamics-check-failed'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({sectionPeaksDb:[-8,-2]})});
  assert(result.riskFlags.includes('final-section-balance-failed'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({voiceoverClarityScore:0.5})});
  assert(result.riskFlags.includes('final-voiceover-clarity-failed'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({fxClarityScore:0.5})});
  assert(result.riskFlags.includes('final-fx-clarity-failed'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview('review-required',[{type:'pre-master-hold'}]),metrics:metrics()});
  assert(result.riskFlags.includes('final-preview-hold-active'));
  assert(result.riskFlags.includes('final-upstream-review-required'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({voiceoverClarityScore:null})});
  assert(result.riskFlags.includes('final-voiceover-clarity-unmeasured'));
}

assert.equal(buildCompetitionMasterFinalCheck({}).reason,'master-preview-required');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview('blocked')}).reason,'master-preview-blocked');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview()}).reason,'master-readiness-required');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview(),readiness:readiness('blocked')}).reason,'master-readiness-blocked');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview(),readiness:readiness()}).reason,'master-metrics-required');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview(),readiness:readiness(),metrics:metrics({truePeakDbtp:null})}).reason,'true-peak-required');

console.log('competition-master-final-check-core tests passed');
