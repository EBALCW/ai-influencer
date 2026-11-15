// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EPISODE_STATUSES,
  EPISODE_STATUS_LABELS,
  EVIDENCE_LEVELS,
  EXPLAINER_KINDS,
  EXPLAINER_LIMITS,
  EXPLAINER_PRE_APPROVAL_JOB_KINDS,
  EXPLAINER_PRODUCTION_CAPABILITY_PREFIXES,
  JOB_KINDS,
  SENSITIVITY_FLAGS,
  SERIES_STATUSES,
  TOPIC_SUGGESTION_STATUSES,
  VISUAL_ROUTES,
  VISUAL_ROUTE_CAPABILITY,
  WORKER_CAPABILITIES,
  canApproveScript,
  canEditScript,
  canMoveEpisode,
  canStartProduction,
  episodeLabel,
  hasFactGaps,
  isEpisodeStatus,
  isEvidenceLevel,
  isExplainerKind,
  isPreApprovalCapability,
  isVisualRoute,
  requiresApprovedScript,
  topicKey,
  unsourcedClaimCount,
  type JobKind,
} from '@ai-influencer/shared';
import {
  episodePatchSchema,
  seriesPatchSchema,
  seriesSettingsSchema,
  topicSuggestionSchema,
} from './schemas';

// Listeler sonraki migration'larda yeniden tanımlanabilir; her biri için EN SON tanım denetlenir.
const migrationsDir = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../../supabase/migrations',
);
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(migrationsDir, name), 'utf8'));

function lastMatch(pattern: RegExp): string {
  const match = migrations
    .map((sql) => sql.match(pattern))
    .filter((found) => found !== null)
    .at(-1);
  expect(match, `migration'da bulunamadı: ${pattern}`).toBeDefined();
  return match![1]!;
}

function sqlList(pattern: RegExp): string[] {
  return [...lastMatch(pattern).matchAll(/'([a-z0-9_.]+)'/g)].map((m) => m[1]!);
}

describe('anlatım sabitleri migration ile aynı', () => {
  it.each([
    [
      'tür (seri)',
      EXPLAINER_KINDS,
      /series_kind_known CHECK \(kind IS NULL OR kind IN \(([^)]*)\)\)/,
    ],
    [
      'tür (istek)',
      EXPLAINER_KINDS,
      /topic_requests_kind_known CHECK \(kind IS NULL OR kind IN \(([^)]*)\)\)/,
    ],
    [
      'tür (öneri)',
      EXPLAINER_KINDS,
      /topic_suggestions_kind_known CHECK \(kind IN \(([^)]*)\)\)/,
    ],
    [
      'tür (bölüm)',
      EXPLAINER_KINDS,
      /episodes_kind_known CHECK \(kind IN \(([^)]*)\)\)/,
    ],
    [
      'görsel yol (seri)',
      VISUAL_ROUTES,
      /series_visual_route_known\s+CHECK \(visual_route IS NULL OR visual_route IN \(([^)]*)\)\)/,
    ],
    [
      'görsel yol (bölüm)',
      VISUAL_ROUTES,
      /episodes_visual_route_known\s+CHECK \(visual_route IS NULL OR visual_route IN \(([^)]*)\)\)/,
    ],
    [
      'kanıt düzeyi',
      EVIDENCE_LEVELS,
      /topic_suggestions_evidence_level_known\s+CHECK \(evidence_level IN \(([^)]*)\)\)/,
    ],
    [
      'seri durumu',
      SERIES_STATUSES,
      /series_status_known CHECK \(status IN \(([^)]*)\)\)/,
    ],
    [
      'öneri durumu',
      TOPIC_SUGGESTION_STATUSES,
      /topic_suggestions_status_known CHECK \(status IN \(([^)]*)\)\)/,
    ],
    [
      'bölüm durumu',
      EPISODE_STATUSES,
      /episodes_status_known CHECK \(\s*status IN \(([^)]*)\)/,
    ],
    [
      'hassasiyet işaretleri',
      SENSITIVITY_FLAGS,
      /sensitivity_flags <@ ARRAY\[([^\]]*)\]/,
    ],
    [
      'onay istemeyen iş türleri',
      EXPLAINER_PRE_APPROVAL_JOB_KINDS,
      /FUNCTION private\.explainer_pre_approval_kinds\(\)[\s\S]*?SELECT ARRAY\[([^\]]*)\]/,
    ],
  ] as const)('%s', (_name, list, pattern) => {
    expect(sqlList(pattern)).toEqual([...list]);
  });

  it('hesaplanan her bölüm durumu episode_status() içinde üretilir', () => {
    const body = lastMatch(
      /FUNCTION private\.episode_status\(e public\.episodes\)([\s\S]*?)\n\$\$;/,
    );
    const produced = new Set(
      [...body.matchAll(/(?:RETURN|THEN) '([a-z_]+)'/g)].map((m) => m[1]),
    );
    produced.add(lastMatch(/\n\s+\),\n\s+'(script_approved)'\n\s+\);/));
    expect([...produced].sort()).toEqual([...EPISODE_STATUSES].sort());
    for (const status of EPISODE_STATUSES) {
      expect(EPISODE_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('boyut sınırları CHECK kısıtlarıyla aynı', () => {
    const sql = migrations
      .filter((m) => m.includes('TABLE public.episodes'))
      .at(-1)!;
    const L = EXPLAINER_LIMITS;
    expect(sql).toContain(
      `name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND ${L.seriesName} AND length(name) <= ${L.seriesName})`,
    );
    expect(sql).toContain(`CHECK (length(theme) <= ${L.theme})`);
    expect(sql).toContain(
      `prompt text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND ${L.prompt} AND length(prompt) <= ${L.prompt})`,
    );
    expect(sql).toContain(
      `title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND ${L.title} AND length(title) <= ${L.title})`,
    );
    expect(sql).toContain(`CHECK (length(summary) <= ${L.summary})`);
    expect(sql).toContain(`CHECK (length(hook) <= ${L.hook})`);
    expect(sql).toContain(`CHECK (length(visual_idea) <= ${L.visualIdea})`);
    expect(sql).toContain(`CHECK (length(script_text) <= ${L.scriptText})`);
    expect(sql).toContain(`jsonb_array_length(p_notes) > ${L.factNotes}`);
    expect(sql).toContain(`NOT BETWEEN 1 AND ${L.claim}`);
    expect(sql).toContain(
      `jsonb_array_length(COALESCE(n.note -> 'sources', '[]'::jsonb)) > ${L.sourcesPerClaim}`,
    );
    expect(sql).toContain("!~ '^https?://[^[:space:]]+$'");
    expect(sql).toContain(`v_existing + v_count > ${L.suggestionsPerRequest}`);
    expect(sql).toContain(
      `jsonb_array_length(source_candidates) <= ${L.sourceCandidates}`,
    );
    expect(sql).toContain(`length(sensitivity_note) <= ${L.sensitivityNote})`);
    expect(sql).toContain(`length(rejection_reason) <= ${L.rejectionReason})`);
  });
});

describe('şemaların alanları RPC çekirdeklerinin kabul ettiği alanlarla aynı', () => {
  const allowed = (fn: string, variable: string) =>
    sqlList(
      new RegExp(
        `FUNCTION internal\\.${fn}\\([\\s\\S]*?assert_patch\\(${variable}, ARRAY\\[([^\\]]*)\\]`,
      ),
    ).sort();

  it('seri ayarları (create_series)', () => {
    expect(Object.keys(seriesSettingsSchema.shape).sort()).toEqual(
      allowed('create_series', 'v_set'),
    );
  });

  it('seri yaması (update_series)', () => {
    expect(Object.keys(seriesPatchSchema.shape).sort()).toEqual(
      allowed('update_series', 'p_patch'),
    );
  });

  it('bölüm yaması (update_episode)', () => {
    expect(Object.keys(episodePatchSchema.shape).sort()).toEqual(
      allowed('update_episode', 'p_patch'),
    );
  });

  it('öneri alanları (insert_topic_suggestions)', () => {
    const fields = sqlList(
      /FUNCTION private\.insert_topic_suggestions[\s\S]*?v_allowed constant text\[\] := ARRAY\[([^\]]*)\]/,
    ).sort();
    expect(Object.keys(topicSuggestionSchema.shape).sort()).toEqual(fields);
  });
});

describe('görsel yollar ve iş türleri', () => {
  it('yolun yeteneği bilinen bir makine yeteneğidir', () => {
    for (const route of VISUAL_ROUTES) {
      const capability = VISUAL_ROUTE_CAPABILITY[route];
      if (capability === null) continue;
      expect(WORKER_CAPABILITIES as readonly string[]).toContain(capability);
      expect(capability).toBe(`render.${route}`);
    }
    expect(VISUAL_ROUTE_CAPABILITY.skia).toBe('render.skia');
    expect(VISUAL_ROUTE_CAPABILITY.stock).toBeNull();
  });

  it('explainer.* aşamaları veritabanındaki sabit tanımla birebir aynı', () => {
    const body = lastMatch(
      /FUNCTION private\.explainer_job_stages\(p_kind text\)([\s\S]*?)\n\$\$;/,
    );
    const fromSql = Object.fromEntries(
      [
        ...body.matchAll(
          /WHEN '(explainer\.[a-z_]+)' THEN '(\[[^']*\])'::jsonb/g,
        ),
      ].map((m) => [m[1]!, JSON.parse(m[2]!) as unknown]),
    );
    const fromTs = Object.fromEntries(
      (Object.keys(JOB_KINDS) as JobKind[])
        .filter((kind) => JOB_KINDS[kind].module === 'explainer')
        .map((kind) => [
          kind,
          JOB_KINDS[kind].stages.map((stage) => ({
            key: stage.key,
            requires_approval:
              'requires_approval' in stage ? stage.requires_approval : false,
          })),
        ]),
    );
    expect(Object.keys(fromSql).length).toBeGreaterThan(0);
    expect(fromSql).toEqual(fromTs);
  });

  it('ön hazırlık işi üretim yeteneği isteyemez (veritabanıyla aynı önekler)', () => {
    const pattern = lastMatch(
      /FUNCTION private\.explainer_pre_approval_capabilities_ok[\s\S]*?~ '\^\(([a-z|]+)\)/,
    );
    expect(pattern.split('|')).toEqual([
      ...EXPLAINER_PRODUCTION_CAPABILITY_PREFIXES,
    ]);
    const allowed = WORKER_CAPABILITIES.filter(isPreApprovalCapability);
    expect(allowed).toEqual(['fetch.youtube']);
    for (const kind of EXPLAINER_PRE_APPROVAL_JOB_KINDS) {
      for (const stage of JOB_KINDS[kind].stages) {
        expect(['research', 'draft']).toContain(stage.key);
        expect('requires_approval' in stage).toBe(false);
      }
    }
  });

  it('onay istemeyen türler tanımlı iş türleridir; üretim türünün son aşaması video onayıdır', () => {
    const kinds = Object.keys(JOB_KINDS) as JobKind[];
    for (const kind of EXPLAINER_PRE_APPROVAL_JOB_KINDS) {
      expect(kinds).toContain(kind);
      expect(requiresApprovedScript(kind)).toBe(false);
    }
    for (const kind of kinds) {
      if (!requiresApprovedScript(kind)) continue;
      expect(JOB_KINDS[kind].module).toBe('explainer');
      expect(JOB_KINDS[kind].stages.at(-1)).toMatchObject({
        requires_approval: true,
      });
    }
    expect(requiresApprovedScript('explainer.render')).toBe(true);
    expect(requiresApprovedScript('explainer.yeni_tur')).toBe(true);
    expect(requiresApprovedScript('clip.cut')).toBe(false);
  });
});

describe('durum yardımcıları', () => {
  it('senaryo düzenleme, onay, üretim ve taşıma kuralları', () => {
    expect(EPISODE_STATUSES.filter(canEditScript)).toEqual([
      'draft',
      'script_ready',
      'script_approved',
      'approved',
    ]);
    expect(EPISODE_STATUSES.filter(canApproveScript)).toEqual(['script_ready']);
    expect(EPISODE_STATUSES.filter(canStartProduction)).toEqual([
      'script_approved',
      'approved',
    ]);
    expect(EPISODE_STATUSES.filter(canMoveEpisode)).toEqual([
      'draft',
      'script_ready',
      'script_approved',
    ]);
  });

  it('tür denetimleri bilinmeyen değeri reddeder', () => {
    expect(isExplainerKind('event')).toBe(true);
    expect(isExplainerKind('vlog')).toBe(false);
    expect(isVisualRoute('blender')).toBe(true);
    expect(isVisualRoute('veo')).toBe(false);
    expect(isEvidenceLevel('proven')).toBe(true);
    expect(isEvidenceLevel('viral')).toBe(false);
    expect(isEpisodeStatus('ready_for_review')).toBe(true);
    expect(isEpisodeStatus('done')).toBe(false);
  });

  it('bölüm etiketi: seride numara, tekil videoda yok', () => {
    expect(episodeLabel(3)).toBe('Bölüm 3');
    expect(episodeLabel(null)).toBeNull();
  });
});

describe('kaynak notları', () => {
  it('iki kaynaktan azı olan iddia eksik sayılır', () => {
    const notes = [
      { claim: 'a', sources: [{ title: 'x' }, { title: 'y' }] },
      { claim: 'b', sources: [{ title: 'x' }] },
      { claim: 'c' },
    ];
    expect(unsourcedClaimCount(notes)).toBe(2);
    expect(hasFactGaps(notes)).toBe(true);
    expect(hasFactGaps([notes[0]!])).toBe(false);
    expect(hasFactGaps([])).toBe(true);
  });
});

describe('topicKey', () => {
  it('veritabanındaki internal.topic_key ile aynı sonucu verir (pgTAP aynı örneği denetler)', () => {
    expect(topicKey('  PLANÖR: Motorsuz, nasıl UÇAR?  İIŞĞÜÖÇ ışğüöç ')).toBe(
      'planor motorsuz nasil ucar iisguoc isguoc',
    );
    expect(topicKey('Mağarada 17 gün: Tham Luang kurtarması')).toBe(
      'magarada 17 gun tham luang kurtarmasi',
    );
    expect(topicKey('   ')).toBe('');
  });

  it('SQL tanımındaki harf eşlemesi aynıdır', () => {
    const sql = migrations
      .filter((m) => m.includes('FUNCTION internal.topic_key'))
      .at(-1)!;
    const found = sql.match(
      /translate\(left\(.*?, 300\), '([^']+)', '([^']+)'\)/,
    );
    expect(found).not.toBeNull();
    const from = Array.from(found![1]!);
    const to = Array.from(found![2]!);
    expect(from.length).toBe(to.length);
    from.forEach((char, index) => {
      expect(topicKey(char), char).toBe(to[index]);
    });
  });
});
