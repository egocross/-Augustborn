import type { DeepReport, DirectionId } from '../deep-analysis/types';

/** UI fixtures only: no current-market facts or invented citations. */
export function sampleExploration(direction: DirectionId): Partial<DeepReport> {
  const market = direction === 'industry' || direction === 'city' ? { marketResearch: {
    direction, status: 'sample' as const, checkedAt: new Date().toISOString(), examples: [],
    note: '当前为流程示例，未联网检索；这里不展示虚构的产业资料、具体城市或来源。正式生成时会显示本次检索支持的实例。',
  } } : {};
  if (direction === 'industry') return { ...market, industryDirections: {
    groups: [
      { title: '帮助企业把专业讲清楚', tags: ['品牌内容服务', '数字出版', '企业培训', '专业会展'], rationale: '示例：有专业表达经历时，可以比较知识转化为内容和服务的不同路径。', boundary: '核对作品、行业知识与客户需求；不能仅凭表达偏好判定适配。' },
      { title: '用服务改善业务流程', tags: ['企业软件服务', '工业数字化服务', '供应链服务', '商业研究服务'], rationale: '示例：如果愿意理解业务问题，可尝试有明确交付的服务环节。', boundary: '要核对技术或业务经验、项目周期和实际获客条件。' },
      { title: '从具体消费场景切入', tags: ['文旅服务', '文化展览', '生活服务', '零售服务'], rationale: '示例：若愿意接触实际用户，可比较线下与线上服务的日常任务。', boundary: '现场工作、运营时段和收入波动需结合现实限制核对。' },
    ],
    intersection: '示例：把专业知识变成客户能理解、能使用的交付物。先选一种熟悉的客户问题做小项目，再决定具体行业，不因为一个行业热门就转行。',
  } };
  if (direction === 'city') return { ...market, cityPlan: {
    tiers: [
      { priority: 1, profile: '现实约束内、能先验证机会的城市', rationale: '示例：优先从当前城市或已有资源的地方开始，降低试错成本。', boundary: '需要找到与工作方向相关的实际机会，而不是只看城市名气。' },
      { priority: 2, profile: '产业相关，但需要补齐条件的城市', rationale: '示例：有产业基础还不够，要看自己的技能、预算和家庭安排能否匹配。', boundary: '先核对岗位门槛、通勤与生活预算，再决定是否迁移。' },
      { priority: 3, profile: '可以关注，暂时不宜投入迁移成本', rationale: '示例：需求不明确或与当前限制冲突时，保留观察而非立即行动。', boundary: '若只考虑本地，这一梯队可以不列城市，待约束变化后再评估。' },
    ],
    intersection: '示例：先筛掉不符合现实限制的地方，再比较实际岗位或客户需求，最后用预算和短住验证生活是否可持续。',
  } };
  if (direction === 'collaboration') return { collaborationPlan: {
    groups: [
      { title: '把想法变成可交付的方案', tags: ['范围管理', '项目推进', '时间规划', '质量核对'], rationale: '示例：当你擅长产出想法但推进吃力时，可以寻找协助明确范围的人。', boundary: '执行力不应表现为控制每个细节或否定你的判断。' },
      { title: '把专业与真实需求连接起来', tags: ['客户访谈', '商务沟通', '需求验证', '资源协调'], rationale: '示例：当专业交付是你的重点，可以与擅长理解客户的人分工。', boundary: '对方的判断也需要验证，不能将所有商业决定完全交出去。' },
      { title: '让合作长期保持清晰', tags: ['反馈复盘', '冲突沟通', '目标对齐', '风险识别'], rationale: '示例：长期合作需要共同目标、坦诚反馈和可执行的边界。', boundary: '观点不同可以讨论，贬低、隐瞒信息和反复越界不是互补。' },
    ],
    intersection: '示例：让专业产出、需求验证和交付推进形成闭环。你们可以有相似理想，但需要在职责、质量和投入边界上达成共识。',
    scenarios: [
      { title: '专业交付 × 客户需求验证', yourRole: '在具备相关能力的前提下，负责内容或技术交付。', partnerRole: '负责客户访谈、需求澄清和商务范围核对。', sharedDecision: '共同决定目标、交付范围、质量标准与报价边界。', trial: '用两周完成一次小提案，分别记录需求变化、交付质量和沟通成本。', redFlags: ['未经商量就承诺额外交付', '客户信息不透明，无法共同判断'] },
      { title: '独立研究 × 项目协调', yourRole: '负责研究问题、形成依据和提出方案。', partnerRole: '协调时间与资源，提前指出依赖和风险。', sharedDecision: '共同排定优先级，约定什么变化需要重新协商。', trial: '先推进一个小里程碑，用一次复盘核对沟通是否足够、又不过度打断。', redFlags: ['把协调变成随时查岗', '目标变化却拒绝调整时间和资源'] },
      { title: '自主执行 × 清晰目标的领导', yourRole: '在约定范围内独立执行，并定期同步风险。', partnerRole: '说明目标和评价标准，提供资源与必要反馈。', sharedDecision: '约定检查点、升级问题的时机和职责边界。', trial: '选择一周任务试行两次简短同步，看能否兼顾自主与反馈。', redFlags: ['口头放权但不断临时干预', '评价标准事后改变'] },
    ],
  } };
  return {};
}
