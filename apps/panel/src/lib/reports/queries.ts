import 'server-only';
import type { Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  parseReportSummary,
  type ReportPeriod,
  type ReportSummary,
} from './weekly';

type Influencer = Pick<Row<'influencers'>, 'id' | 'name' | 'slug'>;

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(`Rapor verisi alınamadı: ${error.message}`);
}

export type SavedReport = {
  id: string;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  hasAiSummary: boolean;
};

export type ReportsOverview = {
  period: ReportPeriod;
  influencer: Influencer | null;
  summary: ReportSummary | null;
  saved: SavedReport[];
  /** Seçili haftanın kayıtlı raporu (varsa) */
  current: SavedReport | null;
};

export async function getReportsOverview(input: {
  period: ReportPeriod;
  influencerSlug?: string;
}): Promise<ReportsOverview> {
  const db = await createSupabaseServerClient();
  let influencer: Influencer | null = null;
  if (input.influencerSlug) {
    const { data, error } = await db
      .from('influencers')
      .select('id, name, slug')
      .eq('slug', input.influencerSlug)
      .maybeSingle();
    throwOnError(error);
    influencer = data;
  }

  let savedQuery = db
    .from('reports')
    .select('id, period_start, period_end, updated_at, ai_summary')
    .order('period_start', { ascending: false })
    .limit(12);
  savedQuery = influencer
    ? savedQuery.eq('influencer_id', influencer.id)
    : savedQuery.is('influencer_id', null);

  const [summary, saved] = await Promise.all([
    db.rpc('report_summary', {
      p_from: input.period.from,
      p_to: input.period.to,
      ...(influencer ? { p_influencer_id: influencer.id } : {}),
    }),
    savedQuery,
  ]);
  throwOnError(summary.error);
  throwOnError(saved.error);

  const list = (saved.data ?? []).map((row) => ({
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    updatedAt: row.updated_at,
    hasAiSummary: !!row.ai_summary,
  }));
  return {
    period: input.period,
    influencer,
    summary: parseReportSummary(summary.data),
    saved: list,
    current:
      input.period.kind === 'week'
        ? (list.find((row) => row.periodStart === input.period.from) ?? null)
        : null,
  };
}

export type ReportDetail = {
  id: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
  automatic: boolean;
  aiSummary: string | null;
  /** Gelecek hafta için 1–3 aksiyon (#24) */
  actions: string[];
  influencer: Influencer | null;
  summary: ReportSummary | null;
};

export async function getReport(id: string): Promise<ReportDetail | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from('reports')
    .select(
      'id, period_start, period_end, summary, ai_summary, actions, created_at, updated_at, created_by, influencers(id, name, slug)',
    )
    .eq('id', id)
    .maybeSingle();
  throwOnError(error);
  if (!data) return null;
  const influencer = Array.isArray(data.influencers)
    ? (data.influencers[0] ?? null)
    : data.influencers;
  return {
    id: data.id,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    // Zamanlanmış iş oturumsuz çalışır; created_by boş kalır
    automatic: data.created_by === null,
    aiSummary: data.ai_summary,
    actions: data.actions ?? [],
    influencer: influencer ?? null,
    summary: parseReportSummary(data.summary),
  };
}
