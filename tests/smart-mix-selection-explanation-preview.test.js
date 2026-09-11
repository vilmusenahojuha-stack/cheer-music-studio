const assert=require('assert');
const ui=require('../smart-mix-preview-ui.js');

const proposal={
  status:'preview-ready',
  smartMixSelectionExplanation:{
    matchedSections:2,
    totalSections:2,
    nonDestructive:true,
    matches:[
      {
        sectionId:'section-1',
        sectionType:'stunt',
        explanation:{
          selected:true,
          confidence:.91,
          sourceName:'A.wav',
          startEight:5,
          endEight:8,
          primaryReason:{code:'purpose',label:'sopii osuuden tarkoitukseen'},
          reasons:[
            {code:'purpose',label:'sopii osuuden tarkoitukseen',weight:.96},
            {code:'transition',label:'sisääntulo tukee break/drop-rakennetta',weight:.88},
            {code:'boundary',label:'osuu luotettavaan fraasi- tai section-rajaan',weight:.84}
          ]
        }
      },
      {
        sectionId:'section-2',
        sectionType:'pyramid',
        explanation:{
          selected:true,
          confidence:.73,
          sourceName:'B.wav',
          startEight:9,
          endEight:12,
          primaryReason:{code:'boundary',label:'osuu luotettavaan fraasi- tai section-rajaan'},
          reasons:[
            {code:'boundary',label:'osuu luotettavaan fraasi- tai section-rajaan',weight:.8}
          ]
        }
      }
    ]
  }
};

const view=ui.buildSelectionExplanationView(proposal);
assert.equal(view.available,true);
assert.equal(view.nonDestructive,true);
assert.equal(view.matchedSections,2);
assert.equal(view.totalSections,2);
assert.equal(view.sections.length,2);

assert.equal(view.sections[0].label,'Stuntti');
assert.equal(view.sections[0].sourceName,'A.wav');
assert.equal(view.sections[0].startEight,5);
assert.equal(view.sections[0].endEight,8);
assert.equal(view.sections[0].primaryReason,'sopii osuuden tarkoitukseen');
assert.equal(view.sections[0].reasons.length,3);
assert.equal(view.sections[0].reasons[1].code,'transition');
assert.ok(Math.abs(view.sections[0].confidence-.91)<1e-9);

assert.equal(view.sections[1].label,'Pyramidi');
assert.equal(view.sections[1].sourceName,'B.wav');
assert.equal(view.sections[1].primaryReason,'osuu luotettavaan fraasi- tai section-rajaan');
assert.ok(Math.abs(view.sections[1].confidence-.73)<1e-9);

const absent=ui.buildSelectionExplanationView({status:'preview-ready'});
assert.equal(absent.available,false);
assert.deepEqual(absent.sections,[]);
assert.equal(absent.nonDestructive,true);

const malformed=ui.buildSelectionExplanationView({
  smartMixSelectionExplanation:{matches:[{sectionType:'unknown',explanation:{selected:false,confidence:3,reasons:[]}}]}
});
assert.equal(malformed.available,true);
assert.equal(malformed.sections[0].label,'Osuus');
assert.equal(malformed.sections[0].confidence,1,'confidence must be safely clamped');
assert.equal(malformed.sections[0].sourceName,null);

console.log('smart-mix selection explanation preview tests passed');
