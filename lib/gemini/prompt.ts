import type { BaziChart } from '@/lib/bazi/types';

/** Creates the complete, serializable prompt passed to the report model. */
export const createReportPrompt = (chart: BaziChart): string => `
Create a concise BaZi reflection using only the chart data below. Treat BaZi
as a cultural and interpretive framework, not a factual prediction system.
Keep every observation grounded in the supplied pillars, hour branch, five
elements, and solar date. Do not infer details that are absent from the chart.

Use tentative, non-deterministic language. Do not make absolute claims,
guarantees, diagnoses, or predictions. Do not provide medical, mental-health,
legal, financial, investment, or other professional advice. Avoid instructions
that could lead someone to make high-stakes decisions. Include a clear
disclaimer that the report is for general reflection only.

Return only JSON matching the requested schema. The number of sections should
follow the substance of the supplied chart rather than a fixed template.

Write every string value in Simplified Chinese (简体中文), including the title,
summary, section headings, section bodies, bullets, and disclaimer. Keep the
BaZi terms in their established Chinese forms, such as 日主, 天干, 地支, and 五行.

Chart data:
${JSON.stringify(chart)}
`.trim();
