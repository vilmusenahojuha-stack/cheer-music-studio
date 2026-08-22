const assert=require('node:assert/strict');
const Wav=require('../wav24.js');

function ascii(view,offset,n){let s='';for(let i=0;i<n;i++)s+=String.fromCharCode(view.getUint8(offset+i));return s}
function readInt24LE(view,offset){let v=view.getUint8(offset)|(view.getUint8(offset+1)<<8)|(view.getUint8(offset+2)<<16);if(v&0x800000)v-=0x1000000;return v}

const left=Float32Array.from([-1,-.5,0,.5,1]);
const right=Float32Array.from([1,.25,0,-.25,-1]);
const ab=Wav.encodeWav24([left,right],48000),view=new DataView(ab);
assert.equal(ascii(view,0,4),'RIFF');
assert.equal(ascii(view,8,4),'WAVE');
assert.equal(ascii(view,12,4),'fmt ');
assert.equal(ascii(view,36,4),'data');
assert.equal(view.getUint16(20,true),1,'format must be PCM');
assert.equal(view.getUint16(22,true),2,'master must be stereo');
assert.equal(view.getUint32(24,true),48000,'master must be 48 kHz');
assert.equal(view.getUint16(34,true),24,'master must be 24-bit');
assert.equal(view.getUint16(32,true),6,'24-bit stereo block align must be 6 bytes');
assert.equal(view.getUint32(28,true),288000,'48 kHz × 6 bytes byte rate');
assert.equal(view.getUint32(40,true),left.length*6);
assert.equal(ab.byteLength,44+left.length*6);

const expected=[-8388608,8388607,-4194304,2097152,0,0,4194304,-2097152,8388607,-8388608];
const actual=[];for(let p=44;p<ab.byteLength;p+=3)actual.push(readInt24LE(view,p));
assert.deepEqual(actual,expected,'PCM samples must be correctly interleaved and quantized');

const mono=Float32Array.from([.1,-.1]);const monoAb=Wav.encodeWav24([mono],48000),monoView=new DataView(monoAb);
assert.equal(readInt24LE(monoView,44),readInt24LE(monoView,47),'mono input must duplicate to stereo left/right');
assert.equal(readInt24LE(monoView,50),readInt24LE(monoView,53),'mono duplication must hold for every frame');

assert.equal(Wav.floatToInt24(-2),-8388608,'negative clipping');
assert.equal(Wav.floatToInt24(2),8388607,'positive clipping');
assert.equal(Wav.floatToInt24(NaN),0,'non-finite samples become silence');
assert.throws(()=>Wav.encodeWav24([],48000),/puuttuvat/);
assert.throws(()=>Wav.encodeWav24([new Float32Array(2),new Float32Array(3)],48000),/pituudet/);
assert.throws(()=>Wav.encodeWav24([new Float32Array(2)],0),/sample rate/);

console.log('wav24: 48 kHz stereo 24-bit PCM regression tests passed');
