'use strict';
const assert=require('assert');
const core=require('../cheer-fx-competition-package-core.js');

function section(name,directive='hold',intensity=0.7,ceiling=0.9,risks=[]){return {section:name,balanceDirective:directive,competitionIntensity:intensity,targetCeiling:ceiling,risks};}
function plan(sections,status='preview-ready'){return {kind:'cheer-fx-competition-balance-plan',status,bpm:152,balanceRisks:[],riskFlags:[],sections};}

{
 const result=core.buildCompetitionFxPackage(plan([section('intro'),section('stunt'),section('ending')]));
 assert.equal(result.status,'preview-ready');
 assert.equal(result.summary.reviewItems,0);
 assert.equal(result.recommendations.length,3);
 assert.equal(result.executable,false);
 assert.equal(result.safePreviewOnly,true);
}
{
 const result=core.buildCompetitionFxPackage(plan([section('stunt','reduce-section-fx'),section('ending','strengthen-final-peak')],'review-required'));
 assert.equal(result.status,'review-required');
 assert.equal(result.recommendations[0].section,'ending');
 assert.equal(result.recommendations[0].directive,'strengthen-final-peak');
 assert.equal(result.summary.reviewItems,2);
 assert(result.riskFlags.includes('fx-package-review-items'));
}
{
 const result=core.buildCompetitionFxPackage(plan([section('pyramid','trim-pyramid-peak'),section('ending','hold')]));
 assert.equal(result.recommendations[0].section,'pyramid');
 assert.equal(result.preview.finalPeak.section,'ending');
}
{
 const result=core.buildCompetitionFxPackage(plan([]));
 assert.equal(result.status,'blocked');
 assert.equal(result.reason,'competition-sections-required');
 assert(result.riskFlags.includes('fx-package-empty'));
}
{
 const missing=core.buildCompetitionFxPackage(null);
 assert.equal(missing.status,'blocked');
 assert.equal(missing.reason,'competition-balance-plan-required');
}
{
 const inherited=core.buildCompetitionFxPackage({...plan([section('ending')]),status:'blocked'});
 assert.equal(inherited.status,'blocked');
 assert.equal(inherited.reason,'competition-balance-plan-blocked');
}
console.log('cheer-fx-competition-package-core tests passed');
