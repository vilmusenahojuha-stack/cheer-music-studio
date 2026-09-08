'use strict';
const assert=require('assert');
const core=require('../voiceover-loudness-analysis-core.js');
function bufferFrom(channels,sampleRate=48000){return {sampleRate,numberOfChannels:channels.length,length:channels[0].length,duration:channels[0].length/sampleRate,getChannelData(i){return channels[i];}};}
function sine(amplitude=0.1,seconds=2,sampleRate=48000){const n=Math.floor(seconds*sampleRate),ch=new Float32Array(n);for(let i=0;i<n;i++)ch[i]=amplitude*Math.sin(2*Math.PI*1000*i/sampleRate);return bufferFrom([ch],sampleRate);}
const quiet=core.measureAudioBuffer(sine(.1));
assert.strictEqual(quiet.kind,'cheer-voiceover-loudness-measurement');
assert.strictEqual(quiet.nonDestructive,true);
assert(quiet.integratedLufs<-22&&quiet.integratedLufs>-24,`unexpected LUFS ${quiet.integratedLufs}`);
assert(quiet.truePeakDb<-19.9&&quiet.truePeakDb>-20.1,`unexpected peak ${quiet.truePeakDb}`);
const loud=core.measureAudioBuffer(sine(.5));
assert(loud.integratedLufs>quiet.integratedLufs+13,'louder source must measure clearly louder');
assert(loud.truePeakDb>quiet.truePeakDb+13,'true peak must follow source amplitude');
const silence=core.measureAudioBuffer(bufferFrom([new Float32Array(48000)]));
assert.strictEqual(silence.integratedLufs,null);
assert(silence.truePeakDb<=-239);
const pulse=new Float32Array(48000);pulse[100]=1;const p=core.measureAudioBuffer(bufferFrom([pulse]));
assert.strictEqual(p.truePeakDb,0);
const patch=core.metadataPatch(quiet);
assert.strictEqual(patch.voiceoverIntegratedLufs,quiet.integratedLufs);
assert.strictEqual(patch.voiceoverTruePeakDb,quiet.truePeakDb);
assert.deepStrictEqual(core.metadataPatch(null),{});
const original=sine(.2),before=original.getChannelData(0)[123];core.measureAudioBuffer(original);assert.strictEqual(original.getChannelData(0)[123],before,'analysis must not mutate source PCM');
console.log('voiceover loudness analysis checks passed');
