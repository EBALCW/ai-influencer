// Araçların veritabanına açılan TEK kapısı. Araçlar Supabase istemcisini görmez; yalnız bu
// arayüzü görür. Arayüz iki izin listesiyle sınırlıdır:
//
//   * ALLOWED_RPCS: çağrılabilen RPC'ler. Onay (approve_episode_script, approve_job_stage), makine
//     (register_worker, claim_job, revoke_worker …), yayın, ekip ve anahtar RPC'leri listede YOK;
//     listede olmayan ad çalışma anında da reddedilir. Yani bir araçtaki hata ya da modelin
//     verdiği bir değer bu kapıdan onay RPC'sine ulaşamaz.
//   * READABLE_TABLES: okunabilen tablolar. Tablo ve kolon adları kodda sabittir; modelden gelmez.
//
// Her çağrı giriş yapan üyenin oturumuyla (anon anahtarı + kullanıcının erişim token'ı) gider:
// çalışma alanı ve rol sınırını RLS ve RPC çekirdekleri uygular. Service role kullanılmaz.
import type { SupabaseClient } from '@supabase/supabase-js';

export const ALLOWED_RPCS = [
  // okuma
  'find_similar_topics',
  // taslak yazma (anlatım modülü)
  'create_series',
  'update_series',
  'create_topic_request',
  'add_topic_suggestions',
  'pick_topic_suggestion',
  'reject_topic_suggestion',
  'create_episode',
  'update_episode',
  'save_episode_script',
  // ön hazırlık işi ve iptal isteği
  'enqueue_episode_job',
  'request_cancel_job',
] as const;
export type RpcName = (typeof ALLOWED_RPCS)[number];

/** Bu kapıdan ASLA çağrılmayan RPC'ler (test, listenin bunlarla kesişmediğini denetler). */
export const FORBIDDEN_RPCS = [
  'approve_episode_script',
  'approve_job_stage',
  'retry_job',
  'enqueue_job',
  'attach_job_asset',
  'attach_job_output',
  'register_worker',
  'worker_heartbeat',
  'revoke_worker',
  'claim_job',
  'start_stage',
  'report_progress',
  'complete_stage',
  'fail_stage',
  'acknowledge_cancel',
  'begin_worker_pairing',
  'complete_worker_pairing',
  'claim_worker_pairing',
  'archive_series',
  'archive_episode',
  'move_episode',
  'push_clip_to_backlog',
] as const;

export const READABLE_TABLES = [
  'workspaces',
  'series',
  'topic_requests',
  'topic_suggestions',
  'episodes',
  'episode_script_versions',
  'jobs',
  'job_stages',
  'job_assets',
  'production_workers',
  'clip_sources',
  'clips',
] as const;
export type TableName = (typeof READABLE_TABLES)[number];

export type FilterValue = string | number | boolean | null;
export type Filter =
  | readonly [column: string, op: 'eq', value: FilterValue]
  | readonly [column: string, op: 'in', value: readonly string[]]
  | readonly [column: string, op: 'is_null', value: boolean]
  | readonly [column: string, op: 'lt', value: string];

export type SelectQuery = {
  readonly table: TableName;
  /** Virgülle ayrılmış SABİT kolon listesi (asla `*`). */
  readonly columns: string;
  readonly filters?: readonly Filter[];
  readonly order?: readonly {
    readonly column: string;
    readonly ascending: boolean;
  }[];
  readonly limit: number;
};

export type Row = Record<string, unknown>;

export interface PanelGateway {
  rpc(name: RpcName, args: Record<string, unknown>): Promise<unknown>;
  select(query: SelectQuery): Promise<Row[]>;
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const COLUMN_LIST = /^[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*$/;
export const MAX_SELECT_LIMIT = 200;

export function assertAllowedRpc(name: string): asserts name is RpcName {
  if (!(ALLOWED_RPCS as readonly string[]).includes(name)) {
    throw new Error(`Bu RPC MCP sunucusuna kapalı: ${name}`);
  }
}

export function assertSelectQuery(query: SelectQuery): void {
  if (!(READABLE_TABLES as readonly string[]).includes(query.table)) {
    throw new Error(`Bu tablo MCP sunucusuna kapalı: ${query.table}`);
  }
  if (!COLUMN_LIST.test(query.columns)) {
    throw new Error('Kolon listesi sabit ve açık olmalı.');
  }
  for (const [column] of query.filters ?? []) {
    if (!IDENTIFIER.test(column)) throw new Error('Geçersiz süzgeç kolonu.');
  }
  for (const { column } of query.order ?? []) {
    if (!IDENTIFIER.test(column)) throw new Error('Geçersiz sıralama kolonu.');
  }
  if (
    !Number.isInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > MAX_SELECT_LIMIT
  ) {
    throw new Error('Satır sınırı 1 ile 200 arasında olmalı.');
  }
}

/** Supabase istemcisi üstünde gerçek uygulama. Hata olursa PostgREST hata nesnesini fırlatır. */
export function createSupabaseGateway(client: SupabaseClient): PanelGateway {
  return {
    async rpc(name, args) {
      assertAllowedRpc(name);
      const { data, error } = await client.rpc(name, args);
      if (error) throw error;
      return data;
    },
    async select(query) {
      assertSelectQuery(query);
      let builder = client.from(query.table).select(query.columns);
      for (const [column, op, value] of query.filters ?? []) {
        if (op === 'eq') {
          builder =
            value === null
              ? builder.is(column, null)
              : builder.eq(column, value);
        } else if (op === 'in') {
          builder = builder.in(column, [...value]);
        } else if (op === 'is_null') {
          builder = value
            ? builder.is(column, null)
            : builder.not(column, 'is', null);
        } else {
          builder = builder.lt(column, value);
        }
      }
      for (const { column, ascending } of query.order ?? []) {
        builder = builder.order(column, { ascending });
      }
      const { data, error } = await builder.limit(query.limit);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  };
}
