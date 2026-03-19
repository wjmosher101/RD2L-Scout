import type { ReactNode } from 'react';

export const metadata = {
  title: 'RD2L Scout',
  description: 'Scouting dashboard for RD2L teams and Dotabuff profiles.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'Arial, sans-serif',
          background: '#0b1020',
          color: '#f3f4f6'
        }}
      >
        {children}
      </body>
    </html>
  );
}
