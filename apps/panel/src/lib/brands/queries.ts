import 'server-only';
import type { Row } from '@ai-influencer/shared';
import { todayIso } from '@/lib/costs/period';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  buildRevenueReport,
  monthBounds,
  monthRange,
  type RevenueReport,
} from './revenue';
import {
  readBrief,
  readDeliverables,
  type Brief,
  type Deliverable,
  type DealStage,
} from './schemas';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(`Marka verisi alınamadı: ${error.message}`);
}

const dec = (value: number | string | null) =>
  value === null ? null : String(value);

export const REVENUE_MONTHS = 6;

export type InfluencerOption = Pick<Row<'influencers'>, 'id' | 'name' | 'slug'>;

export type DealCard = {
  id: string;
  brandId: string;
  brandName: string;
  influencerId: string;
  influencerName: string;
  stage: DealStage;
  fee: string | null;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
};

export type BrandListItem = Pick<
  Row<'brands'>,
  'id' | 'name' | 'website' | 'contact_name' | 'contact_email' | 'notes'
> & { dealCount: number; openDealCount: number };

export type BrandsOverview = {
  influencers: InfluencerOption[];
  influencer: InfluencerOption | null;
  brands: BrandListItem[];
  deals: DealCard[];
  currency: string;
  revenue: RevenueReport;
};

async function listInfluencers(supabase: Supabase) {
  const { data, error } = await supabase
    .from('influencers')
    .select('id, name, slug')
    .neq('status', 'archived')
    .order('name');
  throwOnError(error);
  return data ?? [];
}

/** Ödeme aylarına göre gelir ve aynı ayların maliyeti (hedef para biriminde). */
export async function getRevenueReport(
  supabase: Supabase,
  input: { lastMonth: string; currency: string; influencerId?: string },
): Promise<RevenueReport> {
  const months = monthRange(input.lastMonth, REVENUE_MONTHS);
  const from = monthBounds(months[0]!).from;
  const to = monthBounds(months.at(-1)!).to;
  const [revenue, ...costs] = await Promise.all([
    supabase.rpc('brand_deal_revenue', {
      p_from: from,
      p_to: to,
      p_currency: input.currency,
      p_influencer_id: input.influencerId,
    }),
    ...months.map((month) =>
      supabase
        .rpc('cost_summary', {
          p_from: monthBounds(month).from,
          p_to: monthBounds(month).to,
          p_currency: input.currency,
          p_influencer_id: input.influencerId,
        })
        .single(),
    ),
  ]);
  throwOnError(revenue.error);
  for (const result of costs) throwOnError(result.error);
  return buildRevenueReport({
    months,
    // brand_deal_revenue yalnız ödenmiş deal'leri döndürür
    deals: (revenue.data ?? []).map((row) => ({
      id: row.id,
      stage: 'paid' as const,
      paid_at: row.paid_at,
      fee: dec(row.fee),
      converted_fee: dec(row.converted_fee),
    })),
    costs: months.map((month, index) => {
      const summary = costs[index]?.data;
      return {
        month,
        total: dec(summary?.total ?? null),
        missingRateCount: summary?.missing_rate_count ?? 0,
      };
    }),
  });
}

export async function getBrandsOverview(input: {
  influencerSlug?: string;
  currency: string;
  lastMonth?: string;
}): Promise<BrandsOverview> {
  const supabase = await createSupabaseServerClient();
  const influencers = await listInfluencers(supabase);
  const influencer =
    influencers.find((item) => item.slug === input.influencerSlug) ?? null;

  let dealQuery = supabase
    .from('brand_deals')
    .select(
      'id, brand_id, influencer_id, stage, fee, currency, due_date, paid_at, updated_at, brands(name), influencers(name)',
    )
    .order('updated_at', { ascending: false })
    .limit(500);
  if (influencer) dealQuery = dealQuery.eq('influencer_id', influencer.id);

  const [brands, deals, revenue] = await Promise.all([
    supabase
      .from('brands')
      .select(
        'id, name, website, contact_name, contact_email, notes, brand_deals(stage)',
      )
      .order('name')
      .limit(500),
    dealQuery,
    getRevenueReport(supabase, {
      lastMonth: input.lastMonth ?? todayIso().slice(0, 7),
      currency: input.currency,
      influencerId: influencer?.id,
    }),
  ]);
  throwOnError(brands.error);
  throwOnError(deals.error);

  return {
    influencers,
    influencer,
    currency: input.currency,
    revenue,
    brands: (brands.data ?? []).map(({ brand_deals, ...brand }) => ({
      ...brand,
      dealCount: brand_deals.length,
      openDealCount: brand_deals.filter(
        (deal) => deal.stage !== 'paid' && deal.stage !== 'lost',
      ).length,
    })),
    deals: (deals.data ?? []).map((deal) => ({
      id: deal.id,
      brandId: deal.brand_id,
      brandName: deal.brands?.name ?? '—',
      influencerId: deal.influencer_id,
      influencerName: deal.influencers?.name ?? '—',
      stage: deal.stage,
      fee: dec(deal.fee),
      currency: deal.currency,
      dueDate: deal.due_date,
      paidAt: deal.paid_at,
    })),
  };
}

export type DealDetail = {
  deal: DealCard & {
    notes: string;
    brief: Brief;
    deliverables: Deliverable[];
    updatedAt: string;
    influencerSlug: string;
  };
  brand: Pick<
    Row<'brands'>,
    'id' | 'name' | 'website' | 'contact_name' | 'contact_email' | 'notes'
  >;
  linkedContent: Array<{
    contentItemId: string;
    title: string;
    stage: string;
    scheduledAt: string | null;
  }>;
  availableContent: Array<{ id: string; title: string; stage: string }>;
  files: Array<
    Pick<
      Row<'brand_deal_files'>,
      | 'id'
      | 'storage_path'
      | 'file_name'
      | 'mime_type'
      | 'file_size_bytes'
      | 'created_at'
    >
  >;
};

export async function getDealDetail(id: string): Promise<DealDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: deal, error } = await supabase
    .from('brand_deals')
    .select(
      '*, brands(id, name, website, contact_name, contact_email, notes), influencers(name, slug)',
    )
    .eq('id', id)
    .maybeSingle();
  throwOnError(error);
  if (!deal || !deal.brands) return null;

  const [links, content, files] = await Promise.all([
    supabase
      .from('brand_deal_content_items')
      .select('content_item_id, content_items(title, stage, scheduled_at)')
      .eq('brand_deal_id', id)
      .order('created_at'),
    supabase
      .from('content_items')
      .select('id, title, stage')
      .eq('influencer_id', deal.influencer_id)
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('brand_deal_files')
      .select(
        'id, storage_path, file_name, mime_type, file_size_bytes, created_at',
      )
      .eq('brand_deal_id', id)
      .order('created_at', { ascending: false }),
  ]);
  throwOnError(links.error);
  throwOnError(content.error);
  throwOnError(files.error);

  const linked = (links.data ?? []).map((link) => ({
    contentItemId: link.content_item_id,
    title: link.content_items?.title ?? '—',
    stage: link.content_items?.stage ?? '',
    scheduledAt: link.content_items?.scheduled_at ?? null,
  }));
  const linkedIds = new Set(linked.map((item) => item.contentItemId));

  return {
    deal: {
      id: deal.id,
      brandId: deal.brand_id,
      brandName: deal.brands.name,
      influencerId: deal.influencer_id,
      influencerName: deal.influencers?.name ?? '—',
      influencerSlug: deal.influencers?.slug ?? '',
      stage: deal.stage,
      fee: dec(deal.fee),
      currency: deal.currency,
      dueDate: deal.due_date,
      paidAt: deal.paid_at,
      notes: deal.notes,
      brief: readBrief(deal.brief),
      deliverables: readDeliverables(deal.deliverables),
      updatedAt: deal.updated_at,
    },
    brand: deal.brands,
    linkedContent: linked,
    availableContent: (content.data ?? []).filter(
      (item) => !linkedIds.has(item.id),
    ),
    files: files.data ?? [],
  };
}

/** Deal görünüyor mu (RLS). Layout'ta, sayfa stream edilmeden önce 404 için. */
export async function dealExists(id: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('brand_deals')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  throwOnError(error);
  return data !== null;
}
