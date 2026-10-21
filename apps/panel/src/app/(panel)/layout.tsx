import { PanelShell } from '@/components/panel-shell';
import { requireTeamMember } from '@/lib/auth';
import { getInfluencerOptions } from '@/lib/influencers';

// Her istek oturuma göre render edilir; korumalı sayfalar statik üretilmez
export const dynamic = 'force-dynamic';

export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [{ user, role }, influencers] = await Promise.all([
    requireTeamMember(),
    getInfluencerOptions(),
  ]);
  return (
    <PanelShell
      member={{ email: user.email ?? '', role }}
      influencers={influencers}
    >
      {children}
    </PanelShell>
  );
}
