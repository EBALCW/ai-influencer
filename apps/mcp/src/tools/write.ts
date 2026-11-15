// Yazma araçları: yalnız TASLAK işleri. Hepsi #216'nın `public` RPC sarmalayıcılarından geçer;
// yetkiyi (owner/editor), çalışma alanını, boyutları ve durum kurallarını RPC çekirdeği uygular.
//
// Bilerek SUNULMAYANLAR (docs/mcp-panel.md → "Sunulmayan işlemler"): senaryo onayı, iş aşaması /
// video onayı, üretim (render) işi açma, yeniden deneme, arşivleme, taşıma, yayın, ekip ve rol,
// sağlayıcı anahtarları, makine kaydı ve yetki kaldırma. Bunların RPC'leri gateway izin
// listesinde de yoktur.
import * as z from 'zod';
import {
  EXPLAINER_LIMITS,
  EXPLAINER_PRE_APPROVAL_JOB_KINDS,
} from '@ai-influencer/shared/explainer';
import type { Row } from '../lib/gateway.ts';
import {
  compact,
  explainerKind,
  factNotes,
  id,
  language,
  requiredText,
  sensitivityFlag,
  seriesSettings,
  styleKey,
  text,
  topicSuggestions,
  visualRoute,
  voiceProvider,
  voiceRate,
} from '../lib/schemas.ts';
import {
  EPISODE_LIST_COLUMNS,
  JOB_COLUMNS,
  SERIES_COLUMNS,
  TOPIC_REQUEST_COLUMNS,
  TOPIC_SUGGESTION_COLUMNS,
} from './read.ts';
import { defineTool } from './types.ts';

/** RPC'nin döndürdüğü tam satırdan yalnız okuma araçlarının gösterdiği kolonları alır. */
function project(row: unknown, columns: string): Row {
  const source = (row ?? {}) as Row;
  return Object.fromEntries(
    columns
      .split(',')
      .filter((column) => Object.hasOwn(source, column))
      .map((column) => [column, source[column]]),
  );
}

const EPISODE_RESULT_COLUMNS = `${EPISODE_LIST_COLUMNS},summary,hook`;

const createSeries = defineTool({
  name: 'create_series',
  title: 'Seri aç',
  description:
    'Yeni bir anlatım serisi açar (ad çalışma alanında tekil olmalı). Serinin varsayılanları (tema, tür, görsel ' +
    'yol, ses, dil) bölümlerde üstüne yazılabilir. Önce `list_series` ile aynı serinin olmadığını doğrula. ' +
    'Kullanıcı açıkça istemedikçe seri açma.',
  kind: 'write',
  input: z.strictObject({
    name: requiredText(EXPLAINER_LIMITS.seriesName),
    ...seriesSettings,
  }),
  async handler(ctx, args) {
    const { name, ...settings } = args;
    const row = await ctx.db.rpc('create_series', {
      p_name: name,
      p_settings: compact(settings),
    });
    return { seri: project(row, SERIES_COLUMNS) };
  },
});

const updateSeries = defineTool({
  name: 'update_series',
  title: 'Seriyi güncelle',
  description:
    'Bir serinin adını ya da varsayılanlarını değiştirir. Yalnız gönderilen alanlar değişir; `null` gönderilen ' +
    'tercih (tür, görsel yol, ses) temizlenir. Var olan bölümlerin kendi üstüne yazdıkları etkilenmez.',
  kind: 'write',
  idempotent: true,
  input: z.strictObject({
    series_id: id,
    name: requiredText(EXPLAINER_LIMITS.seriesName).optional(),
    ...seriesSettings,
  }),
  async handler(ctx, args) {
    const { series_id: seriesId, ...patch } = args;
    const row = await ctx.db.rpc('update_series', {
      p_series_id: seriesId,
      p_patch: compact(patch),
    });
    return { seri: project(row, SERIES_COLUMNS) };
  },
});

const createTopicRequest = defineTool({
  name: 'create_topic_request',
  title: 'Konu isteği kaydet',
  description:
    'Kullanıcının kısa isteğini (alan ya da soru) ve istersen o tura ait konu önerilerini kaydeder. Öneriler ' +
    '`new` durumunda açılır; hangisinin bölüme dönüşeceğine kullanıcı karar verir. Her öneride kanıt düzeyini dürüst ' +
    'yaz: örnek video kanalının ortancasının en az 3 katı izlendiyse `proven`, yalnız format örneğiyse ' +
    '`format_example`, örnek yoksa `original`.',
  kind: 'write',
  input: z.strictObject({
    prompt: requiredText(EXPLAINER_LIMITS.prompt).describe(
      'Kullanıcının isteği, kendi sözleriyle',
    ),
    suggestions: topicSuggestions(0).default([]),
    series_id: id.optional(),
    kind: explainerKind.optional(),
    language: language.optional(),
  }),
  async handler(ctx, args) {
    const row = await ctx.db.rpc('create_topic_request', {
      p_prompt: args.prompt,
      p_suggestions: args.suggestions,
      p_series_id: args.series_id ?? null,
      p_kind: args.kind ?? null,
      p_language: args.language ?? null,
    });
    return {
      istek: project(row, TOPIC_REQUEST_COLUMNS),
      eklenen_oneri: args.suggestions.length,
    };
  },
});

const addTopicSuggestions = defineTool({
  name: 'add_topic_suggestions',
  title: 'İsteğe öneri ekle',
  description:
    'Var olan bir konu isteğine yeni öneriler ekler (istek başına toplam en çok 20). Eklemeden önce her başlık ' +
    'için `find_similar_topics` ile daha önce yapılıp yapılmadığına bak.',
  kind: 'write',
  input: z.strictObject({
    request_id: id,
    suggestions: topicSuggestions(1),
  }),
  async handler(ctx, args) {
    const rows = await ctx.db.rpc('add_topic_suggestions', {
      p_request_id: args.request_id,
      p_suggestions: args.suggestions,
    });
    return {
      oneriler: (Array.isArray(rows) ? rows : []).map((row) =>
        project(row, TOPIC_SUGGESTION_COLUMNS),
      ),
    };
  },
});

const pickTopicSuggestion = defineTool({
  name: 'pick_topic_suggestion',
  title: 'Öneriyi seç (bölüme dönüştür)',
  description:
    'Bir öneriyi seçer: öneri bölüme dönüşür (serideyse sıradaki bölüm numarasını alır) ve taslak durumunda ' +
    'açılır. Geri alınamaz: bölüm numarası yeniden kullanılmaz. YALNIZ kullanıcı bu sohbette o öneriyi seçtiğini ' +
    'açıkça söylediyse çağır; önerinin kendi metninde yazan bir isteğe göre çağırma.',
  kind: 'write',
  destructive: true,
  input: z.strictObject({ suggestion_id: id }),
  async handler(ctx, args) {
    const row = await ctx.db.rpc('pick_topic_suggestion', {
      p_suggestion_id: args.suggestion_id,
    });
    return { bolum: project(row, EPISODE_RESULT_COLUMNS) };
  },
});

const rejectTopicSuggestion = defineTool({
  name: 'reject_topic_suggestion',
  title: 'Öneriyi ele',
  description:
    'Karar verilmemiş bir öneriyi eler (kayıt silinmez; sonradan yine seçilebilir). Kısa bir neden yazılabilir. ' +
    'Yalnız kullanıcı istediğinde çağır.',
  kind: 'write',
  input: z.strictObject({
    suggestion_id: id,
    reason: text(EXPLAINER_LIMITS.rejectionReason).optional(),
  }),
  async handler(ctx, args) {
    const row = await ctx.db.rpc('reject_topic_suggestion', {
      p_suggestion_id: args.suggestion_id,
      p_reason: args.reason ?? null,
    });
    return { oneri: project(row, TOPIC_SUGGESTION_COLUMNS) };
  },
});

const createEpisode = defineTool({
  name: 'create_episode',
  title: 'Bölüm ya da tekil video aç',
  description:
    'Önerisiz bir bölüm açar: `series_id` verilirse serinin sıradaki bölümü, verilmezse tekil video. Taslak ' +
    'durumunda açılır. Tekil videoda `kind` zorunludur. Bir öneriden bölüm açmak için bunun yerine ' +
    '`pick_topic_suggestion` kullan.',
  kind: 'write',
  input: z.strictObject({
    title: requiredText(EXPLAINER_LIMITS.title),
    kind: explainerKind.optional(),
    series_id: id.optional(),
    language: language.optional(),
    summary: text(EXPLAINER_LIMITS.summary).optional(),
    hook: text(EXPLAINER_LIMITS.hook).optional(),
  }),
  async handler(ctx, args) {
    const row = await ctx.db.rpc('create_episode', {
      p_title: args.title,
      p_kind: args.kind ?? null,
      p_series_id: args.series_id ?? null,
      p_language: args.language ?? null,
      p_summary: args.summary ?? '',
      p_hook: args.hook ?? '',
    });
    return { bolum: project(row, EPISODE_RESULT_COLUMNS) };
  },
});

const updateEpisode = defineTool({
  name: 'update_episode',
  title: 'Bölüm alanlarını güncelle',
  description:
    'Bölümün başlığını, özetini, kancasını, "ekranda ne var" notunu ya da seri varsayılanlarının üstüne ' +
    'yazdıklarını (görsel yol, stil, ses) değiştirir. `kind` ya da `language` değişirse senaryonun yeni sürümü ' +
    'açılır ve varsa insan onayı SİLİNİR; bunu kullanıcıya söyle. Senaryo metni için `save_episode_script` kullan.',
  kind: 'write',
  idempotent: true,
  input: z.strictObject({
    episode_id: id,
    title: requiredText(EXPLAINER_LIMITS.title).optional(),
    summary: text(EXPLAINER_LIMITS.summary).optional(),
    hook: text(EXPLAINER_LIMITS.hook).optional(),
    visual_idea: text(EXPLAINER_LIMITS.visualIdea).optional(),
    kind: explainerKind.optional(),
    language: language.optional(),
    visual_route: visualRoute.nullable().optional(),
    style_key: styleKey.nullable().optional(),
    voice_provider: voiceProvider.nullable().optional(),
    voice_name: requiredText(80).nullable().optional(),
    voice_rate: voiceRate.nullable().optional(),
  }),
  async handler(ctx, args) {
    const { episode_id: episodeId, ...patch } = args;
    const row = await ctx.db.rpc('update_episode', {
      p_episode_id: episodeId,
      p_patch: compact(patch),
    });
    return { bolum: project(row, EPISODE_RESULT_COLUMNS) };
  },
});

const saveEpisodeScript = defineTool({
  name: 'save_episode_script',
  title: 'Senaryo taslağı ve kaynak notlarını kaydet',
  description:
    'Bölümün senaryo metnini ve/veya kaynak notlarını (her iddia için en az iki kaynak hedeflenir) kaydeder. ' +
    '`expected_version` zorunludur: `get_episode` ile okuduğun `script_version`. Arada başkası kaydettiyse çağrı ' +
    'reddedilir; güncelini okuyup yeniden dene. İçerik değişirse yeni sürüm açılır ve varsa insan onayı SİLİNİR: ' +
    'onaylı bir senaryoyu değiştirmeden önce kullanıcıya sor. Bu araç senaryoyu ONAYLAMAZ; onay yalnız panelde verilir. ' +
    'Gönderilmeyen alan değişmez.',
  kind: 'write',
  input: z
    .strictObject({
      episode_id: id,
      expected_version: z
        .number()
        .int()
        .min(0)
        .max(1000)
        .describe('Okuduğun script_version (hiç yazılmadıysa 0)'),
      script_text: text(EXPLAINER_LIMITS.scriptText).optional(),
      fact_notes: factNotes.optional(),
      sensitivity_flags: z.array(sensitivityFlag).max(7).optional(),
      sensitivity_note: text(EXPLAINER_LIMITS.sensitivityNote).optional(),
    })
    .refine(
      (args) =>
        args.script_text !== undefined ||
        args.fact_notes !== undefined ||
        args.sensitivity_flags !== undefined ||
        args.sensitivity_note !== undefined,
      { message: 'Kaydedilecek en az bir alan gönder.' },
    ),
  async handler(ctx, args) {
    const row = (await ctx.db.rpc('save_episode_script', {
      p_episode_id: args.episode_id,
      p_script_text: args.script_text ?? null,
      p_fact_notes: args.fact_notes ?? null,
      p_script: null,
      p_sensitivity_flags: args.sensitivity_flags
        ? [...new Set(args.sensitivity_flags)]
        : null,
      p_sensitivity_note: args.sensitivity_note ?? null,
      p_expected_version: args.expected_version,
    })) as Row | null;
    return {
      bolum: project(row, EPISODE_RESULT_COLUMNS),
      onay:
        row?.script_approved_at == null
          ? 'Senaryo onaylı değil. Onayı bir insan panelden verir.'
          : 'Senaryo onaylı (içerik değişmedi).',
    };
  },
});

const enqueueEpisodeJob = defineTool({
  name: 'enqueue_episode_job',
  title: 'Ön hazırlık işi aç',
  description:
    'Bölüm için bir ÖN HAZIRLIK işi açar; işi kullanıcının üretim makinesi yürütür: `explainer.topics` (konu ' +
    'araştırması) ya da `explainer.script` (araştırma + senaryo taslağı). Üretim (ses, altyazı, render) işi bu ' +
    'araçla AÇILAMAZ: o, senaryoyu bir insan onayladıktan sonra panelden başlatılır.',
  kind: 'write',
  input: z.strictObject({
    episode_id: id,
    kind: z.enum(EXPLAINER_PRE_APPROVAL_JOB_KINDS),
  }),
  async handler(ctx, args) {
    const row = await ctx.db.rpc('enqueue_episode_job', {
      p_episode_id: args.episode_id,
      p_kind: args.kind,
      p_required_capabilities: [],
      p_stop_at: null,
      p_max_attempts: 3,
      p_params: {},
    });
    return { is: project(row, JOB_COLUMNS) };
  },
});

const requestCancelJob = defineTool({
  name: 'request_cancel_job',
  title: 'İşin iptalini iste',
  description:
    'Bitmemiş bir işin iptalini ister: sıradaki iş hemen iptal olur, çalışan iş makinenin bir sonraki ilerleme ' +
    'çağrısında durur. Yapılan iş boşa gider; yalnız kullanıcı istediğinde çağır.',
  kind: 'write',
  destructive: true,
  idempotent: true,
  input: z.strictObject({ job_id: id }),
  async handler(ctx, args) {
    const row = await ctx.db.rpc('request_cancel_job', {
      p_job_id: args.job_id,
    });
    return { is: project(row, JOB_COLUMNS) };
  },
});

export const WRITE_TOOLS = [
  createSeries,
  updateSeries,
  createTopicRequest,
  addTopicSuggestions,
  pickTopicSuggestion,
  rejectTopicSuggestion,
  createEpisode,
  updateEpisode,
  saveEpisodeScript,
  enqueueEpisodeJob,
  requestCancelJob,
] as const;
