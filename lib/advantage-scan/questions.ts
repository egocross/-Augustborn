import { z } from 'zod';
import { BEHAVIOR_DIMENSIONS, DISPLAY_ORDER_VERSION, INTEREST_DIMENSIONS, RECENT_SIGNALS, SCAN_VERSION, VALUE_DIMENSIONS, BEHAVIOR_THEME, INTEREST_THEME, type BehaviorDimension, type InterestDimension, type Theme } from '../integrated-report/ontology';
import { asciiCompare, canonicalSemantic } from '../integrated-report/canonical-hash';

const DimensionSchema = z.enum([...INTEREST_DIMENSIONS, ...BEHAVIOR_DIMENSIONS, ...VALUE_DIMENSIONS, ...RECENT_SIGNALS]);
export const OptionSchema = z.object({
  optionId: z.string().min(1).max(80), dimension: DimensionSchema.nullable(),
  text: z.string().min(1).max(500), displayOrder: z.number().int().positive().max(7),
  responseKind: z.enum(['signal', 'uncertain', 'none']),
}).strict();
const commonQuestion = {
  questionId: z.string().min(1).max(20), prompt: z.string().min(1).max(1000),
  options: z.array(OptionSchema).min(3).max(7),
};
export const QuestionSchema = z.discriminatedUnion('kind', [
  z.object({ ...commonQuestion, kind: z.literal('fixed'), section: z.enum(['interests','behavior','values','recent']) }).strict(),
  z.object({ ...commonQuestion, kind: z.literal('followup'), section: z.enum(['interests','behavior']),
    dimensions: z.tuple([DimensionSchema, DimensionSchema]), pairKey: z.string().min(1).max(150), themePairKey: z.string().min(1).max(150),
  }).strict(),
]);
export type Question = z.infer<typeof QuestionSchema>;
export type Option = z.infer<typeof OptionSchema>;
export type FollowupQuestion = Extract<Question, {kind:'followup'}>;
export function dimensionTheme(section: 'interests' | 'behavior', dimension: string): Theme {
  const theme = section === 'interests' ? INTEREST_THEME[dimension as InterestDimension] : BEHAVIOR_THEME[dimension as BehaviorDimension];
  if (!theme) throw new Error('INVALID_SECTION_DIMENSION');
  return theme;
}

function fixed(questionId: string, section: 'interests'|'behavior'|'values'|'recent', prompt: string, entries: [string,string][]): Question {
  return QuestionSchema.parse({questionId, section, kind:'fixed', prompt, options:entries.map(([suffix,text],i)=>({
    optionId:`${questionId}.${suffix}`, dimension:['uncertain','none'].includes(suffix)?null:suffix,
    text, displayOrder:i+1, responseKind:suffix==='uncertain'?'uncertain':suffix==='none'?'none':'signal',
  }))});
}
function followup(questionId: string, section:'interests'|'behavior', prompt:string, first:[string,string], second:[string,string]): FollowupQuestion {
  const dimensions = [first[0],second[0]];
  const themePairKey = dimensions.map(d=>dimensionTheme(section,d)).sort(asciiCompare).join('|');
  return QuestionSchema.parse({questionId,section,kind:'followup',prompt,dimensions,themePairKey,pairKey:`${section}:${themePairKey}`,
    options:[first,second,['uncertain','都可能／暂时分不清']].map(([suffix,text],i)=>({
      optionId:`${questionId}.${suffix}`,dimension:suffix==='uncertain'?null:suffix,text,displayOrder:i+1,responseKind:suffix==='uncertain'?'uncertain':'signal',
    })),
  }) as FollowupQuestion;
}

// Literal copy of the frozen specification; no runtime randomization or document reads.
const questions: Question[] = [
  fixed("Q1", "interests", "如果突然多出半天空闲时间，下面这些事情都没做过，你第一反应更愿意选哪个？", [["realistic", "把一个小设备、工具或家里的东西亲手装好"], ["investigative", "搞清楚一个一直困惑你的问题到底是什么原因"], ["artistic", "做一张海报、视频、文章或其他表达作品"], ["social", "帮一个正遇到困难的人把问题理清楚"], ["uncertain", "都差不多 / 很难判断"]]),
  fixed("Q2", "interests", "朋友的小店最近经营一般，如果他说“你随便挑一件事情帮我”，你更愿意：", [["investigative", "看销售、客流等信息，找出问题可能在哪里"], ["artistic", "重新设计店里的内容、展示或宣传方式"], ["enterprising", "想办法吸引更多顾客，并推动方案真正执行"], ["conventional", "把库存、订单、流程这些东西整理清楚"], ["uncertain", "很难判断"]]),
  fixed("Q3", "interests", "参加一个临时活动，现场需要有人承担不同角色，你更愿意：", [["social", "接待新人，帮助别人参与进去"], ["realistic", "负责设备、布置、拍摄或现场操作"], ["conventional", "安排名单、时间、物料与流程"], ["enterprising", "组织大家，把事情往前推进"], ["uncertain", "很难判断"]]),
  fixed("Q4", "interests", "拿到一个完全陌生的新工具，第一件真正吸引你的事情更可能是：", [["artistic", "想想它还能不能被用来做一些新的东西"], ["enterprising", "想想它能解决谁的问题、产生什么价值"], ["investigative", "搞清楚它为什么这样工作、原理是什么"], ["realistic", "直接动手试，看能不能把它运行起来"], ["uncertain", "很难判断"]]),
  fixed("Q5", "interests", "面对一批很乱的信息，如果必须选一个任务，你更愿意：", [["enterprising", "从里面判断什么最重要，并推动下一步决定"], ["conventional", "分类、整理、建立清晰规则"], ["social", "把它解释成别人一看就明白的内容"], ["investigative", "找出其中隐藏的规律、异常或原因"], ["uncertain", "很难判断"]]),
  fixed("Q6", "interests", "进入一个完全陌生的领域，最容易让你好奇的是：", [["conventional", "它背后的流程、规则和体系是怎样运转的"], ["social", "这个领域怎样真正帮助到某类人"], ["realistic", "能不能学会里面的工具、设备或实际操作"], ["artistic", "能不能用自己的方式创造出一些新东西"], ["uncertain", "很难判断"]]),
  fixed("Q7", "behavior", "领导给你一个很模糊的任务：\n\n“最近用户好像不太满意，你看看怎么改善，明天下午跟我说一下。”\n\n没有更多要求。\n\n你的第一反应最可能是：", [["investigate", "先找数据、反馈和事实，看问题到底发生在哪里"], ["structure", "先把目标、问题、信息、方案整理成一个框架"], ["create", "先想几个完全不同的新方案，看有没有新突破口"], ["execute", "先做出一个能运行的小版本，再根据结果修改"], ["collaborate", "先找用户或相关同事聊，理解他们到底遇到了什么"], ["influence", "先确认谁能决定这件事，以及怎样让关键人接受方案"], ["uncertain", "很难判断"]]),
  fixed("Q8", "behavior", "一项工作反复出错。\n\n团队每个月都要做一次，大家已经习惯了，但你发现总是在同样几个地方浪费时间。\n\n你最自然想做的是：", [["structure", "重做流程、模板或规则，让以后不容易再出错"], ["create", "想一种与现在完全不同的做法"], ["execute", "直接解决目前最大的卡点，让本轮先跑顺"], ["collaborate", "找真正使用这个流程的人聊，弄清楚他们为什么这么做"], ["influence", "找相关负责人推动大家统一采用新的方式"], ["investigate", "查过去几次错误，找到反复出问题的根因"], ["uncertain", "很难判断"]]),
  fixed("Q9", "behavior", "你收到一份很长、很乱的资料，半小时后要向别人说明。\n\n你的自然做法更接近：", [["create", "用图、故事、例子或者新的表达方式重新呈现"], ["execute", "先做一版能直接拿去用的东西"], ["collaborate", "先想听众最难理解什么，再按他们的视角重新解释"], ["influence", "先明确最后希望听众接受什么判断或采取什么行动"], ["investigate", "找出最关键的结论以及支撑它的证据"], ["structure", "重组内容，把它变成几个清晰层级"], ["uncertain", "很难判断"]]),
  fixed("Q10", "behavior", "发现一个可能不错的新机会。\n\n现在信息很少，也没人告诉你应该怎么做。\n\n你更容易先：", [["execute", "做一个最小尝试，先拿到真实反馈"], ["collaborate", "去找真正处在这个问题中的人交流"], ["influence", "找可能的合作方、客户或资源方，看能不能推动起来"], ["investigate", "搜集信息，判断这个机会究竟是不是真的"], ["structure", "把未知因素拆开，列出验证顺序"], ["create", "根据现有信息先想一个与众不同的解决方案"], ["uncertain", "很难判断"]]),
  fixed("Q11", "values", "两份工作收入差不多。\n\n如果只能保证下面一个条件，你最难放弃哪个？", [["independence", "我能决定用什么方式完成工作"], ["achievement", "我能不断解决更难的问题、明显感觉自己在成长"], ["relationships", "工作能真正帮助别人，而且人与人之间关系不错"], ["support", "有靠谱的领导、团队和资源支持我把事情做好"], ["recognition", "做得好会被看见，并得到更大的影响力或机会"], ["workingConditions", "工作比较稳定，时间、环境和生活状态可以长期承受"], ["uncertain", "暂时判断不了"]]),
  fixed("Q12", "values", "为了一个明显更好的工作机会，下面哪一种改善最值得你承受一段时间的适应成本？", [["relationships", "更有意义的人际或助人价值"], ["support", "更好的领导和团队支持"], ["recognition", "更大的认可、晋升和影响空间"], ["workingConditions", "更稳定、更可持续的工作条件"], ["independence", "更大的自主权"], ["achievement", "更大的挑战和成长空间"], ["uncertain", "不确定"]]),
  fixed("Q13", "values", "三年以后回头看，哪一种结果最容易让你觉得：\n\n“这三年没有白过。”", [["recognition", "我的成果被市场或组织看见，拥有更大的影响力"], ["workingConditions", "我建立了稳定、可持续而且生活质量不错的状态"], ["independence", "我已经拥有很强的自主能力，可以独立做决定"], ["achievement", "我解决过真正困难的问题，能力明显提高"], ["relationships", "我确实帮助或影响过一些人"], ["support", "我在一个值得信任的团队里建立了扎实基础"], ["uncertain", "很难判断"]]),
  fixed("Q14", "recent", "只想最近半年。\n\n有没有某一类事情，即使没人要求你，你看到以后也比较容易主动去处理？", [["structure", "把混乱的信息、文件、流程整理清楚"], ["investigate", "发现问题以后，总想搞清楚原因"], ["create", "看到普通的东西，会想能不能换一种方式表达或改造"], ["collaborate", "别人遇到问题时，会自然想理解、解释或帮忙"], ["execute_influence", "看到事情一直没结果，会想推动它赶紧发生"], ["hands_on", "遇到坏掉、不顺手或没做好的东西，会想自己动手弄一下"], ["none", "想不起来 / 好像都没有"]]),
  followup("FI-IA", "interests", "有一小时探索一个陌生话题，且不要求最后交付，你更愿意把时间花在哪里？", ["investigative", "找资料核对事实，弄清它为什么会这样"], ["artistic", "做一种自己的表达，尝试新的呈现方式"]),
  followup("FI-IC", "interests", "一批资料既杂乱又有异常，时间只够先做一件事，你更愿意？", ["investigative", "追查异常的原因，检验可能的解释"], ["conventional", "统一分类与命名，让资料容易查找使用"]),
  followup("FI-AS", "interests", "有人要理解一个新概念，两种任务都有人需要，你更愿意承担？", ["artistic", "自己制作一段图文或视频，试出有新意的表达"], ["social", "与对方交流，根据他卡住的地方耐心解释"]),
  followup("FI-SE", "interests", "一个社区项目刚开始，你更愿意先投入哪件事？", ["social", "了解参与者的困难，帮助他们顺利参与"], ["enterprising", "联系资源和合作方，争取支持把项目推起来"]),
  followup("FI-RI", "interests", "一个陌生装置无法正常工作，环境安全且可以随意试验，你更愿意？", ["realistic", "按说明操作、调整零件，亲手尝试恢复运行"], ["investigative", "查看现象与记录，推理故障可能的原因"]),
  followup("FI-CE", "interests", "一个小团队准备启动活动，你更愿意先承担？", ["conventional", "把预算、物料、时间和分工登记清楚"], ["enterprising", "找关键参与者沟通，争取资源并推动决定"]),
  followup("FB-IS", "behavior", "收到一份杂乱的问题清单，只能先做一步，你更自然会？", ["investigate", "核对几个关键问题的证据与原因"], ["structure", "先给问题分类，建立清晰的处理框架"]),
  followup("FB-CE", "behavior", "要改善一项体验，时间有限，你更自然会先？", ["create", "构思两三种不同方案，寻找新的切入点"], ["execute", "做一个最简可用版本，尽快看看实际反馈"]),
  followup("FB-CI", "behavior", "方案需要多人参与但尚未达成共识，你更自然会先？", ["collaborate", "听取各方困难，让彼此理解需要"], ["influence", "找到关键决策者，推动明确承诺与下一步"]),
 ];
const frozenBank = { scanVersion: SCAN_VERSION, displayOrderVersion: DISPLAY_ORDER_VERSION, questions };
const frozenSemantic = canonicalSemantic(frozenBank);
export const BankSchema = z.object({
  scanVersion:z.literal(SCAN_VERSION),displayOrderVersion:z.literal(DISPLAY_ORDER_VERSION),questions:z.array(QuestionSchema).length(23),
}).strict().superRefine((bank,ctx)=>{
  // Exact version content also checks every frozen exposure and counterbalance cell.
  if(canonicalSemantic(bank)!==frozenSemantic) ctx.addIssue({code:'custom',message:'FROZEN_BANK_MISMATCH'});
});
export type Bank = z.infer<typeof BankSchema>;
function deepFreeze<T>(value:T):T {
  if(value && typeof value==='object') { for(const item of Object.values(value)) deepFreeze(item); Object.freeze(value); }
  return value;
}
export const QUESTION_BANK: Bank = deepFreeze(BankSchema.parse(frozenBank));
export const FIXED_QUESTIONS = deepFreeze(QUESTION_BANK.questions.filter(q=>q.kind==='fixed'));
export const FOLLOWUP_QUESTIONS = deepFreeze(QUESTION_BANK.questions.filter((q):q is FollowupQuestion=>q.kind==='followup'));
export function getQuestion(questionId:string):Question {
  const question=QUESTION_BANK.questions.find(q=>q.questionId===questionId);
  if(!question) throw new Error('UNKNOWN_QUESTION');
  return question;
}
export function getOption(questionId:string,optionId:string):Option {
  const option=getQuestion(questionId).options.find(o=>o.optionId===optionId);
  if(!option) throw new Error('INVALID_QUESTION_OPTION');
  return option;
}
export const ScanAnswerSchema=z.object({questionId:z.string().min(1).max(20),optionId:z.string().min(1).max(80)}).strict().superRefine((answer,ctx)=>{
  const question=QUESTION_BANK.questions.find(q=>q.questionId===answer.questionId);
  if(!question?.options.some(o=>o.optionId===answer.optionId)) ctx.addIssue({code:'custom',message:'INVALID_QUESTION_OPTION'});
});
export type ScanAnswer=z.infer<typeof ScanAnswerSchema>;
export const FixedAnswersInputSchema=z.object({scanVersion:z.literal(SCAN_VERSION),answers:z.array(ScanAnswerSchema).length(14)}).strict().superRefine((input,ctx)=>{
  const ids=new Set(input.answers.map(a=>a.questionId));
  if(ids.size!==14 || FIXED_QUESTIONS.some(q=>!ids.has(q.questionId))) ctx.addIssue({code:'custom',message:'FIXED_ANSWERS_INCOMPLETE_OR_DUPLICATE'});
});
export type FixedAnswersInput=z.infer<typeof FixedAnswersInputSchema>;

export function bankInvariantErrors(bank: Bank): string[] {
  const errors: string[] = [];
  for (const question of bank.questions) {
    for (const option of question.options) {
      if (!option.optionId.startsWith(question.questionId + '.')) errors.push('identity:' + question.questionId);
    }
    const orders = question.options.map(o => o.displayOrder);
    if (Math.min(...orders) !== 1 || new Set(orders).size !== orders.length || Math.max(...orders) !== orders.length) {
      errors.push('position:' + question.questionId);
    }
    const dimensions = question.options.filter(o => o.dimension !== null).map(o => o.dimension);
    if (new Set(dimensions).size !== dimensions.length) errors.push('dimension:' + question.questionId);
    const signalCount = question.options.filter(o => o.responseKind === 'signal').length;
    if (question.kind === 'fixed') {
      const expectedSignals = question.section === 'interests' ? 4 : 6;
      const expectedOptions = question.section === 'interests' ? 5 : 7;
      if (signalCount !== expectedSignals || question.options.length !== expectedOptions) errors.push('exposure:' + question.questionId);
      const number = Number(question.questionId.slice(1));
      const expectedSection = number <= 6 ? 'interests' : number <= 10 ? 'behavior' : number <= 13 ? 'values' : 'recent';
      if (question.section !== expectedSection) errors.push('section:' + question.questionId);
    } else if (signalCount !== 2) {
      errors.push('exposure:' + question.questionId);
    }
  }
  return errors;
}
