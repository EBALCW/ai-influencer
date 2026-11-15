// MCP sunucusu: araç tanımlarını resmî SDK'ya kaydeder ve her çağrıyı aynı boru hattından
// geçirir: hız sınırı → denetim kaydı (yazmada önce) → oturum ve güvenlik denetimi → araç →
// veri zarfı → denetim kaydı. Girdi doğrulamasını SDK, araçların katı Zod şemalarıyla yapar.
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { AuditLog } from './lib/audit.ts';
import {
  ENVELOPE_TYPE,
  MAX_RESULT_CHARS,
  renderEnvelope,
  resultTooLarge,
  wrapData,
} from './lib/envelope.ts';
import { ToolError, formatToolError, toToolError } from './lib/errors.ts';
import type { PanelGateway } from './lib/gateway.ts';
import { RateLimiter } from './lib/rate-limit.ts';
import { SERVER_INSTRUCTIONS } from './instructions.ts';
import { READ_TOOLS } from './tools/read.ts';
import type { ToolDefinition, ToolKind } from './tools/types.ts';
import { defineTool } from './tools/types.ts';
import { WRITE_TOOLS } from './tools/write.ts';

export const SERVER_NAME = 'ai-influencer-panel';
export const SERVER_VERSION = '0.1.0';

/** Oturumun sunucuya görünen yüzü. Gerçek uygulama: runtime.ts; testlerde sahte. */
export interface PanelSession {
  /**
   * Araç türü için veritabanı kapısını verir. Giriş yoksa, güvenlik denetimi geçmediyse ya da
   * (yazmada) oturumun yazma yetkisi yoksa `ToolError` fırlatır.
   */
  gateway(kind: ToolKind): Promise<PanelGateway>;
  /** Oturumun özeti (`whoami`). */
  describe(): Promise<Record<string, unknown>>;
  /** Denetim kaydı için kimlik; giriş yoksa null. */
  identity(): { userId: string; sessionId: string } | null;
}

export const NOT_AVAILABLE = [
  'Senaryo onayı ve video (iş aşaması) onayı: yalnız panelde, insan tarafından.',
  'Paylaşım / yayın, içerik takvimi ve sosyal hesaplar.',
  'Üretim (ses, altyazı, render) işi açma ve yeniden deneme: senaryo onayından sonra panelden.',
  'Ekip ve rol yönetimi, çalışma alanı ayarları, sağlayıcı anahtarları.',
  'Üretim makinesi kaydı, eşleme ve yetki kaldırma.',
  'Arşivleme, bölüm taşıma, silme.',
  'Klip adayı kararları (seç, ele, kaydır, üst yazı): bugün yerel dosyalarda (docs/clip-guide.md).',
] as const;

const whoami = defineTool({
  name: 'whoami',
  title: 'Oturum durumu',
  description:
    'Bu MCP oturumunun durumunu gösterir: giriş yapılmış mı, üyenin rolü, çalışma alanı, yazma araçları açık mı ' +
    've bu sunucunun bilerek sunmadığı işlemler. Bir yazma aracı yetki hatası verirse ya da ne yapabileceğinden emin ' +
    'değilsen önce bunu çağır.',
  kind: 'read',
  input: z.strictObject({}),
  async handler() {
    throw new Error('whoami oturumdan yanıtlanır');
  },
});

export const ALL_TOOLS: readonly ToolDefinition[] = [
  whoami,
  ...READ_TOOLS,
  ...WRITE_TOOLS,
];

const OUTPUT_SCHEMA = z.object({
  tur: z.literal(ENVELOPE_TYPE),
  guvenilmeyen_icerik: z.literal(true),
  not: z.string(),
  veri: z.unknown(),
});

export type ServerDeps = {
  readonly session: PanelSession;
  readonly audit: AuditLog;
  readonly limiter?: RateLimiter;
  readonly now?: () => Date;
  /** stderr günlüğü (protokol stdout'tadır; oraya asla yazılmaz). */
  readonly log?: (line: string) => void;
};

type ToolResult = {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function errorResult(error: ToolError): ToolResult {
  return {
    content: [{ type: 'text', text: formatToolError(error) }],
    isError: true,
  };
}

export async function runTool(
  tool: ToolDefinition,
  args: unknown,
  deps: ServerDeps & { limiter: RateLimiter },
): Promise<ToolResult> {
  const now = deps.now ?? (() => new Date());
  const started = now().getTime();
  const identity = () => {
    const who = deps.session.identity();
    return who ? { userId: who.userId, sessionId: who.sessionId } : {};
  };
  const finish = (error?: ToolError) => {
    try {
      deps.audit.record({
        tool: tool.name,
        kind: tool.kind,
        phase: 'bitti',
        outcome: error ? 'hata' : 'ok',
        ...(error ? { code: error.code } : {}),
        ms: now().getTime() - started,
        ...identity(),
        args,
      });
    } catch {
      deps.log?.('denetim kaydı yazılamadı');
    }
  };

  try {
    const decision = deps.limiter.take(tool.kind);
    if (!decision.allowed) {
      throw new ToolError(
        'hiz_siniri',
        decision.reason === 'session_cap'
          ? 'Bu oturumda yapılabilecek yazma sayısına ulaşıldı.'
          : `Çok sık çağrı. ${decision.retryAfterSeconds} saniye sonra yeniden dene.`,
        {
          advice: 'Aynı çağrıyı döngüyle yineleme; kullanıcıya durumu bildir.',
        },
      );
    }

    let data: unknown;
    if (tool.name === 'whoami') {
      data = {
        ...(await deps.session.describe()),
        sunulmayan_islemler: NOT_AVAILABLE,
      };
    } else {
      const db = await deps.session.gateway(tool.kind);
      if (tool.kind === 'write') {
        // Yazma, denetim kaydı yazılamıyorsa yapılmaz.
        try {
          deps.audit.record({
            tool: tool.name,
            kind: 'write',
            phase: 'basladi',
            ...identity(),
            args,
          });
        } catch {
          throw new ToolError(
            'beklenmeyen',
            'Denetim kaydı yazılamadığı için yazma işlemi yapılmadı.',
          );
        }
      }
      data = await tool.handler({ db, now }, args as never);
    }

    let envelope = wrapData(data);
    let text = renderEnvelope(envelope);
    if (resultTooLarge(text)) {
      if (tool.kind === 'read') {
        throw new ToolError(
          'sonuc_cok_buyuk',
          `Sonuç çok büyük (${text.length} karakter, sınır ${MAX_RESULT_CHARS}).`,
          {
            advice:
              'Daha küçük `limit` ver, süzgeç ekle ya da `include_script: false` kullan.',
          },
        );
      }
      // Yazma yapıldı: sonucu kırp, "yapılmadı" izlenimi verme.
      envelope = wrapData({
        kaydedildi: true,
        not: 'İşlem tamamlandı; sonuç gösterilemeyecek kadar büyük. Kaydı okuma araçlarıyla getir.',
      });
      text = renderEnvelope(envelope);
    }
    finish();
    return {
      content: [{ type: 'text', text }],
      structuredContent: envelope as unknown as Record<string, unknown>,
    };
  } catch (caught) {
    const error = toToolError(caught);
    finish(error);
    return errorResult(error);
  }
}

export function buildServer(deps: ServerDeps): McpServer {
  const limiter = deps.limiter ?? new RateLimiter();
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS, capabilities: { tools: {} } },
  );
  for (const tool of ALL_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        outputSchema: OUTPUT_SCHEMA,
        annotations: {
          title: tool.title,
          readOnlyHint: tool.kind === 'read',
          destructiveHint: tool.kind === 'write' && tool.destructive === true,
          idempotentHint: tool.kind === 'read' || tool.idempotent === true,
          // Araçlar yalnız panelin kendi verisine dokunur; açık dünyaya (web) çıkmaz.
          openWorldHint: false,
        },
      },
      async (args: unknown) => runTool(tool, args, { ...deps, limiter }),
    );
  }
  return server;
}
