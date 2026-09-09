const assert=require('node:assert/strict');
const fs=require('node:fs');

const highlight=fs.readFileSync('competition-master-editor-highlight.js','utf8');
const ui=fs.readFileSync('competition-master-assessment-ui.js','utf8');
const workflow=fs.readFileSync('simple-workflow.js','utf8');

assert.ok(/highlightRange/.test(highlight),'timeline highlight module must expose a highlightRange editor action');
assert.ok(/clearHighlight/.test(highlight),'timeline highlight must be explicitly clearable');
assert.ok(/competitionMasterTimelineHighlight/.test(highlight),'timeline highlight must use one dedicated transient DOM marker');
assert.ok(/timelineContent/.test(highlight),'highlight must be rendered inside the existing audio timeline');
assert.ok(/targetBpm/.test(highlight)&&/audioTimeline\?\.zoom/.test(highlight),'highlight positioning must follow the current timeline BPM and zoom scale');
assert.ok(/setTimeout\(clearHighlight/.test(highlight),'highlight must remove itself automatically');
assert.ok(/pointer-events:none/.test(highlight),'highlight must never block normal timeline editing');
assert.ok(!/audioTimeline\.clips\.(push|splice)|scheduleSave|refreshPlayback|createGain|AudioContext|renderProject/.test(highlight),'highlight module must not mutate clips, save projects or process audio');

assert.ok(/focusEndSeconds/.test(ui),'assessment navigation must preserve the measured clarity window end time');
assert.ok(/highlightRange\?\./.test(ui),'assessment navigation must request a visual range highlight only when supported by the editor');
assert.ok(/durationMs:6000/.test(ui),'clarity range highlight must be temporary');
assert.ok(/mittausikkuna korostetaan hetkellisesti/.test(ui),'assessment UI must explain the transient range highlight');
assert.ok(/competition-master-editor-highlight\.js/.test(workflow),'simple workflow must load the timeline highlight module');
assert.ok(/data-competition-master-editor-highlight/.test(workflow),'timeline highlight loader must prevent duplicate script insertion');

console.log('competition-master-editor-highlight: precise clarity windows are highlighted transiently without changing audio or clips');
