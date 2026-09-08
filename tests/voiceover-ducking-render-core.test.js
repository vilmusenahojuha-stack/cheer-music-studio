'use strict';
const assert=require('node:assert/strict');
const render=require('../voiceover-ducking-render-core.js');
const dsp=require('../mix-dsp-core.js');

const pkg={
  version:1,kind:'cheer-voiceover-competition-package',status:'review-required',bpm:120,
  selected:[
    {slotId:'ending-ready',sectionType:'ending',status:'preview-ready',placement:{eight:2,count:1},ducking:{eight:2,musicGainDb:-6,speechWindow:{startCount:1,endCount:3},duckWindow:{startCount:.5,endCount:4}}},
    {slotId:'stunt-review',sectionType:'stunt',status:'review-required',placement:{eight:1,count:1},ducking:{eight:1,musicGainDb:-9,speechWindow:{startCount:1,endCount:4},duckWindow:{startCount:.5,endCount:5}}}
  ]
};

{
  const reservations=render.normalizePackageReservations(pkg);
  assert.equal(reservations.length,1,'review-required voiceovers must not reach render automation');
  assert.equal(reservations[0].slotId,'ending-ready');
  assert.equal(render.secondsForCount(2,1,120),4,'eight 2 count 1 must start after exactly eight counts');
  const points=render.automationPointsForClip(pkg,3,6,120);
  const at=new Map(points.map(([t,g])=>[t,g]));
  assert.equal(at.get(3),1);
  assert.equal(at.get(3.75),1,'attack must begin at duckWindow start without moving the clip');
  assert.ok(Math.abs(at.get(4)-Math.pow(10,-6/20))<1e-6,'speech start must reach section duck target');
  assert.ok(Math.abs(at.get(5)-Math.pow(10,-6/20))<1e-6,'speech window must hold section duck target');
  assert.equal(at.get(5.5),1,'release must return to unity at duckWindow end');
  assert.equal(at.get(6),1);
}

{
  const music={type:'music',start:0,duration:8};
  const legacyVoice={type:'voice',start:1,duration:4,volume:1};
  const points=dsp.duckAutomationPoints(music,[music,legacyVoice],0,8,{autoDuck:true,duckDb:-12,duckAttack:.1,duckRelease:.1,voiceoverCompetitionPackage:pkg});
  const times=points.map(p=>p[0]);
  assert(times.includes(3.75)&&times.includes(4)&&times.includes(5)&&times.includes(5.5),'shared DSP must use count-derived competition windows');
  assert(!times.includes(.9)&&!times.includes(1)&&!times.includes(5.1),'legacy voice-clip window must not be stacked over competition ducking');
  const target=points.find(p=>p[0]===4)?.[1];
  assert.ok(Math.abs(target-Math.pow(10,-6/20))<1e-6,'shared DSP must use the section-specific competition duck level');
}

{
  const music={type:'music',start:0,duration:8};
  const voice={type:'voice',start:1,duration:1,volume:1};
  const points=dsp.duckAutomationPoints(music,[music,voice],0,4,{autoDuck:true,duckDb:-7,duckAttack:.1,duckRelease:.2});
  assert(points.some(([t])=>Math.abs(t-.9)<1e-9),'legacy ducking must remain available when no competition package exists');
  assert(points.some(([t])=>Math.abs(t-2.2)<1e-9));
}

{
  const project={mixSettings:{autoDuck:true},voiceoverCompetitionPackage:pkg};
  const activated=render.activateCompetitionPackageForPreview(project,{status:'preview-ready'});
  assert.notEqual(activated,project,'preview activation must use a non-destructive project wrapper');
  assert.equal(project.mixSettings.voiceoverCompetitionPackage,undefined,'stored project mix settings must remain untouched');
  assert.equal(activated.mixSettings.voiceoverCompetitionPackage,pkg,'ready competition package must reach preview DSP settings');
  assert.deepEqual(activated.mixSettings,{autoDuck:true,voiceoverCompetitionPackage:pkg},'existing mix settings must be preserved');
  assert.deepEqual(activated.voiceoverPreviewActivation,{active:true,source:'project',nonDestructive:true,safePreviewOnly:true});
}

{
  const reviewOnly={...pkg,selected:pkg.selected.map(item=>({...item,status:'review-required'}))};
  const project={mixSettings:{autoDuck:true},voiceoverCompetitionPackage:reviewOnly};
  assert.equal(render.activateCompetitionPackageForPreview(project,{}),project,'package without preview-ready reservations must not activate');
}

{
  const planPkg={...pkg,bpm:130,selected:[{...pkg.selected[0],slotId:'plan-ready'}]};
  const project={mixSettings:{autoDuck:true},voiceoverCompetitionPackage:pkg};
  const activated=render.activateCompetitionPackageForPreview(project,{voiceoverCompetitionPackage:planPkg});
  assert.equal(activated.mixSettings.voiceoverCompetitionPackage,planPkg,'timeline-plan package must override project package for that preview only');
  assert.equal(activated.voiceoverPreviewActivation.source,'timeline-plan');
  assert.equal(project.mixSettings.voiceoverCompetitionPackage,undefined);
}

{
  const seen=[];
  const renderer={
    renderTimelinePlan(project){seen.push(['render',project]);return project;},
    previewTimelinePlan(project){seen.push(['preview',project]);return project;}
  };
  const root={CheerOfflineRenderer:renderer};
  assert.equal(render.installOfflineRendererActivation(root),true,'offline renderer must accept competition preview activation once');
  assert.equal(render.installOfflineRendererActivation(root),false,'offline renderer activation must not double-wrap');
  const project={mixSettings:{autoDuck:true},voiceoverCompetitionPackage:pkg};
  const previewed=renderer.previewTimelinePlan(project,{status:'preview-ready'});
  const rendered=renderer.renderTimelinePlan(project,{status:'preview-ready'});
  assert.equal(previewed.mixSettings.voiceoverCompetitionPackage,pkg);
  assert.equal(rendered.mixSettings.voiceoverCompetitionPackage,pkg);
  assert.equal(project.mixSettings.voiceoverCompetitionPackage,undefined,'renderer integration must not mutate the stored project');
  assert.equal(seen.length,2);
}

console.log('voiceover ducking render core tests passed');
