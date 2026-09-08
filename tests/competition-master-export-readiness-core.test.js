const assert=require('node:assert/strict');
const bridge=require('../competition-master-export-readiness-core.js');
const masterInputCore=require('../competition-master-input-core.js');
const readinessCore=require('../competition-master-readiness-core.js');
const previewCore=require('../competition-master-preview-core.js');

const voiceoverPackage={kind:'cheer-voiceover-competition-package',status:'ready',selected:[]};
const metrics={stage:'post-voiceover-mix',truePeakDbtp:-1.6,integratedLufs:-13.8,loudnessRangeLu:5.2,sectionPeaksDb:[-2.1,-1.7,-2.4]};

const state={mixSettings:{competitionVoiceoverPackage:voiceoverPackage}};
const result=bridge.buildExportReadiness({metrics,state,masterInputCore,readinessCore,previewCore});
assert.equal(result.reason,null);
assert.equal(result.masterInput.kind,'cheer-competition-master-input');
assert.equal(result.masterInput.status,'ready');
assert.equal(result.readiness.kind,'cheer-competition-master-readiness');
assert.equal(result.readiness.status,'preview-ready');
assert.equal(result.preview.kind,'cheer-competition-master-preview');
assert.equal(result.preview.status,'preview-ready');
assert.equal(result.preview.advisoryOnly,true);
assert.equal(result.preview.executable,false);
assert.equal(result.preview.preview.renderAllowed,false);
assert.deepEqual(result.masterInput.metrics.sectionPeaksDb,metrics.sectionPeaksDb);

const reviewMetrics={...metrics,truePeakDbtp:-0.4};
const review=bridge.buildExportReadiness({metrics:reviewMetrics,state,masterInputCore,readinessCore,previewCore});
assert.equal(review.masterInput.status,'review-required');
assert.equal(review.readiness.status,'review-required');
assert.equal(review.preview.status,'review-required');
assert.ok(review.readiness.riskFlags.includes('insufficient-true-peak-headroom'));
assert.ok(review.preview.actions.some(action=>action.id==='peak-headroom'));

const blocked=bridge.buildExportReadiness({metrics,state:{},masterInputCore,readinessCore,previewCore});
assert.equal(blocked.masterInput.status,'blocked');
assert.equal(blocked.masterInput.reason,'voiceover-package-required');
assert.equal(blocked.readiness,null);
assert.equal(blocked.preview,null);

const explicit={...voiceoverPackage,status:'review-required'};
const explicitResult=bridge.buildExportReadiness({metrics,state:{},voiceoverPackage:explicit,masterInputCore,readinessCore,previewCore});
assert.equal(explicitResult.masterInput.status,'review-required');
assert.equal(explicitResult.readiness.status,'review-required');
assert.equal(explicitResult.preview.status,'review-required');
assert.ok(explicitResult.readiness.riskFlags.includes('voiceover-master-review-required'));
assert.ok(explicitResult.preview.actions.some(action=>action.id==='voiceover-hold'));

const noPreview=bridge.buildExportReadiness({metrics,state,masterInputCore,readinessCore});
assert.equal(noPreview.readiness.status,'preview-ready');
assert.equal(noPreview.preview,null);

assert.equal(bridge.voiceoverPackageFromState({competitionVoiceoverPackage:voiceoverPackage}),voiceoverPackage);
assert.equal(bridge.voiceoverPackageFromState({voiceoverCompetitionPackage:voiceoverPackage}),voiceoverPackage);
assert.equal(bridge.voiceoverPackageFromState({}),null);

console.log('competition master export readiness and preview bridge checks passed');
