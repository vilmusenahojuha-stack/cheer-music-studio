const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const windowObj={};
windowObj.window=windowObj;
const sandbox={window:windowObj,document:{querySelector(){return null}},console,setTimeout,clearTimeout};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require.resolve('../offline-render.js'),'utf8'),sandbox,{filename:'offline-render.js'});

const project={
  duration:30,
  tracks:[
    {name:'music-a',url:'blob:music-a'},
    {name:'voice-a',url:'blob:voice-a'},
    {name:'voice-late',url:'blob:voice-late'},
    {name:'fx-old',url:'blob:fx-old'}
  ],
  mixSettings:{},
  audioTimeline:{clips:[
    {id:'old-music',type:'music',sourceName:'music-a',start:0,duration:12,sourceOffset:0},
    {id:'voice-a',type:'voice',sourceName:'voice-a',start:5,duration:4,sourceOffset:1,volume:.9},
    {id:'voice-late',type:'voice',sourceName:'voice-late',start:20,duration:2,sourceOffset:0,volume:1},
    {id:'old-fx',type:'fx',sourceName:'fx-old',start:4,duration:1,sourceOffset:0}
  ]}
};
const plan={status:'preview-ready',clips:[
  {id:'sm-a',type:'music',sourceName:'music-a',start:0,duration:8,sourceOffset:3,volume:1}
]};

const original=JSON.stringify(project);
const legacy=windowObj.CheerOfflineRenderer.projectForTimelinePlan(project,plan);
assert.equal(legacy.audioTimeline.clips.length,1,'legacy Smart Mix preview must keep its previous music-only behavior');
assert.equal(legacy.smartMixPreview.preservedVoiceovers,0);
assert.equal(JSON.stringify(project),original,'legacy preview construction must not mutate the saved project');

const competitionProject={
  ...project,
  mixSettings:{
    ...project.mixSettings,
    voiceoverCompetitionPackage:{kind:'cheer-voiceover-competition-package',bpm:147,selected:[{status:'preview-ready'}]}
  }
};
const competitionOriginal=JSON.stringify(competitionProject);
const preview=windowObj.CheerOfflineRenderer.projectForTimelinePlan(competitionProject,plan);

assert.equal(preview.smartMixPreview.nonDestructive,true);
assert.equal(preview.smartMixPreview.preservedVoiceovers,1,'only voiceovers inside the Smart Mix music window must be preserved');
assert.deepEqual(Array.from(preview.audioTimeline.clips,c=>c.type),['music','voice'],'competition preview must combine proposal music with existing voiceover audio only');
const voice=preview.audioTimeline.clips.find(c=>c.type==='voice');
assert.equal(voice.id,'voice-a');
assert.equal(voice.start,5,'voiceover timeline position must not move');
assert.equal(voice.duration,4,'voiceover duration must not change');
assert.equal(voice.sourceOffset,1,'voiceover source offset must not change');
assert.equal(preview.audioTimeline.clips.some(c=>c.type==='fx'),false,'legacy FX clips must not be duplicated into Smart Mix competition preview');
assert.equal(preview.audioTimeline.clips.some(c=>c.id==='voice-late'),false,'voiceovers starting after the Smart Mix music window must not leak into preview');
assert.equal(preview.duration,9,'a preserved voiceover may extend preview only to its own natural end');
assert.equal(JSON.stringify(competitionProject),competitionOriginal,'competition preview construction must remain non-destructive');

console.log('voiceover Smart Mix preview preservation: competition-only non-destructive audio preservation passed');
