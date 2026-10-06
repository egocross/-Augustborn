import { BEHAVIOR_DIMENSIONS, INTEREST_DIMENSIONS, RECENT_SIGNALS, VALUE_DIMENSIONS, type RecentSignal } from '../integrated-report/ontology';
import { asciiCompare } from '../integrated-report/canonical-hash';
import { FIXED_QUESTIONS, FixedAnswersInputSchema, getOption, getQuestion } from './questions';

export type ScoreCell = {
  raw:number; scheduledExposure:number;
  normalized:{numerator:number;denominator:number}; evidenceIds:string[];
};
export type RecentEvidence = {optionId:'Q14.none';signal:null;evidenceId:null;verification:'self_report_unverified'} |
  {optionId:`Q14.${RecentSignal}`;signal:RecentSignal;evidenceId:string;verification:'self_report_unverified'};
function emptyScores<D extends string>(section:'interests'|'behavior'|'values',dimensions:readonly D[]):Record<D,ScoreCell> {
  return Object.fromEntries(dimensions.map(d=>{
    const exposure=FIXED_QUESTIONS.filter(q=>q.section===section&&q.options.some(o=>o.dimension===d)).length;
    const cell:ScoreCell={raw:0,scheduledExposure:exposure,normalized:{numerator:0,denominator:exposure},evidenceIds:[]};
    return [d,cell];
  })) as Record<D,ScoreCell>;
}

export function scoreAdvantageScan(input:unknown) {
  const parsed=FixedAnswersInputSchema.parse(input);
  const interests=emptyScores('interests',INTEREST_DIMENSIONS);
  const behavior=emptyScores('behavior',BEHAVIOR_DIMENSIONS);
  const values=emptyScores('values',VALUE_DIMENSIONS);
  const scores:Record<'interests'|'behavior'|'values',Record<string,ScoreCell>>={interests,behavior,values};
  const uncertaintyBySection={interests:0,behavior:0,values:0};
  const recentAnswer=parsed.answers.find(a=>a.questionId==='Q14')!;
  const recentOption=getOption('Q14',recentAnswer.optionId);
  const recentSignal=recentOption.dimension as RecentSignal|null;
  if(recentSignal!==null&&!RECENT_SIGNALS.includes(recentSignal)) throw new Error('INVALID_RECENT_SIGNAL');
  const recentEvidence:RecentEvidence=recentSignal===null
    ? {optionId:'Q14.none',signal:null,evidenceId:null,verification:'self_report_unverified'}
    : {optionId:`Q14.${recentSignal}`,signal:recentSignal,evidenceId:`scan:${recentAnswer.optionId}`,verification:'self_report_unverified'};
  for(const answer of [...parsed.answers].sort((a,b)=>asciiCompare(a.questionId,b.questionId))) {
    const question=getQuestion(answer.questionId);
    if(question.section==='recent') continue;
    const option=getOption(answer.questionId,answer.optionId);
    if(option.responseKind==='uncertain') { uncertaintyBySection[question.section]++; continue; }
    const cell=scores[question.section][option.dimension!];
    cell.raw++; cell.normalized.numerator++; cell.evidenceIds.push(`scan:${answer.optionId}`);
  }
  return {interests,behavior,values,recentEvidence,uncertaintyBySection,
    uncertaintyCount:Object.values(uncertaintyBySection).reduce((a,b)=>a+b,0),recentRecallMissing:recentSignal===null};
}
export type FixedScores=ReturnType<typeof scoreAdvantageScan>;
