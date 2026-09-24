import { describe, expect, it, vi } from 'vitest';
import { buildMarketResearch, collectMarketEvidence, marketSource, resolveMarketSource } from './market';
import { createMarketResearchPrompt, describeDirectionAnswers } from '../prompts/market-research';

const source = { title: '杭州市产业报告', url: 'https://www.hangzhou.gov.cn/art/2026/1/1/art_123.html', site: 'www.hangzhou.gov.cn', excerpt: '“杭州”的数字经济产业情况，资料发布于2026年，统计期为2025年。' };
const research = { direction: 'city' as const, checkedAt: '2026-09-25T08:00:00.000Z', evidence: [{ id: 'market_1', source }] };
const advice = { name: '杭州', evidenceIds: ['market_1'], priority: 1, fitReason: '可进一步验证线上业务机会。', boundary: '需核对生活预算。', nextStep: '比较三个实际岗位。' };

describe('market evidence boundary', () => {
  it('retains only source-linked names and server-owned URLs, deduplicating city examples', () => {
    const result = buildMarketResearch(research, [advice, advice, { ...advice, name: '不存在的城市' }, { ...advice, name: '北京', evidenceIds: ['fabricated'] }]);
    expect(result.examples).toHaveLength(1);
    expect(result.examples[0].sources[0].url).toBe(source.url);
    expect(result.examples[0].priority).toBe(1);
  });

  it('accepts official articles but rejects lookalike, credential-bearing, and root URLs', () => {
    expect(marketSource(source.url)).not.toBeNull();
    for (const url of ['https://gov.cn.evil.test/a', 'https://user@www.gov.cn/a', 'http://www.gov.cn/a', 'https://www.gov.cn/', 'https://127.0.0.1/a']) expect(marketSource(url)).toBeNull();
  });

  it('does not fetch arbitrary URLs while resolving citations', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      expect(await resolveMarketSource('https://127.0.0.1/private')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it('requires executed search, a matching grounded segment, and a permitted source', async () => {
    const result = { text: source.excerpt, candidates: [{ groundingMetadata: { webSearchQueries: ['杭州产业'], groundingChunks: [{ web: { uri: source.url, title: source.title } }], groundingSupports: [{ segment: { text: source.excerpt }, groundingChunkIndices: [0] }] } }] };
    expect((await collectMarketEvidence(result, 'city', research.checkedAt)).evidence).toHaveLength(1);
    expect((await collectMarketEvidence({ ...result, text: '另一个回答' }, 'city', research.checkedAt)).evidence).toEqual([]);
    expect((await collectMarketEvidence({ text: source.excerpt }, 'city', research.checkedAt)).evidence).toEqual([]);
  });

  it('shows unavailable rather than fabricated examples when research fails', () => {
    const result = buildMarketResearch({ ...research, evidence: [], failure: 'timeout' }, [advice]);
    expect(result.status).toBe('unavailable');
    expect(result.examples).toEqual([]);
  });

  it('does not suggest relocation when the user only considers their current city', () => {
    const result = buildMarketResearch(research, [advice], {
      city_q1: { optionIds: ['city_q1_shanghai'] }, city_q2: { optionIds: ['city_q2_current'] },
    });
    expect(result.examples).toEqual([]);
  });
});

describe('research input minimization', () => {
  it('decodes negative collaboration answers with their questions for analysis', () => {
    const result = describeDirectionAnswers('collaboration', { collaboration_q4: { optionIds: ['collaboration_q4_micromanagement'] } });
    expect(result.find((item) => item.answers.includes('微观管理，什么都要管'))?.question).toBe('哪些合作方式最让你难以长期接受？');
  });

  it('searches declared city candidates but excludes unrelated free text and unknown option IDs', () => {
    const prompt = createMarketResearchPrompt('city', {
      city_q2: { optionIds: ['city_q2_domestic', 'unknown_secret'], supplementaryValue: ['成都', '苏州'], textValue: '私人经历请勿发送' },
      private: { textValue: '出生时间与身份证' },
    }, '2026-09-25');
    expect(prompt).toContain('成都');
    expect(prompt).toContain('可以考虑国内其他城市');
    expect(prompt).not.toContain('私人经历请勿发送');
    expect(prompt).not.toContain('出生时间与身份证');
    expect(prompt).not.toContain('unknown_secret');
  });
});
