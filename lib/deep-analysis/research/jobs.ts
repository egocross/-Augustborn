import 'server-only';

import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from '@google/genai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '@/lib/gemini/config';
import { createJobResearchPrompt } from '../prompts/job-research';
import type { DeepAnswers } from '../types';
import { JobAdviceSchema, JobResearchSchema, type WorkResearch } from './schema';

const recruitmentSites = [
  { domain: 'zhipin.com', name: 'BOSS直聘', path: /^\/job_detail\/[A-Za-z0-9_-]+\.html$/ },
  { domain: 'liepin.com', name: '猎聘', path: /^\/(?:job|a|b)\/\d+\.shtml$/ },
  { domain: 'zhaopin.com', name: '智联招聘', path: /^\/(?:jobdetail\/)?[A-Za-z0-9_-]*\d[A-Za-z0-9_-]*\.htm[l]?\/?$/ },
  { domain: '51job.com', name: '前程无忧', path: /^\/[^/]+\/\d+\.html$/ },
  { domain: 'lagou.com', name: '拉勾', path: /^\/(?:wn\/)?jobs\/\d+\.html$/ },
];

export function recruitmentSource(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    const site = recruitmentSites.find(({ domain, path }) =>
      (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) && path.test(url.pathname));
    return site ? { url: url.href, site: site.name } : null;
  } catch { return null; }
}

/** Only Google citation redirects can be fetched; arbitrary model URLs never are. */
export async function resolveRecruitmentSource(value: string, signal?: AbortSignal) {
  let current = value;
  for (let hop = 0; hop < 3; hop += 1) {
    const direct = recruitmentSource(current);
    if (direct) return direct;
    let url: URL;
    try { url = new URL(current); } catch { return null; }
    if (url.protocol !== 'https:' || url.hostname !== 'vertexaisearch.cloud.google.com'
      || !url.pathname.startsWith('/grounding-api-redirect/') || url.username || url.password || url.port) return null;
    const timeout = AbortSignal.timeout(6000);
    const response = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) return null;
    current = new URL(location, url).href;
  }
  return null;
}

export async function collectJobEvidence(
  result: Pick<GenerateContentResponse, 'text' | 'candidates'>,
  checkedAt: string,
  signal?: AbortSignal,
): Promise<WorkResearch> {
  const metadata = result.candidates?.[0]?.groundingMetadata;
  const text = result.text ?? '';
  const research: WorkResearch = { checkedAt, evidence: [] };
  const suggestions = metadata?.searchEntryPoint?.renderedContent;
  if (suggestions && suggestions.length <= 50_000) research.searchSuggestionsHtml = suggestions;
  // No citations, or no executed search: do not present model knowledge as research.
  if (!metadata?.webSearchQueries?.length || !metadata.groundingSupports?.length) return { ...research, failure: 'no_sources' };
  const chunks = metadata.groundingChunks ?? [];
  const resolved = new Map<number, Awaited<ReturnType<typeof resolveRecruitmentSource>>>();
  const indices = [...new Set(metadata.groundingSupports.flatMap((support) => support.groundingChunkIndices ?? []))]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < chunks.length).slice(0, 16);
  await Promise.all(indices.map(async (index) => {
    const uri = chunks[index]?.web?.uri;
    if (!uri) return;
    try { resolved.set(index, await resolveRecruitmentSource(uri, signal)); } catch { /* Unresolvable citations are excluded. */ }
  }));
  for (const support of metadata.groundingSupports) {
    const excerpt = support.segment?.text?.trim();
    if (!excerpt || excerpt.length > 1800 || !text.includes(excerpt)
      || /已(?:下架|过期|结束|关闭)|停止招聘|招聘已结束|不再招聘|no longer available|position (?:is )?closed/i.test(excerpt)) continue;
    for (const index of support.groundingChunkIndices ?? []) {
      const source = resolved.get(index);
      if (!source || research.evidence.some((item) => item.source.url === source.url && item.source.excerpt === excerpt)) continue;
      research.evidence.push({
        id: `job_source_${research.evidence.length + 1}`,
        source: { ...source, title: (chunks[index]?.web?.title || source.site).slice(0, 300), excerpt },
      });
      if (research.evidence.length >= 20) break;
    }
    if (research.evidence.length >= 20) break;
  }
  if (!research.evidence.length) research.failure = 'no_sources';
  return research;
}

export async function researchWorkJobs(answers: DeepAnswers, options: { signal?: AbortSignal } = {}): Promise<WorkResearch> {
  const checkedAt = new Date().toISOString();
  const timeout = AbortSignal.timeout(55_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL ?? 'gemini-3.1-pro-preview',
      contents: createJobResearchPrompt(answers, checkedAt.slice(0, 10)),
      config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, maxOutputTokens: 6000, abortSignal: signal },
    });
    return await collectJobEvidence(result, checkedAt, signal);
  } catch {
    // A cancelled report must stop; a search outage can degrade without losing the report.
    options.signal?.throwIfAborted();
    return { checkedAt, evidence: [], failure: timeout.aborted ? 'timeout' : 'unavailable' };
  }
}

const normalize = (value: string) => value.normalize('NFKC').replace(/[\s*`]/g, '').toLowerCase();
const citedTitles = (excerpt: string) => [...excerpt.matchAll(/“([^”\n]{2,80})”/g)].map((match) => normalize(match[1]));

/** URLs and dates come from server research, never from the report model. */
export function buildJobResearch(research: WorkResearch, modelAdvice: unknown) {
  const recommendations = [] as ReturnType<typeof JobResearchSchema.parse>['recommendations'];
  for (const value of Array.isArray(modelAdvice) ? modelAdvice.slice(0, 10) : []) {
    const parsed = JobAdviceSchema.safeParse(value);
    if (!parsed.success) continue;
    const { evidenceId, ...advice } = parsed.data;
    const evidence = research.evidence.find((item) => item.id === evidenceId);
    if (!evidence || !recruitmentSource(evidence.source.url)
      || !citedTitles(evidence.source.excerpt).includes(normalize(advice.title))
      || recommendations.some((item) => normalize(item.title) === normalize(advice.title))) continue;
    // Only search terms present in cited evidence survive validation. Always include the title.
    advice.searchKeywords = [...new Set([advice.title, ...advice.searchKeywords.filter((keyword) =>
      normalize(evidence.source.excerpt).includes(normalize(keyword)))])].slice(0, 4);
    recommendations.push({ ...advice, source: evidence.source });
    if (recommendations.length === 5) break;
  }
  const status = recommendations.length >= 3 ? 'matched' : recommendations.length ? 'limited' : 'unavailable';
  const note = status === 'matched'
    ? '以下职位名称有招聘来源支持。招聘实例用于核对职责与门槛，是否仍可投递请以招聘页面为准。'
    : status === 'limited'
      ? `本次仅找到 ${recommendations.length} 个有来源支持且可匹配的职位，未补齐数量。是否仍可投递请以招聘页面为准。`
      : research.failure === 'timeout' || research.failure === 'unavailable'
        ? '本次招聘信息检索暂时不可用，报告保留工作方向建议；没有展示未经来源核实的职位名单。'
        : '本次未找到足够可靠且可匹配的招聘来源，因此没有列出具体职位。可以根据下方建议进一步明确方向。';
  return JobResearchSchema.parse({ status, checkedAt: research.checkedAt, note, recommendations,
    ...(research.searchSuggestionsHtml ? { searchSuggestionsHtml: research.searchSuggestionsHtml } : {}) });
}
