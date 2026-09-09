const assert=require('assert');
const {PROFILE,clarityCorrectionGuidance,sectionClarityIssues,buildCompetitionMasterFinalCheck}=require('../competition-master-final-check-core');

function readiness(status='preview-ready',riskFlags=[]){
  return {kind:'cheer-competition-master-readiness',status,riskFlags};
}
function preview(status='preview-ready',actions=[],riskFlags=[]){
  return {kind:'cheer-competition-master-preview',status,actions,riskFlags,preview:{renderAllowed:false}};
}
function metrics(extra={}){
  return {truePeakDbtp:-1.3,loudnessRangeLu:5.2,sectionPeaksDb:[-2.4,-2.1,-2.7],voiceoverClarityScore:0.86,fxClarityScore:0.8,...extra};
}
function sectionClarity(){
  return {
    kind:'cheer-competition-master-section-clarity',
    summary:{status:'review-required',sectionsMeasured:3,sectionsReviewRequired:2,weakestSectionId:'ending',weakestSectionLabel:'Ending'},
    sections:[
      {id:'stunt',label:'Stunt',type:'stunt',start:20,end:45,status:'clear',voiceover:{ready:true,score:.84,minScore:.72,weakestItem:{id:'vo-stunt',start:30,end:30.4,score:.84}},fx:{ready:true,score:.76,minScore:.68,weakestItem:{id:'fx-stunt',start:35,end:35.2,score:.76}},riskFlags:[]},
      {id:'dance',label:'Dance',type:'dance',start:82.5,end:111,status:'review-required',voiceover:{ready:false,score:.61,minScore:.72,weakestItem:{id:'vo-dance',start:96.2,end:96.7,score:.52}},fx:{ready:null,score:null,minScore:.68,weakestItem:null},riskFlags:['section-voiceover-clarity-failed']},
      {id:'ending',label:'Ending',type:'ending',start:132,end:150,status:'review-required',voiceover:{ready:false,score:.64,minScore:.72,weakestItem:{id:'vo-ending',start:141.2,end:141.6,score:.64}},fx:{ready:false,score:.55,minScore:.68,weakestItem:{id:'fx-ending',start:145.3,end:145.55,score:.49}},riskFlags:['section-voiceover-clarity-failed','section-fx-clarity-failed']}
    ]
  };
}

{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics()});
  assert.equal(result.status,'preview-approved');
  assert.equal(result.summary.finalReady,true);
  assert.equal(result.renderAllowed,false);
  assert.equal(result.executable,false);
  assert.equal(PROFILE.advisoryOnly,true);
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({truePeakDbtp:-0.3})});
  assert.equal(result.status,'review-required');
  assert(result.riskFlags.includes('final-true-peak-headroom-failed'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({loudnessRangeLu:2.2})});
  assert(result.riskFlags.includes('final-dynamics-check-failed'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({sectionPeaksDb:[-8,-2]})});
  assert(result.riskFlags.includes('final-section-balance-failed'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({voiceoverClarityScore:0.5})});
  assert(result.riskFlags.includes('final-voiceover-clarity-failed'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({fxClarityScore:0.5})});
  assert(result.riskFlags.includes('final-fx-clarity-failed'));
}
{
  const voice=clarityCorrectionGuidance({kind:'voiceover',score:.52,minScore:.72});
  assert.equal(voice.advisoryOnly,true);
  assert.equal(voice.primaryAction,'lower-local-music-bed');
  assert.equal(voice.secondaryAction,'check-voiceover-level-and-midrange-separation');
  assert.equal(voice.severity,'high');
  assert(Math.abs(voice.scoreDeficit-.2)<1e-9);
  const fx=clarityCorrectionGuidance({kind:'fx',score:.63,minScore:.68});
  assert.equal(fx.primaryAction,'reduce-or-shorten-masking-fx');
  assert.equal(fx.secondaryAction,'move-fx-away-from-critical-call-or-accent');
  assert.equal(fx.severity,'low');
  assert(Math.abs(fx.scoreDeficit-.05)<1e-9);
  assert.equal(clarityCorrectionGuidance(null),null);
}
{
  const section=sectionClarity();
  const issues=sectionClarityIssues(section);
  assert.equal(issues.length,2);
  assert.deepEqual(issues.map(issue=>issue.label),['Dance','Ending']);
  assert.equal(issues[0].voiceoverFailed,true);
  assert.equal(issues[1].fxFailed,true);
  assert.equal(issues[0].startSeconds,82.5);
  assert.equal(issues[0].endSeconds,111);
  assert.equal(issues[0].focusKind,'voiceover');
  assert.equal(issues[0].focusStartSeconds,96.2);
  assert.equal(issues[0].focusEndSeconds,96.7);
  assert.equal(issues[0].focusScore,.52);
  assert.equal(issues[0].focusMinScore,.72);
  assert.equal(issues[0].correctionGuidance.primaryAction,'lower-local-music-bed');
  assert.equal(issues[0].correctionGuidance.advisoryOnly,true);
  assert.equal(issues[1].focusKind,'fx');
  assert.equal(issues[1].focusStartSeconds,145.3);
  assert.equal(issues[1].focusEndSeconds,145.55);
  assert.equal(issues[1].focusScore,.49);
  assert.equal(issues[1].focusMinScore,.68);
  assert.equal(issues[1].correctionGuidance.primaryAction,'reduce-or-shorten-masking-fx');
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({sectionClarity:section})});
  assert.equal(result.version,6);
  assert.equal(result.status,'review-required');
  assert(result.riskFlags.includes('final-section-clarity-failed'));
  assert(result.recommendations.includes('resolve-section-clarity-before-final-master'));
  assert.equal(result.checks.sectionClarity.sectionsReviewRequired,2);
  assert.equal(result.checks.sectionClarity.weakestSectionLabel,'Ending');
  assert.deepEqual(result.sectionIssues.map(issue=>issue.label),['Dance','Ending']);
  assert.deepEqual(result.sectionIssues.map(issue=>issue.focusStartSeconds),[96.2,145.3]);
  assert.deepEqual(result.sectionIssues.map(issue=>issue.focusScore),[.52,.49]);
  assert.deepEqual(result.sectionIssues.map(issue=>issue.focusMinScore),[.72,.68]);
  assert.deepEqual(result.sectionIssues.map(issue=>issue.correctionGuidance.kind),['voiceover','fx']);
}
{
  const fallback={kind:'cheer-competition-master-section-clarity',summary:{status:'review-required'},sections:[{id:'dance',label:'Dance',start:82.5,end:111,status:'review-required',voiceover:{ready:false,score:.61},fx:{ready:null,score:null},riskFlags:['section-voiceover-clarity-failed']}]};
  const issue=sectionClarityIssues(fallback)[0];
  assert.equal(issue.focusStartSeconds,82.5,'legacy section clarity without weakestItem must fall back safely to section start');
  assert.equal(issue.focusScore,null,'legacy section clarity without weakestItem must not invent a diagnostic score');
  assert.equal(issue.focusMinScore,null,'legacy section clarity without weakestItem must not invent a diagnostic threshold');
  assert.equal(issue.correctionGuidance,null,'legacy section clarity without a precise weakest focus must not invent correction guidance');
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview('review-required',[{type:'pre-master-hold'}]),metrics:metrics()});
  assert(result.riskFlags.includes('final-preview-hold-active'));
  assert(result.riskFlags.includes('final-upstream-review-required'));
}
{
  const result=buildCompetitionMasterFinalCheck({readiness:readiness(),preview:preview(),metrics:metrics({voiceoverClarityScore:null})});
  assert(result.riskFlags.includes('final-voiceover-clarity-unmeasured'));
}

assert.equal(buildCompetitionMasterFinalCheck({}).reason,'master-preview-required');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview('blocked')}).reason,'master-preview-blocked');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview()}).reason,'master-readiness-required');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview(),readiness:readiness('blocked')}).reason,'master-readiness-blocked');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview(),readiness:readiness()}).reason,'master-metrics-required');
assert.equal(buildCompetitionMasterFinalCheck({preview:preview(),readiness:readiness(),metrics:metrics({truePeakDbtp:null})}).reason,'true-peak-required');

console.log('competition-master-final-check-core tests passed');
