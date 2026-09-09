const assert=require('node:assert/strict');
const fs=require('node:fs');
const {FLAG_GUIDANCE,formatFlagLabel,formatSectionLabel,getSectionGuidance,getFlagMeasurement,getFlagMetric,getSectionMeasurement,getSectionMetric,distanceToTarget,formatMetricValue,compareMetricProgress,compareMetricTrend,formatRiskStatus,collectRisks,compareFinalChecks}=require('../competition-master-final-check-history.js');

const before={
  riskFlags:['final-true-peak-headroom-failed','final-section-clarity-failed'],
  checks:{
    truePeak:{valueDbtp:-0.42,limitDbtp:-1}
  },
  sectionIssues:[
    {sectionId:'dance',label:'Dance',focusKind:'voiceover',focusStartSeconds:12,focusEndSeconds:14,focusScore:0.61,focusMinScore:0.72},
    {sectionId:'ending',label:'Ending',focusKind:'fx',focusStartSeconds:70,focusEndSeconds:71.5,focusScore:0.57,focusMinScore:0.68}
  ]
};
const after={
  riskFlags:['final-true-peak-headroom-failed','final-dynamics-check-failed'],
  checks:{
    truePeak:{valueDbtp:-0.68,limitDbtp:-1},
    loudnessRange:{valueLu:2.4,minLu:3,maxLu:10}
  },
  sectionIssues:[
    {sectionId:'ending',label:'Ending',focusKind:'fx',focusStartSeconds:70,focusEndSeconds:71.5,focusScore:0.64,focusMinScore:0.68}
  ]
};

assert.equal(formatFlagLabel('final-true-peak-headroom-failed'),'True peak / headroom');
assert.equal(formatFlagLabel('final-dynamics-check-failed'),'Dynamiikka');
assert.equal(formatFlagLabel('final-voiceover-clarity-unmeasured'),'Voiceover clarity mittaamatta');
assert.equal(formatFlagLabel('final-custom-risk'),'Custom risk','unknown final-check flags must still get a readable fallback label');
assert.match(FLAG_GUIDANCE['final-true-peak-headroom-failed'],/headroom/i,'true-peak failure must point the user toward headroom/transients');
assert.match(FLAG_GUIDANCE['final-section-balance-failed'],/osioiden/i,'section balance failure must point toward section-level balance');
assert.equal(formatSectionLabel({label:'Dance',focusKind:'voiceover'}),'Dance · voiceover');
assert.equal(formatSectionLabel({label:'Ending',focusKind:'fx'}),'Ending · FX');
assert.match(getSectionGuidance({focusKind:'voiceover'}),/voiceover/i);
assert.match(getSectionGuidance({focusKind:'fx'}),/cheer-FX/i);
assert.match(getSectionGuidance({focusKind:'clarity'}),/sama aikajakso/i);

assert.equal(getFlagMeasurement('final-true-peak-headroom-failed',after),'-0.68 dBTP · raja ≤ -1.00 dBTP');
assert.equal(getFlagMeasurement('final-dynamics-check-failed',after),'2.4 LU · tavoite 3.0–10.0 LU');
assert.equal(getFlagMeasurement('final-section-balance-failed',{checks:{sectionBalance:{spreadDb:5.25,maxSpreadDb:4.5}}}),'5.3 dB · raja ≤ 4.5 dB');
assert.equal(getFlagMeasurement('final-voiceover-clarity-failed',{checks:{voiceoverClarity:{score:0.66,minScore:0.72}}}),'0.66 · raja ≥ 0.72');
assert.equal(getFlagMeasurement('final-fx-clarity-failed',{checks:{fxClarity:{score:0.61,minScore:0.68}}}),'0.61 · raja ≥ 0.68');
assert.equal(getFlagMeasurement('final-custom-risk',after),null,'unknown flags must not invent measurements');
assert.equal(getSectionMeasurement({focusScore:0.64,focusMinScore:0.68}),'0.64 · raja ≥ 0.68');
assert.equal(getSectionMeasurement({focusScore:null,focusMinScore:0.68}),null,'missing section score must not invent a measured value');

const peakBefore=getFlagMetric('final-true-peak-headroom-failed',before);
const peakAfter=getFlagMetric('final-true-peak-headroom-failed',after);
assert.equal(distanceToTarget(peakBefore),0.58,'true peak distance must be measured toward the allowed maximum');
assert.equal(Number(distanceToTarget(peakAfter).toFixed(2)),0.32);
assert.equal(formatMetricValue(peakAfter),'-0.68 dBTP');
const peakProgress=compareMetricProgress(peakBefore,peakAfter);
assert.equal(Number(peakProgress.beforeDistance.toFixed(2)),0.58);
assert.equal(Number(peakProgress.afterDistance.toFixed(2)),0.32);
assert.equal(Number(peakProgress.deltaDistance.toFixed(2)),0.26,'progress must quantify how much closer the measurement moved to the accepted limit');
assert.equal(peakProgress.direction,'pieneni');
assert.equal(peakProgress.text,'etäisyys rajaan pieneni 0.26 dBTP');
assert.equal(compareMetricTrend(peakBefore,peakAfter),'parani -0.42 dBTP → -0.68 dBTP · etäisyys rajaan pieneni 0.26 dBTP','moving true peak toward its limit must report both direction and quantitative target-distance improvement');

const clarityBefore=getSectionMetric({focusScore:0.57,focusMinScore:0.68});
const clarityAfter=getSectionMetric({focusScore:0.64,focusMinScore:0.68});
assert.equal(compareMetricProgress(clarityBefore,clarityAfter).text,'etäisyys rajaan pieneni 0.07','clarity progress must quantify remaining score distance without inventing a unit');
assert.equal(compareMetricTrend(clarityBefore,clarityAfter),'parani 0.57 → 0.64 · etäisyys rajaan pieneni 0.07','clarity moving toward minimum score must show quantitative improvement');
const clarityWorse=compareMetricProgress(getSectionMetric({focusScore:0.64,focusMinScore:0.68}),getSectionMetric({focusScore:0.60,focusMinScore:0.68}));
assert.equal(clarityWorse.direction,'kasvoi');
assert.equal(clarityWorse.text,'etäisyys rajaan kasvoi 0.04');
assert.equal(compareMetricTrend(getSectionMetric({focusScore:0.64,focusMinScore:0.68}),getSectionMetric({focusScore:0.60,focusMinScore:0.68})),'heikkeni 0.64 → 0.60 · etäisyys rajaan kasvoi 0.04','clarity moving away from minimum score must quantify worsening');
const dynamicsProgress=compareMetricProgress(getFlagMetric('final-dynamics-check-failed',{checks:{loudnessRange:{valueLu:2.0,minLu:3,maxLu:10}}}),getFlagMetric('final-dynamics-check-failed',{checks:{loudnessRange:{valueLu:2.4,minLu:3,maxLu:10}}}));
assert.equal(dynamicsProgress.text,'etäisyys rajaan pieneni 0.4 LU','range metrics must quantify distance toward the accepted interval');
assert.equal(compareMetricTrend(null,peakAfter),null,'missing previous metric must not invent a trend');
assert.equal(compareMetricProgress(null,peakAfter),null,'missing previous metric must not invent quantitative progress');

assert.equal(formatRiskStatus({label:'Dance · voiceover',guidance:'ei pitäisi näkyä',measurement:'0.61 · raja ≥ 0.72',trend:'parani 0.50 → 0.61'},'removed'),'Dance · voiceover — korjattu','resolved risks must not keep stale measurements, trends or corrective guidance');
assert.equal(formatRiskStatus({label:'True peak / headroom',guidance:'Tarkista headroom.',measurement:'-0.68 dBTP · raja ≤ -1.00 dBTP',trend:'parani -0.42 dBTP → -0.68 dBTP · etäisyys rajaan pieneni 0.26 dBTP'},'remaining'),'True peak / headroom — edelleen estää kilpailumasterin · parani -0.42 dBTP → -0.68 dBTP · etäisyys rajaan pieneni 0.26 dBTP · mitattu -0.68 dBTP · raja ≤ -1.00 dBTP → Tarkista headroom.');
assert.equal(formatRiskStatus({label:'Dynamiikka',guidance:'Tarkista dynamiikka.',measurement:'2.4 LU · tavoite 3.0–10.0 LU'},'added'),'Dynamiikka — uusi riski — tarkista · mitattu 2.4 LU · tavoite 3.0–10.0 LU → Tarkista dynamiikka.');
assert.equal(formatRiskStatus({label:'Tunnettu',guidance:'ei käytetä',measurement:'ei käytetä',trend:'ei käytetä'},'future-state'),'Tunnettu — tila muuttui','unknown future states must degrade safely without accidental actions');

const collected=collectRisks(before);
assert.equal(collected.length,4,'global and section-specific risks must both be tracked');
assert.ok(collected.some(item=>item.key==='section:dance:voiceover:12.000:14.000'),'section risk identity must include section, kind and exact window');
assert.ok(collected.some(item=>item.key==='flag:final-true-peak-headroom-failed'&&item.label==='True peak / headroom'&&/headroom/i.test(item.guidance)&&/-0\.42 dBTP/.test(item.measurement)&&item.metric?.value===-0.42),'global flags must carry label, guidance and machine-readable measured context');
assert.ok(collected.some(item=>item.key.startsWith('section:dance:voiceover')&&item.label==='Dance · voiceover'&&/sama aikajakso/i.test(item.guidance)&&item.measurement==='0.61 · raja ≥ 0.72'&&item.metric?.value===0.61),'section risks must carry same-window guidance and machine-readable clarity context');
const unknown=collectRisks({riskFlags:['final-custom-risk']})[0];
assert.match(unknown.guidance,/Tarkista tämä final-check-riski/,'unknown future risks must get generic safe guidance');
assert.equal(unknown.measurement,null,'unknown future risks must not get guessed metrics');
assert.equal(unknown.metric,null,'unknown future risks must not get guessed trend data');

const comparison=compareFinalChecks(before,after);
assert.equal(comparison.beforeCount,4);
assert.equal(comparison.afterCount,3);
assert.equal(comparison.removed.length,2,'resolved global/section risks must be reported as removed');
assert.ok(comparison.removed.some(item=>item.key==='flag:final-section-clarity-failed'));
assert.ok(comparison.removed.some(item=>item.key.startsWith('section:dance:voiceover')));
assert.equal(comparison.remaining.length,2,'unchanged risks must remain visible');
const remainingPeak=comparison.remaining.find(item=>item.key==='flag:final-true-peak-headroom-failed');
assert.equal(remainingPeak.measurement,'-0.68 dBTP · raja ≤ -1.00 dBTP');
assert.equal(remainingPeak.trend,'parani -0.42 dBTP → -0.68 dBTP · etäisyys rajaan pieneni 0.26 dBTP');
assert.equal(Number(remainingPeak.progress.deltaDistance.toFixed(2)),0.26,'remaining risks must preserve machine-readable quantitative progress');
const remainingFx=comparison.remaining.find(item=>item.key.startsWith('section:ending:fx'));
assert.equal(remainingFx.measurement,'0.64 · raja ≥ 0.68');
assert.equal(remainingFx.trend,'parani 0.57 → 0.64 · etäisyys rajaan pieneni 0.07');
assert.equal(Number(remainingFx.progress.afterDistance.toFixed(2)),0.04,'remaining section clarity risk must expose exact distance still missing from the acceptance score');
assert.match(remainingFx.guidance,/cheer-FX/i,'remaining section FX risk must explain the next corrective focus');
assert.equal(comparison.added.length,1,'newly introduced risks must be separated from remaining risks');
assert.equal(comparison.added[0].key,'flag:final-dynamics-check-failed');
assert.equal(comparison.added[0].label,'Dynamiikka','new risks must be understandable without exposing internal flag names');
assert.equal(comparison.added[0].measurement,'2.4 LU · tavoite 3.0–10.0 LU','new measurable risks must show value and target range');
assert.equal(comparison.added[0].trend,undefined,'new risks must not pretend to have a previous comparable measurement');
assert.equal(comparison.added[0].progress,undefined,'new risks must not pretend to have previous target-distance progress');
assert.match(comparison.added[0].guidance,/dynamiikka/i,'new risks must include a safe corrective direction');
assert.equal(comparison.improved,true,'more removed than added risks should be marked as improved');
assert.equal(comparison.unchanged,false);
assert.equal(compareFinalChecks(null,after),null,'comparison must not invent history without a previous final-check');

const refreshSource=fs.readFileSync('competition-master-final-check-refresh.js','utf8');
const historySource=fs.readFileSync('competition-master-final-check-history.js','utf8');
const workflow=fs.readFileSync('simple-workflow.js','utf8');
assert.ok(/previousFinalCheck=mix\.getLastCompetitionMasterFinalCheck/.test(refreshSource),'refresh must snapshot the previous final-check before new measurements are evaluated');
assert.ok(/previousFinalCheck,/.test(refreshSource),'refresh event must carry the previous final-check snapshot');
assert.ok(/status!=='refreshed'/.test(historySource)&&/current-project-offline-render/.test(historySource)&&/nonDestructive!==true/.test(historySource),'history must accept only completed non-destructive current-project refreshes');
assert.ok(/Poistuneet riskit/.test(historySource)&&/Jäljellä olevat riskit/.test(historySource)&&/Uudet riskit/.test(historySource),'history UI must name each before/after risk group');
assert.ok(/removed:'korjattu'/.test(historySource)&&/remaining:'edelleen estää kilpailumasterin'/.test(historySource)&&/added:'uusi riski — tarkista'/.test(historySource),'history must explain what each risk state means to the user');
assert.ok(/getFlagMetric/.test(historySource)&&/getSectionMetric/.test(historySource)&&/compareMetricTrend/.test(historySource),'history must derive machine-readable metric trends from final-check data');
assert.ok(/compareMetricProgress/.test(historySource)&&/deltaDistance/.test(historySource)&&/etäisyys rajaan/.test(historySource),'history must quantify how much the remaining risk moved toward or away from its acceptance boundary');
assert.ok(/distanceToTarget/.test(historySource),'trend and progress direction must be based on distance to the accepted target or range, not raw numeric direction alone');
assert.ok(/state==='remaining'\|\|state==='added'/.test(historySource),'measurement, trend and corrective guidance must only appear for active or newly introduced risks');
assert.ok(/li\.textContent=formatRiskStatus\(item,state\)/.test(historySource),'risk impact details must be rendered as text, not injected HTML');
assert.ok(!/innerHTML\s*=/.test(historySource),'history must not render risk labels through innerHTML');
assert.ok(!/renderProject|measureCompetitionMaster|measureCompetitionClarity|evaluateCompetitionMasterReadiness/.test(historySource),'history must not render or measure audio');
assert.ok(!/normalize|DynamicsCompressor|createGain|applyMasterHeadroom|encodeWav/i.test(historySource),'history must not perform mastering or export processing');
assert.ok(!/finalCheck\.status\s*=|riskFlags\s*=|sectionIssues\s*=/.test(historySource),'history must not mutate final-check decisions');
assert.ok(/competition-master-final-check-history\.js\?v=5\.0p3q/.test(workflow),'simple workflow must still load the final-check history module explicitly');
const syncIndex=workflow.indexOf('loadCompetitionMasterFinalCheckRefreshUISync();');
const historyIndex=workflow.indexOf('loadCompetitionMasterFinalCheckHistory();');
assert.ok(syncIndex>=0&&historyIndex>syncIndex,'history must load after refreshed final-check assessment sync');

console.log('competition-master-final-check-history: remaining risks quantify target-distance progress without changing final-check decisions');
