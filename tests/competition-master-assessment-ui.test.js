const assert=require('node:assert/strict');
const fs=require('node:fs');

const ui=fs.readFileSync('competition-master-assessment-ui.js','utf8');
const workflow=fs.readFileSync('simple-workflow.js','utf8');

assert.ok(/getLastCompetitionMasterMetrics/.test(ui),'assessment UI must read measured competition master metrics from export API');
assert.ok(/getLastCompetitionMasterReadiness/.test(ui),'assessment UI must read competition readiness from export API');
assert.ok(/getLastCompetitionMasterPreview/.test(ui),'assessment UI must read advisory master preview from export API');
assert.ok(/getLastCompetitionMasterFinalCheck/.test(ui),'assessment UI must read the final-check result from export API');
assert.ok(/True peak/.test(ui)&&/Integrated loudness/.test(ui)&&/LRA/.test(ui),'assessment UI must surface true peak, integrated loudness and LRA');
assert.ok(/preview-ready/.test(ui)&&/preview-approved/.test(ui)&&/review-required/.test(ui)&&/blocked/.test(ui),'assessment UI must distinguish ready, final-check approved, review-required and blocked states');
assert.ok(/voiceover-hold/.test(ui)&&/peak-headroom/.test(ui)&&/section-balance/.test(ui),'assessment UI must translate key competition-master recommendations for the user');
assert.ok(/Osakohtaiset clarity-havainnot/.test(ui),'assessment UI must provide a dedicated section-aware clarity findings area');
assert.ok(/sectionIssues/.test(ui),'assessment UI must render section issues produced by competition final-check');
assert.ok(/voiceover clarity/.test(ui)&&/FX clarity/.test(ui),'assessment UI must identify whether voiceover or FX clarity failed in a cheer section');
assert.ok(/sectionId/.test(ui)&&/data.*section/i.test(ui),'section-aware findings must retain the source section identity for later editor navigation');
assert.ok(/Final-check ei löytänyt kilpailumasteria estäviä riskejä/.test(ui),'approved final-check must have a clear non-destructive user-facing state');
assert.ok(/ei-tuhoava tarkistus/.test(ui),'assessment UI must clearly communicate non-destructive behavior');
assert.ok(!/applyMasterHeadroom|fromAudioBuffer|renderProject|createGain|DynamicsCompressor|normalize/i.test(ui.replace(/normalisoi/g,'')),'assessment UI must not perform audio mastering or rendering');
assert.ok(/MutationObserver/.test(ui),'assessment UI must refresh when export status changes');
assert.ok(/competition-master-section-clarity-core\.js/.test(workflow),'simple workflow must load section-aware clarity before export analysis');
assert.ok(/data-competition-master-section-clarity/.test(workflow),'section-aware clarity loader must prevent duplicate script insertion');
assert.ok(/competition-master-assessment-ui\.js/.test(workflow),'simple workflow must load the assessment UI module');
assert.ok(/data-competition-master-assessment/.test(workflow),'assessment UI loader must prevent duplicate script insertion');
console.log('competition-master-assessment-ui: section-aware final-check findings are surfaced without modifying audio');
