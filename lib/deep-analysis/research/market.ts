import 'server-only';
import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from '@google/genai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '@/lib/gemini/config';
import { createMarketResearchPrompt } from '../prompts/market-research';
import type { DeepAnswers } from '../types';
import { getFixedQuestions } from '../questions';
import { MarketAdviceSchema, MarketResearchSchema, type MarketDirection, type MarketEvidence } from './market-schema';

export function marketSource(value: string) {
  try {
    const url = new URL(value);
    const allowed = ['gov.cn', 'caict.ac.cn', 'cnnic.cn'].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    if (!allowed || url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
      || url.pathname === '/' || /\/(?:search|so|s)(?:\/|\.|$)/i.test(url.pathname)) return null;
    return { url: url.href, site: url.hostname };
  } catch { return null; }
}

export async function resolveMarketSource(value: string, signal?: AbortSignal) {
  let current = value;
  for (let hop = 0; hop < 3; hop += 1) {
    const direct = marketSource(current);
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

export async function collectMarketEvidence(result: Pick<GenerateContentResponse, 'text' | 'candidates'>, direction: MarketDirection, checkedAt: string, signal?: AbortSignal): Promise<MarketEvidence> {
  const research: MarketEvidence = { direction, checkedAt, evidence: [] };
  const metadata = result.candidates?.[0]?.groundingMetadata;
  const suggestions = metadata?.searchEntryPoint?.renderedContent;
  if (suggestions && suggestions.length <= 50_000) research.searchSuggestionsHtml = suggestions;
  if (!metadata?.webSearchQueries?.length || !metadata.groundingSupports?.length) return { ...research, failure: 'no_sources' };
  const chunks = metadata.groundingChunks ?? [];
  const resolved = new Map<number, Awaited<ReturnType<typeof resolveMarketSource>>>();
  const indices = [...new Set(metadata.groundingSupports.flatMap((support) => support.groundingChunkIndices ?? []))]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < chunks.length).slice(0, 20);
  await Promise.all(indices.map(async (index) => {
    const uri = chunks[index]?.web?.uri;
    if (!uri) return;
    try { resolved.set(index, await resolveMarketSource(uri, signal)); } catch { /* Exclude unresolved citations. */ }
  }));
  for (const support of metadata.groundingSupports) {
    const excerpt = support.segment?.text?.trim();
    if (!excerpt || excerpt.length > 2200 || !result.text?.includes(excerpt)) continue;
    for (const index of support.groundingChunkIndices ?? []) {
      const source = resolved.get(index);
      if (!source || research.evidence.some((entry) => entry.source.url === source.url && entry.source.excerpt === excerpt)) continue;
      research.evidence.push({ id: `market_${research.evidence.length + 1}`, source: { ...source, title: (chunks[index]?.web?.title || source.site).slice(0, 300), excerpt } });
      if (research.evidence.length >= 24) break;
    }
    if (research.evidence.length >= 24) break;
  }
  if (!research.evidence.length) research.failure = 'no_sources';
  return research;
}

export async function researchMarket(direction: MarketDirection, answers: DeepAnswers, options: { signal?: AbortSignal } = {}): Promise<MarketEvidence> {
  const checkedAt = new Date().toISOString();
  const timeout = AbortSignal.timeout(55_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL ?? 'gemini-3.1-pro-preview',
      contents: createMarketResearchPrompt(direction, answers, checkedAt.slice(0, 10)),
      config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, maxOutputTokens: 7000, abortSignal: signal },
    });
    return await collectMarketEvidence(result, direction, checkedAt, signal);
  } catch {
    options.signal?.throwIfAborted();
    return { direction, checkedAt, evidence: [], failure: timeout.aborted ? 'timeout' : 'unavailable' };
  }
}

const normalize = (value: string) => value.normalize('NFKC').replace(/[\s*`]/g, '').toLowerCase();
export function buildMarketResearch(research: MarketEvidence, modelAdvice: unknown, answers: DeepAnswers = {}) {
  const examples: ReturnType<typeof MarketResearchSchema.parse>['examples'] = [];
  const localOnly = research.direction === 'city' && answers.city_q2?.optionIds?.includes('city_q2_current');
  const currentAnswer = answers.city_q1;
  const currentCities = currentAnswer?.optionIds?.includes('city_q1_other') ? currentAnswer.supplementaryValue ?? []
    : getFixedQuestions('city')[0].options?.filter((option) => currentAnswer?.optionIds?.includes(option.id)).map((option) => option.label) ?? [];
  const cityName = (value: string) => normalize(value).replace(/市$/, '');
  for (const value of Array.isArray(modelAdvice) ? modelAdvice.slice(0, 15) : []) {
    const parsed = MarketAdviceSchema.safeParse(value);
    if (!parsed.success) continue;
    const { evidenceIds, ...advice } = parsed.data;
    if (localOnly && !currentCities.some((city) => cityName(city) === cityName(advice.name))) continue;
    if (examples.some((item) => normalize(item.name) === normalize(advice.name))) continue;
    const sources = research.evidence.filter((item) => evidenceIds.includes(item.id) && marketSource(item.source.url)
      && [...item.source.excerpt.matchAll(/“([^”\n]{2,60})”/g)].some((match) => normalize(match[1]) === normalize(advice.name)))
      .map((item) => item.source).filter((source, index, all) => all.findIndex((other) => other.url === source.url) === index).slice(0, 3);
    if (!sources.length) continue;
    examples.push({ ...advice, sources });
    if (examples.length >= (research.direction === 'city' ? 9 : 5)) break;
  }
  return MarketResearchSchema.parse({ direction: research.direction, checkedAt: research.checkedAt,
    status: examples.length ? 'sourced' : 'unavailable', examples,
    note: examples.length
      ? '以下实例依据本次检索到的公开资料；检索摘要由 AI 整理，并非原文摘录。检索日期不等于资料发布日期，规划不代表已落地，产业规模也不代表个人机会。请打开来源核对统计期与最新变化。'
      : '本次未取得足够可靠的参考资料，暂不列出具体实例或宣称最新趋势。保留探索框架，待补充来源后再比较。',
    ...(research.searchSuggestionsHtml ? { searchSuggestionsHtml: research.searchSuggestionsHtml } : {}),
  });
}
