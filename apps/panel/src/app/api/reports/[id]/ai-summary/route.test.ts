// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const summary = { version: 1, views: 1800, postsPublished: 2 };
const state = vi.hoisted(() => ({
  user: { id: 'editor-1' } as { id: string } | null,
  role: 'editor' as string | null,
  report: null as Record<string, unknown> | null,
  config: true,
  suggest: vi.fn(),
  updates: [] as unknown[],
}));

vi.mock('@/lib/ai/config', () => ({
  getAiConfig: async () =>
    state.config
      ? {
          apiKey: 'fixture-key',
          model: 'claude-fixture',
          pricing: { currency: 'USD', inputPerMTok: '1', outputPerMTok: '1' },
        }
      : null,
}));
vi.mock('@/lib/ai/suggest', () => ({ suggest: state.suggest }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error('no session'),
      }),
    },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (values: unknown) => {
          state.updates.push(values);
          return chain;
        },
        maybeSingle: async () => {
          if (table === 'team_members')
            return {
              data: state.role ? { role: state.role } : null,
              error: null,
            };
          return { data: state.report, error: null };
        },
      };
      return chain;
    },
  }),
}));

const { POST } = await import('./route');
const id = '30000000-0000-4000-8000-000000000001';

function call(reportId = id) {
  return POST(
    new Request(`http://127.0.0.1:3000/api/reports/${reportId}/ai-summary`, {
      method: 'POST',
    }),
    { params: Promise.resolve({ id: reportId }) },
  );
}

beforeEach(() => {
  state.user = { id: 'editor-1' };
  state.role = 'editor';
  state.config = true;
  state.report = { id, influencer_id: 'inf-1', summary };
  state.updates = [];
  state.suggest.mockReset();
  state.suggest.mockResolvedValue({
    task: 'weekly',
    suggestion: {
      summary: 'İzlenme arttı.',
      observations: ['İki post yayınlandı.'],
      suggestions: ['Pazar akşamı paylaşımı sürdür.'],
      limitations: [],
    },
    model: 'claude-fixture',
  });
});

describe('POST /api/reports/[id]/ai-summary', () => {
  it('oturum yoksa 401, viewer 403; Claude çağrılmaz', async () => {
    state.user = null;
    expect((await call()).status).toBe(401);
    state.user = { id: 'viewer-1' };
    state.role = 'viewer';
    expect((await call()).status).toBe(403);
    expect(state.suggest).not.toHaveBeenCalled();
  });

  it('geçersiz veya bulunmayan rapor 404', async () => {
    expect((await call('x')).status).toBe(404);
    state.report = null;
    expect((await call()).status).toBe(404);
  });

  it('tüm influencer raporu için 422', async () => {
    state.report = { id, influencer_id: null, summary };
    expect((await call()).status).toBe(422);
    expect(state.suggest).not.toHaveBeenCalled();
  });

  it('AI yapılandırılmamışsa 503', async () => {
    state.config = false;
    expect((await call()).status).toBe(503);
  });

  it("Claude'a yalnız rapordaki hesaplanmış özet verilir ve sonuç kaydedilir", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(state.suggest).toHaveBeenCalledWith(
      { task: 'weekly', input: { language: 'tr' } },
      expect.objectContaining({ metrics: summary, model: 'claude-fixture' }),
    );
    const expected =
      'İzlenme arttı.\n\nGözlemler:\n- İki post yayınlandı.\n\nÖneriler:\n- Pazar akşamı paylaşımı sürdür.';
    expect(state.updates).toEqual([{ ai_summary: expected }]);
    expect(await response.json()).toEqual({
      aiSummary: expected,
      model: 'claude-fixture',
    });
  });
});
