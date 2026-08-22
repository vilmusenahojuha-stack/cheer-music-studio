const assert=require('node:assert/strict');
const fs=require('node:fs');
const exportJs=fs.readFileSync('mix-export.js','utf8');
const offline=fs.readFileSync('offline-render.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(!/MediaRecorder/.test(exportJs),'production WAV export must not use MediaRecorder');
assert.ok(!/audio\/webm|codecs=opus|audioBitsPerSecond/.test(exportJs),'production WAV export must not contain lossy WebM/Opus recorder path');
assert.ok(/CheerOfflineRenderer\.renderProject/.test(exportJs),'WAV export must use offline PCM renderer');
assert.ok(/CheerWav24\.fromAudioBuffer/.test(exportJs),'WAV export must encode rendered PCM directly as 24-bit WAV');
assert.ok(/SAMPLE_RATE=48000/.test(offline),'offline renderer must be fixed at 48 kHz');
assert.ok(/CHANNELS=2/.test(offline),'offline renderer must be stereo');
assert.ok(/OfflineAudioContext/.test(offline),'offline renderer must use OfflineAudioContext');
assert.ok(!/MediaRecorder/.test(offline),'offline renderer must not use MediaRecorder');

const dsp=index.indexOf('mix-dsp-core.js'),timing=index.indexOf('audio-timing-core.js'),wav=index.indexOf('wav24.js'),renderer=index.indexOf('offline-render.js'),exp=index.indexOf('mix-export.js');
assert.ok(dsp>=0&&timing>dsp,'shared DSP must load before timing/playback core');
assert.ok(wav>=0&&renderer>wav&&exp>renderer,'WAV encoder and offline renderer must load before export UI');
console.log('lossless-export-contract: OfflineAudioContext -> 48 kHz stereo PCM -> 24-bit WAV path enforced');