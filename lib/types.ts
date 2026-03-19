export type HeroStat = {
  name: string;
  matches?: number;
  winRate?: string;
  note?: string;
};

export type Rd2lRoleSummary = {
  primaryRole?: string;
  primaryLane?: string;
  seasonLabel?: string;
  leagueName?: string;
  heroes: HeroStat[];
};

export type PlayerScout = {
  name: string;
  rd2lProfileUrl: string;
  dotabuffUrl?: string;
  dotabuffEsportsUrl?: string;
  comfortHeroes: HeroStat[];
  roleSummary?: Rd2lRoleSummary;
  notes: string[];
};

export type TeamScout = {
  name: string;
  teamUrl: string;
  captain?: string;
  players: PlayerScout[];
};

export type DivisionScout = {
  divisionName: string;
  seasonName: string;
  divisionUrl: string;
  teamsUrl: string;
  lastUpdated: string;
  teams: TeamScout[];
};
