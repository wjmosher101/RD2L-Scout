'use client';

import { useState } from 'react';

export function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Refresh failed');
      setMessage('Refresh completed. Reload the page in a moment.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Refresh failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
      <button
        onClick={handleRefresh}
        disabled={loading}
        style={{
          padding: '12px 18px',
          borderRadius: 14,
          border: '1px solid rgba(248,113,113,0.35)',
          cursor: loading ? 'wait' : 'pointer',
          background: loading
            ? 'linear-gradient(180deg, rgba(71,85,105,0.7), rgba(30,41,59,0.9))'
            : 'linear-gradient(180deg, rgba(127,29,29,0.92), rgba(69,10,10,0.98))',
          color: '#fff',
          fontWeight: 800,
          letterSpacing: '0.04em',
          boxShadow: '0 12px 30px rgba(69,10,10,0.35)'
        }}
      >
        {loading ? 'Refreshing the war room…' : 'Refresh scout data'}
      </button>
      {message ? <span style={{ color: '#cbd5e1', fontSize: 14 }}>{message}</span> : null}
    </div>
  );
}
