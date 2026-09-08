'use strict';
const assert=require('assert');
const render=require('../cheer-fx-render-core.js');
const competition=require('../cheer-fx-competition-balance-core.js');

function pair({id,sectionType,eight,at,score,arc='peak',hero=true}){
  return [
    {id:`${id}-riser`,kind:'riser',sectionId:id,sectionType,routineEight:eight,at:at-.4,endAt:at,duration:.4,intensityScore:score,confidence:.9,sectionArcStage:'build',phraseHeroEligible:false,executable:true},
    {id:`${id}-impact`,kind:'impact',sectionId:id,sectionType,routineEight:eight,at,intensityScore:score,confidence:.9,sectionArcStage:arc,phraseHeroEligible:hero,intensity:hero?'hero':'strong',executable:true}
  ];
}

{
  const source=[
    ...pair({id:'stunt-a',sectionType:'stunt',eight:4,at:10,score:1}),
    ...pair({id:'ending-a',sectionType:'ending',eight:8,at:20,score:.35})
  ];
  const selected=render.enforcePhraseFxBudget(render.selectPatternHits(source));
  const balanced=render.applyCompetitionBalance(selected,{competitionBalanceCore:competition,bpm:150});
  const ending=balanced.find(anchor=>anchor.id==='ending-a-impact');
  const endingRiser=balanced.find(anchor=>anchor.id==='ending-a-riser');
  assert(ending,'ending impact should remain available');
  assert.equal(ending.competitionBalanceDirective,'strengthen-final-peak');
  assert.equal(ending.competitionBalanceScale,1.08);
  assert.equal(ending.at,20,'competition balance must not move the impact');
  assert.equal(endingRiser.endAt,20,'competition balance must not move the riser end');
  assert(ending.intensityScore>ending.preCompetitionIntensityScore,'final principal peak should gain headroom');
}

{
  const source=pair({id:'pyramid-a',sectionType:'pyramid',eight:4,at:12,score:.9});
  const fakeBalance={
    balanceCompetitionArc(plan){
      return {...plan,kind:'cheer-fx-competition-balance-plan',status:'review-required',sections:plan.sections.map(section=>({...section,competitionIntensity:.98,targetCeiling:.94,balanceDirective:'trim-pyramid-peak'}))};
    }
  };
  const selected=render.enforcePhraseFxBudget(render.selectPatternHits(source));
  const balanced=render.applyCompetitionBalance(selected,{competitionBalanceCore:fakeBalance,bpm:150});
  const impact=balanced.find(anchor=>anchor.kind==='impact');
  const riser=balanced.find(anchor=>anchor.kind==='riser');
  assert.equal(impact.competitionBalanceDirective,'trim-pyramid-peak');
  assert.equal(impact.competitionBalanceScale,.86);
  assert.equal(riser.competitionBalanceScale,.9);
  assert.equal(impact.at,12);
  assert.equal(riser.at,11.6);
  assert.equal(riser.endAt,12);
  assert(impact.intensityScore<impact.preCompetitionIntensityScore);
}

{
  const source=pair({id:'stunt-b',sectionType:'stunt',eight:4,at:8,score:.8});
  const original=JSON.stringify(source);
  render.buildRenderEvents(source,30,{competitionBalanceCore:competition,bpm:150});
  assert.equal(JSON.stringify(source),original,'competition render balancing must stay non-destructive');
}

console.log('cheer-fx competition render balance tests passed');
