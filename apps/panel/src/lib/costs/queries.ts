import 'server-only';
import type { Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MonthPeriod } from './period';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(`Maliyet verisi alınamadı: ${error.message}`);
}

/** Supabase numeric'i number veya string döndürebilir; gösterim katmanı string bekler. */
const dec = (value: number | string | null | undefined) =>
  value === null || value === undefined ? null : String(value);

export type CostSummary = {
  total: string | null;
  entryCount: number;
  missingRateCount: number;
  videoCount: number;
  views: number;
  costPerVideo: string | null;
  costPer1000Views: string | null;
  generationCount: number;
  failedGenerationCount: number;
  failedRatio: string | null;
  failedCredits: string;
  failedCost: string | null;
};

export type BudgetStatus = {
  budgetId: string;
  influencerId: string | null;
  influencerName: string | null;
  month: string;
  amount: string;
  currency: string;
  warnRatio: string;
  spent: string | null;
  missingRateCount: number;
  ratio: string | null;
};

export type CostOverview = {
  period: MonthPeriod;
  currency: string;
  influencer: Pick<Row<'influencers'>, 'id' | 'name' | 'slug'> | null;
  summary: CostSummary;
  daily: Array<{ day: string; total: string | null; missing: number }>;
  byCategory: Array<{
    category: string;
    total: string | null;
    missing: number;
  }>;
  budgets: BudgetStatus[];
  recent: Array<
    Pick<
      Row<'costs'>,
      'id' | 'category' | 'description' | 'currency' | 'incurred_on'
    > & { amount: string; influencerName: string }
  >;
  influencers: Array<Pick<Row<'influencers'>, 'id' | 'name' | 'slug'>>;
  exchangeRates: Array<
    Pick<
      Row<'exchange_rates'>,
      'id' | 'currency' | 'base_currency' | 'valid_on'
    > & {
      rate: string;
    }
  >;
  creditRates: Array<
    Pick<Row<'credit_rates'>, 'id' | 'tool' | 'currency' | 'valid_from'> & {
      ratePerCredit: string;
    }
  >;
};

export async function getCostOverview(input: {
  period: MonthPeriod;
  currency: string;
  influencerSlug?: string;
}): Promise<CostOverview> {
  const supabase = await createSupabaseServerClient();
  const influencers = await listInfluencers(supabase);
  const influencer =
    influencers.find((item) => item.slug === input.influencerSlug) ?? null;
  const args = {
    p_from: input.period.from,
    p_to: input.period.to,
    p_currency: input.currency,
    p_influencer_id: influencer?.id ?? undefined,
  };

  const [summary, daily, byCategory, budgets, recent, fx, credit] =
    await Promise.all([
      supabase.rpc('cost_summary', args).single(),
      supabase.rpc('cost_daily', args),
      supabase.rpc('cost_by_category', args),
      supabase.rpc('budget_status', { p_month: input.period.from }),
      recentQuery(supabase, input.period, influencer?.id),
      supabase
        .from('exchange_rates')
        .select('id, currency, base_currency, rate, valid_on')
        .order('valid_on', { ascending: false })
        .limit(20),
      supabase
        .from('credit_rates')
        .select('id, tool, currency, rate_per_credit, valid_from')
        .order('valid_from', { ascending: false })
        .limit(20),
    ]);
  for (const result of [
    summary,
    daily,
    byCategory,
    budgets,
    recent,
    fx,
    credit,
  ])
    throwOnError(result.error);

  const names = new Map(influencers.map((item) => [item.id, item.name]));
  const s = summary.data;

  return {
    period: input.period,
    currency: input.currency,
    influencer,
    summary: {
      total: dec(s?.total),
      entryCount: s?.entry_count ?? 0,
      missingRateCount: s?.missing_rate_count ?? 0,
      videoCount: s?.video_count ?? 0,
      views: Number(s?.views ?? 0),
      costPerVideo: dec(s?.cost_per_video),
      costPer1000Views: dec(s?.cost_per_1000_views),
      generationCount: s?.generation_count ?? 0,
      failedGenerationCount: s?.failed_generation_count ?? 0,
      failedRatio: dec(s?.failed_ratio),
      failedCredits: dec(s?.failed_credits) ?? '0',
      failedCost: dec(s?.failed_cost),
    },
    daily: (daily.data ?? []).map((row) => ({
      day: row.day,
      total: dec(row.total),
      missing: row.missing_rate_count,
    })),
    byCategory: (byCategory.data ?? []).map((row) => ({
      category: row.category,
      total: dec(row.total),
      missing: row.missing_rate_count,
    })),
    budgets: (budgets.data ?? [])
      .filter(
        (row) =>
          !influencer ||
          row.influencer_id === influencer.id ||
          row.influencer_id === null,
      )
      .map((row) => ({
        budgetId: row.budget_id,
        influencerId: row.influencer_id,
        influencerName: row.influencer_id
          ? (names.get(row.influencer_id) ?? null)
          : null,
        month: row.month,
        amount: String(row.amount),
        currency: row.currency,
        warnRatio: String(row.warn_ratio),
        spent: dec(row.spent),
        missingRateCount: row.missing_rate_count,
        ratio: dec(row.ratio),
      })),
    recent: (recent.data ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description,
      currency: row.currency,
      incurred_on: row.incurred_on,
      amount: String(row.amount),
      influencerName: names.get(row.influencer_id) ?? '—',
    })),
    influencers,
    exchangeRates: (fx.data ?? []).map((row) => ({
      id: row.id,
      currency: row.currency,
      base_currency: row.base_currency,
      valid_on: row.valid_on,
      rate: String(row.rate),
    })),
    creditRates: (credit.data ?? []).map((row) => ({
      id: row.id,
      tool: row.tool,
      currency: row.currency,
      valid_from: row.valid_from,
      ratePerCredit: String(row.rate_per_credit),
    })),
  };
}

async function listInfluencers(supabase: Supabase) {
  const { data, error } = await supabase
    .from('influencers')
    .select('id, name, slug')
    .neq('status', 'archived')
    .order('name');
  throwOnError(error);
  return data ?? [];
}

function recentQuery(
  supabase: Supabase,
  period: MonthPeriod,
  influencerId: string | undefined,
) {
  let query = supabase
    .from('costs')
    .select(
      'id, influencer_id, category, description, amount, currency, incurred_on',
    )
    .gte('incurred_on', period.from)
    .lte('incurred_on', period.to)
    .order('incurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);
  if (influencerId) query = query.eq('influencer_id', influencerId);
  return query;
}
