import { clamp } from "./rng";
import type { SlamId, Surface } from "./types";

export const SLAM_NAME: Record<SlamId, string> = {
  ao: "澳網",
  rg: "法網",
  wi: "溫布頓",
  us: "美網",
};

export const SLAM_SURFACE: Record<SlamId, Surface> = {
  ao: "hard",
  rg: "clay",
  wi: "grass",
  us: "hard",
};

const N = {
  sampras: "山普萊",
  agassi: "阿卡錫",
  courier: "庫里耶",
  becker: "貝克",
  bruguera: "布魯格拉",
  muster: "穆斯特",
  kafelnikov: "卡費尼",
  rafter: "拉夫特",
  kuerten: "古加",
  safin: "薩芬",
  hewitt: "休伊特",
  ferrero: "費雷羅",
  roddick: "羅德克",
  gaudio: "高迪歐",
  federer: "費卜勒",
  nadal: "納達倫",
  djokovic: "喬米契",
  delpo: "德波卓",
  murray: "穆瑞安",
  stan: "瓦林卡",
  cilic: "西里奇",
  alcaraz: "阿卡雷",
  sinner: "辛納爾",
  zverev: "茲維列",
  medvedev: "梅維傑",
  thiem: "提恩",
  krajicek: "克拉伊切克",
  korda: "科達",
  moya: "莫亞",
  ivanisevic: "伊凡尼塞",
  johansson: "約翰森",
  costa: "科斯塔",
};

const RAW = `
1992 ${N.courier}|${N.courier}|${N.agassi}|${N.sampras}
1993 ${N.courier}|${N.bruguera}|${N.sampras}|${N.sampras}
1994 ${N.sampras}|${N.bruguera}|${N.sampras}|${N.agassi}
1995 ${N.agassi}|${N.muster}|${N.sampras}|${N.sampras}
1996 ${N.becker}|${N.kafelnikov}|${N.krajicek}|${N.sampras}
1997 ${N.sampras}|${N.kuerten}|${N.sampras}|${N.rafter}
1998 ${N.korda}|${N.moya}|${N.sampras}|${N.rafter}
1999 ${N.kafelnikov}|${N.agassi}|${N.sampras}|${N.agassi}
2000 ${N.agassi}|${N.kuerten}|${N.sampras}|${N.safin}
2001 ${N.agassi}|${N.kuerten}|${N.ivanisevic}|${N.hewitt}
2002 ${N.johansson}|${N.costa}|${N.hewitt}|${N.sampras}
2003 ${N.agassi}|${N.ferrero}|${N.federer}|${N.roddick}
2004 ${N.federer}|${N.gaudio}|${N.federer}|${N.federer}
2005 ${N.safin}|${N.nadal}|${N.federer}|${N.federer}
2006 ${N.federer}|${N.nadal}|${N.federer}|${N.federer}
2007 ${N.federer}|${N.nadal}|${N.federer}|${N.federer}
2008 ${N.djokovic}|${N.nadal}|${N.nadal}|${N.federer}
2009 ${N.nadal}|${N.federer}|${N.federer}|${N.delpo}
2010 ${N.federer}|${N.nadal}|${N.nadal}|${N.nadal}
2011 ${N.djokovic}|${N.nadal}|${N.djokovic}|${N.djokovic}
2012 ${N.djokovic}|${N.nadal}|${N.federer}|${N.murray}
2013 ${N.djokovic}|${N.nadal}|${N.murray}|${N.nadal}
2014 ${N.stan}|${N.nadal}|${N.djokovic}|${N.cilic}
2015 ${N.djokovic}|${N.stan}|${N.djokovic}|${N.djokovic}
2016 ${N.djokovic}|${N.djokovic}|${N.murray}|${N.stan}
2017 ${N.federer}|${N.nadal}|${N.federer}|${N.nadal}
2018 ${N.federer}|${N.nadal}|${N.djokovic}|${N.djokovic}
2019 ${N.djokovic}|${N.nadal}|${N.djokovic}|${N.nadal}
2020 ${N.djokovic}|${N.nadal}|-|${N.thiem}
2021 ${N.djokovic}|${N.djokovic}|${N.djokovic}|${N.medvedev}
2022 ${N.nadal}|${N.nadal}|${N.djokovic}|${N.alcaraz}
2023 ${N.djokovic}|${N.djokovic}|${N.alcaraz}|${N.djokovic}
2024 ${N.sinner}|${N.alcaraz}|${N.alcaraz}|${N.sinner}
2025 ${N.sinner}|${N.alcaraz}|${N.sinner}|${N.alcaraz}
2026 ${N.alcaraz}|${N.zverev}|${N.sinner}|${N.zverev}
`;

const SLAMS: Record<number, Partial<Record<SlamId, string>>> = {};
for (const line of RAW.trim().split("\n")) {
  const [ys, rest] = [line.slice(0, 4), line.slice(5)];
  const [ao, rg, wi, us] = rest.split("|");
  const year = Number(ys);
  SLAMS[year] = {};
  if (ao && ao !== "-") SLAMS[year]!.ao = ao;
  if (rg && rg !== "-") SLAMS[year]!.rg = rg;
  if (wi && wi !== "-") SLAMS[year]!.wi = wi;
  if (us && us !== "-") SLAMS[year]!.us = us;
}

export function baselineSlam(year: number, slam: SlamId): string | null {
  return SLAMS[year]?.[slam] ?? null;
}

export function slamHeld(year: number, slam: SlamId): boolean {
  if (year === 2020 && slam === "wi") return false;
  return Boolean(SLAMS[year]?.[slam] || year >= 1992);
}

export interface Legend {
  id: string;
  name: string;
  country: string;
  peak: number;
  debut: number;
  prime0: number;
  prime1: number;
  retire: number;
  decline: number;
  clay: number;
  grass: number;
  hard: number;
  rival?: boolean;
}

export const LEGENDS: Legend[] = [
  { id: "agassi", name: N.agassi, country: "美國", peak: 93, debut: 1986, prime0: 1994, prime1: 2003, retire: 2006, decline: 2.4, clay: 0, grass: -1, hard: 4 },
  { id: "sampras", name: N.sampras, country: "美國", peak: 96, debut: 1988, prime0: 1993, prime1: 2000, retire: 2002, decline: 2.6, clay: -3, grass: 6, hard: 4 },
  { id: "kuerten", name: N.kuerten, country: "巴西", peak: 91, debut: 1995, prime0: 1997, prime1: 2001, retire: 2008, decline: 3.1, clay: 7, grass: -3, hard: 0 },
  { id: "safin", name: N.safin, country: "俄羅斯", peak: 90, debut: 1999, prime0: 2000, prime1: 2005, retire: 2009, decline: 2.2, clay: -1, grass: 1, hard: 3 },
  { id: "hewitt", name: N.hewitt, country: "澳洲", peak: 90, debut: 1998, prime0: 2001, prime1: 2005, retire: 2016, decline: 1.5, clay: -2, grass: 2, hard: 3 },
  { id: "roddick", name: N.roddick, country: "美國", peak: 91, debut: 2000, prime0: 2003, prime1: 2007, retire: 2012, decline: 1.8, clay: -4, grass: 3, hard: 4 },
  { id: "federer", name: N.federer, country: "瑞士", peak: 97, debut: 1998, prime0: 2004, prime1: 2018, retire: 2022, decline: 2.6, clay: 1, grass: 6, hard: 4 },
  { id: "nadal", name: N.nadal, country: "西班牙", peak: 98, debut: 2001, prime0: 2005, prime1: 2019, retire: 2024, decline: 2.2, clay: 8, grass: 1, hard: 2 },
  { id: "djokovic", name: N.djokovic, country: "塞爾維亞", peak: 98, debut: 2004, prime0: 2011, prime1: 2023, retire: 2026, decline: 1.4, clay: 3, grass: 3, hard: 5 },
  { id: "delpo", name: N.delpo, country: "阿根廷", peak: 92, debut: 2005, prime0: 2008, prime1: 2013, retire: 2022, decline: 2.4, clay: 0, grass: 1, hard: 4 },
  { id: "murray", name: N.murray, country: "英國", peak: 93, debut: 2005, prime0: 2012, prime1: 2016, retire: 2024, decline: 1.8, clay: -1, grass: 3, hard: 3 },
  { id: "stan", name: N.stan, country: "瑞士", peak: 91, debut: 2002, prime0: 2013, prime1: 2017, retire: 2024, decline: 1.6, clay: 2, grass: 0, hard: 2 },
  { id: "cilic", name: N.cilic, country: "克羅埃西亞", peak: 90, debut: 2004, prime0: 2014, prime1: 2018, retire: 2025, decline: 1.5, clay: -1, grass: 2, hard: 3 },
  { id: "thiem", name: N.thiem, country: "奧地利", peak: 91, debut: 2014, prime0: 2017, prime1: 2020, retire: 2024, decline: 3, clay: 5, grass: -2, hard: 1 },
  { id: "zverev", name: N.zverev, country: "德國", peak: 94, debut: 2014, prime0: 2017, prime1: 2026, retire: 2026, decline: 1, clay: 2, grass: 0, hard: 2 },
  { id: "medvedev", name: N.medvedev, country: "俄羅斯", peak: 93, debut: 2016, prime0: 2019, prime1: 2023, retire: 2026, decline: 1.3, clay: -3, grass: -1, hard: 5 },
  { id: "alcaraz", name: N.alcaraz, country: "西班牙", peak: 96, debut: 2021, prime0: 2022, prime1: 2026, retire: 2026, decline: 1, clay: 4, grass: 3, hard: 3 },
  { id: "sinner", name: N.sinner, country: "義大利", peak: 96, debut: 2020, prime0: 2023, prime1: 2026, retire: 2026, decline: 1, clay: 1, grass: 2, hard: 5 },
  { id: "ferrer", name: "費雷爾", country: "西班牙", peak: 88, debut: 2000, prime0: 2010, prime1: 2015, retire: 2019, decline: 1.6, clay: 5, grass: -2, hard: 1 },
  { id: "berdych", name: "貝迪赫", country: "捷克", peak: 89, debut: 2002, prime0: 2010, prime1: 2015, retire: 2019, decline: 1.7, clay: 0, grass: 1, hard: 3 },
  { id: "tsonga", name: "特松加", country: "法國", peak: 88, debut: 2004, prime0: 2008, prime1: 2013, retire: 2022, decline: 1.5, clay: -1, grass: 1, hard: 3 },
  { id: "monfils", name: "孟菲爾", country: "法國", peak: 86, debut: 2004, prime0: 2014, prime1: 2019, retire: 2026, decline: 1.2, clay: 0, grass: 0, hard: 2 },
  { id: "kai", name: "張凱旋", country: "台灣", peak: 79, debut: 2003, prime0: 2008, prime1: 2015, retire: 2019, decline: 2, clay: 1, grass: -2, hard: 2, rival: true },
];

const ORIGINALS: Record<string, string> = {
  山普萊: "Samplay",
  阿卡錫: "Agasee",
  庫里耶: "Kourier",
  貝克: "Bekker",
  布魯格拉: "Brugela",
  穆斯特: "Mustell",
  卡費尼: "Kafenikov",
  拉夫特: "Lafter",
  古加: "Kugar",
  薩芬: "Safen",
  休伊特: "Hewyte",
  費雷羅: "Ferelo",
  羅德克: "Rodek",
  高迪歐: "Gaudou",
  費卜勒: "Feperer",
  納達倫: "Nadalen",
  喬米契: "Djomic",
  德波卓: "Delpozo",
  穆瑞安: "Murean",
  瓦林卡: "Valinka",
  西里奇: "Silich",
  阿卡雷: "Alcaray",
  辛納爾: "Sinnel",
  茲維列: "Zveriev",
  梅維傑: "Medejev",
  提恩: "Thien",
  克拉伊切克: "Kraichek",
  科達: "Koda",
  莫亞: "Moia",
  伊凡尼塞: "Ivanise",
  約翰森: "Johansen",
  科斯塔: "Kosta",
  費雷爾: "Ferrel",
  貝迪赫: "Berdich",
  特松加: "Tesonga",
  孟菲爾: "Monfeil",
};

export function withOriginal(name: string): string {
  if (!name || name.includes("（")) return name;
  const en = ORIGINALS[name];
  return en ? `${name}（${en}）` : name;
}

export function playerName(legend: Legend): string {
  return withOriginal(legend.name);
}

export function strengthAt(legend: Legend, year: number, surface: Surface): number | null {
  if (year < legend.debut || year > legend.retire) return null;
  let s = legend.peak;
  if (year < legend.prime0) {
    const span = Math.max(1, legend.prime0 - legend.debut);
    const t = (year - legend.debut) / span;
    s = legend.peak * (0.72 + 0.28 * t);
  } else if (year > legend.prime1) {
    s = legend.peak - (year - legend.prime1) * legend.decline;
  }
  const bias = surface === "clay" ? legend.clay : surface === "grass" ? legend.grass : legend.hard;
  return clamp(s + bias * 0.45, 55, 99);
}

export function activeLegends(year: number, surface: Surface): { legend: Legend; strength: number }[] {
  const out: { legend: Legend; strength: number }[] = [];
  for (const legend of LEGENDS) {
    const strength = strengthAt(legend, year, surface);
    if (strength != null) out.push({ legend, strength });
  }
  return out;
}

export function topLegend(year: number): Legend | null {
  let best: Legend | null = null;
  let score = -1;
  for (const legend of LEGENDS) {
    if (legend.rival) continue;
    const s = strengthAt(legend, year, "hard");
    if (s != null && s > score) {
      score = s;
      best = legend;
    }
  }
  return best;
}

const RANK_TABLE: [number, number][] = [
  [99, 1],
  [96, 1],
  [94, 2],
  [92, 4],
  [90, 7],
  [88, 12],
  [85, 20],
  [82, 35],
  [78, 60],
  [74, 100],
  [70, 160],
  [66, 260],
  [62, 400],
  [58, 600],
  [50, 900],
];

export function approxRank(strength: number): number {
  if (strength >= 96) return 1;
  for (let i = 0; i < RANK_TABLE.length - 1; i++) {
    const [s1, r1] = RANK_TABLE[i]!;
    const [s2, r2] = RANK_TABLE[i + 1]!;
    if (strength <= s1 && strength >= s2) {
      const f = (s1 - strength) / (s1 - s2);
      return Math.max(1, Math.round(r1 + f * (r2 - r1)));
    }
  }
  return 900;
}

export function baselineRank(points: number, year: number): number | null {
  if (points <= 0) return null;
  const era = year >= 2008 && year <= 2016 ? 1.12 : year >= 2023 ? 1.08 : 1;
  const table: [number, number][] = [
    [1, 7400],
    [2, 6200],
    [3, 5200],
    [4, 4500],
    [5, 3900],
    [8, 2800],
    [10, 2300],
    [15, 1750],
    [20, 1400],
    [30, 1000],
    [50, 680],
    [75, 460],
    [100, 310],
    [150, 190],
    [200, 120],
    [300, 65],
    [500, 22],
    [800, 8],
  ];
  const need = table.map(([r, p]) => [r, p * era] as [number, number]);
  if (points >= need[0]![1]) return 1;
  for (let i = 0; i < need.length - 1; i++) {
    const [r1, p1] = need[i]!;
    const [r2, p2] = need[i + 1]!;
    if (points >= p2) {
      const f = (points - p2) / Math.max(1, p1 - p2);
      return Math.max(1, Math.round(r2 - f * (r2 - r1)));
    }
  }
  return null;
}

export function worldNews(
  year: number,
  edits: Partial<Record<number, Partial<Record<SlamId, string>>>>,
): string {
  const row = SLAMS[year];
  if (!row) return "這一年沒有大滿貫。";
  const order: SlamId[] = ["ao", "rg", "wi", "us"];
  return order
    .map((id) => {
      if (year === 2020 && id === "wi") return "溫布頓停辦";
      const name = edits[year]?.[id] ?? row[id];
      return name ? `${SLAM_NAME[id]} ${withOriginal(name)}` : `${SLAM_NAME[id]} —`;
    })
    .join(" · ");
}

export const OLYMPICS: Partial<Record<number, { city: string; surface: Surface }>> = {
  1996: { city: "亞特蘭大", surface: "hard" },
  2000: { city: "雪梨", surface: "hard" },
  2004: { city: "雅典", surface: "hard" },
  2008: { city: "北京", surface: "hard" },
  2012: { city: "倫敦", surface: "grass" },
  2016: { city: "里約", surface: "hard" },
  2021: { city: "東京", surface: "hard" },
  2024: { city: "巴黎", surface: "clay" },
};

export const ASIAN_GAMES: Partial<Record<number, { city: string; surface: Surface }>> = {
  1994: { city: "廣島", surface: "hard" },
  1998: { city: "曼谷", surface: "hard" },
  2002: { city: "釜山", surface: "hard" },
  2006: { city: "杜哈", surface: "hard" },
  2010: { city: "廣州", surface: "hard" },
  2014: { city: "仁川", surface: "hard" },
  2018: { city: "雅加達", surface: "hard" },
  2023: { city: "杭州", surface: "hard" },
  2026: { city: "愛知", surface: "hard" },
};

const YE1: Record<number, string> = {
  1992: N.courier,
  1993: N.sampras,
  1994: N.sampras,
  1995: N.sampras,
  1996: N.sampras,
  1997: N.sampras,
  1998: N.sampras,
  1999: N.sampras,
  2000: N.kuerten,
  2001: N.hewitt,
  2002: N.hewitt,
  2003: N.roddick,
  2004: N.federer,
  2005: N.federer,
  2006: N.federer,
  2007: N.federer,
  2008: N.nadal,
  2009: N.federer,
  2010: N.nadal,
  2011: N.djokovic,
  2012: N.djokovic,
  2013: N.nadal,
  2014: N.djokovic,
  2015: N.djokovic,
  2016: N.murray,
  2017: N.nadal,
  2018: N.djokovic,
  2019: N.nadal,
  2020: N.djokovic,
  2021: N.djokovic,
  2022: N.alcaraz,
  2023: N.djokovic,
  2024: N.sinner,
  2025: N.sinner,
  2026: N.alcaraz,
};

export function baselineNo1(year: number): string | null {
  return YE1[year] ?? null;
}
