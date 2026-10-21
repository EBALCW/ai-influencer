import type { Metadata } from 'next';
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
      <body>{children}</body>
    </html>
  );
}
