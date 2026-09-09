const assert=require('assert');
const {PROFILE,buildCompetitionMasterInput,toCompetitionMasterReadinessInput}=require('../competition-master-input-core');
const {buildCompetitionMasterReadiness}=require('../competition-master-readiness-core');
const {buildCompetitionMasterFinalCheck}=require('../competition-master-final-check-core');

function voiceover(status='preview-ready',selected=[]){
  return {kind:'cheer-voiceover-competition-package',status,selected};
}
function preview(status='preview-ready'){
  return {kind:'cheer-competition-master-preview',status,actions:[],riskFlags:[],preview:{renderAllowed:false}};
}

{
  const sectionClarity={kind:'cheer-competition-master-section-clarity',summary:{status:'clear',weakestSectionLabel:'Stunt'}};
  const clarityMeasurement={method:'post-mix-local-rms-contrast-v1',voiceoverWindows:2,fxWindows:3};
  const result=buildCompetitionMasterInput({
    postVoiceoverMetrics:{
      stage:'post-voiceover-mix',
      truePeakDbtp:-1.6,
      loudnessRangeLu:5.4,
      integratedLufs:-10.8,
      sectionPeaksDb:[-3.2,-2.1,-1.9],
      voiceoverClarityScore:.84,
      fxClarityScore:.79,
      clarityMeasurement,
      sectionClarity
    },
    voiceoverPackage:voiceover()
  });
  assert.equal(result.status,'ready');
  assert.equal(result.metrics.headroomDb,1.6);
  assert.equal(result.metrics.voiceoverClarityScore,.84);
  assert.equal(result.metrics.fxClarityScore,.79);
  assert.equal(result.metrics.clarityMeasurement,clarityMeasurement);
  assert.equal(result.metrics.sectionClarity,sectionClarity);
  assert.equal(result.nextStep,'competition-master-readiness');
  assert.equal(result.executable,false);
  assert.equal(PROFILE.nonDestructive,true);

  const readinessInput=toCompetitionMasterReadinessInput(result);
  const readiness=buildCompetitionMasterReadiness(readinessInput);
  assert.equal(readiness.status,'preview-ready');
  assert.equal(readiness.checks.truePeak.valueDbtp,-1.6);
  assert.equal(readiness.checks.loudnessRange.valueLu,5.4);

  const finalCheck=buildCompetitionMasterFinalCheck({readiness,preview:preview(),metrics:result.metrics});
  assert.equal(finalCheck.checks.voiceoverClarity.score,.84);
  assert.equal(finalCheck.checks.voiceoverClarity.ready,true);
  assert.equal(finalCheck.checks.fxClarity.score,.79);
  assert.equal(finalCheck.checks.fxClarity.ready,true);
  assert(!finalCheck.riskFlags.includes('final-voiceover-clarity-unmeasured'));
  assert(!finalCheck.riskFlags.includes('final-fx-clarity-unmeasured'));
}

{
  const result=buildCompetitionMasterInput({
    mixMetrics:{truePeakDbtp:-0.4,loudnessRangeLu:5.4},
    voiceoverPackage:voiceover()
  });
  assert.equal(result.status,'review-required');
  assert(result.riskFlags.includes('insufficient-post-voiceover-headroom'));
  assert.equal(result.nextStep,'resolve-post-voiceover-risks');

  const readiness=buildCompetitionMasterReadiness(toCompetitionMasterReadinessInput(result));
  assert.equal(readiness.status,'review-required');
  assert(readiness.riskFlags.includes('insufficient-true-peak-headroom'));
}

{
  const result=buildCompetitionMasterInput({
    metrics:{truePeakDbtp:-1.4,loudnessRangeLu:5.1},
    voiceoverPackage:voiceover('review-required',[{status:'review-required'}])
  });
  assert.equal(result.status,'review-required');
  assert(result.riskFlags.includes('voiceover-review-required-before-master'));
}

assert.equal(buildCompetitionMasterInput({}).reason,'post-voiceover-metrics-required');
assert.equal(buildCompetitionMasterInput({
  metrics:{truePeakDbtp:-1.2,loudnessRangeLu:5},
  stage:'pre-voiceover-mix',
  voiceoverPackage:voiceover()
}).reason,'post-voiceover-stage-required');
assert.equal(buildCompetitionMasterInput({metrics:{truePeakDbtp:-1.2,loudnessRangeLu:5}}).reason,'voiceover-package-required');
assert.equal(toCompetitionMasterReadinessInput({kind:'cheer-competition-master-input',status:'blocked'}),null);

console.log('competition master input core tests passed');
