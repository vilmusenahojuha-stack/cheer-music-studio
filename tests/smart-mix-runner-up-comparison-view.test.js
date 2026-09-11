const assert=require('assert');
const view=require('../smart-mix-runner-up-comparison-view.js');

const explanation={
  comparison:{
    selected:{
      sourceName:'A.wav',
      trackId:'track-a',
      startEight:5,
      endEight:8,
      score:.91,
      primaryReason:{code:'purpose',label:'sopii osuuden tarkoitukseen'},
      reasons:[
        {code:'purpose',label:'sopii osuuden tarkoitukseen',score:.96},
        {code:'energy',label:'energiataso sopii osuuteen',score:.92},
        {code:'transition',label:'sisääntulo tukee break/drop-rakennetta',score:.90}
      ]
    },
    runnerUp:{
      sourceName:'B.wav',
      trackId:'track-b',
      startEight:13,
      endEight:16,
      score:.84,
      primaryReason:{code:'boundary',label:'osuu hyvään fraasirajaan'},
      reasons:[
        {code:'purpose',label:'sopii osuuden tarkoitukseen',score:.71},
        {code:'energy',label:'energiataso sopii osuuteen',score:.78},
        {code:'transition',label:'sisääntulo tukee break/drop-rakennetta',score:.82},
        {code:'boundary',label:'osuu hyvään fraasirajaan',score:.95}
      ]
    },
    scoreMargin:.07,
    sameSource:false,
    nonDestructive:true
  }
};

const comparison=view.buildRunnerUpComparisonView(explanation);
assert.equal(comparison.available,true);
assert.equal(comparison.nonDestructive,true);
assert.equal(comparison.selected.label,'Valittu');
assert.equal(comparison.runnerUp.label,'2. paras');
assert.equal(comparison.selected.sourceName,'A.wav');
assert.equal(comparison.selected.rangeText,'8-countit 5–8');
assert.equal(comparison.selected.scorePercent,91);
assert.equal(comparison.selected.primaryReason,'sopii osuuden tarkoitukseen');
assert.equal(comparison.runnerUp.sourceName,'B.wav');
assert.equal(comparison.runnerUp.rangeText,'8-countit 13–16');
assert.equal(comparison.runnerUp.scorePercent,84);
assert.equal(comparison.scoreMarginPercent,7);
assert.equal(comparison.sourceRelation,'Eri lähdekappaleet');
assert.equal(comparison.reviewRecommended,false);
assert.match(comparison.advantageText,/7 prosenttiyksikköä/);

const purpose=comparison.criterionRows.find(row=>row.code==='purpose');
assert.deepEqual(
  {
    label:purpose.label,
    selectedPercent:purpose.selectedPercent,
    runnerUpPercent:purpose.runnerUpPercent,
    deltaPercent:purpose.deltaPercent,
    advantage:purpose.advantage
  },
  {
    label:'Osuuden tarkoitus',
    selectedPercent:96,
    runnerUpPercent:71,
    deltaPercent:25,
    advantage:'selected'
  }
);

const boundary=comparison.criterionRows.find(row=>row.code==='boundary');
assert.equal(boundary.selectedPercent,null);
assert.equal(boundary.runnerUpPercent,95);
assert.equal(boundary.deltaPercent,null);
assert.equal(boundary.advantage,'unknown');

const close=view.buildRunnerUpComparisonView({
  comparison:{
    selected:{sourceName:'A.wav',startEight:1,endEight:4,score:.88,reasons:[{code:'energy',score:.84}]},
    runnerUp:{sourceName:'A.wav',startEight:9,endEight:12,score:.86,reasons:[{code:'energy',score:.86}]},
    scoreMargin:.02,
    sameSource:true
  }
});
assert.equal(close.available,true);
assert.equal(close.sameSource,true);
assert.equal(close.sourceRelation,'Sama lähdekappale');
assert.equal(close.reviewRecommended,true);
assert.match(close.advantageText,/tarkista korvakuulolta/);
assert.equal(close.criterionRows[0].code,'energy');
assert.equal(close.criterionRows[0].advantage,'runnerUp');
assert.equal(close.criterionRows[0].deltaPercent,-2);

const tied=view.buildRunnerUpComparisonView({
  comparison:{
    selected:{sourceName:'A.wav',score:.80,reasons:[{code:'phrase',score:.9}]},
    runnerUp:{sourceName:'B.wav',score:.80,reasons:[{code:'phrase',score:.9}]},
    scoreMargin:0,
    sameSource:false
  }
});
assert.equal(tied.scoreMarginPercent,0);
assert.equal(tied.reviewRecommended,true);
assert.match(tied.advantageText,/hyvin tasainen/);
assert.equal(tied.criterionRows[0].advantage,'tie');

const missing=view.buildRunnerUpComparisonView({});
assert.equal(missing.available,false);
assert.equal(missing.selected,null);
assert.equal(missing.runnerUp,null);
assert.deepEqual(missing.criterionRows,[]);
assert.equal(missing.nonDestructive,true);

const malformed=view.buildRunnerUpComparisonView({
  comparison:{
    selected:{sourceName:'A.wav',startEight:-3,endEight:2,score:4,reasons:[{code:'energy',score:4}]},
    runnerUp:{sourceName:'B.wav',score:-2,reasons:[{code:'energy',score:-2}]},
    scoreMargin:9,
    sameSource:false
  }
});
assert.equal(malformed.selected.startEight,1);
assert.equal(malformed.selected.scorePercent,100);
assert.equal(malformed.runnerUp.scorePercent,0);
assert.equal(malformed.scoreMarginPercent,100);
assert.equal(malformed.criterionRows[0].selectedPercent,100);
assert.equal(malformed.criterionRows[0].runnerUpPercent,0);

console.log('smart-mix runner-up comparison criterion tests passed');
