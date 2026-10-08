import { COACHES, eligibleCoaches } from "./coaches";
import { era, money, stageLabel } from "./format";
import { playerName, topLegend } from "./history";
import { clamp, pick, rngFor, type Rng } from "./rng";
import type { Choice, Coach, GameState, StatKey, StoryCard } from "./types";

const RIVAL_NAMES = ["林柏宇", "陳子睿", "黃柏宏", "張宇恩", "李承恩", "吳廷宇", "蔡承翰", "周柏成"];
const RIVAL_STYLES = ["靠正拍的底線", "反拍比正拍穩", "喜歡上網", "很能磨"];
const HOBBIES = ["拍照", "吉他", "寫程式", "做小生意的念頭"];

interface Spec {
  id: string;
  minAge: number;
  maxAge: number;
  once?: boolean;
  gap?: number;
  rare?: boolean;
  tags: string[];
  weight: (s: GameState) => number;
  card: (s: GameState) => StoryCard | null;
}

function seen(s: GameState, id: string): boolean {
  return s.decisionIds.includes(`seen:${id}`);
}

function cooled(s: GameState, id: string, gap: number): boolean {
  const y = s.flags[`cd:${id}`] ?? 0;
  if (!y) return true;
  return s.year - y >= gap;
}

function open(s: GameState, id: string, min: number, max: number, once?: boolean, gap?: number): boolean {
  if (s.age < min || s.age > max) return false;
  if (once && seen(s, id)) return false;
  if (!once && !cooled(s, id, gap ?? 2)) return false;
  return true;
}

function adj(s: GameState, w: number, kind: "up" | "down" | "flat"): number {
  if (w <= 0) return 0;
  if (kind === "up") return w * (0.55 + s.hidden.luck / 120);
  if (kind === "down") return w * (1.4 - s.hidden.luck / 140);
  return w;
}

function story(s: GameState, title: string, body: string, choices: Choice[]): StoryCard {
  return {
    kind: "story",
    kicker: `${s.year} · ${s.age} 歲 · ${stageLabel(s)}`,
    title,
    body,
    choices,
  };
}

function note(s: GameState, id: string, text: string) {
  if (!s.decisionIds.includes(id)) s.decisionIds.push(id);
  s.decisions.push({ year: s.year, age: s.age, choiceId: id, text });
}

function bump(s: GameState, key: StatKey, n: number) {
  s.stats[key] = clamp(s.stats[key] + n, 1, 99);
}

function spend(s: GameState, cost: number, free = false) {
  if (free) {
    s.yearStory.push("這筆錢不用你出。");
    return;
  }
  if ((s.wealth === "wealthy" || s.wealth === "comfortable") && s.money < cost) {
    s.money = Math.max(0, s.money - Math.round(cost * 0.4));
    s.yearStory.push("家裡把差額補上了。");
    return;
  }
  s.money -= cost;
  s.yearStory.push(`這趟大約花了${money(cost)}。`);
}

function costOf(s: GameState, base: number): number {
  return Math.round(base * era(s.year));
}

function shyTravel(s: GameState, w: number): number {
  const y = s.flags.overseasMissed ?? 0;
  if (!y || w <= 0 || s.year - y > 2) return w;
  return w * 0.6;
}

function rich(s: GameState): boolean {
  return s.wealth === "wealthy" || s.wealth === "comfortable";
}

function scholarship(s: GameState): boolean {
  return s.wealth === "tight" && (s.hidden.luck >= 64 || s.hidden.talent >= 82);
}

function moneyLine(s: GameState, cost: number, free: boolean): string {
  if (free) return "家裡不用再掏一筆。";
  if (s.wealth === "tight") return `大約 ${money(cost)}。這筆錢家裡要算很久。`;
  if (s.wealth === "wealthy") return `大約 ${money(cost)}。家裡負擔得起。`;
  return `大約 ${money(cost)}。不是小數目。`;
}

function offeredCoach(s: GameState, tag: string): Coach | null {
  const pool = eligibleCoaches(s).slice(0, 4);
  if (!pool.length) return null;
  return pick(rngFor(s.seed, tag), pool);
}

function rivalOf(s: GameState) {
  return s.rivals[0] ?? null;
}

function rivalRankWord(form: number): string {
  const n = clamp(Math.round(420 - form * 4), 12, 520);
  if (n <= 30) return "世界前三十";
  if (n <= 80) return "世界前八十";
  if (n <= 160) return "世界前一百五附近";
  return "還在挑戰賽和 ITF 之間";
}

function rematchWon(s: GameState): boolean {
  const r = rivalOf(s);
  if (!r) return false;
  const mine = (s.stats.forehand + s.stats.speed + s.stats.mental) / 3;
  const rng = rngFor(s.seed, `rematch:${s.year}`);
  return mine + (rng() - 0.45) * 18 > r.form;
}

function ensureRival(s: GameState, bond: "rival" | "respect") {
  if (s.rivals.length) {
    s.rivals[0]!.bond = bond;
    return s.rivals[0]!;
  }
  const rng = rngFor(s.seed, "rival-name");
  const pool = RIVAL_NAMES.filter((n) => n !== s.name);
  const name = pick(rng, pool.length ? pool : RIVAL_NAMES);
  const style = pick(rng, RIVAL_STYLES);
  const ceiling = clamp(Math.round(58 + rng() * 34), 52, 94);
  const rival = { name, style, bond, form: clamp(46 + Math.round(rng() * 16), 40, 70), ceiling };
  s.rivals.push(rival);
  return rival;
}

function addInvest(s: GameState, kind: "medical" | "fitness" | "tech" | "data" | "network", years: number) {
  s.investments.push({ kind, untilYear: s.year + years });
  s.investLeft = Math.max(s.investLeft, years);
}

function fitBad(s: GameState, tag: string): boolean {
  const score = s.hidden.learning * 0.45 + s.hidden.luck * 0.25 + s.motivation * 0.3;
  const roll = rngFor(s.seed, tag)() * 100;
  return roll > score + 28;
}

export function driftRivals(s: GameState) {
  for (const r of s.rivals) {
    const rng = rngFor(s.seed, `rival-drift:${r.name}:${s.year}`);
    const pull = (r.ceiling - r.form) * 0.18;
    r.form = clamp(Math.round(r.form + pull + (rng() - 0.5) * 5), 22, 97);
    const age = s.year - (s.year - s.age);
    if (age > 29) r.form = clamp(r.form - 1, 22, 97);
  }
}

function seaCard(s: GameState): StoryCard {
  const free = scholarship(s);
  const cost = costOf(s, 18000);
  return story(
    s,
    "有人看了你打球",
    free
      ? "一間海外訓練營願意給你名額。家裡不用再掏一筆。你要離開原來的教練一段時間。"
      : `有人建議你去海外練一個週期。${moneyLine(s, cost, false)}人要自己去。`,
    [
      { id: "sea:yes", label: "去", hint: "練習的環境會好一點，家會比較遠。" },
      { id: "sea:no", label: "留在這裡", hint: "你認得這裡的球場，也知道怎麼回家。", tone: "quiet" },
    ],
  );
}

function earlyCard(s: GameState): StoryCard {
  return story(
    s,
    "台南有一站 ITF",
    "你還是青少年，但已經可以去看成人賽的籤表了。教練說可以去試試，也可以再等。輸掉第一輪的機率不低。",
    [
      { id: "early:yes", label: "去打成人組", hint: "輸給大人不丟臉，但會知道自己差在哪。", tone: "risk" },
      { id: "early:no", label: "再打一年青少年", hint: "你還不想這麼早被大人教訓。", tone: "quiet" },
    ],
  );
}

function coachCard(s: GameState): StoryCard | null {
  const pool = eligibleCoaches(s).slice(0, 2);
  if (!pool.length) return null;
  return story(
    s,
    "有人想接手你",
    `${s.coach.name}帶你到這裡。新的練法跟現在不一樣。沒有人知道你們合不合。`,
    [
      { id: "coach:stay", label: `留下${s.coach.name}`, hint: "練法不用重來。進步大概也還是原來的速度。", tone: "quiet" },
      ...pool.map((c) => ({
        id: `coach:${c.id}`,
        label: c.name,
        hint: `${c.archetype}。他說：「${c.line}」`,
        tone: "risk" as const,
      })),
    ],
  );
}

function brandsFor(rank: number): string[] {
  if (rank <= 15) return ["Wilson", "Yonex", "Babolat"];
  if (rank <= 50) return ["HEAD", "Babolat", "VICTOR"];
  return ["VICTOR", "Prince", "Dunlop"];
}

function annualFor(rank: number): number {
  if (rank <= 5) return 2_200_000;
  if (rank <= 15) return 800_000;
  if (rank <= 40) return 260_000;
  if (rank <= 80) return 80_000;
  return 22_000;
}

function sponsorCard(s: GameState): StoryCard | null {
  if (s.ranking == null) return null;
  const annual = annualFor(s.ranking);
  const brand = pick(rngFor(s.seed, `brand:${s.year}:${s.ranking}`), brandsFor(s.ranking));
  const known = s.ranking <= 40 ? "這種邀請以前輪不到你。" : "這是你這陣子看過比較具體的數字。";
  return story(
    s,
    brand,
    s.sponsor
      ? `${s.sponsor.brand}的合約還在。${brand}開了新的數字，一年 ${money(annual)}。他們要帽子，也要一部分照片。${known}`
      : `${brand}願意付你一年 ${money(annual)}。條件很普通：帽子、拍框，還有你得留在排名上。${known}`,
    [
      { id: `sponsor:yes:${brand}:${annual}`, label: "簽約", hint: "錢會先入帳，名字也會先印在別人的型錄上。" },
      { id: "sponsor:no", label: "先不簽", hint: "想再等更好的條件，或沒那麼吵的牌子。", tone: "quiet" },
    ],
  );
}

function wcCard(s: GameState): StoryCard {
  return story(
    s,
    "一張外卡",
    "有一站 ATP 二百五願意給你外卡，讓你進會外賽。不是你排名夠了，是剛好有一個空位。",
    [
      { id: "wc:yes", label: "接", hint: "輸了也是輸在更大的球場。", tone: "risk" },
      { id: "wc:no", label: "不去", hint: "你不想用一張人情換一場可能的首輪。", tone: "quiet" },
    ],
  );
}

const EVENTS: Spec[] = [
  {
    id: "teacher",
    minAge: 6,
    maxAge: 11,
    once: true,
    tags: ["school"],
    weight: (s) => (open(s, "teacher", 6, 11, true) ? 1.6 : 0),
    card: (s) =>
      story(s, "體育課", "老師讓大家自己選。你還是拿了球拍。有同學第一次看到你發球，問你這到底怎麼打的。", [
        { id: "ev:teacher:show", label: "隨便打給他看", hint: "沒什麼獎金。就是有人第一次覺得你會打球。" },
        { id: "ev:teacher:shrug", label: "笑一下就去撿球", hint: "你不太想在體育課表演。", tone: "quiet" },
      ]),
  },
  {
    id: "family-trip",
    minAge: 6,
    maxAge: 12,
    once: true,
    tags: ["life"],
    weight: (s) => (open(s, "family-trip", 6, 12, true) ? (s.wealth === "tight" ? 0.7 : 1.5) : 0),
    card: (s) =>
      story(
        s,
        "家人想出門",
        s.wealth === "tight"
          ? "有人提議去親戚家住兩天。沒有什麼景點，就是不用練球。"
          : "家裡想出去幾天。教練說那幾天的課可以補，也可以不補。",
        [
          { id: "ev:family-trip:go", label: "去", hint: "球會停幾天。人會比較輕。" },
          { id: "ev:family-trip:stay", label: "留下練", hint: "出遊的照片沒有你。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "soccer",
    minAge: 8,
    maxAge: 12,
    once: true,
    tags: ["sport"],
    weight: (s) => (open(s, "soccer", 8, 12, true) ? 2.2 : 0),
    card: (s) =>
      story(
        s,
        "體育課的足球",
        "足球老師覺得你跑得很快，問你要不要加入校隊。時間跟網球撞在一起。",
        [
          { id: "ev:soccer:go", label: "去踢足球", hint: "速度和朋友會多一點。網球那幾堂就少了。", tone: "risk" },
          { id: "ev:soccer:stay", label: "還是去打網球", hint: "校隊的事你當沒聽見。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "move",
    minAge: 8,
    maxAge: 13,
    once: true,
    tags: ["life"],
    weight: (s) => (open(s, "move", 8, 13, true) ? 0.7 : 0),
    card: (s) =>
      story(s, "家要搬", "新家離原來的球場比較遠。教練還是同一位，只是下課以後要換一種方式過去。", [
        { id: "ev:move:adapt", label: "照樣去練", hint: "路變長。課沒有因此取消。" },
        { id: "ev:move:ease", label: "先少去幾週", hint: "等生活安頓。球會生疏一點。", tone: "quiet" },
      ]),
  },
  {
    id: "swim",
    minAge: 9,
    maxAge: 13,
    once: true,
    tags: ["sport"],
    weight: (s) => (open(s, "swim", 9, 13, true) ? 1.15 : 0),
    card: (s) =>
      story(s, "另一項運動", "學校的游泳隊缺人。教練沒有禁止，他只說每週只能少兩堂網球。", [
        { id: "ev:swim:go", label: "去游泳", hint: "體能也許會好。網球的時間會被切走。" },
        { id: "ev:swim:stay", label: "不去", hint: "你已經有一項要練的了。", tone: "quiet" },
      ]),
  },
  {
    id: "weekend",
    minAge: 10,
    maxAge: 16,
    gap: 3,
    tags: ["life"],
    weight: (s) => (open(s, "weekend", 10, 16, false, 3) ? 1.7 : 0),
    card: (s) =>
      story(s, "同學約你", "這週末有人約你出去兩天。你已經連續練了好幾天。教練沒有說不行，他只是看了你一眼。", [
        { id: "ev:weekend:go", label: "去", hint: "訓練會空一塊。人也會鬆一點。" },
        { id: "ev:weekend:stay", label: "不去", hint: "課表還是滿的。", tone: "quiet" },
      ]),
  },
  {
    id: "extra",
    minAge: 9,
    maxAge: 17,
    gap: 3,
    tags: ["body"],
    weight: (s) => {
      if (!open(s, "extra", 9, 17, false, 3)) return 0;
      if (s.injury === "serious" || s.injury === "moderate") return 0;
      return s.motivation >= 50 ? 2.1 : 1.2;
    },
    card: (s) =>
      story(
        s,
        "再加兩堂",
        `${s.coach.name}說，如果你願意，每週可以再多兩堂。這種量很兇，他也提醒身體可能吃不消。`,
        [
          { id: "ev:extra:yes", label: "加", hint: "進步的機會變多。受傷的機會一起變多。", tone: "risk" },
          { id: "ev:extra:no", label: "先維持現在", hint: "表還是原來那張。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "hobby",
    minAge: 13,
    maxAge: 19,
    once: true,
    tags: ["life"],
    weight: (s) => (open(s, "hobby", 13, 19, true) ? 1.35 : 0),
    card: (s) => {
      const hobby = pick(rngFor(s.seed, `hobby:${s.year}`), HOBBIES);
      return story(s, "球以外的事", `有人拉你去碰${hobby}。不是為了成績。只是星期天空下來的那兩小時，你可以不拿球拍。`, [
        { id: "ev:hobby:yes", label: "留一點時間給它", hint: "不會讓你變成另一種職業。以後也許用得上。" },
        { id: "ev:hobby:no", label: "先不要", hint: "空的時間你還是想拿去練球。", tone: "quiet" },
      ]);
    },
  },
  {
    id: "crush",
    minAge: 14,
    maxAge: 17,
    once: true,
    tags: ["life"],
    weight: (s) => (open(s, "crush", 14, 17, true) ? 1.25 : 0),
    card: (s) =>
      story(s, "有一個人", "班上有一個人會在你練完球以後等你一起走。沒有人在談未來。就是放學那一段路變短了。", [
        { id: "ev:crush:yes", label: "一起走", hint: "心會放在別的地方一點點。練球不會因此停。" },
        { id: "ev:crush:no", label: "假裝沒看到", hint: "你把耳機戴上，直接去球場。", tone: "quiet" },
      ]),
  },
  {
    id: "exam",
    minAge: 12,
    maxAge: 22,
    gap: 3,
    tags: ["school"],
    weight: (s) => {
      if (!open(s, "exam", 12, 22, false, 3)) return 0;
      if (s.path === "pro") return 0;
      return s.path === "college" ? 2.4 : 1.9;
    },
    card: (s) =>
      story(
        s,
        "考試撞上比賽",
        s.path === "college"
          ? "期中考的那週，剛好有一站你想打的比賽。教授不會幫你改日期。"
          : "這次段考剛好撞上比賽。老師問你要不要補考，語氣普通，沒有特別幫你。",
        [
          { id: "ev:exam:play", label: "去比賽", hint: "書會落後。籤表上還有你。", tone: "risk" },
          { id: "ev:exam:study", label: "留下考試", hint: "這一站不去。成績單會好看一點。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "rival-meet",
    minAge: 11,
    maxAge: 14,
    once: true,
    tags: ["rival"],
    weight: (s) => (open(s, "rival-meet", 11, 14, true) && s.rivals.length === 0 ? 6 : 0),
    card: (s) => {
      const name = ensureRival(s, "rival").name;
      return story(s, name, `全國賽你輸給一個跟你差不多大的人。他叫${name}。沒有什麼特別的原因，就是那天他比你好。`, [
        { id: "ev:rival-meet:lock", label: "記住他", hint: "你以後看到這名字會停一下。" },
        { id: "ev:rival-meet:let", label: "打完就算了", hint: "輸一場，不必變成故事。", tone: "quiet" },
      ]);
    },
  },
  {
    id: "rival-rematch",
    minAge: 14,
    maxAge: 16,
    once: true,
    tags: ["rival"],
    weight: (s) => (open(s, "rival-rematch", 14, 16, true) && rivalOf(s) ? 3.6 : 0),
    card: (s) => {
      const r = rivalOf(s)!;
      const won = rematchWon(s);
      return story(
        s,
        `又是${r.name}`,
        won
          ? `這次你贏了${r.name}。他還是那個${r.style}的打法。贏完你沒有覺得事情結束。`
          : `你又輸給${r.name}。他還是${r.style}。你知道差距在哪，只是當天改不了。`,
        [
          { id: "ev:rival-rematch:chase", label: "還是想贏他", hint: "這個名字會跟著你一陣子。" },
          { id: "ev:rival-rematch:drop", label: "先不管他", hint: "其他人的比賽也得打。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "rival-adult",
    minAge: 17,
    maxAge: 19,
    once: true,
    tags: ["rival"],
    weight: (s) => (open(s, "rival-adult", 17, 19, true) && rivalOf(s) ? 3 : 0),
    card: (s) => {
      const r = rivalOf(s)!;
      return story(
        s,
        r.name,
        `${r.name}也開始打成人組了。你們在選手休息室碰到。他沒有多說話，只問你下一站去哪。`,
        [
          { id: "ev:rival-adult:aim", label: "把他當一個目標", hint: "不是仇恨。是你需要一個具體的名字。" },
          { id: "ev:rival-adult:own", label: "各打各的", hint: "你不想把別人的賽程掛在自己身上。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "rival-ch",
    minAge: 21,
    maxAge: 24,
    once: true,
    tags: ["rival"],
    weight: (s) => {
      if (!open(s, "rival-ch", 21, 24, true) || !rivalOf(s)) return 0;
      if (s.path !== "pro" && s.ranking == null) return 0;
      return 2.6;
    },
    card: (s) => {
      const r = rivalOf(s)!;
      return story(
        s,
        "同一張籤表",
        `有一站挑戰賽，${r.name}也報了名。開賽前你們在餐廳碰到。他現在${rivalRankWord(r.form)}。`,
        [
          { id: "ev:rival-ch:nod", label: "打聲招呼", hint: "舊識還在。比分以後再說。" },
          { id: "ev:rival-ch:cold", label: "當沒看到", hint: "你想把注意力留在自己的第一輪。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "rival-atp",
    minAge: 25,
    maxAge: 30,
    once: true,
    tags: ["rival"],
    weight: (s) => {
      if (!open(s, "rival-atp", 25, 30, true) || !rivalOf(s)) return 0;
      if (s.ranking == null || s.ranking > 180) return 0;
      return 2.5;
    },
    card: (s) => {
      const r = rivalOf(s)!;
      return story(
        s,
        r.name,
        `抽籤出來，${r.name}在另一區。他現在${rivalRankWord(r.form)}。記者如果看到你們的名字放在一起，會想寫一點舊帳。`,
        [
          { id: "ev:rival-atp:talk", label: "賽前講兩句", hint: "你們認識很久了。這不影響明天的發球。" },
          { id: "ev:rival-atp:skip", label: "等到場上再說", hint: "你不想在走廊把事情講完。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "asia-camp",
    minAge: 12,
    maxAge: 17,
    once: true,
    tags: ["travel"],
    weight: (s) => {
      if (!open(s, "asia-camp", 12, 17, true) || s.overseas) return 0;
      let w = 2.3;
      if (s.wealth === "wealthy") w += 1;
      if (s.wealth === "tight") w = scholarship(s) ? 2 : 0.7;
      return shyTravel(s, adj(s, w, "up"));
    },
    card: (s) => {
      const free = scholarship(s);
      const cost = costOf(s, 7000);
      return story(
        s,
        "亞洲的訓練營",
        `教練收到一個亞洲青少年訓練營的邀請。${moneyLine(s, cost, free)}去的話，會累，也會第一次跟別的國家的同齡人一起練。`,
        [
          { id: "ev:asia-camp:yes", label: "去", hint: "錢和疲勞換一點國外的比賽感覺。" },
          { id: "ev:asia-camp:no", label: "這次先不去", hint: "國內的課表還打得完。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "sea",
    minAge: 15,
    maxAge: 16,
    once: true,
    tags: ["travel"],
    weight: (s) => {
      if (!open(s, "sea", 15, 16, true) || s.overseas || s.scoutIgnored) return 0;
      let w = 5;
      if (s.wealth === "tight" && s.hidden.luck < 62 && s.hidden.talent < 80) w = 0.35;
      return shyTravel(s, adj(s, w, "up"));
    },
    card: seaCard,
  },
  {
    id: "spain",
    minAge: 14,
    maxAge: 17,
    once: true,
    tags: ["travel"],
    weight: (s) => {
      if (!open(s, "spain", 14, 17, true) || s.overseas) return 0;
      let w = 3.1;
      if (s.wealth === "wealthy") w += 1.2;
      if (s.wealth === "tight") w = scholarship(s) ? 2.4 : 0.55;
      return shyTravel(s, adj(s, w, "up"));
    },
    card: (s) => {
      const free = scholarship(s);
      const cost = costOf(s, s.age >= 16 ? 16000 : 11000);
      return story(
        s,
        "西班牙訓練營",
        `一個月。${moneyLine(s, cost, free)}那裡的量比你現在高，紅土也多。沒有人能保證這次會有用。`,
        [
          { id: "ev:spain:yes", label: "去", hint: "花錢，人也遠。有機會碰到以後還聯絡得上的教練。" },
          { id: "ev:spain:no", label: "不去", hint: "留在原本的教練和球場。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "early",
    minAge: 15,
    maxAge: 18,
    once: true,
    tags: ["tennis"],
    weight: (s) => {
      if (!open(s, "early", 15, 18, true)) return 0;
      if (s.path !== "undecided" && s.path !== "college") return 0;
      if (s.decisionIds.includes("asked-early")) return 0;
      if (s.age >= 18) return 0;
      const rankOk = s.juniorRank == null || s.juniorRank <= 120;
      return rankOk ? adj(s, 3.4, "up") : 0.4;
    },
    card: earlyCard,
  },
  {
    id: "unknown-coach",
    minAge: 14,
    maxAge: 26,
    gap: 5,
    tags: ["coach"],
    weight: (s) => (open(s, "unknown-coach", 14, 26, false, 5) && offeredCoach(s, `unknown-coach:${s.year}`) ? adj(s, 2.2, "up") : 0),
    card: (s) => {
      const c = offeredCoach(s, `unknown-coach:${s.year}`);
      if (!c) return null;
      return story(
        s,
        "一位你不熟的教練",
        `${c.name}看完你的比賽。他是${c.archetype}。他說他知道問題在哪，但也要你先離開現在的練法一個月。合不合，試了才知道。`,
        [
          { id: `ev:unknown-coach:try:${c.id}`, label: "試一個月", hint: "可能換成他，也可能一個月後回到原點。", tone: "risk" },
          { id: "ev:unknown-coach:no", label: "先不要", hint: `你還是跟著${s.coach.name}。`, tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "us-academy",
    minAge: 15,
    maxAge: 18,
    once: true,
    tags: ["travel"],
    weight: (s) => {
      if (!open(s, "us-academy", 15, 18, true)) return 0;
      let w = 2.5;
      if (s.wealth === "wealthy") w += 1.3;
      if (s.wealth === "tight") w = scholarship(s) ? 2.2 : 0.45;
      if ((s.flags.collegeInterest ?? 0) > 0) w += 1;
      return shyTravel(s, adj(s, w, "up"));
    },
    card: (s) => {
      const free = scholarship(s);
      const cost = costOf(s, 18000);
      return story(
        s,
        "美國的學院",
        `一間美國訓練學院願意讓你去試訓幾週。${moneyLine(s, cost, free)}人會離很遠。以後如果要讀大學，這段名字也許有人認得。`,
        [
          { id: "ev:us-academy:yes", label: "去", hint: "訓練和人脈會不一樣。家會比較遠。" },
          { id: "ev:us-academy:no", label: "留下來", hint: "錢和原本的生活都還在。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "scout",
    minAge: 15,
    maxAge: 18,
    once: true,
    tags: ["path"],
    weight: (s) => {
      if (!open(s, "scout", 15, 18, true) || s.path !== "undecided") return 0;
      let w = 2.8;
      if ((s.flags.collegeNetwork ?? 0) > 0 || s.overseas) w += 1.4;
      if (s.juniorRank != null && s.juniorRank <= 40) w += 0.8;
      return adj(s, w, "up");
    },
    card: (s) =>
      story(
        s,
        "大學球探",
        "一位美國大學的教練看完你的比賽。他沒有給獎學金的保證，他問你有沒有興趣去美國打大學網球。",
        [
          { id: "ev:scout:yes", label: "有興趣", hint: "十八歲那張表上，大學這條會比較具體。" },
          { id: "ev:scout:pro", label: "我想直接打職業", hint: "你先把這句話說出來。以後還是可以改。" },
        ],
      ),
  },
  {
    id: "first-sponsor",
    minAge: 14,
    maxAge: 22,
    once: true,
    tags: ["sponsor"],
    weight: (s) => {
      if (!open(s, "first-sponsor", 14, 22, true) || s.sponsor) return 0;
      let w = 2.1;
      if (s.juniorRank != null && s.juniorRank <= 30) w += 1;
      if (s.fame >= 12) w += 0.6;
      return adj(s, w, "up");
    },
    card: (s) => {
      const brand = pick(rngFor(s.seed, `junior-brand:${s.year}`), ["VICTOR", "Prince", "Dunlop"]);
      const annual = costOf(s, 4500);
      return story(
        s,
        brand,
        `${brand}願意提供球拍和一點旅費，一年大概 ${money(annual)}。合約很短。這是你第一份比較像正式贊助的東西。`,
        [
          { id: `ev:first-sponsor:yes:${brand}:${annual}`, label: "簽", hint: "裝備和一點錢。名字會出現在別人的型錄角落。" },
          { id: "ev:first-sponsor:no", label: "不簽", hint: "你想等大一點的牌子。也可能等不到。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "tutoring",
    minAge: 16,
    maxAge: 21,
    gap: 4,
    tags: ["money"],
    weight: (s) => {
      if (!open(s, "tutoring", 16, 21, false, 4)) return 0;
      if (s.wealth === "wealthy") return 0;
      if (s.path === "pro" && s.ranking != null && s.ranking <= 200) return 0.3;
      return adj(s, s.wealth === "tight" ? 2.4 : 1.3, "down");
    },
    card: (s) =>
      story(
        s,
        "補習的工作",
        s.wealth === "tight"
          ? "有人找你課後教小朋友打球。一次的錢不多，但家裡會注意到。"
          : "俱樂部問你要不要帶週末的初學班。會佔掉你自己的訓練。",
        [
          { id: "ev:tutoring:yes", label: "接", hint: "有一點現金。你自己的課會少。" },
          { id: "ev:tutoring:no", label: "不接", hint: "時間留著。錢的事再想別的辦法。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "coach-cycle",
    minAge: 16,
    maxAge: 36,
    gap: 4,
    tags: ["coach"],
    weight: (s) => {
      if (!open(s, "coach-cycle", 16, 36, false, 4)) return 0;
      if (!eligibleCoaches(s).length) return 0;
      const since = yearsSince(s, "coachpick:");
      if (since < 3) return 0;
      let w = 2.3;
      if (s.coach.youth && s.age >= 17) w += 1.4;
      if ((s.flags.coachConflict ?? 0) > 0 && s.year - s.flags.coachConflict < 3) w += 1;
      if ((s.flags.coachStability ?? 0) > 0 && s.year - s.flags.coachStability < 3) w *= 0.5;
      return w;
    },
    card: coachCard,
  },
  {
    id: "coach-callback",
    minAge: 17,
    maxAge: 21,
    once: true,
    tags: ["coach"],
    weight: (s) => {
      if (!open(s, "coach-callback", 17, 21, true)) return 0;
      const y = s.flags.metGreatCoach ?? 0;
      if (!y || s.year < y + 1) return 0;
      return 4;
    },
    card: (s) =>
      story(
        s,
        "電話從西班牙打來",
        "之前訓練營那個教練打來。他沒有要你馬上過去。他問你接下來要繼續找他問問題，還是去看美國大學的訓練。",
        [
          { id: "ev:coach-callback:keep", label: "保持聯絡", hint: "以後換教練、找比賽，也許還有這條線。" },
          { id: "ev:coach-callback:school", label: "問問大學", hint: "你把興趣放在校園這條，不先綁教練。" },
          { id: "ev:coach-callback:no", label: "跟他說先不用", hint: `你現在的教練是${s.coach.name}。`, tone: "quiet" },
        ],
      ),
  },
  {
    id: "coach-intro",
    minAge: 20,
    maxAge: 25,
    once: true,
    tags: ["coach"],
    weight: (s) => {
      if (!open(s, "coach-intro", 20, 25, true)) return 0;
      if (!(s.flags.overseasNetwork || s.flags.metGreatCoach)) return 0;
      return offeredCoach(s, `intro-coach:${s.year}`) ? 3.2 : 0;
    },
    card: (s) => {
      const c = offeredCoach(s, `intro-coach:${s.year}`);
      if (!c) return null;
      return story(
        s,
        "他介紹了一個人",
        `西班牙那個舊識介紹${c.name}。${c.archetype}。他可以帶你看挑戰賽這一層，但你們沒有一起練過。合不合，沒有人先知道。`,
        [
          { id: `ev:coach-intro:yes:${c.id}`, label: `讓${c.name}帶`, hint: "換人。前幾個月可能對不上。", tone: "risk" },
          { id: "ev:coach-intro:no", label: "先謝謝，不換", hint: "線留著。人先不換。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "sponsor-pro",
    minAge: 18,
    maxAge: 36,
    gap: 3,
    tags: ["sponsor"],
    weight: (s) => {
      if (!open(s, "sponsor-pro", 18, 36, false, 3)) return 0;
      if (s.path !== "pro" || s.ranking == null || s.ranking > 130) return 0;
      if (yearsSince(s, "sponsor-no:") < 2) return 0;
      const annual = annualFor(s.ranking);
      if (s.sponsor && s.sponsor.annual >= annual * 0.85) return 0;
      return adj(s, s.ranking <= 40 ? 4 : 3, "up");
    },
    card: sponsorCard,
  },
  {
    id: "wc-small",
    minAge: 20,
    maxAge: 30,
    gap: 3,
    tags: ["wildcard"],
    weight: (s) => {
      if (!open(s, "wc-small", 20, 30, false, 3) || s.wildcardUsed) return 0;
      if (s.path !== "pro" || s.ranking == null) return 0;
      if (s.ranking <= 70 || s.ranking >= 220) return 0;
      let w = 2.8;
      if ((s.flags.overseasNetwork ?? 0) > 0) w += 0.8;
      return adj(s, w, "up");
    },
    card: wcCard,
  },
  {
    id: "big-wc",
    minAge: 19,
    maxAge: 32,
    gap: 4,
    tags: ["wildcard"],
    weight: (s) => {
      if (!open(s, "big-wc", 19, 32, false, 4) || s.wildcardUsed) return 0;
      if (s.path !== "pro" || s.ranking == null || s.ranking > 90) return 0;
      let w = s.ranking <= 50 ? 3.2 : 2.2;
      if ((s.flags.overseasNetwork ?? 0) > 0 || (s.flags.sponsorTrust ?? 0) > 0) w += 0.7;
      return adj(s, w, "up");
    },
    card: (s) => {
      const master = s.ranking != null && s.ranking <= 45;
      const label = master ? "大師賽" : "ATP 500";
      return story(
        s,
        "一張大的外卡",
        `有一站${label}願意讓你進會外賽。場上的人比你平常打的強一截。沒有人能保證你過得了第一輪。`,
        [
          { id: "ev:big-wc:yes", label: "去", hint: "輸了也很正常。過了的話，排名和名字都會不一樣。", tone: "risk" },
          { id: "ev:big-wc:no", label: "不去", hint: "把這週留給你原本打得動的比賽。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "commercial",
    minAge: 18,
    maxAge: 36,
    gap: 3,
    tags: ["media"],
    weight: (s) => {
      if (!open(s, "commercial", 18, 36, false, 3) || !s.sponsor) return 0;
      return adj(s, s.fame >= 20 || (s.ranking != null && s.ranking <= 60) ? 2.4 : 1.4, "up");
    },
    card: (s) =>
      story(
        s,
        "一支廣告",
        `${s.sponsor?.brand ?? "贊助商"}要你拍一支廣告。拍攝兩天，剛好卡在訓練週。錢不錯，時間是你的。`,
        [
          { id: "ev:commercial:yes", label: "接", hint: "錢和曝光會進來。那兩天的課沒了。" },
          { id: "ev:commercial:no", label: "不接", hint: "訓練不停。贊助商未必高興。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "party",
    minAge: 20,
    maxAge: 36,
    gap: 4,
    tags: ["life"],
    weight: (s) => {
      if (!open(s, "party", 20, 36, false, 4)) return 0;
      if (!s.sponsor && s.fame < 25) return 0;
      return 1.6;
    },
    card: (s) =>
      story(
        s,
        "晚上有個局",
        s.sponsor
          ? `${s.sponsor.brand}邀你去一個活動。現場會有贊助、媒體，還有一些已經不打球的人。`
          : "有人邀你去一個運動圈的活動。沒有積分。隔天還有訓練。",
        [
          { id: "ev:party:yes", label: "去", hint: "可能認識以後用得上的人。也可能只是少睡。" },
          { id: "ev:party:no", label: "不去", hint: "你早點睡。局還是會辦。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "perf-team",
    minAge: 20,
    maxAge: 34,
    gap: 6,
    tags: ["money"],
    weight: (s) => {
      if (!open(s, "perf-team", 20, 34, false, 6)) return 0;
      if (s.path !== "pro" && s.path !== "college") return 0;
      if (s.investments.some((i) => i.kind === "medical" && i.untilYear >= s.year)) return 0;
      if (yearsSince(s, "bodybuy:") < 5) return 0;
      if (s.money < 20000 && s.wealth !== "wealthy") return 0;
      return s.money > 80000 || s.wealth === "wealthy" ? 2.6 : 1.5;
    },
    card: (s) => {
      const cost = costOf(s, 36000);
      return story(
        s,
        "一組人，不是一雙鞋",
        `有人建議你把錢花在體能師、營養和運動醫療上，而不是再買一雙鞋。${moneyLine(s, cost, false)}效果不會下週就出現。`,
        [
          { id: "ev:perf-team:yes", label: "花錢", hint: "以後舊傷也許比較好管。現在戶頭會瘦一截。" },
          { id: "ev:perf-team:no", label: "先不用", hint: "錢留著。身體還是你自己顧。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "biz-seed",
    minAge: 20,
    maxAge: 24,
    once: true,
    tags: ["business"],
    weight: (s) => (open(s, "biz-seed", 20, 24, true) && !(s.flags.businessInterest > 0) ? 1.7 : 0),
    card: (s) =>
      story(
        s,
        "一個小想法",
        "你看著自己用剩的球線，突然覺得這東西也許可以做成一個很小的牌子。現在談錢還太早。就是會開始佔你的腦子。",
        [
          { id: "ev:biz-seed:yes", label: "先記下來", hint: "不開公司。只是這件事不再是隨便想想。" },
          { id: "ev:biz-seed:no", label: "先專心打球", hint: "線還是拿來穿拍。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "biz-partner",
    minAge: 23,
    maxAge: 28,
    once: true,
    tags: ["business"],
    weight: (s) => {
      if (!open(s, "biz-partner", 23, 28, true)) return 0;
      if ((s.flags.businessInterest ?? 0) < 1) return 0;
      if (!s.sponsor && !(s.flags.sponsorTrust > 0)) return 1.2;
      return 3;
    },
    card: (s) =>
      story(
        s,
        "有人要一起做",
        s.sponsor
          ? `${s.sponsor.brand}的人介紹了一個想做運動用品的人。他看過你之前那個小想法。`
          : "有個做運動用品的人聽過你的名字，約你吃飯。他談的不是下一站比賽。",
        [
          { id: "ev:biz-partner:yes", label: "見一面", hint: "可能開始變成真的事情。時間會被分走。" },
          { id: "ev:biz-partner:no", label: "先不見", hint: "你這陣子只想處理排名。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "biz-grow",
    minAge: 27,
    maxAge: 34,
    once: true,
    tags: ["business"],
    weight: (s) => (open(s, "biz-grow", 27, 34, true) && (s.flags.businessInterest ?? 0) >= 2 ? 3 : 0),
    card: (s) =>
      story(
        s,
        "牌子開始有人買",
        "那個小牌子真的有人下單了。金額還不算大。問題是出貨、回信、拍照，都會吃掉你賽季中間的空檔。",
        [
          { id: "ev:biz-grow:yes", label: "繼續做", hint: "錢會進來一些。專心打球會變難。" },
          { id: "ev:biz-grow:park", label: "先停", hint: "名字還在，事先放下。球先打。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "business",
    minAge: 25,
    maxAge: 36,
    once: true,
    tags: ["business"],
    weight: (s) => {
      if (!open(s, "business", 25, 36, true)) return 0;
      if ((s.flags.businessInterest ?? 0) > 0) return 0;
      if (s.fame < 15 && (s.ranking == null || s.ranking > 80)) return 0.6;
      return 1.8;
    },
    card: (s) =>
      story(
        s,
        "一起做個牌子",
        "一間運動品牌找你一起做一條小線。可能有錢，也一定會佔時間。他們沒有要你現在退役。",
        [
          { id: "ev:business:yes", label: "試試看", hint: "以後如果沒有排名，這件事也許還在。" },
          { id: "ev:business:no", label: "先專心打球", hint: "合約你沒有簽。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "new-gen",
    minAge: 27,
    maxAge: 35,
    once: true,
    tags: ["career"],
    weight: (s) => {
      if (!open(s, "new-gen", 27, 35, true) || s.path !== "pro") return 0;
      if (s.ranking == null) return 1.2;
      return s.ranking > 40 ? 2.6 : 1.6;
    },
    card: (s) =>
      story(
        s,
        "比你年輕的人",
        s.ranking != null && s.peakRank != null && s.ranking > s.peakRank + 15
          ? "一個比你小一輪的選手開始贏你。訪問問你是不是已經打不贏年輕人。問題不好聽，但也不是憑空來的。"
          : "一個比你年輕很多的選手連著兩週打進後面的輪次。有人開始拿他的年紀跟你比。",
        [
          { id: "ev:new-gen:fight", label: "我還沒退", hint: "你會把量加回去。身體未必同意。", tone: "risk" },
          { id: "ev:new-gen:ease", label: "順其自然", hint: "你不跟標題吵。賽程照你受得了的排。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "mentor",
    minAge: 28,
    maxAge: 38,
    gap: 5,
    tags: ["life"],
    weight: (s) => (open(s, "mentor", 28, 38, false, 5) && (s.yearsPro >= 4 || s.age >= 30) ? 1.9 : 0),
    card: (s) =>
      story(s, "年輕的球員問你", "一個剛開始打職業的人問你：你覺得我應該怎麼打。他不是來要簽名的。", [
        { id: "ev:mentor:yes", label: "花時間跟他講", hint: "你會發現自己其實知道一些能教的事。" },
        { id: "ev:mentor:no", label: "我現在沒空", hint: "你還有自己的訓練。", tone: "quiet" },
      ]),
  },
  {
    id: "schedule-cut",
    minAge: 28,
    maxAge: 38,
    gap: 4,
    tags: ["body"],
    weight: (s) => {
      if (!open(s, "schedule-cut", 28, 38, false, 4) || s.path !== "pro") return 0;
      if (s.injury === "serious") return 0;
      let w = 1.4;
      if (s.age >= 31) w += 0.8;
      if (s.chronic >= 24) w += 1;
      return w;
    },
    card: (s) =>
      story(s, "賽程排太滿", "身體開始提醒你，比賽不能再每週都飛。醫生沒有叫你停，他只是問你能不能拿掉兩站。", [
        { id: "ev:schedule-cut:yes", label: "拿掉兩站", hint: "積分會少一點。隔週比較像人。" },
        { id: "ev:schedule-cut:no", label: "還是照滿的打", hint: "你知道風險。你還是想站在名單上。", tone: "risk" },
      ]),
  },
  {
    id: "wedding",
    minAge: 26,
    maxAge: 36,
    once: true,
    tags: ["life"],
    weight: (s) => (open(s, "wedding", 26, 36, true) ? 1.15 : 0),
    card: (s) =>
      story(
        s,
        "朋友結婚",
        s.partner
          ? `老朋友結婚，日期卡在兩站比賽中間。${s.partner.name}問你去不去。`
          : "老朋友結婚，日期卡在兩站比賽中間。人會到齊。你如果去，就要改機票。",
        [
          { id: "ev:wedding:yes", label: "去", hint: "少打一點。你會記得自己不是只有選手這一個身分。" },
          { id: "ev:wedding:no", label: "送禮，人不去", hint: "賽程不斷。酒席沒有你。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "burnout",
    minAge: 17,
    maxAge: 25,
    once: true,
    tags: ["life"],
    weight: (s) => (open(s, "burnout", 17, 25, true) && s.motivation < 50 ? 2.8 : 0),
    card: (s) =>
      story(s, "你開始不想去球場", "沒有傷。也不是輸一場。就是早上看到球袋，你會在玄關站很久。教練問你要不要停一週。", [
        { id: "ev:burnout:rest", label: "停一週", hint: "排名不會因為一週就沒了。心情也許會回來。" },
        { id: "ev:burnout:push", label: "還是去練", hint: "你怕一停就停不下來。", tone: "risk" },
      ]),
  },
  {
    id: "charity",
    minAge: 24,
    maxAge: 36,
    gap: 6,
    tags: ["media"],
    weight: (s) => (open(s, "charity", 24, 36, false, 6) && s.fame >= 28 ? 1.3 : 0),
    card: (s) =>
      story(s, "公開活動", "有人邀你去一場青少年的公開課。沒有錢。會有相機。你的名字會被寫在海報上。", [
        { id: "ev:charity:yes", label: "去", hint: "曝光會多。你得講一些你自己都覺得普通的話。" },
        { id: "ev:charity:no", label: "推掉", hint: "你把那天留給訓練。", tone: "quiet" },
      ]),
  },
  {
    id: "legend-watch",
    minAge: 15,
    maxAge: 28,
    once: true,
    rare: true,
    tags: ["coach"],
    weight: (s) => (open(s, "legend-watch", 15, 28, true) ? adj(s, 1.4, "up") : 0),
    card: (s) => {
      const leg = topLegend(s.year);
      const name = leg ? playerName(leg) : "一個已經不太比賽的冠軍";
      return story(
        s,
        "場邊多了一個人",
        `${name}以前的教練看完你的練習。他沒有收你。他留了一個電話，說以後如果你要換環境，可以打。`,
        [
          { id: "ev:legend-watch:yes", label: "把電話留下", hint: "現在什麼都不會發生。以後也許會。" },
          { id: "ev:legend-watch:no", label: "當沒看到", hint: "你還是回自己的場。", tone: "quiet" },
        ],
      );
    },
  },
  {
    id: "sponsor-pull",
    minAge: 22,
    maxAge: 36,
    gap: 8,
    rare: true,
    tags: ["sponsor"],
    weight: (s) => {
      if (!open(s, "sponsor-pull", 22, 36, false, 8) || !s.sponsor) return 0;
      let w = 1.5;
      if (s.ranking != null && s.ranking > 80) w += 0.8;
      return adj(s, w, "down");
    },
    card: (s) =>
      story(s, "合約沒了", `${s.sponsor?.brand ?? "贊助商"}沒有續約。他們說是預算，沒有多解釋。帽子下週開始不能再戴。`, [
        { id: "ev:sponsor-pull:ok", label: "知道了", hint: "錢會少一截。比賽還在。" },
        { id: "ev:sponsor-pull:angry", label: "你很不爽，但還是得打", hint: "心情會差一陣。排名不會因為生氣就回來。" },
      ]),
  },
  {
    id: "upset",
    minAge: 18,
    maxAge: 31,
    gap: 8,
    rare: true,
    tags: ["tennis"],
    weight: (s) => {
      if (!open(s, "upset", 18, 31, false, 8)) return 0;
      if (s.path !== "pro" && s.path !== "college") return 0;
      return adj(s, 1.2, "up");
    },
    card: (s) =>
      story(
        s,
        "練習賽",
        "來台灣短期集訓的一位排名很前面的人，練習賽輸給你。沒有積分。看的人也不多。消息還是傳出去了一點。",
        [
          { id: "ev:upset:ride", label: "你讓這件事留在腦子裡", hint: "信心會上來。別把它當成排名。" },
          { id: "ev:upset:flat", label: "練習賽就是練習賽", hint: "你沒有特別講。別人可能還是會講。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "scholarship",
    minAge: 16,
    maxAge: 18,
    once: true,
    rare: true,
    tags: ["path"],
    weight: (s) => {
      if (!open(s, "scholarship", 16, 18, true) || s.path !== "undecided") return 0;
      if (s.wealth === "wealthy") return 0.2;
      return adj(s, s.wealth === "tight" ? 2 : 1.2, "up");
    },
    card: (s) =>
      story(
        s,
        "臨時的獎學金",
        s.wealth === "tight"
          ? "有一間大學突然多一個網球獎學金的名額。不是名校保證，是學費有人出。家裡聽到的時候安靜了一下。"
          : "有一間大學問你要不要用網球獎學金過去。條件普通，但路是通的。",
        [
          { id: "ev:scholarship:yes", label: "先答應有興趣", hint: "十八歲你可以再決定。這扇門先不要關。" },
          { id: "ev:scholarship:no", label: "先不用", hint: "你還不想把未來說成去讀書。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "retired-invest",
    minAge: 21,
    maxAge: 30,
    once: true,
    rare: true,
    tags: ["money"],
    weight: (s) => {
      if (!open(s, "retired-invest", 21, 30, true) || s.path !== "pro") return 0;
      if (s.money > 120000 && s.wealth === "wealthy") return 0.3;
      return adj(s, 1.3, "up");
    },
    card: (s) =>
      story(
        s,
        "退下來的人",
        "一位已經不打了的選手願意出一筆錢，讓你找人顧身體。他不要分紅。他說他當年沒有這筆錢。",
        [
          { id: "ev:retired-invest:yes", label: "收下", hint: "團隊會多一點。你會欠一份人情，哪怕他說不用還。" },
          { id: "ev:retired-invest:no", label: "不收", hint: "你不想欠這個人情。", tone: "quiet" },
        ],
      ),
  },
  {
    id: "media-hype",
    minAge: 19,
    maxAge: 32,
    once: true,
    rare: true,
    tags: ["media"],
    weight: (s) => {
      if (!open(s, "media-hype", 19, 32, true)) return 0;
      if (s.fame < 18 && (s.ranking == null || s.ranking > 50)) return 0;
      return adj(s, 1.5, "up");
    },
    card: (s) => {
      const leg = topLegend(s.year);
      const name = leg ? playerName(leg) : "那個年代的第一";
      return story(
        s,
        "標題寫太大",
        `有篇訪問把你跟${name}放在一起講。你知道這比較像標題，不像預測。電話還是變多了。`,
        [
          { id: "ev:media-hype:take", label: "接幾個訪問", hint: "名字會更響。你也比較難專心。" },
          { id: "ev:media-hype:hide", label: "少講", hint: "熱度會掉快一點。訓練比較安靜。", tone: "quiet" },
        ],
      );
    },
  },
];

function yearsSince(s: GameState, prefix: string): number {
  let last = -999;
  for (const id of s.decisionIds) {
    if (!id.startsWith(prefix)) continue;
    const y = Number(id.slice(id.lastIndexOf(":") + 1));
    if (!Number.isNaN(y) && y > last) last = y;
  }
  return last < 0 ? 99 : s.year - last;
}

function storyCap(age: number): number {
  if (age <= 10) return 1;
  if (age <= 14) return 2;
  if (age <= 17) return 3;
  if (age <= 27) return 3;
  return 2;
}

function quietChance(age: number): number {
  if (age <= 10) return 0.32;
  if (age <= 14) return 0.14;
  if (age <= 17) return 0.08;
  if (age <= 27) return 0.1;
  return 0.2;
}

function chooseSpec(s: GameState, rng: Rng, list: Spec[], tags: Set<string>, skip: Set<string>): Spec | null {
  const pool = list.filter((e) => !skip.has(e.id) && e.weight(s) > 0 && e.tags.every((t) => !tags.has(t)));
  if (!pool.length) return null;
  let total = 0;
  const ws = pool.map((e) => {
    const w = Math.max(0, e.weight(s));
    total += w;
    return w;
  });
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= ws[i]!;
    if (r <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

export function planYear(s: GameState): string[] {
  driftRivals(s);
  const rng = rngFor(s.seed, `events:${s.year}`);
  const queue: string[] = [];
  const tags = new Set<string>();
  const skip = new Set<string>();

  const pushGate = (id: string, tag?: string) => {
    queue.push(`gate:${id}`);
    if (tag) tags.add(tag);
  };

  if (s.age >= 13 && (s.injury === "serious" || s.injury === "moderate")) pushGate("inj", "body");
  if (s.age === 18 && s.path === "undecided") pushGate("path18", "path");
  if (s.age === 22 && s.path === "college" && !s.decisionIds.includes("college-exit")) pushGate("grad", "path");
  const pathYear = queue.includes("gate:path18") || queue.includes("gate:grad");
  if (!pathYear && olyNow(s) && queue.length < 2) pushGate("oly", "nation");
  if (brokeNow(s) && queue.length < 2) pushGate("broke", "money");
  if (stayNow(s) && queue.length < 2) pushGate("stay", "career");
  if (asianNow(s) && queue.length < 2 && !tags.has("nation")) pushGate("asian", "nation");
  if (campusNow(s) && queue.length < 2 && !tags.has("school")) pushGate("campus", "school");
  if (loveNow(s) && queue.length < 2 && !tags.has("life")) pushGate("love", "life");
  if (loveLaterNow(s) && queue.length < 2 && !tags.has("life")) pushGate("love5", "life");

  const cap = storyCap(s.age);
  let room = Math.max(0, cap - queue.length);
  let quiet = false;
  if (queue.length === 0 && rng() < quietChance(s.age)) {
    room = 0;
    quiet = true;
  } else if (room >= 2 && rng() < 0.28) room -= 1;

  const take = (spec: Spec | null) => {
    if (!spec || room <= 0) return;
    queue.push(`ev:${spec.id}`);
    skip.add(spec.id);
    spec.tags.forEach((t) => tags.add(t));
    room -= 1;
    quiet = false;
  };

  if (s.age === 12 && s.rivals.length === 0 && !seen(s, "rival-meet")) {
    const rival = EVENTS.find((e) => e.id === "rival-meet") ?? null;
    if (rival && !queue.includes("ev:rival-meet")) {
      if (room <= 0) room = 1;
      take(rival);
    }
  }
  const meetYear = s.flags.metGreatCoach ?? 0;
  if (meetYear && s.year === meetYear + 2 && !seen(s, "coach-callback") && s.age <= 21) {
    const cb = EVENTS.find((e) => e.id === "coach-callback") ?? null;
    if (cb && cb.weight(s) > 0 && !queue.includes("ev:coach-callback")) {
      if (room <= 0 && queue.length < cap) room = 1;
      take(cb);
    }
  }

  if (room > 0 && rng() < 0.1) {
    take(chooseSpec(s, rng, EVENTS.filter((e) => e.rare), tags, skip));
  }
  let guard = 0;
  while (room > 0 && guard++ < 8) {
    const next = chooseSpec(s, rng, EVENTS.filter((e) => !e.rare), tags, skip);
    if (!next) break;
    take(next);
  }

  if (quiet) s.decisionIds.push(`quiet:${s.year}`);
  else s.decisionIds = s.decisionIds.filter((id) => id !== `quiet:${s.year}`);

  queue.push(s.age <= 12 ? "child" : "train");
  return queue;
}

function olyNow(s: GameState): boolean {
  if (!OLY_YEARS[s.year]) return false;
  if (s.age < 18) return false;
  if (s.decisionIds.includes(`oly:${s.year}`) || s.decisionIds.includes(`oly-no:${s.year}`)) return false;
  if (s.path === "college") return (s.juniorRank ?? 99) <= 12 || s.collegeTitles >= 1;
  if (s.path !== "pro") return false;
  return s.ranking != null && s.ranking <= 140;
}

const OLY_YEARS: Partial<Record<number, true>> = {
  1996: true,
  2000: true,
  2004: true,
  2008: true,
  2012: true,
  2016: true,
  2021: true,
  2024: true,
};
const ASIAN_YEARS: Partial<Record<number, true>> = {
  1994: true,
  1998: true,
  2002: true,
  2006: true,
  2010: true,
  2014: true,
  2018: true,
  2023: true,
  2026: true,
};

function brokeNow(s: GameState): boolean {
  return s.path === "pro" && s.age > 23 && s.money < -8000 && yearsSince(s, "broke:") >= 3;
}

function stayNow(s: GameState): boolean {
  if (s.path !== "pro") return false;
  if (yearsSince(s, "stayask:") < 3) return false;
  if (s.age >= 33 || s.peopleGaveUp || s.motivation < 34) return true;
  if (s.age >= 30 && s.peakRank != null && s.ranking != null && s.ranking > Math.max(80, s.peakRank * 2)) return true;
  return false;
}

function asianNow(s: GameState): boolean {
  if (!ASIAN_YEARS[s.year]) return false;
  if (s.age < 16 || s.age > 36) return false;
  if (s.decisionIds.includes(`asian:${s.year}`) || s.decisionIds.includes(`asian-no:${s.year}`)) return false;
  if (s.age < 18) return (s.juniorRank ?? 500) <= 50;
  if (s.path === "college") return true;
  return s.path === "pro" && s.ranking != null && s.ranking <= 280;
}

function campusNow(s: GameState): boolean {
  return s.path === "college" && (s.age === 19 || s.age === 21);
}

function loveNow(s: GameState): boolean {
  return !s.partner && s.age === 24 && s.path === "pro" && !s.decisionIds.includes("love:asked");
}

function loveLaterNow(s: GameState): boolean {
  return !!s.partner && s.age === s.partner.sinceYear + 5 && !s.decisionIds.includes("love:later");
}

export function eventCard(s: GameState, id: string): StoryCard | null {
  const spec = EVENTS.find((e) => e.id === id);
  if (!spec) return null;
  return spec.card(s);
}

function hire(s: GameState, id: string) {
  const next = COACHES.find((c) => c.id === id);
  if (!next || next.id === s.coach.id) return;
  s.coach = next;
  if (!s.coachesHad.includes(next.name)) s.coachesHad.push(next.name);
  s.coachNote = `${next.archetype}。`;
  note(s, `coachpick:${s.year}`, `${s.year}，教練換成${next.name}。`);
  s.yearStory.push(`${next.name}開始帶你。`);
  if (fitBad(s, `coach-fit:${s.year}:${next.id}`)) {
    s.motivation = clamp(s.motivation - 6, 0, 100);
    s.flags.coachConflict = s.year;
    s.yearStory.push("前幾個月對不上。他的練法你還沒吃進去。");
  } else {
    s.yearStory.push("一開始怪怪的，後來開始對上。");
  }
}

export function resolveEvent(s: GameState, id: string) {
  const parts = id.split(":");
  const eventId = parts[1] ?? "";
  const key = parts[2] ?? "";
  const extra = parts[3] ?? "";

  if (eventId === "teacher") {
    if (key === "show") {
      s.motivation = clamp(s.motivation + 2, 0, 100);
      s.confidence = clamp(s.confidence + 2, 1, 99);
      s.flags.schoolSportsNetwork = s.year;
      note(s, `teacher:${s.year}`, `${s.year}，體育課有人第一次看你發球。`);
    } else note(s, `teacher:${s.year}`, `${s.year}，體育課你沒有多講。`);
    return;
  }
  if (eventId === "family-trip") {
    if (key === "go") {
      s.motivation = clamp(s.motivation + 4, 0, 100);
      s.flags.tennisLove = (s.flags.tennisLove ?? 0) + 1;
      note(s, `trip:${s.year}`, `${s.year}，你跟家人出門了幾天。`);
      s.yearStory.push("那幾天沒有練球。");
    } else note(s, `trip:${s.year}`, `${s.year}，家人出門，你留下練球。`);
    return;
  }
  if (eventId === "soccer") {
    if (key === "go") {
      bump(s, "speed", 1);
      bump(s, "fitness", 1);
      s.motivation = clamp(s.motivation + 3, 0, 100);
      s.flags.secondSport = s.year;
      s.distracted = true;
      note(s, `soccer:${s.year}`, `${s.year}，你去踢了足球，網球少了幾堂。`);
      s.yearStory.push("足球練了幾個月。網球的課少了。");
    } else {
      s.motivation = clamp(s.motivation + 1, 0, 100);
      s.flags.tennisLove = (s.flags.tennisLove ?? 0) + 1;
      note(s, `soccer:${s.year}`, `${s.year}，校隊來問，你還是去打網球。`);
    }
    return;
  }
  if (eventId === "move") {
    if (key === "ease") {
      s.motivation = clamp(s.motivation - 2, 0, 100);
      s.flags.familyConflict = s.year;
      note(s, `move:${s.year}`, `${s.year}，搬家以後你少練了幾週。`);
    } else note(s, `move:${s.year}`, `${s.year}，搬家了，你還是去球場。`);
    return;
  }
  if (eventId === "swim") {
    if (key === "go") {
      bump(s, "fitness", 1);
      s.flags.secondSport = s.year;
      s.distracted = true;
      note(s, `swim:${s.year}`, `${s.year}，你同時練游泳和網球。`);
      s.yearStory.push("游泳佔掉兩堂網球。");
    } else note(s, `swim:${s.year}`, `${s.year}，游泳隊來問，你沒去。`);
    return;
  }
  if (eventId === "weekend") {
    if (key === "go") {
      s.motivation = clamp(s.motivation + 4, 0, 100);
      s.flags.schoolSportsNetwork = s.year;
      note(s, `weekend:${s.year}`, `${s.year}，你週末跟同學出去。`);
      s.yearStory.push("週末空了一塊。");
    } else {
      s.confidence = clamp(s.confidence + 1, 1, 99);
      note(s, `weekend:${s.year}`, `${s.year}，同學約你，你沒去。`);
    }
    return;
  }
  if (eventId === "extra") {
    if (key === "yes") {
      s.decisionIds.push(`extra:${s.year}`);
      s.motivation = clamp(s.motivation - 3, 0, 100);
      s.chronic = clamp(s.chronic + 4, 0, 100);
      note(s, `extra:${s.year}`, `${s.year}，你每週多加兩堂。`);
      s.yearStory.push("這種訓練量很兇。");
    } else note(s, `extra-no:${s.year}`, `${s.year}，你沒有把量加上去。`);
    return;
  }
  if (eventId === "hobby") {
    if (key === "yes") {
      const hobby = pick(rngFor(s.seed, `hobby:${s.year}`), HOBBIES);
      if (HOBBIES.indexOf(hobby) === 3) s.flags.businessInterest = (s.flags.businessInterest ?? 0) + 1;
      s.flags.hobby = s.year;
      s.motivation = clamp(s.motivation + 2, 0, 100);
      note(s, `hobby:${s.year}`, `${s.year}，你留了一點時間給打球以外的事。`);
    } else note(s, `hobby:${s.year}`, `${s.year}，空下來你還是拿去練球。`);
    return;
  }
  if (eventId === "crush") {
    if (key === "yes") {
      s.motivation = clamp(s.motivation + 3, 0, 100);
      s.distracted = true;
      note(s, `crush:${s.year}`, `${s.year}，放學有人跟你一起走。`);
    } else note(s, `crush:${s.year}`, `${s.year}，你沒有把那個人放進行程。`);
    return;
  }
  if (eventId === "exam") {
    if (key === "play") {
      s.studiesNeglected = true;
      s.flags.academicNeglect = (s.flags.academicNeglect ?? 0) + 1;
      s.motivation = clamp(s.motivation + 2, 0, 100);
      note(s, `exam-play:${s.year}`, `${s.year}，考試撞上比賽，你去打了。`);
      s.yearStory.push("書落後了一截。");
    } else {
      s.studyYear = true;
      bump(s, "iq", 1);
      s.flags.academicSuccess = (s.flags.academicSuccess ?? 0) + 1;
      s.decisionIds.push(`study:yes:${s.year}`);
      note(s, `exam-study:${s.year}`, `${s.year}，你留下考試，這站比賽沒去。`);
    }
    return;
  }
  if (eventId === "rival-meet") {
    const bond = key === "lock" ? "rival" : "respect";
    const r = ensureRival(s, bond);
    if (key === "lock") {
      s.motivation = clamp(s.motivation + 3, 0, 100);
      r.bond = "rival";
    }
    note(s, `rival-meet:${s.year}`, `${s.year}，你輸給${r.name}。`);
    s.yearStory.push(`你輸給${r.name}。`);
    return;
  }
  if (eventId === "rival-rematch") {
    const r = rivalOf(s);
    if (!r) return;
    const won = rematchWon(s);
    if (won) s.confidence = clamp(s.confidence + 3, 1, 99);
    else s.confidence = clamp(s.confidence - 2, 1, 99);
    if (key === "chase") {
      r.bond = r.bond === "respect" ? "rival" : r.bond;
      s.motivation = clamp(s.motivation + 2, 0, 100);
    }
    note(s, `rival-rematch:${s.year}`, `${s.year}，你跟${r.name}又打了一場。`);
    return;
  }
  if (eventId === "rival-adult" || eventId === "rival-ch" || eventId === "rival-atp") {
    const r = rivalOf(s);
    if (!r) return;
    if (key === "aim" || key === "nod" || key === "talk") s.flags.rivalFriendship = s.year;
    if (key === "cold") r.bond = "bitter";
    note(s, `${eventId}:${s.year}`, `${s.year}，你又碰到${r.name}。`);
    s.yearStory.push(`${r.name}還在打。`);
    return;
  }
  if (eventId === "asia-camp") {
    if (key === "yes") {
      const free = scholarship(s);
      spend(s, costOf(s, 7000), free);
      s.flags.internationalExperience = s.year;
      s.flags.overseasNetwork = s.flags.overseasNetwork || s.year;
      s.surfaceBias.hard = Math.min(18, s.surfaceBias.hard + 1);
      s.motivation = clamp(s.motivation - 2, 0, 100);
      note(s, `asia-camp:${s.year}`, `${s.year}，你去了亞洲的訓練營。`);
      s.echoes.push({ year: s.year + 2, text: "亞洲訓練營認識的人，這年傳訊問你還打不打青少年賽。" });
    } else note(s, `asia-camp:${s.year}`, `${s.year}，亞洲訓練營你沒去。`);
    return;
  }
  if (eventId === "spain") {
    if (key === "yes") {
      const free = scholarship(s);
      spend(s, costOf(s, s.age >= 16 ? 16000 : 11000), free);
      s.overseas = true;
      s.flags.metGreatCoach = s.year;
      s.flags.overseasNetwork = s.year;
      s.flags.internationalExperience = s.year;
      s.surfaceBias.clay = Math.min(18, s.surfaceBias.clay + 2);
      s.motivation = clamp(s.motivation - 2, 0, 100);
      note(s, `spain:${s.year}`, `${s.year}，你去了西班牙一個月。`);
      s.yearStory.push("你在紅土上練了一個月。");
      s.echoes.push({ year: s.year + 1, text: "西班牙認識的人傳了一則很短的訊息。" });
    } else note(s, `spain:${s.year}`, `${s.year}，西班牙那趟你沒去。`);
    return;
  }
  if (eventId === "unknown-coach") {
    if (key === "try" && extra) {
      if (fitBad(s, `try-fit:${s.year}:${extra}`)) {
        s.motivation = clamp(s.motivation - 5, 0, 100);
        s.flags.coachConflict = s.year;
        note(s, `try-coach:${s.year}`, `${s.year}，你試了一個月，練法合不來。`);
        s.yearStory.push("一個月以後你回到原來的教練。");
      } else {
        hire(s, extra);
        note(s, `try-coach:${s.year}`, `${s.year}，你留下了試帶你的那位教練。`);
      }
    } else note(s, `try-coach:${s.year}`, `${s.year}，有教練來問，你沒有換。`);
    return;
  }
  if (eventId === "us-academy") {
    if (key === "yes") {
      const free = scholarship(s);
      spend(s, costOf(s, 18000), free);
      s.overseas = true;
      s.flags.collegeNetwork = s.year;
      s.flags.internationalExperience = s.year;
      s.flags.overseasNetwork = s.flags.overseasNetwork || s.year;
      s.surfaceBias.hard = Math.min(18, s.surfaceBias.hard + 1);
      note(s, `us-academy:${s.year}`, `${s.year}，你去美國試訓。`);
      s.yearStory.push("你在美國練了幾週。");
      s.echoes.push({ year: s.year + 2, text: "美國試訓時認識的教練，這年寫信來問你畢不畢業。" });
    } else note(s, `us-academy:${s.year}`, `${s.year}，美國的試訓你沒去。`);
    return;
  }
  if (eventId === "scout") {
    if (key === "yes") {
      s.flags.collegeInterest = s.year;
      s.flags.collegeNetwork = s.flags.collegeNetwork || s.year;
      note(s, `scout:${s.year}`, `${s.year}，美國大學的教練來問過你。`);
      s.yearStory.push("你跟那位大學教練留了聯絡方式。");
    } else {
      s.flags.proLean = s.year;
      note(s, `scout:${s.year}`, `${s.year}，你跟球探說想直接打職業。`);
    }
    return;
  }
  if (eventId === "first-sponsor") {
    if (key === "yes") {
      const brand = extra || parts[3] || "VICTOR";
      const annual = Number(parts[4]);
      // id is ev:first-sponsor:yes:BRAND:annual — parts[3] brand parts[4] annual
      const brandName = parts[3] || "VICTOR";
      const pay = Number(parts[4]);
      s.sponsor = { brand: brandName, annual: Number.isFinite(pay) ? pay : 4000, sinceYear: s.year };
      s.fame = clamp(s.fame + 3, 0, 100);
      s.flags.minorSponsor = s.year;
      s.flags.sponsorTrust = (s.flags.sponsorTrust ?? 0) + 1;
      note(s, `junior-sponsor:${s.year}`, `${s.year}，你和${s.sponsor.brand}簽了第一份小約。`);
      s.yearStory.push(`${s.sponsor.brand}的拍子開始出現在你的袋子裡。`);
      void brand;
      void annual;
    } else note(s, `junior-sponsor:${s.year}`, `${s.year}，小牌子來問，你沒簽。`);
    return;
  }
  if (eventId === "tutoring") {
    if (key === "yes") {
      const pay = costOf(s, 1800);
      s.money += pay;
      s.distracted = true;
      s.flags.coachingInterest = s.flags.coachingInterest || s.year;
      note(s, `tutor:${s.year}`, `${s.year}，你開始教別人打球，補一點家用。`);
      s.yearStory.push("你花了一些時間教別人。");
    } else note(s, `tutor:${s.year}`, `${s.year}，教球的工作你沒接。`);
    return;
  }
  if (eventId === "coach-callback") {
    if (key === "keep") {
      s.flags.overseasNetwork = s.flags.overseasNetwork || s.year;
      s.flags.metGreatCoach = s.flags.metGreatCoach || s.year;
      note(s, `callback:${s.year}`, `${s.year}，你跟西班牙那位教練保持聯絡。`);
      s.echoes.push({ year: s.year + 2, text: "西班牙那位教練介紹了一個帶挑戰賽的人，名字先放著。" });
    } else if (key === "school") {
      s.flags.collegeInterest = s.year;
      s.flags.collegeNetwork = s.flags.collegeNetwork || s.year;
      note(s, `callback:${s.year}`, `${s.year}，你把那通電話轉去問大學。`);
    } else note(s, `callback:${s.year}`, `${s.year}，西班牙的電話你沒有接下去。`);
    return;
  }
  if (eventId === "coach-intro") {
    if (key === "yes" && extra) hire(s, extra);
    else note(s, `intro-no:${s.year}`, `${s.year}，介紹來的教練你沒換。`);
    return;
  }
  if (eventId === "big-wc") {
    if (key === "yes") {
      s.wildcardUsed = true;
      const master = s.ranking != null && s.ranking <= 45;
      s.decisionIds.push(master ? `wcm:${s.year}` : `wc500:${s.year}`);
      note(s, `wc-ask:${s.year}`, `${s.year}，你接了一張比平常大的外卡。`);
      s.yearStory.push(master ? "你進了一站大師賽的會外賽。" : "你進了一站 ATP 500 的會外賽。");
    } else note(s, `wc-ask:${s.year}`, `${s.year}，那張大外卡你沒去。`);
    return;
  }
  if (eventId === "commercial") {
    if (key === "yes") {
      const pay = Math.round((12000 + s.fame * 420) * era(s.year));
      s.money += pay;
      s.fame = clamp(s.fame + 5, 0, 100);
      s.flags.sponsorTrust = (s.flags.sponsorTrust ?? 0) + 1;
      s.flags.mediaExposure = (s.flags.mediaExposure ?? 0) + 1;
      s.distracted = true;
      note(s, `ad:${s.year}`, `${s.year}，你拍了一支廣告。`);
      s.yearStory.push("兩天拍攝，訓練空了。");
    } else {
      s.flags.sponsorTrust = Math.max(0, (s.flags.sponsorTrust ?? 1) - 1);
      note(s, `ad:${s.year}`, `${s.year}，廣告你沒接。`);
    }
    return;
  }
  if (eventId === "party") {
    if (key === "yes") {
      const good = rngFor(s.seed, `party:${s.year}`)() < 0.45 + s.hidden.luck / 200;
      s.fame = clamp(s.fame + 3, 0, 100);
      if (good) {
        s.flags.overseasNetwork = s.flags.overseasNetwork || s.year;
        s.yearStory.push("局上有人留了電話。不一定用得上。");
      } else {
        s.chronic = clamp(s.chronic + 4, 0, 100);
        s.yearStory.push("隔天訓練你一直看鐘。");
      }
      note(s, `party:${s.year}`, `${s.year}，你去了贊助商的活動。`);
    } else {
      s.motivation = clamp(s.motivation + 1, 0, 100);
      note(s, `party:${s.year}`, `${s.year}，晚上的局你沒去。`);
    }
    return;
  }
  if (eventId === "perf-team") {
    if (key === "yes") {
      const cost = costOf(s, 36000);
      spend(s, cost, false);
      addInvest(s, "medical", 4);
      addInvest(s, "fitness", 4);
      s.flags.injuryPrevention = s.year;
      note(s, `bodybuy:${s.year}`, `${s.year}，你把錢花在體能和醫療團隊上。`);
      s.yearStory.push("有人開始管你的睡眠和舊傷。");
      s.echoes.push({ year: s.year + 4, text: "你幾年前找的那組人還在看你的舊傷。" });
    } else note(s, `bodybuy:${s.year}`, `${s.year}，團隊的報價你先沒有付。`);
    return;
  }
  if (eventId === "biz-seed") {
    if (key === "yes") {
      s.flags.businessInterest = (s.flags.businessInterest ?? 0) + 1;
      s.flags.bizYear = s.year;
      note(s, `biz-seed:${s.year}`, `${s.year}，你把一個小球線的想法記下來。`);
      s.echoes.push({ year: s.year + 3, text: "之前那個小想法，有人問你還要不要做。" });
    } else note(s, `biz-seed:${s.year}`, `${s.year}，做牌子的念頭你放下了。`);
    return;
  }
  if (eventId === "biz-partner") {
    if (key === "yes") {
      s.flags.businessInterest = (s.flags.businessInterest ?? 0) + 1;
      s.distracted = true;
      note(s, `biz-partner:${s.year}`, `${s.year}，你見了想一起做牌子的人。`);
      s.yearStory.push("吃飯吃完，事情沒有立刻開始，但也沒有結束。");
    } else note(s, `biz-partner:${s.year}`, `${s.year}，那個合作你先沒見。`);
    return;
  }
  if (eventId === "biz-grow") {
    if (key === "yes") {
      const pay = Math.round((18000 + s.fame * 260) * era(s.year));
      s.money += pay;
      s.flags.businessInterest = (s.flags.businessInterest ?? 0) + 1;
      s.distracted = true;
      note(s, `biz-grow:${s.year}`, `${s.year}，你的小牌子開始有人買。`);
      s.yearStory.push("出貨佔掉一些空檔。");
    } else note(s, `biz-grow:${s.year}`, `${s.year}，牌子先停，你回去打球。`);
    return;
  }
  if (eventId === "business") {
    if (key === "yes") {
      s.flags.businessInterest = (s.flags.businessInterest ?? 0) + 1;
      s.flags.bizYear = s.year;
      s.distracted = true;
      note(s, `business:${s.year}`, `${s.year}，你答應試試看一起做牌子。`);
      s.echoes.push({ year: s.year + 3, text: "那個牌子的人又來找你，問你還有沒有時間。" });
    } else note(s, `business:${s.year}`, `${s.year}，品牌的合作你沒接。`);
    return;
  }
  if (eventId === "new-gen") {
    if (key === "fight") {
      s.motivation = clamp(s.motivation + 5, 0, 100);
      s.decisionIds.push(`chase:${s.year}`);
      note(s, `newgen:${s.year}`, `${s.year}，年輕人開始贏你，你把量加回去。`);
      s.yearStory.push("你不想被寫成已經退了。");
    } else {
      s.flags.readyToStop = s.year;
      note(s, `newgen:${s.year}`, `${s.year}，你沒有跟年輕選手的標題吵。`);
    }
    return;
  }
  if (eventId === "mentor") {
    if (key === "yes") {
      s.flags.coachingInterest = s.year;
      s.motivation = clamp(s.motivation + 2, 0, 100);
      note(s, `mentor:${s.year}`, `${s.year}，你花時間跟一個年輕球員講了怎麼打。`);
    } else note(s, `mentor:${s.year}`, `${s.year}，年輕球員來問，你說沒空。`);
    return;
  }
  if (eventId === "schedule-cut") {
    if (key === "yes") {
      s.decisionIds.push(`cut:${s.year}`);
      s.motivation = clamp(s.motivation + 3, 0, 100);
      s.chronic = clamp(s.chronic - 3, 0, 100);
      note(s, `cut:${s.year}`, `${s.year}，你拿掉兩站比賽。`);
      s.yearStory.push("賽程短了一點。");
    } else {
      s.decisionIds.push(`chase:${s.year}`);
      note(s, `cut:${s.year}`, `${s.year}，你還是把賽程排滿。`);
    }
    return;
  }
  if (eventId === "wedding") {
    if (key === "yes") {
      s.motivation = clamp(s.motivation + 3, 0, 100);
      s.decisionIds.push(`cut:${s.year}`);
      note(s, `wedding:${s.year}`, `${s.year}，你去了朋友的婚禮。`);
    } else note(s, `wedding:${s.year}`, `${s.year}，婚禮你沒去。`);
    return;
  }
  if (eventId === "burnout") {
    if (key === "rest") {
      s.motivation = clamp(s.motivation + 8, 0, 100);
      s.decisionIds.push(`cut:${s.year}`);
      s.flags.earlyBurnout = s.year;
      note(s, `burnout:${s.year}`, `${s.year}，你停了一週，沒有告訴太多人。`);
    } else {
      s.motivation = clamp(s.motivation - 4, 0, 100);
      s.flags.earlyBurnout = s.year;
      s.decisionIds.push(`extra:${s.year}`);
      note(s, `burnout:${s.year}`, `${s.year}，你不想去球場，還是去了。`);
    }
    return;
  }
  if (eventId === "charity") {
    if (key === "yes") {
      s.fame = clamp(s.fame + 3, 0, 100);
      s.flags.mediaExposure = (s.flags.mediaExposure ?? 0) + 1;
      s.flags.coachingInterest = s.flags.coachingInterest || s.year;
      note(s, `charity:${s.year}`, `${s.year}，你去給青少年上了一堂公開課。`);
    } else note(s, `charity:${s.year}`, `${s.year}，公開課你推掉了。`);
    return;
  }
  if (eventId === "legend-watch") {
    if (key === "yes") {
      s.flags.metGreatCoach = s.flags.metGreatCoach || s.year;
      s.flags.overseasNetwork = s.flags.overseasNetwork || s.year;
      s.fame = clamp(s.fame + 2, 0, 100);
      note(s, `legend-watch:${s.year}`, `${s.year}，一位冠軍的前教練看了你的練習。`);
      s.echoes.push({ year: s.year + 3, text: "當年留電話的那位教練，這年真的有人替他轉話。" });
    } else note(s, `legend-watch:${s.year}`, `${s.year}，場邊那個人你沒有過去。`);
    return;
  }
  if (eventId === "sponsor-pull") {
    const brand = s.sponsor?.brand ?? "贊助商";
    s.sponsor = null;
    s.fame = clamp(s.fame - 4, 0, 100);
    if (key === "angry") s.motivation = clamp(s.motivation - 4, 0, 100);
    note(s, `sponsor-pull:${s.year}`, `${s.year}，${brand}沒有續約。`);
    s.yearStory.push(`${brand}沒有續約。`);
    return;
  }
  if (eventId === "upset") {
    s.fame = clamp(s.fame + (key === "ride" ? 7 : 4), 0, 100);
    s.confidence = clamp(s.confidence + (key === "ride" ? 5 : 2), 1, 99);
    s.flags.upset = s.year;
    note(s, `upset:${s.year}`, `${s.year}，練習賽你贏了一個不該輸的人。`);
    s.yearStory.push("沒有積分。還是有人講。");
    return;
  }
  if (eventId === "scholarship") {
    if (key === "yes") {
      s.flags.collegeInterest = s.year;
      s.flags.academicSuccess = (s.flags.academicSuccess ?? 0) + 1;
      note(s, `scholarship:${s.year}`, `${s.year}，有大學用獎學金來問你。`);
      s.yearStory.push("學費這件事，突然有人接手。");
    } else note(s, `scholarship:${s.year}`, `${s.year}，獎學金你先沒有接。`);
    return;
  }
  if (eventId === "retired-invest") {
    if (key === "yes") {
      const gift = costOf(s, 28000);
      s.money += gift;
      addInvest(s, "medical", 3);
      s.flags.injuryPrevention = s.year;
      s.flags.overseasNetwork = s.flags.overseasNetwork || s.year;
      note(s, `angel:${s.year}`, `${s.year}，一位退役球員出錢讓你顧身體。`);
      s.yearStory.push("有人出錢，讓你找人看傷。");
    } else note(s, `angel:${s.year}`, `${s.year}，那筆錢你沒有收。`);
    return;
  }
  if (eventId === "media-hype") {
    if (key === "take") {
      s.fame = clamp(s.fame + 6, 0, 100);
      s.confidence = clamp(s.confidence - 2, 1, 99);
      s.flags.mediaExperience = (s.flags.mediaExperience ?? 0) + 2;
      s.flags.mediaExposure = (s.flags.mediaExposure ?? 0) + 1;
      s.distracted = true;
      note(s, `hype:${s.year}`, `${s.year}，媒體把你的名字放得很大。你接了訪問。`);
    } else {
      s.fame = clamp(s.fame + 2, 0, 100);
      s.flags.mediaExperience = (s.flags.mediaExperience ?? 0) + 1;
      note(s, `hype:${s.year}`, `${s.year}，標題很大，你沒有多講。`);
    }
    return;
  }
}
