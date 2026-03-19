import { RefreshButton } from '@/components/RefreshButton';
import { DEFAULT_DIVISION_URL, DEFAULT_SEASON_LABEL } from '@/lib/config';
import { readCachedDivision } from '@/lib/storage';

function cardStyle(): React.CSSProperties {
  return {
    background: '#151b2f',
    border: '1px solid #2a3357',
    borderRadius: 16,
    padding: 16
  };
}

export default async function HomePage() {
  const cached = await readCachedDivision();

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ marginBottom: 8, color: '#a5b4fc', fontWeight: 700 }}>RD2L Scout</p>
        <h1 style={{ margin: '0 0 12px', fontSize: 40 }}>Season 37 Tuesday scouting dashboard</h1>
        <p style={{ margin: 0, maxWidth: 900, lineHeight: 1.6, color: '#d1d5db' }}>
          Version 1 is wired for the RD2L EST-TUES division and is structured so you can expand it to other divisions later.
          The daily refresh job targets one update per day on Vercel. The page below reads from the last cached scrape.
        </p>
      </header>

      <section style={{ ...cardStyle(), marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div><strong>Default division:</strong> <a href={DEFAULT_DIVISION_URL} style={{ color: '#93c5fd' }}>{DEFAULT_DIVISION_URL}</a></div>
          <div><strong>Season filter target:</strong> {DEFAULT_SEASON_LABEL}</div>
          <div><strong>Last updated:</strong> {cached?.lastUpdated ? new Date(cached.lastUpdated).toLocaleString('en-US', { timeZone: 'America/Chicago' }) + ' America/Chicago' : 'Not refreshed yet'}</div>
          <RefreshButton />
        </div>
      </section>

      {!cached ? (
        <section style={cardStyle()}>
          <h2 style={{ marginTop: 0 }}>No cached data yet</h2>
          <p style={{ lineHeight: 1.6 }}>
            Trigger a refresh after deploying. The scraper will attempt to pull teams from the RD2L division,
            player RD2L profiles, Dotabuff overview comfort heroes, and esports-role information.
          </p>
        </section>
      ) : (
        <>
          <section style={{ ...cardStyle(), marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>{cached.divisionName} — {cached.seasonName}</h2>
            <p style={{ marginBottom: 0, color: '#d1d5db' }}>
              {cached.teams.length} teams cached from <a href={cached.teamsUrl} style={{ color: '#93c5fd' }}>teams page</a>.
            </p>
          </section>

          <section style={{ display: 'grid', gap: 20 }}>
            {cached.teams.map((team) => (
              <article key={team.teamUrl} style={cardStyle()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px' }}>{team.name}</h3>
                    <div style={{ color: '#cbd5e1' }}>Captain: {team.captain || 'Unknown'}</div>
                  </div>
                  <a href={team.teamUrl} style={{ color: '#93c5fd' }}>Open RD2L team page</a>
                </div>

                <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                  {team.players.map((player) => (
                    <div key={player.rd2lProfileUrl} style={{ background: '#0f172a', borderRadius: 14, padding: 14, border: '1px solid #25304f' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div>
                          <h4 style={{ margin: '0 0 8px' }}>{player.name}</h4>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <a href={player.rd2lProfileUrl} style={{ color: '#93c5fd' }}>RD2L profile</a>
                            {player.dotabuffUrl ? <a href={player.dotabuffUrl} style={{ color: '#93c5fd' }}>Dotabuff</a> : null}
                            {player.dotabuffEsportsUrl ? <a href={player.dotabuffEsportsUrl} style={{ color: '#93c5fd' }}>Esports profile</a> : null}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div><strong>Likely role:</strong> {player.roleSummary?.primaryRole || 'Unknown'}</div>
                          <div><strong>Likely lane:</strong> {player.roleSummary?.primaryLane || 'Unknown'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 14 }}>
                        <div>
                          <strong>Comfort heroes</strong>
                          <ul>
                            {player.comfortHeroes.length ? player.comfortHeroes.map((hero) => (
                              <li key={hero.name}>{hero.name}{hero.matches ? ` — ${hero.matches} matches` : ''}{hero.winRate ? ` — ${hero.winRate}` : ''}</li>
                            )) : <li>No comfort data parsed yet.</li>}
                          </ul>
                        </div>
                        <div>
                          <strong>{player.roleSummary?.seasonLabel || 'RD2L season'} heroes</strong>
                          <ul>
                            {player.roleSummary?.heroes?.length ? player.roleSummary.heroes.map((hero) => (
                              <li key={hero.name}>{hero.name}{hero.matches ? ` — ${hero.matches} matches` : ''}{hero.winRate ? ` — ${hero.winRate}` : ''}</li>
                            )) : <li>No esports-season hero data parsed yet.</li>}
                          </ul>
                        </div>
                      </div>

                      {player.notes.length ? (
                        <div style={{ marginTop: 10, color: '#fca5a5' }}>
                          <strong>Parser notes:</strong>
                          <ul>
                            {player.notes.map((note) => <li key={note}>{note}</li>)}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
