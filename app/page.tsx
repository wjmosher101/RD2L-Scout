export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { readCachedDivision } from '@/lib/storage';
import { RefreshButton } from '@/components/RefreshButton';

function getHeroLabel(hero: any): string {
  const heroName = hero?.hero || hero?.name || '';
  const matches = hero?.matches;

  if (!heroName) return '';
  if (typeof matches === 'number' && Number.isFinite(matches)) {
    return `${heroName} (${matches})`;
  }

  return heroName;
}

function getBanSuggestions(player: any): string[] {
  if (Array.isArray(player?.banSuggestions) && player.banSuggestions.length > 0) {
    return player.banSuggestions.filter(Boolean);
  }

  return (player?.comfortHeroes || [])
    .slice(0, 3)
    .map((h: any) => h?.hero || h?.name)
    .filter(Boolean);
}

export default async function Home() {
  const data = await readCachedDivision();

  if (!data) {
    return (
      <div
        style={{
          padding: 24,
          border: '1px solid #1e293b',
          borderRadius: 12,
          background: 'rgba(15,23,42,0.7)'
        }}
      >
        <h2 style={{ marginTop: 0, color: '#38bdf8' }}>No scouting data yet</h2>
        <p style={{ opacity: 0.8 }}>Run a refresh to build the first report.</p>
        <RefreshButton />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 24,
          padding: 20,
          border: '1px solid #1e293b',
          borderRadius: 12,
          background: 'rgba(15,23,42,0.7)',
          boxShadow: '0 0 24px rgba(0,0,0,0.25)'
        }}
      >
        <h2 style={{ margin: 0, color: '#38bdf8' }}>
          {data.divisionName} — {data.seasonName}
        </h2>
        <p style={{ opacity: 0.7, marginTop: 8 }}>
          Last Updated: {new Date(data.lastUpdated).toLocaleString()}
        </p>
        <RefreshButton />
      </div>

      {data.teams.map((team: any) => (
        <div
          key={team.name}
          style={{
            marginBottom: 28,
            padding: 20,
            border: '1px solid #1e293b',
            borderRadius: 12,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.85), rgba(2,6,23,0.92))',
            boxShadow: '0 0 30px rgba(0,0,0,0.25)'
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 10, color: '#f43f5e' }}>{team.name}</h3>

          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: 'rgba(127,29,29,0.25)',
              border: '1px solid rgba(244,63,94,0.25)'
            }}
          >
            <strong style={{ color: '#fda4af' }}>Team Ban Targets:</strong>{' '}
            {team.players.flatMap((p: any) => getBanSuggestions(p)).slice(0, 5).join(', ') || 'No data'}
          </div>

          <div
            style={{
              display: 'grid',
              gap: 14
            }}
          >
            {team.players.map((player: any) => {
              const hasHeroes = (player?.comfortHeroes?.length ?? 0) > 0;
              const bans = getBanSuggestions(player);
              const hasBans = bans.length > 0;
              const hasNotes = (player?.notes?.length ?? 0) > 0;

              return (
                <div
                  key={player.name}
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: 'rgba(2,6,23,0.95)',
                    border: '1px solid #172033'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, color: '#e2e8f0' }}>{player.name}</h4>
                      <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
                        {player.roleSummary?.primaryLane || player.roleSummary?.primaryRole || player.role || 'Unknown Role'}
                      </div>
                    </div>

                    {player.dotabuffUrl ? (
                      <a
                        href={player.dotabuffUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: '#38bdf8',
                          textDecoration: 'none',
                          fontSize: 14
                        }}
                      >
                        Dotabuff ↗
                      </a>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <strong style={{ color: '#93c5fd' }}>Comfort Heroes:</strong>{' '}
                    {hasHeroes
                      ? player.comfortHeroes
                          .slice(0, 5)
                          .map((h: any) => getHeroLabel(h))
                          .filter(Boolean)
                          .join(', ')
                      : 'No data'}
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <strong style={{ color: '#fda4af' }}>Ban Suggestions:</strong>{' '}
                    {hasBans ? bans.join(', ') : 'No suggestions'}
                  </div>

                  <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
                    <strong>Notes:</strong>{' '}
                    {hasNotes ? player.notes.join(' | ') : 'None'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
