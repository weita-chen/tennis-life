import type { Coach, StatKey, Wealth } from "./types";

export const COACHES: Coach[] = [
  {
    id: "chen",
    name: "陳石",
    archetype: "嚴格的老派教練",
    line: "少講話，多打球。",
    tech: 1.2,
    phys: 1.05,
    mental: 1.16,
    iq: 0.96,
    cost: 9000,
    minAge: 6,
    quality: 64,
    gate: "local",
  },
  {
    id: "lin",
    name: "林婉晴",
    archetype: "鼓勵型教練",
    line: "你比昨天更好，我就滿意。",
    tech: 1.05,
    phys: 0.96,
    mental: 1.22,
    iq: 1.08,
    cost: 10000,
    minAge: 6,
    quality: 66,
    gate: "local",
  },
  {
    id: "zhou",
    name: "周國強",
    archetype: "體能很操的教練",
    line: "球感以後再說，先把體能練起來。",
    tech: 0.92,
    phys: 1.34,
    mental: 1.05,
    iq: 0.88,
    cost: 11000,
    minAge: 6,
    quality: 62,
    gate: "local",
  },
  {
    id: "huang",
    name: "黃土城",
    archetype: "紅土專家",
    line: "每一分都要讓對方多跑兩步。",
    tech: 1.12,
    phys: 1.14,
    mental: 1.02,
    iq: 1.16,
    cost: 14000,
    minAge: 10,
    quality: 72,
    gate: "local",
  },
  {
    id: "wu",
    name: "吳策",
    archetype: "戰術教練",
    line: "別跟他比力量，比他先想到。",
    tech: 1.06,
    phys: 0.94,
    mental: 1.1,
    iq: 1.32,
    cost: 20000,
    minAge: 12,
    quality: 76,
    gate: "local",
  },
  {
    id: "xu",
    name: "徐幼恩",
    archetype: "青訓專家",
    line: "十二歲以前，我只要你喜歡打球。",
    tech: 1.14,
    phys: 1.02,
    mental: 1.12,
    iq: 1.06,
    cost: 8000,
    minAge: 6,
    quality: 70,
    gate: "local",
    youth: true,
  },
  {
    id: "data",
    name: "艾利·陳",
    archetype: "數據派教練",
    line: "感覺不算數，落點才算。",
    tech: 1.16,
    phys: 0.98,
    mental: 1.04,
    iq: 1.3,
    cost: 48000,
    minAge: 16,
    quality: 82,
    gate: "money",
  },
  {
    id: "park",
    name: "朴載民",
    archetype: "體能和復健",
    line: "你要的是十年，不是十週。",
    tech: 0.98,
    phys: 1.28,
    mental: 1.1,
    iq: 1.02,
    cost: 38000,
    minAge: 17,
    quality: 78,
    gate: "money",
  },
  {
    id: "marc",
    name: "馬克·埃爾",
    archetype: "前大滿貫選手",
    line: "大比賽要自己去打。",
    tech: 1.28,
    phys: 1.12,
    mental: 1.22,
    iq: 1.18,
    cost: 130000,
    minAge: 16,
    quality: 93,
    gate: "overseas",
  },
];

export function coachById(id: string): Coach {
  return COACHES.find((c) => c.id === id) ?? COACHES[0]!;
}

export function coachMult(coach: Coach, key: StatKey, age: number): number {
  let m = 1;
  if (key === "serve" || key === "forehand" || key === "backhand" || key === "volley") m = coach.tech;
  else if (key === "fitness" || key === "strength" || key === "speed") m = coach.phys;
  else if (key === "iq") m = coach.iq;
  else m = coach.mental;
  if (coach.youth && age > 17) m *= 0.84;
  return m;
}

export function wealthLabel(w: Wealth): string {
  return { tight: "不寬裕", modest: "普通", comfortable: "小康", wealthy: "寬裕" }[w];
}
