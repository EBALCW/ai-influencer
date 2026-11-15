// Testler için sahte panel: PanelGateway'i bellekteki tablolarla ve verilen RPC yanıtlarıyla
// uygular. Gerçek veritabanı kuralları (RLS, trigger) burada YOKTUR; onları CI'daki entegrasyon
// testi (src/integration.test.ts) gerçek Supabase'e karşı dener.
import {
  assertAllowedRpc,
  assertSelectQuery,
  type PanelGateway,
  type Row,
  type RpcName,
  type SelectQuery,
} from '../lib/gateway.ts';
import { ToolError } from '../lib/errors.ts';
import type { PanelSession } from '../server.ts';
import type { ToolKind } from '../tools/types.ts';

export type RpcHandler = (args: Record<string, unknown>) => unknown;

export type FakePanel = PanelGateway & {
  readonly tables: Record<string, Row[]>;
  readonly rpcCalls: { name: string; args: Record<string, unknown> }[];
  readonly selects: SelectQuery[];
};

export function createFakePanel(
  tables: Record<string, Row[]> = {},
  rpcs: Partial<Record<RpcName, RpcHandler>> = {},
): FakePanel {
  const rpcCalls: FakePanel['rpcCalls'] = [];
  const selects: SelectQuery[] = [];
  return {
    tables,
    rpcCalls,
    selects,
    async rpc(name, args) {
      assertAllowedRpc(name);
      rpcCalls.push({ name, args });
      const handler = rpcs[name];
      if (!handler) throw { code: 'PGRST202', message: `no rpc ${name}` };
      return handler(args);
    },
    async select(query) {
      assertSelectQuery(query);
      selects.push(query);
      const columns = query.columns.split(',');
      let rows = [...(tables[query.table] ?? [])];
      for (const [column, op, value] of query.filters ?? []) {
        rows = rows.filter((row) => {
          const cell = row[column];
          if (op === 'eq') return cell === value;
          if (op === 'in')
            return (value as readonly string[]).includes(String(cell));
          if (op === 'is_null')
            return (cell === null || cell === undefined) === value;
          return String(cell) < String(value);
        });
      }
      for (const { column, ascending } of [...(query.order ?? [])].reverse()) {
        rows.sort((a, b) => {
          const left = a[column] as string | number;
          const right = b[column] as string | number;
          const cmp = left < right ? -1 : left > right ? 1 : 0;
          return ascending ? cmp : -cmp;
        });
      }
      return rows
        .slice(0, query.limit)
        .map((row) =>
          Object.fromEntries(
            columns.map((column) => [column, row[column] ?? null]),
          ),
        );
    },
  };
}

export const TEST_USER = '11111111-1111-4111-8111-111111111111';
export const TEST_SESSION = '22222222-2222-4222-8222-222222222222';

export function createFakeSession(
  db: PanelGateway,
  options: {
    loggedIn?: boolean;
    canWrite?: boolean;
  } = {},
): PanelSession & { gatewayCalls: ToolKind[] } {
  const loggedIn = options.loggedIn ?? true;
  const canWrite = options.canWrite ?? true;
  const gatewayCalls: ToolKind[] = [];
  return {
    gatewayCalls,
    async gateway(kind) {
      gatewayCalls.push(kind);
      if (!loggedIn) {
        throw new ToolError('giris_gerekli', 'Panele giriş yapılmamış.');
      }
      if (kind === 'write' && !canWrite) {
        throw new ToolError('yetki_yok', 'Bu oturum salt okur.');
      }
      return db;
    },
    async describe() {
      return loggedIn
        ? { giris: 'var', etkin_rol: canWrite ? 'editor' : 'viewer' }
        : { giris: 'yok' };
    },
    identity() {
      return loggedIn ? { userId: TEST_USER, sessionId: TEST_SESSION } : null;
    },
  };
}
