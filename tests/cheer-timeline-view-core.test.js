const assert=require('assert');
const view=require('../cheer-timeline-view-core.js');

const beat=60/152;
const eight=beat*8;
const plan={
  bpm:152,
  timeline:[
    {eight:1,start:0,end:eight,sectionId:'intro',sectionType:'intro',sectionLabel:'Intro',countInSection:1,phrase:1,phraseStartEight:1,phraseEndEight:2,phraseEnergyTrend:'rising',energy:'medium',audioEnergy:{score:.40,energy:'medium'},energyAlignment:{status:'match',score:.98},transition:null},
    {eight:2,start:eight,end:eight*2,sectionId:'intro',sectionType:'intro',sectionLabel:'Intro',countInSection:2,phrase:1,phraseStartEight:1,phraseEndEight:2,phraseEnergyTrend:'rising',energy:'high',audioEnergy:{score:.32,energy:'medium'},energyAlignment:{status:'lower',score:.62},transition:{type:'break',confidence:.82}},
    {eight:3,start:eight*2,end:eight*3,sectionId:'stunt',sectionType:'stunt',sectionLabel:'Stunt',countInSection:1,phrase:2,phraseStartEight:3,phraseEndEight:3,phraseEnergyTrend:'steady',energy:'peak',audioEnergy:{score:.90,energy:'peak'},energyAlignment:{status:'match',score:.97},transition:{type:'drop',confidence:.94}}
  ]
};
const preview={
  nonDestructive:true,executable:false,
  events:[
    {kind:'gain-ramp',actionType:'break',confidence:.82,severity:.70,from:eight*1.8,to:eight*2,target:'music'},
    {kind:'impact-anchor',actionType:'drop',confidence:.94,severity:.83,from:eight*2,to:eight*2,at:eight*2,target:'fx'},
    {kind:'restore-energy',actionType:'drop',confidence:.94,severity:.83,from:eight*2,to:eight*2+.15,target:'music'}
  ]
};

const timeline=view.buildTimelinePresentation(plan,preview);
assert.equal(timeline.nonDestructive,true);
assert.equal(timeline.executable,false);
assert.equal(timeline.rows.length,3);
assert.equal(timeline.summary.totalEights,3);
assert.equal(timeline.summary.sections,2);
assert.equal(timeline.sectionBands[0].startEight,1);
assert.equal(timeline.sectionBands[0].endEight,2);
assert.equal(timeline.sectionBands[1].type,'stunt');
assert.equal(timeline.rows[0].counts.length,8);
assert.equal(timeline.rows[0].counts[0].count,1);
assert.ok(Math.abs(timeline.rows[0].counts[7].time-beat*7)<1e-9);
assert.equal(timeline.rows[1].energy.alignment,'lower');
assert.ok(timeline.rows[1].warnings.includes('energy-lower'));
assert.equal(timeline.rows[1].hasSmartMix,true);
assert.ok(timeline.rows[1].previewEvents.some(event=>event.kind==='gain-ramp'));
assert.equal(timeline.rows[2].hasSmartMix,true);
assert.ok(timeline.rows[2].previewEvents.some(event=>event.kind==='impact-anchor'));
assert.ok(timeline.rows[2].warnings.includes('strong-smart-mix-edit'));
assert.equal(timeline.markers.length,1);
assert.equal(timeline.markers[0].kind,'impact-anchor');
assert.equal(timeline.markers[0].group,'fx');
assert.equal(timeline.summary.mismatchEights,1);
assert.equal(timeline.summary.markers,1);

const instant={kind:'impact-anchor',from:eight,to:eight};
assert.equal(view.overlaps(instant,0,eight),false);
assert.equal(view.overlaps(instant,eight,eight*2),true);
assert.throws(()=>view.buildTimelinePresentation({},preview),/timeline/);
assert.throws(()=>view.buildTimelinePresentation(plan,{nonDestructive:false,executable:false,events:[]}),/non-destructive/);
assert.throws(()=>view.buildTimelinePresentation(plan,{nonDestructive:true,executable:true,events:[]}),/non-destructive/);
console.log('cheer-timeline-view-core tests passed');
