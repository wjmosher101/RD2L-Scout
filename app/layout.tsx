import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'RD2L Scout',
  description: 'Scouting dashboard for RD2L teams and Dotabuff profiles.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'Inter, Arial, sans-serif',
          background:
            'radial-gradient(circle at top, rgba(127,29,29,0.12), transparent 28%), radial-gradient(circle at bottom right, rgba(124,58,237,0.08), transparent 24%), linear-gradient(180deg, #05070d 0%, #0a0f17 45%, #05070d 100%)',
          color: '#f8fafc'
        }}
      >
        {children}
      </body>
    </html>
  );
}
