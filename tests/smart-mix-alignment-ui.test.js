const assert=require('assert');
const fs=require('fs');
const ui=require('../smart-mix-alignment-ui.js');
const summaryCore=require('../smart-mix-alignment-summary-core.js');

function profile(name,alignment){
  const rows=[{sourceName:name,startEight:1,endEight:1}];
  Object.defineProperty(rows,'eightAlignment',{value:alignment,enumerable:false});
  return rows;
}

const view=ui.buildViewModel([
  profile('Strong.wav',{reliabilityLevel:'strong',confidence:.91,support:4,canAutoUse:true,reanalyzed:true}),
  profile('Review.wav',{reliabilityLevel:'review',confidence:.74,support:2,needsReview:true}),
  profile('Manual.wav',{reliabilityLevel:'manual',confidence:.32,support:1,useManualCountOne:true})
],summaryCore);

assert.equal(view.status,'8-count-kohdistus: 1 vahva · 1 tarkistettava · 1 manuaalinen.');
assert.equal(view.rows[0].title,'Strong.wav: vahva 8-count-kohdistus');
assert.equal(view.rows[0].detail,'91 % · 4 ankkuria · automaattinen kohdistus käytettävissä');
assert.equal(view.rows[1].title,'Review.wav: tarkista 1-lasku');
assert.equal(view.rows[1].detail,'74 % · 2 ankkuria · tarkista 1-lasku ennen Smart Mixiä');
assert.equal(view.rows[2].title,'Manual.wav: käytä manuaalista 1-laskua');
assert.equal(view.rows[2].detail,'32 % · 1 ankkuri · manuaalinen 1-lasku säilyy');
assert.equal(ui.buildViewModel([],null),null);
assert.equal(ui.pct(2),'100 %');
assert.equal(ui.pct(-1),'0 %');
assert.equal(ui.supportText(0),'ei varmoja ankkureita');

const source=fs.readFileSync(require.resolve('../smart-mix-alignment-ui.js'),'utf8');
assert.match(source,/Tarkista 8-countit/);
assert.match(source,/validateTrackReadiness/);
assert.match(source,/analyzeReadyTracks/);
assert.doesNotMatch(source,/trackAnalysis\s*\[[^\]]+\]\.oneOffset\s*=/,'UI must not overwrite saved count-one');
assert.doesNotMatch(source,/smartMixProposalPackage\s*=/,'UI check must not replace Smart Mix proposal');
assert.doesNotMatch(source,/innerHTML/,'UI must render text safely');

console.log('smart-mix-alignment-ui tests passed');
