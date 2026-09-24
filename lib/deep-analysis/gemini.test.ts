import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent, generateContentStream, GoogleGenAI } = vi.hoisted(() => {
  const generateContent = vi.fn();
  const generateContentStream = vi.fn();
  const GoogleGenAI = vi.fn(function GoogleGenAI() {
    return { models: { generateContent, generateContentStream } };
  });
  return { generateContent, generateContentStream, GoogleGenAI };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI,
  ThinkingLevel: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));

import { generateCustomQuestions, generateDeepReportStream, parseDynamicQuestions } from './gemini';
import { createSampleDeepReport } from '../report-provider/sample';
import type { DeepPromptInput } from './prompts';
import { DeepReportSchema } from './types';

const question = (id: string) => ({
  id,
  type: 'single',
  text: '你更看重什么？',
  required: true,
  options: [{ id: `${id}_a`, label: '稳定' }, { id: `${id}_b`, label: '成长' }],
});

beforeEach(() => {
  generateContent.mockReset();
  generateContentStream.mockReset();
  GoogleGenAI.mockClear();
});

describe('deep Gemini adapter', () => {
  it.each(['industry', 'city', 'collaboration'] as const)('generates %s fields with server-owned research and no unnecessary searches', async (directionId) => {
    const name = directionId === 'city' ? '杭州' : '企业软件服务';
    const excerpt = `“${name}”的产业资料；统计期2025年，发布日期2026年。`;
    generateContent.mockResolvedValue({ text: excerpt, candidates: [{ groundingMetadata: {
      webSearchQueries: [name], groundingChunks: [{ web: { uri: 'https://www.gov.cn/zhengce/article123.htm', title: '官方资料' } }],
      groundingSupports: [{ segment: { text: excerpt }, groundingChunkIndices: [0] }],
    } }] });
    const modelReport = { ...createSampleDeepReport({ directionId, optionalContext: '' }), marketExamples: [
      { name, evidenceIds: ['market_1'], priority: 2, fitReason: '结合偏好提出验证假设。', boundary: '先核对门槛。', nextStep: '开展一次访谈。' },
    ] };
    generateContentStream.mockImplementation(async function* () { yield { text: JSON.stringify(modelReport) }; });
    const stages: string[] = [];
    const input: DeepPromptInput = { birthProfile: {}, freeReportSummary: { sections: [] }, directionId, questionnaireVersion: 'v1', answers: {}, optionalContext: '', customQuestion: null, cityContext: null };
    const stream = generateDeepReportStream(input, { onStage: (stage) => stages.push(stage) });
    await stream.next();
    const result = await stream.next();
    expect(result.done).toBe(true);
    if (!result.done) throw new Error('Report did not complete');
    const parsed = DeepReportSchema.parse(result.value);
    if (directionId === 'collaboration') {
      expect(parsed.collaborationPlan?.scenarios.length).toBeGreaterThanOrEqual(2);
      expect(parsed.marketResearch).toBeUndefined();
      expect(generateContent).not.toHaveBeenCalled();
    } else {
      expect(parsed.marketResearch?.examples[0].sources[0].url).toBe('https://www.gov.cn/zhengce/article123.htm');
      expect(parsed.marketResearch?.status).toBe('sourced');
      expect(stages[0]).toBe(directionId === 'city' ? 'researching_cities' : 'researching_industries');
      if (directionId === 'city') expect(parsed.cityPlan?.tiers.map((tier) => tier.priority)).toEqual([1, 2, 3]);
      else expect(parsed.industryDirections?.groups.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('preserves a city framework with empty examples when the external search fails', async () => {
    generateContent.mockRejectedValue(new Error('unavailable'));
    const modelReport = { ...createSampleDeepReport({ directionId: 'city', optionalContext: '' }), marketExamples: [] };
    generateContentStream.mockImplementation(async function* () { yield { text: JSON.stringify(modelReport) }; });
    const stream = generateDeepReportStream({ birthProfile: {}, freeReportSummary: { sections: [] }, directionId: 'city', questionnaireVersion: 'v1', answers: {}, optionalContext: '', customQuestion: null, cityContext: null });
    await stream.next();
    const result = await stream.next();
    if (!result.done) throw new Error('Report did not complete');
    expect(result.value?.cityPlan?.tiers).toHaveLength(3);
    expect(result.value?.marketResearch?.status).toBe('unavailable');
    expect(result.value?.marketResearch?.examples).toEqual([]);
  });

  it('returns exploration labels separately from verified jobs after consuming model JSON', async () => {
    generateContent.mockResolvedValue({ text: '', candidates: [] });
    const modelReport = { ...createSampleDeepReport({ directionId: 'work', optionalContext: '' }), jobRecommendations: [] };
    generateContentStream.mockImplementation(async function* () { yield { text: JSON.stringify(modelReport) }; });
    const input: DeepPromptInput = { birthProfile: {}, freeReportSummary: { sections: [] }, directionId: 'work', questionnaireVersion: 'v1', answers: {}, optionalContext: '', customQuestion: null, cityContext: null };
    const stream = generateDeepReportStream(input);
    await stream.next();
    const result = await stream.next();
    expect(result.done).toBe(true);
    if (!result.done) throw new Error('Report did not complete');
    expect(result.value?.workDirections?.groups.flatMap((group) => group.tags)).toContain('内容策划');
    expect(result.value?.jobResearch?.status).toBe('unavailable');
    expect(result.value?.jobResearch?.recommendations).toEqual([]);
  });

  it('requires grouped directions for new work reports even when recruitment search is unavailable', async () => {
    generateContent.mockResolvedValue({ text: '', candidates: [] });
    const modelReport = { ...createSampleDeepReport({ directionId: 'city', optionalContext: '' }), jobRecommendations: [] };
    generateContentStream.mockImplementation(async function* () { yield { text: JSON.stringify(modelReport) }; });
    const input: DeepPromptInput = { birthProfile: {}, freeReportSummary: { sections: [] }, directionId: 'work', questionnaireVersion: 'v1', answers: {}, optionalContext: '', customQuestion: null, cityContext: null };
    const stream = generateDeepReportStream(input);
    await stream.next();
    await expect(stream.next()).rejects.toMatchObject({ code: 'parse_failed' });
  });

  it('accepts zero or three-to-five dynamic questions and rejects every other count', () => {
    expect(parseDynamicQuestions([])).toEqual([]);
    expect(() => parseDynamicQuestions([question('custom_q1')])).toThrow();
    expect(parseDynamicQuestions([question('custom_q1'), question('custom_q2'), question('custom_q3')])).toHaveLength(3);
  });

  it('generates structured custom questions with official model settings', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ questions: [] }) });
    await expect(generateCustomQuestions({ customQuestion: '我要不要转岗？', freeReportSummary: { sections: [] } })).resolves.toEqual([]);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.1-pro-preview',
      config: expect.objectContaining({ responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'HIGH' } }),
    }));
  });
});
