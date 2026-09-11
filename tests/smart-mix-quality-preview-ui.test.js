const assert=require('assert');
const ui=require('../smart-mix-quality-preview-ui.js');

const proposal={
  audioTimelinePlan:{clips:[{id:'keep-me'}]},
  smartMixSelectionExplanation:{
    matches:[
      {sectionId:'intro'},
      {sectionId:'stunt'},
      {sectionId:'pyramid'},
      {sectionId:'ending'}
    ]
  },
  smartMixWholeMixQuality:{
    score:.87,
    rating:'strong',
    readyForFxReview:true,
    risks:[],
    reviewTargets:[],
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
assert.equal(view.reviewTargets.length,0);
assert.equal(view.nonDestructive,true);

const risky=ui.buildWholeMixQualityView({
  smartMixWholeMixQuality:{
    score:.59,
    rating:'weak',
    readyForFxReview:false,
    risks:['flat-energy-arc','weak-ending-energy','unknown-risk'],
    reviewTargets:[
      {
        kind:'section',
        sectionId:'ending',
        sectionType:'ending',
        reason:'weak-ending-energy',
        severity:.94,
        evidence:{actualEnergy:.61}
      },
      {
        kind:'transition',
        fromSectionId:'stunt',
        toSectionId:'pyramid',
        reason:'source-overuse',
        severity:.72,
        evidence:{runLength:4}
      },
      {
        kind:'section',
        sectionId:'stunt',
        sectionType:'stunt',
        reason:'energy-mismatch',
        severity:.81
      }
    ],
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

assert.equal(risky.reviewTargets.length,3);
assert.equal(risky.reviewTargets[0].sectionId,'ending');
assert.equal(risky.reviewTargets[0].label,'Lopetus (ending)');
assert.equal(risky.reviewTargets[0].severityPercent,94);
assert.equal(risky.reviewTargets[0].reasonLabel,'Lopetuksen energia jää liian matalaksi');
assert.equal(risky.reviewTargets[1].sectionId,'stunt');
assert.equal(risky.reviewTargets[1].label,'Stuntti (stunt)');
assert.equal(risky.reviewTargets[2].kind,'transition');
assert.equal(risky.reviewTargets[2].label,'Siirtymä stunt → pyramid');
assert.equal(risky.reviewTargets[2].reasonLabel,'Samaa lähdekappaletta jatkuu liian pitkään');

assert.equal(ui.reviewNavigationSectionId(risky.reviewTargets[0]),'ending');
assert.equal(ui.reviewNavigationIndex(proposal,risky.reviewTargets[0]),3);
assert.equal(ui.reviewNavigationSectionId(risky.reviewTargets[2]),'pyramid');
assert.equal(ui.reviewNavigationIndex(proposal,risky.reviewTargets[2]),2);

const transitionFallback={kind:'transition',fromSectionId:'stunt',toSectionId:null};
assert.equal(ui.reviewNavigationSectionId(transitionFallback),'stunt');
assert.equal(ui.reviewNavigationIndex(proposal,transitionFallback),1);
assert.equal(ui.reviewNavigationIndex(proposal,{kind:'section',sectionId:'missing'}),-1);
assert.equal(ui.reviewNavigationIndex({},risky.reviewTargets[0]),-1);
assert.equal(ui.navigateToReviewTarget({},risky.reviewTargets[0]),false);

const unknown=ui.buildReviewTargets({
  reviewTargets:[{
    kind:'section',
    sectionId:'x',
    sectionType:'custom',
    reason:'custom-review',
    severity:2
  }]
});
assert.equal(unknown[0].label,'Osuus (x)');
assert.equal(unknown[0].reasonLabel,'custom-review');
assert.equal(unknown[0].severityPercent,100);

const missing=ui.buildWholeMixQualityView({});
assert.equal(missing.available,false);
assert.equal(missing.readyForFxReview,false);
assert.equal(missing.reviewTargets.length,0);
assert.equal(missing.nonDestructive,true);

const project={
  intelligentMix:{
    proposalPackage:proposal
  }
};
assert.strictEqual(ui.wholeMixPackage(project),proposal);

assert.deepEqual(proposal.audioTimelinePlan,{clips:[{id:'keep-me'}]});
assert.deepEqual(proposal.smartMixSelectionExplanation.matches.map(row=>row.sectionId),['intro','stunt','pyramid','ending']);

console.log('smart-mix whole quality preview navigation tests passed');