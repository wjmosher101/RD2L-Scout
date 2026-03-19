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
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={handleRefresh} disabled={loading} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #333', cursor: 'pointer' }}>
        {loading ? 'Refreshing…' : 'Refresh now'}
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}
