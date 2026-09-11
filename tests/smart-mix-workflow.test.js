const assert=require('assert');
const workflow=require('../smart-mix-workflow.js');
const fs=require('fs');

const source=fs.readFileSync(require.resolve('../smart-mix-workflow.js'),'utf8');
assert.match(source,/cheer-eight-alignment-core\.js\?v=5\.0p2m/,'browser workflow must load the analysis-driven 8-count alignment core');
assert.doesNotMatch(source,/meta\.oneOffset\s*=(?!=)/,'Smart Mix alignment must not overwrite the saved manual count-one');

const eights=[{part:'Intro'},{part:'Intro'},{part:'Stunt'},{part:'Stunt'},{part:'Dance'},{part:'Dance'}];
const sections=workflow.buildSectionsFromEights(eights);
assert.deepEqual(sections.map(s=>[s.type,s.startEight,s.endEight,s.energy]),[
  ['intro',1,2,'medium'],['stunt',3,4,'peak'],['dance',5,6,'high']
]);

const project={targetBpm:150,eights,tracks:[{name:'A.wav',url:'blob:a'},{name:'B.wav',url:'blob:b'}],trackAnalysis:{
  'A.wav':{bpm:150,confidence:.8,method:'auto',oneOffset:0},'B.wav':{bpm:148,confidence:.9,method:'auto',oneOffset:.1}
}};
assert.equal(workflow.validateTrackReadiness(project).ok,true);
const bad=JSON.parse(JSON.stringify(project));bad.trackAnalysis['B.wav'].oneOffset=null;
assert.equal(workflow.validateTrackReadiness(bad).ok,false);
assert.equal(workflow.validateTrackReadiness(bad).issues[0].reason,'count-one-missing');

const structuralProfile=[
  {sourceName:'A.wav',trackId:'A',eight:1,start:0,end:3.2},
  {sourceName:'A.wav',trackId:'A',eight:2,start:3.2,end:6.4}
];
Object.defineProperty(structuralProfile,'structuralAnalysis',{value:{
  phrases:[{phrase:1,startEight:1,endEight:2,confidence:.9}],
  sections:[{id:'src-a-1',startEight:1,endEight:2,confidence:.88}]
},enumerable:false});
const collected=workflow.collectDetectedStructure([structuralProfile]);
assert.equal(collected.nonDestructive,true);
assert.equal(collected.phrases.length,1);
assert.equal(collected.sections.length,1);
assert.equal(collected.phrases[0].sourceName,'A.wav');
assert.equal(collected.phrases[0].trackId,'A');
assert.equal(collected.sections[0].sourceName,'A.wav');
assert.equal(collected.sections[0].trackId,'A');

let passedSections=null;
let passedMatcherOptions=null;
let fxAttachCalls=0;
const fakeCores={
  plan:{buildCheerPlan:({bpm,sections})=>({bpm,sections:sections.map(s=>({...s,durationEights:s.endEight-s.startEight+1}))})},
  matcher:{matchPlanSections:(secs,profiles,opts)=>{passedSections=secs;passedMatcherOptions=opts;return{coverage:1,averageScore:.9,matches:secs.map((s,i)=>({sectionId:s.id,sectionType:s.type,candidates:[profiles[i]]}))};}},
  sequence:{optimizeMatchedPlan:matchPlan=>({coverage:1,sequence:matchPlan.matches.map(m=>({sectionId:m.sectionId,sectionType:m.sectionType,candidate:m.candidates[0],transition:{combinedScore:.9}}))})},
  package:{createProposalPackage:({optimized,bpm})=>({status:'preview-ready',kind:'smart-mix-2-proposal-package',bpm,summary:{sections:optimized.sequence.length,timelineClips:optimized.sequence.length},audioTimelinePlan:{status:'preview-ready',clips:optimized.sequence.map((s,i)=>({sourceName:s.candidate.sourceName,start:i*6.4,duration:6.4,sourceOffset:s.candidate.start}))}})},
  fxIntegration:{attachStructuralCheerFx:proposal=>{fxAttachCalls++;return{...proposal,cheerFx:{status:'preview-planned',anchors:[{kind:'impact',at:6.4,sectionType:'stunt'}]},audioTimelinePlan:{...proposal.audioTimelinePlan,cheerFxAnchors:[{kind:'impact',at:6.4,sectionType:'stunt'}]},summary:{...proposal.summary,cheerFxAnchors:1}};}}
};
const profiles=[
 {sourceName:'A.wav',trackId:'A',startEight:1,endEight:2,start:0,end:6.4,score:.9},
 {sourceName:'B.wav',trackId:'B',startEight:3,endEight:4,start:3.2,end:9.6,score:.91},
 {sourceName:'A.wav',trackId:'A',startEight:5,endEight:6,start:12.8,end:19.2,score:.88}
];
const proposal=workflow.createProposalFromProfiles(project,[profiles],{cores:fakeCores});
assert.equal(proposal.status,'preview-ready');
assert.equal(proposal.summary.sections,3);
assert.equal(proposal.audioTimelinePlan.clips[1].sourceName,'B.wav');
assert.equal(passedSections[1].type,'stunt');
assert.equal(proposal.sourceProfiles,3);
assert.equal(fxAttachCalls,1);
assert.equal(proposal.cheerFx.status,'preview-planned');
assert.equal(proposal.summary.cheerFxAnchors,1);
assert.equal(proposal.audioTimelinePlan.cheerFxAnchors[0].at,6.4);
assert.deepEqual(passedMatcherOptions.phrases,[],'plain profiles must keep detected-boundary input empty');
assert.deepEqual(passedMatcherOptions.detectedSections,[],'plain profiles must keep detected section input empty');
assert.equal(passedMatcherOptions.minBoundaryConfidence,.72);

const structuralProposalProfile=[...profiles];
Object.defineProperty(structuralProposalProfile,'structuralAnalysis',{value:{
  phrases:[{phrase:1,startEight:1,endEight:2,confidence:.91,sourceName:'A.wav',trackId:'A'}],
  sections:[{id:'music-a',startEight:1,endEight:2,confidence:.89,sourceName:'A.wav',trackId:'A'}]
},enumerable:false});
const proposalWithStructure=workflow.createProposalFromProfiles(project,[structuralProposalProfile],{cores:fakeCores,minBoundaryConfidence:.8});
assert.equal(proposalWithStructure.status,'preview-ready');
assert.equal(passedMatcherOptions.phrases.length,1,'detected phrases must reach matcher automatically');
assert.equal(passedMatcherOptions.detectedSections.length,1,'detected source sections must reach matcher automatically');
assert.equal(passedMatcherOptions.minBoundaryConfidence,.8);
assert.equal(proposalWithStructure.detectedStructure.phrases.length,1);
assert.equal(proposalWithStructure.detectedStructure.sections.length,1);
assert.equal(proposalWithStructure.detectedStructure.nonDestructive,true);

const incompleteCores={...fakeCores,matcher:{matchPlanSections:()=>({coverage:2/3,matches:[]})}};
const incomplete=workflow.createProposalFromProfiles(project,[profiles],{cores:incompleteCores});
assert.equal(incomplete.status,'review-required');
assert.equal(incomplete.reason,'not-all-sections-matched');
assert.equal(incomplete.executable,false);
assert.equal(fxAttachCalls,2,'FX integration must not run for an incomplete sequence');

(async()=>{
  const analysisProject={
    targetBpm:120,
    eights:[{part:'Intro'},{part:'Intro'},{part:'Stunt'},{part:'Stunt'}],
    tracks:[{id:'track-a',name:'Aligned.wav',url:'blob:aligned'}],
    trackAnalysis:{'Aligned.wav':{bpm:120,confidence:.9,method:'auto',oneOffset:.1}}
  };
  const ready=workflow.validateTrackReadiness(analysisProject).ready;
  const offsets=[];
  const profileCore={
    analyzeEightCountEnergy:(samples,opts)=>{
      offsets.push(opts.oneOffset);
      return Array.from({length:opts.totalEights},(_,i)=>({
        sourceName:opts.sourceName,
        trackId:opts.trackId,
        startEight:i+1,
        endEight:i+1,
        start:opts.oneOffset+i*4,
        end:opts.oneOffset+(i+1)*4
      }));
    },
    detectAudioEnergyEvents:()=>[
      {type:'break',time:4.5,confidence:.94},
      {type:'drop',time:8.5,confidence:.91}
    ]
  };
  let alignmentArgs=null;
  const alignmentCore={
    alignProfileEightCounts:(profile,opts,cores)=>{
      alignmentArgs={profile,opts,cores};
      return {
        accepted:true,
        reason:'alignment-accepted',
        source:'structural-anchors',
        oneOffset:.5,
        alignment:{confidence:.89,support:2},
        reliability:{level:'strong',canAutoUse:true,needsReview:false,useManualCountOne:false,reason:'strong-structural-alignment'},
        nonDestructive:true
      };
    }
  };
  const structureCore={buildIntelligentEightCountMap:()=>({})};
  const decoded={samples:new Float32Array(48000),sampleRate:48000,duration:20.5};
  const analyzed=await workflow.analyzeReadyTracks(analysisProject,ready,()=>{}, {
    decodeMono:async()=>decoded,
    minAlignmentConfidence:.72,
    minAlignmentSupport:2,
    cores:{profile:profileCore,alignment:alignmentCore,structure:structureCore}
  });
  assert.deepEqual(offsets,[.1,.5],'accepted strong alignment must re-analyze once at the refined count-one');
  assert.equal(alignmentArgs.opts.bpm,120);
  assert.equal(alignmentArgs.opts.oneOffset,.1);
  assert.equal(alignmentArgs.opts.minAlignmentConfidence,.72);
  assert.equal(alignmentArgs.opts.minAlignmentSupport,2);
  assert.deepEqual(alignmentArgs.opts.sections.map(s=>s.type),['intro','stunt']);
  assert.equal(alignmentArgs.cores.profileCore,profileCore);
  assert.equal(alignmentArgs.cores.structureCore,structureCore);
  assert.equal(analyzed[0].eightAlignment.accepted,true);
  assert.equal(analyzed[0].eightAlignment.originalOneOffset,.1);
  assert.equal(analyzed[0].eightAlignment.oneOffset,.5);
  assert.equal(analyzed[0].eightAlignment.confidence,.89);
  assert.equal(analyzed[0].eightAlignment.support,2);
  assert.equal(analyzed[0].eightAlignment.reliabilityLevel,'strong');
  assert.equal(analyzed[0].eightAlignment.reanalyzed,true);
  assert.equal(analyzed[0].eightAlignment.nonDestructive,true);

  offsets.length=0;
  const rejected=await workflow.analyzeReadyTracks(analysisProject,ready,()=>{}, {
    decodeMono:async()=>decoded,
    cores:{
      profile:profileCore,
      alignment:{alignProfileEightCounts:()=>({accepted:false,reason:'confidence-below-threshold',oneOffset:.5,alignment:{confidence:.4,support:2},reliability:{level:'manual',canAutoUse:false,useManualCountOne:true}})},
      structure:structureCore
    }
  });
  assert.deepEqual(offsets,[.1],'rejected alignment must keep the existing count-one and avoid re-analysis');
  assert.equal(rejected[0].eightAlignment.accepted,false);
  assert.equal(rejected[0].eightAlignment.oneOffset,.1);
  assert.equal(rejected[0].eightAlignment.reanalyzed,false);

  offsets.length=0;
  const legacy=await workflow.analyzeReadyTracks(analysisProject,ready,()=>{}, {
    decodeMono:async()=>decoded,
    cores:{profile:profileCore}
  });
  assert.deepEqual(offsets,[.1],'missing alignment core must preserve the old single-pass analysis');
  assert.equal(legacy[0].eightAlignment.accepted,false);
  assert.equal(legacy[0].eightAlignment.reason,'alignment-core-unavailable');
  assert.equal(legacy[0].eightAlignment.oneOffset,.1);

  console.log('smart-mix-workflow tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
