const assert=require('assert');
const {PROFILE,buildCompetitionMasterReadiness}=require('../competition-master-readiness-core');

function voiceover(status='preview-ready',selected=[]){
  return {kind:'cheer-voiceover-competition-package',status,selected};
}

{
  const result=buildCompetitionMasterReadiness({
    metrics:{truePeakDbtp:-1.4,loudnessRangeLu:5.2,sectionPeaksDb:[-3.2,-2.1,-1.8,-2.4]},
    voiceoverPackage:voiceover()
  });
  assert.equal(result.status,'preview-ready');
  assert.equal(result.checks.truePeak.ready,true);
  assert.equal(result.checks.loudnessRange.ready,true);
  assert.equal(result.preview.nextStep,'master-preview-can-be-planned');
  assert.equal(result.executable,false);
  assert.equal(PROFILE.advisoryOnly,true);
}

{
  const result=buildCompetitionMasterReadiness({metrics:{truePeakDbtp:-0.2,loudnessRangeLu:5,sectionPeaksDb:[-2,-2.5]},voiceoverPackage:voiceover()});
  assert.equal(result.status,'review-required');
  assert(result.riskFlags.includes('insufficient-true-peak-headroom'));
  assert(result.recommendations.includes('create-peak-headroom'));
}

{
  const result=buildCompetitionMasterReadiness({metrics:{truePeakDbtp:-1.3,loudnessRangeLu:2.2,sectionPeaksDb:[-2,-2.4]},voiceoverPackage:voiceover()});
  assert(result.riskFlags.includes('master-overcompressed'));
  assert(result.recommendations.includes('restore-macro-dynamics'));
}

{
  const result=buildCompetitionMasterReadiness({metrics:{truePeakDbtp:-1.3,loudnessRangeLu:5,sectionPeaksDb:[-8,-2]},voiceoverPackage:voiceover()});
  assert(result.riskFlags.includes('section-peak-balance-wide'));
  assert(result.recommendations.includes('rebalance-section-peaks'));
}

{
  const result=buildCompetitionMasterReadiness({metrics:{truePeakDbtp:-1.3,loudnessRangeLu:5,sectionPeaksDb:[-2,-2.5]},voiceoverPackage:voiceover('review-required',[{status:'review-required'}])});
  assert(result.riskFlags.includes('voiceover-master-review-required'));
  assert(result.recommendations.includes('resolve-voiceover-review-before-master'));
}

assert.equal(buildCompetitionMasterReadiness({}).reason,'master-metrics-required');
assert.equal(buildCompetitionMasterReadiness({metrics:{truePeakDbtp:-1.2,loudnessRangeLu:5}}).reason,'voiceover-package-required');
assert.equal(buildCompetitionMasterReadiness({metrics:{truePeakDbtp:-1.2,loudnessRangeLu:5},voiceoverPackage:voiceover('blocked')}).reason,'voiceover-package-blocked');

console.log('competition-master-readiness-core tests passed');
