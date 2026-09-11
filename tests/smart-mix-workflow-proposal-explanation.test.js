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

function makeCores(withExplanation=true){
  const best={
    sourceName:'song.wav',trackId:'track-1',startEight:1,endEight:4,score:.9,
    components:{energy:.95,continuity:.88},
    features:{averageEnergy:.9},
    phraseBoundary:{phraseEights:4,startAligned:true,endAligned:true,score:1},
    boundarySource:'fixed-phrase'
  };
  const matchPlan={
    coverage:1,matchedSections:1,totalSections:1,
    matches:[{sectionId:'section-1',sectionType:'stunt',best,candidates:[best]}]
  };
  const cores={
    plan:{buildCheerPlan:({sections})=>({sections})},
    matcher:{matchPlanSections:()=>matchPlan},
    sequence:{optimizeMatchedPlan:()=>({coverage:1,sequence:[{id:'section-1'}]})},
    package:{createProposalPackage:()=>({
      status:'preview-ready',
      summary:{sections:1,timelineClips:1},
      audioTimelinePlan:{clips:[{sourceName:'song.wav'}]},
      marker:'package'
    })},
    fxIntegration:{attachStructuralCheerFx:(proposal)=>({...proposal,structuralCheerFx:{enabled:true}})}
  };
  if(withExplanation){
    cores.explanation={
      attachExplanationsToProposal:(proposal,plan)=>({
        ...proposal,
        smartMixSelectionExplanation:{
          source:'smart-mix-match-plan',
          matchedSections:plan.matchedSections,
          totalSections:plan.totalSections,
          nonDestructive:true
        }
      })
    };
  }
  return cores;
}

const project={
  targetBpm:147,
  eights:[
    {part:'stunt'},{part:'stunt'},{part:'stunt'},{part:'stunt'}
  ]
};
const profiles=[makeProfile()];

const explained=workflow.createProposalFromProfiles(project,profiles,{cores:makeCores(true)});
assert.equal(explained.status,'preview-ready');
assert.equal(explained.marker,'package');
assert.equal(explained.structuralCheerFx.enabled,true);
assert.equal(explained.smartMixSelectionExplanation.source,'smart-mix-match-plan');
assert.equal(explained.smartMixSelectionExplanation.matchedSections,1);
assert.equal(explained.smartMixSelectionExplanation.nonDestructive,true);
assert.equal(explained.matchPlan.coverage,1);
assert.equal(explained.cheerPlan.sections[0].type,'stunt');
assert.equal(explained.audioTimelinePlan.clips[0].sourceName,'song.wav');

const fallback=workflow.createProposalFromProfiles(project,profiles,{cores:makeCores(false)});
assert.equal(fallback.status,'preview-ready');
assert.equal(fallback.marker,'package');
assert.equal(fallback.structuralCheerFx.enabled,true);
assert.equal(fallback.smartMixSelectionExplanation,undefined);
assert.equal(fallback.audioTimelinePlan.clips.length,1);

assert.equal(typeof workflow.ensureSelectionExplanationCore,'function');
assert.equal(workflow.ensureSelectionExplanationCore(),false,'Node fallback must not require DOM');

console.log('smart-mix workflow proposal explanation integration tests passed');
