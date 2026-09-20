import type { DirectionId, FixedDirectionId, FixedQuestion } from './types';

export const QUESTIONNAIRE_VERSION = 'v1' as const;

export const DIRECTIONS: ReadonlyArray<{ id: DirectionId; title: string; description: string }> = [
  { id: 'work', title: '我适合做什么工作', description: '聚焦日常任务、优势用法与职业角色' },
  { id: 'industry', title: '我适合进入什么行业', description: '聚焦行业环境、发展阶段与风险偏好' },
  { id: 'city', title: '我更适合在哪类城市发展', description: '聚焦城市特征、机会结构与现实约束' },
  { id: 'collaboration', title: '我适合怎样的工作环境与合作关系', description: '聚焦组织方式、领导风格与协作边界' },
  { id: 'custom', title: '我有其他问题', description: '用一个具体问题开始个性化探索' },
];

const options = (values: ReadonlyArray<readonly [string, string]>) => values.map(([id, label]) => ({ id, label }));
const question = (value: FixedQuestion): FixedQuestion => value;

export const QUESTION_BANK_V1: Record<FixedDirectionId, FixedQuestion[]> = {
  work: [
    question({ id: 'work_q1', directionId: 'work', type: 'single', text: '你目前处于什么状态？', required: true, options: options([
      ['work_q1_employed_stay', '在职，目前不考虑换工作'], ['work_q1_employed_change', '在职，但正在考虑换工作'], ['work_q1_job_seeking', '待业 / 正在找工作'], ['work_q1_student', '学生'], ['work_q1_freelance', '自由职业'], ['work_q1_entrepreneur', '创业 / 个体经营'], ['work_q1_other', '其他'],
    ]) }),
    question({ id: 'work_q2', directionId: 'work', type: 'multi', text: '过去你主要做过哪些类型的事情？', required: true, options: options([
      ['work_q2_sales', '销售 / 商务'], ['work_q2_content', '内容创作'], ['work_q2_design', '设计 / 审美'], ['work_q2_technology', '技术 / 工程'], ['work_q2_operations', '运营 / 行政'], ['work_q2_service', '客户服务 / 与人沟通'], ['work_q2_education', '教育 / 培训'], ['work_q2_management', '管理 / 组织'], ['work_q2_manual', '手工 / 实操'], ['work_q2_research', '研究 / 分析'], ['work_q2_limited_experience', '工作经历较少'], ['work_q2_other', '其他'],
    ]) }),
    question({ id: 'work_q3', directionId: 'work', type: 'multi', text: '哪些事情你做起来会感觉更自然？', required: true, options: options([
      ['work_q3_strangers', '和陌生人交流'], ['work_q3_persuade', '说服别人接受自己的想法'], ['work_q3_analyze', '分析复杂问题'], ['work_q3_ideas', '提出新的点子'], ['work_q3_organize', '把混乱的事情整理清楚'], ['work_q3_hands_on', '动手解决实际问题'], ['work_q3_independent_research', '长期独立研究某个问题'], ['work_q3_drive_projects', '组织资源并推进事情完成'], ['work_q3_guide', '帮助或指导别人'], ['work_q3_trends', '发现机会和趋势'], ['work_q3_uncertain', '暂时不确定'],
    ]) }),
    question({ id: 'work_q4', directionId: 'work', type: 'multi', text: '你最不希望长期处于哪种工作状态？', required: true, maxSelect: 3, options: options([
      ['work_q4_repetitive', '高度重复'], ['work_q4_social', '高频社交'], ['work_q4_isolated', '长时间独处'], ['work_q4_controlled', '被严格管理'], ['work_q4_trivial', '大量琐碎事务'], ['work_q4_competitive', '高压竞争'], ['work_q4_unstable_income', '收入不稳定'], ['work_q4_travel', '经常出差'], ['work_q4_office', '长时间坐办公室'], ['work_q4_change', '工作内容经常变化'], ['work_q4_none', '没有明显排斥'],
    ]) }),
    question({ id: 'work_q5', directionId: 'work', type: 'multi', text: '现阶段，你选择工作最看重什么？', required: true, maxSelect: 2, options: options([
      ['work_q5_income', '提高收入'], ['work_q5_stability', '稳定'], ['work_q5_freedom', '自由'], ['work_q5_growth', '快速成长'], ['work_q5_achievement', '成就感'], ['work_q5_balance', '工作与生活平衡'], ['work_q5_future', '长期发展前景'],
    ]) }),
  ],
  industry: [
    question({ id: 'industry_q1', directionId: 'industry', type: 'single', text: '你目前主要处在哪个行业？', required: true, options: options([
      ['industry_q1_technology', '互联网 / 软件 / AI'], ['industry_q1_retail', '电商 / 零售 / 消费品'], ['industry_q1_media', '内容 / 传媒 / 广告'], ['industry_q1_education', '教育 / 培训'], ['industry_q1_finance', '金融 / 保险 / 投资'], ['industry_q1_health', '医疗 / 健康'], ['industry_q1_manufacturing', '制造业 / 工业'], ['industry_q1_real_estate', '建筑 / 房地产'], ['industry_q1_hospitality', '餐饮 / 酒店 / 旅游'], ['industry_q1_logistics', '物流 / 交通 / 供应链'], ['industry_q1_professional', '专业服务（咨询、法律、财税等）'], ['industry_q1_public', '政府 / 公共事业'], ['industry_q1_culture', '文化 / 艺术 / 设计'], ['industry_q1_environment', '农业 / 环境 / 能源'], ['industry_q1_self_employed', '自由职业 / 个体经营'], ['industry_q1_student', '学生 / 暂未进入职场'], ['industry_q1_other', '其他'],
    ]) }),
    question({ id: 'industry_q2', directionId: 'industry', type: 'single', text: '你对更换行业的接受程度？', required: true, options: options([
      ['industry_q2_stay', '暂时不想换行业，只想换岗位'], ['industry_q2_adjacent', '可以换到相近行业'], ['industry_q2_cross', '只要更适合我，可以跨行业'], ['industry_q2_restart', '愿意彻底重新开始'], ['industry_q2_uncertain', '目前不确定'],
    ]) }),
    question({ id: 'industry_q3', directionId: 'industry', type: 'multi', text: '现在选择行业，你最看重什么？', required: true, maxSelect: 3, options: options([
      ['industry_q3_income_ceiling', '收入上限高'], ['industry_q3_stable_income', '收入稳定'], ['industry_q3_growth', '行业长期增长'], ['industry_q3_jobs', '容易找到工作'], ['industry_q3_personal_growth', '个人成长速度'], ['industry_q3_strengths', '能发挥自己的优势'], ['industry_q3_meaning', '工作有意义 / 有价值感'], ['industry_q3_time', '时间比较自由'], ['industry_q3_entrepreneurship', '有创业或副业机会'], ['industry_q3_location', '地域限制较少'], ['industry_q3_simple_relations', '人际关系相对简单'], ['industry_q3_intensity', '工作强度相对可控'],
    ]) }),
    question({ id: 'industry_q4', directionId: 'industry', type: 'single', text: '你更偏好哪类行业环境？', required: true, options: options([
      ['industry_q4_mature', '成熟稳定、规则清晰的大行业'], ['industry_q4_emerging', '快速增长、机会较多的新兴行业'], ['industry_q4_niche', '小而专业的细分行业'], ['industry_q4_creative', '创意和变化较多的行业'], ['industry_q4_service', '与人强相关的服务型行业'], ['industry_q4_expertise', '技术 / 专业能力驱动的行业'], ['industry_q4_uncertain', '暂不确定'],
    ]) }),
    question({ id: 'industry_q5', directionId: 'industry', type: 'single', text: '你对行业不确定性的接受程度？', required: true, options: options([
      ['industry_q5_very_low', '很低：更希望稳定、可预测'], ['industry_q5_low', '较低：可以接受少量变化'], ['industry_q5_medium', '中等：稳定和机会都重要'], ['industry_q5_high', '较高：愿意承担风险换成长'], ['industry_q5_very_high', '很高：愿意进入早期行业或创业型领域'],
    ]) }),
  ],
  city: [
    question({ id: 'city_q1', directionId: 'city', type: 'text', text: '你目前主要生活在哪个城市？', required: true }),
    question({ id: 'city_q2', directionId: 'city', type: 'single', text: '你能够接受的发展范围？', required: true, supplementaryField: { id: 'city_q2_candidates', label: '已经有考虑的城市？', placeholder: '例如：上海、成都', required: false, maxItems: 5 }, options: options([
      ['city_q2_current', '只考虑目前所在城市'], ['city_q2_nearby', '可以考虑同省 / 周边城市'], ['city_q2_domestic', '可以考虑国内其他城市'], ['city_q2_major', '一线 / 新一线城市都可以'], ['city_q2_small', '中小城市也可以'], ['city_q2_overseas', '可以考虑海外'], ['city_q2_global', '全球范围都可以'], ['city_q2_uncertain', '暂时不确定'],
    ]) }),
    question({ id: 'city_q3', directionId: 'city', type: 'multi', text: '选择城市时，你最看重什么？', required: true, maxSelect: 3, options: options([
      ['city_q3_jobs', '工作机会多'], ['city_q3_income', '收入水平高'], ['city_q3_industry', '所在行业发展好'], ['city_q3_business', '创业 / 商业机会多'], ['city_q3_cost', '房租和生活成本低'], ['city_q3_housing', '买房压力较小'], ['city_q3_pace', '生活节奏舒适'], ['city_q3_climate', '气候适合'], ['city_q3_nature', '自然环境好'], ['city_q3_services', '公共服务 / 医疗 / 教育好'], ['city_q3_culture', '社交和文化生活丰富'], ['city_q3_family', '离家人近'], ['city_q3_international', '国际化程度高'], ['city_q3_transport', '交通便利'],
    ]) }),
    question({ id: 'city_q4', directionId: 'city', type: 'single', text: '未来 3–5 年，你更可能采取哪种发展方式？', required: true, options: options([
      ['city_q4_stable_job', '找一份稳定工作'], ['city_q4_high_income', '寻找高收入职业机会'], ['city_q4_specialize', '深耕某个专业领域'], ['city_q4_freelance', '做自由职业'], ['city_q4_entrepreneur', '创业 / 做自己的生意'], ['city_q4_online', '做线上业务，不强依赖城市'], ['city_q4_side_project', '边工作边尝试副业'], ['city_q4_uncertain', '目前还没有明确方向'],
    ]) }),
    question({ id: 'city_q5', directionId: 'city', type: 'multi', text: '哪些现实条件会限制你选择城市？', required: true, options: options([
      ['city_q5_partner', '家庭 / 伴侣'], ['city_q5_children', '孩子教育'], ['city_q5_parents', '父母养老'], ['city_q5_property', '房产'], ['city_q5_residency', '户籍 / 签证'], ['city_q5_job', '当前工作'], ['city_q5_income', '收入水平'], ['city_q5_move_cost', '迁移成本'], ['city_q5_language', '语言'], ['city_q5_climate', '对当地气候的适应'], ['city_q5_distance', '不愿离家太远'], ['city_q5_none', '没有明显限制'], ['city_q5_other', '其他'],
    ]) }),
  ],
  collaboration: [
    question({ id: 'collaboration_q1', directionId: 'collaboration', type: 'single', text: '工作时，你更舒服的状态是？', required: true, options: options([
      ['collaboration_q1_independent', '大部分时间独立完成'], ['collaboration_q1_independent_first', '独立工作为主，必要时合作'], ['collaboration_q1_balanced', '独立与团队各一半'], ['collaboration_q1_team', '团队协作为主'], ['collaboration_q1_social', '高频与人交流、协作'], ['collaboration_q1_uncertain', '不确定'],
    ]) }),
    question({ id: 'collaboration_q2', directionId: 'collaboration', type: 'single', text: '你更喜欢哪种工作环境？', required: true, options: options([
      ['collaboration_q2_stable', '稳定、有明确流程和规则'], ['collaboration_q2_autonomous', '目标明确，但执行方式比较自由'], ['collaboration_q2_dynamic', '变化快、不断解决新问题'], ['collaboration_q2_creative', '创意导向，允许大量尝试'], ['collaboration_q2_competitive', '高竞争、高绩效、高回报'], ['collaboration_q2_calm', '节奏相对平稳、压力较低'], ['collaboration_q2_small_team', '小团队、灵活直接'], ['collaboration_q2_uncertain', '暂不确定'],
    ]) }),
    question({ id: 'collaboration_q3', directionId: 'collaboration', type: 'multi', text: '你更喜欢什么样的领导或合作伙伴？', required: true, maxSelect: 2, options: options([
      ['collaboration_q3_clear', '给清晰目标和规则'], ['collaboration_q3_autonomy', '给我充分自主权'], ['collaboration_q3_mentor', '能教我、带我成长'], ['collaboration_q3_decisive', '决策果断、执行力强'], ['collaboration_q3_stable', '情绪稳定、沟通直接'], ['collaboration_q3_creative', '有创意、敢于尝试'], ['collaboration_q3_data', '逻辑强、重视数据'], ['collaboration_q3_resources', '擅长关系和资源整合'], ['collaboration_q3_complementary', '能互补我的短板'], ['collaboration_q3_peer', '不希望有明显上下级关系'],
    ]) }),
    question({ id: 'collaboration_q4', directionId: 'collaboration', type: 'multi', text: '哪些合作方式最让你难以长期接受？', required: true, maxSelect: 3, options: options([
      ['collaboration_q4_micromanagement', '微观管理，什么都要管'], ['collaboration_q4_changing_goals', '目标经常改变'], ['collaboration_q4_unclear', '权责不清'], ['collaboration_q4_politics', '办公室政治严重'], ['collaboration_q4_emotional', '情绪化沟通'], ['collaboration_q4_meetings', '大量无意义会议'], ['collaboration_q4_social', '高频社交和应酬'], ['collaboration_q4_overtime', '长期加班'], ['collaboration_q4_internal_competition', '内部竞争严重'], ['collaboration_q4_slow', '做事非常慢、流程繁琐'], ['collaboration_q4_feedback', '缺少反馈'], ['collaboration_q4_repetitive', '工作内容长期重复'], ['collaboration_q4_none', '没有明显排斥'],
    ]) }),
    question({ id: 'collaboration_q5', directionId: 'collaboration', type: 'single', text: '你理想中的长期工作形态更接近哪一种？', required: true, options: options([
      ['collaboration_q5_corporate', '大公司稳定岗位'], ['collaboration_q5_professional', '专业型公司 / 专业岗位'], ['collaboration_q5_startup', '小团队 / 创业公司'], ['collaboration_q5_freelance', '自由职业'], ['collaboration_q5_entrepreneur', '独立创业'], ['collaboration_q5_remote', '远程工作'], ['collaboration_q5_project', '项目制工作'], ['collaboration_q5_portfolio', '主业 + 副业'], ['collaboration_q5_uncertain', '暂时不确定'],
    ]) }),
  ],
};
