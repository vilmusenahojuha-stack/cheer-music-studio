const assert=require('assert');
const workflow=require('../smart-mix-workflow.js');

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

let passedSections=null;
const fakeCores={
  plan:{buildCheerPlan:({bpm,sections})=>({bpm,sections:sections.map(s=>({...s,durationEights:s.endEight-s.startEight+1}))})},
  matcher:{matchPlanSections:(secs,profiles)=>{passedSections=secs;return{coverage:1,averageScore:.9,matches:secs.map((s,i)=>({sectionId:s.id,sectionType:s.type,candidates:[profiles[i]]}))};}},
  sequence:{optimizeMatchedPlan:matchPlan=>({coverage:1,sequence:matchPlan.matches.map(m=>({sectionId:m.sectionId,sectionType:m.sectionType,candidate:m.candidates[0],transition:{combinedScore:.9}}))})},
  package:{createProposalPackage:({optimized,bpm})=>({status:'preview-ready',kind:'smart-mix-2-proposal-package',bpm,summary:{sections:optimized.sequence.length,timelineClips:optimized.sequence.length},audioTimelinePlan:{status:'preview-ready',clips:optimized.sequence.map((s,i)=>({sourceName:s.candidate.sourceName,start:i*6.4,duration:6.4,sourceOffset:s.candidate.start}))}})}
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

const incompleteCores={...fakeCores,matcher:{matchPlanSections:()=>({coverage:2/3,matches:[]})}};
const incomplete=workflow.createProposalFromProfiles(project,[profiles],{cores:incompleteCores});
assert.equal(incomplete.status,'review-required');
assert.equal(incomplete.reason,'not-all-sections-matched');
assert.equal(incomplete.executable,false);

console.log('smart-mix-workflow tests passed');
