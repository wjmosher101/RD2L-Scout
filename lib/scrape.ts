import * as cheerio from 'cheerio';
import { DEFAULT_SEASON_LABEL, USER_AGENT } from '@/lib/config';
import type { DivisionScout, HeroStat, PlayerScout, TeamScout } from '@/lib/types';

const RD2L_BASE = 'https://rd2l.gg';
const DOTABUFF_BASE = 'https://www.dotabuff.com';

function absoluteUrl(base: string, maybeRelative: string | undefined): string | undefined {
  if (!maybeRelative) return undefined;
  if (maybeRelative.startsWith('http://') || maybeRelative.startsWith('https://')) return maybeRelative;
  return new URL(maybeRelative, base).toString();
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
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'cache-control': 'no-cache',
          'pragma': 'no-cache'
        },
        cache: 'no-store',
        next: { revalidate: 0 }
      });

      if (response.ok) {
        return await response.text();
      }

      const error = new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText || '<none>'}`);

      // Retry Cloudflare/server problems only
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

async function parseDivision(divisionUrl: string): Promise<{ divisionName: string; seasonName: string; teamsUrl: string }> {
  const html = await fetchHtml(divisionUrl);
  const $ = cheerio.load(html);

  const divisionName = $('h3').first().text().trim() || 'RD2L Division';
  const activeSeasonRow = $('h4:contains("Active Season")').nextAll('table').first().find('tr').eq(1);
  const seasonName = activeSeasonRow.find('td').first().text().trim() || 'Season 37';

  let teamsUrl = activeSeasonRow.find('a').filter((_, el) => $(el).text().trim().toLowerCase() === 'teams').attr('href');
  if (!teamsUrl) {
    teamsUrl = $('a').filter((_, el) => $(el).text().trim().toLowerCase() === 'teams').first().attr('href');
  }

  const absoluteTeamsUrl = absoluteUrl(RD2L_BASE, teamsUrl);
  if (!absoluteTeamsUrl) {
    throw new Error(`Could not find teams link on division page: ${divisionUrl}`);
  }

  return { divisionName, seasonName, teamsUrl: absoluteTeamsUrl };
}

async function parseTeams(teamsUrl: string): Promise<TeamScout[]> {
  const html = await fetchHtml(teamsUrl);
  const $ = cheerio.load(html);
  const teamLinks = new Map<string, string>();

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (!href || !text) return;
    if (/\/teams\//.test(href)) {
      teamLinks.set(text, absoluteUrl(RD2L_BASE, href)!);
    }
  });

  const teams: TeamScout[] = [];
  for (const [name, teamUrl] of teamLinks.entries()) {
    teams.push({ name, teamUrl, players: [] });
  }

  return teams;
}

async function parseTeamRoster(team: TeamScout): Promise<TeamScout> {
  const html = await fetchHtml(team.teamUrl);
  const $ = cheerio.load(html);

  const roster: { name: string; rd2lProfileUrl: string }[] = [];

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (!href || !text) return;
    if (/\/profile\//.test(href)) {
      roster.push({ name: text, rd2lProfileUrl: absoluteUrl(RD2L_BASE, href)! });
    }
  });

  const uniqueRoster = Array.from(new Map(roster.map((entry) => [entry.rd2lProfileUrl, entry])).values());

const players: PlayerScout[] = [];

for (const player of uniqueRoster) {
  try {
    const parsedPlayer = await parseRd2lProfile(player.name, player.rd2lProfileUrl);
    players.push(parsedPlayer);
    await sleep(500);
  } catch (error) {
    players.push({
      name: player.name,
      rd2lProfileUrl: player.rd2lProfileUrl,
      comfortHeroes: [],
      notes: [
        error instanceof Error ? error.message : 'Failed to parse RD2L profile.'
      ]
    });
  }
}

return {
  ...team,
  captain: uniqueRoster[0]?.name,
  players
};
}

async function parseRd2lProfile(name: string, rd2lProfileUrl: string): Promise<PlayerScout> {
  const html = await fetchHtml(rd2lProfileUrl);
  const $ = cheerio.load(html);

  let dotabuffUrl: string | undefined;
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href?.includes('dotabuff.com/players/')) {
      dotabuffUrl = href.startsWith('http') ? href : `https:${href}`;
    }
  });

  const player: PlayerScout = {
    name,
    rd2lProfileUrl,
    dotabuffUrl,
    comfortHeroes: [],
    notes: []
  };

  if (!dotabuffUrl) {
    player.notes.push('No Dotabuff link found on RD2L profile.');
    return player;
  }

  try {
    const comfortHeroes = await parseDotabuffOverview(dotabuffUrl);
    player.comfortHeroes = comfortHeroes;
  } catch (error) {
    player.notes.push(error instanceof Error ? error.message : 'Could not parse Dotabuff overview.');
  }

  try {
    const esports = await parseDotabuffEsports(dotabuffUrl, DEFAULT_SEASON_LABEL);
    player.dotabuffEsportsUrl = esports.url;
    player.roleSummary = esports.roleSummary;
  } catch (error) {
    player.notes.push(error instanceof Error ? error.message : 'Could not parse Dotabuff esports page.');
  }

  return player;
}

async function parseDotabuffOverview(dotabuffUrl: string): Promise<HeroStat[]> {
  const html = await fetchHtml(dotabuffUrl);
  const $ = cheerio.load(html);

  const heroes: HeroStat[] = [];

  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    const firstCellText = cells.eq(0).text().trim();
    if (!firstCellText) return;

    const matches = Number(cells.eq(1).text().trim().replace(/,/g, '')) || undefined;
    const winRate = cells.eq(2).text().trim() || undefined;

    if (firstCellText.length > 1 && heroes.length < 6) {
      heroes.push({ name: firstCellText, matches, winRate });
    }
  });

  if (!heroes.length) {
    throw new Error(`Could not find most-played heroes on ${dotabuffUrl}`);
  }

  return heroes;
}

function buildEsportsUrl(dotabuffUrl: string): string {
  const playerId = dotabuffUrl.match(/players\/(\d+)/)?.[1];
  const slug = dotabuffUrl
    .replace(/^https?:\/\/www\.dotabuff\.com\/players\/\d+/, '')
    .replace(/^\//, '');

  return `${DOTABUFF_BASE}/esports/players/${playerId}${slug ? `-${slug}` : ''}`;
}

async function parseDotabuffEsports(dotabuffUrl: string, seasonLabel: string) {
  const esportsUrl = buildEsportsUrl(dotabuffUrl);
  const html = await fetchHtml(esportsUrl);
  const $ = cheerio.load(html);

  const roleBlock = $('body').text();
  const primaryRole = /Core Role\s+([^\n]+)/i.exec(roleBlock)?.[1]?.trim();
  const primaryLane = /(Safe Lane|Mid Lane|Off Lane|Roaming|Support)/i.exec(roleBlock)?.[1]?.trim();

  const heroes: HeroStat[] = [];
  $('table tbody tr').each((_, row) => {
    const name = $(row).find('td').eq(0).text().trim();
    if (!name || heroes.length >= 5) return;
    const matches = Number($(row).find('td').eq(1).text().trim().replace(/,/g, '')) || undefined;
    const winRate = $(row).find('td').eq(2).text().trim() || undefined;
    heroes.push({ name, matches, winRate });
  });

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
        notes: [
          error instanceof Error ? error.message : 'Failed to parse team roster.'
        ]
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
