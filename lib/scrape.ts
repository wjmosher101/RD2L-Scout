// lib/scrape.ts
import * as cheerio from "cheerio";

export type HeroStat = {
  hero: string;
  matches: number;
  winRate?: number;
  kda?: number;
  lane?: string;
};

export type ScoutResult = {
  playerName: string;
  role: string | null;
  dotabuffUrl: string | null;
  comfortHeroes: HeroStat[];
  banSuggestions: string[];
  notes: string[];
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

const HERO_NAMES = [
  "Abaddon","Alchemist","Ancient Apparition","Anti-Mage","Arc Warden","Axe","Bane","Batrider",
  "Beastmaster","Bloodseeker","Bounty Hunter","Brewmaster","Bristleback","Broodmother",
  "Centaur Warrunner","Chaos Knight","Chen","Clinkz","Clockwerk","Crystal Maiden","Dark Seer",
  "Dark Willow","Dawnbreaker","Dazzle","Death Prophet","Disruptor","Doom","Dragon Knight",
  "Drow Ranger","Earth Spirit","Earthshaker","Elder Titan","Ember Spirit","Enchantress","Enigma",
  "Faceless Void","Grimstroke","Gyrocopter","Hoodwink","Huskar","Invoker","Io","Jakiro",
  "Juggernaut","Keeper of the Light","Kez","Kunkka","Largo","Legion Commander","Leshrac","Lich",
  "Lifestealer","Lina","Lion","Lone Druid","Luna","Lycan","Magnus","Marci","Mars","Medusa",
  "Meepo","Mirana","Monkey King","Morphling","Muerta","Naga Siren","Nature's Prophet","Necrophos",
  "Night Stalker","Nyx Assassin","Ogre Magi","Omniknight","Oracle","Outworld Destroyer",
  "Pangolier","Phantom Assassin","Phantom Lancer","Phoenix","Primal Beast","Puck","Pudge","Pugna",
  "Queen of Pain","Razor","Riki","Ringmaster","Rubick","Sand King","Shadow Demon","Shadow Fiend",
  "Shadow Shaman","Silencer","Skywrath Mage","Slardar","Slark","Snapfire","Sniper","Spectre",
  "Spirit Breaker","Storm Spirit","Sven","Techies","Templar Assassin","Terrorblade","Tidehunter",
  "Timbersaw","Tinker","Tiny","Treant Protector","Troll Warlord","Tusk","Underlord","Undying",
  "Ursa","Vengeful Spirit","Venomancer","Viper","Visage","Void Spirit","Warlock","Weaver",
  "Windranger","Winter Wyvern","Witch Doctor","Wraith King","Zeus",
];

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function clampRole(role: string | null): string | null {
  if (!role) return null;
  const cleaned = role.trim();
  const valid = ["Safe Lane", "Mid Lane", "Off Lane", "Support", "Roaming"];
  const hit = valid.find((v) => cleaned.toLowerCase().includes(v.toLowerCase()));
  return hit ?? cleaned;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }

  return await res.text();
}

function normalizeText(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textLines($: cheerio.CheerioAPI): string[] {
  const raw = normalizeText($.root().text());
  return raw
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractRoleFromText(lines: string[]): string | null {
  const joined = lines.join("\n");

  const roleHit =
    joined.match(/\b(Safe Lane|Mid Lane|Off Lane|Support|Roaming)\s+Role\b/i) ||
    joined.match(/\b(\d+%)\s+(Safe Lane|Mid Lane|Off Lane|Support|Roaming)\b/i);

  if (roleHit) {
    return clampRole(roleHit[2] || roleHit[1] || null);
  }

  return null;
}

function extractPlayerName($: cheerio.CheerioAPI, lines: string[]): string {
  const h1 = $("h1").first().text().trim();
  if (h1) return h1;

  const firstBig = lines.find((l) => l.length > 1 && l.length < 50 && !l.includes("DOTABUFF"));
  return firstBig || "Unknown Player";
}

function tryExtractHeroesFromTable($: cheerio.CheerioAPI): HeroStat[] {
  const out: HeroStat[] = [];

  $("table tbody tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, td) => normalizeText($(td).text()))
      .get()
      .filter(Boolean);

    if (cells.length < 3) return;

    const hero =
      $(row).find('a[href*="/heroes/"]').first().text().trim() ||
      cells.find((c) => HERO_NAMES.includes(c));

    if (!hero) return;

    const nums = cells
      .join(" ")
      .match(/\d+(?:\.\d+)?%?/g)?.map((x) => x.trim()) ?? [];

    const matches = Number(nums[0]?.replace("%", "") ?? 0);
    const winRate = nums.find((n) => n.endsWith("%"));
    const kdaCandidate = nums.find((n, i) => i > 0 && !n.endsWith("%"));

    if (!matches || Number.isNaN(matches)) return;

    out.push({
      hero,
      matches,
      winRate: winRate ? Number(winRate.replace("%", "")) : undefined,
      kda: kdaCandidate ? Number(kdaCandidate) : undefined,
    });
  });

  return out;
}

function extractHeroesFromText(lines: string[]): HeroStat[] {
  const out: HeroStat[] = [];

  const startIdx = lines.findIndex((l) => /Most Played Heroes/i.test(l));
  if (startIdx === -1) return out;

  const slice = lines.slice(startIdx, Math.min(lines.length, startIdx + 140));

  for (let i = 0; i < slice.length; i++) {
    const hero = slice[i];
    if (!HERO_NAMES.includes(hero)) continue;

    const matchesStr = slice[i + 1];
    const winRateStr = slice[i + 2];
    const kdaStr = slice[i + 3];

    const matches = Number(matchesStr);
    const winRate = winRateStr?.includes("%")
      ? Number(winRateStr.replace("%", ""))
      : undefined;
    const kda = kdaStr && /^\d+(\.\d+)?$/.test(kdaStr) ? Number(kdaStr) : undefined;

    if (!Number.isFinite(matches) || matches <= 0) continue;

    out.push({
      hero,
      matches,
      winRate,
      kda,
    });
  }

  return out;
}

function mergeHeroes(primary: HeroStat[], fallback: HeroStat[]): HeroStat[] {
  const map = new Map<string, HeroStat>();

  for (const row of [...primary, ...fallback]) {
    const prev = map.get(row.hero);
    if (!prev || row.matches > prev.matches) {
      map.set(row.hero, row);
    }
  }

  return [...map.values()].sort((a, b) => b.matches - a.matches);
}

function laneFromRole(role: string | null): string | undefined {
  if (!role) return undefined;
  if (/mid/i.test(role)) return "Mid Lane";
  if (/safe/i.test(role)) return "Safe Lane";
  if (/off/i.test(role)) return "Off Lane";
  if (/support/i.test(role)) return "Support";
  if (/roaming/i.test(role)) return "Roaming";
  return undefined;
}

function buildBanSuggestions(heroes: HeroStat[], role: string | null): string[] {
  const preferredLane = laneFromRole(role);

  const filtered = heroes
    .filter((h) => (preferredLane ? h.lane === preferredLane || !h.lane : true))
    .sort((a, b) => {
      const aScore = a.matches * 2 + (a.winRate ?? 50) / 10 + (a.kda ?? 2);
      const bScore = b.matches * 2 + (b.winRate ?? 50) / 10 + (b.kda ?? 2);
      return bScore - aScore;
    })
    .slice(0, 5)
    .map((h) => h.hero);

  return uniq(filtered);
}

function extractSummaryNotes(lines: string[]): string[] {
  const notes: string[] = [];
  const joined = lines.join("\n");

  const pro = joined.match(/Professional\s+(\d+)/i);
  const amateur = joined.match(/Amateur\s+(\d+)/i);

  if (pro) notes.push(`Professional sample: ${pro[1]} matches`);
  if (amateur) notes.push(`Amateur sample: ${amateur[1]} matches`);

  const recentTeamIdx = lines.findIndex((l) => /Recent Teams/i.test(l));
  if (recentTeamIdx !== -1) {
    const teamLine = lines.slice(recentTeamIdx + 1, recentTeamIdx + 10).find((l) => /\d{4}-\d{2}-\d{2}/.test(l));
    if (teamLine) notes.push(`Recent team activity found on Dotabuff esports page`);
  }

  return notes;
}

export async function scrapeDotabuffEsportsHeroPage(url: string): Promise<ScoutResult> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const lines = textLines($);

  const playerName = extractPlayerName($, lines);
  const role = extractRoleFromText(lines);

  const tableHeroes = tryExtractHeroesFromTable($);
  const textHeroes = extractHeroesFromText(lines);
  const mergedHeroes = mergeHeroes(tableHeroes, textHeroes)
    .slice(0, 8)
    .map((h) => ({ ...h, lane: laneFromRole(role) }));

  const banSuggestions = buildBanSuggestions(mergedHeroes, role);
  const notes = extractSummaryNotes(lines);

  if (!mergedHeroes.length) {
    notes.unshift("Dotabuff esports page loaded, but Most Played Heroes could not be parsed.");
  }

  return {
    playerName,
    role,
    dotabuffUrl: url,
    comfortHeroes: mergedHeroes,
    banSuggestions,
    notes,
  };
}

/**
 * This is the wrapper your UI/API should call.
 * Pass in the dotabuff esports hero URL if you already have it.
 */
export async function scoutPlayerFromDotabuff(input: {
  playerName: string;
  dotabuffEsportsHeroUrl?: string | null;
}): Promise<ScoutResult> {
  if (!input.dotabuffEsportsHeroUrl) {
    return {
      playerName: input.playerName,
      role: null,
      dotabuffUrl: null,
      comfortHeroes: [],
      banSuggestions: [],
      notes: ["No Dotabuff esports hero URL was provided."],
    };
  }

  try {
    return await scrapeDotabuffEsportsHeroPage(input.dotabuffEsportsHeroUrl);
  } catch (err) {
    return {
      playerName: input.playerName,
      role: null,
      dotabuffUrl: input.dotabuffEsportsHeroUrl,
      comfortHeroes: [],
      banSuggestions: [],
      notes: [
        err instanceof Error
          ? `Dotabuff scrape failed: ${err.message}`
          : "Dotabuff scrape failed for an unknown reason.",
      ],
    };
  }
}
