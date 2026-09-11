const assert=require('assert');
const workflow=require('../smart-mix-workflow.js');

let structureCalls=0;
const profileCore={
  analyzeEightCountEnergy(_samples,opts){
    return [
      {sourceName:opts.sourceName,trackId:opts.trackId,eight:1,start:0,end:3.2,energy:.4},
      {sourceName:opts.sourceName,trackId:opts.trackId,eight:2,start:3.2,end:6.4,energy:.9}
    ];
  },
  detectAudioEnergyEvents(){return [{type:'drop',atEight:2,confidence:.91,sourceName:'A.wav',trackId:'A'}];}
};
const sourceStructure={
  inferSourceStructure(profile,options,cores){
    structureCalls++;
    assert.equal(profile.length,2);
    assert.equal(options.minEventConfidence,.72);
    assert.equal(options.phraseEights,4);
    assert.equal(cores.profileCore,profileCore);
    return {
      phrases:[{phrase:1,startEight:1,endEight:2,confidence:.9,sourceName:'A.wav',trackId:'A'}],
      sections:[{id:'s1',startEight:1,endEight:2,confidence:.91,sourceName:'A.wav',trackId:'A'}],
      events:[{type:'drop',atEight:2,confidence:.91,sourceName:'A.wav',trackId:'A'}],
      source:'energy-transitions',confidence:.91,sourceName:'A.wav',trackId:'A',nonDestructive:true
    };
  }
};

(async()=>{
  const project={eights:[{part:'Stunt'},{part:'Stunt'}]};
  const ready=[{track:{name:'A.wav',id:'A',url:'blob:a'},meta:{oneOffset:.25},bpm:150}];
  const profiles=await workflow.analyzeReadyTracks(project,ready,()=>{}, {
    cores:{profile:profileCore,sourceStructure},
    decodeMono:async()=>({samples:new Float32Array(20),sampleRate:100,duration:7})
  });
  assert.equal(structureCalls,1);
  assert.equal(profiles.length,1);
  assert.equal(profiles[0].structuralAnalysis.source,'energy-transitions');
  assert.equal(profiles[0].structuralAnalysis.sections.length,1);
  assert.equal(profiles[0].structuralAnalysis.phrases[0].trackId,'A');
  assert.equal(profiles[0].structuralAnalysis.nonDestructive,true);
  assert.equal(profiles[0].eightAlignment.useManualCountOne,true,'missing alignment core must keep manual count-one');

  const fallbackProfiles=await workflow.analyzeReadyTracks(project,ready,()=>{}, {
    cores:{profile:profileCore},
    decodeMono:async()=>({samples:new Float32Array(20),sampleRate:100,duration:7})
  });
  assert.equal(fallbackProfiles[0].structuralAnalysis.source,'fallback');
  assert.deepEqual(fallbackProfiles[0].structuralAnalysis.sections,[]);
  assert.deepEqual(fallbackProfiles[0].structuralAnalysis.phrases,[]);
  assert.equal(fallbackProfiles[0].structuralAnalysis.nonDestructive,true);

  console.log('smart-mix source structure integration tests passed');
})().catch(err=>{console.error(err);process.exit(1);});
