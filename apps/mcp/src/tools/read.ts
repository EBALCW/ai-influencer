// Okuma araçları. Hepsi giriş yapan üyenin oturumuyla, RLS'in gösterdiği kadarını okur: yalnız
// kendi çalışma alanı. Kolon listeleri sabittir (asla `*`): tabloya sonradan eklenen bir kolon
// kendiliğinden modele açılmaz. Serbest JSON parametreleri (`params`, `default_params`,
// `caption_style`, yapılandırılmış `script`) döndürülmez.
import * as z from 'zod';
import {
  EPISODE_STATUSES,
  SERIES_STATUSES,
  TOPIC_SUGGESTION_STATUSES,
  canEditScript,
  canStartProduction,
  isEpisodeStatus,
  unsourcedClaimCount,
  type FactNote,
} from '@ai-influencer/shared/explainer';
import {
  JOB_STATUSES,
  MODULES,
  WORKER_OFFLINE_AFTER_SECONDS,
} from '@ai-influencer/shared/jobs';
import { ToolError } from '../lib/errors.ts';
import type { Filter, Row } from '../lib/gateway.ts';
import { id, limit, requiredText } from '../lib/schemas.ts';
import { defineTool, type ToolContext } from './types.ts';

export const SERIES_COLUMNS =
  'id,name,theme,kind,visual_route,style_key,voice_provider,voice_name,voice_rate,language,status,next_episode_number,created_at,updated_at';
export const EPISODE_LIST_COLUMNS =
  'id,series_id,episode_number,title,kind,language,status,script_version,script_approved_at,script_approved_version,unsourced_claim_count,sensitivity_flags,published_at,archived_at,created_at,updated_at';
export const EPISODE_COLUMNS = `${EPISODE_LIST_COLUMNS},suggestion_id,summary,hook,visual_idea,script_text,fact_notes,sensitivity_note,script_approved_with_gaps,visual_route,style_key,voice_provider,voice_name,voice_rate`;
export const TOPIC_REQUEST_COLUMNS =
  'id,series_id,prompt,kind,language,created_at';
export const TOPIC_SUGGESTION_COLUMNS =
  'id,request_id,series_id,position,title,summary,hook,visual_idea,kind,evidence_level,evidence_detail,source_candidates,sensitivity_note,status,decided_at,rejection_reason,created_at';
export const JOB_COLUMNS =
  'id,module,kind,status,current_stage,stop_at,progress,episode_id,episode_script_version,clip_source_id,worker_id,attempts,max_attempts,cancel_requested_at,failed_stage,error,retry_of,started_at,finished_at,created_at';
const JOB_STAGE_COLUMNS =
  'seq,key,status,progress,detail,attempts,error,requires_approval,approved_at,output,started_at,finished_at';
const SCRIPT_VERSION_LIST_COLUMNS =
  'version,kind,language,unsourced_claim_count,approved_at,approved_with_gaps,created_at';

async function one(
  ctx: ToolContext,
  table: Parameters<ToolContext['db']['select']>[0]['table'],
  columns: string,
  rowId: string,
): Promise<Row> {
  const rows = await ctx.db.select({
    table,
    columns,
    filters: [['id', 'eq', rowId]],
    limit: 1,
  });
  const row = rows[0];
  if (!row) {
    throw new ToolError(
      'bulunamadi',
      'Kayıt bulunamadı (kimlik yanlış ya da kayıt bu çalışma alanında değil).',
    );
  }
  return row;
}

function factNoteSummary(notes: unknown): {
  iddia_sayisi: number;
  kaynagi_eksik_iddia: number;
} {
  const list = Array.isArray(notes) ? (notes as FactNote[]) : [];
  return {
    iddia_sayisi: list.length,
    kaynagi_eksik_iddia: unsourcedClaimCount(list),
  };
}

/** Bölümün durumundan türeyen, modelin sıradaki adımı seçmesine yarayan özet. */
function episodeNextSteps(row: Row): Record<string, unknown> {
  const status = typeof row.status === 'string' ? row.status : '';
  if (!isEpisodeStatus(status)) return {};
  return {
    senaryo_duzenlenebilir: canEditScript(status),
    senaryo_onayi_bekliyor: status === 'script_ready',
    uretim_baslatilabilir: canStartProduction(status),
    insan_adimi:
      status === 'script_ready'
        ? 'Senaryo onayı panelde bir insan tarafından verilir.'
        : status === 'ready_for_review'
          ? 'Video onayı panelde bir insan tarafından verilir.'
          : null,
  };
}

const listSeries = defineTool({
  name: 'list_series',
  title: 'Serileri listele',
  description:
    'Anlatım modülündeki serileri (ad, tema, tür, görsel yol, ses, dil, sıradaki bölüm numarası) listeler. ' +
    'Yeni seri açmadan ya da bir seriye bölüm eklemeden önce var olanları görmek için kullan.',
  kind: 'read',
  input: z.strictObject({
    status: z
      .enum([...SERIES_STATUSES, 'all'])
      .default('active')
      .describe('active: yalnız açık seriler · archived · all'),
    limit: limit(100, 50),
  }),
  async handler(ctx, args) {
    const filters: Filter[] =
      args.status === 'all' ? [] : [['status', 'eq', args.status]];
    const seriler = await ctx.db.select({
      table: 'series',
      columns: SERIES_COLUMNS,
      filters,
      order: [{ column: 'created_at', ascending: false }],
      limit: args.limit,
    });
    return { seriler };
  },
});

const getSeries = defineTool({
  name: 'get_series',
  title: 'Seriyi getir',
  description:
    'Bir serinin varsayılanlarını ve bölümlerini (numara, başlık, durum, senaryo sürümü) getirir.',
  kind: 'read',
  input: z.strictObject({ series_id: id }),
  async handler(ctx, args) {
    const seri = await one(ctx, 'series', SERIES_COLUMNS, args.series_id);
    const bolumler = await ctx.db.select({
      table: 'episodes',
      columns: 'id,episode_number,title,kind,status,script_version,updated_at',
      filters: [['series_id', 'eq', args.series_id]],
      order: [{ column: 'episode_number', ascending: false }],
      limit: 100,
    });
    return { seri, bolumler };
  },
});

const listEpisodes = defineTool({
  name: 'list_episodes',
  title: 'Bölümleri listele',
  description:
    'Bölümleri ve tekil videoları listeler: başlık, hesaplanmış durum (draft → script_ready → script_approved → ' +
    'in_production → ready_for_review → approved → published | archived), senaryo sürümü, kaynağı eksik iddia sayısı. ' +
    'Senaryo metni burada dönmez; onun için `get_episode` kullan.',
  kind: 'read',
  input: z.strictObject({
    series_id: id.optional().describe('Yalnız bu serinin bölümleri'),
    standalone: z
      .boolean()
      .optional()
      .describe('true: yalnız seriye bağlı olmayan tekil videolar'),
    status: z.enum(EPISODE_STATUSES).optional(),
    before: z.iso
      .datetime({ offset: true })
      .optional()
      .describe(
        'Sayfalama: bu andan önce oluşturulanlar (önceki sayfanın son created_at değeri)',
      ),
    limit: limit(50, 20),
  }),
  async handler(ctx, args) {
    const filters: Filter[] = [];
    if (args.series_id) filters.push(['series_id', 'eq', args.series_id]);
    if (args.standalone) filters.push(['series_id', 'is_null', true]);
    if (args.status) filters.push(['status', 'eq', args.status]);
    if (args.before) filters.push(['created_at', 'lt', args.before]);
    const bolumler = await ctx.db.select({
      table: 'episodes',
      columns: EPISODE_LIST_COLUMNS,
      filters,
      order: [{ column: 'created_at', ascending: false }],
      limit: args.limit,
    });
    return { bolumler };
  },
});

const getEpisode = defineTool({
  name: 'get_episode',
  title: 'Bölümü getir',
  description:
    'Bir bölümün tamamını getirir: özet, kanca, senaryo metni, kaynak notları (iddia → kaynaklar), hassasiyet ' +
    'işaretleri, senaryo sürümü ve onay durumu, açık işleri. Senaryoyu değiştirmeden ÖNCE bunu çağır ve dönen ' +
    '`script_version` değerini `save_episode_script` çağrısında `expected_version` olarak ver.',
  kind: 'read',
  input: z.strictObject({
    episode_id: id,
    include_script: z
      .boolean()
      .default(true)
      .describe(
        'false: senaryo metni ve kaynak notları dönmez (yalnız özetleri)',
      ),
  }),
  async handler(ctx, args) {
    const row = await one(ctx, 'episodes', EPISODE_COLUMNS, args.episode_id);
    const { script_text: scriptText, fact_notes: factNotes, ...rest } = row;
    const isler = await ctx.db.select({
      table: 'jobs',
      columns: 'id,kind,status,current_stage,progress,created_at',
      filters: [['episode_id', 'eq', args.episode_id]],
      order: [{ column: 'created_at', ascending: false }],
      limit: 10,
    });
    return {
      bolum: {
        ...rest,
        senaryo_uzunlugu:
          typeof scriptText === 'string' ? scriptText.length : 0,
        kaynak_notu_ozeti: factNoteSummary(factNotes),
        ...(args.include_script
          ? { script_text: scriptText, fact_notes: factNotes }
          : {}),
      },
      sonraki_adimlar: episodeNextSteps(row),
      son_isler: isler,
    };
  },
});

const listScriptVersions = defineTool({
  name: 'list_episode_script_versions',
  title: 'Senaryo sürümlerini listele',
  description:
    'Bir bölümün senaryo geçmişini listeler (sürüm numarası, onaylandı mı, kaynağı eksik iddia sayısı). ' +
    '`version` verilirse o sürümün metnini ve kaynak notlarını da getirir; iki sürümü karşılaştırmak için kullan.',
  kind: 'read',
  input: z.strictObject({
    episode_id: id,
    version: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('Metni istenen sürüm'),
  }),
  async handler(ctx, args) {
    const surumler = await ctx.db.select({
      table: 'episode_script_versions',
      columns: SCRIPT_VERSION_LIST_COLUMNS,
      filters: [['episode_id', 'eq', args.episode_id]],
      order: [{ column: 'version', ascending: false }],
      limit: 50,
    });
    if (args.version === undefined) return { surumler };
    const [surum] = await ctx.db.select({
      table: 'episode_script_versions',
      columns: `${SCRIPT_VERSION_LIST_COLUMNS},script_text,fact_notes,sensitivity_flags,sensitivity_note`,
      filters: [
        ['episode_id', 'eq', args.episode_id],
        ['version', 'eq', args.version],
      ],
      limit: 1,
    });
    if (!surum) {
      throw new ToolError('bulunamadi', 'Bu bölümde böyle bir sürüm yok.');
    }
    return { surumler, surum };
  },
});

const listTopicRequests = defineTool({
  name: 'list_topic_requests',
  title: 'Konu isteklerini listele',
  description:
    'Konu isteklerini (kullanıcının yazdığı kısa istek ve o tura ait öneri sayıları: yeni / seçildi / elendi) ' +
    'yeniden eskiye listeler.',
  kind: 'read',
  input: z.strictObject({
    series_id: id.optional(),
    limit: limit(50, 20),
  }),
  async handler(ctx, args) {
    const istekler = await ctx.db.select({
      table: 'topic_requests',
      columns: TOPIC_REQUEST_COLUMNS,
      filters: args.series_id ? [['series_id', 'eq', args.series_id]] : [],
      order: [{ column: 'created_at', ascending: false }],
      limit: args.limit,
    });
    const ids = istekler.map((row) => String(row.id));
    const sayilar = new Map<string, Record<string, number>>();
    if (ids.length > 0) {
      const oneriler = await ctx.db.select({
        table: 'topic_suggestions',
        columns: 'request_id,status',
        filters: [['request_id', 'in', ids]],
        // İstek başına en çok 20 öneri vardır; 50 istek × 20 = 1000 satırı aşmamak için sınır.
        limit: 200,
      });
      for (const row of oneriler) {
        const key = String(row.request_id);
        const status = String(row.status);
        const entry = sayilar.get(key) ?? {};
        entry[status] = (entry[status] ?? 0) + 1;
        sayilar.set(key, entry);
      }
    }
    return {
      istekler: istekler.map((row) => ({
        ...row,
        oneri_sayilari: sayilar.get(String(row.id)) ?? {},
      })),
      not:
        ids.length > 10
          ? 'Öneri sayıları yaklaşık olabilir (tek sorguda en çok 200 öneri sayılır); kesin liste için `get_topic_request`.'
          : undefined,
    };
  },
});

const getTopicRequest = defineTool({
  name: 'get_topic_request',
  title: 'Konu isteğini ve önerilerini getir',
  description:
    'Bir konu isteğini ve ona yazılmış önerileri getirir: başlık, özet, kanca, ekranda ne gösterilecek, kanıt ' +
    'düzeyi (proven / format_example / original), kaynak adayları, durum (new / picked / rejected).',
  kind: 'read',
  input: z.strictObject({
    request_id: id,
    status: z.enum(TOPIC_SUGGESTION_STATUSES).optional(),
  }),
  async handler(ctx, args) {
    const istek = await one(
      ctx,
      'topic_requests',
      TOPIC_REQUEST_COLUMNS,
      args.request_id,
    );
    const filters: Filter[] = [['request_id', 'eq', args.request_id]];
    if (args.status) filters.push(['status', 'eq', args.status]);
    const oneriler = await ctx.db.select({
      table: 'topic_suggestions',
      columns: TOPIC_SUGGESTION_COLUMNS,
      filters,
      order: [{ column: 'position', ascending: true }],
      limit: 20,
    });
    return { istek, oneriler };
  },
});

const findSimilarTopics = defineTool({
  name: 'find_similar_topics',
  title: 'Benzer konu ara',
  description:
    '"Bu konuyu daha önce yaptık mı?" denetimi: verilen başlığa aynı (exact) ya da benzer (similar) başlıklı ' +
    'bölümleri ve karar verilmemiş / elenmiş önerileri bulur. Konu önermeden ve bölüm açmadan önce çağır.',
  kind: 'read',
  input: z.strictObject({
    title: requiredText(200),
    exclude_episode_id: id.optional(),
    limit: limit(20, 10),
  }),
  async handler(ctx, args) {
    const benzerler = await ctx.db.rpc('find_similar_topics', {
      p_title: args.title,
      p_limit: args.limit,
      p_exclude_episode_id: args.exclude_episode_id ?? null,
    });
    return { benzerler: Array.isArray(benzerler) ? benzerler : [] };
  },
});

const listJobs = defineTool({
  name: 'list_jobs',
  title: 'Üretim işlerini listele',
  description:
    'Üretim işlerini listeler: tür (ör. explainer.script, explainer.render), durum (queued, running, ' +
    'awaiting_approval, succeeded, failed, cancelled), bulunduğu aşama, ilerleme, hata. İş geçmişi de buradan okunur.',
  kind: 'read',
  input: z.strictObject({
    module: z.enum(MODULES).optional(),
    status: z.enum(JOB_STATUSES).optional(),
    episode_id: id.optional(),
    before: z.iso.datetime({ offset: true }).optional(),
    limit: limit(50, 20),
  }),
  async handler(ctx, args) {
    const filters: Filter[] = [];
    if (args.module) filters.push(['module', 'eq', args.module]);
    if (args.status) filters.push(['status', 'eq', args.status]);
    if (args.episode_id) filters.push(['episode_id', 'eq', args.episode_id]);
    if (args.before) filters.push(['created_at', 'lt', args.before]);
    const isler = await ctx.db.select({
      table: 'jobs',
      columns: JOB_COLUMNS,
      filters,
      order: [{ column: 'created_at', ascending: false }],
      limit: args.limit,
    });
    return { isler };
  },
});

const getJob = defineTool({
  name: 'get_job',
  title: 'İşi ve aşamalarını getir',
  description:
    'Bir işin aşamalarını sırasıyla getirir: durum, ilerleme, makinenin ilerleme notu, hata, onay gerekip ' +
    'gerekmediği ve onaylanıp onaylanmadığı, bağlı dosyaların rolleri. `awaiting_approval` durumundaki işi yalnız ' +
    'bir insan panelden onaylayabilir.',
  kind: 'read',
  input: z.strictObject({ job_id: id }),
  async handler(ctx, args) {
    const is = await one(ctx, 'jobs', JOB_COLUMNS, args.job_id);
    const asamalar = await ctx.db.select({
      table: 'job_stages',
      columns: JOB_STAGE_COLUMNS,
      filters: [['job_id', 'eq', args.job_id]],
      order: [{ column: 'seq', ascending: true }],
      limit: 20,
    });
    const dosyalar = await ctx.db.select({
      table: 'job_assets',
      columns: 'asset_id,role,stage_key,created_at',
      filters: [['job_id', 'eq', args.job_id]],
      order: [{ column: 'created_at', ascending: true }],
      limit: 100,
    });
    return {
      is,
      asamalar,
      dosyalar,
      insan_adimi:
        is.status === 'awaiting_approval'
          ? 'Bu iş onay bekliyor; onayı yalnız bir insan panelden verebilir.'
          : null,
    };
  },
});

const listProductionMachines = defineTool({
  name: 'list_production_machines',
  title: 'Üretim makinelerini listele',
  description:
    'Çalışma alanına kayıtlı üretim makinelerini listeler: ad, platform, yetenekler (ör. render.blender), son ' +
    'görülme ve çevrimiçi olup olmadığı. Bir işin neden sırada beklediğini anlamak için kullan. (MCP oturumları da ' +
    'burada "MCP" adıyla, yeteneksiz bir kayıt olarak görünür.)',
  kind: 'read',
  input: z.strictObject({}),
  async handler(ctx) {
    const rows = await ctx.db.select({
      table: 'production_workers',
      columns:
        'id,name,platform,version,capabilities,last_seen_at,revoked_at,created_at',
      order: [{ column: 'last_seen_at', ascending: false }],
      limit: 100,
    });
    const now = ctx.now().getTime();
    return {
      makineler: rows.map((row) => {
        const seen = Date.parse(String(row.last_seen_at));
        return {
          ...row,
          cevrimici:
            row.revoked_at === null &&
            Number.isFinite(seen) &&
            now - seen <= WORKER_OFFLINE_AFTER_SECONDS * 1000,
        };
      }),
    };
  },
});

const listClipSources = defineTool({
  name: 'list_clip_sources',
  title: 'Klip kaynaklarını listele',
  description:
    'Yayıncı klibi modülünün kaynak videolarını listeler: kanal, başlık, süre ve izin durumu (pending / granted / ' +
    'denied). İzni `granted` olmayan kaynaktan klip kesilmez. Salt okunur; klip adayı kararları (seç, ele, kaydır) ' +
    'bugün yerel dosyalarda tutulur ve bu sunucuda henüz yoktur.',
  kind: 'read',
  input: z.strictObject({
    permission_status: z.enum(['pending', 'granted', 'denied']).optional(),
    limit: limit(50, 20),
  }),
  async handler(ctx, args) {
    const kaynaklar = await ctx.db.select({
      table: 'clip_sources',
      columns:
        'id,platform,video_url,channel_name,title,duration_seconds,permission_status,permission_checked_at,created_at',
      filters: args.permission_status
        ? [['permission_status', 'eq', args.permission_status]]
        : [],
      order: [{ column: 'created_at', ascending: false }],
      limit: args.limit,
    });
    return { kaynaklar };
  },
});

const listClips = defineTool({
  name: 'list_clips',
  title: 'Klipleri listele',
  description:
    'Panele kaydedilmiş klipleri listeler: başlık, kanca, başlangıç ve bitiş saniyesi, durum (candidate / approved / ' +
    'rendered / rejected). Salt okunur. Kalite raporu ve inceleme paketi yerel dosyalardadır (docs/clip-guide.md).',
  kind: 'read',
  input: z.strictObject({
    source_id: id.optional(),
    status: z
      .enum(['candidate', 'approved', 'rendered', 'rejected'])
      .optional(),
    limit: limit(50, 20),
  }),
  async handler(ctx, args) {
    const filters: Filter[] = [];
    if (args.source_id) filters.push(['source_id', 'eq', args.source_id]);
    if (args.status) filters.push(['status', 'eq', args.status]);
    const klipler = await ctx.db.select({
      table: 'clips',
      columns:
        'id,source_id,title,hook,start_seconds,end_seconds,status,content_item_id,created_at',
      filters,
      order: [{ column: 'created_at', ascending: false }],
      limit: args.limit,
    });
    return { klipler };
  },
});

export const READ_TOOLS = [
  listSeries,
  getSeries,
  listEpisodes,
  getEpisode,
  listScriptVersions,
  listTopicRequests,
  getTopicRequest,
  findSimilarTopics,
  listJobs,
  getJob,
  listProductionMachines,
  listClipSources,
  listClips,
] as const;
