import { describe, expect, it, vi } from 'vitest';

import type { CareerValidationSession } from './schema';
import { saveValidationDraft } from './draft-service';

const submission = { format: 'markdown' as const, content: '这是二十个字以上的验证成果，包含观察、步骤以及结果。', attachments: [] as [] };
const reflection = { engagement: 'neutral' as const, persistence: 'naturally_continued' as const, repeatWillingness: 'willing' as const, difficulty: 'manageable' as const };
const session = { id: '123e4567-e89b-42d3-a456-426614174001', revision: 2, status: 'ready', submission: null, reflection: null } as CareerValidationSession;

function fixture(current = session) {
  const getSession = vi.fn(async () => current);
  const repository = { patch: vi.fn(async () => ({ outcome: 'updated' as const, session: { ...current, revision: current.revision + 1 } })) };
  return { getSession, repository, options: { getSession, repository, now: () => '2026-10-01T00:00:00.000Z' } };
}

describe('save draft', () => {
  it('persists only validated Markdown and fixed reflection using a revision', async () => {
    const { options, repository } = fixture();
    const result = await saveValidationDraft({ capability: 'signed', expectedRevision: 2, patch: { submission, reflection, status: 'submitted' } }, options);
    expect(result.revision).toBe(3);
    expect(repository.patch).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 2, patch: { submission, reflection, status: 'submitted' } }));
  });

  it.each([
    { submission: { ...submission, content: '短' } },
    { submission: { ...submission, publicResultUrl: 'http://example.com' } },
    { submission: { ...submission, attachments: ['upload'] } },
    { reflection: { engagement: 'neutral' } },
    { result: { status: 'worth_continuing' } },
  ])('rejects invalid or extra patch fields', async (patch) => {
    const { options, repository } = fixture();
    await expect(saveValidationDraft({ capability: 'signed', expectedRevision: 2, patch }, options)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(repository.patch).not.toHaveBeenCalled();
  });

  it('requires both full submission and four reflection answers before submitted', async () => {
    const { options } = fixture();
    await expect(saveValidationDraft({ capability: 'signed', expectedRevision: 2, patch: { submission, status: 'submitted' } }, options)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('preserves revision conflict instead of overwriting a newer edit', async () => {
    const { options, repository } = fixture();
    repository.patch.mockResolvedValueOnce({ outcome: 'conflict', code: 'VERSION_CONFLICT', latestRevision: 3 } as never);
    await expect(saveValidationDraft({ capability: 'signed', expectedRevision: 2, patch: { submission } }, options)).rejects.toMatchObject({ code: 'VERSION_CONFLICT', latestRevision: 3 });
  });

  it.each(['completed', 'deleted'])('rejects editing a %s session', async (status) => {
    const { options } = fixture({ ...session, status } as CareerValidationSession);
    await expect(saveValidationDraft({ capability: 'signed', expectedRevision: 2, patch: { submission } }, options)).rejects.toMatchObject({ code: status === 'deleted' ? 'SESSION_GONE' : 'INVALID_STATE' });
  });
});
