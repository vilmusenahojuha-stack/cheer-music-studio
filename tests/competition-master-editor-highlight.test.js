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
assert.ok(/diagnosticLabel/.test(highlight),'timeline highlight must build a user-facing diagnostic label');
assert.ok(/Voiceover/.test(highlight)&&/FX/.test(highlight),'diagnostic label must distinguish voiceover and FX clarity');
assert.ok(/score\.toFixed\(2\)/.test(highlight)&&/minScore\.toFixed\(2\)/.test(highlight),'diagnostic label must show measured clarity score and acceptance threshold');
assert.ok(/competition-master-timeline-highlight-label/.test(highlight),'timeline highlight must render the diagnostic label inside the transient marker');
assert.ok(/dataset\.score/.test(highlight)&&/dataset\.minScore/.test(highlight),'timeline highlight must retain measured diagnostic values for inspection');
assert.ok(/setTimeout\(clearHighlight/.test(highlight),'highlight must remove itself automatically');
assert.ok(/pointer-events:none/.test(highlight),'highlight must never block normal timeline editing');
assert.ok(!/audioTimeline\.clips\.(push|splice)|scheduleSave|refreshPlayback|createGain|AudioContext|renderProject/.test(highlight),'highlight module must not mutate clips, save projects or process audio');

assert.ok(/focusEndSeconds/.test(ui),'assessment navigation must preserve the measured clarity window end time');
assert.ok(/focusScore/.test(ui)&&/focusMinScore/.test(ui),'assessment navigation must preserve exact measured clarity diagnostics');
assert.ok(/score:issue\?\.focusScore/.test(ui)&&/minScore:issue\?\.focusMinScore/.test(ui),'assessment navigation must pass measured score and threshold into timeline highlight');
assert.ok(/highlightRange\?\./.test(ui),'assessment navigation must request a visual range highlight only when supported by the editor');
assert.ok(/durationMs:6000/.test(ui),'clarity range highlight must be temporary');
assert.ok(/clarity-score sekä hyväksymisraja/.test(ui),'assessment UI must explain the transient diagnostic information');
assert.ok(/competition-master-editor-highlight\.js/.test(workflow),'simple workflow must load the timeline highlight module');
assert.ok(/data-competition-master-editor-highlight/.test(workflow),'timeline highlight loader must prevent duplicate script insertion');

console.log('competition-master-editor-highlight: precise clarity windows show transient score and threshold diagnostics without changing audio or clips');
