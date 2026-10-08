import type { GameState, StatKey, Stats, Surface } from "./types";

export const STAT_LABEL: Record<StatKey, string> = {
  serve: "發球",
  forehand: "正拍",
  backhand: "反拍",
  volley: "截擊",
  fitness: "體能",
  strength: "力量",
  speed: "速度",
  iq: "球商",
  mental: "心理素質",
  pressure: "抗壓",
  experience: "比賽經驗",
};

export const TECH_KEYS: StatKey[] = ["serve", "forehand", "backhand", "volley"];
export const PHYS_KEYS: StatKey[] = ["fitness", "strength", "speed"];
export const MENT_KEYS: StatKey[] = ["iq", "mental", "pressure"];
export const ALL_KEYS: StatKey[] = [...TECH_KEYS, ...PHYS_KEYS, ...MENT_KEYS, "experience"];

export const SURFACE_LABEL: Record<Surface, string> = {
  hard: "硬地",
  clay: "紅土",
  grass: "草地",
};

export function era(year: number): number {
  if (year < 1998) return 0.45;
  if (year < 2005) return 0.62;
  if (year < 2012) return 0.8;
  if (year < 2019) return 1;
  return 1.15;
}

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(Math.round(n));
  if (v >= 100_000_000) return `${sign}${(v / 100_000_000).toFixed(2)} 億美元`;
  if (v >= 10_000) {
    const wan = v / 10_000;
    const digits = wan >= 100 ? 0 : 1;
    return `${sign}${wan.toFixed(digits)} 萬美元`;
  }
  return `${sign}${v.toLocaleString("en-US")} 美元`;
}

export function rankLabel(state: Pick<GameState, "ranking" | "juniorRank" | "path" | "age">): string {
  if (state.ranking) return `世界第 ${state.ranking}`;
  if (state.path === "college" && state.age <= 22) {
    return state.juniorRank ? `大學第 ${state.juniorRank}` : "大學網球";
  }
  if (state.age < 18) return state.juniorRank ? `青少年第 ${state.juniorRank}` : "尚未排名";
  return "未入排名";
}

export function stageLabel(state: Pick<GameState, "path" | "age" | "ranking" | "injury">): string {
  if (state.injury === "serious") return "休養";
  if (state.age < 13) return "學球";
  if (state.path === "college" && state.age <= 22) return "大學";
  if (state.age < 18) return "青少年";
  const r = state.ranking;
  if (r && r <= 120) return "ATP";
  if (r && r <= 350) return "挑戰賽";
  if (state.path === "pro") return r ? "挑戰賽" : "ITF";
  return "ITF";
}

export function currentHeight(adult: number, age: number): number {
  const t = Math.max(0, Math.min(1, (age - 6) / 12));
  const start = adult * 0.66;
  return Math.round(start + (adult - start) * Math.pow(t, 0.85));
}

export function playingStyle(stats: Stats): string {
  const s = stats;
  const spread =
    Math.max(s.serve, s.forehand, s.backhand, s.volley) -
    Math.min(s.serve, s.forehand, s.backhand, s.volley);
  if (s.serve < 42 && s.forehand < 42) return "打法還沒定下來";
  if (s.serve >= s.forehand && s.serve >= s.backhand && s.serve >= 62 && s.volley >= 58) {
    return "喜歡上網的發球上網型";
  }
  if (s.serve >= 68 && s.serve >= s.forehand - 2) return "靠發球拿分的強勢打法";
  if (s.forehand >= 66 && s.fitness >= 64) return "靠正拍和體能磨的底線型";
  if (s.iq >= 68 && s.speed < s.iq) return "靠節奏和變化找機會";
  if (s.backhand >= s.forehand && s.backhand >= 64) return "反拍比正拍穩的底線型";
  if (spread < 8 && s.forehand >= 60) return "沒有明顯弱點的全面型";
  if (s.speed >= 66 && s.fitness >= 64) return "靠跑動把分數拖長的防守反擊";
  return "還在找自己最順的那一拍";
}

export function surfaceEdge(stats: Stats): Record<Surface, number> {
  return {
    clay:
      (stats.forehand - 60) * 0.06 +
      (stats.fitness - 60) * 0.05 +
      (stats.iq - 60) * 0.03 -
      (stats.serve - 60) * 0.02,
    grass: (stats.serve - 60) * 0.07 + (stats.volley - 60) * 0.05 + (stats.speed - 60) * 0.03,
    hard: (stats.serve - 60) * 0.03 + (stats.speed - 60) * 0.03 + (stats.forehand - 60) * 0.02,
  };
}

export function edgeWord(n: number): string {
  if (n >= 1.4) return "明顯優勢";
  if (n >= 0.45) return "略佳";
  if (n <= -1.4) return "明顯劣勢";
  if (n <= -0.45) return "略弱";
  return "持平";
}

export function rating(state: GameState, surface: Surface): number {
  const t = state.stats;
  const tech = t.serve * 0.3 + t.forehand * 0.32 + t.backhand * 0.26 + t.volley * 0.12;
  const phys = t.fitness * 0.4 + t.strength * 0.25 + t.speed * 0.35;
  const ment = t.iq * 0.34 + t.mental * 0.28 + t.pressure * 0.28 + Math.min(t.experience, 80) * 0.1;
  let base = tech * 0.46 + phys * 0.3 + ment * 0.24;
  base += (state.confidence - 55) * 0.07;
  base += (state.motivation - 60) * 0.045;
  base += surfaceEdge(t)[surface];
  base += (state.surfaceBias[surface] || 0) * 0.14;
  if (state.injury === "minor") base -= 3.2;
  if (state.injury === "moderate") base -= 7.5;
  if (state.injury === "serious") base -= 16;
  if (state.rushedReturn) base -= 3.2;
  if (state.chronic > 25) base -= (state.chronic - 25) * 0.055;
  if (state.age > 32) {
    const soft = state.hidden.durability > 72 ? 0.4 : 0.75;
    base -= (state.age - 32) * soft;
  }
  if (state.distracted) base -= 1.8;
  if (state.peopleGaveUp) base -= 2.2;
  return Math.max(1, Math.min(99, base));
}
