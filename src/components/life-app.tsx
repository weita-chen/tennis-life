import { useEffect, useState } from "react";
import { wealthLabel } from "@/game/coaches";
import { randomName, randomSeed } from "@/game/create";
import {
  MENT_KEYS,
  PHYS_KEYS,
  STAT_LABEL,
  SURFACE_LABEL,
  TECH_KEYS,
  money,
  playingStyle,
  rankLabel,
  stageLabel,
} from "@/game/format";
import { act, choicesFor, hydrate, injuryWord, moodWord, startLife } from "@/game/year";
import type { Choice, GameState, StatKey } from "@/game/types";

const KEY = "tennis-life.v1";
const THEME_KEY = "tennis-life.theme";

const THEMES = [
  { id: "rg", label: "法網", court: "#bb5522", accent: "#02503b", ink: "#ffffff", onAccent: "#ffffff", dot: "#02503b" },
  { id: "us", label: "美網", court: "#0B1F8F", accent: "#FFD400", ink: "#ffffff", onAccent: "#0B1F8F", dot: "#FFD400" },
  { id: "wb", label: "溫網", court: "#046A38", accent: "#582C83", ink: "#ffffff", onAccent: "#ffffff", dot: "#582C83" },
  { id: "ao", label: "澳網", court: "#1E8FD5", accent: "#E1FF00", ink: "#ffffff", onAccent: "#10240a", dot: "#E1FF00" },
  { id: "night", label: "夜法", court: "#002957", accent: "#bb5522", ink: "#E0CD95", onAccent: "#ffffff", dot: "#bb5522" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

function loadLife(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GameState;
    if (!data?.seed || !data.card || !data.name) return null;
    return hydrate(data);
  } catch {
    return null;
  }
}

function saveLife(state: GameState | null) {
  if (!state) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(state));
}

function sentences(text: string): string[] {
  const parts = text
    .split(/(?<=。)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let part of parts) {
    const closer = part.match(/^[」』）]+/);
    if (closer && out.length) {
      out[out.length - 1] += closer[0];
      part = part.slice(closer[0].length).trim();
    }
    if (part) out.push(part);
  }
  return out;
}

export function LifeApp() {
  const [state, setState] = useState<GameState | null>(null);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [armReset, setArmReset] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("rg");
  const slam = THEMES.find((item) => item.id === theme) ?? THEMES[0];

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (THEMES.some((item) => item.id === savedTheme)) setTheme(savedTheme as ThemeId);
    const saved = loadLife();
    if (saved) setState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.slam = theme;
    localStorage.setItem(THEME_KEY, theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", slam.court);
  }, [theme, slam.court]);

  function begin(nextSeed?: string) {
    const life = startLife(name, nextSeed ?? seed);
    saveLife(life);
    setState(life);
    setArmReset(false);
  }

  function choose(id: string) {
    setState((prev) => {
      if (!prev) return prev;
      const next = act(prev, id);
      saveLife(next);
      return next;
    });
    setArmReset(false);
  }

  function replay(current: GameState) {
    const life = startLife(current.name, current.seed);
    saveLife(life);
    setName(current.name);
    setSeed(current.seed);
    setState(life);
    setArmReset(false);
  }

  function abandon() {
    saveLife(null);
    setState(null);
    setName("");
    setSeed("");
    setArmReset(false);
  }

  if (!state) {
    return (
      <section
        className="gate"
        data-theme={slam.id}
        style={{
          ["--slam-court" as string]: slam.court,
          ["--slam-accent" as string]: slam.accent,
          ["--slam-ink" as string]: slam.ink,
          ["--slam-on-accent" as string]: slam.onAccent,
        }}
      >
        <div className="gate-felt" aria-hidden="true" />
        <div className="gate-inner">
          <header className="gate-top">
            <p className="scoreboard">1992 · 臺灣</p>
            <div className="theme-bar" role="toolbar" aria-label="大滿貫配色">
              <ThemeBar theme={slam.id} onPick={setTheme} />
            </div>
          </header>
          <div className="gate-main">
            <h1 className="gate-title">《網球物語》</h1>
            <div className="gate-story">
              <p>西元 1992 年，臺灣。你第一次握住比手臂還重的網球拍，年僅 6 歲。</p>
              <p>12 歲之前，你的訓練表由父母與教練主宰。有人在豪門俱樂部打砸黃金，有人在破舊紅土場揮汗如雨。</p>
              <p>13 歲開始，握拍的手由你掌控。你要走上底線重砲防守，還是上網強勢壓迫？</p>
            </div>
            <form
              className="gate-form"
              onSubmit={(e) => {
                e.preventDefault();
                begin();
              }}
            >
              <label className="gate-label" htmlFor="player-name">
                球員姓名
              </label>
              <input
                id="player-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="留白會隨機骰一個名字"
                maxLength={12}
                className="gate-input"
              />
              <label className="gate-label" htmlFor="player-seed">
                命運種子
              </label>
              <input
                id="player-seed"
                value={seed}
                onChange={(e) => setSeed(e.target.value.toUpperCase())}
                placeholder="也可以交給老天"
                maxLength={12}
                className="gate-input"
                autoCapitalize="characters"
              />
              <div className="gate-actions">
                <button type="submit" className="gate-go">
                  踏上球場 (Start Career)
                </button>
                <button type="button" className="gate-ghost" onClick={() => setName(randomName(randomSeed(), name.trim()))}>
                  骰出姓名 (Random Name)
                </button>
              </div>
            </form>
          </div>
          <p className="gate-foot">「實力可以苦練，但天賦……只有站上賽場才知道！」</p>
        </div>
      </section>
    );
  }

  const choices = choicesFor(state);
  const hurt = injuryWord(state);

  return (
    <div className="life-shell min-h-dvh bg-paper text-ink">
      <div className="gate-felt" aria-hidden="true" />
      <div className="life-top">
        <div className="theme-bar" role="toolbar" aria-label="大滿貫配色">
          <ThemeBar theme={slam.id} onPick={setTheme} />
        </div>
      </div>
      <div className="life-grid mx-auto grid max-w-6xl md:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="order-2 border-line bg-court text-cream md:order-1 md:min-h-dvh md:border-r">
          <div className="px-5 py-6 md:sticky md:top-0 md:px-6 md:py-8">
            <div className="flex items-center gap-3">
              <img src="/favicon.svg" alt="" width={28} height={28} />
              <p className="text-sm tracking-widest text-ball">網球物語</p>
            </div>
            <h1 className="mt-4 font-display text-4xl leading-none">{state.name}</h1>
            <p className="mt-3 text-sm text-ball">
              {state.year} · {state.age} 歲 · {stageLabel(state)}
            </p>
            <p className="mt-4 font-display text-2xl">{rankLabel(state)}</p>
            <dl className="mt-6 space-y-3 text-sm">
              <Row k="狀態" v={moodWord(state.motivation)} />
              <Row k="身體" v={hurt ?? "健康"} />
              <Row k="教練" v={state.coach.name} />
              <Row k="家境" v={wealthLabel(state.wealth)} />
              <Row k="存款" v={money(state.money)} />
              {state.sponsor ? <Row k="贊助" v={state.sponsor.brand} /> : null}
              {state.partner ? <Row k="對象" v={state.partner.name} /> : null}
              {state.rivals?.[0] ? <Row k="對手" v={state.rivals[0].name} /> : null}
              <Row k="勝－敗" v={`${state.wins}–${state.losses}`} />
            </dl>
            {state.memories?.length ? (
              <details className="mt-6">
                <summary className="text-sm text-ball">還記得</summary>
                <ul className="mt-3 space-y-2 text-sm">
                  {state.memories.map((m) => (
                    <li key={m.id}>
                      {m.age} 歲 · {m.text}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {state.titles.gs + state.titles.m1000 + state.titles.atp > 0 ? (
              <p className="mt-4 text-sm text-ball">
                大滿貫 {state.titles.gs} · 大師賽 {state.titles.m1000} · ATP {state.titles.atp}
              </p>
            ) : null}
            <details className="mt-6">
              <summary className="text-sm text-ball">能力</summary>
              <div className="mt-4 space-y-4">
                <StatGroup title="技術" keys={TECH_KEYS} stats={state.stats} />
                <StatGroup title="身體" keys={PHYS_KEYS} stats={state.stats} />
                <StatGroup title="頭腦" keys={MENT_KEYS} stats={state.stats} />
                <StatGroup title="經驗" keys={["experience"] as const} stats={state.stats} />
              </div>
            </details>
            {state.phaseInYear !== "ending" ? (
              <button
                type="button"
                className="mt-8 text-left text-sm text-ball underline-offset-4 hover:underline"
                onClick={() => (armReset ? abandon() : setArmReset(true))}
              >
                {armReset ? "再按一次，這一生會清掉" : "先離開"}
              </button>
            ) : null}
          </div>
        </aside>

        <main className="order-1 px-5 py-8 md:order-2 md:px-12 md:py-12">
          <div className="mb-6 flex items-baseline justify-between gap-4 md:hidden">
            <p className="text-xl">{state.name}</p>
            <p className="text-sm text-muted">{rankLabel(state)}</p>
          </div>
          <article
            key={`${state.year}-${state.age}-${state.phaseInYear}-${state.card.kind}-${state.card.kind === "story" ? state.card.title : ""}-${state.card.kind === "story" ? (state.card.receipt?.choice ?? "") : ""}`}
            className="card-in max-w-2xl"
          >
            {state.card.kind === "story" ? <StoryBody card={state.card} /> : null}
            {state.card.kind === "season" ? <SeasonBody state={state} /> : null}
            {state.card.kind === "summary" ? <SummaryBody state={state} /> : null}
            {state.card.kind === "ending" ? (
              <EndingBody state={state} onNew={abandon} onReplay={() => replay(state)} />
            ) : null}
            {choices.length ? (
              <ul className="mt-10 border-t border-line">
                {choices.map((choice) => (
                  <li key={choice.id}>
                    <ChoiceButton choice={choice} onPick={() => choose(choice.id)} />
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </main>
      </div>
    </div>
  );
}

function ThemeBar({ theme, onPick }: { theme: ThemeId; onPick: (id: ThemeId) => void }) {
  return (
    <>
      {THEMES.map((item) => (
        <button
          key={item.id}
          type="button"
          className="theme-pill"
          aria-pressed={item.id === theme}
          onClick={() => onPick(item.id)}
        >
          <span className="theme-dot" style={{ background: item.dot }} />
          {item.label}
        </button>
      ))}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-court-2 pb-2">
      <dt className="text-ball">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function StatGroup({
  title,
  keys,
  stats,
}: {
  title: string;
  keys: readonly StatKey[];
  stats: GameState["stats"];
}) {
  return (
    <div>
      <p className="text-xs tracking-widest text-ball">{title}</p>
      <ul className="mt-2 space-y-2">
        {keys.map((key) => (
          <li key={key}>
            <div className="flex justify-between text-xs">
              <span>{STAT_LABEL[key]}</span>
              <span className="tabular-nums">{stats[key]}</span>
            </div>
            <div className="mt-1 h-1 bg-court-2">
              <div className="h-1 bg-ball" style={{ width: `${stats[key]}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StoryBody({ card }: { card: Extract<GameState["card"], { kind: "story" }> }) {
  return (
    <div>
      <p className="text-sm tracking-widest text-clay">{card.kicker}</p>
      <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">{card.title}</h2>
      <div className="mt-6">
        {sentences(card.body).map((line) => (
          <p key={line} className="mt-3 text-lg leading-relaxed">
            {line}
          </p>
        ))}
      </div>
      {card.receipt ? <ReceiptBlock receipt={card.receipt} /> : null}
    </div>
  );
}

function ReceiptBlock({ receipt }: { receipt: NonNullable<Extract<GameState["card"], { kind: "story" }>["receipt"]> }) {
  return (
    <div className="mt-8 border border-line bg-paper-deep px-4 py-4">
      <p className="text-sm tracking-widest text-clay">你選了</p>
      <p className="mt-1 text-lg">{receipt.choice}</p>
      <p className="mt-4 text-sm tracking-widest text-muted">立刻</p>
      <ul className="mt-2 space-y-1">
        {receipt.now.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {receipt.later ? (
        <>
          <p className="mt-4 text-sm tracking-widest text-muted">你還不知道的事</p>
          <p className="mt-2 leading-relaxed">{receipt.later}</p>
        </>
      ) : null}
    </div>
  );
}

function SeasonBody({ state }: { state: GameState }) {
  if (state.card.kind !== "season") return null;
  const report = state.card.report;
  return (
    <div>
      <p className="text-sm tracking-widest text-clay">
        {state.year} 賽季 · {state.focusLabel}
      </p>
      <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
        {report.quiet ? "今年沒比賽" : "打完了"}
      </h2>
      {state.flash ? <p className="mt-4 text-sm text-muted">{state.flash}</p> : null}
      {report.injuryNote ? <p className="mt-4 leading-relaxed text-clay">{report.injuryNote}</p> : null}
      {report.quiet ? (
        <p className="mt-6 text-lg leading-relaxed">這一年你沒有打正式比賽。</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {report.results.map((result) => (
            <li key={result.id}>
              <details className="group py-3">
                <summary className="flex items-baseline justify-between gap-4">
                  <span>
                    <span className="text-lg">{result.name}</span>
                    <span className="ml-2 text-sm text-muted">{SURFACE_LABEL[result.surface]}</span>
                  </span>
                  <span className={result.outcome === "冠軍" ? "text-clay" : "text-ink"}>{result.outcome}</span>
                </summary>
                <ul className="mt-2 space-y-1 pb-2 text-sm text-muted">
                  {result.matches.map((match, index) => (
                    <li key={`${result.id}-${index}`} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {match.round} · {match.opponent}
                        {match.oppRank ? `（${match.oppRank}）` : ""}
                        {match.legend ? " · 名將" : ""}
                      </span>
                      <span className="tabular-nums">
                        {match.won ? "勝" : "負"} {match.score}
                      </span>
                    </li>
                  ))}
                  {result.prize > 0 ? <li>獎金 {money(result.prize)}</li> : null}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryBody({ state }: { state: GameState }) {
  if (state.card.kind !== "summary") return null;
  const summary = state.card.summary;
  return (
    <div>
      <p className="font-display text-6xl tabular-nums leading-none text-court">{summary.year}</p>
      <p className="mt-3 text-sm tracking-widest text-clay">
        {summary.age} 歲 · {summary.rankLabel}
      </p>
      <div className="mt-6">
        {sentences(summary.story).map((line) => (
          <p key={line} className="mt-3 text-lg leading-relaxed">
            {line}
          </p>
        ))}
      </div>
      <ul className="mt-6 space-y-2">
        {summary.highlights.map((line) => (
          <li key={line} className="border-l-2 border-ball pl-3 leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
      {summary.development.length ? (
        <p className="mt-6 text-sm text-muted">{summary.development.join(" · ")}</p>
      ) : (
        <p className="mt-6 text-sm text-muted">能力沒有明顯變化。</p>
      )}
      {summary.prize > 0 || summary.sponsorPay > 0 ? (
        <p className="mt-2 text-sm text-muted">
          {summary.prize > 0 ? `獎金 ${money(summary.prize)}` : ""}
          {summary.prize > 0 && summary.sponsorPay > 0 ? " · " : ""}
          {summary.sponsorPay > 0 ? `贊助 ${money(summary.sponsorPay)}` : ""}
        </p>
      ) : null}
      <p className="mt-6 leading-relaxed">{summary.next}</p>
      <p className="mt-8 text-sm leading-relaxed text-muted">這一年的大滿貫 · {summary.worldNews}</p>
    </div>
  );
}

function EndingBody({
  state,
  onNew,
  onReplay,
}: {
  state: GameState;
  onNew: () => void;
  onReplay: () => void;
}) {
  if (state.card.kind !== "ending") return null;
  const ending = state.card.ending;
  return (
    <div>
      <p className="text-sm tracking-widest text-clay">{ending.label}</p>
      <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">{ending.headline}</h2>
      <p className="mt-2 text-sm text-muted">
        {state.name} · {state.age} 歲停下來 · 種子 {ending.seed}
      </p>
      <div className="mt-6">
        {ending.paragraphs.map((p) => (
          <p key={p.slice(0, 24)} className="mt-4 text-lg leading-relaxed">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <FactList title="網球" rows={ending.tennis} />
        <FactList title="生活" rows={ending.life} />
      </div>
      <div className="mt-10">
        <p className="text-sm tracking-widest text-clay">留下的紀錄</p>
        <ul className="mt-3 space-y-2">
          {ending.history.map((line) => (
            <li key={line} className="leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      </div>
      {state.decisions.length ? (
        <details className="mt-8">
          <summary className="text-sm tracking-widest text-clay">做過的選擇</summary>
          <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
            {state.decisions
              .filter(
                (d) =>
                  !d.choiceId.startsWith("child-year") &&
                  !d.choiceId.startsWith("child-focus") &&
                  !d.choiceId.startsWith("unhandled"),
              )
              .map((d, index) => (
                <li key={`${d.choiceId}-${index}`} className="text-sm leading-relaxed">
                  {d.age} 歲 · {d.text}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
      {state.gsResults.length ? (
        <p className="mt-6 text-sm leading-relaxed text-muted">{state.gsResults.slice(-6).join(" · ")}</p>
      ) : null}
      <p className="mt-6 text-sm text-muted">後來別人這樣形容你的打法：{playingStyle(state.stats)}</p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <button type="button" className="min-h-11 bg-court px-5 py-3 text-cream" onClick={onReplay}>
          用同一個種子再來一次
        </button>
        <button type="button" className="min-h-11 border border-line px-5 py-3" onClick={onNew}>
          換一個人
        </button>
      </div>
    </div>
  );
}

function FactList({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div>
      <p className="text-sm tracking-widest text-clay">{title}</p>
      <dl className="mt-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm">
            <dt className="text-muted">{row.label}</dt>
            <dd className="text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ChoiceButton({ choice, onPick }: { choice: Choice; onPick: () => void }) {
  const tone =
    choice.tone === "risk" || choice.tone === "exit" ? "text-clay" : choice.tone === "quiet" ? "text-muted" : "text-ink";
  return (
    <button type="button" onClick={onPick} className="w-full min-h-11 border-b border-line py-4 text-left">
      <span className={`block text-lg ${tone}`}>{choice.label}</span>
      <span className="mt-1 block text-sm leading-relaxed text-muted">{choice.hint}</span>
    </button>
  );
}
