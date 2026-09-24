import type { BaziChart } from '@/lib/bazi/types';
import type { DeepPromptInput } from '@/lib/deep-analysis/prompts';
import type { DeepReport, DirectionId, DynamicQuestion } from '@/lib/deep-analysis/types';

const SAMPLE_NOTE = '当前为本地示例内容，未调用 Gemini API。';

// Keeps the streamed stages visible in the UI without slowing iteration down.
const CHUNK_DELAY_MS = 300;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const streamJson = async function* (value: unknown) {
  const text = JSON.stringify(value);
  const size = Math.ceil(text.length / 3);
  for (let index = 0; index < text.length; index += size) {
    await wait(CHUNK_DELAY_MS);
    yield text.slice(index, index + size);
  }
};

export function createSampleBaseReport(chart: BaziChart) {
  const region = chart.birthRegion?.trim() || '未填写出生地区';

  return {
    sections: [
      {
        heading: '核心性格与底层矛盾',
        body: `以你填写的出生信息（${chart.solarDate}，${region}）为基准，你的整体能量偏向「先向外推进、再回头整理」。你更习惯在行动中确认方向，而不是先想清楚全部细节再开始；这让你的启动速度明显快于平均水平。同时，真正消耗你的往往不是难度，而是长时间的停滞与反复的空转。`,
        bullets: [
          '进入陌生领域时，你更容易靠动手试错而不是靠前期研究。',
          '当进展无法被看见时，你的投入意愿会快速下降。',
          '你对「被安排」的容忍度偏低，对「自己决定」的需求偏高。',
        ],
      },
      {
        heading: '在什么地方？（方位与环境）',
        body: '你可能更适合信息流动快、反馈周期短、规则相对清晰的环境。过于依赖资历排序或人情往来的组织，会让你把大量精力花在非核心事务上，久而久之产生明显的消耗感。',
        bullets: [
          '优先考虑产业密度高、岗位流动快、商业反馈直接的城市。',
          '气候温和、生活节奏可自我调节的地方，更有利于你维持长期输出。',
          '完全依赖长周期评价体系的机构，通常不是你的高产区。',
        ],
      },
      {
        heading: '从事什么行业？（方向选择）',
        body: '你的优势集中在「把想法快速变成可被他人感知的成果」。因此，越靠近内容、产品、设计、市场表达与用户反馈的岗位，你的投入产出比越高；越远离真实用户、只处理内部流程的岗位，你的优势越难被看见。',
        bullets: [
          '靠近真实用户的岗位，比纯内部流程岗位更适合你。',
          '有明确交付物的工作，比长期没有结论的工作更适合你。',
          '允许你按自己节奏安排工作方式的团队，通常能放大你的产出。',
        ],
      },
      {
        heading: '怎么工作？与谁共事？',
        body: '你更适合小规模、决策链路短的协作方式。在层级复杂、需要反复对齐的组织里，你的推进速度会被显著拉低；在目标清晰、边界清楚的小团队中，你的作用会被放大。',
        bullets: [
          '你需要的搭档是能把边界和节奏定下来的人，而不是另一个只谈可能性的人。',
          '先约定产出与时间点，比反复沟通态度更有效。',
          '长期缺少反馈的合作，会让你逐渐退出投入状态。',
        ],
      },
      {
        heading: '给你的客观建议',
        body: '你的破局点不在「找到完美方向」，而在「把已经验证有效的动作重复到形成复利」。现阶段更值得做的，是选一个你能持续交付的领域，用可衡量的产出替代反复的方向思考。' ,
        bullets: [
          '先把一个方向做到有外部反馈，再决定要不要换。',
          '用「本周交付了什么」替代「我在思考方向」。',
          '接受前期不完美，把调整放在行动之后。',
        ],
      },
    ],
    disclaimer: `${SAMPLE_NOTE} 本内容仅从行为倾向角度提供参考，不构成医疗、法律、金融或心理诊断建议。`,
  };
}

export async function* streamSampleBaseReport(chart: BaziChart): AsyncGenerator<string> {
  yield* streamJson(createSampleBaseReport(chart));
}

const directionCopy: Record<DirectionId, { title: string; focus: string }> = {
  work: { title: '职业方向深度分析', focus: '日常任务、优势用法与职业角色' },
  industry: { title: '行业方向深度分析', focus: '行业环境、发展阶段与风险偏好' },
  city: { title: '城市发展深度分析', focus: '城市特征、机会结构与现实约束' },
  collaboration: { title: '工作环境与合作关系深度分析', focus: '组织方式、领导风格与协作边界' },
  custom: { title: '专项问题深度分析', focus: '你的具体问题与可执行结论' },
};

export function createSampleDeepReport(input: Pick<DeepPromptInput, 'directionId' | 'optionalContext'>): DeepReport {
  const copy = directionCopy[input.directionId];
  const context = input.optionalContext.trim();

  return {
    title: `${copy.title}（本地示例）`,
    ...(input.directionId === 'work' ? { workDirections: {
      groups: [
        { title: '把想法变成内容', tags: ['内容策划', '文案策划', '新媒体编辑', '视频策划'], rationale: '示例：如果基础报告提示表达倾向，且现实经历中也有内容产出，可以从这些任务开始验证。', boundary: '核对作品要求、修改频率和交付节奏；喜欢表达不等于已经具备专业能力。' },
        { title: '把信息变成判断', tags: ['用户研究', '市场研究', '数据分析', '竞品分析'], rationale: '示例：若你愿意追问原因、整理资料，可以尝试以调研和分析为主的任务。', boundary: '数据工具、访谈方法与研究经验需要单独确认。' },
        { title: '把方案推进落地', tags: ['项目协调', '活动策划', '产品运营', '用户运营'], rationale: '示例：若你做过组织协调，也能接受跨团队沟通，可以探索有明确交付和反馈的工作。', boundary: '先确认沟通强度、业绩指标和出差要求是否符合自己的限制。' },
      ],
      intersection: '示例交集：从用户问题出发，把调研发现转成内容或活动方案，再观察反馈。可先完成一份小型用户访谈与内容提案，比较自己更愿意持续做哪部分任务；这不是必须同时掌握所有标签。',
    }, jobResearch: {
      status: 'sample' as const,
      checkedAt: new Date().toISOString(),
      note: '当前为流程预览，未查询招聘网站。使用正式报告生成时，会在这里显示有来源支持的职位推荐。',
      recommendations: [],
    } } : {}),
    summary: `这份报告聚焦${copy.focus}。结论会综合你填写的出生信息、基础报告、校准答案${context ? '以及你补充的现实情况' : ''}，用于验证方向，而不是给出唯一答案。`,
    keyFindings: [
      '你更容易在反馈周期短、结果可被看见的事情上持续投入。',
      '真正的限制通常来自环境与协作方式，而不是能力本身。',
      context ? `你补充的现实约束是：${context}` : '补充信息越具体，结论越容易落到可执行的动作上。',
    ],
    cards: [
      {
        id: 'direction_fit',
        title: '更匹配的方向特征',
        summary: '优先选择能把你的判断直接转成产出的位置。',
        details: [
          '有明确交付物、能快速看到使用反馈的角色更适合你。',
          '需要长期等待评价、缺少外部反馈的位置，消耗会更明显。',
          '允许你按自己的节奏安排深度工作的团队，产出通常更好。',
        ],
        evidence: ['基础报告中的投入模式', '校准问题里的偏好答案'],
      },
      {
        id: 'environment_fit',
        title: '更匹配的环境条件',
        summary: '决策链路短、边界清楚的环境会明显放大你的效率。',
        details: [
          '层级越多、对齐成本越高的组织，你的推进速度越容易被拖慢。',
          '目标清晰的小团队通常更接近你的高效率状态。',
          '长期缺少反馈的协作关系，会让你逐步降低投入。',
        ],
        evidence: ['协作偏好答案', '你在补充说明里提到的现实条件'],
      },
      {
        id: 'near_term_move',
        title: '近期最值得动的一步',
        summary: '用一次可验证的动作替代反复的方向思考。',
        details: [
          '把当前方向拆成一个两周内能交付的小结果。',
          '拿到外部反馈后再判断是否调整，而不是提前推演所有可能。',
          '把结果记录下来，作为下一轮判断的依据。',
        ],
        evidence: ['你在校准问题里选择的优先项'],
      },
    ],
    risks: [
      {
        title: '把准备当成进展',
        detail: '当方向不确定时，人容易把收集信息当成推进，实际却没有产出。',
        mitigation: '给每个阶段设一个可见交付物，用交付物而不是投入时长衡量进展。',
      },
      {
        title: '同时推进太多方向',
        detail: '并行过多会让每个方向都停留在浅层，失去可比较的反馈。',
        mitigation: '同一时间只保留一个主方向，其余方向明确写进「暂缓清单」。',
      },
    ],
    nextActions: [
      { title: '定义两周内的交付物', detail: '选一个具体产出，写下验收标准和截止时间。', timeframe: '本周内' },
      { title: '找一次真实反馈', detail: '把交付物交给真实用户或同事，收集一条可操作的意见。', timeframe: '两周内' },
      { title: '复盘后决定是否调整', detail: '根据反馈决定继续、微调或换方向，并记录判断依据。', timeframe: '两周后' },
    ],
    reflectionQuestions: [
      '过去一年里，哪件事让你在拿到反馈后愿意继续投入？',
      '如果只能保留一个方向，你会留下哪一个？',
      '你现在最需要的是更清晰的判断，还是更快的反馈？',
    ],
    disclaimer: `${SAMPLE_NOTE} 内容用于自我探索参考，不构成宿命判断，也不承诺任何具体结果。`,
  };
}

export async function* streamSampleDeepReport(
  input: DeepPromptInput,
): AsyncGenerator<string, DeepReport | undefined> {
  const report = createSampleDeepReport(input);
  yield* streamJson(report);
  return report;
}

export function createSampleCustomQuestions(input: { customQuestion: string }): DynamicQuestion[] {
  const topic = input.customQuestion.trim().slice(0, 20) || '你的问题';

  return [
    {
      id: 'custom_q1',
      type: 'single',
      text: `关于「${topic}」，你目前处在什么阶段？`,
      options: [
        { id: 'custom_q1_exploring', label: '刚开始考虑' },
        { id: 'custom_q1_deciding', label: '正在做具体决定' },
        { id: 'custom_q1_acting', label: '已经在执行，需要校准' },
      ],
      required: true,
    },
    {
      id: 'custom_q2',
      type: 'multi',
      text: '做这个决定时，哪些现实条件必须考虑？',
      options: [
        { id: 'custom_q2_income', label: '收入与稳定性' },
        { id: 'custom_q2_family', label: '家庭与伴侣' },
        { id: 'custom_q2_time', label: '时间与精力' },
        { id: 'custom_q2_risk', label: '可承受的风险' },
      ],
      required: true,
      maxSelect: 3,
    },
    {
      id: 'custom_q3',
      type: 'single',
      text: '你希望这份分析优先回答哪一类问题？',
      options: [
        { id: 'custom_q3_direction', label: '该往哪个方向走' },
        { id: 'custom_q3_tradeoff', label: '怎么权衡取舍' },
        { id: 'custom_q3_next', label: '下一步具体做什么' },
      ],
      required: true,
    },
  ];
}
