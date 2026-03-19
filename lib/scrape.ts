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
function cleanText(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const num = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : undefined;
}

function extractHeroRows($: cheerio.CheerioAPI, limit = 6): HeroStat[] {
  const heroes: HeroStat[] = [];

  $('table tbody tr').each((_, row) => {
    if (heroes.length >= limit) return;

    const heroLink = $(row).find('a[href*="/heroes/"]').first();
    if (!heroLink.length) return;

    const name = cleanText(heroLink.text());
    if (!name) return;

    const cells = $(row).find('td');
    const numericTexts = cells
      .map((__, cell) => cleanText($(cell).text()))
      .get()
      .filter(Boolean) as string[];

    const matches = numericTexts
      .map((text) => parseNumber(text))
      .find((value) => value !== undefined);

    const winRate = numericTexts.find((text) => /%/.test(text));

    heroes.push({
      name,
      matches,
      winRate
    });
  });

  return heroes;
}
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
function cleanText(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const num = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : undefined;
}

async function parseDotabuffOverview(dotabuffUrl: string): Promise<HeroStat[]> {
  const html = await fetchHtml(dotabuffUrl);
  const $ = cheerio.load(html);

  const heroes = extractHeroRows($, 6);

  if (!heroes.length) {
    throw new Error(`Could not find hero rows on ${dotabuffUrl}`);
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

  const pageText = cleanText($('body').text()) || '';

  const primaryLane =
    pageText.match(/\b(Safe Lane|Mid Lane|Off Lane|Roaming|Support)\b/i)?.[1];

  const primaryRole =
    pageText.match(/\b(Carry|Mid|Offlane|Support|Roamer)\b/i)?.[1] || primaryLane;

  const heroes = extractHeroRows($, 5);

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
for (const player of uniqueRoster) {
  try {
    // 🔥 Extract player ID directly from RD2L profile URL
    const playerId = player.rd2lProfileUrl.match(/profile\/(\d+)/)?.[1];

    if (!playerId) {
      throw new Error('Could not extract player ID');
    }

    const dotabuffUrl = `https://www.dotabuff.com/players/${playerId}`;

    const parsedPlayer: PlayerScout = {
      name: player.name,
      rd2lProfileUrl: player.rd2lProfileUrl,
      dotabuffUrl,
      comfortHeroes: [],
      notes: []
    };

    // 👇 still use your existing Dotabuff parsers
    try {
      parsedPlayer.comfortHeroes = await parseDotabuffOverview(dotabuffUrl);
    } catch (error) {
      parsedPlayer.notes.push('Failed to load Dotabuff overview');
    }

    try {
      const esports = await parseDotabuffEsports(dotabuffUrl, DEFAULT_SEASON_LABEL);
      parsedPlayer.dotabuffEsportsUrl = esports.url;
      parsedPlayer.roleSummary = esports.roleSummary;
    } catch (error) {
      parsedPlayer.notes.push('Failed to load Dotabuff esports');
    }

    players.push(parsedPlayer);
    await sleep(300); // faster now
  } catch (error) {
    players.push({
      name: player.name,
      rd2lProfileUrl: player.rd2lProfileUrl,
      comfortHeroes: [],
      notes: ['Failed to process player']
    });
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
