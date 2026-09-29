import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { BirthForm } from '@/components/birth-form';
import { DeepExplorationPage } from '@/components/deep-analysis/deep-exploration-page';
import { createInitialCareerState, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const snapshotToken = 'v1.digest.signature';
const freeReport = {
  disclaimer: '仅供参考',
  sections: [{ heading: '职业探索', body: '先形成较宽的职业假设，再结合现实条件收窄。', bullets: [] }],
};
const hypothesis = (title: string, tier: '现在值得优先验证' | '有潜力，但存在现实门槛' | '长期可能适合，但目前不宜直接切换') => ({
  title,
  tier,
  whyConsidered: '基础倾向与现实条件共同支持继续验证。',
  realityFit: '可以先用小任务验证。',
  largestBarrier: '岗位门槛仍需核对。',
  transferableAssets: ['学习能力'],
  mainRisk: '把倾向误当成胜任力。',
  marketEvidenceSummary: '体验模式未查询招聘网站。',
  evidenceStatus: 'unavailable' as const,
  sourceCount: 0,
  sources: [],
  evidenceTypes: ['baseTendencies', 'hardConstraints'] as const,
  minimumCostExperiment: '分析 10 条岗位并完成一个两小时任务样本。',
});
const deepReport = {
  kind: 'career-calibration' as const,
  title: '职业现实校准报告',
  summary: '先验证，再决定是否转换。',
  realityBoundaries: ['可全国迁移', '可全职投入', '可以从初级岗位开始'],
  transferableCapital: [],
  careerHypotheses: [
    hypothesis('内容策划', '现在值得优先验证'),
    hypothesis('产品运营', '有潜力，但存在现实门槛'),
    hypothesis('用户研究助理', '长期可能适合，但目前不宜直接切换'),
  ],
  deprioritizedDirections: [],
  thirtyDayPlan: [{ title: '分析岗位', detail: '整理共同任务和门槛。', timeframe: '第 1 周' }],
  marketStatus: 'sample' as const,
  disclaimer: '仅用于职业探索。',
};

const sseResponse = (events: unknown[]) => new Response(new ReadableStream<Uint8Array>({ start(controller) {
  const encoder = new TextEncoder();
  events.forEach((event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)));
  controller.close();
} }), { status: 200, headers: { 'content-type': 'text/event-stream' } });

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/analyze') return sseResponse([
      { type: 'delta', text: JSON.stringify(freeReport) },
      { type: 'report', report: freeReport, snapshotToken },
    ]);
    if (url === '/api/deep-analysis/payment') {
      return Response.json({ status: 'paid', receipt: 'signed-receipt', price: '¥29.90' });
    }
    if (url === '/api/deep-analysis/report') return sseResponse([
      { type: 'status', stage: 'preparing' },
      { type: 'status', stage: 'researching' },
      { type: 'report', report: deepReport },
    ]);
    throw new Error(`Unexpected URL: ${url}`);
  }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openCareerCalibration() {
  render(<BirthForm />);
  fireEvent.change(screen.getByLabelText('出生日期'), { target: { value: '1977-10-15' } });
  fireEvent.change(screen.getByLabelText('出生时间'), { target: { value: '13:30' } });
  fireEvent.click(screen.getByRole('button', { name: '生成我的探索报告' }));
  fireEvent.click(await screen.findByRole('button', { name: '开始职业专项分析' }));
  expect(push).toHaveBeenCalledWith('/explore');

  cleanup();
  render(<DeepExplorationPage price="¥29.90" />);
  fireEvent.click(await screen.findByRole('button', { name: '开始现实校准' }));
}

async function chooseSingle(label: string, nextQuestion: string) {
  fireEvent.click(await screen.findByRole('radio', { name: label }));
  await screen.findByText(nextQuestion);
}

async function chooseMulti(label: string, nextQuestion?: string) {
  fireEvent.click(await screen.findByRole('checkbox', { name: label }));
  fireEvent.click(screen.getByRole('button', { name: '继续' }));
  if (nextQuestion) await screen.findByText(nextQuestion);
}

it('completes the single career calibration from free report through paid report', async () => {
  await openCareerCalibration();
  await chooseSingle('第一次正式求职', '你希望多快开始进入新的职业方向？');
  await chooseSingle('3 个月内', '如果现在开始转向新的职业方向，你能接受的最低月收入大约是多少？');
  await chooseSingle('3000–5000 元', '为了进入更合适的新方向，你能接受短期收入下降吗？');
  await chooseSingle('完全不能接受', '以下哪些现实责任会影响你的职业选择？');
  await chooseMulti('暂时没有明显家庭责任', '为了新的职业机会，你可以接受多大的地点变化？');
  await chooseSingle('可以接受全国范围迁移', '除了现在的工作和生活，你每周大约可以投入多少时间学习或验证新方向？');
  await chooseSingle('可以全职投入', '为了进入新的职业方向，你最多愿意持续准备多久？');
  await chooseSingle('3–6 个月', '为了完成职业转换，你目前最多能接受多少前期投入？');
  await chooseSingle('尽量不花钱', '你目前已经积累了哪些可以带到下一份职业中的资源？');
  await chooseMulti('目前几乎没有明显可迁移职业资本', '如果新方向更适合你，你能接受从比现在更初级的位置重新开始吗？');
  await chooseSingle('可以从初级岗位开始', '如果进入新方向需要重新学习、考证或补充学历，你的接受程度是？');
  await chooseSingle('可以接受短期学习，但不考虑学历提升', '以下哪些工作状态是你明确不能长期接受的？');
  await chooseMulti('暂时没有明确禁区', '对你来说，哪种收入结构现实上可以接受？');
  await chooseMulti('都可以', '以下哪些就业形式你可以接受？');
  await chooseMulti('都可以', '现阶段，对你来说最重要的是什么？');
  await chooseMulti('长期成长');

  expect(await screen.findByRole('heading', { name: '现实条件摘要' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '确认并继续' }));
  fireEvent.click(screen.getByRole('button', { name: '生成我的职业专项报告' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/deep-report'));
  expect(loadDeepSession(window.sessionStorage)?.report?.title).toBe('职业现实校准报告');
});

it('restores an in-progress career question after the page remounts', async () => {
  saveDeepSession({
    ...createInitialCareerState('session-12345678', { freeReport, baseReportSnapshotToken: snapshotToken }),
    step: 'questions', sectionIndex: 0, questionIndex: 1,
    answers: { career_status: { optionIds: ['career_status_first_job'] } },
  }, window.sessionStorage);

  const view = render(<DeepExplorationPage price="¥29.90" />);
  expect(await screen.findByText('你希望多快开始进入新的职业方向？')).toBeTruthy();
  view.unmount();
  render(<DeepExplorationPage price="¥29.90" />);
  expect(await screen.findByText('你希望多快开始进入新的职业方向？')).toBeTruthy();
});

it('blocks an unsigned base-report handoff without exposing legacy directions', async () => {
  saveDeepSession(createInitialCareerState('session-12345678', { freeReport }), window.sessionStorage);
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByRole('heading', { name: '当前标签页还没有可继续的探索内容' })).toBeTruthy();
  expect(screen.queryByText(/工作方向|行业方向|城市方向|自定义问题/)).toBeNull();
});
