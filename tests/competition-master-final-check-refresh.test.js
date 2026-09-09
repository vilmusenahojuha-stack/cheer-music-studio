const assert=require('node:assert/strict');
const fs=require('node:fs');

const refresh=fs.readFileSync('competition-master-final-check-refresh.js','utf8');
const workflow=fs.readFileSync('simple-workflow.js','utf8');

assert.ok(/clarityGateState/.test(refresh)&&/resolutionCounts/.test(refresh),'refresh must derive permission from the existing safe clarity gate');
assert.ok(/if\(!gate\?\.clarityReady\)throw new Error\('Clarity-portti ei ole vielä puhdas\.'\)/.test(refresh),'refresh must refuse to run before the clarity gate is clean');
assert.ok(/CheerOfflineRenderer/.test(refresh)&&/renderProject\(window\.state/.test(refresh),'refresh must render the current project state offline');
assert.ok(/measureCompetitionMaster\(rendered\)/.test(refresh),'refresh must rebuild competition master metrics from the new render');
assert.ok(/measureCompetitionClarity\(rendered,competition\.metrics\)/.test(refresh),'refresh must recompute clarity from the same fresh render');
assert.ok(/evaluateCompetitionMasterReadiness\(competition\.metrics\)/.test(refresh),'refresh must rebuild readiness, preview and final-check from fresh metrics');
assert.ok(/getLastCompetitionMasterFinalCheck/.test(refresh),'refresh may use the mix export final-check getter only as a post-evaluation fallback');
assert.ok(/source:'current-project-offline-render'/.test(refresh)&&/nonDestructive:true/.test(refresh),'result must explicitly identify the fresh offline source and non-destructive behavior');
assert.ok(/cheer-competition-master-final-check-refreshed/.test(refresh),'refresh must emit a dedicated completion event');
assert.ok(/Arvioi final-check uudelleen/.test(refresh),'UI must expose a clear Finnish manual refresh action');
assert.ok(/button\.hidden=!gate\?\.clarityReady/.test(refresh),'manual refresh action must stay hidden until clarity is ready');
assert.ok(!/exportWav|downloadArrayBuffer|CheerWav24|applyMasterHeadroom|createGain|DynamicsCompressor|normalize|limit/i.test(refresh),'refresh must not export, master, normalize or alter audio');
assert.ok(!/finalCheck\.status\s*=|renderAllowed\s*=\s*true/.test(refresh),'refresh must not forge final-check approval or render authorization');
assert.ok(/competition-master-final-check-refresh\.js\?v=5\.0p3j/.test(workflow),'simple workflow must load the new refresh module with an explicit cache version');
assert.ok(/data-competition-master-final-check-refresh/.test(workflow),'loader must prevent duplicate refresh module insertion');
assert.ok(/loadCompetitionMasterClarityResolutionUI\(\);loadCompetitionMasterFinalCheckRefresh\(\)/.test(workflow),'refresh must load only after clarity resolution UI is available');

console.log('competition-master-final-check-refresh: current project is re-rendered and final-check rebuilt without export or mastering');
