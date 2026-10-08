import { coachById, wealthLabel } from "./coaches";
import { createLife, randomSeed } from "./create";
import { buildEnding } from "./ending";
import { captureSeasonMemories, responseCard, snap, stampChoice, traceLine } from "./feedback";
import { eventCard, planYear, resolveEvent } from "./events";
import {
  ALL_KEYS,
  STAT_LABEL,
  currentHeight,
  era,
  money,
  playingStyle,
  rankLabel,
  stageLabel,
} from "./format";
import { ASIAN_GAMES, OLYMPICS, worldNews } from "./history";
import { clamp, pick, rngFor, weighted } from "./rng";
import { simulateSeason, train, type Focus } from "./sim";
import type { Choice, GameState, StoryCard, Summary } from "./types";

const PARTNERS = [
  "林怡君",
  "陳雅婷",
  "張雅雯",
  "黃郁婷",
  "吳佩珊",
  "李佳蓉",
  "王思婷",
  "劉欣怡",
  "蔡宜蓁",
  "許雅筑",
  "鄭婉婷",
  "謝宜庭",
  "楊淑雯",
  "周怡安",
  "曾婉如",
  "郭靜怡",
  "洪嘉君",
  "邱郁晴",
  "葉欣怡",
  "林妍希",
  "陳怡安",
  "張家瑜",
  "黃珮瑜",
  "吳佳穎",
  "李欣怡",
  "王怡婷",
  "蔡佳蓉",
  "許芳瑜",
  "鄭羽珊",
  "謝佳玲",
  "楊雅涵",
  "周欣儀",
  "曾雅婷",
  "郭怡伶",
  "洪郁雯",
  "邱雅玲",
];

export function hydrate(s: GameState): GameState {
  if (!s.flags) s.flags = {};
  if (!s.rivals) s.rivals = [];
  if (!s.investments) s.investments = [];
  if (!s.echoes) s.echoes = [];
  if (!s.yearQueue) s.yearQueue = [];
  if (!s.memories) s.memories = [];
  if (!s.memories.some((m) => m.id === "firstCoach") && s.coachesHad[0]) {
    s.memories.unshift({
      id: "firstCoach",
      year: s.year - (s.age - 6),
      age: 6,
      text: `第一個教練是${s.coachesHad[0]}。`,
    });
  }
  if (!s.lastJunior) s.lastJunior = { nat: null, asia: null };
  if (s.bigTour == null) s.bigTour = false;
  return s;
}

export function startLife(name: string, seed?: string): GameState {
  const cleaned = (seed ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return createLife(name, cleaned || randomSeed());
}

export function act(prev: GameState, choiceId: string): GameState {
  const s = hydrate(structuredClone(prev));
  if (s.phaseInYear === "ending" || s.card.kind === "ending") return s;

  if (choiceId === "ack") return present(s);
  if (choiceId === "ack:season") {
    captureSeasonMemories(s);
    s.phaseInYear = "season";
    s.card = {
      kind: "season",
      report: s.season ?? { results: [], injuryNote: null, biggestWin: null, quiet: true },
    };
    return s;
  }
  if (choiceId === "begin") return openYear(s);
  if (choiceId === "to-summary") return showSummary(s);
  if (choiceId === "next-year") {
    settleYearEnd(s);
    if (s.pendingRetire) {
      const reason = s.pendingRetire;
      s.pendingRetire = null;
      return finish(s, reason);
    }
    s.age += 1;
    s.year += 1;
    return openYear(s);
  }
  if (choiceId.startsWith("retire")) return finish(s, retireReason(s, choiceId));
  if (choiceId === "child:skip") return skipToThirteen(s);
  if (choiceId === "teen:start") return openYear(s);
  if (choiceId === "child:play") {
    runYear(s, childFocus(s));
    captureSeasonMemories(s);
    return s;
  }
  if (choiceId.startsWith("train:")) {
    const label = choiceLabel(s, choiceId);
    const subject = s.card.kind === "story" ? s.card.title : "這一年";
    const before = snap(s);
    runYear(s, choiceId.slice(6) as Focus);
    s.phaseInYear = "script";
    s.card = responseCard(s, before, choiceId, label, subject, "ack:season", "看這一季");
    return s;
  }

  const label = choiceLabel(s, choiceId);
  const subject = s.card.kind === "story" ? s.card.title : "這次";
  const before = snap(s);
  commit(s, choiceId);
  s.phaseInYear = "script";
  s.card = responseCard(s, before, choiceId, label, subject, "ack", "繼續");
  return s;
}

export function choicesFor(s: GameState): Choice[] {
  hydrate(s);
  if (s.phaseInYear === "ending" || s.card.kind === "ending") return [];
  if (s.card.kind === "story") {
    if (s.age <= 12 && !s.card.choices.some((c) => c.id === "child:skip")) {
      return [...s.card.choices, ...childSkip(s)];
    }
    return s.card.choices;
  }
  if (s.card.kind === "season") {
    return [
      {
        id: "to-summary",
        label: "看這一年",
        hint: "打完才知道這一年留下什麼。",
      },
      ...childSkip(s),
    ];
  }
  if (s.decisionIds.includes("pending:leave")) {
    return [
      {
        id: "next-year",
        label: "畢業，把球拍留下",
        hint: "學位如果還在，會跟著你。排名從這裡停。",
        tone: "exit",
      },
    ];
  }
  const next: Choice = {
    id: "next-year",
    label: "下一年",
    hint: `${s.year + 1} 年，${s.age + 1} 歲。`,
  };
  const worn =
    s.age >= 29 ||
    s.motivation < 38 ||
    s.peopleGaveUp ||
    s.injury === "serious" ||
    (s.age >= 24 && s.money < 0);
  if (!worn) return [...childSkip(s), next];
  return [
    next,
    {
      id: "retire:now",
      label: "在這裡停下來",
      hint: "退役不是認輸。明年可以不用再為了排名飛來飛去。",
      tone: "quiet",
    },
    ...childSkip(s),
  ];
}

export function moodWord(n: number): string {
  if (n >= 78) return "很想拼";
  if (n >= 58) return "還想打";
  if (n >= 40) return "有點累了";
  return "提不起勁";
}

export function injuryWord(s: GameState): string | null {
  if (s.injury === "serious") return "重傷";
  if (s.injury === "moderate") return "養傷中";
  if (s.injury === "minor") return "小傷";
  if (s.chronic >= 28) return "舊傷還在";
  return null;
}

function childSkip(s: GameState): Choice[] {
  if (s.age > 12) return [];
  return [
    {
      id: "child:skip",
      label: "跳到十三歲",
      hint: "中間的選擇走穩的那一邊，直接看十三歲的排名和狀況。",
      tone: "quiet",
    },
  ];
}

function skipToThirteen(s: GameState): GameState {
  if (s.age > 12) return s;
  const finishChildYear = () => {
    if (!hasChildFocus(s)) {
      if (s.phaseInYear === "intro" || s.yearQueue.length === 0) openYear(s);
      drainChild(s);
    }
    if (s.season == null) {
      runYear(s, childFocus(s));
      captureSeasonMemories(s);
    }
  };
  finishChildYear();
  while (s.age < 12) {
    settleYearEnd(s);
    s.age += 1;
    s.year += 1;
    openYear(s);
    drainChild(s);
    if (s.season == null) {
      runYear(s, childFocus(s));
      captureSeasonMemories(s);
    }
  }
  settleYearEnd(s);
  s.age += 1;
  s.year += 1;
  return arriveAtThirteen(s);
}

function arriveAtThirteen(s: GameState): GameState {
  const hurt = injuryWord(s);
  const height = currentHeight(s.adultHeight, s.age);
  const results = s.season?.results ?? [];
  const bits = [
    `家裡和${s.coach.name}帶你打到十三歲。現在是${s.year}年。`,
    s.juniorRank ? `青少年排名第 ${s.juniorRank}。` : "還沒有青少年排名。",
  ];
  if (s.ranking) bits.push(`另外有世界排名，第 ${s.ranking}。`);
  if (!hurt) bits.push("身體沒有傷。");
  else if (hurt === "養傷中") bits.push("身體還在養傷。");
  else if (hurt === "舊傷還在") bits.push("舊傷還在。");
  else bits.push(`身上是${hurt}。`);
  bits.push(`大概 ${height} 公分，${moodWord(s.motivation)}。`);
  if (results.length) {
    bits.push(`十二歲的成績：${results.map((r) => `${r.name} ${r.outcome}`).join("、")}。`);
  } else {
    bits.push("十二歲沒有打正式比賽。");
  }
  s.phaseInYear = "script";
  s.card = story(s, "十三歲", bits.join(""), [
    {
      id: "teen:start",
      label: "開始自己決定",
      hint: "從這一年起，怎麼練由你選。",
    },
  ]);
  return s;
}

function finish(s: GameState, reason: string): GameState {
  captureSeasonMemories(s);
  s.retiredReason = reason;
  s.phaseInYear = "ending";
  s.card = { kind: "ending", ending: buildEnding(s) };
  return s;
}

function retireReason(s: GameState, id: string): string {
  if (id === "retire:money") return "這幾年獎金一直不穩，你發現再打下去也養不起自己，決定離開職業網壇。";
  if (id === "retire:body") return "身體已經撐不住一整年的賽季，這次你決定聽醫生的。";
  if (s.peopleGaveUp) return "願意再幫你一把的人變少了。你自己先停下來。";
  if (s.injury === "serious") return "這次傷得太重，你沒有再回來打。";
  if (s.motivation < 38) return "你還打得動，只是不想再過這種日子了。";
  return "你決定明年開始，不再為了排名繼續打。";
}

function mark(s: GameState, id: string, text: string) {
  if (!s.decisionIds.includes(id)) s.decisionIds.push(id);
  s.decisions.push({ year: s.year, age: s.age, choiceId: id, text });
}

function studyCount(s: GameState): number {
  return s.decisionIds.filter((id) => id.startsWith("study:yes:")).length;
}

function yearsSince(s: GameState, prefix: string): number {
  let last = -999;
  for (const id of s.decisionIds) {
    if (!id.startsWith(prefix)) continue;
    const y = Number(id.slice(id.lastIndexOf(":") + 1));
    if (!Number.isNaN(y) && y > last) last = y;
  }
  return last < 0 ? 99 : s.year - last;
}

function settleYearEnd(s: GameState) {
  if (s.injury === "serious" && s.missedHalf) s.injury = "moderate";
  else if (s.injury === "moderate" && s.missedHalf) s.injury = "minor";

  if (s.age === 22 && s.decisionIds.includes("pending:pro")) {
    s.path = "pro";
    if (studyCount(s) >= 2) s.degree = true;
    s.coachNote = "他離開校園了。接下來是巡迴賽。";
  }
  if (s.age === 22 && s.decisionIds.includes("pending:leave")) {
    if (studyCount(s) >= 2) s.degree = true;
    s.pendingRetire = "大學的最後一場比賽打完了。你沒有去辦巡迴賽的註冊。";
  }
}

function openYear(s: GameState): GameState {
  s.missedHalf = false;
  s.rushedReturn = false;
  s.overtrain = false;
  s.studyYear = false;
  s.distracted = false;
  s.yearPrize = 0;
  s.yearSponsor = 0;
  s.yearStory = [];
  s.yearStartStats = { ...s.stats };
  s.season = null;
  s.summary = null;
  s.flash = null;
  const medical =
    (s.investments ?? []).some((i) => i.kind === "medical" && i.untilYear >= s.year) || s.investLeft > 0;
  if (medical) s.chronic = clamp(s.chronic - 2, 0, 100);
  if (s.investLeft > 0) s.investLeft -= 1;

  if (s.sponsor && s.ranking != null && s.ranking > 180 && s.age > 22) {
    s.yearStory.push(`${s.sponsor.brand}沒有續約。`);
    s.sponsor = null;
  }

  if (s.age >= 42) {
    return finish(s, "四十二歲。你還打得動，只是不想再為了週一的比賽飛來飛去。");
  }
  if (s.pendingRetire) {
    const reason = s.pendingRetire;
    s.pendingRetire = null;
    return finish(s, reason);
  }

  const due = (s.echoes ?? []).filter((e) => e.year <= s.year);
  s.echoes = (s.echoes ?? []).filter((e) => e.year > s.year);
  if (due.length) {
    const line = due.map((e) => e.text).join("");
    s.yearStory.push(line);
    s.flash = line;
  }

  s.yearQueue = planYear(s);
  return present(s);
}

function hasChildFocus(s: GameState): boolean {
  return s.decisionIds.some((id) => id.startsWith(`child-focus:${s.year}:`));
}

function parentPick(choices: Choice[]): string {
  const usable = choices.filter((c) => c.id !== "child:skip" && c.id !== "teen:start" && c.id !== "begin" && c.tone !== "exit");
  const quiet = usable.find((c) => c.tone === "quiet");
  return (quiet ?? usable[0] ?? choices[0])!.id;
}

function consumeLead(s: GameState, card: StoryCard): StoryCard {
  if (!s.flash) return card;
  const lead = s.flash;
  s.flash = null;
  if (card.body.includes(lead)) return card;
  return { ...card, body: `${lead}${card.body}` };
}

function peekCard(s: GameState, head: string): StoryCard | null {
  if (head.startsWith("gate:")) return gateCard(s, head.slice(5));
  if (head.startsWith("ev:")) return eventCard(s, head.slice(3));
  return null;
}

function choiceLabel(s: GameState, id: string): string {
  if (s.card.kind !== "story") return id;
  return s.card.choices.find((c) => c.id === id)?.label ?? id;
}

function commit(s: GameState, id: string) {
  const head = s.yearQueue[0] ?? "";
  if (head.startsWith("ev:")) {
    const eventId = head.slice(3);
    if (!s.decisionIds.includes(`seen:${eventId}`)) s.decisionIds.push(`seen:${eventId}`);
    s.flags[`cd:${eventId}`] = s.year;
  }
  const storyBefore = s.yearStory.length;
  const before = snap(s);
  if (id.startsWith("ev:")) resolveEvent(s, id);
  else resolveChoice(s, id);
  stampChoice(s, id);
  if (s.yearStory.length === storyBefore) {
    const line = traceLine(s, id, before);
    if (line) s.yearStory.push(line);
  }
  if (s.yearQueue.length) s.yearQueue.shift();
}

function present(s: GameState): GameState {
  while (s.yearQueue.length) {
    const head = s.yearQueue[0]!;
    if (head === "train") {
      s.yearQueue.shift();
      trainingCard(s);
      if (s.card.kind === "story") s.card = consumeLead(s, s.card);
      return s;
    }
    if (head === "child") {
      s.yearQueue.shift();
      childBrief(s);
      if (s.card.kind === "story") s.card = consumeLead(s, s.card);
      return s;
    }
    const card = peekCard(s, head);
    if (!card) {
      s.yearQueue.shift();
      continue;
    }
    if (head.startsWith("ev:")) {
      const eventId = head.slice(3);
      if (!s.decisionIds.includes(`seen:${eventId}`)) s.decisionIds.push(`seen:${eventId}`);
      s.flags[`cd:${eventId}`] = s.year;
    }
    s.phaseInYear = "script";
    s.card = consumeLead(s, card);
    return s;
  }
  if (s.age <= 12) return childBrief(s);
  return trainingCard(s);
}

function drainChild(s: GameState) {
  for (let i = 0; i < 8 && !hasChildFocus(s); i++) {
    const head = s.yearQueue[0];
    if (!head || head === "child" || head === "train") {
      present(s);
      return;
    }
    const card = peekCard(s, head);
    if (!card?.choices.length) {
      s.yearQueue.shift();
      continue;
    }
    commit(s, parentPick(card.choices));
  }
}

function gateCard(s: GameState, gate: string): StoryCard | null {
  if (gate === "inj") {
    const part = s.majorInjuries.at(-1) ?? "身上那處傷";
    return story(s, "傷還沒好", `${part}還沒好。醫生沒把話說死，教練在等你決定。這種時候回去打，沒有人能保證傷不會變重。`, [
      { id: "inj:rest", label: "今年先養傷", hint: "這一年比賽會少很多。有時候要空下來，傷才養得回來。", tone: "quiet" },
      { id: "inj:rush", label: "還是去打", hint: "你知道有風險，還是想站上場。", tone: "risk" },
    ]);
  }
  if (gate === "path18") {
    const oly = OLYMPICS[s.year];
    const choices: Choice[] = [
      { id: "path:college", label: "去讀大學", hint: "四年在校園。暑假要不要出去打，以後再說。" },
      { id: "path:pro", label: "直接轉職業", hint: "從 ITF 打起。沒有人再幫你排課。", tone: "risk" },
    ];
    if (oly) {
      choices.push({
        id: "path:pro-oly",
        label: `轉職業，並去${oly.city}`,
        hint: "去打奧運的話，那一週就沒辦法拿來賺積分。",
        tone: "risk",
      });
    }
    const lean = s.flags.collegeInterest
      ? "之前有美國的大學教練留過你的名字。"
      : s.flags.proLean
        ? "你自己說過想直接打職業。"
        : "";
    return story(
      s,
      "十八歲了",
      oly
        ? `${oly.city}奧運在這一年。你也可以不去管它，先去辦大學入學。兩條路都不會等你太久。${lean}`
        : `高中的比賽快打完了。接下來要嘛去讀大學，要嘛自己買機票出去打。${lean}`,
      choices,
    );
  }
  if (gate === "grad") {
    const oly = OLYMPICS[s.year];
    const choices: Choice[] = [
      { id: "grad:pro", label: "畢業以後轉職業", hint: "這一年仍是大學生。明年開始算積分。" },
      { id: "grad:leave", label: "打完就離開", hint: "網球可以留在生活裡，不必留在排名裡。", tone: "exit" },
    ];
    if (oly && (s.juniorRank ?? 99) <= 12 || (oly && s.collegeTitles >= 1)) {
      choices.unshift({
        id: "grad:oly",
        label: `先去${oly!.city}，再轉職業`,
        hint: "畢業那年的奧運。打完，再去辦註冊。",
      });
    }
    return story(s, "校園的最後一年", "學位看你這幾年有沒有把書讀完。要不要打職業，看你還想不想每週換一個城市。", choices);
  }
  if (gate === "oly") {
    const oly = OLYMPICS[s.year];
    if (!oly) return null;
    return story(s, `${oly.city}`, "協會打了電話。他們沒有保證你一定能上，只是問你這一年願不願意留一個月給國家隊。", [
      { id: "oly:yes", label: "去", hint: "奧運場次不多，但每一場都不好打。" },
      { id: "oly:no", label: "把週數留給積分", hint: "你不是不想代表台灣，只是排名也得顧。", tone: "quiet" },
    ]);
  }
  if (gate === "asian") {
    const city = ASIAN_GAMES[s.year]?.city;
    if (!city) return null;
    return story(s, `${city}亞運`, "亞運不是大滿貫。可是國旗在，家人也看得到轉播。", [
      { id: "asian:yes", label: "代表出賽", hint: "少打一站積分，多打一週給別人看。" },
      { id: "asian:no", label: "推辭", hint: "你把這週留給原本的賽程。", tone: "quiet" },
    ]);
  }
  if (gate === "campus") {
    return story(s, "學期與暑假", "教授認得你，多半是因為你常缺課。隊友認得你，是因為你週一還在練。兩件事一起顧，會很累。", [
      { id: "campus:study", label: "把學位保住", hint: "比賽少一點。書本多一點。", tone: "quiet" },
      { id: "campus:summer", label: "暑假去打 ITF", hint: "暑假飛去佛州打，學校的事先放著。" },
      { id: "campus:both", label: "兩邊都硬撐", hint: "很少人撐得住。你想試試看。", tone: "risk" },
    ]);
  }
  if (gate === "love") {
    const name = pick(rngFor(s.seed, "partner"), PARTNERS);
    return story(s, name, "有一個人開始在非比賽的日子出現。他不問你下一站去哪，他問你晚上吃什麼。", [
      { id: `love:yes:${name}`, label: "在一起", hint: "巡迴的時候，會多一個人要報平安。" },
      { id: "love:no", label: "先不要", hint: "先專心打球。", tone: "quiet" },
    ]);
  }
  if (gate === "love5") {
    if (!s.partner) return null;
    return story(s, s.partner.name, "電話還是打。只是你們開始用排名解釋為什麼這麼累。不一定要分手，但今晚得講清楚。", [
      { id: "love:stay", label: "繼續", hint: "球不會因此變強，但日子沒那麼空。" },
      { id: "love:end", label: "分開", hint: "晚上是你自己的，但也比較安靜。", tone: "quiet" },
    ]);
  }
  if (gate === "broke") {
    const family = s.wealth !== "tight";
    return story(
      s,
      "錢不夠了",
      family
        ? "機票、教練、治療，這一年的帳先垮了。家裡問你要不要補上，問得很客氣。"
        : "這次家裡沒有辦法再補。巡迴賽要一直花錢，這次錢斷了。",
      family
        ? [
            { id: "broke:family", label: "讓家裡補上", hint: "你會記得這筆錢。他們說不用記得。", tone: "quiet" },
            { id: "retire:money", label: "不打了", hint: "別等到欠錢欠到自己都不想打。", tone: "exit" },
          ]
        : [
            { id: "broke:scrape", label: "縮成最小的賽程，再撐一年", hint: "少飛，少打，看身體和積分還剩什麼。" },
            { id: "retire:money", label: "停", hint: "到這裡停，也可以。", tone: "exit" },
          ],
    );
  }
  if (gate === "stay") {
    return story(
      s,
      s.age >= 30 ? "再打一季" : "還要繼續嗎",
      s.peopleGaveUp
        ? "電話變少了。沒有人在懲罰你，只是大家去看別人的比賽了。"
        : "你知道自己已經不是巔峰。你還是可以再打一季。",
      [
        { id: "stay:yes", label: s.age >= 30 ? "再打一季" : "再打", hint: "理由可以以後再想。" },
        { id: "retire:body", label: "就到這裡", hint: "把名字從下週的報名表拿掉。", tone: "exit" },
      ],
    );
  }
  return null;
}

function childFocus(s: GameState): Focus {
  const hit = [...s.decisionIds].reverse().find((id) => id.startsWith(`child-focus:${s.year}:`));
  const focus = hit?.split(":").pop() as Focus | undefined;
  if (
    focus === "coach" ||
    focus === "tech" ||
    focus === "phys" ||
    focus === "mental" ||
    focus === "intense" ||
    focus === "rest" ||
    focus === "play"
  ) {
    return focus;
  }
  return "coach";
}

function childBrief(s: GameState): GameState {
  const rng = rngFor(s.seed, `parents:${s.year}`);
  const bits: string[] = ["你還小。這一年怎麼過，是爸媽跟教練談出來的，不是你選的。"];

  if (s.injury === "serious" || s.injury === "moderate") {
    const strict = s.coach.id === "chen" || s.coach.id === "zhou";
    const cautious =
      s.hidden.durability < 48 ||
      s.wealth === "tight" ||
      s.coach.id === "lin" ||
      s.coach.id === "xu" ||
      s.coach.id === "park";
    const rush = !cautious && rng() < (strict ? 0.72 : 0.4);
    if (rush) {
      s.rushedReturn = true;
      if (s.injury === "serious") s.injury = "moderate";
      else s.injury = "minor";
      bits.push(`${s.coach.name}覺得再休息會生疏，要你帶傷上場。爸媽最後點了頭。`);
      mark(s, `inj:rush:${s.year}`, `${s.year}，家裡讓你帶傷回去打。`);
    } else {
      s.missedHalf = true;
      s.motivation = clamp(s.motivation - 2, 0, 100);
      s.chronic = clamp(s.chronic - 6, 0, 100);
      bits.push(`爸媽把後面的比賽推掉。${s.coach.name}沒有反對。`);
      mark(s, `inj:rest:${s.year}`, `${s.year}，家裡讓你養傷，沒把賽程排滿。`);
    }
  }

  if (s.age === 11 && !s.decisionIds.includes("first-draw")) {
    const push = s.hidden.mental >= 62 || s.hidden.talent >= 80 || s.coach.id === "chen";
    if (push && rng() < 0.75) {
      s.motivation = clamp(s.motivation + 6, 0, 100);
      bits.push("全國青少年賽報了名。教練說，名單上有你，就要開始想怎麼贏。");
      mark(s, "first-draw", "十一歲，教練要你開始想贏。");
    } else {
      s.confidence = clamp(s.confidence + 2, 1, 99);
      bits.push("全國青少年賽報了名。爸媽說先去練，一張籤表不用想太大。");
      mark(s, "first-draw", "十一歲，家裡沒把第一張籤表說成什麼大事。");
    }
  }

  const focus = pickChildFocus(s, rng);
  const told: Record<Focus, string> = {
    coach: `${s.coach.name}排了整年的表，家裡照著走。`,
    tech: "教練要你多磨球，體能今年先不要加。",
    phys: "教練要你先把體能練起來，球慢慢來。",
    mental: "教練開始管你比賽時的心態，技術今年動得少。",
    intense: "教練把量加上去。爸媽看你還撐得住，就沒攔。",
    rest: "家裡要你練少一點，先把身體顧好。",
    play: "爸媽不讓你放學都耗在球場，學校和玩的時間還留著。",
  };
  bits.push(told[focus]);
  if (s.yearStory.length) bits.push(s.yearStory[s.yearStory.length - 1]!);
  if (s.wealth === "tight") bits.push("家裡的錢就這樣，多的課加不起來。");
  else if (s.wealth === "wealthy" && rng() < 0.5) bits.push("錢不是問題。問題是你肯不肯練。");

  s.decisionIds.push(`child-focus:${s.year}:${focus}`);
  mark(s, `child-year:${s.year}`, `${s.year}，${s.age} 歲這年由家裡和${s.coach.name}做主。`);

  s.phaseInYear = "script";
  s.card = story(
    s,
    s.age < 9 ? "大人決定的一年" : "這一年不是你選的",
    bits.join(""),
    [
      {
        id: "child:play",
        label: s.age < 11 ? "看這一年" : "看這一季",
        hint: s.age < 11 ? "這年紀多半還沒有正式比賽。" : "你還不能改，只能看結果。",
      },
      {
        id: "child:skip",
        label: "跳到十三歲",
        hint: "中間的選擇走穩的那一邊，直接看十三歲的排名和狀況。",
        tone: "quiet",
      },
    ],
  );
  return s;
}

function pickChildFocus(s: GameState, rng: () => number): Focus {
  const w: { item: Focus; w: number }[] = [
    { item: "coach", w: 3 },
    { item: "tech", w: 1.2 },
    { item: "phys", w: 1.2 },
    { item: "play", w: s.age < 9 ? 3.2 : 1.4 },
  ];
  if (s.age >= 10) w.push({ item: "mental", w: 1 });
  const bump = (focus: Focus, n: number) => {
    const row = w.find((x) => x.item === focus);
    if (row) row.w += n;
    else w.push({ item: focus, w: n });
  };
  if (s.coach.id === "chen") {
    bump("coach", 2);
    bump("mental", 1.5);
  }
  if (s.coach.id === "lin") {
    bump("play", 2);
    bump("mental", 1);
  }
  if (s.coach.id === "zhou") {
    bump("phys", 3);
    if (s.age >= 10) bump("intense", 1.2);
  }
  if (s.coach.id === "xu") {
    bump("play", 2);
    bump("coach", 1.5);
  }
  if (s.coach.id === "huang") {
    bump("tech", 1.5);
    bump("phys", 1.5);
  }
  if (s.coach.id === "wu") bump("mental", 2);
  if (s.hidden.technical > s.hidden.physical + 10) bump("tech", 1.6);
  if (s.hidden.physical > s.hidden.technical + 10) bump("phys", 1.6);
  if (s.hidden.mental < 40) bump("play", 1);
  if (s.injury !== "none" || s.chronic > 20) bump("rest", 3);
  const pool = w.filter((x) => s.age >= 10 || x.item !== "intense");
  if (s.wealth === "tight") {
    for (const row of pool) if (row.item === "intense") row.w *= 0.25;
  }
  return weighted(rng, pool);
}

function story(
  s: GameState,
  title: string,
  body: string,
  choices: Choice[],
  kicker?: string,
): StoryCard {
  return {
    kind: "story",
    kicker: kicker ?? `${s.year} · ${s.age} 歲 · ${stageLabel(s)}`,
    title,
    body,
    choices,
  };
}

function resolveChoice(s: GameState, id: string) {
  if (id === "inj:rest") {
    s.missedHalf = true;
    s.motivation = clamp(s.motivation - 2, 0, 100);
    s.chronic = clamp(s.chronic - 6, 0, 100);
    mark(s, `inj:rest:${s.year}`, `${s.year}，你今年先養傷。`);
    s.yearStory.push("你今年先顧身體，比賽少打。");
    return;
  }
  if (id === "inj:rush") {
    s.rushedReturn = true;
    if (s.injury === "serious") s.injury = "moderate";
    else if (s.injury === "moderate") s.injury = "minor";
    mark(s, `inj:rush:${s.year}`, `${s.year}，傷還沒好，你回到場上。`);
    s.yearStory.push("你沒有等到完全好。");
    return;
  }
  if (id === "draw:calm") {
    s.confidence = clamp(s.confidence + 2, 1, 99);
    mark(s, "first-draw", "十一歲，你沒把第一張籤表當大事。");
    return;
  }
  if (id === "draw:want") {
    s.motivation = clamp(s.motivation + 6, 0, 100);
    s.confidence = clamp(s.confidence - 1, 1, 99);
    mark(s, "first-draw", "十一歲，你開始想贏。");
    return;
  }
  if (id === "path:college") {
    s.path = "college";
    s.flags.collegeInterest = s.flags.collegeInterest || s.year;
    mark(s, "path:college", `${s.year}，你去讀大學。`);
    s.yearStory.push("你去辦了入學，沒有辦職業註冊。");
    return;
  }
  if (id === "path:pro" || id === "path:pro-oly") {
    s.path = "pro";
    mark(s, id, `${s.year}，你轉入職業。`);
    s.yearStory.push("從這一年起，比賽開始用錢和積分算。");
    if (id === "path:pro-oly") s.decisionIds.push(`oly:${s.year}`);
    s.flags.proLean = s.flags.proLean || s.year;
    return;
  }
  if (id === "grad:pro" || id === "grad:oly" || id === "grad:leave") {
    mark(s, "college-exit", `${s.year}，你決定大學之後的路。`);
    if (id === "grad:leave") s.decisionIds.push("pending:leave");
    else s.decisionIds.push("pending:pro");
    if (id === "grad:oly") s.decisionIds.push(`oly:${s.year}`);
    s.yearStory.push(id === "grad:leave" ? "你知道這是校園裡的最後一季。" : "你決定畢業以後再轉職業。");
    return;
  }
  if (id === "oly:yes") {
    s.decisionIds.push(`oly:${s.year}`);
    mark(s, `oly-ask:${s.year}`, `${s.year}，你答應國家隊。`);
    return;
  }
  if (id === "oly:no") {
    mark(s, `oly-no:${s.year}`, `${s.year}，你沒有去打奧運。`);
    return;
  }
  if (id === "asian:yes") {
    s.decisionIds.push(`asian:${s.year}`);
    mark(s, `asian-ask:${s.year}`, `${s.year}，你去打亞運。`);
    return;
  }
  if (id === "asian:no") {
    mark(s, `asian-no:${s.year}`, `${s.year}，你沒有去亞運。`);
    return;
  }
  if (id === "sea:yes") {
    s.overseas = true;
    const cost = Math.round(18_000 * era(s.year));
    if (s.wealth === "tight") {
      s.yearStory.push("獎學金夠付旅費。");
    } else {
      s.money = Math.max(0, s.money - cost);
      s.yearStory.push("你去了一段時間的海外訓練。");
    }
    mark(s, "sea:yes", `${s.year}，你接受海外訓練。`);
    s.flags.overseasNetwork = s.flags.overseasNetwork || s.year;
    s.flags.internationalExperience = s.year;
    s.echoes.push({ year: s.year + 3, text: "當初看你打球的那個人，這年又傳了訊息。" });
    return;
  }
  if (id === "sea:no") {
    s.scoutIgnored = true;
    mark(s, "sea:no", `${s.year}，你留下來，沒有跟那個人去。`);
    return;
  }
  if (id === "early:yes") {
    s.decisionIds.push(`early:${s.year}`);
    mark(s, "asked-early", `${s.year}，你第一次去打成人組。`);
    return;
  }
  if (id === "early:no") {
    mark(s, "asked-early", `${s.year}，你決定再留在青少年。`);
    return;
  }
  if (id === "campus:study") {
    s.studyYear = true;
    s.decisionIds.push(`study:yes:${s.year}`);
    mark(s, `campus:study:${s.year}`, `${s.year}，這一年書讀得比較多。`);
    return;
  }
  if (id === "campus:summer") {
    s.decisionIds.push(`summer:${s.year}`);
    s.studiesNeglected = true;
    mark(s, `campus:summer:${s.year}`, `${s.year} 暑假，你去打 ITF。`);
    return;
  }
  if (id === "campus:both") {
    s.studyYear = true;
    s.motivation = clamp(s.motivation - 5, 0, 100);
    s.decisionIds.push(`study:yes:${s.year}`);
    s.decisionIds.push(`summer:${s.year}`);
    mark(s, `campus:both:${s.year}`, `${s.year}，你同時抓學業和暑假比賽。`);
    s.yearStory.push("你幾乎沒有真正的休息週。");
    return;
  }
  if (id === "coach:stay") {
    mark(s, `coachpick:${s.year}`, `${s.year}，你留下${s.coach.name}。`);
    return;
  }
  if (id.startsWith("coach:")) {
    const next = coachById(id.slice(6));
    s.coach = next;
    if (!s.coachesHad.includes(next.name)) s.coachesHad.push(next.name);
    s.coachNote = `${next.archetype}。`;
    mark(s, `coachpick:${s.year}`, `${s.year}，教練換成${next.name}。`);
    s.yearStory.push(`${next.name}開始帶你。`);
    const score = s.hidden.learning * 0.45 + s.hidden.luck * 0.25 + s.motivation * 0.3;
    const roll = rngFor(s.seed, `coach-fit:${s.year}:${next.id}`)() * 100;
    if (roll > score + 28) {
      s.motivation = clamp(s.motivation - 6, 0, 100);
      s.flags.coachConflict = s.year;
      s.yearStory.push("前幾個月對不上。他的練法你還沒吃進去。");
    } else {
      s.yearStory.push("一開始怪怪的，後來開始對上。");
    }
    return;
  }
  if (id.startsWith("sponsor:yes:")) {
    const [, , brand, annualRaw] = id.split(":");
    const annual = Number(annualRaw);
    s.sponsor = { brand: brand || "贊助", annual: Number.isFinite(annual) ? annual : 20_000, sinceYear: s.year };
    s.fame = clamp(s.fame + 4, 0, 100);
    s.flags.sponsorTrust = (s.flags.sponsorTrust ?? 0) + 1;
    mark(s, `sponsor-yes:${s.year}`, `${s.year}，你和${s.sponsor.brand}簽約。`);
    s.yearStory.push(`${s.sponsor.brand}的帽子開始出現在你頭上。`);
    return;
  }
  if (id === "sponsor:no") {
    mark(s, `sponsor-no:${s.year}`, `${s.year}，你沒有簽約。`);
    return;
  }
  if (id.startsWith("love:yes:")) {
    const name = id.slice("love:yes:".length);
    s.partner = { name, sinceYear: s.year };
    s.decisionIds.push("love:asked");
    mark(s, "love:yes", `${s.year}，你和${name}在一起。`);
    s.yearStory.push(`${name}開始出現在非比賽的日子。`);
    return;
  }
  if (id === "love:no") {
    mark(s, "love:asked", `${s.year}，你這一年不想談戀愛。`);
    return;
  }
  if (id === "love:stay") {
    s.motivation = clamp(s.motivation + 4, 0, 100);
    mark(s, "love:later", `${s.year}，你們還在一起。`);
    return;
  }
  if (id === "love:end") {
    const name = s.partner?.name ?? "那個人";
    s.partner = null;
    s.distracted = true;
    s.motivation = clamp(s.motivation - 6, 0, 100);
    mark(s, "love:later", `${s.year}，你和${name}分開。`);
    s.yearStory.push(`${name}不再是你每天要聯絡的人。`);
    return;
  }
  if (id === "wc:yes") {
    s.wildcardUsed = true;
    s.decisionIds.push(`wc:${s.year}`);
    mark(s, `wc-ask:${s.year}`, `${s.year}，你接受一張外卡。`);
    return;
  }
  if (id === "wc:no") {
    mark(s, `wc-ask:${s.year}`, `${s.year}，你沒有去打那張外卡。`);
    return;
  }
  if (id === "body:yes") {
    s.money -= 25_000;
    s.investLeft = 3;
    s.investments.push({ kind: "medical", untilYear: s.year + 3 });
    s.flags.injuryPrevention = s.year;
    s.chronic = clamp(s.chronic - 12, 0, 100);
    mark(s, `bodybuy:${s.year}`, `${s.year}，你把錢花在復健團隊上。`);
    s.yearStory.push("有人開始幫你顧膝蓋和睡眠。");
    return;
  }
  if (id === "body:no") {
    mark(s, `bodybuy:${s.year}`, `${s.year}，你把那筆錢留下。`);
    return;
  }
  if (id === "broke:family") {
    s.money = Math.max(8_000, s.money);
    s.motivation = clamp(s.motivation - 4, 0, 100);
    mark(s, `broke:${s.year}`, `${s.year}，家裡把不夠的錢補上。`);
    s.yearStory.push("家裡補上了，沒有跟你談條件。");
    return;
  }
  if (id === "broke:scrape") {
    s.schedule = "light";
    s.money = Math.max(s.money, 1_500);
    mark(s, `broke:${s.year}`, `${s.year}，你把賽程縮到最小。`);
    return;
  }
  if (id === "stay:yes") {
    s.motivation = clamp(s.motivation + 3, 0, 100);
    mark(s, `stayask:${s.year}`, `${s.year}，你決定再打。`);
    return;
  }
  mark(s, `unhandled:${id}:${s.year}`, `${s.year}，一個沒有名字的決定。`);
}

function trainingCard(s: GameState): GameState {
  s.phaseInYear = "script";
  s.card = story(s, trainingTitle(s), trainingBody(s), focusChoices(s));
  return s;
}

function trainingTitle(s: GameState): string {
  if (s.injury !== "none") return "這一年怎麼練";
  if (s.age < 10) return "放學以後的球場";
  if (s.age === 13) return "第一次自己決定";
  if (s.age < 18) return "賽季開始之前";
  if (s.path === "college") return "學期間的訓練";
  return "這一年的重心";
}

function trainingBody(s: GameState): string {
  if (s.decisionIds.includes(`quiet:${s.year}`)) {
    return `這一年沒有什麼特別的事。你照常訓練、比賽，偶爾回家吃飯。${s.coach.name}還是那句：「${s.coach.line}」`;
  }
  const height = currentHeight(s.adultHeight, s.age);
  const bits = [
    `${s.coach.name}還是那個${s.coach.archetype}。他還是那句：「${s.coach.line}」`,
    `你現在大約 ${height} 公分，家境${wealthLabel(s.wealth)}。`,
  ];
  if (s.age >= 15) bits.push(`別人開始用一句話形容你：${playingStyle(s.stats)}。`);
  if (s.ranking) bits.push(`你帶著世界第 ${s.ranking} 進入這一年。`);
  else if (s.juniorRank && s.age < 18) bits.push(`青少年這邊，你大概在第 ${s.juniorRank}。`);
  const hurt = injuryWord(s);
  if (hurt) bits.push(s.injury === "moderate" ? "傷還沒好。" : `身上還是${hurt}。`);
  if (s.yearStory.length) bits.push(s.yearStory[s.yearStory.length - 1]!);
  return bits.join("");
}

function focusChoices(s: GameState): Choice[] {
  const coach: Choice = {
    id: "train:coach",
    label: "交給教練",
    hint: "照他排的表練，少自己亂加。",
  };
  const tech: Choice = {
    id: "train:tech",
    label: "磨球",
    hint: "抓正拍、反拍、發球。體能今年先放一邊。",
  };
  const phys: Choice = {
    id: "train:phys",
    label: "練身體",
    hint: "跑步、重量訓練，再跑。球感的訓練會慢一點。",
  };
  const mental: Choice = {
    id: "train:mental",
    label: "練關鍵分",
    hint: "練習落後、平分時怎麼打，也練習面對觀眾壓力。技術今年幾乎不變。",
  };
  const intense: Choice = {
    id: "train:intense",
    label: "把量加上去",
    hint: "進步會快。受傷的機會一起加上去。",
    tone: "risk",
  };
  const rest: Choice = {
    id: "train:rest",
    label: "主動減量",
    hint: "排名可能停住。身體會舒服一點。",
    tone: "quiet",
  };
  const play: Choice = {
    id: "train:play",
    label: "留一點給生活",
    hint: "球還在，只是不再把所有時間都排滿。",
    tone: "quiet",
  };

  const out = [coach, tech, phys];
  if (s.injury !== "none" || s.age >= 32 || s.chronic > 28) out.push(rest);
  else if (s.age >= 16 && s.motivation >= 52) out.push(intense);
  else if (s.age < 13 || s.partner || s.path === "college") out.push(play);
  else out.push(mental);
  return out;
}

function runYear(s: GameState, focus: Focus): GameState {
  if (s.age < 18) {
    s.schedule =
      focus === "intense" || focus === "phys" ? "heavy" : focus === "play" || focus === "rest" ? "light" : "normal";
  }
  train(s, focus);
  simulateSeason(s);
  noteRank(s);
  s.phaseInYear = "season";
  s.card = {
    kind: "season",
    report: s.season ?? { results: [], injuryNote: null, biggestWin: null, quiet: true },
  };
  return s;
}

function noteRank(s: GameState) {
  if (s.ranking === 1) s.coachNote = "世界第一了。他還是不太愛說話。";
  else if (s.ranking != null && s.ranking <= 10) s.coachNote = "他開始進入種子行列了。";
  else if (s.firstTop100Age === s.age) s.coachNote = "你進前一百了。從現在開始，每一場比賽都會影響排名。";
  else if (s.peakRank != null && s.peakRank <= 100 && s.age > 24 && (s.ranking == null || s.ranking > 140)) {
    s.coachNote = "他以前排名很高，現在慢慢掉下來了。";
  }
}

function showSummary(s: GameState): GameState {
  captureSeasonMemories(s);
  const summary = makeSummary(s);
  s.summary = summary;
  s.phaseInYear = "summary";
  s.card = { kind: "summary", summary };
  return s;
}

function makeSummary(s: GameState): Summary {
  const results = s.season?.results ?? [];
  const highlights: string[] = [];
  for (const line of s.historyChanges) {
    if (line.startsWith(String(s.year))) highlights.push(line);
  }
  for (const r of results) {
    if (
      r.outcome === "冠軍" ||
      r.outcome === "亞軍" ||
      r.outcome === "四強" ||
      r.tier === "gs" ||
      r.tier === "olympics" ||
      r.tier === "asian"
    ) {
      highlights.push(`${r.name} · ${r.outcome}`);
    }
  }
  if (s.season?.biggestWin && !highlights.includes(s.season.biggestWin)) highlights.push(s.season.biggestWin);
  if (s.season?.injuryNote) highlights.push(s.season.injuryNote);
  if (!highlights.length && s.age >= 11) highlights.push("沒有上新聞的勝利。");

  const development = ALL_KEYS.map((k) => ({
    k,
    d: s.stats[k] - (s.yearStartStats[k] ?? s.stats[k]),
  }))
    .filter((x) => x.d !== 0)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 3)
    .map((x) => `${STAT_LABEL[x.k]} ${x.d > 0 ? "+" : ""}${x.d}`);

  const storyBits = [s.yearStory.join("") || (s.age < 11 ? "這一年主要是長高。" : "這一年沒有特別的事。")];
  for (const mem of s.memories ?? []) {
    if (mem.year === s.year && mem.id !== "firstCoach" && !storyBits[0]!.includes(mem.text.slice(0, 8))) {
      storyBits.push(mem.text);
    }
  }
  const story = storyBits.join("");

  return {
    year: s.year,
    age: s.age,
    rankLabel: rankLabel(s),
    highlights: highlights.slice(0, 5),
    biggestWin: s.season?.biggestWin ?? null,
    development,
    prize: s.yearPrize,
    sponsorPay: s.yearSponsor,
    story,
    next: nextLine(s),
    worldNews: worldNews(s.year, s.slamEdits),
    results: results.map((r) => ({ name: r.name, outcome: r.outcome, surface: r.surface })),
  };
}

function nextLine(s: GameState): string {
  if (s.decisionIds.includes("pending:leave")) return "再過一年，就要離開了。";
  if (s.ranking === 1) return "世界第一不好守，守起來比拿到的時候更累。";
  if (s.ranking != null && s.ranking <= 10) return "你開始會出現在種子名單裡。";
  if (s.injury === "serious" || s.injury === "moderate") return "明年要先問身體。";
  if (s.path === "college" && s.age < 22) return "大學的比賽還有機會再打。";
  if (s.age < 12) return "你還在長。明年怎麼練，還是家裡和教練說了算。";
  if (s.age === 12) return "明年十三歲，開始輪到你自己選。";
  if (s.peopleGaveUp) return "不會再有人主動打電話來。";
  return "下一季還會來。你只要決定時間花在哪。";
}
