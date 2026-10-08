import { wealthLabel } from "./coaches";
import { money, playingStyle } from "./format";
import { LEGENDS, playerName } from "./history";
import { rngFor, weighted } from "./rng";
import type { Ending, GameState } from "./types";

function identity(s: GameState): string {
  const peak = s.peakRank;
  const gs = s.titles.gs;
  const talent = s.hidden.talent;
  const finals = s.gsResults.some((g) => g.includes("亞軍") || g.includes("冠軍"));
  if (peak === 1 && gs >= 3) return "那個年代的代表";
  if (peak === 1) return "世界第一";
  if (gs >= 1 && talent < 72) return "意外的大滿貫冠軍";
  if (gs >= 1) return "大滿貫冠軍";
  if (peak != null && peak <= 4 && finals && gs === 0) return "差一步的頂尖選手";
  if (peak != null && peak <= 8 && gs === 0) return "離冠軍只差一步";
  if (talent >= 84 && (peak == null || peak > 220) && (s.peopleGaveUp || s.age < 30)) return "被浪費的天才";
  if (s.firstTop100Age != null && s.firstTop100Age >= 26) return "大器晚成";
  if (s.collegeTitles >= 2 && (peak == null || peak > 160)) return "大學網球圈的強者";
  if (peak != null && peak <= 40) {
    return playingStyle(s.stats).includes("底線") ? "台灣的底線好手" : "巡迴賽的固定班底";
  }
  if (peak != null && peak <= 120) return "從挑戰賽打上來的人";
  if (peak != null && peak <= 350) return "靠積分吃飯的人";
  if (s.path === "college") return "最好的成績留在大學";
  if (s.age < 23) return "還沒打出成績就停了";
  return "認真打過的普通人";
}

function postCareer(s: GameState): string {
  const rng = rngFor(s.seed, "ending-job");
  const peak = s.peakRank ?? 999;
  const flags = s.flags ?? {};
  const options: { item: string; w: number }[] = [];
  if (s.stats.iq >= 58 || s.coachesHad.length >= 2 || flags.coachingInterest) options.push({ item: "網球教練", w: flags.coachingInterest ? 6 : 4 });
  if (peak <= 40 || flags.mediaExperience) options.push({ item: "轉播球評", w: flags.mediaExperience ? 5 : 3 });
  if (peak <= 40) options.push({ item: "網球學院", w: flags.coachingInterest ? 4 : 2 });
  if (peak <= 100) options.push({ item: "球員經紀人", w: 2 });
  if (s.money > 1_500_000 || s.earnings > 4_000_000 || (flags.businessInterest ?? 0) > 0) {
    options.push(
      { item: "自己的品牌", w: (flags.businessInterest ?? 0) > 0 ? 6 : 3 },
      { item: "做體育相關的生意", w: (flags.businessInterest ?? 0) > 0 ? 5 : 2 },
    );
  }
  if (flags.overseasNetwork) options.push({ item: "網球顧問", w: flags.coachingInterest ? 4 : 3 });
  if (s.degree || (flags.academicSuccess ?? 0) >= 2) options.push({ item: "老師", w: (flags.academicSuccess ?? 0) >= 2 ? 4 : 2 }, { item: "一份跟網球無關的工作", w: flags.hobby ? 3 : 2 });
  if (s.partner) options.push({ item: "回家過生活", w: 2 });
  options.push({ item: "一份普通的工作", w: 2 });
  if (peak <= 120 && s.hidden.luck > 70 && s.stats.iq > 62 && !s.peopleGaveUp && s.stats.mental > 55) {
    options.push({ item: "教練，而且後來帶出世界第一", w: 1.4 });
  }
  return weighted(rng, options);
}

function arc(s: GameState): string {
  if (s.age < 14) return "你幾乎還沒真正開始，就離開了網球。";
  if (s.titles.gs >= 2) {
    return `你拿了 ${s.titles.gs} 座大滿貫。這沒辦法只用運氣解釋，雖然運氣確實幫過你。`;
  }
  if (s.titles.gs === 1) {
    return "你拿過一座大滿貫。從那天晚上以後，別人介紹你常常只需要一句：他拿過大滿貫。";
  }
  if (s.peakRank != null && s.peakRank <= 10) {
    return `有好一陣子，大滿貫的種子名單上看得到你。生涯最高是世界第 ${s.peakRank}。`;
  }
  if (s.peakRank != null && s.peakRank <= 50) {
    return `你曾經是能打進職業賽會內賽的選手。最高世界第 ${s.peakRank}。打網球的人裡，能到這裡的不多。`;
  }
  if (s.peakRank != null && s.peakRank <= 150) {
    return `你靠挑戰賽，再加上偶爾幾站 ATP 賽事，這樣打了幾年。生涯最高排名是世界第 ${s.peakRank}。不算傳奇，但這已經是一份很累的工作。`;
  }
  if (s.collegeTitles >= 1) {
    return "你打得最痛快的比賽都在大學。觀眾不多，但那個球場你打得很開心。";
  }
  return "你認真打過網球。職業排名沒有留下太顯眼的成績，日子還是過得去。";
}

function feeling(s: GameState, label: string): string {
  if (label === "差一步的頂尖選手" || label === "離冠軍只差一步") {
    const rival = s.notableWins[0]?.match(/擊敗(\S+)/)?.[1];
    return `你這輩子一直在追同一群人${rival ? `，其中包括${rival}` : ""}。你贏過很強的人，也打進過大滿貫後段。你離世界第一一直很近，但最後始終差一個冠軍。`;
  }
  if (label === "被浪費的天才") {
    return "很早以前就有人覺得你跟別人不一樣。後來，那些人一個個不再提起這件事。你不是沒有機會，只是有些年份，你把時間花在了別的地方。那些選擇不一定是錯的，只是最後沒有把你帶回網球場。";
  }
  if (label === "意外的大滿貫冠軍") {
    return "以你起步的條件，這座冠軍本來不該發生，但它還是發生了。後來常有人問你有什麼秘密。你沒有。你只是那天每一分都咬住了。";
  }
  if (label === "大器晚成") {
    return `你打進前一百時已經 ${s.firstTop100Age} 歲。很多人在那之前就覺得你到此為止。你沒有照他們想的走。`;
  }
  if (label === "世界第一" || label === "那個年代的代表") {
    return "你當過世界第一。實際坐上那個位置，跟外面看起來不太一樣。之後你每輸一場，別人都會拿來跟那一年比。你還是得一場一場打。";
  }
  if (s.majorInjuries.length >= 2) {
    return `你有過 ${s.majorInjuries.length} 次重傷。有些決定是傷還沒好就做的，那些決定不是每一次都對。`;
  }
  if (s.peopleGaveUp) {
    return "到後來，願意再幫你的人變少了。沒有人在懲罰你，只是電話真的變少了。";
  }
  return "沒有單一場比賽可以代表這一生。它是很多個普通的訓練日加起來的。";
}

function people(s: GameState): string {
  const coaches = s.coachesHad.filter((n, i) => s.coachesHad.indexOf(n) === i).slice(0, 3).join("、");
  const coachLine = coaches ? `你一路合作過的教練有${coaches}。` : "沒有固定合作過的教練。";
  const home = `家境${wealthLabel(s.wealth)}。早年有多少資源，後來別人問你怎麼開始的，你還是得講，不管你想不想講。`;
  const love = s.partner
    ? `感情裡有${s.partner.name}。這件事沒讓你多贏球，也沒寫進成績。`
    : "感情這件事，你沒有認真談過。";
  const rival = s.rivals?.[0];
  const rivalLine = rival ? `${rival.name}是你從青少年就碰上的人。` : "";
  return `${coachLine}${home}${love}${rivalLine}`;
}

function after(s: GameState, post: string): string {
  if (post.includes("世界第一")) {
    return "退役以後你去當教練。你對那個年輕的台灣選手說的話，跟很久以前別人對你說的幾乎一樣。幾年後他站上世界第一。你坐在觀眾席，沒有搶麥克風。這算成功的一生。你以前排第幾是一部分，更重要的是你沒有在中途放棄。";
  }
  if (post === "轉播球評") {
    return "你後來去當轉播球評。你講比賽講得比較慢，因為你知道每一分後面在做什麼決定。別人叫你的名字時，還是用選手時期那個叫法。";
  }
  if (post === "網球教練" || post === "網球學院") {
    return `你沒有再追排名，改看別人的正拍。${s.titles.gs ? "學生們知道你拿過大滿貫。" : "有的學生後來成績比你好，有的沒有。"}你都還在場邊。`;
  }
  if (post === "回家過生活") {
    return "網球慢慢退到生活後面。你沒有覺得自己輸了，只是終於不用再把每個晚上都留給下一場比賽。";
  }
  if (post === "自己的品牌" || post === "做體育相關的生意") {
    return "你後來做的事還是跟網球有關，只是不用再靠自己的身體賺錢。你還是會出現在網球場，只是身分不一樣了。";
  }
  if (post === "網球顧問") {
    return "你後來還是在球場邊。只是球場常常不在台灣。你認得的人，有些是很早以前訓練營留下的。";
  }
  return "後來沒有再拿獎盃，日子還是過得下去。沒當過世界第一的人，也可以過得很好。這一生就這樣了。";
}

export function buildEnding(s: GameState): Ending {
  const label = identity(s);
  const post = postCareer(s);
  const paragraphs = [arc(s), feeling(s, label), people(s), after(s, post)];
  const remembered = (s.memories ?? []).filter((m) => m.id !== "firstCoach" && m.id !== "firstRival");
  if (remembered.length) paragraphs.push(remembered.slice(0, 4).map((m) => m.text).join(""));
  if (s.retiredReason) paragraphs[0] = `${s.retiredReason}${paragraphs[0]}`;

  const h2h = Object.entries(s.h2h)
    .map(([id, rec]) => {
      const found = LEGENDS.find((l) => l.id === id);
      const name = found ? playerName(found) : id;
      return { name, ...rec, n: rec.w + rec.l };
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  const tennis: { label: string; value: string }[] = [
    { label: "最高排名", value: s.peakRank ? `世界第 ${s.peakRank}${s.peakRankYear ? `（${s.peakRankYear}）` : ""}` : "沒有職業排名" },
    { label: "大滿貫", value: s.titles.gs ? `${s.titles.gs} 座` : s.bestGs !== "—" ? `最好到${s.bestGs}` : "—" },
    { label: "大師賽", value: String(s.titles.m1000) },
    { label: "ATP 冠軍", value: String(s.titles.atp) },
    { label: "挑戰賽", value: String(s.titles.ch) },
    { label: "生涯獎金", value: money(s.earnings) },
    { label: "勝－敗", value: `${s.wins}–${s.losses}` },
    { label: "巡迴賽年數", value: s.yearsPro ? `${s.yearsPro} 年` : "—" },
    { label: "打法", value: playingStyle(s.stats) },
  ];
  if (s.olympic) tennis.push({ label: "奧運", value: s.olympic });
  if (s.asian) tennis.push({ label: "亞運", value: s.asian });
  for (const row of h2h) {
    tennis.push({ label: `對${row.name}`, value: `${row.w}–${row.l}` });
  }

  const life: { label: string; value: string }[] = [
    { label: "說法", value: label },
    { label: "家境", value: wealthLabel(s.wealth) },
    { label: "教練", value: s.coachesHad.filter((n, i) => s.coachesHad.indexOf(n) === i).join("、") || "—" },
    { label: "感情", value: s.partner ? s.partner.name : "沒有在一起過" },
    { label: "學業", value: s.degree ? "大學畢業" : s.path === "college" ? "大學沒讀完" : "沒有去讀大學" },
    { label: "傷勢", value: s.majorInjuries.length ? s.majorInjuries.slice(0, 3).join("、") : "沒有留下重傷" },
    { label: "離開時的錢", value: money(s.money) },
    { label: "後來", value: post },
  ];
  if (remembered.length) {
    life.push({
      label: "記得",
      value: remembered
        .slice(0, 3)
        .map((m) => m.text.replace(/。$/, ""))
        .join("；"),
    });
  }

  const history = s.historyChanges.length
    ? s.historyChanges.slice(-8)
    : ["這一生沒有改寫大滿貫的冠軍名單。你沒有留下什麼驚人的紀錄，但這一生還是有它自己的成績。"];

  const headline =
    s.peakRank === 1
      ? "你變成了世界第一。"
      : s.titles.gs
        ? "你拿過大滿貫。"
        : label === "被浪費的天才"
          ? "你本來可以打得更好。"
          : label === "差一步的頂尖選手"
            ? "你差一步。"
            : "這是完整的一生。";

  return {
    label,
    headline,
    paragraphs,
    tennis,
    life,
    history,
    seed: s.seed,
  };
}
