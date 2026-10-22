import { requireTeamMember } from '@/lib/auth';
import { getBrandsOverview } from '@/lib/brands/queries';
import { dealCurrencies } from '@/lib/brands/schemas';
import { parseMonth, todayIso } from '@/lib/costs/period';
import { BrandsView } from './brands-view';

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string; cur?: string; month?: string }>;
}) {
  const [member, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const currency = (dealCurrencies as readonly string[]).includes(
    params.cur ?? '',
  )
    ? (params.cur as string)
    : 'USD';
  const month = parseMonth(params.month, todayIso()).month;
  const overview = await getBrandsOverview({
    influencerSlug: params.inf,
    currency,
    lastMonth: month,
  });
  return <BrandsView overview={overview} role={member.role} month={month} />;
}
