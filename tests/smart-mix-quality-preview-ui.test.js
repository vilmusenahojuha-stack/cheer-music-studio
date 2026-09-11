const assert=require('assert');
const ui=require('../smart-mix-quality-preview-ui.js');

const proposal={
  audioTimelinePlan:{clips:[{id:'keep-me'}]},
  smartMixSelectionExplanation:{matches:[{sectionId:'stunt'}]},
  smartMixWholeMixQuality:{
    score:.87,
    rating:'strong',
    readyForFxReview:true,
    risks:[],
    components:{
      energyArc:{score:.91},
      sourceVariety:{score:.79},
      structure:{score:.94},
      matchCoherence:{score:.84}
    },
    nonDestructive:true
  }
};

const view=ui.buildWholeMixQualityView(proposal);
assert.equal(view.available,true);
assert.equal(view.scorePercent,87);
assert.equal(view.rating,'strong');
assert.equal(view.ratingLabel,'Vahva');
assert.equal(view.readyForFxReview,true);
assert.equal(view.components.length,4);
assert.equal(view.components.find(row=>row.code==='energyArc').percent,91);
assert.equal(view.risks.length,0);
assert.equal(view.nonDestructive,true);

const risky=ui.buildWholeMixQualityView({
  smartMixWholeMixQuality:{
    score:.59,
    rating:'weak',
    readyForFxReview:false,
    risks:['flat-energy-arc','weak-ending-energy','unknown-risk'],
    components:{
      energyArc:{score:.45},
      sourceVariety:{score:.70},
      structure:{score:.58},
      matchCoherence:{score:.65}
    }
  }
});
assert.equal(risky.ratingLabel,'Heikko');
assert.equal(risky.readyForFxReview,false);
assert.equal(risky.risks[0].label,'Energiakaari on liian tasainen cheer-kokonaisuuteen');
assert.equal(risky.risks[1].label,'Lopetuksen energia jää liian matalaksi');
assert.equal(risky.risks[2].label,'unknown-risk');

const missing=ui.buildWholeMixQualityView({});
assert.equal(missing.available,false);
assert.equal(missing.readyForFxReview,false);
assert.equal(missing.nonDestructive,true);

const project={
  intelligentMix:{
    proposalPackage:proposal
  }
};
assert.strictEqual(ui.wholeMixPackage(project),proposal);

assert.deepEqual(proposal.audioTimelinePlan,{clips:[{id:'keep-me'}]});
assert.deepEqual(proposal.smartMixSelectionExplanation,{matches:[{sectionId:'stunt'}]});

console.log('smart-mix whole quality preview tests passed');