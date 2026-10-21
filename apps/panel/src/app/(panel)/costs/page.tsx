import { requireTeamMember } from '@/lib/auth';
import { parseMonth, todayIso } from '@/lib/costs/period';
import { getCostOverview } from '@/lib/costs/queries';
import { supportedCurrencies } from '@/lib/costs/schemas';
import { CostsView } from './costs-view';

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; cur?: string; inf?: string }>;
}) {
  const [member, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const period = parseMonth(params.month, todayIso());
  const currency = (supportedCurrencies as readonly string[]).includes(
    params.cur ?? '',
  )
    ? (params.cur as string)
    : 'USD';
  const overview = await getCostOverview({
    period,
    currency,
    influencerSlug: params.inf,
  });
  return <CostsView overview={overview} role={member.role} />;
}
