const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('competition-master-final-check-refresh-ui-sync.js','utf8');
const workflow=fs.readFileSync('simple-workflow.js','utf8');

assert.ok(/cheer-competition-master-final-check-refreshed/.test(source),'sync must listen to the dedicated final-check refresh event');
assert.ok(/status==='refreshed'/.test(source),'sync must only accept completed refresh results');
assert.ok(/current-project-offline-render/.test(source),'sync must require a current-project offline-render source');
assert.ok(/nonDestructive===true/.test(source),'sync must require the non-destructive refresh contract');
assert.ok(/detail\.finalCheck/.test(source),'sync must require a newly formed final-check result');
assert.ok(/cheerCompetitionMasterAssessment/.test(source)&&/assessment\.render\(\)/.test(source),'sync must reuse the existing assessment renderer instead of duplicating it');
assert.ok(/cheerCompetitionMasterClarityResolutionUI/.test(source)&&/refreshAll/.test(source),'sync must rebuild clarity resolution state after the assessment rerender');
assert.ok(/cheerCompetitionMasterFinalCheckRefresh/.test(source)&&/refreshButtonState/.test(source),'sync must refresh the final-check refresh control after applying the new result');
assert.ok(!/renderProject|measureCompetitionMaster|measureCompetitionClarity|evaluateCompetitionMasterReadiness/.test(source),'UI sync must not perform rendering or measurement itself');
assert.ok(!/normalize|DynamicsCompressor|createGain|applyMasterHeadroom|encodeWav/i.test(source),'UI sync must not perform mastering or export processing');
assert.ok(!/finalCheck\.status\s*=|riskFlags\s*=|sectionIssues\s*=/.test(source),'UI sync must not fabricate or mutate final-check decisions');

assert.ok(/competition-master-final-check-refresh-ui-sync\.js\?v=5\.0p3k/.test(workflow),'simple workflow must load the refreshed final-check assessment sync with an explicit cache version');
assert.ok(/data-competition-master-final-check-refresh-ui-sync/.test(workflow),'refreshed final-check assessment sync loader must prevent duplicate insertion');
const assessmentIndex=workflow.indexOf('loadCompetitionMasterAssessment();');
const resolutionIndex=workflow.indexOf('loadCompetitionMasterClarityResolutionUI();');
const refreshIndex=workflow.indexOf('loadCompetitionMasterFinalCheckRefresh();');
const syncIndex=workflow.indexOf('loadCompetitionMasterFinalCheckRefreshUISync();');
assert.ok(assessmentIndex>=0&&resolutionIndex>assessmentIndex&&refreshIndex>resolutionIndex&&syncIndex>refreshIndex,'sync must load only after assessment, clarity resolution UI and final-check refresh');

console.log('competition-master-final-check-refresh-ui-sync: refreshed final-check safely rerenders the existing assessment and clarity state');
