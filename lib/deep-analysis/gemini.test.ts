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

import { generateCustomQuestions, parseDynamicQuestions } from './gemini';

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
