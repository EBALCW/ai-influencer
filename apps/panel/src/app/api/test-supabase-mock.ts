/**
 * API route testleri için küçük Supabase istemci taklidi. Gerçek
 * `requireApiRole` çalışır; sadece veritabanı yanıtları sahtedir.
 * Yazma çağrıları `state.writes`'a kaydedilir.
 */
export type SupabaseMockState = {
  user: { id: string } | null;
  role: string | null;
  writes: Array<{
    table: string;
    op: 'insert' | 'update';
    values: Record<string, unknown>;
  }>;
  /** Yazma sonrası `.select().single()` sonucu */
  result: { data: unknown; error: { code?: string; message: string } | null };
  /** `.maybeSingle()` ile okunan mevcut kayıt (ör. bütçe) */
  existing?: unknown;
};

export function createSupabaseMock(state: SupabaseMockState) {
  const readChain = (table: string) => {
    const chain = {
      eq: () => chain,
      is: () => chain,
      maybeSingle: async () =>
        table === 'team_members'
          ? { data: state.role ? { role: state.role } : null, error: null }
          : { data: state.existing ?? null, error: null },
    };
    return chain;
  };
  const writeChain = {
    eq: () => writeChain,
    select: () => ({ single: async () => state.result }),
  };
  return {
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error('no session'),
      }),
    },
    from: (table: string) => ({
      select: () => readChain(table),
      insert: (values: Record<string, unknown>) => {
        state.writes.push({ table, op: 'insert', values });
        return writeChain;
      },
      update: (values: Record<string, unknown>) => {
        state.writes.push({ table, op: 'update', values });
        return writeChain;
      },
    }),
  };
}
