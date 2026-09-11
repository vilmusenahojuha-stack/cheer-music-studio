const assert=require('assert');
const workflow=require('../smart-mix-workflow.js');

function makeProfile(){
  const profile=[
    {sourceName:'song.wav',trackId:'track-1',eight:1,energy:.8},
    {sourceName:'song.wav',trackId:'track-1',eight:2,energy:.85},
    {sourceName:'song.wav',trackId:'track-1',eight:3,energy:.9},
    {sourceName:'song.wav',trackId:'track-1',eight:4,energy:.92}
  ];
  Object.defineProperty(profile,'structuralAnalysis',{
    value:{phrases:[],sections:[],events:[],source:'fallback',confidence:0,nonDestructive:true},
    enumerable:false
  });
  return profile;
}

function makeCores(withQuality=true){
  const calls=[];
  const best={
    sourceName:'song.wav',trackId:'track-1',startEight:1,endEight:4,score:.9,
    features:{averageEnergy:.9}
  };
  const matchPlan={
    coverage:1,matchedSections:1,totalSections:1,
    matches:[{sectionId:'section-1',sectionType:'stunt',best,candidates:[best]}]
  };
  const cores={
    plan:{buildCheerPlan:({sections})=>({sections})},
    matcher:{matchPlanSections:()=>matchPlan},
    sequence:{optimizeMatchedPlan:()=>({coverage:1,sequence:[{sectionId:'section-1',sourceName:'song.wav',trackId:'track-1'}]})},
    package:{createProposalPackage:()=>({
      status:'preview-ready',
      summary:{sections:1,timelineClips:1},
      audioTimelinePlan:{clips:[{sourceName:'song.wav'}]},
      sequence:[{sectionId:'section-1',sourceName:'song.wav',trackId:'track-1'}],
      marker:'package'
    })},
    fxIntegration:{attachStructuralCheerFx:(proposal)=>{
      calls.push('fx');
      if(withQuality)assert.equal(proposal.smartMixWholeMixQuality?.source,'test-quality');
      else assert.equal(proposal.smartMixWholeMixQuality,undefined);
      return {...proposal,structuralCheerFx:{enabled:true}};
    }},
    explanation:{attachExplanationsToProposal:(proposal)=>({...proposal,smartMixSelectionExplanation:{nonDestructive:true}})}
  };
  if(withQuality){
    cores.wholeMixQuality={
      attachProposalQuality:(proposal,plan,passedMatchPlan,options)=>{
        calls.push('quality');
        assert.equal(plan.sections[0].type,'stunt');
        assert.strictEqual(passedMatchPlan,matchPlan);
        assert.equal(options.availableSources,1);
        return {...proposal,smartMixWholeMixQuality:{source:'test-quality',score:.88,rating:'strong',readyForFxReview:true,nonDestructive:true}};
      }
    };
  }
  return {cores,calls};
}

const project={targetBpm:147,eights:[{part:'stunt'},{part:'stunt'},{part:'stunt'},{part:'stunt'}]};
const profiles=[makeProfile()];

const integrated=makeCores(true);
const result=workflow.createProposalFromProfiles(project,profiles,{cores:integrated.cores});
assert.equal(result.status,'preview-ready');
assert.equal(result.smartMixWholeMixQuality.source,'test-quality');
assert.equal(result.smartMixWholeMixQuality.readyForFxReview,true);
assert.equal(result.structuralCheerFx.enabled,true);
assert.equal(result.smartMixSelectionExplanation.nonDestructive,true);
assert.deepEqual(integrated.calls,['quality','fx'],'quality assessment must happen before cheer-FX attachment');
assert.equal(result.audioTimelinePlan.clips[0].sourceName,'song.wav');
assert.equal(result.matchPlan.coverage,1);
assert.equal(result.cheerPlan.sections[0].type,'stunt');

const fallback=makeCores(false);
const withoutQuality=workflow.createProposalFromProfiles(project,profiles,{cores:fallback.cores});
assert.equal(withoutQuality.status,'preview-ready');
assert.equal(withoutQuality.smartMixWholeMixQuality,undefined);
assert.equal(withoutQuality.structuralCheerFx.enabled,true);
assert.deepEqual(fallback.calls,['fx']);

assert.equal(typeof workflow.ensureWholeMixQualityCore,'function');
assert.equal(workflow.ensureWholeMixQualityCore(),false,'Node fallback must not require DOM');

console.log('smart-mix workflow whole quality integration tests passed');
