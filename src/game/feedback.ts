import { clamp } from "./rng";
import type { GameState, Receipt, StoryCard } from "./types";

export interface Snap {
  money: number;
  motivation: number;
  confidence: number;
  chronic: number;
  coachId: string;
  path: GameState["path"];
  sponsor: string | null;
  partner: string | null;
  overseas: boolean;
  flags: Record<string, number>;
  echoes: number;
  yearStory: number;
  stats: GameState["stats"];
  injury: GameState["injury"];
  missedHalf: boolean;
  studyYear: boolean;
  schedule: GameState["schedule"];
}

export function snap(s: GameState): Snap {
  return {
    money: s.money,
    motivation: s.motivation,
    confidence: s.confidence,
    chronic: s.chronic,
    coachId: s.coach.id,
    path: s.path,
    sponsor: s.sponsor?.brand ?? null,
    partner: s.partner?.name ?? null,
    overseas: s.overseas,
    flags: { ...s.flags },
    echoes: s.echoes.length,
    yearStory: s.yearStory.length,
    stats: { ...s.stats },
    injury: s.injury,
    missedHalf: s.missedHalf,
    studyYear: s.studyYear,
    schedule: s.schedule,
  };
}

function remember(s: GameState, id: string, text: string) {
  if (s.memories.some((m) => m.id === id)) return;
  s.memories.push({ id, year: s.year, age: s.age, text });
}

function echo(s: GameState, years: number, text: string) {
  if (s.echoes.some((e) => e.text === text)) return;
  s.echoes.push({ year: s.year + years, text });
}

/** 拒絕或留下，不能只是一筆沒人看見的紀錄。 */
export function stampChoice(s: GameState, id: string) {
  const key = norm(id);
  if (key === "sea:no" || key === "ev:spain:no" || key === "ev:asia-camp:no" || key === "ev:us-academy:no") {
    s.flags.overseasMissed = s.flags.overseasMissed || s.year;
    s.flags.coachTrust = (s.flags.coachTrust ?? 0) + 1;
    s.chronic = clamp(s.chronic - 2, 0, 100);
  }
  if (key === "coach:stay" || key === "ev:unknown-coach:no" || key === "ev:coach-intro:no" || key === "ev:coach-callback:no") {
    s.flags.coachStability = s.year;
  }
  if (key === "early:no") s.flags.juniorPatience = s.year;
  if (key === "oly:no" || key === "asian:no") s.flags.rankingFirst = s.year;
  if (key === "sponsor:no" || key === "ev:first-sponsor:no") s.flags.sponsorPatience = s.year;
  if (key === "love:no") s.flags.soloFocus = s.year;
  if (key === "wc:no" || key === "ev:big-wc:no") s.flags.wildcardPassed = s.year;
  if (key === "body:no" || key === "ev:perf-team:no" || key === "ev:retired-invest:no") s.flags.cashReserve = s.year;
  if (key === "ev:extra:no") {
    s.flags.stableLoad = s.year;
    s.chronic = clamp(s.chronic - 1, 0, 100);
  }
  if (key === "ev:teacher:show") {
    s.flags.schoolSportsRecognition = s.year;
    echo(s, 3, "以前那個體育老師這年還問你最近打得怎麼樣。");
  }
  if (key === "ev:teacher:shrug") s.flags.lowProfile = s.year;
  if (key === "ev:weekend:go") {
    s.flags.schoolFriendship = s.year;
    echo(s, 2, "以前一起出去的同學，這年還是傳了訊息。");
  }
  if (key === "ev:weekend:stay") s.flags.keptSchedule = s.year;
  if (key === "ev:family-trip:stay") s.flags.keptSchedule = s.year;
  if (key === "ev:scholarship:no" || key === "ev:scout:pro") s.flags.proLean = s.flags.proLean || s.year;
  if (key === "ev:hobby:no" || key === "ev:soccer:stay" || key === "ev:swim:stay") {
    s.flags.tennisLove = (s.flags.tennisLove ?? 0) + 1;
  }
  if (key === "ev:legend-watch:no") s.flags.lowProfile = s.year;
  if (key === "ev:biz-seed:no" || key === "ev:biz-partner:no" || key === "ev:business:no" || key === "ev:biz-grow:park") {
    s.flags.businessPassed = s.year;
  }

  if (key === "sea:yes" || key === "ev:spain:yes" || key === "ev:asia-camp:yes" || key === "ev:us-academy:yes") {
    remember(s, "firstOverseas", "你第一次離開台灣去練球。");
  }
  if (key.startsWith("ev:rival-meet")) {
    const name = s.rivals[0]?.name ?? "那個同齡人";
    remember(s, "firstRival", `你第一次把${name}記成對手。`);
  }
  if (key === "sponsor:yes" || key === "ev:first-sponsor:yes") {
    remember(s, "firstSponsor", `第一份贊助是${s.sponsor?.brand ?? "一個牌子"}。`);
  }
  if (key === "ev:scout:yes" || key === "ev:scholarship:yes") {
    remember(s, "firstCollegeOffer", "有大學來問過你要不要過去。");
  }
  if (key === "ev:business:yes" || key === "ev:biz-seed:yes" || key === "ev:biz-partner:yes" || key === "ev:biz-grow:yes") {
    remember(s, "majorBusiness", "你曾經認真想過，球拍以外還能做什麼。");
  }
  if (key === "ev:media-hype:take" || key === "ev:commercial:yes") {
    remember(s, "majorMedia", "你的名字上過不該那麼大的標題。");
  }
  if (key === "ev:media-hype:hide") remember(s, "majorMedia", "標題寫得很大，你沒有多講。");
  if (key === "ev:legend-watch:yes") remember(s, "metCoachAside", "有一位冠軍的前教練留過電話給你。");
  if (key === "ev:teacher:show") remember(s, "schoolSports", "體育老師曾經看過你發球。");
  if (key === "ev:mentor:yes" || key === "ev:tutoring:yes" || key === "ev:charity:yes") {
    remember(s, "coachingStart", "你試過站在場邊跟別人講球。");
  }
}

export function captureSeasonMemories(s: GameState) {
  if (!s.memories) s.memories = [];
  if (s.majorInjuries.length) {
    remember(s, "firstSeriousInjury", `第一次重傷是${s.majorInjuries[0]}。`);
  }
  for (const r of s.season?.results ?? []) {
    const place = r.name.replace(/（[^）]*）/g, "");
    if (r.tier === "gs" || r.tier === "m1000" || r.tier === "olympics") {
      remember(s, "firstMajor", `你第一次打進${place}。`);
    }
    if (r.wins > 0 && (r.tier === "atp250" || r.tier === "atp500" || r.tier === "m1000" || r.tier === "gs")) {
      remember(s, "firstATPWin", `你在職業賽贏下第一場，是在${place}。`);
    }
    if (r.tier === "gs" && (r.outcome === "冠軍" || r.outcome === "亞軍")) {
      remember(s, "firstMajorUpset", `${place}你打到${r.outcome}。`);
    }
  }
}

export function responseCard(
  s: GameState,
  before: Snap,
  id: string,
  label: string,
  subject: string,
  continueId: string,
  continueLabel: string,
): StoryCard {
  const beat = describe(s, before, id, label);
  const now = (id.startsWith("train:") ? beat.now : withMoney(beat.now, before, s)).slice(0, 4);
  const later = beat.later ?? autoLater(s, before);
  const receipt: Receipt = { choice: label, now: now.length ? now : ["這件事被記下來了"], later };
  return {
    kind: "story",
    kicker: `${s.year} · ${s.age} 歲 · 這次選擇`,
    title: subject,
    body: beat.body,
    receipt,
    choices: [
      {
        id: continueId,
        label: continueLabel,
        hint: continueId === "ack:season" ? "看這一年實際打成怎樣。" : "這一年還沒走完。",
      },
    ],
  };
}

/** 年終摘要用的一句。選擇當下已經講過，這裡不把以後的事說破。 */
export function traceLine(s: GameState, id: string, before: Snap): string {
  return describe(s, before, id, "").trace;
}

function norm(id: string): string {
  if (id.startsWith("train:")) return id;
  if (id.startsWith("coach:") && id !== "coach:stay") return "coach:change";
  if (id.startsWith("sponsor:yes:")) return "sponsor:yes";
  if (id.startsWith("love:yes:")) return "love:yes";
  if (id.startsWith("ev:unknown-coach:try:")) return "ev:unknown-coach:try";
  if (id.startsWith("ev:coach-intro:yes:")) return "ev:coach-intro:yes";
  if (id.startsWith("ev:first-sponsor:yes:")) return "ev:first-sponsor:yes";
  return id;
}

interface Beat {
  body: string;
  now: string[];
  later?: string;
  trace: string;
}

function beat(body: string, now: string[], later?: string, trace?: string): Beat {
  return { body, now, later, trace: trace ?? body.split("。")[0] + "。" };
}

function describe(s: GameState, before: Snap, id: string, label: string): Beat {
  const key = norm(id);
  const rival = s.rivals[0]?.name;
  const hard = s.flags.coachConflict === s.year && s.coach.id !== before.coachId;

  switch (key) {
    case "train:coach":
      return beat("你這一年照教練的表走，沒有自己加課。", ["照他的表", "沒有自己加量"], undefined, "你照教練的表練。");
    case "train:tech":
      return beat("你把時間放在球上。體能沒有特別加。", statNow(before, s, ["球上的時間變多", "體能沒有特別加"]), undefined, "你把時間放在球上。");
    case "train:phys":
      return beat("跑步和重量多了。球感的課少一些。", statNow(before, s, ["體能課變多", "球感的課少了"]), undefined, "這一年你把體能練得很勤。");
    case "train:mental":
      return beat("你花時間練落後和平分。技術幾乎沒動。", ["練了關鍵分", "技術幾乎沒動"], undefined, "你花時間練關鍵分。");
    case "train:intense":
      return beat(
        "你把量加上去。沒有人攔你。身體會比較容易出狀況。",
        statNow(before, s, ["訓練量上去了", "受傷的機會一起上去"]),
        "這個量能不能撐過賽季，要打了才知道。",
        "你把訓練量加上去。",
      );
    case "train:rest":
      return beat("你自己把量降下來。排名也許會停，人比較不像要散掉。", ["量降下來", "身體鬆了一點"], undefined, "你自己把量降下來。");
    case "train:play":
      return beat("球場以外還留了一點時間。球不會因此變強。", ["沒有把時間排滿", "人比較不像只剩比賽"], undefined, "你沒有把所有時間都放在球場。");
    case "inj:rest":
      return beat("你今年先養傷。後面很多比賽不會出現你的名字。", ["比賽少打", "傷有時間養"], "這一年的排名，大概會停在這裡。");
    case "inj:rush":
      return beat("你沒有等到完全好就回去打。教練沒有再攔。", ["傷還沒好", "比賽照打"], "這個傷以後會不會變重，沒有人能先說。");
    case "path:college":
      return beat("你去辦了入學，沒有辦職業註冊。接下來四年，比賽排在學校後面。", ["去讀大學", "這年不辦職業註冊"], "暑假要不要出去打，以後再決定。");
    case "path:pro":
      return beat("從這一年起，比賽開始用錢和積分算。沒有人再幫你排課。", ["直接轉職業", "從 ITF 打起"]);
    case "path:pro-oly":
      return beat("你轉職業，也把奧運那一週留了下來。那一週沒有拿去賺積分。", ["轉職業", "奧運那一週空出來"]);
    case "grad:pro":
      return beat("這一年你還是大學生。畢業以後再轉職業，積分從明年開始算。", ["先把這年打完", "明年轉職業"]);
    case "grad:oly":
      return beat("你先去打畢業那年的奧運，再辦職業註冊。", ["先打奧運", "然後轉職業"]);
    case "grad:leave":
      return beat("你知道這是校園裡的最後一季。打完，排名就停在這裡。", ["打完就離開"], "學位如果還在，會跟著你。排名不會。");
    case "oly:yes":
      return beat("你答應國家隊。那一個月沒有拿去賺積分。", ["去打奧運", "積分的週數少一截"]);
    case "oly:no":
      return beat("奧運你沒去。那一週拿去打原本的比賽。協會沒有再打來。", ["奧運不去", "積分的週數還在"], "代表台灣這件事，這年先過去了。");
    case "asian:yes":
      return beat("你去打亞運。少一站積分，家人看得到轉播。", ["代表出賽", "少一站積分"]);
    case "asian:no":
      return beat("亞運你推掉了。這週回到原本的賽程。", ["沒有代表出賽", "賽程沒有改"]);
    case "campus:study":
      return beat("這一年書讀得比較多，比賽少一點。教授比較少點你的名。", ["學業多一點", "比賽少一點"]);
    case "campus:summer":
      return beat("暑假你飛去佛州打 ITF。學校的事先放著。", ["暑假去打", "書會落後一截"], "學位還在不在，要看你以後補不補得回來。");
    case "campus:both":
      return beat("你兩邊都硬撐。幾乎沒有真正的休息週。", ["學業和比賽都抓", "人會很累"], "很少人撐得住。你還是要打打看。");
    case "sea:yes":
      return beat(
        s.wealth === "tight"
          ? "你去了。旅費用獎學金付。練球的地方不一樣，家變遠。"
          : "你去了。花了一筆錢，第一次真正離開原本的教練一段時間。",
        s.wealth === "tight" ? ["人離開台灣", "旅費不用家裡出"] : ["人離開台灣", "這趟花了一筆"],
        "有人記住了你的名字。以後用不用得上，還不知道。",
      );
    case "sea:no":
      return beat(
        `你留下來。這筆錢沒有出去。${s.coach.name}沒有多說，只是把接下來一個月的訓練重新排了一次。`,
        ["旅費沒花", "還是原來的教練", "身體少奔波一趟"],
        "那趟行程沒有成。以後還有沒有人來問，現在不知道。",
      );
    case "early:yes":
      return beat("台南那站 ITF 排進去了。你會先知道自己跟大人差在哪。", ["去打成人組", "輸了也很正常"], "輸給大人不丟臉。你會記得那個差距。");
    case "early:no":
      return beat("成人組這年先不排。你再留在青少年。教練沒有反對。", ["還在打青少年", "成人組先不去"]);
    case "coach:stay":
      return beat(
        `你留下${s.coach.name}。接下來幾個月沒有換練法。至少你知道這個人怎麼帶你。`,
        ["教練沒換", "練法不用重來"],
        "進步大概還是原來的速度。",
      );
    case "coach:change":
      return beat(
        hard
          ? `教練換成${s.coach.name}。前幾個月對不上。他的練法你還沒吃進去。`
          : `教練換成${s.coach.name}。一開始怪怪的，後來開始對上。`,
        ["教練換了", hard ? "這幾個月會比較卡" : "練法開始對上"],
        "合不合，要打過幾個月才知道。",
      );
    case "sponsor:yes":
      return beat(
        `${s.sponsor?.brand ?? "這個牌子"}的帽子開始出現在你頭上。名字也會先印在別人的型錄上。`,
        ["簽約了", "曝光會變多"],
        "排名如果掉太深，合約不一定還在。",
      );
    case "sponsor:no":
      return beat("你沒簽。帽子還是自己的。他們沒有保證下次還會開同樣的數字。", ["沒有簽約", "訓練沒有被拍攝打斷"], "更好的條件會不會來，沒有人先說。");
    case "love:yes":
      return beat(`${s.partner?.name ?? "那個人"}開始出現在非比賽的日子。巡迴的時候會多一個人要報平安。`, ["有人在一起", "賽間要多報平安"]);
    case "love:no":
      return beat("你這年不想把人放進行程。晚上還是你自己的。球也還是你自己打。", ["沒有開始", "時間還是滿的"]);
    case "love:stay":
      return beat(`你和${s.partner?.name ?? "那個人"}繼續。球不會因此變強，日子沒那麼空。`, ["還在一起", "電話還是打"]);
    case "love:end":
      return beat("你們分開了。晚上是你自己的，也比較安靜。", ["分開", "心情會空一陣"]);
    case "wc:yes":
      return beat("你接了那張外卡，進會外賽。不是排名夠了，是剛好有一個空位。", ["外卡接了", "輸了也是輸在更大的球場"]);
    case "wc:no":
      return beat("那個空位你沒去。人情沒有用掉，週數還在你原本打得動的比賽上。", ["外卡沒去", "賽程沒改"]);
    case "body:yes":
      return beat("你把一筆錢換成復健團隊。有人開始幫你顧舊傷和睡眠。", ["錢花在身體上", "舊傷比較有人管"], "會不會真的少傷，要過幾年才知道。");
    case "body:no":
      return beat("那筆錢你留下。膝蓋還是你自己顧。戶頭比較厚。", ["錢留著", "身體沒有多一組人"]);
    case "broke:family":
      return beat("家裡把不夠的錢補上，沒有跟你談條件。你會記得這筆。", ["帳先補上", "你會記得"]);
    case "broke:scrape":
      return beat("你把賽程縮到最小，再撐一年。少飛，少打。", ["賽程縮短", "先不要停"]);
    case "stay:yes":
      return beat("你決定再打。理由可以以後再想。名字還會出現在下週的報名表。", ["再打", "沒有把名字拿掉"]);
    case "ev:teacher:show":
      return beat("你打了幾球給他看。沒有獎金。有人第一次覺得你會打球。", ["有人看見你發球"], "以後他還會不會問起，現在不知道。");
    case "ev:teacher:shrug":
      return beat("你笑一下就去撿球。體育課沒有變成表演。", ["沒有多講", "課還是照打"]);
    case "ev:family-trip:go":
      return beat("你跟家人出門了幾天。那幾天幾乎沒碰球。人比較輕。", ["球停了幾天", "人比較鬆"]);
    case "ev:family-trip:stay":
      return beat("家人出門，你留下練球。出遊的照片沒有你。課表沒有空。", ["球沒有停", "那趟旅行沒有你"]);
    case "ev:soccer:go":
      return beat("你去踢了足球。速度和朋友多一點，網球少了幾堂。", ["腳步會快一點", "網球的課少了"]);
    case "ev:soccer:stay":
      return beat("校隊來問，你還是去打網球。那件事你當沒聽見。", ["還是打網球", "校隊沒去"]);
    case "ev:move:adapt":
      return beat("搬家了，路變長。你還是去球場。課沒有因此取消。", ["照樣去練", "路比較遠"]);
    case "ev:move:ease":
      return beat("你先少去幾週，等生活安頓。球會生疏一點。", ["少練幾週", "先把家安頓"]);
    case "ev:swim:go":
      return beat("你同時練游泳和網球。體能也許會好，網球被切掉兩堂。", ["多了一項", "網球的時間少了"]);
    case "ev:swim:stay":
      return beat("游泳隊來問，你沒去。你已經有一項要練的了。", ["沒有分走時間"]);
    case "ev:weekend:go":
      return beat("你週末跟同學出去。訓練空了一塊。跟那群人熟了一些。", ["週末空了", "同學比較熟"], "之後幾年，他們也許還會約你。");
    case "ev:weekend:stay":
      return beat("同學約你，你沒去。課表還是滿的。", ["週末還在練", "那次沒跟他們出去"]);
    case "ev:extra:yes":
      return beat("你每週多加兩堂。進步的機會變多，受傷的機會一起變多。", ["訓練量變兇", "身體比較緊"], "這個量要不要減，等身體先告訴你。");
    case "ev:extra:no":
      return beat("你沒有把量加上去。表還是原來那張。人比較撐得住。", ["量沒有加", "表還是原來的"]);
    case "ev:hobby:yes":
      return beat("你留了一點時間給打球以外的事。不會讓你變成另一種職業。", ["空出一點時間"], "以後用不用得上，現在不知道。");
    case "ev:hobby:no":
      return beat("空下來你還是拿去練球。那個念頭先放下。", ["時間還是在球場"]);
    case "ev:crush:yes":
      return beat("放學有人跟你一起走。練球沒有停，心會放在別的地方一點點。", ["多了一個人", "練球還在"]);
    case "ev:crush:no":
      return beat("你把耳機戴上，直接去球場。那個人沒有放進行程。", ["沒有開始", "還是直接去練"]);
    case "ev:exam:play":
      return beat("考試撞上比賽，你去打了。書落後了一截。籤表上還有你。", ["去比賽", "書落後"], "成績單會記得這一次。");
    case "ev:exam:study":
      return beat("你留下考試，這一站比賽沒去。成績單會好看一點。", ["留下考試", "這一站沒打"]);
    case "ev:rival-meet:lock":
      return beat(`你把${rival ?? "他"}記住了。以後看到這個名字，你會停一下。`, ["記住這個對手"], "這個人以後還會再碰到。");
    case "ev:rival-meet:let":
      return beat(`你沒有把這場輸變成故事。可是${rival ?? "他"}的名字還是在籤表上。`, ["打完就算了", "人還是那個"], "以後抽到他，你還是會認得。");
    case "ev:rival-rematch:chase":
      return beat(`${rival ?? "他"}還在。你還是想贏他。這個名字會跟著你一陣子。`, ["還想贏他"]);
    case "ev:rival-rematch:drop":
      return beat(`你先不管${rival ?? "他"}。其他人的比賽也得打。`, ["先不追這個人"]);
    case "ev:rival-adult:aim":
      return beat(`你把${rival ?? "他"}當成一個具體的名字，不是仇恨。`, ["有一個目標"], "成人組還會再碰到。");
    case "ev:rival-adult:own":
      return beat("你們各打各的。你沒有把他的賽程掛在自己身上。", ["各打各的"]);
    case "ev:rival-ch:nod":
      return beat(`你跟${rival ?? "他"}打了聲招呼。舊識還在。比分以後再說。`, ["打了招呼"]);
    case "ev:rival-ch:cold":
      return beat(`你當沒看到${rival ?? "他"}。注意力留在自己的第一輪。`, ["沒有打招呼"], "他大概也看見你了。");
    case "ev:rival-atp:talk":
      return beat(`賽前你們講了兩句。認識很久了。這不影響明天的發球。`, ["賽前講了兩句"]);
    case "ev:rival-atp:skip":
      return beat("你等到場上再說。走廊沒有把舊帳講完。", ["沒有在走廊講"]);
    case "ev:asia-camp:yes":
      return beat("你去了亞洲的訓練營。會累，也第一次跟別的國家的同齡人一起練。", ["去了訓練營", "人會比較累"], "那邊認識的人，以後還會不會聯絡，不知道。");
    case "ev:asia-camp:no":
      return beat("亞洲訓練營你沒去。國內的課表還打得完。錢和人都不動。", ["人留在國內", "課表沒改"], "下次還有沒有名額，沒有人先留。");
    case "ev:spain:yes": {
      const free = s.money >= before.money - 100;
      return beat(
        "你在西班牙的紅土上練了一個月。那裡的練法跟以前不一樣。你認識了幾個教練，也跟不同打法的人一起練。",
        free ? ["人在西班牙", "旅費不用家裡出", "紅土練了一個月"] : ["人在西班牙", "這趟花了一筆", "紅土練了一個月"],
        "有人記住了你的名字。以後用不用得上，還不知道。",
      );
    }
    case "ev:spain:no":
      return beat(
        `你沒去西班牙。這筆旅費對家裡來說還是太高。${s.coach.name}把這個月的課照原表排完。`,
        ["人留在台灣", "旅費沒花", "還是原來的教練"],
        "以後還有沒有人從那邊打來，現在不知道。",
      );
    case "ev:unknown-coach:try":
      return beat(
        s.coach.id === before.coachId
          ? "你試了一個月，練法合不來。一個月以後回到原來的教練。"
          : `你留下${s.coach.name}。前幾個月可能還是會怪。`,
        s.coach.id === before.coachId ? ["試完回到原教練", "一個月對不上"] : ["教練換了", "還在適應"],
        "合不合，不是這一個月就能說死。",
      );
    case "ev:unknown-coach:no":
      return beat(`你沒有換。還是跟著${s.coach.name}。練法不用重來。`, ["教練沒換", "這一個月照舊"]);
    case "ev:us-academy:yes": {
      const free = s.money >= before.money - 100;
      return beat(
        "你去美國練了幾週。訓練和人不一樣，家比較遠。",
        free ? ["人在美國", "旅費不用家裡出"] : ["人在美國", "這趟花了一筆"],
        "有一間學校也許會記得這段。現在還沒有保證。",
      );
    }
    case "ev:us-academy:no":
      return beat("美國的試訓你沒去。錢和原本的生活都還在。原本的課也還在。", ["人留在這裡", "旅費沒花", "還是原來的教練"], "那間學院還記不記得這次，現在不知道。");
    case "ev:scout:yes":
      return beat("你跟那位大學教練留了聯絡方式。十八歲那張表上，大學這條會比較具體。", ["留了聯絡方式"], "獎學金有沒有，他沒有保證。");
    case "ev:scout:pro":
      return beat("你跟球探說想直接打職業。這句話先說出來了。以後還是可以改。", ["你說想打職業"], "十八歲還是可以改。這句話他聽見了。");
    case "ev:first-sponsor:yes":
      return beat(`${s.sponsor?.brand ?? "這個牌子"}的拍子開始出現在你的袋子裡。合約很短。`, ["簽了第一份小約", "裝備有人出"]);
    case "ev:first-sponsor:no":
      return beat("小牌子來問，你沒簽。你想等大一點的。也可能等不到。", ["沒簽", "袋子裡還是自己的拍"]);
    case "ev:tutoring:yes":
      return beat("你開始教別人打球，補一點家用。你自己的課會少。", ["有一點現金", "自己的訓練少了"], "你開始知道怎麼跟別人講球。");
    case "ev:tutoring:no":
      return beat("教球的工作你沒接。時間留著。錢的事再想別的辦法。", ["時間沒分走", "這筆錢沒有"]);
    case "ev:coach-callback:keep":
      return beat("你跟西班牙那位教練保持聯絡。他沒有要你現在就過去。", ["電話還通著"], "以後換環境，也許還有這條線。");
    case "ev:coach-callback:school":
      return beat("你把那通電話轉去問大學。教練這條先不綁。", ["去問大學", "人先不過去"]);
    case "ev:coach-callback:no":
      return beat(`西班牙的電話你沒有接下去。你現在的教練還是${s.coach.name}。`, ["電話沒有續", "教練沒換"]);
    case "ev:coach-intro:yes":
      return beat(
        hard
          ? `${s.coach.name}開始帶你。前幾個月對不上。介紹來的人，不代表你們合。`
          : `${s.coach.name}開始帶你。線是舊識介紹的，合不合還是要打了才知道。`,
        ["教練換了"],
        "這幾個月可能會很難適應。也可能開始對上。",
      );
    case "ev:coach-intro:no":
      return beat("介紹來的教練你沒換。線留著，人先不換。", ["教練沒換", "線還在"]);
    case "ev:big-wc:yes":
      return beat("你接了一張比平常大的外卡。輸了也很正常。過了的話，名字會不一樣。", ["大外卡接了"], "過不過得了會內賽，要打了才知道。");
    case "ev:big-wc:no":
      return beat("那張大外卡你沒去。這週留給你原本打得動的比賽。", ["外卡沒去", "原本的賽程還在"]);
    case "ev:commercial:yes":
      return beat("你拍了一支廣告。錢和曝光進來，那兩天的課沒了。", ["進帳一筆", "兩天沒練"], "這個牌子的人以後還會不會來，不一定。");
    case "ev:commercial:no":
      return beat("廣告你沒接。訓練不停。贊助商未必高興。", ["沒有拍攝", "訓練沒斷"], "下次的數字可能會小一點。也可能沒有下次。");
    case "ev:party:yes": {
      const met = s.yearStory.some((line) => line.includes("電話"));
      return beat(
        met ? "你去了贊助商的局。有人留了電話。不一定用得上。" : "你去了。隔天訓練你一直看鐘。電話倒是沒有多留。",
        met ? ["去了晚上的局", "有人留了電話"] : ["去了晚上的局", "隔天比較累"],
        met ? "留了的聯絡方式，現在還看不出來有沒有用。" : undefined,
      );
    }
    case "ev:party:no":
      return beat("晚上的局你沒去。你早點睡。局還是會辦，只是沒有你。", ["早點睡", "人沒去"]);
    case "ev:perf-team:yes":
      return beat("你把錢花在體能和醫療團隊上。有人開始管你的睡眠和舊傷。", ["戶頭瘦一截", "身體多一組人"], "舊傷會不會真的好管，要過幾年。");
    case "ev:perf-team:no":
      return beat("團隊的報價你先沒有付。錢留著。身體還是你自己顧。", ["錢留著", "沒有團隊"]);
    case "ev:biz-seed:yes":
      return beat("你把一個小球線的想法記下來。沒有開公司。這件事不再是隨便想想。", ["先記下來"], "以後有沒有人要一起做，還不知道。");
    case "ev:biz-seed:no":
      return beat("做牌子的念頭你放下了。線還是拿來穿拍。", ["先專心打球"]);
    case "ev:biz-partner:yes":
      return beat("你見了想一起做牌子的人。吃飯吃完，事情沒有立刻開始，也沒有結束。", ["見了一面", "時間被分走"], "會不會變成真的事情，現在說不準。");
    case "ev:biz-partner:no":
      return beat("那個合作你先沒見。你這陣子只想處理排名。", ["沒有見面", "時間還在比賽"]);
    case "ev:biz-grow:yes":
      return beat("你的小牌子開始有人買。出貨佔掉一些空檔。打球會比較難專心。", ["有進帳", "空檔變少"]);
    case "ev:biz-grow:park":
      return beat("牌子先停，你回去打球。名字還在，事先放下。", ["事先停", "時間回到球場"]);
    case "ev:business:yes":
      return beat("你答應試試看一起做牌子。以後如果沒有排名，這件事也許還在。", ["先試試看"], "現在還沒有開始賺錢。");
    case "ev:business:no":
      return beat("品牌的合作你沒接。合約沒有簽。排名還是你現在要管的事。", ["沒有簽", "時間沒分走"]);
    case "ev:new-gen:fight":
      return beat("年輕人開始贏你，你把量加回去。你不想被寫成已經退了。", ["量加回去", "身體未必同意"], "這個量，身體答不答應，賽季會告訴你。");
    case "ev:new-gen:ease":
      return beat("你沒有跟年輕選手的標題吵。賽程照你受得了的排。", ["沒有加量", "標題你沒回"]);
    case "ev:mentor:yes":
      return beat("你花時間跟一個年輕球員講了怎麼打。你發現自己其實知道一些能教的事。", ["花了時間教", "自己的課少一點"], "以後如果不上場，這件事還在。");
    case "ev:mentor:no":
      return beat("年輕球員來問，你說沒空。你還有自己的訓練。", ["時間留給自己"]);
    case "ev:schedule-cut:yes":
      return beat("你拿掉兩站比賽。積分會少一點。隔週比較像人。", ["賽程短了", "身體鬆一點"]);
    case "ev:schedule-cut:no":
      return beat("你還是把賽程排滿。你知道風險。名字還在名單上。", ["賽程照滿", "身體沒有多休息"]);
    case "ev:wedding:yes":
      return beat("你去了朋友的婚禮。少打一點。你會記得自己不是只有選手這一個身分。", ["去了婚禮", "少打一點"]);
    case "ev:wedding:no":
      return beat("婚禮你沒去。禮送到了，酒席沒有你。賽程沒有斷。", ["人沒去", "比賽照打"]);
    case "ev:burnout:rest":
      return beat("你停了一週，沒有告訴太多人。排名不會因為一週就沒了。", ["停了一週", "心情有地方放"]);
    case "ev:burnout:push":
      return beat("你不想去球場，還是去了。你怕一停就停不下來。", ["還是去練", "人更累"], "再這樣撐，哪一周會真的停，你現在不知道。");
    case "ev:charity:yes":
      return beat("你去給青少年上了一堂公開課。沒有錢。會有相機。你講了一些自己都覺得普通的話。", ["名字上了海報", "一天沒練"], "有人會把你當成可以問問題的人。");
    case "ev:charity:no":
      return beat("公開課你推掉了。那天留給訓練。海報上沒有你。", ["沒去", "訓練沒斷"]);
    case "ev:legend-watch:yes":
      return beat("你把電話留下。他沒有現在就收你。他只說以後如果要換環境，可以打。", ["電話留下了"], "現在什麼都不會發生。以後也許會。");
    case "ev:legend-watch:no":
      return beat("場邊那個人你沒有過去。你還是回自己的場。電話沒有留。", ["沒有留電話", "回到自己的場"]);
    case "ev:sponsor-pull:ok":
      return beat(`${before.sponsor ?? "贊助商"}沒有續約。你知道了。比賽還在，帽子下週不能再戴。`, ["贊助沒了", "比賽還在"]);
    case "ev:sponsor-pull:angry":
      return beat(`${before.sponsor ?? "贊助商"}沒有續約。你很不爽。排名不會因為生氣就回來。`, ["贊助沒了", "心情會差一陣"]);
    case "ev:upset:ride":
      return beat("練習賽你贏了一個不該輸的人。沒有積分。你讓這件事留在腦子裡。", ["信心上來", "沒有積分"], "別人會講。這不是排名。");
    case "ev:upset:flat":
      return beat("你沒有特別講。練習賽就是練習賽。消息還是傳出去了一點。", ["你沒有多講", "還是有人知道"]);
    case "ev:scholarship:yes":
      return beat("你先答應有興趣。學費這件事，突然有人接手的可能。十八歲還可以再決定。", ["這扇門先開著"], "獎學金最後給不給，現在還沒有紙。");
    case "ev:scholarship:no":
      return beat("獎學金你先沒有接。你還不想把未來說成去讀書。那間學校不會一直等。", ["先沒接", "路還是你自己選"]);
    case "ev:retired-invest:yes":
      return beat("你收下那筆錢。有人出錢讓你找人看傷。他說不用還。你還是會記得。", ["進帳一筆", "身體多一組人", "欠一份人情"]);
    case "ev:retired-invest:no":
      return beat("那筆錢你沒有收。你不想欠這個人情。傷還是你自己的。", ["沒有收", "不欠這個人"]);
    case "ev:media-hype:take":
      return beat("你接了幾個訪問。名字會更響，你也比較難專心。標題還是標題。", ["曝光變多", "訓練比較吵"], "下次電話會不會更多，還不知道。");
    case "ev:media-hype:hide":
      return beat("標題很大，你沒有多講。熱度會掉快一點。訓練比較安靜。", ["少講", "熱度掉得比較快"]);
    default:
      return beat(
        label ? `你選了「${label}」。事情照這個決定走，沒有被跳過。` : "事情照你的決定走了。",
        autoNow(before, s),
        undefined,
        label ? `你選了「${label}」。` : "你做了一個決定。",
      );
  }
}

function statNow(before: Snap, s: GameState, base: string[]): string[] {
  const word: Partial<Record<keyof GameState["stats"], string>> = {
    serve: "發球有長",
    forehand: "正拍有長",
    backhand: "反拍有長",
    volley: "截擊有長",
    fitness: "體能有長",
    strength: "力量有長",
    speed: "速度有長",
    iq: "球商有長",
    mental: "心比較定",
    pressure: "抗壓有長",
  };
  const extra = (Object.keys(word) as (keyof GameState["stats"])[])
    .map((k) => ({ k, d: s.stats[k] - before.stats[k] }))
    .filter((x) => x.d >= 1)
    .sort((a, b) => b.d - a.d)
    .slice(0, 1)
    .map((x) => word[x.k]!)
    .filter((line) => !base.includes(line));
  return [...base, ...extra].slice(0, 4);
}

function withMoney(now: string[], before: Snap, s: GameState): string[] {
  const d = s.money - before.money;
  const has = now.some((n) => /錢|花|進帳|戶頭|旅費|現金/.test(n));
  if (has) return now;
  if (d <= -800) return [...now, "這趟花了一筆"];
  if (d >= 800) return [...now, "進帳一筆"];
  return now;
}

function autoNow(before: Snap, s: GameState): string[] {
  const now: string[] = [];
  if (s.coach.id !== before.coachId) now.push(`教練換成${s.coach.name}`);
  if (s.path !== before.path && s.path === "college") now.push("去讀大學");
  if (s.path !== before.path && s.path === "pro") now.push("轉職業");
  if ((s.sponsor?.brand ?? null) !== before.sponsor) now.push(s.sponsor ? "有了贊助" : "贊助沒了");
  if ((s.partner?.name ?? null) !== before.partner) now.push(s.partner ? "有人在一起" : "分開了");
  if (s.overseas && !before.overseas) now.push("人離開台灣");
  if (s.missedHalf && !before.missedHalf) now.push("比賽會少打");
  if (s.studyYear && !before.studyYear) now.push("書讀得比較多");
  if (s.schedule === "light" && before.schedule !== "light") now.push("賽程縮短");
  if (s.motivation - before.motivation >= 4) now.push("比較想打了");
  if (before.motivation - s.motivation >= 4) now.push("這週比較提不起勁");
  if (s.chronic - before.chronic >= 3) now.push("身體累了一點");
  if (before.chronic - s.chronic >= 3) now.push("身體鬆了一點");
  if (!now.length) now.push("這件事被記下來了");
  return now;
}

function autoLater(s: GameState, before: Snap): string | undefined {
  if (s.echoes.length <= before.echoes && !Object.keys(s.flags).some((k) => s.flags[k] !== before.flags[k])) {
    return undefined;
  }
  const grew = (k: string) => (s.flags[k] ?? 0) !== (before.flags[k] ?? 0) && (s.flags[k] ?? 0) > 0;
  const lines: [string, string][] = [
    ["coachConflict", "這幾個月可能會很難適應。也可能後來對上。"],
    ["overseasNetwork", "有人記住了你的名字。以後用不用得上，還不知道。"],
    ["metGreatCoach", "那位教練沒有現在就收你。"],
    ["collegeNetwork", "有一間學校把你的名字留著。"],
    ["collegeInterest", "大學這條路，先沒有關死。"],
    ["businessInterest", "這個念頭先放著。不一定會變成什麼。"],
    ["coachingInterest", "你開始知道怎麼跟別人講球。"],
    ["mediaExperience", "有人會再拿麥克風來。不一定是好事。"],
    ["injuryPrevention", "身體會不會真的比較好管，要過幾年才知道。"],
    ["schoolFriendship", "之後幾年，他們也許還會約你。"],
    ["schoolSportsRecognition", "以後他還會不會問起，現在不知道。"],
    ["overseasMissed", "那趟行程沒有成。以後還有沒有人來問，現在不知道。"],
    ["coachStability", "至少你知道這個人怎麼帶你。"],
  ];
  for (const [flag, line] of lines) {
    if (grew(flag)) return line;
  }
  if (s.echoes.length > before.echoes) return "有一件事先記著。現在還看不出來會怎樣。";
  return undefined;
}
