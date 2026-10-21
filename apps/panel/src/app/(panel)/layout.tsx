import { PanelShell } from '@/components/panel-shell';
import { requireTeamMember } from '@/lib/auth';

// Her istek oturuma göre render edilir; korumalı sayfalar statik üretilmez
export const dynamic = 'force-dynamic';

export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, role } = await requireTeamMember();
  return (
    <PanelShell member={{ email: user.email ?? '', role }}>
      {children}
    </PanelShell>
  );
}
