const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');

const source=fs.readFileSync(path.join(__dirname,'..','competition-master-clarity-recheck.js'),'utf8');
const context={
  console,
  CustomEvent:function(type,init){this.type=type;this.detail=init?.detail;},
  window:{
    state:{clips:[]},
    dispatchEvent(){},
    CheerOfflineRenderer:{renderProject:async()=>({duration:150})},
    CheerCompetitionMasterClarityMetricsCore:{
      recheckFocusedClarity(_rendered,focus){
        return {
          focusKind:focus.kind,
          startSeconds:focus.startSeconds,
          endSeconds:focus.endSeconds,
          previousScore:focus.score,
          currentScore:0.76,
          minScore:focus.minScore,
          improvement:0.24,
          verdict:'passed'
        };
      }
    }
  }
};
vm.createContext(context);
vm.runInContext(source,context);
const api=context.window.cheerCompetitionMasterClarityRecheck;

const issue={
  sectionId:'dance',
  label:'Dance',
  focusKind:'voiceover',
  focusStartSeconds:96.2,
  focusEndSeconds:96.7,
  focusScore:0.52,
  focusMinScore:0.72
};

assert.equal(api.isResolved(issue),false,'issue must start unresolved');
assert.equal(api.focusKey(issue),'dance|voiceover|96.2000|96.7000');

{
  const result=api.applyResolution(issue,{
    sectionId:'dance',focusKind:'voiceover',startSeconds:96.2,endSeconds:96.7,
    previousScore:0.52,currentScore:0.76,minScore:0.72,improvement:0.24,verdict:'passed',checkedAt:'2026-09-09T10:00:00.000Z'
  });
  assert.equal(result.resolved,true);
  assert.equal(result.status,'resolved');
  assert.equal(api.isResolved(issue),true);
  assert.equal(api.getResolution(issue).currentScore,0.76);
}

{
  const wrongWindow=api.applyResolution(issue,{
    sectionId:'dance',focusKind:'voiceover',startSeconds:96.3,endSeconds:96.7,
    currentScore:0.8,minScore:0.72,verdict:'passed'
  });
  assert.equal(wrongWindow,null,'different measurement window must never resolve the issue');
  assert.equal(api.isResolved(issue),true,'unrelated result must not overwrite the valid resolution');
}

{
  const wrongThreshold=api.applyResolution(issue,{
    sectionId:'dance',focusKind:'voiceover',startSeconds:96.2,endSeconds:96.7,
    currentScore:0.76,minScore:0.68,verdict:'passed'
  });
  assert.equal(wrongThreshold.resolved,false);
  assert.equal(wrongThreshold.reason,'acceptance-threshold-changed');
  assert.equal(api.isResolved(issue),false,'changed acceptance threshold must reopen the issue');
}

{
  const notPassed=api.applyResolution(issue,{
    sectionId:'dance',focusKind:'voiceover',startSeconds:96.2,endSeconds:96.7,
    currentScore:0.69,minScore:0.72,verdict:'improved'
  });
  assert.equal(notPassed.resolved,false);
  assert.equal(notPassed.reason,'recheck-not-passed');
  assert.equal(api.isResolved(issue),false);
}

(async()=>{
  const result=await api.recheck(issue);
  assert.equal(result.verdict,'passed');
  assert.equal(result.resolution.resolved,true,'successful same-window recheck must create a resolution');
  assert.equal(api.isResolved(issue),true);
  api.clearResolutions();
  assert.equal(api.isResolved(issue),false,'resolution registry must be explicitly clearable');
  console.log('competition-master-clarity-recheck-resolution tests passed');
})().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
