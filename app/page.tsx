import { loadDivisionScout } from '@/lib/storage';
import RefreshButton from '@/components/RefreshButton';

function getBanSuggestions(player: any): string[] {
  return (player.comfortHeroes || [])
    .slice(0, 3)
    .map((h: any) => h.name)
    .filter(Boolean);
}

export default async function Home() {
  const data = await loadDivisionScout();

  if (!data) {
    return <div>No data yet. Click refresh.</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2>{data.divisionName} - {data.seasonName}</h2>
        <p style={{ opacity: 0.7 }}>
          Last Updated: {new Date(data.lastUpdated).toLocaleString()}
        </p>
        <RefreshButton />
      </div>

      {data.teams.map((team: any) => (
        <div
          key={team.name}
          style={{
            marginBottom: 30,
            padding: 20,
            border: '1px solid #1e293b',
            borderRadius: 10,
            background: 'rgba(15,23,42,0.6)'
          }}
        >
          <h3 style={{ color: '#38bdf8' }}>{team.name}</h3>

          {/* TEAM BAN SUGGESTIONS */}
          <div style={{ marginBottom: 10 }}>
            <strong>Team Ban Targets:</strong>{' '}
            {team.players
              .flatMap((p: any) => getBanSuggestions(p))
              .slice(0, 5)
              .join(', ')}
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {team.players.map((player: any) => (
              <div
                key={player.name}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: '#020617',
                  border: '1px solid #0f172a'
                }}
              >
                <h4 style={{ margin: 0 }}>
                  {player.name}
                </h4>

                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {player.roleSummary?.primaryLane || 'Unknown Role'}
                </div>

                <div style={{ marginTop: 8 }}>
                  <strong>Comfort Heroes:</strong>{' '}
                  {(player.comfortHeroes || [])
                    .slice(0, 5)
                    .map((h: any) => h.name)
                    .join(', ')}
                </div>

                <div style={{ marginTop: 6 }}>
                  <strong>Ban Suggestions:</strong>{' '}
                  {getBanSuggestions(player).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
