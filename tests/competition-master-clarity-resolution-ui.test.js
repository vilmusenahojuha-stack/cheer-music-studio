const assert=require('node:assert/strict');
const fs=require('node:fs');

const ui=fs.readFileSync('competition-master-clarity-resolution-ui.js','utf8');
const workflow=fs.readFileSync('simple-workflow.js','utf8');

assert.ok(/cheer-competition-master-clarity-recheck/.test(ui),'resolution UI must react to the existing same-window recheck event');
assert.ok(/getResolution/.test(ui)&&/focusKey/.test(ui),'resolution UI must use the recheck module identity and stored resolution instead of inventing its own acceptance rule');
assert.ok(/sectionId/.test(ui)&&/focusKind/.test(ui)&&/focusStartSeconds/.test(ui)&&/focusEndSeconds/.test(ui),'resolution UI must identify the exact section, risk kind and measurement window');
assert.ok(/focusMinScore/.test(ui),'resolution lookup must retain the original acceptance threshold identity');
assert.ok(/resolution\?\.resolved===true/.test(ui)||/resolution\?\.resolved/.test(ui),'only an explicitly resolved recheck may close a finding');
assert.ok(/Tarkistettu – hyväksytty/.test(ui),'resolved risk must have a clear Finnish accepted label');
assert.ok(/voiceover clarity/.test(ui)&&/FX clarity/.test(ui),'resolved label handling must distinguish voiceover and FX risks');
assert.ok(/parts\.map/.test(ui)&&/part\.includes\(prefix\)/.test(ui),'only the matching focused risk segment may be replaced, leaving any other section risk visible');
assert.ok(/dataset\.originalLabel/.test(ui),'original open finding label must be retained so a later failed recheck can reopen it');
assert.ok(/dataset\.resolution=.*open/.test(ui)||/resolved\?'resolved':'open'/.test(ui),'UI must expose both resolved and reopened states');
assert.ok(/badge\?\.remove/.test(ui),'a reopened finding must remove its accepted badge');
assert.ok(/competition-master-section-guidance\{display:none\}/.test(ui),'resolved focused risk must stop presenting its old correction guidance as an open warning');

assert.ok(/function riskCountForItem/.test(ui)&&/voiceover clarity/.test(ui)&&/FX clarity/.test(ui),'summary must count individual voiceover and FX clarity risks rather than only section rows');
assert.ok(/function resolutionCounts/.test(ui)&&/total-resolved/.test(ui),'summary must derive open risk count from total risks minus only safely resolved focused risks');
assert.ok(/competitionMasterClarityResolutionSummary/.test(ui),'assessment must expose a dedicated clarity resolution summary');
assert.ok(/\$\{counts\.open\} avoinna · \$\{counts\.resolved\} tarkistettu/.test(ui),'summary must show concise Finnish open and checked counts');
assert.ok(/data-open|dataset\.open/.test(ui)&&/dataset\.resolved/.test(ui)&&/dataset\.total/.test(ui),'summary must expose deterministic open, resolved and total counts for UI state and tests');
assert.ok(/Laskuri ei muuta kilpailumasterin final-check-hyväksyntää/.test(ui),'summary accessibility text must explicitly state that counting does not approve the global final check');
assert.ok(/updateSummary\(\)/.test(ui),'summary must refresh after recheck state changes');

assert.ok(!/getLastCompetitionMasterFinalCheck|finalCheck\s*=|sectionIssues\s*=|preview-approved/.test(ui),'resolution UI must not rewrite final-check, section issue arrays or global approval state');
assert.ok(!/renderProject|applyMasterHeadroom|createGain|DynamicsCompressor|normalize|limit/i.test(ui),'resolution UI must remain non-destructive and must not render or master audio');
assert.ok(/competition-master-clarity-resolution-ui\.js\?v=5\.0p3h/.test(workflow),'simple workflow must load the resolution UI with the refreshed cache version');
assert.ok(/data-competition-master-clarity-resolution-ui/.test(workflow),'resolution UI loader must prevent duplicate script insertion');
assert.ok(/loadCompetitionMasterAssessment\(\);loadCompetitionMasterClarityResolutionUI\(\)/.test(workflow),'resolution UI must load after the assessment UI so its findings exist before decoration');

console.log('competition-master-clarity-resolution-ui: open and safely resolved clarity risks are counted without changing global final-check approval');
