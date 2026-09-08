const assert=require('assert');
const {PROFILE,buildCompetitionMasterInput,toCompetitionMasterReadinessInput}=require('../competition-master-input-core');
const {buildCompetitionMasterReadiness}=require('../competition-master-readiness-core');

function voiceover(status='preview-ready',selected=[]){
  return {kind:'cheer-voiceover-competition-package',status,selected};
}

{
  const result=buildCompetitionMasterInput({
    postVoiceoverMetrics:{
      stage:'post-voiceover-mix',
      truePeakDbtp:-1.6,
      loudnessRangeLu:5.4,
      integratedLufs:-10.8,
      sectionPeaksDb:[-3.2,-2.1,-1.9]
    },
    voiceoverPackage:voiceover()
  });
  assert.equal(result.status,'ready');
  assert.equal(result.metrics.headroomDb,1.6);
  assert.equal(result.nextStep,'competition-master-readiness');
  assert.equal(result.executable,false);
  assert.equal(PROFILE.nonDestructive,true);

  const readinessInput=toCompetitionMasterReadinessInput(result);
  const readiness=buildCompetitionMasterReadiness(readinessInput);
  assert.equal(readiness.status,'preview-ready');
  assert.equal(readiness.checks.truePeak.valueDbtp,-1.6);
  assert.equal(readiness.checks.loudnessRange.valueLu,5.4);
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
