import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/src/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Goth Bank — Digital Banking Management System',
  description:
    'Enterprise digital banking platform with multi-role governance, atomic fund transfers, loan origination, and real-time financial analytics.',
  openGraph: {
    title: 'Goth Bank — Digital Banking Management System',
    description:
      'Enterprise digital banking platform with multi-role governance, atomic fund transfers, loan origination, and real-time financial analytics.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
