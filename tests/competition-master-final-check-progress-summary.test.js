const assert=require('node:assert/strict');
const fs=require('node:fs');
const {normalizedProgressImpact,classifyRemaining,classifyOverallDirection,buildDirectionReason,buildImpactCandidates,findDominantContributor,summarizeComparison}=require('../competition-master-final-check-progress-summary.js');

assert.equal(normalizedProgressImpact({beforeDistance:0.52,afterDistance:0.26,deltaDistance:0.26}),0.5);
assert.equal(normalizedProgressImpact({beforeDistance:0.04,afterDistance:0.08,deltaDistance:-0.04}),-0.5);
assert.equal(normalizedProgressImpact({beforeDistance:0.1,afterDistance:0,deltaDistance:0.1}),1);
assert.equal(normalizedProgressImpact({beforeDistance:0,afterDistance:0.1,deltaDistance:-0.1}),-1);
assert.equal(normalizedProgressImpact({deltaDistance:0.1}),null,'impact needs both before and after distances');

const remaining=[
  {label:'True peak / headroom',progress:{beforeDistance:0.52,afterDistance:0.26,deltaDistance:0.26}},
  {label:'Ending · FX',progress:{beforeDistance:0.04,afterDistance:0.08,deltaDistance:-0.04}},
  {label:'Dynamiikka',progress:{beforeDistance:0.1,afterDistance:0.1,deltaDistance:0}},
  {label:'Voiceover clarity',progress:null}
];
const classified=classifyRemaining(remaining);
assert.equal(classified.improved,1);
assert.equal(classified.worsened,1);
assert.equal(classified.unchanged,1);
assert.equal(classified.unmeasured,1);
assert.equal(classified.measuredImpact,0);
assert.equal(classified.absoluteMeasuredImpact,1);
assert.equal(classified.impactMeasured,3);

const strongImproving=classifyOverallDirection({improved:2,worsened:0,removed:1,added:0});
assert.equal(strongImproving.direction,'improving');
assert.equal(strongImproving.detail,'strongly-improving');
assert.equal(strongImproving.strength,'strong');
assert.equal(strongImproving.label,'Kokonaisuus selvästi paranee');
assert.equal(strongImproving.positive,3);
assert.equal(strongImproving.negative,0);
assert.equal(strongImproving.balance,3);
assert.equal(strongImproving.dominance,1);

const slightImproving=classifyOverallDirection({improved:2,worsened:1,removed:0,added:0});
assert.equal(slightImproving.direction,'improving');
assert.equal(slightImproving.detail,'slightly-improving');
assert.equal(slightImproving.strength,'slight');
assert.equal(slightImproving.label,'Kokonaisuus hieman paranee');

const strongWorsening=classifyOverallDirection({improved:0,worsened:2,removed:0,added:1});
assert.equal(strongWorsening.direction,'worsening');
assert.equal(strongWorsening.detail,'strongly-worsening');
assert.equal(strongWorsening.label,'Kokonaisuus selvästi heikkenee');

const slightWorsening=classifyOverallDirection({improved:1,worsened:2,removed:0,added:0});
assert.equal(slightWorsening.direction,'worsening');
assert.equal(slightWorsening.detail,'slightly-worsening');
assert.equal(slightWorsening.label,'Kokonaisuus hieman heikkenee');

const stableDirection=classifyOverallDirection({improved:1,worsened:0,removed:0,added:1});
assert.equal(stableDirection.direction,'stable');
assert.equal(stableDirection.detail,'stable');
assert.equal(stableDirection.strength,'stable');
assert.equal(stableDirection.label,'Kokonaisuus ennallaan');

const magnitudeWins=classifyOverallDirection({
  improved:3,
  worsened:1,
  removed:0,
  added:0,
  measuredImpact:0.05+0.05+0.05-0.9,
  absoluteMeasuredImpact:0.05+0.05+0.05+0.9
});
assert.equal(magnitudeWins.direction,'worsening','one large measured regression must outweigh several tiny improvements');
assert.equal(magnitudeWins.detail,'slightly-worsening');
assert.ok(magnitudeWins.impactBalance<0);
assert.ok(magnitudeWins.impactDominance>0.7);

assert.equal(
  buildDirectionReason({removed:2,added:0,impactMeasured:2,measuredImpact:0.75,improved:2,worsened:0},{direction:'improving'}),
  'Paranemista tukee: 2 riskiä poistui; mitatut jatkuvat riskit liikkuivat nettomääräisesti kohti tavoitetta (+0.75).'
);
assert.equal(
  buildDirectionReason({removed:0,added:1,impactMeasured:2,measuredImpact:-0.6,improved:0,worsened:2},{direction:'worsening'}),
  'Heikkenemistä selittää: 1 uusi riski tuli; mitatut jatkuvat riskit liikkuivat nettomääräisesti poispäin tavoitteesta (-0.60).'
);
assert.equal(
  buildDirectionReason({removed:1,added:1,impactMeasured:2,measuredImpact:0,improved:1,worsened:1},{direction:'stable'}),
  'Tasapainon muodostaa: 1 riski poistui; 1 uusi riski tuli; mitattujen jatkuvien riskien nettomuutos oli tasapainossa.'
);
assert.equal(
  buildDirectionReason({removed:0,added:0,impactMeasured:0,measuredImpact:0,improved:0,worsened:0},{direction:'stable'}),
  'Ei ratkaisevaa muutosta vertailukelpoisissa riskeissä.'
);

const contributorComparison={
  advisoryOnly:true,
  nonDestructive:true,
  removed:[{key:'fixed',label:'Voiceover clarity'}],
  remaining:[
    {key:'peak',label:'True peak / headroom',progress:{beforeDistance:0.52,afterDistance:0.26,deltaDistance:0.26}},
    {key:'fx',label:'Ending · FX',progress:{beforeDistance:0.04,afterDistance:0.08,deltaDistance:-0.04}}
  ],
  added:[{key:'new',label:'Osioiden tasapaino'}]
};
const candidates=buildImpactCandidates(contributorComparison);
assert.equal(candidates.length,4);
assert.ok(candidates.some(item=>item.label==='Voiceover clarity'&&item.impact===1&&item.kind==='removed'));
assert.ok(candidates.some(item=>item.label==='Osioiden tasapaino'&&item.impact===-1&&item.kind==='added'));
assert.ok(candidates.some(item=>item.label==='True peak / headroom'&&item.impact===0.5&&item.kind==='measured'));
assert.ok(candidates.some(item=>item.label==='Ending · FX'&&item.impact===-0.5&&item.kind==='measured'));
assert.equal(findDominantContributor(contributorComparison,{direction:'improving'}).label,'Voiceover clarity','improving summary should name the strongest positive contributor');
assert.equal(findDominantContributor(contributorComparison,{direction:'worsening'}).label,'Osioiden tasapaino','worsening summary should name the strongest negative contributor');
assert.equal(findDominantContributor({remaining:[],removed:[],added:[]},{direction:'stable'}),null,'empty comparison must not invent a dominant contributor');

const summary=summarizeComparison({
  advisoryOnly:true,
  nonDestructive:true,
  removed:[{key:'a',label:'Voiceover clarity'},{key:'b',label:'FX clarity'}],
  remaining,
  added:[{key:'c',label:'Osioiden tasapaino'}]
});
assert.equal(summary.improved,1);
assert.equal(summary.worsened,1);
assert.equal(summary.unchanged,1);
assert.equal(summary.unmeasured,1);
assert.equal(summary.removed,2);
assert.equal(summary.added,1);
assert.equal(summary.totalCompared,3);
assert.equal(summary.impactMeasured,3);
assert.equal(summary.measuredImpact,0);
assert.equal(summary.absoluteMeasuredImpact,1);
assert.equal(summary.overallDirection,'improving');
assert.equal(summary.overallDirectionDetail,'slightly-improving');
assert.equal(summary.overallStrength,'slight');
assert.equal(summary.overallLabel,'Kokonaisuus hieman paranee');
assert.equal(summary.positiveSignals,3);
assert.equal(summary.negativeSignals,2);
assert.equal(summary.signalBalance,1);
assert.equal(summary.signalDominance,0.2);
assert.equal(summary.impactBalance,1);
assert.equal(summary.impactMagnitude,4);
assert.equal(summary.impactDominance,0.25);
assert.equal(summary.overallReason,'Paranemista tukee: 2 riskiä poistui; 1 uusi riski tuli; mitattujen jatkuvien riskien nettomuutos oli tasapainossa.');
assert.equal(summary.dominantContributor.kind,'removed');
assert.equal(summary.dominantContributor.impact,1);
assert.match(summary.dominantContributorText,/^Suurin yksittäinen vaikutus:/);
assert.match(summary.text,/Suurin yksittäinen vaikutus:/);

const weightedWorsening=summarizeComparison({
  advisoryOnly:true,
  nonDestructive:true,
  removed:[],
  remaining:[
    {label:'Pieni parannus 1',progress:{beforeDistance:1,afterDistance:0.95,deltaDistance:0.05}},
    {label:'Pieni parannus 2',progress:{beforeDistance:1,afterDistance:0.95,deltaDistance:0.05}},
    {label:'Pieni parannus 3',progress:{beforeDistance:1,afterDistance:0.95,deltaDistance:0.05}},
    {label:'Ending · FX',progress:{beforeDistance:0.1,afterDistance:1,deltaDistance:-0.9}}
  ],
  added:[]
});
assert.equal(weightedWorsening.improved,3);
assert.equal(weightedWorsening.worsened,1);
assert.equal(weightedWorsening.overallDirection,'worsening','measured magnitude must override misleading raw counts');
assert.equal(weightedWorsening.overallDirectionDetail,'slightly-worsening');
assert.ok(weightedWorsening.impactBalance<0);
assert.match(weightedWorsening.overallReason,/^Heikkenemistä selittää:/);
assert.match(weightedWorsening.overallReason,/poispäin tavoitteesta/);
assert.equal(weightedWorsening.dominantContributor.label,'Ending · FX');
assert.equal(weightedWorsening.dominantContributor.kind,'measured');
assert.ok(weightedWorsening.dominantContributor.impact<0);
assert.match(weightedWorsening.dominantContributorText,/Ending · FX heikkeni/);

const worsening=summarizeComparison({advisoryOnly:true,nonDestructive:true,removed:[],remaining:[{label:'A',progress:{beforeDistance:0.1,afterDistance:0.2,deltaDistance:-0.1}},{label:'B',progress:{beforeDistance:0.2,afterDistance:0.4,deltaDistance:-0.2}}],added:[{key:'new',label:'Uusi riski'}]});
assert.equal(worsening.overallDirection,'worsening');
assert.equal(worsening.overallDirectionDetail,'strongly-worsening');
assert.match(worsening.text,/^Kokonaisuus selvästi heikkenee\./);
assert.match(worsening.overallReason,/1 uusi riski tuli/);
assert.equal(worsening.dominantContributor.kind,'added');

const stable=summarizeComparison({advisoryOnly:true,nonDestructive:true,removed:[{key:'fixed',label:'Korjattu riski'}],remaining:[],added:[{key:'new',label:'Uusi riski'}]});
assert.equal(stable.overallDirection,'stable');
assert.equal(stable.overallDirectionDetail,'stable');
assert.match(stable.text,/^Kokonaisuus ennallaan\./);
assert.match(stable.overallReason,/^Tasapainon muodostaa:/);
assert.ok(stable.dominantContributor,'stable comparison may expose one strongest factual contributor without changing the stable verdict');

assert.equal(summarizeComparison(null),null);
assert.equal(summarizeComparison({advisoryOnly:false,nonDestructive:true}),null,'summary must reject non-advisory data');
assert.equal(summarizeComparison({advisoryOnly:true,nonDestructive:false}),null,'summary must reject destructive data');

const source=fs.readFileSync('competition-master-final-check-progress-summary.js','utf8');
assert.ok(/getLastComparison/.test(source),'summary must consume the already-derived final-check comparison rather than reimplementing audio checks');
assert.ok(/normalizedProgressImpact/.test(source),'summary must normalize measured progress before combining different metric units');
assert.ok(/beforeDistance/.test(source)&&/afterDistance/.test(source),'weighted direction must use distance-to-target progress rather than raw metric units');
assert.ok(/buildDirectionReason/.test(source),'summary must explain the diagnostic direction from existing comparison signals');
assert.ok(/overallReason:reason/.test(source),'summary must expose its explanation separately from the direction label');
assert.ok(/findDominantContributor/.test(source),'summary must identify the strongest individual existing comparison signal');
assert.ok(/dominantContributor:dominant/.test(source),'summary must expose the dominant contributor as advisory data');
assert.ok(/queueMicrotask\(refresh\)/.test(source),'summary must refresh after the history listener has consumed the same final-check event');
assert.ok(/textContent=summary\.text/.test(source),'summary must render plain text safely');
assert.ok(/dataset\.direction=summary\.overallDirection/.test(source),'summary should preserve the broad diagnostic direction');
assert.ok(/dataset\.directionDetail=summary\.overallDirectionDetail/.test(source),'summary should expose the five-level diagnostic direction without mutating final-check state');
assert.ok(/dataset\.strength=summary\.overallStrength/.test(source),'summary should expose diagnostic strength separately');
assert.ok(/dataset\.impactBalance=String\(summary\.impactBalance\)/.test(source),'summary should expose weighted diagnostic impact without changing final-check state');
assert.ok(/dataset\.dominantKind=summary\.dominantContributor\.kind/.test(source),'summary should expose dominant contributor type only as diagnostic metadata');
assert.ok(/dataset\.dominantImpact=String\(summary\.dominantContributor\.impact\)/.test(source),'summary should expose dominant contributor impact only as diagnostic metadata');
assert.ok(!/innerHTML\s*=/.test(source),'summary must not inject HTML');
assert.ok(!/renderProject|measureCompetitionMaster|evaluateCompetitionMasterReadiness|normalize|DynamicsCompressor|createGain|encodeWav/i.test(source),'summary must stay purely diagnostic and non-destructive');
assert.ok(!/finalCheck\.status\s*=|riskFlags\s*=|sectionIssues\s*=/.test(source),'summary must not mutate final-check decisions');

console.log('competition-master-final-check-progress-summary: dominant contributor stays advisory and non-destructive');
