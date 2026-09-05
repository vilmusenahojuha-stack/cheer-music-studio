const assert=require('assert');
const core=require('../cheer-structure-core.js');

function close(actual,expected,eps=1e-9){assert.ok(Math.abs(actual-expected)<=eps,`${actual} != ${expected}`)}

close(core.beatSeconds(148),60/148);
close(core.eightCountSeconds(148),480/148);
close(core.eightCountSeconds(152),480/152);

const map=core.buildEightCountMap({
  bpm:148,
  oneOffset:0.05,
  totalEights:4,
  sections:[
    {id:'a',startEight:1,endEight:2,type:'intro',energy:'medium'},
    {id:'b',startEight:3,endEight:4,type:'stunt',energy:'peak'}
  ]
});
assert.equal(map.length,4);
assert.equal(map[0].sectionType,'intro');
assert.equal(map[2].sectionType,'stunt');
assert.equal(map[2].energy,'peak');
close(map[0].start,0.05);
close(map[1].start,0.05+480/148);

const beat=60/152;
close(core.snapToCount(1.23,{bpm:152,oneOffset:0.04,mode:'beat'}),0.04+Math.round((1.23-0.04)/beat)*beat);

const valid=core.validateSections([{startEight:1,endEight:4,type:'intro'},{startEight:5,endEight:8,type:'stunt'}]);
assert.equal(valid.ok,true);
const overlap=core.validateSections([{startEight:1,endEight:4},{startEight:4,endEight:8}]);
assert.equal(overlap.ok,false);
assert.equal(overlap.issues[0].type,'overlap');

assert.throws(()=>core.beatSeconds(0));
console.log('cheer-structure-core tests passed');
