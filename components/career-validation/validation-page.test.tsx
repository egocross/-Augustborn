import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/analytics/career-events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/analytics/career-events')>()),
  trackValidationEvent: vi.fn(),
}));

import { loadValidationLocal, saveValidationLocal, VALIDATION_LOCAL_KEY } from '@/lib/career-validation/local';
import { createInitialCareerState, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';
import { ValidationPage } from './validation-page';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_ID = '33333333-3333-4333-8333-333333333333';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const CAREER_ID = 'career-1-abcdefabcdef';

const legacyReport = {
  title: '你的职业方向深度分析', summary: '先聚焦能长期复利的问题解决型工作。', keyFindings: ['优先专注', '避免高频切换'],
  cards: [
    { id: 'c1', title: '方向', summary: '摘要', details: ['详情'], evidence: [] },
    { id: 'c2', title: '边界', summary: '摘要', details: ['详情'], evidence: [] },
  ],
  risks: [{ title: '风险', detail: '细节', mitigation: '应对' }],
  nextActions: [{ title: '行动一', detail: '执行', timeframe: '本周' }, { title: '行动二', detail: '复盘', timeframe: '下周' }],
  reflectionQuestions: [], disclaimer: '仅供探索。',
};

const experiment = {
  id: 'experiment-1', version: 1, executionMode: 'online_work_sample', uncertaintyType: 'task_ability',
  validationQuestion: '我能否独立完成一次内容策划的核心任务？',
  hypothesis: '你对内容工作的投入可能来自结构化表达本身。',
  title: '完成一次内容工作样本',
  scenario: '围绕一个真实问题写一篇结构化内容，不冒充真实客户交付。',
  role: '你是一名正在验证内容方向的人。', objective: '观察拆解、成稿与自评的完整过程。',
  providedInformation: ['目标读者是一线职场人'], prerequisites: [], estimatedMinutes: 60,
  steps: ['拆解题目并列出结构', '完成初稿', '按标准自评并记录取舍'],
  deliverable: '一篇 800 字结构化草稿',
  rubric: [{ criterion: '结构清晰', basicStandard: '能看出论点与证据的关系' }],
  referenceStructure: ['问题', '分析', '结论'],
  limitationNote: '这是低风险工作样本，不代表真实招聘要求。',
  generatedAt: '2026-09-30T08:00:00.000Z',
  generationMetadata: { experimentGeneratorVersion: 'v1', experimentPromptVersion: 'v1', rubricVersion: 'v1', experimentModelId: 'sample' },
};

const snapshot = {
  version: 1, contextHash: 'a'.repeat(64), sourceReport: { reportId: REPORT_ID },
  career: { careerId: CAREER_ID, careerName: '内容策划', candidateReason: '基础报告与现实约束共同指向内容型工作。' },
  workValidation: {
    careerId: 'model-1', careerName: '内容策划', status: 'partial',
    workReality: {
      coreTasks: ['把复杂信息整理成结构化内容'], deliverables: ['一篇内容草稿'],
      performanceSignals: ['目标读者能否理解'], collaborationWith: ['编辑'],
      overlookedReality: ['反复修改占用时间长'], evidence: [], confidence: 'low',
    },
    capabilitySignals: {
      hiringSignalType: 'portfolio_project',
      existingSignals: [{ signal: '内容写作', evidence: '校准问卷中确认过相关经历' }],
      criticalGaps: [{ gap: '缺少公开作品', impact: '无法快速证明能力', basis: 'model_judgment' }],
      fastBuildableSignals: [{ title: '完成一篇工作样本', rationale: '用作品替代描述', deliverable: '一篇草稿', estimatedTime: '1 天' }],
      hardBarriers: [], bridgePaths: [],
    },
    validationPath: [{
      level: 'job_simulation', title: '完成一次工作样本', validates: '能否独立完成核心任务',
      steps: ['拆解题目', '写初稿', '按标准自评'], estimatedTime: '2 小时', estimatedCost: '0 元',
      deliverable: '一份草稿', successSignals: ['能看出结构'], stopSignals: ['持续回避'],
    }],
  },
  relevantConstraints: {},
  relevantCareerCapital: { experience: [], skills: ['内容写作'], evidence: [] },
  marketEvidence: { marketStatus: 'unavailable', locationLabel: '不限', sources: [], limitationNote: '当前实时岗位证据不足。' },
  frozenAt: '2026-09-30T08:00:00.000Z',
};

const baseSession = {
  id: SESSION_ID, reportId: REPORT_ID, careerId: CAREER_ID, parentValidationSessionId: null,
  status: 'ready', validationContextSnapshot: snapshot, experiment, experimentVersion: 1,
  submission: null, reflection: null, result: null, generationMetadata: null, revision: 3,
  operationKind: null, operationToken: null, operationLeaseExpiresAt: null,
  capabilityIssuedAt: '2026-09-30T08:00:00.000Z', capabilityExpiresAt: '2099-01-01T00:00:00.000Z',
  retentionExpiresAt: '2099-01-01T00:00:00.000Z', createdAt: '2026-09-30T08:00:00.000Z',
  updatedAt: '2026-09-30T08:00:00.000Z', deletedAt: null,
};

const completedResult = {
  status: 'worth_continuing', validatedQuestion: '我能否独立完成一次内容策划任务？',
  evidence: [{ dimension: 'task_performance', signal: 'support', observation: '完成了初稿', interpretation: '可以继续', limitation: '只有一次样本' }],
  supportingEvidence: ['初稿结构完整'], riskSignals: ['修改耐受度未知'], unknowns: ['真实反馈未知'],
  reasoning: '任务表现支持继续验证。',
  nextAction: { type: 'external_validation', title: '找一位从业者核对日常工作', detail: '用 20 分钟核对重复任务。', cost: '0 元', canStartInProduct: false },
  analyzedAt: '2026-09-30T10:00:00.000Z',
  generationMetadata: { evaluationPromptVersion: 'v1', rubricVersion: 'v1', evaluationModelId: 'sample' },
};

type FetchPlan = Record<string, () => { status?: number; body: unknown }>;

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => { map.clear(); },
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => { map.delete(key); },
    setItem: (key, value) => { map.set(key, String(value)); },
  };
}

function installFetch(plan: FetchPlan) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method, body });
    const key = Object.keys(plan).find((candidate) => url.endsWith(candidate));
    const entry = key ? plan[key]() : { status: 500, body: { code: 'UNEXPECTED' } };
    const status = entry.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => entry.body,
    } as Response;
  });
  vi.stubGlobal('fetch', mock);
  return calls;
}

function seedAccess(capability = 'cap-session') {
  saveDeepSession({
    ...createInitialCareerState('session-12345678'),
    step: 'report',
    report: legacyReport as never,
    validationAccess: [{ careerId: CAREER_ID, validationSessionId: SESSION_ID, capability }],
  }, window.sessionStorage);
}

beforeEach(() => {
  window.sessionStorage.clear();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: createMemoryStorage() });
  push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('keeps frozen source facts separate from AI synthesis and states that links are never read', async () => {
  seedAccess();
  expect(loadDeepSession(window.sessionStorage)?.validationAccess).toHaveLength(1);
  installFetch({ '/api/career-validation/session': () => ({ body: { session: baseSession } }) });

  const { container } = render(<ValidationPage validationSessionId={SESSION_ID} />);
  expect(await screen.findByRole('heading', { name: '完成一次内容工作样本' })).toBeTruthy();

  const facts = screen.getByTestId('source-facts');
  const synthesis = screen.getByTestId('ai-synthesis');
  expect(facts.contains(synthesis)).toBe(false);
  expect(within(facts).getByText('当前实时岗位证据不足。')).toBeTruthy();
  expect(within(synthesis).getByText(/结构化表达/)).toBeTruthy();
  expect(container.querySelector('.validation-action-bar')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: '开始这项任务' }));
  expect(await screen.findByText('拆解题目并列出结构')).toBeTruthy();
  expect(screen.getByText('一篇 800 字结构化草稿')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: '准备好了，去提交' }));
  expect(await screen.findByLabelText('Markdown 正文')).toBeTruthy();
  expect(screen.getByText(/AI 不会读取、抓取或预览链接内容/)).toBeTruthy();
});

it('recovers an unsynced draft from this browser and keeps it on a revision conflict until the user chooses', async () => {
  saveValidationLocal(window.localStorage, {
    validationSessionId: SESSION_ID, capability: 'cap-local', revision: 5, step: 'submission',
    draft: { content: '本地未同步草稿，还没有同步到服务器。', publicResultUrl: '', reflection: {} },
    retentionExpiresAt: '2099-01-01T00:00:00.000Z', updatedAt: '2026-09-30T09:00:00.000Z',
  });
  let patchCount = 0;
  const calls = installFetch({
    '/api/career-validation/session': () => ({ body: { session: { ...baseSession, revision: 5 } } }),
    '/api/career-validation/analyze': () => ({ body: { result: completedResult } }),
  });
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith('/api/career-validation/session') && method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ session: { ...baseSession, revision: 5 } }) } as Response;
    }
    if (url.endsWith('/api/career-validation/session') && method === 'PATCH') {
      patchCount += 1;
      if (patchCount === 1) return { ok: false, status: 409, json: async () => ({ code: 'VERSION_CONFLICT', latestRevision: 6 }) } as Response;
      return { ok: true, status: 200, json: async () => ({ session: { ...baseSession, revision: 6 }, revision: 6 }) } as Response;
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });

  render(<ValidationPage validationSessionId={SESSION_ID} />);
  const textarea = await screen.findByLabelText('Markdown 正文') as HTMLTextAreaElement;
  expect(textarea.value).toBe('本地未同步草稿，还没有同步到服务器。');
  expect(screen.getByText(/仅限当前浏览器/)).toBeTruthy();

  fireEvent.change(textarea, { target: { value: '本地未同步草稿，还没有同步到服务器。补充了新的判断和取舍。' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿并继续' }));

  expect(await screen.findByText('另一处已更新了这份记录')).toBeTruthy();
  const kept = screen.getByLabelText('Markdown 正文') as HTMLTextAreaElement;
  expect(kept.value).toContain('补充了新的判断和取舍');
  const firstPatch = calls.find((call) => call.method === 'PATCH');
  expect((firstPatch?.body as { expectedRevision: number }).expectedRevision).toBe(5);

  fireEvent.click(screen.getByRole('button', { name: '保留我的草稿并重试' }));
  await waitFor(() => expect(patchCount).toBe(2));
  const patches = calls.filter((call) => call.method === 'PATCH');
  expect((patches[1].body as { expectedRevision: number }).expectedRevision).toBe(6);
  expect(JSON.stringify(patches[1].body)).toContain('补充了新的判断和取舍');
  expect(await screen.findByText('投入感受')).toBeTruthy();
});

it('clears the local copy and shows a recoverable notice when the server session is gone', async () => {
  saveValidationLocal(window.localStorage, {
    validationSessionId: SESSION_ID, capability: 'cap-local', revision: 2, step: 'overview',
    draft: { content: '', publicResultUrl: '', reflection: {} },
    retentionExpiresAt: '2099-01-01T00:00:00.000Z', updatedAt: '2026-09-30T09:00:00.000Z',
  });
  installFetch({ '/api/career-validation/session': () => ({ status: 410, body: { code: 'SESSION_GONE' } }) });

  render(<ValidationPage validationSessionId={SESSION_ID} />);
  expect(await screen.findByText(/本次验证已结束或已被删除/)).toBeTruthy();
  expect(screen.getByRole('link', { name: '返回职业报告' }).getAttribute('href')).toBe('/deep-report');
  expect(loadValidationLocal(window.localStorage, SESSION_ID)).toBeNull();
});

it('explains the 20-character minimum instead of leaving a stuck-looking disabled button', async () => {
  saveValidationLocal(window.localStorage, {
    validationSessionId: SESSION_ID, capability: 'cap-local', revision: 5, step: 'submission',
    draft: { content: '完成出色，很熟练', publicResultUrl: '', reflection: {} },
    retentionExpiresAt: '2099-01-01T00:00:00.000Z', updatedAt: '2026-09-30T09:00:00.000Z',
  });
  installFetch({
    '/api/career-validation/session': () => ({ body: { session: { ...baseSession, revision: 5 } } }),
    '/api/career-validation/analyze': () => ({ body: { result: completedResult } }),
  });

  render(<ValidationPage validationSessionId={SESSION_ID} />);
  const textarea = await screen.findByLabelText('Markdown 正文') as HTMLTextAreaElement;
  expect(textarea.value).toBe('完成出色，很熟练');

  expect(screen.getByText(/还差 12 个字才能继续/)).toBeTruthy();
  const blocked = screen.getByRole('button', { name: '保存草稿并继续' }) as HTMLButtonElement;
  expect(blocked.disabled).toBe(true);
  expect(blocked.getAttribute('aria-busy')).toBe('false');

  fireEvent.change(textarea, { target: { value: '完成出色，很熟练，结构和取舍都已记录清楚，也写下了仍不确定的部分。' } });
  expect(screen.queryByText(/还差 \d+ 个字/)).toBeNull();
  expect((screen.getByRole('button', { name: '保存草稿并继续' }) as HTMLButtonElement).disabled).toBe(false);
});

it('deletes only the current validator entry after an explicit confirmation', async () => {
  seedAccess();
  saveValidationLocal(window.localStorage, {
    validationSessionId: SESSION_ID, capability: 'cap-session', revision: 7, step: 'reflection',
    draft: { content: '', publicResultUrl: '', reflection: {} },
    retentionExpiresAt: '2099-01-01T00:00:00.000Z', updatedAt: '2026-09-30T09:00:00.000Z',
  });
  saveValidationLocal(window.localStorage, {
    validationSessionId: CHILD_ID, capability: 'cap-other', revision: 1, step: 'overview',
    draft: { content: '', publicResultUrl: '', reflection: {} },
    retentionExpiresAt: '2099-01-01T00:00:00.000Z', updatedAt: '2026-09-30T09:00:00.000Z',
  });
  const calls = installFetch({
    '/api/career-validation/session': () => ({ body: { session: { ...baseSession, status: 'completed', revision: 7, result: completedResult } } }),
  });
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
    if ((init?.method ?? 'GET') === 'DELETE') {
      return { ok: true, status: 200, json: async () => ({ deleted: true }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ session: { ...baseSession, status: 'completed', revision: 7, result: completedResult } }) } as Response;
  });

  render(<ValidationPage validationSessionId={SESSION_ID} />);
  expect(await screen.findByRole('heading', { name: '我能否独立完成一次内容策划任务？' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: '删除本次验证记录' }));
  expect(screen.getByText(/不影响基础报告、职业专项报告和支付记录/)).toBeTruthy();
  expect(calls.some((call) => call.method === 'DELETE')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(await screen.findByText('本次验证记录已删除')).toBeTruthy();
  expect(loadValidationLocal(window.localStorage, SESSION_ID)).toBeNull();
  expect(loadValidationLocal(window.localStorage, CHILD_ID)).not.toBeNull();
  expect(window.localStorage.getItem(VALIDATION_LOCAL_KEY)).toContain(CHILD_ID);
});

it('starts exactly one child validation round only from the product next action', async () => {
  const productResult = {
    ...completedResult,
    nextAction: { type: 'in_product_experiment', title: '做第二次工作样本', detail: '换一个任务类型再验证一次。', cost: '0 元', canStartInProduct: true },
  };
  seedAccess();
  installFetch({
    '/api/career-validation/session': () => ({ body: { session: { ...baseSession, status: 'completed', revision: 7, result: productResult } } }),
    '/api/career-validation/next': () => ({ body: { validationSessionId: CHILD_ID, capability: 'cap-child' } }),
  });

  render(<ValidationPage validationSessionId={SESSION_ID} />);
  fireEvent.click(await screen.findByRole('button', { name: '开始下一轮验证' }));

  await waitFor(() => expect(push).toHaveBeenCalledWith(`/career-validation/${CHILD_ID}`));
  expect(loadValidationLocal(window.localStorage, CHILD_ID)?.capability).toBe('cap-child');
});
