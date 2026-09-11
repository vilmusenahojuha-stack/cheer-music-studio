const assert=require('assert');
const comparisonView=require('../smart-mix-runner-up-comparison-view.js');
global.window={SmartMixRunnerUpComparisonView:comparisonView};
const ui=require('../smart-mix-runner-up-comparison-ui.js');

const explanationA={
  comparison:{
    selected:{
      sourceName:'A.wav',trackId:'a',startEight:5,endEight:8,score:.91,
      primaryReason:{label:'sopii stunt-osuuden tarkoitukseen'},
      reasons:[
        {code:'purpose',score:.96,label:'sopii stunt-osuuden tarkoitukseen'},
        {code:'energy',score:.92,label:'energia sopii'},
        {code:'transition',score:.90,label:'drop toimii'}
      ]
    },
    runnerUp:{
      sourceName:'B.wav',trackId:'b',startEight:13,endEight:16,score:.84,
      primaryReason:{label:'osuu hyvään fraasirajaan'},
      reasons:[
        {code:'purpose',score:.71,label:'purpose'},
        {code:'energy',score:.78,label:'energia'},
        {code:'transition',score:.82,label:'drop'},
        {code:'boundary',score:.95,label:'rakenneraja'}
      ]
    },
    scoreMargin:.07,
    sameSource:false
  }
};
const explanationB={
  comparison:{
    selected:{
      sourceName:'C.wav',startEight:1,endEight:4,score:.88,
      reasons:[{code:'energy',score:.84}]
    },
    runnerUp:{
      sourceName:'C.wav',startEight:9,endEight:12,score:.86,
      reasons:[{code:'energy',score:.86}]
    },
    scoreMargin:.02,
    sameSource:true
  }
};

const project={
  intelligentMix:{
    proposalPackage:{
      smartMixSelectionExplanation:{
        matches:[
          {sectionId:'stunt-1',explanation:explanationA},
          {sectionId:'pyramid-1',explanation:explanationB}
        ]
      },
      audioTimelinePlan:{clips:[{id:'keep'}]}
    }
  }
};

const sectionModel=ui.buildComparisonPanelModel(project,{
  kind:'section',sectionId:'stunt-1'
});
assert.equal(sectionModel.available,true);
assert.equal(sectionModel.sectionId,'stunt-1');
assert.equal(sectionModel.title,'Valittu vs. 2. paras');
assert.equal(sectionModel.selected.sourceName,'A.wav');
assert.equal(sectionModel.selected.rangeText,'8-countit 5–8');
assert.equal(sectionModel.selected.scorePercent,91);
assert.equal(sectionModel.selected.primaryReason,'sopii stunt-osuuden tarkoitukseen');
assert.equal(sectionModel.runnerUp.sourceName,'B.wav');
assert.equal(sectionModel.runnerUp.scorePercent,84);
assert.equal(sectionModel.scoreMarginPercent,7);
assert.equal(sectionModel.sourceRelation,'Eri lähdekappaleet');
assert.equal(sectionModel.reviewRecommended,false);
assert.equal(sectionModel.nonDestructive,true);
assert.ok(sectionModel.criterionRows.length>=4);

const purpose=sectionModel.criterionRows.find(row=>row.code==='purpose');
assert.equal(purpose.selectedPercent,96);
assert.equal(purpose.runnerUpPercent,71);
assert.equal(purpose.deltaPercent,25);
assert.equal(
  ui.criterionLine(purpose),
  'Osuuden tarkoitus: 96% vs 71% · +25 %-yks.'
);

const boundary=sectionModel.criterionRows.find(row=>row.code==='boundary');
assert.equal(
  ui.criterionLine(boundary),
  'Rakenneraja: – vs 95%'
);

const transitionModel=ui.buildComparisonPanelModel(project,{
  kind:'transition',fromSectionId:'stunt-1',toSectionId:'pyramid-1'
});
assert.equal(transitionModel.available,true);
assert.equal(transitionModel.sectionId,'pyramid-1');
assert.equal(transitionModel.selected.sourceName,'C.wav');
assert.equal(transitionModel.sourceRelation,'Sama lähdekappale');
assert.equal(transitionModel.scoreMarginPercent,2);
assert.equal(transitionModel.reviewRecommended,true);
assert.equal(transitionModel.criterionRows[0].advantage,'runnerUp');

const fallbackTransition=ui.navigationSectionId({
  kind:'transition',fromSectionId:'stunt-1'
});
assert.equal(fallbackTransition,'stunt-1');

const missing=ui.buildComparisonPanelModel(project,{
  kind:'section',sectionId:'missing'
});
assert.equal(missing.available,false);
assert.equal(missing.sectionId,'missing');
assert.deepEqual(missing.criterionRows,[]);
assert.equal(missing.nonDestructive,true);

assert.equal(
  ui.candidateLine(sectionModel.selected),
  'Valittu · A.wav · 8-countit 5–8 · 91%'
);

assert.deepEqual(project.intelligentMix.proposalPackage.audioTimelinePlan,{clips:[{id:'keep'}]});

console.log('smart-mix runner-up criterion UI integration tests passed');
