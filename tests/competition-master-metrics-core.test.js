'use strict';

const assert=require('assert');
const Metrics=require('../competition-master-metrics-core');
const MasterInput=require('../competition-master-input-core');

function makeBuffer({sampleRate=1000,durationSeconds=10,segments=[]}={}){
  const length=Math.floor(sampleRate*durationSeconds);
  const left=new Float32Array(length);
  const right=new Float32Array(length);
  for(let i=0;i<length;i++){
    const time=i/sampleRate;
    const segment=segments.find(item=>time>=item.start&&time<item.end);
    const amplitude=segment?segment.amplitude:0;
    const sample=amplitude*Math.sin(2*Math.PI*50*time);
    left[i]=sample;
    right[i]=sample;
  }
  return {
    sampleRate,
    numberOfChannels:2,
    length,
    duration:length/sampleRate,
    getChannelData(channel){return channel===0?left:right;}
  };
}

const buffer=makeBuffer({segments:[
  {start:0,end:5,amplitude:.1},
  {start:5,end:10,amplitude:.4}
]});
const before=[buffer.getChannelData(0)[123],buffer.getChannelData(0)[6123]];
const sections=[
  {id:'intro',sectionType:'intro',startSeconds:0,endSeconds:5},
  {id:'dance',sectionType:'dance',startSeconds:5,endSeconds:10}
];

const measurement=Metrics.measurePostVoiceoverMix(buffer,sections,{maxSeconds:30});
assert.equal(measurement.kind,'cheer-competition-master-metrics');
assert.equal(measurement.stage,'post-voiceover-mix');
assert.equal(measurement.nonDestructive,true);
assert.equal(measurement.sections.length,2);
assert.equal(measurement.sections[0].id,'intro');
assert.equal(measurement.sections[1].type,'dance');
assert(Number.isFinite(measurement.truePeakDbtp));
assert(Number.isFinite(measurement.integratedLufs));
assert(Number.isFinite(measurement.loudnessRangeLu));
assert(measurement.loudnessRangeLu>3,'changing energy should produce a meaningful loudness range');
assert(measurement.sectionPeaksDb[1]>measurement.sectionPeaksDb[0]+8,'dance section should measure clearly louder than intro');
assert(Math.abs(measurement.truePeakDbtp-(-8))<1,'0.4 peak should measure close to -8 dBTP');
assert.deepEqual([buffer.getChannelData(0)[123],buffer.getChannelData(0)[6123]],before,'measurement must not mutate PCM');

const metrics=Metrics.toMasterInputMetrics(measurement);
assert.deepEqual(metrics.sectionPeaksDb,measurement.sectionPeaksDb);
assert.equal(metrics.stage,'post-voiceover-mix');
assert.equal(metrics.truePeakDbtp,measurement.truePeakDbtp);
assert.equal(metrics.loudnessRangeLu,measurement.loudnessRangeLu);

const voiceoverPackage={kind:'cheer-voiceover-competition-package',status:'ready',selected:[]};
const masterInput=MasterInput.buildCompetitionMasterInput({metrics,voiceoverPackage});
assert.equal(masterInput.kind,'cheer-competition-master-input');
assert.equal(masterInput.status,'ready');
assert.equal(masterInput.metrics.truePeakDbtp,measurement.truePeakDbtp);
assert.deepEqual(masterInput.metrics.sectionPeaksDb,measurement.sectionPeaksDb);

const invalid=Metrics.toMasterInputMetrics({...measurement,stage:'pre-voiceover-mix'});
assert.equal(invalid,null,'pre-voiceover measurements must not cross the master-input bridge');

console.log('rendered post-voiceover competition master metrics checks passed');
