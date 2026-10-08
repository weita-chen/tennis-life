import { coachMult } from "./coaches";
import {
  ALL_KEYS,
  MENT_KEYS,
  PHYS_KEYS,
  STAT_LABEL,
  TECH_KEYS,
  era,
  rating,
} from "./format";
import {
  ASIAN_GAMES,
  OLYMPICS,
  SLAM_NAME,
  activeLegends,
  approxRank,
  baselineNo1,
  baselineRank,
  baselineSlam,
  strengthAt,
  topLegend,
  playerName,
  withOriginal,
} from "./history";
import { clamp, gaussian, pick, rngFor, weighted } from "./rng";
import type {
  GameState,
  MatchLine,
  SeasonReport,
  SlamId,
  StatKey,
  Surface,
  Tier,
  TournamentResult,
} from "./types";

export type Focus = "coach" | "tech" | "phys" | "mental" | "intense" | "rest" | "play";

const TW_NAMES = [
  "陳柏宏",
  "林承恩",
  "黃子軒",
  "張家豪",
  "吳承翰",
  "周品睿",
  "許宇翔",
  "蔡廷恩",
  "鄭宥辰",
  "王紹齊",
  "劉奕辰",
  "楊宜謙",
  "賴品睿",
  "郭子恆",
  "謝承恩",
  "洪柏宇",
  "羅家維",
  "簡廷宇",
  "葉承翰",
  "吳昱成",
  "陳冠宇",
  "林敬恆",
  "黃柏翰",
  "張子謙",
  "周宇恩",
  "高承祐",
  "潘柏辰",
  "呂家凱",
];

const FOREIGN: [string, string][] = [
  ["馬丁·柯林", "Martin Colin"],
  ["安德烈·霍夫", "Andrei Hoff"],
  ["裴瑞拉", "Pereira"],
  ["小野蓮", "Ren Ono"],
  ["金民宰", "Kim Min-jae"],
  ["盧卡·羅西", "Luca Rossi"],
  ["伯格", "Berg"],
  ["桑切斯", "Sanchez"],
  ["伊藤颯", "Hayate Ito"],
  ["杜瓦爾", "Duval"],
  ["克拉維茨", "Kravitz"],
  ["中島律", "Ritsu Nakajima"],
  ["努涅斯", "Nunez"],
  ["楊森", "Jansen"],
  ["費雪", "Fischer"],
  ["岡田陸", "Riku Okada"],
  ["莫雷蒂", "Moretti"],
  ["狄亞茲", "Diaz"],
  ["克拉克", "Clark"],
  ["帕奎特", "Paquette"],
  ["歐拉", "Ola"],
  ["施密特", "Schmidt"],
  ["李維", "Levi"],
  ["卡特", "Carter"],
  ["高橋湊", "Minato Takahashi"],
  ["諾瓦克·彼得", "Novak Peter"],
  ["艾爾南德茲", "Hernandez"],
];

function withLevel(name: string, tier: Tier): string {
  const tag =
    tier === "gs"
      ? "大滿貫"
      : tier === "m1000"
        ? "ATP 1000"
        : tier === "atp500"
          ? "ATP 500"
          : tier === "atp250"
            ? "ATP 250"
            : tier === "ch"
              ? "ATP 125 挑戰賽"
              : null;
  if (!tag || name.includes(tag)) return name;
  return `${name}（${tag}）`;
}

function tw(
  id: string,
  name: string,
  tier: Tier,
  surface: Surface,
  rounds: number,
  month: number,
  notable = false,
): Slot {
  return { id, name: withLevel(name, tier), tier, surface, rounds, month, notable, domestic: true };
}

function unusedName(rng: () => number, used: Set<string>, domestic: boolean): string {
  let guard = 0;
  let name = "";
  do {
    if (domestic) name = pick(rng, TW_NAMES);
    else {
      const pair = pick(rng, FOREIGN);
      name = `${pair[0]}（${pair[1]}）`;
    }
    guard += 1;
  } while (used.has(name) && guard < 8);
  used.add(name);
  return name;
}

interface Slot {
  id: string;
  name: string;
  tier: Tier;
  surface: Surface;
  rounds: number;
  month: number;
  notable: boolean;
  slam?: SlamId;
  domestic?: boolean;
}

const OUTCOME_RANK = ["冠軍", "亞軍", "四強", "八強", "十六強", "三十二強", "六十四強", "首輪", "首輪"];

function better(a: string, b: string): string {
  const ia = OUTCOME_RANK.indexOf(a);
  const ib = OUTCOME_RANK.indexOf(b);
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia <= ib ? a : b;
}

function outcomeOf(wins: number, rounds: number): string {
  if (wins >= rounds) return "冠軍";
  const stage = rounds - wins;
  const map: Record<number, string> = {
    1: "亞軍",
    2: "四強",
    3: "八強",
    4: "十六強",
    5: "三十二強",
    6: "六十四強",
    7: "首輪",
  };
  return map[stage] ?? "首輪";
}

function atLeast(outcome: string | null | undefined, min: string): boolean {
  if (!outcome) return false;
  const a = OUTCOME_RANK.indexOf(outcome);
  const b = OUTCOME_RANK.indexOf(min);
  if (a < 0 || b < 0) return false;
  return a <= b;
}

const JUNIOR_LADDER = ["natj", "aj", "jao", "jrg", "jwi"];

function maxWinsUnder(rounds: number, capIndex: number): number {
  let maxW = 0;
  for (let w = 0; w <= rounds; w++) {
    const idx = OUTCOME_RANK.indexOf(outcomeOf(w, rounds));
    if (idx >= capIndex) maxW = w;
  }
  return maxW;
}

function scratchJunior(t: Slot, results: TournamentResult[]): string | null {
  if (!JUNIOR_LADDER.includes(t.id) || t.id === "natj") return null;
  const nat = results.find((r) => r.id.endsWith("-natj"));
  if (nat && !atLeast(nat.outcome, "四強")) return "全國賽沒進前四，後面的出國比賽都推掉了。";
  if (t.id === "jao" || t.id === "jrg" || t.id === "jwi") {
    const asia = results.find((r) => r.id.endsWith("-aj"));
    if (asia && !atLeast(asia.outcome, "四強") && !(nat && atLeast(nat.outcome, "亞軍"))) {
      return "亞洲賽沒進前四，後面的大滿貫青少年就不去了。";
    }
  }
  return null;
}

function roundLabels(n: number): string[] {
  const tail = ["決賽", "四強", "八強", "十六強", "三十二強", "六十四強", "首輪", "會外賽"];
  return tail.slice(0, n).reverse();
}

function pointsFor(tier: Tier, wins: number, rounds: number): number {
  const title: Partial<Record<Tier, number>> = {
    itf: 18,
    ch: 100,
    atp250: 250,
    atp500: 500,
    m1000: 1000,
    gs: 2000,
  };
  const top = title[tier] ?? 0;
  if (!top) return 0;
  if (wins >= rounds) return top;
  if (wins === 0) return Math.max(0, Math.round(top * 0.01));
  return Math.max(1, Math.round(top * Math.pow(wins / rounds, 2.35)));
}

function prizeFor(tier: Tier, wins: number, rounds: number, year: number): number {
  const title: Partial<Record<Tier, number>> = {
    junior: 250,
    itf: 6500,
    ch: 26000,
    atp250: 145000,
    atp500: 400000,
    m1000: 1100000,
    gs: 2700000,
    asian: 6000,
  };
  const top = (title[tier] ?? 0) * era(year);
  if (top <= 0) return 0;
  if (wins >= rounds) return Math.round(top);
  const frac = [0.025, 0.05, 0.1, 0.18, 0.34, 0.58];
  return Math.round(top * (frac[Math.min(wins, frac.length - 1)] ?? 0.025));
}

function bandOf(state: GameState): string {
  if (state.path === "college" && state.age <= 22) return "col";
  if (state.age < 18 && state.path !== "pro") return "jun";
  const rank = state.ranking ?? 999;
  if (rank > 300) return "itf";
  if (rank > 140) return "ch";
  if (rank > 60) return "mid";
  if (rank > 20) return "high";
  return "elite";
}

function has(state: GameState, token: string): boolean {
  return state.decisionIds.includes(token);
}

function slot(
  id: string,
  name: string,
  tier: Tier,
  surface: Surface,
  rounds: number,
  month: number,
  notable = false,
  slam?: SlamId,
): Slot {
  return { id, name: withLevel(name, tier), tier, surface, rounds, month, notable, slam };
}

export function buildSlate(state: GameState): Slot[] {
  if (state.age < 11) return [];
  if (state.injury === "serious" && state.missedHalf) return [];
  const rng = rngFor(state.seed, `slate:${state.year}:${state.schedule}:${bandOf(state)}`);
  const light = state.schedule === "light";
  const heavy = state.schedule === "heavy";
  const band = bandOf(state);
  const out: Slot[] = [];
  const year = state.year;

  if (band === "jun") {
    const prior = state.lastJunior ?? { nat: null, asia: null };
    const natOk = atLeast(prior.nat, "四強");
    const natFinal = atLeast(prior.nat, "亞軍");
    const asiaOk = atLeast(prior.asia, "四強");
    const slamOk = asiaOk || natFinal;
    out.push(tw("natj", "全國青少年賽", "junior", "hard", 5, 4));
    if (state.age >= 13 && natOk) out.push(slot("aj", "亞洲青少年賽", "junior", "clay", 5, 6));
    if (!light && slamOk) {
      if (state.age >= 14) out.push(slot("jao", "青少年澳網", "junior", "hard", 6, 1, true));
      if (state.age >= 15) out.push(slot("jrg", "青少年法網", "junior", "clay", 6, 5, true));
      if (state.age >= 16) out.push(slot("jwi", "青少年溫布頓", "junior", "grass", 6, 7, true));
    }
    if (has(state, `early:${year}`)) out.push(tw("itf-early", "台南 ITF", "itf", "hard", 5, 8));
    if (state.age >= 13 && !natOk) {
      state.yearStory.push("全國賽還沒進前四，今年不出國。");
    } else if (state.age >= 14 && natOk && !slamOk && !light) {
      state.yearStory.push("亞洲賽還沒進前四，青少年大滿貫沒排到你。");
    } else if (light && slamOk && state.age >= 14) {
      state.yearStory.push("這一年練得少，青少年大滿貫先不去。");
    }
  } else if (band === "col") {
    out.push(tw("conf", "大專校際賽", "college", "hard", 4, 3));
    out.push(tw("natc", "全國大專網球賽", "college", "hard", 5, 5, true));
    if (has(state, `summer:${year}`)) out.push(slot("itf-sum", "佛州 ITF", "itf", "hard", 5, 7));
  } else {
    const gs: Slot[] = [
      slot("ao", "澳網", "gs", "hard", 7, 1, true, "ao"),
      slot("rg", "法網", "gs", "clay", 7, 5, true, "rg"),
      slot("wi", "溫布頓", "gs", "grass", 7, 7, true, "wi"),
      slot("us", "美網", "gs", "hard", 7, 9, true, "us"),
    ].filter((g) => g.slam && (year !== 2020 || g.slam !== "wi"));
    const m1000: Slot[] = [
      slot("iw", "印第安韋爾斯", "m1000", "hard", 6, 3, true),
      slot("mia", "邁阿密", "m1000", "hard", 6, 3, true),
      slot("mc", "蒙特卡羅", "m1000", "clay", 6, 4, true),
      slot("mad", "馬德里", "m1000", "clay", 6, 5, true),
      slot("rome", "羅馬", "m1000", "clay", 6, 5, true),
      slot("can", "加拿大", "m1000", "hard", 6, 8, true),
      slot("cin", "辛辛那提", "m1000", "hard", 6, 8, true),
      slot("sha", "上海", "m1000", "hard", 6, 10, true),
      slot("par", "巴黎", "m1000", "hard", 6, 11, true),
    ];
    const a250 = [
      slot("ack", "奧克蘭", "atp250", "hard", 5, 1),
      slot("hou", "休士頓", "atp250", "clay", 5, 4),
      slot("lyo", "里昂", "atp250", "clay", 5, 5),
      slot("was", "華盛頓", "atp250", "hard", 5, 8),
      slot("bj", "北京", "atp250", "hard", 5, 10),
    ];
    const a500 = [
      slot("rot", "鹿特丹", "atp500", "hard", 5, 2, true),
      slot("rio", "里約", "atp500", "clay", 5, 2, true),
      slot("bar", "巴塞隆納", "atp500", "clay", 5, 4, true),
      slot("tok", "東京", "atp500", "hard", 5, 10, true),
    ];
    const chs = [
      tw("khh", "高雄", "ch", "hard", 5, 2),
      slot("not", "諾丁漢", "ch", "grass", 5, 6),
      slot("lex", "萊克星頓", "ch", "hard", 5, 8),
      slot("bus", "釜山", "ch", "hard", 5, 4),
    ];
    const itfs = [
      tw("tn", "台南 ITF", "itf", "hard", 5, 1),
      slot("prov", "普羅旺斯 ITF", "itf", "clay", 5, 4),
      slot("fl", "佛州 ITF", "itf", "hard", 5, 7),
    ];

    const take = <T,>(arr: T[], n: number) => {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = tmp;
      }
      return copy.slice(0, n);
    };

    if (band === "itf") {
      out.push(...take(itfs, light ? 2 : 3));
      out.push(...take(chs, heavy ? 2 : 1));
    } else if (band === "ch") {
      out.push(...take(chs, light ? 2 : heavy ? 4 : 3));
      out.push(...take(a250, 1));
      if (heavy) out.push(...take(a500, 1));
    } else if (band === "mid") {
      out.push(...take(a250, light ? 1 : 2));
      out.push(...take(a500, 1));
      out.push(...take(gs, 1));
      if (!light) out.push(...take(chs, 1));
      if (heavy) out.push(...take(m1000, 1));
    } else if (band === "high") {
      out.push(...take(a250, light ? 0 : 1));
      out.push(...take(a500, 1));
      out.push(...take(m1000, light ? 1 : 2));
      out.push(...take(gs, light ? 1 : heavy ? 3 : 2));
    } else {
      out.push(...take(a500, 1));
      out.push(...take(m1000, light ? 1 : 2));
      out.push(...take(gs, light ? 2 : 4));
    }
    if (has(state, `wc:${year}`)) {
      out.push(slot("wc", "外卡會外賽", "atp250", "hard", 5, 6, true));
    }
  }

  const oly = OLYMPICS[year];
  if (oly && has(state, `oly:${year}`)) {
    out.push(slot("oly", `${oly.city}奧運`, "olympics", oly.surface, 6, 8, true));
  }
  const asian = ASIAN_GAMES[year];
  if (asian && has(state, `asian:${year}`)) {
    out.push(slot("asian", `${asian.city}亞運`, "asian", asian.surface, 5, 9, true));
  }

  out.sort((a, b) => a.month - b.month);
  const healthyBig =
    state.path === "pro" &&
    state.ranking != null &&
    state.ranking <= 60 &&
    !state.missedHalf &&
    state.injury !== "serious";
  const slateOut = healthyBig ? out.filter((t) => t.tier !== "itf" && t.tier !== "ch") : out;
  const kept = slateOut.length ? slateOut : out;
  if (state.missedHalf) return kept.slice(0, Math.max(1, Math.ceil(kept.length / 3)));
  return kept;
}

function field(tier: Tier, age: number, id = ""): [number, number] {
  if (tier === "junior") {
    const lo = 16 + age * 1.2;
    const hi = 24 + age * 1.45;
    if (id === "natj") return [lo, hi];
    if (id === "aj") return [lo + 7, hi + 8];
    return [lo + 13, hi + 14];
  }
  if (tier === "college") return [58, 69];
  if (tier === "itf") return [60, 68];
  if (tier === "ch") return [66, 76];
  if (tier === "atp250") return [70, 82];
  if (tier === "atp500") return [74, 86];
  if (tier === "m1000") return [76, 90];
  if (tier === "gs") return [74, 91];
  if (tier === "olympics") return [78, 93];
  return [64, 76];
}

function legendRank(strength: number, year: number, id: string): number {
  let r = approxRank(strength);
  const top = topLegend(year);
  if (top && id === top.id && strength >= 94) return 1;
  if (r <= 2 && top && id !== top.id) r = Math.max(3, r);
  return Math.max(1, r);
}

function winProb(player: number, opp: number, roundT: number, state: GameState): number {
  let pRating = player;
  if (roundT > 0.62) {
    pRating += (state.stats.pressure - 58) * 0.08 + (state.confidence - 52) * 0.05;
  }
  pRating += (state.hidden.luck - 50) * 0.012;
  const diff = pRating - opp;
  return clamp(1 / (1 + Math.exp(-diff / 6.15)), 0.05, 0.94);
}

function scoreLine(rng: () => number, won: boolean, p: number, five: boolean): string {
  const tight = p > 0.4 && p < 0.6;
  if (!five) {
    if (tight) {
      return won
        ? pick(rng, ["7-6 4-6 7-5", "6-4 6-7 7-6", "3-6 7-5 7-6"])
        : pick(rng, ["6-7 6-4 5-7", "7-6 3-6 4-6", "4-6 7-5 4-6"]);
    }
    return won
      ? pick(rng, ["6-3 6-4", "6-4 6-2", "7-5 6-4", "6-2 6-3"])
      : pick(rng, ["3-6 4-6", "4-6 4-6", "6-4 2-6 3-6", "5-7 4-6"]);
  }
  if (tight) {
    return won ? "4-6 7-6 6-3 3-6 7-5" : "7-6 4-6 6-4 6-7 4-6";
  }
  return won
    ? pick(rng, ["6-4 6-3 6-4", "7-6 6-4 6-2", "6-3 4-6 6-4 6-3"])
    : pick(rng, ["4-6 3-6 6-4 4-6", "6-4 4-6 4-6 3-6", "3-6 4-6 4-6"]);
}

function ceiling(state: GameState, key: StatKey): number {
  const h = state.hidden;
  const map: Record<StatKey, number> = {
    serve: h.technical * 0.72 + h.ballFeel * 0.28,
    forehand: h.ballFeel * 0.5 + h.technical * 0.5,
    backhand: h.ballFeel * 0.48 + h.technical * 0.52,
    volley: h.technical * 0.66 + h.ballFeel * 0.34,
    fitness: h.physical * 0.72 + h.durability * 0.28,
    strength: h.physical * 0.94 + 4,
    speed: h.physical * 0.9 + 6,
    iq: h.tennisIQ * 0.78 + h.learning * 0.22,
    mental: h.mental * 0.92 + 5,
    pressure: h.mental * 0.8 + h.tennisIQ * 0.2,
    experience: 99,
  };
  let c = map[key] + (state.coach.quality - 62) * 0.07;
  if (state.overseas) c += 1.6;
  return clamp(c, 28, 97);
}

function ageK(age: number, key: StatKey): number {
  const phys = PHYS_KEYS.includes(key);
  if (age < 10) return phys ? 0.72 : 0.88;
  if (age < 14) return 1.02;
  if (age < 19) return phys ? 1.1 : 1.18;
  if (age < 24) return phys ? 0.92 : 1.02;
  if (age < 29) return phys ? 0.58 : 0.78;
  if (age < 33) return phys ? 0.26 : 0.46;
  if (phys) return age < 36 ? -0.85 : -1.35;
  return 0.1;
}

function emphasis(focus: Focus, key: StatKey, state: GameState): number {
  const tech = TECH_KEYS.includes(key);
  const phys = PHYS_KEYS.includes(key);
  const ment = MENT_KEYS.includes(key);
  let emp = 0.7;
  if (focus === "tech" && tech) emp = 1.48;
  else if (focus === "tech" && phys) emp = 0.46;
  else if (focus === "phys" && phys) emp = 1.52;
  else if (focus === "phys" && tech) emp = 0.5;
  else if (focus === "mental" && ment) emp = 1.58;
  else if (focus === "mental" && tech) emp = 0.62;
  else if (focus === "intense") emp = 1.18;
  else if (focus === "rest" || focus === "play") emp = 0.36;
  else if (focus === "coach") emp = coachMult(state.coach, key, state.age);
  if (focus !== "coach") emp *= 0.84 + 0.16 * coachMult(state.coach, key, state.age);
  return emp;
}

export function train(state: GameState, focus: Focus): void {
  const rng = rngFor(state.seed, `grow:${state.year}:${focus}`);
  const before = { ...state.stats };
  if (state.age >= 18) {
    if (focus === "intense") state.schedule = "heavy";
    else if (focus === "rest" || focus === "play") state.schedule = "light";
    else state.schedule = "normal";
  }
  state.overtrain = focus === "intense";
  if (focus === "rest") {
    state.motivation = clamp(state.motivation + 6, 0, 100);
    state.chronic = Math.max(0, state.chronic - 8);
  }
  if (focus === "play") state.motivation = clamp(state.motivation + 3, 0, 100);
  if (focus === "intense") state.motivation = clamp(state.motivation - 2, 0, 100);

  for (const key of ALL_KEYS) {
    if (key === "experience") continue;
    const cur = state.stats[key];
    const cap = ceiling(state, key);
    const room = cap - cur;
    const ak = ageK(state.age, key);
    if (ak < 0) {
      if (!PHYS_KEYS.includes(key)) continue;
      const soft = (state.hidden.durability / 120) * (focus === "rest" || focus === "phys" ? 0.5 : 1);
      state.stats[key] = clamp(Math.round(cur + ak * soft), 1, 99);
      continue;
    }
    const learn = 0.72 + state.hidden.learning / 170;
    const motiv = 0.62 + state.motivation / 170;
    const noise = 0.86 + rng() * 0.28;
    let roomF = room <= 0 ? 0 : room < 12 ? Math.max(0.12, room / 12) : 1;
    const injF = state.injury === "none" ? 1 : state.injury === "minor" ? 0.72 : 0.38;
    let g = ak * emphasis(focus, key, state) * learn * motiv * noise * roomF * injF * 3.25;
    if (state.distracted) g *= 0.74;
    if (state.studyYear && key !== "iq") g *= 0.78;
    if (state.overseas) g *= 1.06;
    if (state.peopleGaveUp) g *= 0.6;
    if (state.investLeft > 0) g *= 1.05;
    state.stats[key] = clamp(cur + Math.max(0, Math.round(g)), 1, 99);
  }
  if (focus === "tech") {
    const weapon = TECH_KEYS.slice().sort((a, b) => state.stats[b] - state.stats[a])[0]!;
    if (state.stats[weapon] < ceiling(state, weapon)) {
      state.stats[weapon] = clamp(state.stats[weapon] + 1, 1, 99);
    }
  }
  if (state.coach.id === "huang") state.surfaceBias.clay = Math.min(18, state.surfaceBias.clay + 1);
  if (state.coach.id === "marc") state.surfaceBias.grass = Math.min(18, state.surfaceBias.grass + 0.8);

  const gains = ALL_KEYS.map((k) => ({ k, d: state.stats[k] - before[k] }))
    .filter((x) => x.d !== 0)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 2);
  state.flash = gains.length
    ? gains.map((g) => `${STAT_LABEL[g.k]} ${g.d > 0 ? "+" : ""}${g.d}`).join(" · ")
    : "這一年能力沒有明顯變化";
  const line: Record<Focus, string> =
    state.age <= 12
      ? {
          coach: "這一年照教練的表走。",
          tech: "教練要你今年多磨球。",
          phys: "教練要你先把體能練起來。",
          mental: "教練開始管你比賽時的心態。",
          intense: "教練把量加上去，家裡沒攔。",
          rest: "家裡要你練少一點。",
          play: "放學後不是整天都在球場。",
        }
      : {
          coach: "你這一年照教練的表走。",
          tech: "你把時間放在球上。",
          phys: "這一年你練得很勤，話比較少。",
          mental: "沒有球的時候，你也在想比賽。",
          intense: "你把量加上去。沒人攔你。",
          rest: "你自己把量降下來。",
          play: "你沒有把所有時間都放在球場。",
        };
  state.yearStory.push(line[focus]);
  const labels: Record<Focus, string> = {
    coach: "教練的表",
    tech: "技術",
    phys: "體能",
    mental: "心理",
    intense: "加量",
    rest: "減量",
    play: "生活",
  };
  state.focusLabel = labels[focus];
  state.decisions.push({
    year: state.year,
    age: state.age,
    choiceId: `train:${focus}`,
    text: `${state.year}，訓練重心是${labels[focus]}。`,
  });
  state.decisionIds.push(`train:${focus}:${state.year}`);
}

function injuryRisk(state: GameState): number {
  let p = 0.075;
  if (state.overtrain) p += 0.1;
  if (state.schedule === "heavy") p += 0.055;
  if (state.schedule === "light") p -= 0.03;
  if (state.age > 30) p += (state.age - 30) * 0.013;
  p += state.chronic * 0.0016;
  p -= (state.hidden.durability - 50) * 0.002;
  if (state.stats.fitness > 72) p -= 0.02;
  if (state.rushedReturn) p += 0.12;
  return clamp(p, 0.02, 0.62);
}

const HURT = ["手腕", "肩膀", "膝蓋", "鼠蹊", "背部", "腳踝"];

export function simulateSeason(state: GameState): void {
  const slate = buildSlate(state);
  const rng = rngFor(state.seed, `matches:${state.year}`);
  const inj = rngFor(state.seed, `injury:${state.year}`);
  const prevRank = state.ranking;
  state.points = 0;
  const results: TournamentResult[] = [];
  let biggest: { text: string; rank: number } | null = null;
  let note: string | null = null;
  const risk = injuryRisk(state);
  const hit = slate.length > 0 && inj() < risk;
  const playOrder = slate.slice().sort((a, b) => {
    const ia = JUNIOR_LADDER.indexOf(a.id);
    const ib = JUNIOR_LADDER.indexOf(b.id);
    if (ia >= 0 || ib >= 0) {
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    }
    return a.month - b.month;
  });
  const hitAt = hit ? Math.min(playOrder.length - 1, Math.floor(inj() * playOrder.length)) : -1;
  let stopped = false;
  let yearWins = 0;
  let yearLosses = 0;
  let capIndex = -1;
  let toldScratch = false;

  for (let i = 0; i < playOrder.length; i++) {
    const t = playOrder[i]!;
    if (stopped) break;
    const scratch = scratchJunior(t, results);
    if (scratch) {
      if (!toldScratch) {
        state.yearStory.push(scratch);
        toldScratch = true;
      }
      continue;
    }
    if (i === hitAt) {
      const roll = inj();
      const part = pick(injRngSafe(state), HURT);
      if (roll < 0.18) {
        state.injury = "serious";
        state.chronic = clamp(state.chronic + 16, 0, 100);
        state.majorInjuries.push(`${state.year} ${part}重傷`);
        note = `${part}受傷。你退出${t.name}，這一年剩下的比賽也不打了。`;
        stopped = true;
        break;
      }
      if (roll < 0.5) {
        state.injury = state.injury === "serious" ? "serious" : "moderate";
        state.chronic = clamp(state.chronic + 8, 0, 100);
        note = `${part}的傷讓你打不下去。${t.name}之後的比賽都取消了。`;
        stopped = true;
        break;
      }
      state.injury = state.injury === "none" ? "minor" : state.injury;
      note = `${part}有點不舒服。你還是把剩下的比賽打完。`;
    }

    const labels = roundLabels(t.rounds);
    const matches: MatchLine[] = [];
    let wins = 0;
    const used = new Set<string>();
    const [lo, hi] = field(t.tier, state.age, t.id);
    const onLadder = JUNIOR_LADDER.includes(t.id);
    const maxW = onLadder && capIndex >= 0 ? maxWinsUnder(t.rounds, capIndex) : t.rounds;
    for (let r = 0; r < t.rounds; r++) {
      const roundT = t.rounds === 1 ? 1 : r / (t.rounds - 1);
      const playerR = rating(state, t.surface);
      const opp = drawOpp(state, t, roundT, lo, hi, rng, used);
      const p = winProb(playerR, opp.strength, roundT, state);
      const won = wins < maxW && rng() < p;
      const five = t.tier === "gs";
      matches.push({
        round: labels[r] ?? "首輪",
        opponent: opp.name,
        oppRank: opp.rank,
        won,
        score: scoreLine(rng, won, p, five),
        legend: opp.legend,
      });
      if (opp.legendId) {
        const row = state.h2h[opp.legendId] ?? { w: 0, l: 0 };
        if (won) row.w += 1;
        else row.l += 1;
        state.h2h[opp.legendId] = row;
        if (!state.metLegends.includes(opp.legendId)) state.metLegends.push(opp.legendId);
      }
      if (won) {
        wins += 1;
        yearWins += 1;
        state.wins += 1;
        addExp(state, opp.legend ? 2 : 1);
        if (opp.rank != null && (biggest == null || opp.rank < biggest.rank)) {
          biggest = {
            rank: opp.rank,
            text: opp.rank <= 400 ? `擊敗世界第 ${opp.rank} ${opp.name}` : `擊敗${opp.name}`,
          };
        }
        if (opp.legend && opp.rank != null && opp.rank <= 20) {
          state.notableWins.push(`${state.year} ${t.name} 擊敗${opp.name}（世界第 ${opp.rank}）`);
          state.yearStory.push(`你在${t.name}擊敗了${opp.name}。`);
        }
      } else {
        yearLosses += 1;
        state.losses += 1;
        addExp(state, 0.5);
        break;
      }
    }

    const outcome = outcomeOf(wins, t.rounds);
    const points = pointsFor(t.tier, wins, t.rounds);
    const prize = prizeFor(t.tier, wins, t.rounds, state.year);
    state.points += points;
    state.yearPrize += prize;
    state.earnings += prize;
    state.money += prize;
    const notable =
      t.notable || wins >= t.rounds || matches.some((m) => m.legend && m.won) || t.tier === "gs";
    results.push({
      id: `${state.year}-${t.id}`,
      name: t.name,
      tier: t.tier,
      surface: t.surface,
      outcome,
      wins,
      rounds: t.rounds,
      points,
      prize,
      matches: notable ? matches : matches.slice(-1),
      notable,
    });
    if (onLadder) {
      const idx = OUTCOME_RANK.indexOf(outcome);
      if (idx >= 0) capIndex = idx;
    }

    if (wins >= t.rounds) {
      if (t.tier === "gs") {
        state.titles.gs += 1;
        state.bonusSlam = true;
        state.confidence = clamp(state.confidence + 8, 1, 99);
        state.fame = clamp(state.fame + 14, 0, 100);
      } else if (t.tier === "m1000") {
        state.titles.m1000 += 1;
        state.confidence = clamp(state.confidence + 5, 1, 99);
        state.fame = clamp(state.fame + 7, 0, 100);
      } else if (t.tier === "atp250" || t.tier === "atp500") {
        state.titles.atp += 1;
        state.confidence = clamp(state.confidence + 3, 1, 99);
        state.fame = clamp(state.fame + 3, 0, 100);
      } else if (t.tier === "ch") state.titles.ch += 1;
      else state.titles.other += 1;
      if (t.tier === "college" && t.id === "natc") state.collegeTitles += 1;
      state.motivation = clamp(state.motivation + 2, 0, 100);
      state.surfaceBias[t.surface] = Math.min(18, state.surfaceBias[t.surface] + 1.2);
      if (t.tier === "gs" || t.tier === "m1000" || t.tier === "olympics") {
        state.yearStory.push(`${t.name}拿下冠軍。`);
      }
    }

    if (t.tier === "gs" && t.slam) {
      state.gsResults.push(`${state.year} ${SLAM_NAME[t.slam]} ${outcome}`);
      state.bestGs = state.bestGs === "—" ? outcome : better(state.bestGs, outcome);
      const original = baselineSlam(state.year, t.slam);
      let champ: string | null = null;
      if (outcome === "冠軍") champ = state.name;
      else if (outcome === "亞軍") {
        const final = matches[matches.length - 1];
        if (final && !final.won) champ = final.opponent;
      }
      if (champ && original && bare(champ) !== bare(original)) {
        const prev = { ...(state.slamEdits[state.year] ?? {}) };
        prev[t.slam] = champ;
        state.slamEdits[state.year] = prev;
        state.historyChanges.push(
          champ === state.name
            ? `${state.year} ${SLAM_NAME[t.slam]}：冠軍換人了。原本是${withOriginal(original)}。`
            : `${state.year} ${SLAM_NAME[t.slam]}決賽你輸了，冠軍變成${champ}，不再是${withOriginal(original)}。`,
        );
      }
      if (
        (outcome === "冠軍" || outcome === "亞軍" || outcome === "四強") &&
        !state.historyChanges.some((h) => h.includes("第一個") || h.includes("第一次"))
      ) {
        state.historyChanges.push(
          outcome === "冠軍"
            ? `${state.year} ${SLAM_NAME[t.slam]}冠軍。你是第一個贏得大滿貫的台灣選手。`
            : `${state.year} ${SLAM_NAME[t.slam]}${outcome}。這是台灣選手第一次在大滿貫打到這個成績。`,
        );
      }
    }

    if (t.tier === "olympics") {
      const medal =
        outcome === "冠軍" ? "金牌" : outcome === "亞軍" ? "銀牌" : outcome === "四強" ? "銅牌" : outcome;
      state.olympic = `${state.year} ${t.name} ${medal}`;
      if (medal === "金牌" || medal === "銀牌" || medal === "銅牌") {
        state.fame = clamp(state.fame + (medal === "金牌" ? 12 : 6), 0, 100);
        state.historyChanges.push(`${state.olympic}。`);
      }
    }
    if (t.tier === "asian") {
      const medal =
        outcome === "冠軍" ? "金牌" : outcome === "亞軍" ? "銀牌" : outcome === "四強" ? "銅牌" : outcome;
      state.asian = `${state.year} ${t.name} ${medal}`;
      if (medal.endsWith("牌")) state.fame = clamp(state.fame + 4, 0, 100);
    }
    if (t.tier === "m1000" && wins >= t.rounds) {
      const taiwanMasters = state.historyChanges.some((h) => h.includes("大師賽冠軍"));
      if (!taiwanMasters) {
        state.historyChanges.push(`${state.year} ${t.name}：你成為台灣第一位大師賽冠軍。`);
      }
    }
  }

  const monthOf = new Map(slate.map((t) => [`${state.year}-${t.id}`, t.month]));
  results.sort((a, b) => (monthOf.get(a.id) ?? 0) - (monthOf.get(b.id) ?? 0));

  if (state.age < 18 && state.path !== "pro") {
    const natResult = results.find((r) => r.id.endsWith("-natj"));
    const asiaResult = results.find((r) => r.id.endsWith("-aj"));
    state.lastJunior = {
      nat: natResult?.outcome ?? null,
      asia: asiaResult?.outcome ?? null,
    };
  }

  const proTiers: Tier[] = ["itf", "ch", "atp250", "atp500", "m1000", "gs"];
  const playedPro = results.some((r) => proTiers.includes(r.tier));
  if (state.path === "pro" && state.age >= 18 && (playedPro || results.length > 0)) state.yearsPro += 1;

  let residual = 0;
  if (state.age >= 18 && state.path === "pro") {
    const rt = rating(state, "hard");
    const weekly = rt >= 90 ? 70 : rt >= 84 ? 36 : rt >= 78 ? 16 : rt >= 70 ? 7 : rt >= 64 ? 3 : 1;
    const weeks = state.schedule === "heavy" ? 14 : state.schedule === "light" ? 6 : 10;
    residual = Math.round(weekly * Math.max(0, weeks - results.length) * 0.62);
    state.points += residual;
  }

  if (state.path === "college" && state.age <= 22) {
    const titles = results.filter((r) => r.tier === "college" && r.outcome === "冠軍").length;
    const deep = results.filter((r) => r.tier === "college" && (r.outcome === "亞軍" || r.outcome === "四強")).length;
    state.juniorRank = clamp(28 - titles * 10 - deep * 4 - Math.round((rating(state, "hard") - 60) / 2), 1, 80);
    state.ranking = state.points >= 15 ? baselineRank(state.points, state.year) : null;
  } else if (state.age < 18 && state.path !== "pro") {
    const rt = rating(state, "hard");
    const expected = 38 + Math.max(0, state.age - 10) * 2.1;
    state.juniorRank = clamp(Math.round(50 - (rt - expected) * 3.1), 1, 500);
    state.ranking = state.points >= 18 ? baselineRank(state.points, state.year) : null;
  } else if (state.points > 0) {
    state.ranking = baselineRank(state.points, state.year);
  } else if (state.missedHalf && prevRank) {
    state.ranking = Math.min(900, Math.round(prevRank * 1.75));
  } else if (stopped && prevRank) {
    state.ranking = Math.min(950, Math.round(prevRank * 2.1));
  } else {
    state.ranking = null;
  }

  const wrecked = stopped || state.missedHalf || state.injury === "serious";
  const anchor = prevRank;
  const wasUp =
    Boolean(state.bigTour) ||
    (state.peakRank != null && state.peakRank <= 40) ||
    (anchor != null && anchor <= 40);
  if (wasUp && !wrecked && anchor != null && anchor <= 60 && state.path === "pro" && state.age >= 18) {
    const worst = Math.min(58, Math.round(anchor * 1.5) + 5);
    if (state.ranking == null || state.ranking > worst) state.ranking = worst;
  }
  const deepBig = results.some((r) => (r.tier === "gs" || r.tier === "m1000") && atLeast(r.outcome, "十六強"));
  if ((state.ranking != null && state.ranking <= 40) || deepBig) state.bigTour = true;
  if (wasUp && wrecked && anchor != null && anchor <= 60 && (state.ranking == null || state.ranking > 140)) {
    state.yearStory.push("這年的賽季被傷打亂了，明年得從比較小的比賽打回來。");
  }

  if (state.ranking && (state.peakRank == null || state.ranking < state.peakRank)) {
    state.peakRank = state.ranking;
    state.peakRankYear = state.year;
  }
  if (state.ranking && state.ranking <= 100 && state.firstTop100Age == null) {
    state.firstTop100Age = state.age;
    state.yearStory.push("你第一次打進世界前一百。");
  }
  state.rankHistory.push({ year: state.year, rank: state.ranking });

  if (state.ranking === 1) {
    const orig = baselineNo1(state.year);
    const line = orig
      ? `${state.year} 年底世界第一換人了。原本是${withOriginal(orig)}。`
      : `${state.year} 年底，你是世界第一。`;
    if (!state.historyChanges.includes(line)) state.historyChanges.push(line);
    state.yearStory.push("這一年結束時，你是世界第一。");
  } else if (state.ranking === 2) {
    const orig = baselineNo1(state.year);
    if (orig) state.yearStory.push(`這一年你的年終排名是世界第二。第一名還是${withOriginal(orig)}。`);
  }

  const played = yearWins + yearLosses;
  if (played >= 4) {
    const rate = yearWins / played;
    if (rate >= 0.72) state.confidence = clamp(state.confidence + 3, 1, 99);
    if (rate < 0.4) {
      state.confidence = clamp(state.confidence - 4, 1, 99);
      state.motivation = clamp(state.motivation - 4, 0, 100);
    }
  }
  if (state.ranking) {
    if (state.ranking <= 10) state.fame = clamp(state.fame + 6, 0, 100);
    else if (state.ranking <= 40) state.fame = clamp(state.fame + 3, 0, 100);
    else if (state.ranking <= 120) state.fame = clamp(state.fame + 1, 0, 100);
  } else if (state.age > 22) state.fame = clamp(state.fame - 2, 0, 100);

  if (state.motivation < 38 || (state.path === "pro" && played >= 6 && yearWins / played < 0.38)) {
    state.lowYears += 1;
  } else state.lowYears = Math.max(0, state.lowYears - 1);
  if (state.lowYears >= 3) state.peopleGaveUp = true;

  const heal = rngFor(state.seed, `heal:${state.year}`)();
  if (state.injury === "minor" && !state.rushedReturn && heal < 0.8) state.injury = "none";
  if (state.injury === "moderate" && state.missedHalf && heal < 0.7) state.injury = "minor";

  const support =
    state.age < 18
      ? { tight: 7000, modest: 18000, comfortable: 38000, wealthy: 90000 }[state.wealth] * era(state.year)
      : 0;
  const coachCost = state.coach.cost * era(state.year) * (state.age < 16 ? 0.65 : 1);
  const travel =
    { light: 7000, normal: 20000, heavy: 36000 }[state.schedule] *
    era(state.year) *
    (state.age < 18 ? 0.4 : state.ranking && state.ranking < 80 ? 1.45 : 1);
  const medical =
    state.injury === "serious" ? 28000 : state.injury === "moderate" ? 12000 : state.injury === "minor" ? 3000 : 0;
  state.money += Math.round(support);
  state.money -= Math.round(coachCost + travel + medical * era(state.year));
  if (state.sponsor) {
    const pay = Math.round(state.sponsor.annual * era(state.year));
    state.money += pay;
    state.yearSponsor += pay;
    state.sponsorTotal += pay;
    state.earnings += pay;
  }
  if (state.age < 18 && state.money < 0) {
    if (state.wealth === "tight") {
      state.money = 0;
      state.yearStory.push("家裡已經沒辦法再多出錢。");
    } else {
      state.money = 0;
      state.yearStory.push("不夠的錢家裡補上了，沒多說什麼。");
    }
  }

  const report: SeasonReport = {
    results,
    injuryNote: note,
    biggestWin: biggest?.text ?? null,
    quiet: results.length === 0,
  };
  state.season = report;
  if (results.length === 0 && state.age >= 11) {
    state.yearStory.push(state.missedHalf ? "這一年大部分比賽你都沒有出現。" : "這一年沒有正式賽事。");
  }
}

function bare(name: string): string {
  return name.replace(/（[^）]*）/g, "");
}

function addExp(state: GameState, n: number) {
  const room = 99 - state.stats.experience;
  const scale = room > 40 ? 1 : room > 18 ? 0.45 : 0.18;
  state.stats.experience = clamp(Math.round(state.stats.experience + n * scale), 1, 99);
}

function injRngSafe(state: GameState): () => number {
  return rngFor(state.seed, `hurtname:${state.year}`);
}

interface Opp {
  name: string;
  rank: number | null;
  strength: number;
  legend: boolean;
  legendId?: string;
}

function drawOpp(
  state: GameState,
  t: Slot,
  roundT: number,
  lo: number,
  hi: number,
  rng: () => number,
  used: Set<string>,
): Opp {
  const legends = activeLegends(state.year, t.surface).filter((l) => !used.has(l.legend.id));
  const kai = legends.find((l) => l.legend.rival);
  const pro = t.tier === "gs" || t.tier === "m1000" || t.tier === "atp500" || t.tier === "atp250" || t.tier === "olympics" || t.tier === "ch";
  if (kai && pro && rng() < (t.tier === "ch" || t.tier === "atp250" ? 0.22 : 0.12)) {
    used.add(kai.legend.id);
    const strength = strengthAt(kai.legend, state.year, t.surface) ?? kai.strength;
    return {
      name: playerName(kai.legend),
      rank: legendRank(strength, state.year, kai.legend.id),
      strength,
      legend: true,
      legendId: kai.legend.id,
    };
  }
  let pLegend = 0;
  if (t.tier === "gs") pLegend = roundT < 0.4 ? 0.04 : roundT < 0.7 ? 0.38 : 0.88;
  else if (t.tier === "m1000") pLegend = roundT < 0.5 ? 0.08 : 0.72;
  else if (t.tier === "olympics") pLegend = roundT < 0.55 ? 0.12 : 0.75;
  else if (t.tier === "atp500") pLegend = roundT > 0.7 ? 0.48 : 0.06;
  else if (t.tier === "atp250") pLegend = roundT > 0.85 ? 0.22 : 0;
  if (pLegend && rng() < pLegend) {
    const pool = legends.filter((l) => !l.legend.rival && l.strength >= (roundT > 0.75 ? 86 : 78));
    if (pool.length) {
      const chosen = weighted(
        rng,
        pool.map((l) => ({ item: l, w: l.strength * (0.35 + roundT) })),
      );
      used.add(chosen.legend.id);
      const strength = chosen.strength;
      return {
        name: playerName(chosen.legend),
        rank: legendRank(strength, state.year, chosen.legend.id),
        strength,
        legend: true,
        legendId: chosen.legend.id,
      };
    }
  }
  const strength = clamp(lo + (hi - lo) * roundT + gaussian(rng) * 3.2, 36, 93);
  const name = unusedName(rng, used, Boolean(t.domestic));
  const rank =
    t.tier === "junior" || t.tier === "college" || t.tier === "asian"
      ? null
      : approxRank(strength);
  return { name, rank, strength, legend: false };
}
