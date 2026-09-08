'use strict';
const assert=require('assert');
const core=require('../voiceover-processing-core.js');

const competitionProject={mixSettings:{voiceoverCompetitionPackage:{kind:'cheer-voiceover-competition-package',selected:[
  {slotId:'slot-ending',sectionType:'ending',role:'final-callout',status:'preview-ready',rhythm:{shape:'phrase',assignedCounts:4}},
  {slotId:'slot-stunt',sectionType:'stunt',role:'support-callout',status:'preview-ready',rhythm:{shape:'hit',assignedCounts:2}},
  {slotId:'slot-dance',sectionType:'dance',role:'energy-callout',status:'preview-ready',rhythm:{shape:'callout',assignedCounts:3}},
  {slotId:'slot-intro',sectionType:'intro',role:'identity-callout',status:'preview-ready',rhythm:{shape:'phrase',assignedCounts:4}}
]}}};
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
assert.strictEqual(plan.roleAware,true);
assert.strictEqual(plan.rhythmAware,true);
assert.strictEqual(plan.sectionType,'other');
assert.strictEqual(plan.role,'other');
assert.strictEqual(plan.rhythmShape,'other');
assert.strictEqual(plan.assignedCounts,null);
assert.deepStrictEqual(plan.stages,['highpass','presence','compressor','speech-gain','output-headroom']);
assert.strictEqual(plan.profile.highpassHz,95);
assert.strictEqual(plan.profile.presenceHz,3000);
assert.strictEqual(plan.profile.presenceDb,2);
assert.strictEqual(plan.profile.compressorRatio,3);
assert(plan.speechGain>1,'competition speech gain should add modest intelligibility gain');
assert(plan.outputGain<1,'output trim must preserve headroom');

const ending=core.processingPlan(competitionProject,{...voice,voiceoverSlotId:'slot-ending'});
const stunt=core.processingPlan(competitionProject,{...voice,voiceoverSlotId:'slot-stunt'});
const dance=core.processingPlan(competitionProject,{...voice,voiceoverSlotId:'slot-dance'});
const intro=core.processingPlan(competitionProject,{...voice,voiceoverSlotId:'slot-intro'});
assert.strictEqual(ending.sectionType,'ending');
assert.strictEqual(ending.role,'final-callout');
assert.strictEqual(ending.rhythmShape,'phrase');
assert.strictEqual(ending.assignedCounts,4);
assert.strictEqual(ending.rhythmProfileId,'competition-voice-rhythm-phrase-v1');
assert.strictEqual(ending.sectionProfileId,'competition-voice-ending-v1');
assert.strictEqual(ending.roleProfileId,'competition-voice-final-callout-v1');
assert.strictEqual(ending.profile.presenceDb,3.2);
assert.strictEqual(ending.profile.compressorThresholdDb,-21);
assert.strictEqual(ending.profile.compressorRatio,3.55);
assert.strictEqual(ending.profile.compressorAttackSeconds,.008);
assert.strictEqual(ending.profile.compressorReleaseSeconds,.16);
assert.strictEqual(ending.profile.speechGainDb,2.3);
assert.strictEqual(ending.profile.outputHeadroomDb,-1.2);
assert.strictEqual(stunt.sectionType,'stunt');
assert.strictEqual(stunt.role,'support-callout');
assert.strictEqual(stunt.rhythmShape,'hit');
assert.strictEqual(stunt.profile.presenceDb,1.1);
assert.strictEqual(stunt.profile.compressorThresholdDb,-15);
assert.strictEqual(stunt.profile.compressorRatio,2.4);
assert.strictEqual(stunt.profile.compressorAttackSeconds,.004);
assert.strictEqual(stunt.profile.compressorReleaseSeconds,.085);
assert.strictEqual(stunt.profile.speechGainDb,.8);
assert.strictEqual(dance.role,'energy-callout');
assert.strictEqual(dance.rhythmShape,'callout');
assert.strictEqual(dance.profile.compressorAttackSeconds,.004);
assert.strictEqual(dance.profile.compressorReleaseSeconds,.09);
assert.strictEqual(intro.role,'identity-callout');
assert.strictEqual(intro.rhythmShape,'phrase');
assert.strictEqual(intro.profile.presenceDb,2.7);
assert.strictEqual(intro.profile.compressorAttackSeconds,.008);
assert.strictEqual(intro.profile.compressorReleaseSeconds,.16);
assert(ending.speechGain>stunt.speechGain,'final callout should have more presence headroom than support callout');
assert(ending.profile.compressorReleaseSeconds>stunt.profile.compressorReleaseSeconds,'long phrase should release more smoothly than short hit');

const directDance=core.processingPlan(competitionProject,{...voice,sectionType:'dance',voiceoverRole:'energy-callout',voiceoverRhythmShape:'hit',voiceoverAssignedCounts:2,voiceoverSlotId:'slot-ending'});
assert.strictEqual(directDance.sectionType,'dance','explicit clip section metadata must take precedence over package lookup');
assert.strictEqual(directDance.role,'energy-callout','explicit clip role metadata must take precedence over package lookup');
assert.strictEqual(directDance.rhythmShape,'hit','explicit clip rhythm metadata must take precedence over package lookup');
assert.strictEqual(directDance.assignedCounts,2);
assert.strictEqual(directDance.profile.compressorThresholdDb,-15);
assert.strictEqual(directDance.profile.compressorRatio,2.6);
assert.strictEqual(directDance.profile.compressorAttackSeconds,.003);
assert.strictEqual(directDance.profile.compressorReleaseSeconds,.065);
assert.strictEqual(directDance.profile.speechGainDb,1.1);
assert.strictEqual(core.canonicalSectionType('finale'),'ending');
assert.strictEqual(core.canonicalRole('tag'),'final-callout');
assert.strictEqual(core.canonicalRole('hype-callout'),'energy-callout');
assert.strictEqual(core.canonicalRole('unknown-role'),'other');
assert.strictEqual(core.canonicalRhythmShape('',2),'hit');
assert.strictEqual(core.canonicalRhythmShape('',3),'callout');
assert.strictEqual(core.canonicalRhythmShape('',4),'phrase');
assert.strictEqual(core.canonicalRhythmShape('unknown',null),'other');

const custom=core.processingPlan({mixSettings:{...competitionProject.mixSettings,competitionVoiceProcessingProfile:{presenceDb:3.3,speechGainDb:2.4,compressorReleaseSeconds:.2}}},{...voice,voiceoverSlotId:'slot-stunt'});
assert.strictEqual(custom.sectionType,'stunt');
assert.strictEqual(custom.role,'support-callout');
assert.strictEqual(custom.rhythmShape,'hit');
assert.strictEqual(custom.profile.presenceDb,3.3,'explicit project processing override must win over section, role and rhythm policy');
assert.strictEqual(custom.profile.speechGainDb,2.4);
assert.strictEqual(custom.profile.compressorReleaseSeconds,.2);

const disabled=core.processingPlan({mixSettings:{voiceoverCompetitionPackage:{kind:'cheer-voiceover-competition-package'},competitionVoiceProcessing:false}},voice);
assert.strictEqual(disabled.active,false,'processing must be explicitly disableable');

const bounded=core.normalizeProfile({highpassHz:500,presenceDb:12,compressorRatio:20,speechGainDb:8,outputHeadroomDb:0,compressorAttackSeconds:-1,compressorReleaseSeconds:2});
assert.strictEqual(bounded.highpassHz,180);
assert.strictEqual(bounded.presenceDb,4);
assert.strictEqual(bounded.compressorRatio,6);
assert.strictEqual(bounded.speechGainDb,3);
assert.strictEqual(bounded.outputHeadroomDb,-.5);
assert.strictEqual(bounded.compressorAttackSeconds,.001);
assert.strictEqual(bounded.compressorReleaseSeconds,.4);

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
assert.strictEqual(chain.presence.gain.value,3.2);
assert.strictEqual(chain.compressor.threshold.value,-21);
assert.strictEqual(chain.compressor.ratio.value,3.55);
assert.strictEqual(chain.compressor.attack.value,.008);
assert.strictEqual(chain.compressor.release.value,.16);
assert.strictEqual(chain.speechGain.gain.value,ending.speechGain);
assert.strictEqual(chain.outputGain.gain.value,ending.outputGain);
assert.strictEqual(chain.highpass.connections[0],chain.presence);
assert.strictEqual(chain.presence.connections[0],chain.compressor);
assert.strictEqual(chain.compressor.connections[0],chain.speechGain);
assert.strictEqual(chain.speechGain.connections[0],chain.outputGain);

const original={...voice,voiceoverSlotId:'slot-ending'};
core.processingPlan(competitionProject,original);
assert.deepStrictEqual(original,{...voice,voiceoverSlotId:'slot-ending'},'processing planning must not mutate voice clip timing, gain or rhythm metadata');

console.log('rhythm-aware competition voiceover clarity processing checks passed');
