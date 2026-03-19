import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RD2L Scout',
  description: 'Dota 2 RD2L Scouting Tool'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: 'radial-gradient(circle at top, #0f172a, #020617)',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          minHeight: '100vh'
        }}
      >
        <div
          style={{
            borderBottom: '1px solid #1e293b',
            padding: '16px 24px',
            background: 'rgba(2,6,23,0.8)',
            backdropFilter: 'blur(6px)'
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              letterSpacing: '1px',
              color: '#38bdf8'
            }}
          >
            RD2L SCOUT
          </h1>
        </div>

        <main style={{ padding: '24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
