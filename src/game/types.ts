export type StatKey =
  | "serve"
  | "forehand"
  | "backhand"
  | "volley"
  | "fitness"
  | "strength"
  | "speed"
  | "iq"
  | "mental"
  | "pressure"
  | "experience";

export type Wealth = "tight" | "modest" | "comfortable" | "wealthy";
export type Injury = "none" | "minor" | "moderate" | "serious";
export type Path = "undecided" | "college" | "pro";
export type Surface = "hard" | "clay" | "grass";
export type Tier =
  | "junior"
  | "college"
  | "itf"
  | "ch"
  | "atp250"
  | "atp500"
  | "m1000"
  | "gs"
  | "olympics"
  | "asian";
export type Schedule = "light" | "normal" | "heavy";
export type Phase = "intro" | "script" | "season" | "summary" | "ending";
export type SlamId = "ao" | "rg" | "wi" | "us";

export type Stats = Record<StatKey, number>;

export interface Hidden {
  technical: number;
  physical: number;
  ballFeel: number;
  tennisIQ: number;
  mental: number;
  durability: number;
  learning: number;
  luck: number;
  talent: number;
}

export interface Coach {
  id: string;
  name: string;
  archetype: string;
  line: string;
  tech: number;
  phys: number;
  mental: number;
  iq: number;
  cost: number;
  minAge: number;
  quality: number;
  gate: "local" | "money" | "overseas";
  youth?: boolean;
}

export interface Sponsor {
  brand: string;
  annual: number;
  sinceYear: number;
}

export interface Partner {
  name: string;
  sinceYear: number;
}

export interface Choice {
  id: string;
  label: string;
  hint: string;
  tone?: "default" | "risk" | "quiet" | "exit";
}

export interface StoryCard {
  kind: "story";
  kicker: string;
  title: string;
  body: string;
  choices: Choice[];
  receipt?: Receipt;
}

export interface MatchLine {
  round: string;
  opponent: string;
  oppRank: number | null;
  won: boolean;
  score: string;
  legend: boolean;
}

export interface TournamentResult {
  id: string;
  name: string;
  tier: Tier;
  surface: Surface;
  outcome: string;
  wins: number;
  rounds: number;
  points: number;
  prize: number;
  matches: MatchLine[];
  notable: boolean;
}

export interface SeasonReport {
  results: TournamentResult[];
  injuryNote: string | null;
  biggestWin: string | null;
  quiet: boolean;
}

export interface Summary {
  year: number;
  age: number;
  rankLabel: string;
  highlights: string[];
  biggestWin: string | null;
  development: string[];
  prize: number;
  sponsorPay: number;
  story: string;
  next: string;
  worldNews: string;
  results: { name: string; outcome: string; surface: Surface }[];
}

export interface Memory {
  id: string;
  year: number;
  age: number;
  text: string;
}

export interface Receipt {
  choice: string;
  now: string[];
  later?: string;
}

export interface DecisionRecord {
  year: number;
  age: number;
  choiceId: string;
  text: string;
}

export interface Ending {
  label: string;
  headline: string;
  paragraphs: string[];
  tennis: { label: string; value: string }[];
  life: { label: string; value: string }[];
  history: string[];
  seed: string;
}

export type Card =
  | StoryCard
  | { kind: "season"; report: SeasonReport }
  | { kind: "summary"; summary: Summary }
  | { kind: "ending"; ending: Ending };

export interface Rival {
  name: string;
  style: string;
  bond: "rival" | "friend" | "respect" | "bitter";
  form: number;
  ceiling: number;
}

export interface Investment {
  kind: "medical" | "fitness" | "tech" | "data" | "network";
  untilYear: number;
}

export interface Echo {
  year: number;
  text: string;
}

export interface Step {
  type: "training" | "event";
  id: string;
}

export interface Titles {
  gs: number;
  m1000: number;
  atp: number;
  ch: number;
  other: number;
}

export interface GameState {
  seed: string;
  name: string;
  year: number;
  age: number;
  adultHeight: number;
  build: string;
  wealth: Wealth;
  hidden: Hidden;
  stats: Stats;
  confidence: number;
  motivation: number;
  fame: number;
  money: number;
  chronic: number;
  injury: Injury;
  rushedReturn: boolean;
  missedHalf: boolean;
  coach: Coach;
  coachNote: string;
  sponsor: Sponsor | null;
  partner: Partner | null;
  path: Path;
  degree: boolean;
  yearsPro: number;
  ranking: number | null;
  juniorRank: number | null;
  points: number;
  wins: number;
  losses: number;
  titles: Titles;
  gsResults: string[];
  earnings: number;
  sponsorTotal: number;
  peakRank: number | null;
  peakRankYear: number | null;
  firstTop100Age: number | null;
  h2h: Record<string, { w: number; l: number }>;
  notableWins: string[];
  historyChanges: string[];
  slamEdits: Partial<Record<number, Partial<Record<SlamId, string>>>>;
  majorInjuries: string[];
  coachesHad: string[];
  decisions: DecisionRecord[];
  decisionIds: string[];
  script: Step[];
  step: number;
  phaseInYear: Phase;
  card: Card;
  season: SeasonReport | null;
  summary: Summary | null;
  yearStartStats: Stats;
  yearStory: string[];
  yearPrize: number;
  yearSponsor: number;
  schedule: Schedule;
  focusLabel: string;
  overtrain: boolean;
  studyYear: boolean;
  distracted: boolean;
  investLeft: number;
  overseas: boolean;
  scoutIgnored: boolean;
  collegeTitles: number;
  olympic: string | null;
  asian: string | null;
  lowYears: number;
  peopleGaveUp: boolean;
  wildcardUsed: boolean;
  bonusSlam: boolean;
  studiesNeglected: boolean;
  pendingRetire: string | null;
  retiredReason: string | null;
  flash: string | null;
  surfaceBias: Record<Surface, number>;
  rankHistory: { year: number; rank: number | null }[];
  bestGs: string;
  metLegends: string[];
  /** 上一季全國賽、亞洲青少年賽的成績，用來決定能不能出國。 */
  lastJunior: { nat: string | null; asia: string | null };
  /** 曾經打進大師賽或大滿貫層級。健康的年份不會掉回 ITF。 */
  bigTour: boolean;
  /** 不顯示給玩家的後果。值是發生年份，或次數。 */
  flags: Record<string, number>;
  rivals: Rival[];
  investments: Investment[];
  echoes: Echo[];
  /** 這一年還沒走完的卡。 */
  yearQueue: string[];
  /** 玩家事後還認得出來的事。不是隱藏數值。 */
  memories: Memory[];
}
