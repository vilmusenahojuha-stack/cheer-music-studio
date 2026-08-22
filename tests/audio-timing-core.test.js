const assert=require('node:assert/strict');
const T=require('../audio-timing-core.js');

function near(actual,expected,eps=1e-9,msg=''){assert.ok(Math.abs(actual-expected)<=eps,`${msg} expected ${expected}, got ${actual}`)}

// Playhead must never run backwards during the scheduling lead-in.
near(T.timelineTime(10.00,30,10.10),30);
near(T.timelineTime(10.10,30,10.10),30);
near(T.timelineTime(10.35,30,10.10),30.25);

// Starting from the beginning schedules a later clip on the same context clock.
let s=T.computeClipSchedule({clip:{start:4,duration:8,sourceOffset:2},playFrom:0,contextStart:100,bufferDuration:30,rate:1});
near(s.when,104);near(s.sourceOffset,2);near(s.timelineDuration,8);near(s.bufferPlayDuration,8);

// Seeking into a clip advances the source offset sample-consistently.
s=T.computeClipSchedule({clip:{start:4,duration:8,sourceOffset:2},playFrom:7,contextStart:50,bufferDuration:30,rate:1});
near(s.when,50);near(s.sourceOffset,5);near(s.timelineDuration,5);

// Tempo-rate mapping: 2 timeline seconds consume 3 buffer seconds at 1.5x.
s=T.computeClipSchedule({clip:{start:10,duration:6,sourceOffset:1},playFrom:12,contextStart:20,bufferDuration:20,rate:1.5});
near(s.when,20);near(s.sourceOffset,4);near(s.timelineDuration,4);near(s.bufferPlayDuration,6);

// Source end truncates the timeline rather than reading beyond the AudioBuffer.
s=T.computeClipSchedule({clip:{start:0,duration:20,sourceOffset:8},playFrom:0,contextStart:0,bufferDuration:10,rate:2});
near(s.timelineDuration,1);near(s.bufferPlayDuration,2);

// A clip completely before a seek point is not scheduled.
assert.equal(T.computeClipSchedule({clip:{start:1,duration:2},playFrom:3,contextStart:0,bufferDuration:10,rate:1}),null);

// A cheer handoff in the middle of an eight lands on exactly one AudioContext instant.
// Kasi 6 / lasku 5 at 147 BPM = beat index 44 from timeline zero.
const spb=60/147,transition=44*spb,ctxStart=200;
const outgoing=T.computeClipSchedule({clip:{start:0,duration:transition,sourceOffset:0},playFrom:0,contextStart:ctxStart,bufferDuration:120,rate:1});
const incoming=T.computeClipSchedule({clip:{start:transition,duration:8*spb,sourceOffset:3},playFrom:0,contextStart:ctxStart,bufferDuration:120,rate:1});
near(outgoing.when+outgoing.timelineDuration,incoming.when,1e-9,'mid-eight handoff');

// Fade envelope is deterministic at start / middle / end.
const c={start:5,duration:4,volume:.8,fadeIn:1,fadeOut:1};
near(T.envelopeAt(c,5),0);near(T.envelopeAt(c,5.5),.4);near(T.envelopeAt(c,7),.8);near(T.envelopeAt(c,8.5),.4);near(T.envelopeAt(c,9),0);

console.log('audio timing core: all regression tests passed');
