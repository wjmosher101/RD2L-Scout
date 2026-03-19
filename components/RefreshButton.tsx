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

      let text = '';
      try {
        text = await res.text();
      } catch {
        text = '';
      }

      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        throw new Error(
          parsed?.error ||
            parsed?.message ||
            text ||
            `Refresh failed with status ${res.status}`
        );
      }

      setMessage(
        parsed?.message || 'Refresh completed. Reload the page in a moment.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Refresh failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={handleRefresh}
        disabled={loading}
        style={{
          padding: '10px 16px',
          borderRadius: 10,
          border: '1px solid #334155',
          cursor: 'pointer',
          background: '#0f172a',
          color: '#e2e8f0'
        }}
      >
        {loading ? 'Refreshing…' : 'Refresh now'}
      </button>

      {message ? (
        <span style={{ maxWidth: 900, whiteSpace: 'pre-wrap' }}>{message}</span>
      ) : null}
    </div>
  );
}
