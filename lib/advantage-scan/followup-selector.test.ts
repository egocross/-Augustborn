import { describe, expect, it } from 'vitest';
import { planFollowups, resolveFollowups } from './followup-selector';
import { scoreAdvantageScan } from './scoring';
const make=(interest=['investigative','artistic','realistic','artistic','investigative','social'], behavior=['investigate','structure','investigate','structure'])=>({scanVersion:'advantage-scan-v1.1',answers:[...interest,...behavior,'uncertain','uncertain','uncertain','none'].map((d,i)=>({questionId:`Q${i+1}`,optionId:`Q${i+1}.${d}`}))});
const answer=(questionId:string,suffix:string)=>({questionId,optionId:`${questionId}.${suffix}`});
describe('independent fixed follow-up planning',()=>{
  it('plans behavior before interests despite values/global uncertainty and keeps stable hashes',()=>{
    const input=make(); const plan=planFollowups(input);
    expect(plan.items.map(x=>x.questionId)).toEqual(['FB-IS','FI-IA']);
    expect(plan.items[0].pairKey).toBe('behavior:analysis_research|structure_system');
    expect(plan.items[0].triggerEvidenceRefs).toEqual(['scan:Q10.structure','scan:Q7.investigate','scan:Q8.structure','scan:Q9.investigate']);
    expect(planFollowups({...input,answers:[...input.answers].reverse()})).toEqual(plan);
  });
  it.each([
    [['investigate','structure','create','execute'],0],
    [['investigate','investigate','structure','create'],0],
    [['investigate','investigate','create','create'],0],
    [['investigate','investigate','structure','uncertain'],1],
    [['investigate','structure','investigate','structure'],1],
  ])('requires two unambiguous leading dimensions and a covered pair: %s',(behavior,count)=>{
    expect(planFollowups(make(Array(6).fill('uncertain'),behavior as string[])).items).toHaveLength(count as number);
  });
  it('retains separate section pair identities for the same two themes',()=>{
    const plan=planFollowups(make(['investigative','conventional','realistic','investigative','conventional','social']));
    expect(plan.items.map(x=>x.questionId)).toEqual(['FB-IS','FI-IC']);
    expect(plan.items[0].themePairKey).toBe(plan.items[1].themePairKey);
    expect(plan.items[0].pairKey).not.toBe(plan.items[1].pairKey);
  });
});
describe('follow-up completion and invalidation',()=>{
  it('continues after uncertainty and never changes fixed scores',()=>{
    const input=make(); const before=scoreAdvantageScan(input); const plan=planFollowups(input);
    const result=resolveFollowups(input,{fixedInputHash:plan.fixedInputHash,answers:[answer('FB-IS','uncertain'),answer('FI-IA','artistic')],endedByUser:false});
    expect(result.map(x=>x.status)).toEqual(['unresolved','resolved']);
    expect(result[0].winnerThemeId).toBeNull();
    expect(result[1].winnerThemeId).toBe('creative_expression');
    expect(result[1].loserThemeId).toBe('analysis_research');
    expect(scoreAdvantageScan(input)).toEqual(before);
  });
  it('requires explicit ending and keeps missing answers distinct from uncertainty',()=>{
    const input=make(); const plan=planFollowups(input); const submission={fixedInputHash:plan.fixedInputHash,answers:[answer('FB-IS','uncertain')],endedByUser:false};
    expect(()=>resolveFollowups(input,submission)).toThrow();
    const result=resolveFollowups(input,{...submission,endedByUser:true});
    expect(result.map(x=>[x.status,x.optionId])).toEqual([['unresolved','FB-IS.uncertain'],['ended_by_user',null]]);
  });
  it('rejects stale, duplicate, unplanned and forged follow-up submissions',()=>{
    const input=make(); const plan=planFollowups(input); const good={fixedInputHash:plan.fixedInputHash,answers:[answer('FB-IS','investigate'),answer('FI-IA','artistic')],endedByUser:false};
    for(const bad of [{...good,fixedInputHash:'stale'},{...good,answers:[answer('FB-IS','investigate'),answer('FB-IS','structure')]},{...good,answers:[answer('FI-IC','conventional')]},{...good,score:5}]) expect(()=>resolveFollowups(input,bad)).toThrow();
    const changed=structuredClone(input); changed.answers[13]=answer('Q14','create');
    expect(()=>resolveFollowups(changed,good)).toThrow();
  });
});


describe('complete static follow-up coverage', () => {
  it.each([
    ['FI-IA', ['investigative','artistic','realistic','artistic','investigative','social']],
    ['FI-IC', ['investigative','conventional','realistic','investigative','conventional','social']],
    ['FI-AS', ['artistic','artistic','social','realistic','social','conventional']],
    ['FI-SE', ['social','enterprising','social','enterprising','conventional','realistic']],
    ['FI-RI', ['realistic','investigative','realistic','investigative','social','artistic']],
    ['FI-CE', ['social','conventional','enterprising','enterprising','conventional','realistic']],
  ])('selects covered interest pair %s', (id, interests) => {
    const plan = planFollowups(make(interests as string[], Array(4).fill('uncertain')));
    expect(plan.items.map(item => item.questionId)).toEqual([id]);
  });
  it.each([
    ['FB-IS', ['investigate','structure','investigate','structure']],
    ['FB-CE', ['create','execute','create','execute']],
    ['FB-CI', ['collaborate','influence','collaborate','influence']],
  ])('selects covered behavior pair %s', (id, behavior) => {
    expect(planFollowups(make(Array(6).fill('uncertain'), behavior as string[])).items.map(item => item.questionId)).toEqual([id]);
  });
  it('does not use stable ID sorting to select from a three-way interest tie', () => {
    expect(planFollowups(make(['investigative','artistic','social','artistic','investigative','social'], Array(4).fill('uncertain'))).items).toEqual([]);
  });
});
