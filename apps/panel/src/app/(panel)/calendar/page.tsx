import { requireTeamMember } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { getContentWorkspace } from '@/lib/content/queries';
import { calendarQuerySchema } from '@/lib/content/schemas';
import { calendarRange, localInput } from '@/lib/content/schedule-rules';
import { CalendarView } from './view';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    inf?: string;
    page?: string;
    date?: string;
    view?: string;
    tz?: string;
  }>;
}) {
  const [member, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const parsed = calendarQuerySchema.safeParse(params);
  if (!parsed.success) notFound();
  const { tz: timezone, view, page } = parsed.data;
  const today = localInput(new Date().toISOString(), timezone).slice(0, 10);
  const day = parsed.data.date ?? today;
  const range = calendarRange(day, view, timezone);
  const workspace = await getContentWorkspace({
    slug: parsed.data.inf,
    page,
    role: member.role,
    from: range.from,
    to: range.to,
  });
  return (
    <CalendarView
      workspace={workspace}
      day={day}
      view={view}
      timezone={timezone}
      range={range}
    />
  );
}
