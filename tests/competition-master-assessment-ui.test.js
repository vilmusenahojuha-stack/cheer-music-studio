const assert=require('node:assert/strict');
const fs=require('node:fs');

const ui=fs.readFileSync('competition-master-assessment-ui.js','utf8');
const workflow=fs.readFileSync('simple-workflow.js','utf8');

assert.ok(/getLastCompetitionMasterMetrics/.test(ui),'assessment UI must read measured competition master metrics from export API');
assert.ok(/getLastCompetitionMasterReadiness/.test(ui),'assessment UI must read competition readiness from export API');
assert.ok(/getLastCompetitionMasterPreview/.test(ui),'assessment UI must read advisory master preview from export API');
assert.ok(/True peak/.test(ui)&&/Integrated loudness/.test(ui)&&/LRA/.test(ui),'assessment UI must surface true peak, integrated loudness and LRA');
assert.ok(/preview-ready/.test(ui)&&/review-required/.test(ui)&&/blocked/.test(ui),'assessment UI must distinguish ready, review-required and blocked states');
assert.ok(/voiceover-hold/.test(ui)&&/peak-headroom/.test(ui)&&/section-balance/.test(ui),'assessment UI must translate key competition-master recommendations for the user');
assert.ok(/ei-tuhoava tarkistus/.test(ui),'assessment UI must clearly communicate non-destructive behavior');
assert.ok(!/applyMasterHeadroom|fromAudioBuffer|renderProject|createGain|DynamicsCompressor|normalize/i.test(ui.replace(/normalisoi/g,'')),'assessment UI must not perform audio mastering or rendering');
assert.ok(/MutationObserver/.test(ui),'assessment UI must refresh when export status changes');
assert.ok(/competition-master-assessment-ui\.js/.test(workflow),'simple workflow must load the assessment UI module');
assert.ok(/data-competition-master-assessment/.test(workflow),'assessment UI loader must prevent duplicate script insertion');
console.log('competition-master-assessment-ui: advisory export metrics/readiness/preview are surfaced without modifying audio');
