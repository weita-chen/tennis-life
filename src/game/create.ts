import { COACHES, coachById } from "./coaches";
import { clamp, gaussian, pick, rngFor, weighted } from "./rng";
import type { Coach, GameState, Hidden, Stats, Wealth } from "./types";

const SURNAMES = [
  "陳", "林", "黃", "張", "李", "王",
  "吳", "劉", "蔡", "楊", "許", "鄭",
  "謝", "洪", "郭", "邱", "曾", "廖",
  "賴", "徐", "周", "葉", "蘇", "莊",
  "呂", "江", "何", "羅", "高", "蕭",
  "潘", "朱", "鍾", "游", "詹", "胡",
  "施", "沈", "余", "杜", "范", "彭",
];

const GIVEN = [
  "柏宇", "子恆", "紹齊", "承恩", "奕辰", "品睿",
  "家維", "承翰", "宇翔", "宜謙", "廷恩", "宥辰",
  "冠廷", "俊宏", "俊傑", "志豪", "建宏", "建霖",
  "昱廷", "昱翔", "冠宇", "冠霖", "冠佑", "俊賢",
  "俊豪", "偉倫", "偉傑", "宗翰", "宗憲", "哲宇",
  "哲維", "彥廷", "彥均", "彥宏", "彥儒", "彥翔",
  "柏翰", "柏勳", "柏霖", "浩然", "浩宇", "浩翔",
  "浩廷", "宇辰", "宇謙", "宇軒", "宇威", "宇凡",
  "家豪", "家銘", "家翔", "家榮", "家睿", "家瑋",
  "承哲", "承佑", "承霖", "承澤", "承峰",
  "志偉", "志明", "志宏", "俊安", "俊廷", "俊佑",
  "冠翔", "冠勳", "冠豪", "冠傑",
  "明哲", "明軒", "明翰", "信宏", "宗佑", "宗霖",
  "偉翔", "偉哲", "彥勳", "彥博",
  "凱翔", "凱文", "凱傑", "瑞廷", "瑞恩", "瑞哲",
  "育誠", "育豪", "品豪", "柏均", "柏辰",
  "文彬", "文傑", "國豪", "世傑", "世偉",
  "威廷", "子豪", "子謙", "柏宏", "宜霖",
  "廷宇", "廷瑋", "建志", "建民", "俊銘",
];

export function randomSeed(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < buf.length; i++) s += alphabet[buf[i]! % alphabet.length];
  return s;
}

export function randomName(seed = "name", avoid = ""): string {
  const rng = rngFor(seed, "name");
  let name = "";
  for (let i = 0; i < 12; i++) {
    name = pick(rng, SURNAMES) + pick(rng, GIVEN);
    if (name !== avoid) break;
  }
  return name;
}

function dim(rng: () => number, anchor: number, spread: number): number {
  return clamp(Math.round(anchor + gaussian(rng) * spread), 6, 99);
}

function spark(rng: () => number, pot: number, floor: number): number {
  return clamp(Math.round(floor + pot * 0.055 + gaussian(rng) * 1.3), 4, 20);
}

function startingCoach(wealth: Wealth, luck: number, rng: () => number): Coach {
  const budget = { tight: 11000, modest: 16000, comfortable: 28000, wealthy: 50000 }[wealth];
  const room = budget * (luck > 72 ? 1.35 : luck < 32 ? 0.8 : 1);
  const pool = COACHES.filter((c) => c.gate === "local" && c.minAge <= 6 && c.cost <= room);
  const list = pool.length ? pool : COACHES.filter((c) => c.id === "chen" || c.id === "xu");
  return weighted(
    rng,
    list.map((c) => ({ item: c, w: c.quality * (c.youth ? 1.4 : 1) * (luck / 50) })),
  );
}

function backstory(input: {
  wealth: Wealth;
  adultHeight: number;
  hidden: Hidden;
  coach: Coach;
  build: string;
}): string {
  const { wealth, adultHeight, hidden, coach, build } = input;
  const moneyLine = {
    tight: "家裡不算有錢。網球一開始只是因為社區球場晚上有燈，而你放學之後需要一個去處。",
    modest: "父母都要上班。他們沒打算培養冠軍，只希望你動一動，別整年坐著。",
    comfortable: "家裡付得起教練費，也付得起一雙不會磨腳的鞋。這在當時已經是一種運氣。",
    wealthy: "錢不是問題。問題是你願不願意為了打球，把童年的時間都排滿。",
  }[wealth];
  const body =
    adultHeight >= 188
      ? `你長得快，身子${build}。大人第一眼先看見身高。`
      : hidden.physical >= 68
        ? "你跑得很快。有人說這是天賦，其實他們還沒認真看過你打球。"
        : "你的身體沒有特別顯眼。在操場上，你只是其中一個孩子。";
  const feel =
    hidden.ballFeel >= 72
      ? "你的手感不錯，球一碰拍就大概知道會去哪。"
      : hidden.ballFeel < 42
        ? "你一開始打得很醜。沒有人因此答應你什麼，也沒有人急著把你送走。"
        : "你會碰球。六歲的孩子會打到球，就已經算不錯了。";
  const luck =
    hidden.luck >= 74
      ? "有一次球飛出圍網，被路過的人撿起來。你們因此認識。"
      : hidden.luck <= 30
        ? "第一個教練的名額滿了。你晚了兩天。"
        : "那個夏天，沒有人敢說你以後會走到哪裡。";
  return [
    moneyLine,
    body,
    feel,
    luck,
    `你的第一位教練是${coach.name}，${coach.archetype}。他常說：「${coach.line}」`,
    "現在是一九九二年。你六歲。十二歲以前，怎麼練是爸媽和教練決定的。沒有人知道你會變成誰。",
  ].join("");
}

export function createLife(name: string, seed: string): GameState {
  const rng = rngFor(seed, "birth");
  const talent = clamp(Math.round(57 + gaussian(rng) * 15.5), 8, 99);
  const hidden: Hidden = {
    talent,
    technical: dim(rng, talent, 8),
    physical: dim(rng, talent, 9),
    ballFeel: dim(rng, talent, 10),
    tennisIQ: dim(rng, talent - 2, 9),
    mental: dim(rng, talent - 4, 10),
    durability: dim(rng, 58, 12),
    learning: dim(rng, talent, 8),
    luck: clamp(Math.round(50 + gaussian(rng) * 18), 5, 99),
  };
  const wealth = weighted(rng, [
    { item: "tight" as Wealth, w: 16 },
    { item: "modest" as Wealth, w: 40 },
    { item: "comfortable" as Wealth, w: 32 },
    { item: "wealthy" as Wealth, w: 12 },
  ]);
  const adultHeight = clamp(Math.round(177 + gaussian(rng) * 6.5 + (hidden.physical - 50) * 0.06), 168, 200);
  const build =
    adultHeight >= 188 ? "瘦高" : hidden.physical >= 70 ? "結實" : hidden.physical < 40 ? "單薄" : "普通";
  const coach = startingCoach(wealth, hidden.luck, rng);
  const stats: Stats = {
    serve: spark(rng, hidden.technical, 6),
    forehand: spark(rng, (hidden.ballFeel + hidden.technical) / 2, 8),
    backhand: spark(rng, hidden.ballFeel, 7),
    volley: spark(rng, hidden.technical, 5),
    fitness: spark(rng, hidden.physical, 9),
    strength: spark(rng, hidden.physical, 7),
    speed: spark(rng, hidden.physical, 8),
    iq: spark(rng, hidden.tennisIQ, 6),
    mental: spark(rng, hidden.mental, 7),
    pressure: spark(rng, hidden.mental, 5),
    experience: 3,
  };
  const clean = name.trim().slice(0, 12) || randomName(seed);
  const body = backstory({ wealth, adultHeight, hidden, coach, build });
  const coachNote =
    hidden.talent >= 88 ? "這孩子看球的方式有點不一樣。現在說更多還太早。" : "現在下結論還太早。";
  const money0 = { tight: 600, modest: 3500, comfortable: 14000, wealthy: 52000 }[wealth];

  const state: GameState = {
    seed,
    name: clean,
    year: 1992,
    age: 6,
    adultHeight,
    build,
    wealth,
    hidden,
    stats,
    confidence: clamp(Math.round(50 + gaussian(rng) * 4), 40, 62),
    motivation: clamp(Math.round(72 + gaussian(rng) * 6), 55, 88),
    fame: 0,
    money: money0,
    chronic: 0,
    injury: "none",
    rushedReturn: false,
    missedHalf: false,
    coach: coachById(coach.id),
    coachNote,
    sponsor: null,
    partner: null,
    path: "undecided",
    degree: false,
    yearsPro: 0,
    ranking: null,
    juniorRank: null,
    points: 0,
    wins: 0,
    losses: 0,
    titles: { gs: 0, m1000: 0, atp: 0, ch: 0, other: 0 },
    gsResults: [],
    earnings: 0,
    sponsorTotal: 0,
    peakRank: null,
    peakRankYear: null,
    firstTop100Age: null,
    h2h: {},
    notableWins: [],
    historyChanges: [],
    slamEdits: {},
    majorInjuries: [],
    coachesHad: [coach.name],
    decisions: [],
    decisionIds: [],
    script: [],
    step: 0,
    phaseInYear: "intro",
    card: {
      kind: "story",
      kicker: "一九九二年 · 台灣 · 六歲",
      title: clean,
      body,
      choices: [
        {
          id: "begin",
          label: "開始這一年",
          hint: "六歲。怎麼練，先由家裡和教練決定。",
        },
      ],
    },
    season: null,
    summary: null,
    yearStartStats: { ...stats },
    yearStory: [],
    yearPrize: 0,
    yearSponsor: 0,
    schedule: "normal",
    focusLabel: "還沒開始",
    overtrain: false,
    studyYear: false,
    distracted: false,
    investLeft: 0,
    overseas: false,
    scoutIgnored: false,
    collegeTitles: 0,
    olympic: null,
    asian: null,
    lowYears: 0,
    peopleGaveUp: false,
    wildcardUsed: false,
    bonusSlam: false,
    studiesNeglected: false,
    pendingRetire: null,
    retiredReason: null,
    flash: null,
    surfaceBias: { hard: 0, clay: 0, grass: 0 },
    rankHistory: [],
    bestGs: "—",
    metLegends: [],
    lastJunior: { nat: null, asia: null },
    bigTour: false,
    flags: {},
    rivals: [],
    investments: [],
    echoes: [],
    yearQueue: [],
    memories: [{ id: "firstCoach", year: 1992, age: 6, text: `第一個教練是${coach.name}。` }],
  };
  return state;
}
