import { z } from 'zod';

import { CareerCalibrationSchema, type CareerCalibration } from './career-calibration';
import { CAREER_QUESTIONNAIRE_VERSION } from './career-calibration-questions';
import { CareerEvidenceSourceSchema } from './types';
import { ReportSchema, type Report } from '@/lib/gemini/schema';

export const CareerMarketEvidenceSchema = z.object({
  status: z.enum(['verified', 'partial', 'unavailable', 'sample']),
  retrievedAt: z.string().datetime().nullable(),
  sources: z.array(CareerEvidenceSourceSchema.extend({
    evidenceId: z.string().min(1).max(80),
  })).max(20),
  note: z.string().min(1).max(600),
});
export type CareerMarketEvidence = z.infer<typeof CareerMarketEvidenceSchema>;

export const CareerAnalysisInputSchema = z.object({
  baseTendencies: z.object({
    sections: ReportSchema.shape.sections,
    interpretationBoundary: z.literal('待校准的探索假设，不是科学测评事实'),
  }),
  hardConstraints: CareerCalibrationSchema.shape.hardConstraints,
  careerCapital: CareerCalibrationSchema.shape.careerCapital,
  marketEvidence: CareerMarketEvidenceSchema,
  valuePreferences: CareerCalibrationSchema.shape.values,
});
export type CareerAnalysisInput = z.infer<typeof CareerAnalysisInputSchema>;

export const CareerGenerationRequestSchema = z.object({
  baseReport: ReportSchema,
  careerCalibration: CareerCalibrationSchema,
  questionnaireVersion: z.literal(CAREER_QUESTIONNAIRE_VERSION),
});
export type CareerGenerationRequest = z.infer<typeof CareerGenerationRequestSchema>;

const EMPTY_MARKET_EVIDENCE: CareerMarketEvidence = {
  status: 'unavailable',
  retrievedAt: null,
  sources: [],
  note: '尚未核对招聘市场证据；不得据此编造岗位数量、薪资或趋势。',
};

export function createCareerAnalysisInput(
  baseReport: Report,
  calibration: CareerCalibration,
  marketEvidence: CareerMarketEvidence = EMPTY_MARKET_EVIDENCE,
): CareerAnalysisInput {
  const verifiedReport = ReportSchema.parse(baseReport);
  const verifiedCalibration = CareerCalibrationSchema.parse(calibration);
  return CareerAnalysisInputSchema.parse({
    baseTendencies: {
      sections: verifiedReport.sections,
      interpretationBoundary: '待校准的探索假设，不是科学测评事实',
    },
    hardConstraints: verifiedCalibration.hardConstraints,
    careerCapital: verifiedCalibration.careerCapital,
    marketEvidence,
    valuePreferences: verifiedCalibration.values,
  });
}

const SAFE_CAPITAL_KEYWORDS: Readonly<Record<string, string>> = {
  capital_programming: '软件开发', capital_product: '产品管理', capital_operations: '产品运营',
  capital_marketing: '市场营销', capital_sales: '销售', capital_business: '商务拓展',
  capital_design: '视觉设计', capital_photo_video: '摄影视频', capital_content: '内容创作',
  capital_writing: '文案策划', capital_education: '教育培训', capital_data: '数据分析',
  capital_research: '用户研究', capital_consulting: '咨询顾问', capital_finance: '财务',
  capital_legal: '法务', capital_engineering: '工程技术', capital_manufacturing: '制造工程',
};

export const CareerResearchContextSchema = z.object({
  keywords: z.array(z.string().min(2).max(40)).min(1).max(8),
  regionScope: z.enum(['local', 'nearby', 'province', 'nationwide', 'overseas', 'remote', 'uncertain']),
  incomeBand: z.string().regex(/^minimum_income_[a-z0-9_]+$/),
  employmentTypes: z.array(z.string().regex(/^employment_type_[a-z0-9_]+$/)).max(10),
});
export type CareerResearchContext = z.infer<typeof CareerResearchContextSchema>;

const mobilityMap: Readonly<Record<string, CareerResearchContext['regionScope']>> = {
  mobility_fixed: 'local', mobility_nearby: 'nearby', mobility_same_province: 'province',
  mobility_nationwide: 'nationwide', mobility_overseas: 'overseas', mobility_remote: 'remote',
  mobility_uncertain: 'uncertain',
};

export function createCareerResearchContext(input: CareerAnalysisInput): CareerResearchContext {
  const capitalIds = [
    ...input.careerCapital.skills,
    ...input.careerCapital.experience,
    ...input.careerCapital.evidence,
  ];
  const keywords = [...new Set(capitalIds.map((id) => SAFE_CAPITAL_KEYWORDS[id]).filter(Boolean))];
  return CareerResearchContextSchema.parse({
    keywords: keywords.length ? keywords.slice(0, 8) : ['职业转型'],
    regionScope: mobilityMap[input.hardConstraints.location.mobility] ?? 'uncertain',
    incomeBand: input.hardConstraints.income.minimumIncomeBand,
    employmentTypes: input.hardConstraints.employmentTypes,
  });
}

export { CAREER_QUESTIONNAIRE_VERSION };
