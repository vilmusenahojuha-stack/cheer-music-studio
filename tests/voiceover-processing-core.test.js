'use strict';
const assert=require('assert');
const core=require('../voiceover-processing-core.js');

const competitionProject={mixSettings:{voiceoverCompetitionPackage:{kind:'cheer-voiceover-competition-package',selected:[{slotId:'slot-ending',sectionType:'ending',status:'preview-ready'},{slotId:'slot-stunt',sectionType:'stunt',status:'preview-ready'}]}}};
const legacyProject={mixSettings:{}};
const voice={type:'voice',start:12.5,duration:1.75,sourceOffset:.25,volume:.9};
const music={type:'music',start:0,duration:20};

assert.strictEqual(core.processingPlan(legacyProject,voice).active,false,'legacy voiceover must remain unchanged');
assert.strictEqual(core.processingPlan(competitionProject,music).active,false,'music must never receive voice clarity processing');
const plan=core.processingPlan(competitionProject,voice);
assert.strictEqual(plan.active,true);
assert.strictEqual(plan.nonDestructive,true);
assert.strictEqual(plan.timingSafe,true);
assert.strictEqual(plan.sectionAware,true);
assert.strictEqual(plan.sectionType,'other');
assert.deepStrictEqual(plan.stages,['highpass','presence','compressor','speech-gain','output-headroom']);
assert.strictEqual(plan.profile.highpassHz,95);
assert.strictEqual(plan.profile.presenceHz,3000);
assert.strictEqual(plan.profile.presenceDb,2);
assert.strictEqual(plan.profile.compressorRatio,3);
assert(plan.speechGain>1,'competition speech gain should add modest intelligibility gain');
assert(plan.outputGain<1,'output trim must preserve headroom');

const ending=core.processingPlan(competitionProject,{...voice,voiceoverSlotId:'slot-ending'});
const stunt=core.processingPlan(competitionProject,{...voice,voiceoverSlotId:'slot-stunt'});
assert.strictEqual(ending.sectionType,'ending');
assert.strictEqual(ending.sectionProfileId,'competition-voice-ending-v1');
assert.strictEqual(ending.profile.presenceDb,2.8);
assert.strictEqual(ending.profile.speechGainDb,2);
assert.strictEqual(stunt.sectionType,'stunt');
assert.strictEqual(stunt.profile.presenceDb,1.4);
assert.strictEqual(stunt.profile.speechGainDb,1);
assert(ending.speechGain>stunt.speechGain,'ending voice should have more presence headroom than dense stunt voice');

const directDance=core.processingPlan(competitionProject,{...voice,sectionType:'dance',voiceoverSlotId:'slot-ending'});
assert.strictEqual(directDance.sectionType,'dance','explicit clip section metadata must take precedence over package lookup');
assert.strictEqual(directDance.profile.compressorThresholdDb,-16);
assert.strictEqual(core.canonicalSectionType('finale'),'ending');

const custom=core.processingPlan({mixSettings:{...competitionProject.mixSettings,competitionVoiceProcessingProfile:{presenceDb:3.3,speechGainDb:2.4}}},{...voice,sectionType:'stunt'});
assert.strictEqual(custom.sectionType,'stunt');
assert.strictEqual(custom.profile.presenceDb,3.3,'explicit project processing override must win over section preset');
assert.strictEqual(custom.profile.speechGainDb,2.4);

const disabled=core.processingPlan({mixSettings:{voiceoverCompetitionPackage:{kind:'cheer-voiceover-competition-package'},competitionVoiceProcessing:false}},voice);
assert.strictEqual(disabled.active,false,'processing must be explicitly disableable');

const bounded=core.normalizeProfile({highpassHz:500,presenceDb:12,compressorRatio:20,speechGainDb:8,outputHeadroomDb:0});
assert.strictEqual(bounded.highpassHz,180);
assert.strictEqual(bounded.presenceDb,4);
assert.strictEqual(bounded.compressorRatio,6);
assert.strictEqual(bounded.speechGainDb,3);
assert.strictEqual(bounded.outputHeadroomDb,-.5);

function param(){return{value:0};}
function node(kind){return{kind,connections:[],connect(other){this.connections.push(other);return other;}};}
const made=[];
const context={
  createBiquadFilter(){const n=node('biquad');n.frequency=param();n.Q=param();n.gain=param();made.push(n);return n;},
  createDynamicsCompressor(){const n=node('compressor');n.threshold=param();n.knee=param();n.ratio=param();n.attack=param();n.release=param();made.push(n);return n;},
  createGain(){const n=node('gain');n.gain=param();made.push(n);return n;}
};
const chain=core.configureWebAudioNodes(context,ending);
assert(chain,'Web Audio chain should be created');
assert.strictEqual(chain.highpass.type,'highpass');
assert.strictEqual(chain.highpass.frequency.value,95);
assert.strictEqual(chain.presence.type,'peaking');
assert.strictEqual(chain.presence.frequency.value,3000);
assert.strictEqual(chain.presence.gain.value,2.8);
assert.strictEqual(chain.compressor.threshold.value,-20);
assert.strictEqual(chain.compressor.ratio.value,3.2);
assert.strictEqual(chain.speechGain.gain.value,ending.speechGain);
assert.strictEqual(chain.outputGain.gain.value,ending.outputGain);
assert.strictEqual(chain.highpass.connections[0],chain.presence);
assert.strictEqual(chain.presence.connections[0],chain.compressor);
assert.strictEqual(chain.compressor.connections[0],chain.speechGain);
assert.strictEqual(chain.speechGain.connections[0],chain.outputGain);

const original={...voice,voiceoverSlotId:'slot-ending'};
core.processingPlan(competitionProject,original);
assert.deepStrictEqual(original,{...voice,voiceoverSlotId:'slot-ending'},'processing planning must not mutate voice clip timing, gain or section metadata');

console.log('section-aware competition voiceover clarity processing checks passed');