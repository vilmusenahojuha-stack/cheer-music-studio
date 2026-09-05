const assert=require('assert');
const preview=require('../smart-mix-preview-core.js');

const plan={
  version:1,bpm:152,safePreviewOnly:true,executable:false,conflicts:[],
  actions:[
    {id:'edit-break',type:'break',eight:2,at:3.197,confidence:.88,steps:[
      {kind:'gain-ramp',from:2.9,to:3.197,valueFrom:1,valueTo:.28},
      {kind:'space',from:3.197,to:3.3,target:'music'}
    ]},
    {id:'edit-drop',type:'drop',eight:3,at:6.355,confidence:.94,steps:[
      {kind:'prepare-drop',from:5.75,to:6.355,target:'music'},
      {kind:'impact-anchor',at:6.355,target:'fx'},
      {kind:'restore-energy',from:6.355,to:6.46,target:'music'}
    ]},
    {id:'edit-build',type:'build',eight:4,at:9.513,confidence:.84,steps:[
      {kind:'build-window',from:7.9,to:9.513,target:'music'},
      {kind:'riser-anchor',from:7.934,to:9.513,target:'fx'}
    ]},
    {id:'edit-cut',type:'cut',eight:5,at:12.671,confidence:.71,steps:[
      {kind:'cut-window',from:12.57,to:12.78,anchor:12.671,target:'music'}
    ]}
  ]
};

const events=preview.buildPreviewEvents(plan);
assert.equal(events.length,8);
assert.equal(events[0].kind,'gain-ramp');
assert.ok(events.every(e=>e.from>=0&&e.to>=e.from));
assert.ok(events.every(e=>e.severity>=0&&e.severity<=1));

const p=preview.createPreview(plan,{from:2.8,to:12.8,resolution:.05});
assert.equal(p.nonDestructive,true);
assert.equal(p.executable,false);
assert.equal(p.summary.actions,4);
assert.equal(p.summary.actionTypes.drop,1);
assert.equal(p.summary.actionTypes.cut,1);
assert.ok(p.samples.length>100);
assert.ok(p.samples.some(s=>s.musicGain<.5));
assert.ok(p.samples.some(s=>s.space===true));
assert.ok(p.samples.some(s=>s.build>0));
assert.ok(p.samples.some(s=>s.dropPrep>0));
assert.ok(p.samples.some(s=>s.restore>0));
assert.ok(p.samples.some(s=>s.markers.includes('impact-anchor')));
assert.ok(p.samples.some(s=>s.markers.includes('cut-anchor')));

const instant=preview.normalizeStep({kind:'impact-anchor',at:1.25,target:'fx'},{id:'a',type:'drop',eight:1,confidence:.9});
assert.equal(instant.from,1.25);
assert.equal(instant.to,1.25);
assert.equal(instant.at,1.25);

assert.throws(()=>preview.buildPreviewEvents({...plan,conflicts:[{type:'x'}]}),/conflicts/);
assert.throws(()=>preview.createPreview({...plan,safePreviewOnly:false}),/safePreviewOnly/);
assert.throws(()=>preview.buildPreviewEvents({}),/actions/);
console.log('smart-mix-preview-core tests passed');
