import { z } from 'zod';
import { FOLLOWUP_POLICY_VERSION, SCORING_VERSION, type Theme } from '../integrated-report/ontology';
import { asciiCompare, semanticHash, sortedUnique } from '../integrated-report/canonical-hash';
import { dimensionTheme, FixedAnswersInputSchema, FOLLOWUP_QUESTIONS, getOption, ScanAnswerSchema } from './questions';
import { scoreAdvantageScan } from './scoring';
export type FollowupPlanItem={questionId:string;section:'interests'|'behavior';pairKey:string;themePairKey:string;triggerEvidenceRefs:string[];reasonCode:'fixed_section_ambiguity'};
export type FollowupResolution=FollowupPlanItem & {optionId:string|null;status:'resolved'|'unresolved'|'ended_by_user';winnerThemeId:Theme|null;loserThemeId:Theme|null};

export function planFollowups(input:unknown) {
  const parsed=FixedAnswersInputSchema.parse(input);
  const scores=scoreAdvantageScan(parsed);
  const items:FollowupPlanItem[]=[];
  for(const section of ['behavior','interests'] as const) {
    const cells=Object.entries(scores[section]).sort(([a,x],[b,y])=>y.normalized.numerator/y.normalized.denominator-x.normalized.numerator/x.normalized.denominator || asciiCompare(a,b));
    const effective=cells.reduce((sum,[,cell])=>sum+cell.raw,0);
    const [first,second,third]=cells;
    if(effective<(section==='interests'?4:3) || first[1].raw<2 || second[1].raw<(section==='interests'?2:1)) continue;
    const norm=(cell:typeof first[1])=>cell.normalized.numerator/cell.normalized.denominator;
    if(norm(first[1])-norm(second[1])>1/4 || norm(second[1])<=norm(third[1])) continue;
    const themePairKey=[dimensionTheme(section,first[0]),dimensionTheme(section,second[0])].sort(asciiCompare).join('|');
    const question=FOLLOWUP_QUESTIONS.find(q=>q.section===section&&q.themePairKey===themePairKey);
    if(!question) continue;
    items.push({questionId:question.questionId,section,pairKey:question.pairKey,themePairKey,triggerEvidenceRefs:sortedUnique([...first[1].evidenceIds,...second[1].evidenceIds]),reasonCode:'fixed_section_ambiguity'});
  }
  return {fixedInputHash:semanticHash({...parsed,scoringVersion:SCORING_VERSION,followupPolicyVersion:FOLLOWUP_POLICY_VERSION}),items};
}
export type FollowupPlan=ReturnType<typeof planFollowups>;
export const FollowupSubmissionSchema=z.object({fixedInputHash:z.string().regex(/^[a-f0-9]{64}$/),answers:z.array(ScanAnswerSchema).max(2),endedByUser:z.boolean()}).strict();
export type FollowupSubmission=z.infer<typeof FollowupSubmissionSchema>;
export function resolveFollowups(input:unknown, submission:unknown):FollowupResolution[] {
  const plan=planFollowups(input);
  const parsed=FollowupSubmissionSchema.parse(submission);
  if(parsed.fixedInputHash!==plan.fixedInputHash) throw new Error('STALE_FOLLOWUP_PLAN');
  const answers=new Map(parsed.answers.map(a=>[a.questionId,a]));
  if(answers.size!==parsed.answers.length) throw new Error('DUPLICATE_FOLLOWUP_ANSWER');
  if([...answers.keys()].some(id=>!plan.items.some(item=>item.questionId===id))) throw new Error('UNPLANNED_FOLLOWUP_ANSWER');
  if(answers.size!==plan.items.length&&!parsed.endedByUser) throw new Error('FOLLOWUP_PLAN_INCOMPLETE');
  // An explicit end keeps the already-answered prefix; later questions cannot have been reached.
  let missed=false;
  return plan.items.map(item=>{
    const answer=answers.get(item.questionId);
    if(!answer) { missed=true; return {...item,optionId:null,status:'ended_by_user',winnerThemeId:null,loserThemeId:null}; }
    if(missed) throw new Error('FOLLOWUP_ANSWER_AFTER_ENDED_ITEM');
    const option=getOption(item.questionId,answer.optionId);
    if(option.responseKind==='uncertain') return {...item,optionId:answer.optionId,status:'unresolved',winnerThemeId:null,loserThemeId:null};
    const winnerThemeId=dimensionTheme(item.section,option.dimension!);
    const loserThemeId=item.themePairKey.split('|').find(t=>t!==winnerThemeId) as Theme;
    return {...item,optionId:answer.optionId,status:'resolved',winnerThemeId,loserThemeId};
  });
}
