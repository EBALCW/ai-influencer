import type { Metadata } from 'next';
import { PanelShell } from '@/components/panel-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Influencer Studio',
  description: 'AI influencer yönetim paneli',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        <PanelShell>{children}</PanelShell>
      </body>
    </html>
  );
}
