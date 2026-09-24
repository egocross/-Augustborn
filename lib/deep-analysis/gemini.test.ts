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
