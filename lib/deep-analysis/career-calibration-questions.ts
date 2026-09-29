import type { CareerDraftAnswers } from './career-calibration';

export const CAREER_QUESTIONNAIRE_VERSION = 'career-v1' as const;

export type CareerSectionId =
  | 'current-status'
  | 'income'
  | 'responsibilities'
  | 'location'
  | 'transition-capacity'
  | 'career-capital'
  | 'work-boundaries'
  | 'values';

export type CareerCondition = {
  questionId: string;
  operator: 'includes' | 'oneOf';
  optionIds: readonly string[];
};

export type CareerQuestionOption = {
  id: string;
  label: string;
  group?: 'experience' | 'skills' | 'evidence' | 'other';
};

export type CareerQuestion = {
  id: string;
  section: CareerSectionId;
  type: 'single' | 'multi';
  question: string;
  helperText?: string;
  options: readonly CareerQuestionOption[];
  required: boolean;
  maxSelections?: number;
  condition?: CareerCondition;
  exclusiveOptionIds?: readonly string[];
  other?: {
    optionId: string;
    label: string;
    placeholder?: string;
    required: boolean;
    maxLength: number;
    inputType: 'text' | 'currency';
  };
};

export const CAREER_SECTIONS: ReadonlyArray<{
  id: CareerSectionId;
  title: string;
  description: string;
}> = [
  { id: 'current-status', title: '当前状态', description: '先确认你进入新方向的时间边界' },
  { id: 'income', title: '收入与现金流', description: '只记录现实底线，不询问资产明细' },
  { id: 'responsibilities', title: '现实责任', description: '识别必须持续承担的责任' },
  { id: 'location', title: '地点边界', description: '明确可接受的迁移范围' },
  { id: 'transition-capacity', title: '转型投入', description: '确认时间、准备周期与预算' },
  { id: 'career-capital', title: '职业资本', description: '找出可以带到下一份职业的积累' },
  { id: 'work-boundaries', title: '工作边界', description: '排除现实中不能长期接受的条件' },
  { id: 'values', title: '当前优先级', description: '在可行方向中确定排序标准' },
];

const options = (
  values: ReadonlyArray<readonly [string, string] | readonly [string, string, CareerQuestionOption['group']]>,
): CareerQuestionOption[] => values.map(([id, label, group]) => ({ id, label, ...(group ? { group } : {}) }));

export const CAREER_QUESTIONS: readonly CareerQuestion[] = [
  {
    id: 'career_status', section: 'current-status', type: 'single', required: true,
    question: '你现在处于什么职业状态？',
    options: options([
      ['career_status_first_job', '第一次正式求职'],
      ['career_status_employed_exploring', '目前在职，只是在探索其他可能'],
      ['career_status_employed_switching', '目前在职，已经明确准备转行'],
      ['career_status_unemployed', '已离职 / 待业，正在寻找新方向'],
      ['career_status_freelance', '自由职业 / 个体经营'],
      ['career_status_entrepreneur', '创业中'],
      ['career_status_preparing_business', '准备创业'],
      ['career_status_studying', '目前处于学习 / 进修阶段'],
      ['career_status_other', '其他'],
    ]),
    other: { optionId: 'career_status_other', label: '补充当前状态', required: true, maxLength: 200, inputType: 'text' },
  },
  {
    id: 'transition_urgency', section: 'current-status', type: 'single', required: true,
    question: '你希望多快开始进入新的职业方向？',
    options: options([
      ['transition_1_month', '1 个月内'], ['transition_3_months', '3 个月内'],
      ['transition_6_months', '6 个月内'], ['transition_1_year', '1 年内'],
      ['transition_over_year', '1 年以上'], ['transition_exploring', '暂时没有明确时间，只想先探索'],
    ]),
  },
  {
    id: 'minimum_income', section: 'income', type: 'single', required: true,
    question: '如果现在开始转向新的职业方向，你能接受的最低月收入大约是多少？',
    helperText: '只需选择维持现实生活所需的税前月收入区间。',
    options: options([
      ['minimum_income_unsure', '暂时没有明确最低要求'], ['minimum_income_below_3000', '3000 元以下'],
      ['minimum_income_3000_5000', '3000–5000 元'], ['minimum_income_5000_8000', '5000–8000 元'],
      ['minimum_income_8000_12000', '8000–12000 元'], ['minimum_income_12000_20000', '12000–20000 元'],
      ['minimum_income_20000_30000', '20000–30000 元'], ['minimum_income_above_30000', '30000 元以上'],
      ['minimum_income_custom', '自定义金额'],
    ]),
    other: {
      optionId: 'minimum_income_custom', label: '最低月收入（人民币）', placeholder: '例如：8500',
      required: true, maxLength: 10, inputType: 'currency',
    },
  },
  {
    id: 'salary_drop_tolerance', section: 'income', type: 'single', required: true,
    question: '为了进入更合适的新方向，你能接受短期收入下降吗？',
    options: options([
      ['salary_drop_none', '完全不能接受'], ['salary_drop_10', '最多下降约 10%'],
      ['salary_drop_20', '最多下降约 20%'], ['salary_drop_30', '最多下降约 30%'],
      ['salary_drop_more', '可以下降更多，只要长期机会更好'], ['salary_drop_not_applicable', '目前没有稳定收入，不适用'],
    ]),
  },
  {
    id: 'income_runway', section: 'income', type: 'single', required: true,
    question: '如果新方向前期收入较低，你最多可以承受多久？',
    condition: {
      questionId: 'salary_drop_tolerance', operator: 'oneOf',
      optionIds: ['salary_drop_10', 'salary_drop_20', 'salary_drop_30', 'salary_drop_more'],
    },
    options: options([
      ['runway_less_than_month', '少于 1 个月'], ['runway_1_3_months', '1–3 个月'],
      ['runway_3_6_months', '3–6 个月'], ['runway_6_12_months', '6–12 个月'],
      ['runway_over_year', '1 年以上'], ['runway_uncertain', '暂时不确定'],
    ]),
  },
  {
    id: 'responsibilities', section: 'responsibilities', type: 'multi', required: true,
    question: '以下哪些现实责任会影响你的职业选择？',
    exclusiveOptionIds: ['responsibility_none'],
    options: options([
      ['responsibility_family_expenses', '需要稳定承担家庭生活支出'],
      ['responsibility_mortgage', '有房贷 / 长期住房支出压力'],
      ['responsibility_parents', '需要赡养父母或长辈'], ['responsibility_children', '需要照顾孩子'],
      ['responsibility_other_family', '需要照顾其他家庭成员'],
      ['responsibility_primary_income', '家庭目前主要依赖我的收入'],
      ['responsibility_fixed_care', '必须在固定时间照护家人'],
      ['responsibility_fixed_expenses', '有其他长期固定支出'],
      ['responsibility_none', '暂时没有明显家庭责任'], ['responsibility_other', '其他'],
    ]),
    other: {
      optionId: 'responsibility_other', label: '还有哪些现实情况会限制你的职业选择？',
      required: false, maxLength: 200, inputType: 'text',
    },
  },
  {
    id: 'location_mobility', section: 'location', type: 'single', required: true,
    question: '为了新的职业机会，你可以接受多大的地点变化？',
    options: options([
      ['mobility_fixed', '必须留在当前城市'], ['mobility_nearby', '可以接受当前城市周边'],
      ['mobility_same_province', '可以接受同省其他城市'], ['mobility_nationwide', '可以接受全国范围迁移'],
      ['mobility_overseas', '可以考虑海外'], ['mobility_remote', '地点不重要，只要可以远程'],
      ['mobility_uncertain', '暂时不确定'],
    ]),
  },
  {
    id: 'location_constraints', section: 'location', type: 'multi', required: true,
    question: '哪些原因限制你换城市？',
    condition: {
      questionId: 'location_mobility', operator: 'oneOf',
      optionIds: ['mobility_fixed', 'mobility_nearby', 'mobility_same_province'],
    },
    options: options([
      ['location_constraint_family', '家庭责任'], ['location_constraint_property', '房产 / 房贷'],
      ['location_constraint_children', '子女教育'], ['location_constraint_parents', '父母 / 长辈'],
      ['location_constraint_partner', '伴侣工作'], ['location_constraint_cost', '生活成本'],
      ['location_constraint_network', '社交 / 支持网络'],
      ['location_constraint_clients', '当前城市已经积累客户或资源'],
      ['location_constraint_move_cost', '不希望承担搬迁成本'], ['location_constraint_other', '其他'],
    ]),
    other: { optionId: 'location_constraint_other', label: '补充迁移限制', required: false, maxLength: 200, inputType: 'text' },
  },
  {
    id: 'work_languages', section: 'location', type: 'multi', required: true,
    question: '你目前可以用于工作的语言有哪些？',
    condition: { questionId: 'location_mobility', operator: 'includes', optionIds: ['mobility_overseas'] },
    options: options([
      ['language_chinese', '中文'], ['language_english', '英语'], ['language_japanese', '日语'],
      ['language_korean', '韩语'], ['language_french', '法语'], ['language_german', '德语'],
      ['language_spanish', '西班牙语'], ['language_other', '其他'],
    ]),
    other: { optionId: 'language_other', label: '补充工作语言', required: true, maxLength: 200, inputType: 'text' },
  },
  {
    id: 'weekly_hours', section: 'transition-capacity', type: 'single', required: true,
    question: '除了现在的工作和生活，你每周大约可以投入多少时间学习或验证新方向？',
    options: options([
      ['weekly_hours_under_3', '少于 3 小时'], ['weekly_hours_3_5', '3–5 小时'],
      ['weekly_hours_5_10', '5–10 小时'], ['weekly_hours_10_20', '10–20 小时'],
      ['weekly_hours_over_20', '20 小时以上'], ['weekly_hours_full_time', '可以全职投入'],
    ]),
  },
  {
    id: 'preparation_horizon', section: 'transition-capacity', type: 'single', required: true,
    question: '为了进入新的职业方向，你最多愿意持续准备多久？',
    options: options([
      ['preparation_under_month', '1 个月以内'], ['preparation_1_3_months', '1–3 个月'],
      ['preparation_3_6_months', '3–6 个月'], ['preparation_6_12_months', '6–12 个月'],
      ['preparation_1_2_years', '1–2 年'], ['preparation_over_2_years', '2 年以上也可以'],
    ]),
  },
  {
    id: 'max_budget', section: 'transition-capacity', type: 'single', required: true,
    question: '为了完成职业转换，你目前最多能接受多少前期投入？',
    helperText: '包括培训、考证、软件、设备、搬迁与学习资源。',
    options: options([
      ['budget_none', '尽量不花钱'], ['budget_under_1000', '1000 元以内'],
      ['budget_1000_3000', '1000–3000 元'], ['budget_3000_10000', '3000–10000 元'],
      ['budget_10000_30000', '10000–30000 元'], ['budget_above_30000', '30000 元以上'],
      ['budget_not_limiting', '如果方向确定，投入金额不是主要限制'],
    ]),
  },
  {
    id: 'career_capital', section: 'career-capital', type: 'multi', required: true,
    question: '你目前已经积累了哪些可以带到下一份职业中的资源？',
    helperText: '可多选；只记录真实已有的经验、能力或成果。',
    exclusiveOptionIds: ['capital_none'],
    options: options([
      ['capital_industry_experience', '某一行业的长期工作经验', 'experience'],
      ['capital_project_experience', '项目经验', 'experience'], ['capital_management', '管理经验', 'experience'],
      ['capital_entrepreneurship', '创业经验', 'experience'], ['capital_freelance', '自由职业经验', 'experience'],
      ['capital_programming', '技术 / 编程', 'skills'], ['capital_product', '产品', 'skills'],
      ['capital_operations', '运营', 'skills'], ['capital_marketing', '市场', 'skills'],
      ['capital_sales', '销售', 'skills'], ['capital_business', '商务', 'skills'],
      ['capital_design', '设计', 'skills'], ['capital_photo_video', '摄影 / 视频', 'skills'],
      ['capital_content', '内容创作', 'skills'], ['capital_writing', '写作', 'skills'],
      ['capital_education', '教育 / 培训', 'skills'], ['capital_data', '数据分析', 'skills'],
      ['capital_research', '研究', 'skills'], ['capital_consulting', '咨询', 'skills'],
      ['capital_finance', '财务', 'skills'], ['capital_legal', '法律', 'skills'],
      ['capital_engineering', '工程', 'skills'], ['capital_manufacturing', '制造', 'skills'],
      ['capital_other_skill', '其他专业技能', 'other'],
      ['capital_portfolio', '有作品集', 'evidence'], ['capital_success_project', '有成功项目', 'evidence'],
      ['capital_certificate', '有证书 / 职业资格', 'evidence'], ['capital_clients', '有客户资源', 'evidence'],
      ['capital_network', '有行业人脉', 'evidence'], ['capital_personal_brand', '有个人品牌 / 粉丝', 'evidence'],
      ['capital_channels', '有稳定合作渠道', 'evidence'], ['capital_data_results', '有可展示的数据成果', 'evidence'],
      ['capital_none', '目前几乎没有明显可迁移职业资本', 'other'], ['capital_other', '其他', 'other'],
    ]),
    other: { optionId: 'capital_other', label: '补充其他职业资本', required: false, maxLength: 200, inputType: 'text' },
  },
  {
    id: 'restart_tolerance', section: 'career-capital', type: 'single', required: true,
    question: '如果新方向更适合你，你能接受从比现在更初级的位置重新开始吗？',
    options: options([
      ['restart_none', '完全不能接受'], ['restart_one_level', '最多降低一级'],
      ['restart_lower_level', '可以接受明显降低职级'], ['restart_entry_level', '可以从初级岗位开始'],
      ['restart_no_rank', '如果是自由职业 / 创业，不在意职级'], ['restart_uncertain', '暂时不确定'],
    ]),
  },
  {
    id: 'education_tolerance', section: 'career-capital', type: 'single', required: true,
    question: '如果进入新方向需要重新学习、考证或补充学历，你的接受程度是？',
    options: options([
      ['education_none', '不接受长期学习或考证'],
      ['education_short', '可以接受短期学习，但不考虑学历提升'],
      ['education_certificate', '可以接受考证'], ['education_systematic_training', '可以接受系统培训'],
      ['education_6_12_months', '可以接受 6–12 个月重新学习'],
      ['education_degree', '可以接受继续学历教育'], ['education_long_term', '只要方向足够值得，可以长期准备'],
    ]),
  },
  {
    id: 'work_constraints', section: 'work-boundaries', type: 'multi', required: true,
    question: '以下哪些工作状态是你明确不能长期接受的？',
    exclusiveOptionIds: ['work_constraint_none'],
    options: options([
      ['work_constraint_overtime', '长期加班'], ['work_constraint_night_shift', '经常夜班'],
      ['work_constraint_weekends', '经常周末工作'], ['work_constraint_travel', '长期高强度出差'],
      ['work_constraint_entertaining', '高频应酬'], ['work_constraint_sales_target', '强销售指标'],
      ['work_constraint_strangers', '高频陌生人沟通'], ['work_constraint_phone', '大量电话沟通'],
      ['work_constraint_standing', '长时间站立'], ['work_constraint_physical', '重体力工作'],
      ['work_constraint_outdoor', '长期户外工作'], ['work_constraint_noise', '高噪音 / 恶劣环境'],
      ['work_constraint_repetitive', '高度重复工作'], ['work_constraint_no_autonomy', '极少自主空间'],
      ['work_constraint_fixed_office', '严格固定坐班'], ['work_constraint_commute', '超长通勤'],
      ['work_constraint_variable_income', '高度波动收入'], ['work_constraint_no_base', '长期没有稳定底薪'],
      ['work_constraint_politics', '强办公室政治'], ['work_constraint_public_speaking', '高频公开表达'],
      ['work_constraint_isolated', '长时间独立工作'], ['work_constraint_teamwork', '高频团队协作'],
      ['work_constraint_computer', '长时间电脑工作'], ['work_constraint_timezones', '经常跨时区工作'],
      ['work_constraint_none', '暂时没有明确禁区'], ['work_constraint_other', '其他'],
    ]),
    other: { optionId: 'work_constraint_other', label: '补充其他工作禁区', required: false, maxLength: 200, inputType: 'text' },
  },
  {
    id: 'income_models', section: 'work-boundaries', type: 'multi', required: true, maxSelections: 4,
    question: '对你来说，哪种收入结构现实上可以接受？',
    exclusiveOptionIds: ['income_model_any', 'income_model_uncertain'],
    options: options([
      ['income_model_salary', '固定工资为主'], ['income_model_bonus', '固定工资 + 奖金'],
      ['income_model_commission', '底薪 + 提成'], ['income_model_project', '项目制收入'],
      ['income_model_freelance', '自由职业'], ['income_model_performance', '完全绩效收入'],
      ['income_model_business', '创业收入'], ['income_model_multiple', '多种收入来源组合'],
      ['income_model_any', '都可以'], ['income_model_uncertain', '暂时不确定'],
    ]),
  },
  {
    id: 'employment_types', section: 'work-boundaries', type: 'multi', required: true, maxSelections: 5,
    question: '以下哪些就业形式你可以接受？',
    exclusiveOptionIds: ['employment_type_any'],
    options: options([
      ['employment_type_full_time', '全职员工'], ['employment_type_contract', '合同制'],
      ['employment_type_part_time', '兼职'], ['employment_type_freelance', '自由职业'],
      ['employment_type_self_employed', '个体经营'], ['employment_type_business', '创业'],
      ['employment_type_remote', '远程工作'], ['employment_type_hybrid', '混合办公'],
      ['employment_type_project', '项目合作'], ['employment_type_any', '都可以'],
    ]),
  },
  {
    id: 'career_values', section: 'values', type: 'multi', required: true, maxSelections: 3,
    question: '现阶段，对你来说最重要的是什么？',
    helperText: '最多选择 3 项；它们只用于对可行方向排序。',
    options: options([
      ['value_income', '更高收入'], ['value_income_stability', '收入稳定'], ['value_job_security', '工作安全感'],
      ['value_growth', '长期成长'], ['value_advancement', '更大的职业上升空间'],
      ['value_time_freedom', '时间自由'], ['value_location_freedom', '地点自由'],
      ['value_balance', '工作生活平衡'], ['value_creativity', '创造性'],
      ['value_strengths', '做自己擅长的事'], ['value_meaning', '解决有意义的问题'],
      ['value_helping', '帮助他人'], ['value_expertise', '专业成就感'], ['value_impact', '影响力'],
      ['value_autonomy', '自主决策'], ['value_personal_assets', '可以积累个人资产'],
      ['value_independence', '未来可以独立发展'], ['value_brand', '可以建立个人品牌'],
      ['value_comfort', '工作环境舒适'], ['value_people', '与喜欢的人共事'], ['value_other', '其他'],
    ]),
    other: { optionId: 'value_other', label: '补充其他优先级', required: true, maxLength: 200, inputType: 'text' },
  },
];

const matchesCondition = (condition: CareerCondition, answers: CareerDraftAnswers): boolean => {
  const selected = answers[condition.questionId]?.optionIds ?? [];
  if (condition.operator === 'includes') {
    return condition.optionIds.every((id) => selected.includes(id));
  }
  return condition.optionIds.some((id) => selected.includes(id));
};

export function getVisibleCareerQuestions(answers: CareerDraftAnswers): CareerQuestion[] {
  return CAREER_QUESTIONS.filter((question) => !question.condition || matchesCondition(question.condition, answers));
}

export function pruneHiddenCareerAnswers(answers: CareerDraftAnswers): CareerDraftAnswers {
  const visibleIds = new Set(getVisibleCareerQuestions(answers).map((question) => question.id));
  return Object.fromEntries(Object.entries(answers).filter(([questionId]) => visibleIds.has(questionId)));
}

export function getCareerQuestion(questionId: string): CareerQuestion | undefined {
  return CAREER_QUESTIONS.find((question) => question.id === questionId);
}
