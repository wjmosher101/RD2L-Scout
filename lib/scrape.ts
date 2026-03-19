import * as cheerio from 'cheerio';
import { DEFAULT_SEASON_LABEL, USER_AGENT } from '@/lib/config';
import type { DivisionScout, HeroStat, PlayerScout, TeamScout } from '@/lib/types';

const RD2L_BASE = 'https://rd2l.gg';
const DOTABUFF_BASE = 'https://www.dotabuff.com';

function absoluteUrl(base: string, maybeRelative?: string): string | undefined {
  if (!maybeRelative) return undefined;
  if (maybeRelative.startsWith('http://') || maybeRelative.startsWith('https://')) {
    return maybeRelative;
  }
  return new URL(maybeRelative, base).toString();
}

function cleanText(value?: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parseNumber(value?: string): number | undefined {
  const text = cleanText(value).replace(/,/g, '');
  if (!text) return undefined;
  const num = Number(text);
  return Number.isFinite(num) ? num : undefined;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string, tries = 5): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          'accept-language': 'en-US,en;q=0.9',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'cache-control': 'no-cache',
          pragma: 'no-cache'
        },
        cache: 'no-store',
        next: { revalidate: 0 }
      });

      if (response.ok) {
        return await response.text();
      }

      const error = new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText || '<none>'}`
      );

      if (response.status === 522 || response.status >= 500) {
        lastError = error;
      } else {
        throw error;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < tries) {
      await sleep(1500 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

async function parseDivision(
  divisionUrl: string
): Promise<{ divisionName: string; seasonName: string; teamsUrl: string }> {
  if (/\/teams\/?$/.test(divisionUrl)) {
    return {
      divisionName: 'EST-TUES',
      seasonName: DEFAULT_SEASON_LABEL,
      teamsUrl: divisionUrl
    };
  }

  const html = await fetchHtml(divisionUrl);
  const $ = cheerio.load(html);

  const divisionName = cleanText($('h3').first().text()) || 'RD2L Division';

  const activeSeasonRow = $('h4')
    .filter((_, el) => cleanText($(el).text()).toLowerCase() === 'active season')
    .first()
    .nextAll('table')
    .first()
    .find('tr')
    .eq(1);

  const seasonName =
    cleanText(activeSeasonRow.find('td').first().text()) || DEFAULT_SEASON_LABEL;

  let teamsUrl = activeSeasonRow
    .find('a')
    .filter((_, el) => cleanText($(el).text()).toLowerCase() === 'teams')
    .attr('href');

  if (!teamsUrl) {
    teamsUrl = $('a')
      .filter((_, el) => cleanText($(el).text()).toLowerCase() === 'teams')
      .first()
      .attr('href');
  }

  const absoluteTeamsUrl = absoluteUrl(RD2L_BASE, teamsUrl);
  if (!absoluteTeamsUrl) {
    throw new Error(`Could not find teams link on division page: ${divisionUrl}`);
  }

  return {
    divisionName,
    seasonName,
    teamsUrl: absoluteTeamsUrl
  };
}

async function parseTeams(teamsUrl: string): Promise<TeamScout[]> {
  const html = await fetchHtml(teamsUrl);
  const $ = cheerio.load(html);

  const teamsMap = new Map<string, string>();

  $('a[href*="/teams/"]').each((_, el) => {
    const name = cleanText($(el).text());
    const href = $(el).attr('href');
    const teamUrl = absoluteUrl(RD2L_BASE, href);

    if (!name || !teamUrl) return;
    teamsMap.set(name, teamUrl);
  });

  return Array.from(teamsMap.entries()).map(([name, teamUrl]) => ({
    name,
    teamUrl,
    players: []
  }));
}

function buildDotabuffUrlFromRd2lProfile(rd2lProfileUrl: string): string | undefined {
  const playerId = rd2lProfileUrl.match(/\/profile\/(\d+)/)?.[1];
  if (!playerId) return undefined;
  return `${DOTABUFF_BASE}/players/${playerId}`;
}

function buildDotabuffHeroesUrl(dotabuffUrl: string): string {
  return `${dotabuffUrl.replace(/\/$/, '')}/heroes`;
}

function buildEsportsUrl(dotabuffUrl: string): string {
  const playerId = dotabuffUrl.match(/\/players\/(\d+)/)?.[1];
  if (!playerId) {
    throw new Error(`Could not extract player ID from Dotabuff URL: ${dotabuffUrl}`);
  }
  return `${DOTABUFF_BASE}/esports/players/${playerId}`;
}

function buildEsportsHeroesUrl(dotabuffUrl: string): string {
  return `${buildEsportsUrl(dotabuffUrl)}/heroes`;
}

function extractHeroStatsFromTables($: cheerio.CheerioAPI, limit: number): HeroStat[] {
  const heroes: HeroStat[] = [];
  const seen = new Set<string>();

  $('table tbody tr').each((_, row) => {
    if (heroes.length >= limit) return;

    const heroLink = $(row).find('a[href*="/heroes/"]').first();
    if (!heroLink.length) return;

    const heroName = cleanText(heroLink.text());
    if (!heroName || seen.has(heroName)) return;

    const cells = $(row).find('td');
    const cellTexts = cells
      .map((__, cell) => cleanText($(cell).text()))
      .get()
      .filter(Boolean) as string[];

    const matchesText = cellTexts.find((text) => /^\d[\d,]*$/.test(text));
    const winRate = cellTexts.find((text) => /%/.test(text));

    heroes.push({
      name: heroName,
      matches: matchesText ? parseNumber(matchesText) : undefined,
      winRate: winRate || undefined
    });

    seen.add(heroName);
  });

  return heroes;
}

async function parseDotabuffOverview(dotabuffUrl: string): Promise<HeroStat[]> {
  return [];
}
  const heroesUrl = buildDotabuffHeroesUrl(dotabuffUrl);
  const heroesHtml = await fetchHtml(heroesUrl);
  const $heroes = cheerio.load(heroesHtml);

  const heroesFromHeroesPage = extractHeroStatsFromTables($heroes, 6);
  if (heroesFromHeroesPage.length) {
    return heroesFromHeroesPage;
  }

  const overviewHtml = await fetchHtml(dotabuffUrl);
  const $overview = cheerio.load(overviewHtml);
  const heroesFromOverview = extractHeroStatsFromTables($overview, 6);

  if (!heroesFromOverview.length) {
    throw new Error(`Could not find hero rows on ${heroesUrl}`);
  }

  return heroesFromOverview;
}

async function parseDotabuffEsports(dotabuffUrl: string, seasonLabel: string) {
  const esportsUrl = buildEsportsUrl(dotabuffUrl);
  const html = await fetchHtml(esportsUrl);
  const $ = cheerio.load(html);

  const pageText = cleanText($('body').text());

  const primaryLane =
    pageText.match(/\b(Safe Lane|Mid Lane|Off Lane|Roaming|Support)\b/i)?.[1];

  const primaryRole =
    pageText.match(/\b(Carry|Mid|Offlane|Support|Roamer)\b/i)?.[1] || primaryLane;

  let heroes = extractHeroStatsFromTables($, 5);

  if (!heroes.length) {
    const esportsHeroesUrl = buildEsportsHeroesUrl(dotabuffUrl);
    const heroesHtml = await fetchHtml(esportsHeroesUrl);
    const $heroes = cheerio.load(heroesHtml);
    heroes = extractHeroStatsFromTables($heroes, 5);
  }

  return {
    url: esportsUrl,
    roleSummary: {
      seasonLabel,
      leagueName: seasonLabel,
      primaryRole,
      primaryLane,
      heroes
    }
  };
}

async function buildPlayerScout(name: string, rd2lProfileUrl: string): Promise<PlayerScout> {
  const dotabuffUrl = buildDotabuffUrlFromRd2lProfile(rd2lProfileUrl);

  const player: PlayerScout = {
    name,
    rd2lProfileUrl,
    dotabuffUrl,
    comfortHeroes: [],
    notes: []
  };

  if (!dotabuffUrl) {
    player.notes.push('Could not derive Dotabuff URL from RD2L profile URL.');
    return player;
  }

  try {
    const esports = await parseDotabuffEsports(dotabuffUrl, DEFAULT_SEASON_LABEL);
    player.dotabuffEsportsUrl = esports.url;
    player.roleSummary = esports.roleSummary;

    // Use esports heroes as the primary hero pool for now
    if (esports.roleSummary?.heroes?.length) {
      player.comfortHeroes = esports.roleSummary.heroes;
    } else {
      player.notes.push('No esports hero pool found.');
    }
  } catch (error) {
    player.notes.push(
      error instanceof Error ? error.message : 'Could not parse Dotabuff esports page.'
    );
  }

  return player;
}
  const dotabuffUrl = buildDotabuffUrlFromRd2lProfile(rd2lProfileUrl);

  const player: PlayerScout = {
    name,
    rd2lProfileUrl,
    dotabuffUrl,
    comfortHeroes: [],
    notes: []
  };

  if (!dotabuffUrl) {
    player.notes.push('Could not derive Dotabuff URL from RD2L profile URL.');
    return player;
  }

  let esportsRoleSummary: PlayerScout['roleSummary'] | undefined;

  try {
    const esports = await parseDotabuffEsports(dotabuffUrl, DEFAULT_SEASON_LABEL);
    player.dotabuffEsportsUrl = esports.url;
    player.roleSummary = esports.roleSummary;
    esportsRoleSummary = esports.roleSummary;
  } catch (error) {
    player.notes.push(
      error instanceof Error ? error.message : 'Could not parse Dotabuff esports page.'
    );
  }

  try {
    player.comfortHeroes = await parseDotabuffOverview(dotabuffUrl);
  } catch (error) {
    if (esportsRoleSummary?.heroes?.length) {
      player.comfortHeroes = esportsRoleSummary.heroes;
      player.notes.push('Using esports hero pool as fallback for comfort heroes.');
    } else {
      player.notes.push(
        error instanceof Error ? error.message : 'Could not parse Dotabuff overview.'
      );
    }
  }

  return player;
}

async function parseTeamRoster(team: TeamScout): Promise<TeamScout> {
  const html = await fetchHtml(team.teamUrl);
  const $ = cheerio.load(html);

  const roster: Array<{ name: string; rd2lProfileUrl: string }> = [];

  $('a[href*="/profile/"]').each((_, el) => {
    const name = cleanText($(el).text());
    const href = $(el).attr('href');
    const rd2lProfileUrl = absoluteUrl(RD2L_BASE, href);

    if (!name || !rd2lProfileUrl) return;
    roster.push({ name, rd2lProfileUrl });
  });

  const uniqueRoster = Array.from(
    new Map(roster.map((entry) => [entry.rd2lProfileUrl, entry])).values()
  );

  const players: PlayerScout[] = [];

  for (const player of uniqueRoster) {
    try {
      const parsed = await buildPlayerScout(player.name, player.rd2lProfileUrl);
      players.push(parsed);
      await sleep(300);
    } catch (error) {
      players.push({
        name: player.name,
        rd2lProfileUrl: player.rd2lProfileUrl,
        comfortHeroes: [],
        notes: [error instanceof Error ? error.message : 'Failed to process player.']
      });
    }
  }

  return {
    ...team,
    captain: uniqueRoster[0]?.name,
    players
  };
}

export async function buildDivisionScout(divisionUrl: string): Promise<DivisionScout> {
  const division = await parseDivision(divisionUrl);
  const teams = await parseTeams(division.teamsUrl);

  const hydratedTeams: TeamScout[] = [];

  for (const team of teams) {
    try {
      const hydratedTeam = await parseTeamRoster(team);
      hydratedTeams.push(hydratedTeam);
      await sleep(750);
    } catch (error) {
      hydratedTeams.push({
        ...team,
        players: [],
        notes: [error instanceof Error ? error.message : 'Failed to parse team roster.']
      } as TeamScout);
    }
  }

  return {
    divisionName: division.divisionName,
    seasonName: division.seasonName,
    divisionUrl,
    teamsUrl: division.teamsUrl,
    lastUpdated: new Date().toISOString(),
    teams: hydratedTeams
  };
}
