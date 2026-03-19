import { RefreshButton } from '@/components/RefreshButton';
import { DEFAULT_DIVISION_URL, DEFAULT_SEASON_LABEL } from '@/lib/config';
import { readCachedDivision } from '@/lib/storage';
import type { HeroStat, PlayerScout, TeamScout } from '@/lib/types';

function cardStyle(): React.CSSProperties {
  return {
    background: 'linear-gradient(180deg, rgba(19,18,31,0.96), rgba(12,12,22,0.96))',
    border: '1px solid rgba(127, 29, 29, 0.45)',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 22px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)'
  };
}

function badgeStyle(background: string, color = '#f8fafc'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    background,
    color,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  };
}

function getHeroWeight(hero: HeroStat, multiplier: number) {
  const matchWeight = hero.matches ? Math.min(hero.matches, 30) : 6;
  const winRateWeight = hero.winRate ? Math.max(0, parseFloat(hero.winRate) - 45) / 8 : 1.2;
  return matchWeight * multiplier + winRateWeight;
}

function buildBanSuggestions(player: PlayerScout): HeroStat[] {
  const scoreMap = new Map<string, { hero: HeroStat; score: number }>();

  for (const hero of player.comfortHeroes) {
    const current = scoreMap.get(hero.name) || { hero, score: 0 };
    current.score += getHeroWeight(hero, 1.1);
    scoreMap.set(hero.name, current);
  }

  for (const hero of player.roleSummary?.heroes || []) {
    const current = scoreMap.get(hero.name) || { hero, score: 0 };
    current.score += getHeroWeight(hero, 1.8);
    scoreMap.set(hero.name, current);
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.hero);
}

function roleTone(role?: string, lane?: string) {
  const text = `${role || ''} ${lane || ''}`.toLowerCase();
  if (text.includes('mid')) return '#7c3aed';
  if (text.includes('safe') || text.includes('carry')) return '#b91c1c';
  if (text.includes('off')) return '#ea580c';
  if (text.includes('support')) return '#0f766e';
  return '#334155';
}

function teamBanBoard(team: TeamScout) {
  const aggregate = new Map<string, { hero: HeroStat; score: number; players: string[] }>();

  for (const player of team.players) {
    for (const hero of buildBanSuggestions(player)) {
      const current = aggregate.get(hero.name) || { hero, score: 0, players: [] };
      current.score += getHeroWeight(hero, 1.4);
      if (!current.players.includes(player.name)) current.players.push(player.name);
      aggregate.set(hero.name, current);
    }
  }

  return Array.from(aggregate.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function HeroChip({ hero, emphasis = false }: { hero: HeroStat; emphasis?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 14,
        background: emphasis ? 'rgba(127, 29, 29, 0.18)' : 'rgba(15, 23, 42, 0.8)',
        border: emphasis ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(71, 85, 105, 0.35)'
      }}
    >
      <div style={{ fontWeight: 700 }}>{hero.name}</div>
      <div style={{ color: '#cbd5e1', fontSize: 13, textAlign: 'right' }}>
        {hero.matches ? <span>{hero.matches} matches</span> : null}
        {hero.matches && hero.winRate ? <span> · </span> : null}
        {hero.winRate ? <span>{hero.winRate}</span> : null}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const cached = await readCachedDivision();

  return (
    <main style={{ maxWidth: 1380, margin: '0 auto', padding: '32px 20px 64px' }}>
      <section
        style={{
          ...cardStyle(),
          padding: 28,
          marginBottom: 24,
          background:
            'radial-gradient(circle at top left, rgba(127,29,29,0.28), transparent 34%), radial-gradient(circle at top right, rgba(124,58,237,0.16), transparent 28%), linear-gradient(180deg, rgba(22,14,24,0.97), rgba(10,10,18,0.98))'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 860 }}>
            <div style={badgeStyle('rgba(127,29,29,0.22)', '#fecaca')}>RD2L Scout // Dire Room</div>
            <h1 style={{ margin: '16px 0 10px', fontSize: 48, lineHeight: 1.05 }}>Dark scouting dashboard for draft night</h1>
            <p style={{ margin: 0, maxWidth: 820, lineHeight: 1.7, color: '#cbd5e1', fontSize: 16 }}>
              Built for fast reads before bans and picks. This board pulls the RD2L Tuesday division, maps each player to Dotabuff,
              surfaces comfort picks, shows likely lane tendencies, and now generates a ban-first shortlist from overlapping hero strength.
            </p>
          </div>
          <div style={{ minWidth: 280, display: 'grid', gap: 10, alignContent: 'start' }}>
            <div style={badgeStyle('rgba(15,118,110,0.18)', '#99f6e4')}>Target season: {DEFAULT_SEASON_LABEL}</div>
            <div style={badgeStyle('rgba(30,41,59,0.9)', '#e2e8f0')}>Division wired: EST-TUES</div>
            <div style={{ color: '#cbd5e1', lineHeight: 1.6, fontSize: 14 }}>
              Last updated:{' '}
              <strong style={{ color: '#f8fafc' }}>
                {cached?.lastUpdated
                  ? new Date(cached.lastUpdated).toLocaleString('en-US', { timeZone: 'America/Chicago' }) + ' America/Chicago'
                  : 'Not refreshed yet'}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: cached ? '1.2fr 0.8fr' : '1fr',
          gap: 24,
          marginBottom: 24
        }}
      >
        <div style={cardStyle()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={badgeStyle('rgba(124,58,237,0.18)', '#ddd6fe')}>Operations</div>
              <h2 style={{ margin: '12px 0 6px', fontSize: 28 }}>Refresh and cache control</h2>
              <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
                Hit refresh when you want the board to pull the latest roster and hero data. Auto-refresh will still run daily on Vercel.
              </p>
            </div>
            <RefreshButton />
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={badgeStyle('rgba(127,29,29,0.18)', '#fecaca')}>Source</div>
          <h2 style={{ margin: '12px 0 6px', fontSize: 28 }}>Feed details</h2>
          <div style={{ color: '#cbd5e1', lineHeight: 1.7, fontSize: 14 }}>
            <div>
              <strong style={{ color: '#f8fafc' }}>Default division:</strong>{' '}
              <a href={DEFAULT_DIVISION_URL} style={{ color: '#fca5a5' }}>{DEFAULT_DIVISION_URL}</a>
            </div>
            <div>
              <strong style={{ color: '#f8fafc' }}>Scouting mode:</strong> comfort heroes + role hints + ban shortlist
            </div>
            {cached ? (
              <div>
                <strong style={{ color: '#f8fafc' }}>Teams cached:</strong> {cached.teams.length}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {!cached ? (
        <section style={cardStyle()}>
          <h2 style={{ marginTop: 0 }}>No cached data yet</h2>
          <p style={{ lineHeight: 1.7, color: '#cbd5e1' }}>
            Run your first refresh. Once the cache is populated, this page will render a darker draft board with team summaries,
            player cards, and a ban suggestion list for each opponent.
          </p>
        </section>
      ) : (
        <>
          <section style={{ ...cardStyle(), marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'end' }}>
              <div>
                <div style={badgeStyle('rgba(15,118,110,0.18)', '#99f6e4')}>{cached.divisionName} // {cached.seasonName}</div>
                <h2 style={{ margin: '12px 0 6px', fontSize: 32 }}>Team war room</h2>
                <p style={{ margin: 0, color: '#cbd5e1' }}>
                  {cached.teams.length} teams cached from <a href={cached.teamsUrl} style={{ color: '#fca5a5' }}>the RD2L teams page</a>.
                </p>
              </div>
              <div style={{ color: '#94a3b8', fontSize: 14 }}>Dark UI pass 1 · ban suggestions enabled</div>
            </div>
          </section>

          <section style={{ display: 'grid', gap: 20 }}>
            {cached.teams.map((team) => {
              const teamBans = teamBanBoard(team);

              return (
                <article key={team.teamUrl} style={cardStyle()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
                    <div>
                      <div style={badgeStyle('rgba(127,29,29,0.18)', '#fecaca')}>Opponent squad</div>
                      <h3 style={{ margin: '12px 0 8px', fontSize: 30 }}>{team.name}</h3>
                      <div style={{ color: '#cbd5e1' }}>Captain: <strong style={{ color: '#fff' }}>{team.captain || 'Unknown'}</strong></div>
                    </div>
                    <a href={team.teamUrl} style={{ color: '#fca5a5', fontWeight: 700 }}>Open RD2L team page</a>
                  </div>

                  <div
                    style={{
                      padding: 18,
                      borderRadius: 18,
                      marginBottom: 18,
                      background: 'linear-gradient(180deg, rgba(38,11,11,0.7), rgba(15,23,42,0.82))',
                      border: '1px solid rgba(239,68,68,0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <div style={badgeStyle('rgba(239,68,68,0.18)', '#fca5a5')}>Priority bans</div>
                        <h4 style={{ margin: '10px 0 4px', fontSize: 22 }}>Suggested first look</h4>
                        <p style={{ margin: 0, color: '#cbd5e1' }}>Weighted from comfort pool overlap and current role-based hero usage.</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
                      {teamBans.length ? teamBans.map((entry) => (
                        <div
                          key={entry.hero.name}
                          style={{
                            borderRadius: 16,
                            padding: 14,
                            background: 'rgba(9, 9, 16, 0.7)',
                            border: '1px solid rgba(248,113,113,0.25)'
                          }}
                        >
                          <div style={{ color: '#fca5a5', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            Ban target
                          </div>
                          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800 }}>{entry.hero.name}</div>
                          <div style={{ marginTop: 6, color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
                            {entry.players.join(', ')}
                          </div>
                        </div>
                      )) : <div style={{ color: '#cbd5e1' }}>No ban suggestions yet.</div>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 16 }}>
                    {team.players.map((player) => {
                      const suggestions = buildBanSuggestions(player);
                      const roleColor = roleTone(player.roleSummary?.primaryRole, player.roleSummary?.primaryLane);

                      return (
                        <div
                          key={player.rd2lProfileUrl}
                          style={{
                            background: 'linear-gradient(180deg, rgba(12,17,28,0.95), rgba(7,10,18,0.96))',
                            borderRadius: 18,
                            padding: 18,
                            border: '1px solid rgba(51,65,85,0.55)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                            <div>
                              <div style={badgeStyle(`${roleColor}33`, '#f8fafc')}>Role read</div>
                              <h4 style={{ margin: '12px 0 8px', fontSize: 24 }}>{player.name}</h4>
                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <a href={player.rd2lProfileUrl} style={{ color: '#93c5fd' }}>RD2L profile</a>
                                {player.dotabuffUrl ? <a href={player.dotabuffUrl} style={{ color: '#93c5fd' }}>Dotabuff</a> : null}
                                {player.dotabuffEsportsUrl ? <a href={player.dotabuffEsportsUrl} style={{ color: '#93c5fd' }}>Esports profile</a> : null}
                              </div>
                            </div>
                            <div style={{ minWidth: 250 }}>
                              <div style={{ display: 'grid', gap: 10 }}>
                                <div style={badgeStyle(`${roleColor}22`)}>
                                  Likely role: {player.roleSummary?.primaryRole || 'Unknown'}
                                </div>
                                <div style={badgeStyle('rgba(30,41,59,0.9)')}>
                                  Likely lane: {player.roleSummary?.primaryLane || 'Unknown'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1.15fr 1.15fr 0.9fr',
                              gap: 16,
                              marginTop: 18
                            }}
                          >
                            <div>
                              <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fca5a5' }}>
                                Comfort heroes
                              </div>
                              <div style={{ display: 'grid', gap: 10 }}>
                                {player.comfortHeroes.length ? player.comfortHeroes.map((hero) => (
                                  <HeroChip key={`${player.name}-comfort-${hero.name}`} hero={hero} />
                                )) : <div style={{ color: '#cbd5e1' }}>No comfort data parsed yet.</div>}
                              </div>
                            </div>

                            <div>
                              <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4b5fd' }}>
                                {player.roleSummary?.seasonLabel || 'Season'} hero read
                              </div>
                              <div style={{ display: 'grid', gap: 10 }}>
                                {player.roleSummary?.heroes?.length ? player.roleSummary.heroes.map((hero) => (
                                  <HeroChip key={`${player.name}-role-${hero.name}`} hero={hero} />
                                )) : <div style={{ color: '#cbd5e1' }}>No esports-season hero data parsed yet.</div>}
                              </div>
                            </div>

                            <div>
                              <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fecaca' }}>
                                Ban shortlist
                              </div>
                              <div style={{ display: 'grid', gap: 10 }}>
                                {suggestions.length ? suggestions.map((hero) => (
                                  <HeroChip key={`${player.name}-ban-${hero.name}`} hero={hero} emphasis />
                                )) : <div style={{ color: '#cbd5e1' }}>No ban read yet.</div>}
                              </div>
                            </div>
                          </div>

                          {player.notes.length ? (
                            <div
                              style={{
                                marginTop: 16,
                                padding: 14,
                                borderRadius: 14,
                                background: 'rgba(127, 29, 29, 0.12)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                color: '#fecaca'
                              }}
                            >
                              <strong>Parser notes:</strong>
                              <ul style={{ marginBottom: 0 }}>
                                {player.notes.map((note) => <li key={note}>{note}</li>)}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
