// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJobResearchPrompt } from '../prompts/job-research';
import { buildJobResearch, collectJobEvidence, recruitmentSource, resolveRecruitmentSource } from './jobs';

const checkedAt = '2026-09-24T08:00:00.000Z';
const url = 'https://www.liepin.com/job/123456789.shtml';
const excerpt = '“产品运营”：示例公司在上海招聘，负责产品活动与数据分析，要求有运营经验。';
const grounded = () => ({
  text: excerpt,
  candidates: [{ groundingMetadata: {
    webSearchQueries: ['产品运营 猎聘'],
    groundingChunks: [{ web: { uri: url, title: '产品运营招聘' } }],
    groundingSupports: [{ segment: { text: excerpt }, groundingChunkIndices: [0] }],
  } }],
});
const advice = { evidenceId: 'job_source_1', title: '产品运营', searchKeywords: ['产品运营', '虚构的新职位'], fitReason: '你选择了内容创作，值得验证。', entryGap: '运营经验尚需核对。', nextStep: '对照来源整理一份作品。' };

afterEach(() => vi.unstubAllGlobals());

describe('recruitment evidence boundary', () => {
  it('only accepts job details on known recruitment domains', () => {
    expect(recruitmentSource(url)?.site).toBe('猎聘');
    for (const invalid of ['https://www.liepin.com/', 'https://www.liepin.com/zhaopin/', 'https://www.liepin.com.evil.test/job/1', 'http://www.liepin.com/job/1', 'https://user:pass@www.liepin.com/job/1', 'https://www.liepin.com:8443/job/1', 'javascript:alert(1)']) {
      expect(recruitmentSource(invalid)).toBeNull();
    }
  });

  it('resolves only official grounding redirects and never follows an unsafe target', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await resolveRecruitmentSource('https://vertexaisearch.cloud.google.com/grounding-api-redirect/test')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
    fetcher.mockResolvedValue(new Response(null, { status: 302, headers: { location: url } }));
    expect((await resolveRecruitmentSource('https://vertexaisearch.cloud.google.com/grounding-api-redirect/test'))?.url).toBe(url);
    expect(await resolveRecruitmentSource('https://arbitrary.example/redirect')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('requires an executed search and matching grounded text, not just model-written links', async () => {
    expect((await collectJobEvidence(grounded(), checkedAt)).evidence).toHaveLength(1);
    const noSearch = grounded();
    noSearch.candidates[0].groundingMetadata.webSearchQueries = [];
    expect((await collectJobEvidence(noSearch, checkedAt)).evidence).toHaveLength(0);
    const fabricated = grounded();
    fabricated.candidates[0].groundingMetadata.groundingSupports[0].segment.text = 'not part of the response';
    expect((await collectJobEvidence(fabricated, checkedAt)).evidence).toHaveLength(0);
    const expired = grounded();
    expired.text = '产品运营岗位已下架';
    expired.candidates[0].groundingMetadata.groundingSupports[0].segment.text = expired.text;
    expect((await collectJobEvidence(expired, checkedAt)).evidence).toHaveLength(0);
  });

  it('rejects invented names and citations, deduplicates jobs, and cannot fabricate URLs or dates', async () => {
    const research = await collectJobEvidence(grounded(), checkedAt);
    const result = buildJobResearch(research, [advice, advice, { ...advice, title: '人生规划架构师' }, { ...advice, title: '运营' }, { ...advice, evidenceId: 'fake' }]);
    expect(result.status).toBe('limited');
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].source.url).toBe(url);
    expect(result.recommendations[0].searchKeywords).toEqual(['产品运营']);
    expect(result.checkedAt).toBe(checkedAt);
    expect(buildJobResearch({ checkedAt, evidence: [], failure: 'timeout' }, [advice]).status).toBe('unavailable');
  });

  it('only sends fixed preference labels to web research', () => {
    const prompt = createJobResearchPrompt({ work_q1: { optionIds: ['work_q1_student'], textValue: 'private birth details', supplementaryValue: ['private phone'] } }, '2026-09-24');
    expect(prompt).toContain('学生');
    expect(prompt).not.toContain('private');
  });
});
