// ============================================================================
// Guldrushen – SKATTKAMMAREN (#565, designspec §6.3): projektorns huvudvy
// (views-posten "skattkammaren", finale: true – vyn spelar själv pallen).
//   Överst   stor timer (matchens serverklocka) + "Tillsammans: 2 140 guld"
//   Mitten   topp 10 som avatarer vid sina guldhögar (gr-hogar)
//   Kanten   händelseflödet (gr-flode) – senaste händelserna glider in/tonar ut
//   Banderoll  stora händelser (Skattkammare, Byte, ledningsbyte) i luften
//            mellan timern och högarna – döljer aldrig timer eller högar,
//            köade (en i taget, ihopslagna, för gamla hoppas över)
//   Final    pallplatsen EN gång (gr-pall), sedan resultatskärmen
//
// Händelserna kommer från servern (grEvents) via den gemensamma regin (#571:
// live-events → animationskö → reaktioner/banderoll/ljudkö). Vyn räknar inte
// själv ut vad som hänt. Regin startar först när BÅDE guldet och händelserna
// kommit (gr-koppling ready): första sync = baslinje, så en omladdning visar
// direkt rätt guld och spelar aldrig upp gamla händelser (§9, designtest 10).
// Guld/ordning ritas alltid direkt ur grPlayers – aldrig via kön.
//
// API: createSkattkammare(host, { st, sound, screen, deps }) → { update(st), destroy() }
// ============================================================================

import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { createLiveRegi } from "../../design/live-regi.js";
import { createBanner } from "../../design/live-banner.js";
import { sessionRewards, placementPrize } from "../../live-rewards.js";
import { toMs } from "../../live-time.js";
import { createGoldCounter } from "./gr-guld.js";
import { createGrKoppling, avatarRoster } from "./gr-koppling.js";
import { ensureGrottaCss, grottaHtml, logoHtml } from "./gr-grotta.js";
import { createHogar } from "./gr-hogar.js";
import { createFlode } from "./gr-flode.js";
import { createFinal } from "./gr-pall.js";
import {
  matchClock, topPiles, createPileScale, feedItem, podiumGroups, classTitle, togetherText,
} from "./gr-proj-scen.js";

const TICK_MS = 200;
const IGNORE = new Set(["join", "answered", "correct", "wrong", "rank", "leader"]);

export function createSkattkammare(host, { st, sound = null, screen = false, deps = null }) {
  ensureGrottaCss();
  const s0 = st.session;
  const sid = st.sessionId || s0?.id;
  const root = document.createElement("div");
  root.className = "gr grk";
  root.classList.toggle("gr-skarm", !!screen);
  root.innerHTML = `${grottaHtml({ variant: "kammare" })}
    <header class="grk-topp">
      ${logoHtml({ size: "liten" })}
      <div class="grk-klocka" role="timer" aria-label="Tid kvar"><b data-klocka>00:00</b></div>
      <div class="grk-tills"><span>Tillsammans</span><b><i data-tills>0</i> guld</b></div>
    </header>
    <div class="grk-luft"></div>
    <main class="grk-golv"><p class="grk-tom" hidden>⛏️ Första guldet hittas snart …</p></main>
    <div class="grk-kant"></div>`;
  host.replaceChildren(root);
  const $ = (q) => root.querySelector(q);

  let cur = st;
  let dead = false;
  let finalDone = false;
  let lastSec = null;
  const prevGold = new Map();
  const scale = createPileScale();

  const roster = avatarRoster(sid, deps);
  roster.prefetch(s0?.participatingClassIds || []);
  const pool = createAvatarPool({ roster });
  const tills = createGoldCounter($("[data-tills]"));
  const banner = createBanner($(".grk-luft"));
  const hogar = createHogar($(".grk-golv"), { pool });
  const flode = createFlode($(".grk-kant"), { pool });
  const final = createFinal(root, { pool, sound });
  const koppling = createGrKoppling({ sid, deps, onChange: () => render(), say: (t) => console.warn("Guldrushen:", t) });
  const names = () => cur.session?.showNames !== false;

  // Serverhändelse → flödet direkt (information) + ljud + reaktioner + ev. banderoll (kön).
  function mapEvent(evt) {
    if (evt.type !== "server") return IGNORE.has(evt.type) ? [] : undefined;
    const item = feedItem({ ...evt, type: evt.serverType }, { names: names() });
    flode.add([item]);
    const jobs = item.reactions.filter((r) => hogar.has(r.uid)).map((r) => ({ kind: "reaction", uid: r.uid, reaction: r.reaction }));
    if (item.banner) {
      const key = item.type === "lead" ? "lead" : item.type === "swap" ? "swap" : "skattkammare";
      return [{
        kind: "banner",
        mergeKey: key,
        banner: item.banner,
        cue: item.cue,
        // Ledningsbyte: bara den senaste ledaren är sann. Skattkammare/byte: räkna upp.
        merge: key === "lead" ? (a, b) => b : undefined,
        bannerMany: (job) => ({ ...job.banner, sub: `${job.count} på en gång!` }),
        then: jobs,
      }];
    }
    if (item.cue) sound?.cue?.(item.cue);
    return jobs;
  }

  const regi = createLiveRegi({
    sessionId: sid,
    pool,
    banner,
    sound,
    map: mapEvent,
    playFinal: (job, signal) => final.play(finalData(), signal).then(() => { finalDone = true; }),
  });

  function finalData() {
    const sess = cur.session;
    const standing = koppling.standings(cur);
    const rw = sessionRewards(sess);
    const res = cur.result?.rewards || null;
    return {
      groups: podiumGroups(standing.players),
      title: `🏆 Guldrushen ${classTitle(sess)} – skattjägarnas final!`,
      together: standing.totalGold > 0 ? togetherText(sess, standing.totalGold) : "",
      everyone: standing.players.map((p) => p.uid),
      prize: (rank) => {
        const p = res ? Object.values(res).find((r) => r.rank === rank) : null;
        return p ? p.prize : rw ? placementPrize(rw.firstPrize, rank) : 0;
      },
    };
  }

  let resultKey = "";
  function showResultIfChanged() {
    const d = finalData();
    const k = JSON.stringify([d.groups.map((g) => [g.rank, g.players.map((p) => [p.uid, p.gold, p.name])]), d.together, [1, 2, 3].map(d.prize), d.everyone]);
    if (k === resultKey) return;
    resultKey = k;
    final.showResult(d);
  }

  function render() {
    if (dead) return;
    const s = cur.session;
    if (!s) return;
    const now = koppling.now();
    const clock = matchClock(s, now);
    const finished = cur.phase === "finished";
    root.classList.toggle("grk-final", finished);

    // Klockan: sista 10 s röd puls + tick varje sekund.
    const kl = $("[data-klocka]");
    if (kl.textContent !== clock.text) kl.textContent = clock.text;
    $(".grk-klocka").classList.toggle("grk-spanning", clock.tension);
    if (clock.tension && clock.secs !== lastSec && lastSec !== null && clock.secs > 0) sound?.cue?.("tick");
    lastSec = clock.phase === "live" ? clock.secs : null;

    if (!koppling.ready) return;
    const standing = koppling.standings(cur);
    tills.sync(standing.totalGold);

    // Topp 10 vid guldhögarna – direkt ur guldet.
    const top = topPiles(standing.players);
    hogar.update(top, { ref: scale.ref(top[0]?.gold || 0) });
    for (const p of top) {
      const before = prevGold.get(p.uid);
      if (before != null && p.gold > before) hogar.bump(p.uid);
    }
    prevGold.clear();
    for (const p of standing.players) prevGold.set(p.uid, p.gold);
    $(".grk-tom").hidden = top.length > 0 || finished;

    roster.ensure(cur.players || []);
    regi.sync({
      phase: finished ? "finished" : cur.phase === "lobby" ? "lobby" : "live",
      players: standing.players.map((p) => ({ uid: p.uid, name: p.name })),
      ranks: {},
      events: koppling.events,
      finishedAt: toMs(s.finishedAt),
      now,
    });

    // Efter slutet: resultatet direkt (omladdning) eller när finalen spelats klart.
    if (finished && (!regi.queue.finalStarted() || finalDone)) showResultIfChanged();
  }

  const iv = setInterval(render, TICK_MS);
  render();

  return {
    update(next) {
      cur = next;
      render();
    },
    destroy() {
      dead = true;
      clearInterval(iv);
      regi.destroy();
      koppling.destroy();
      tills.destroy();
      banner.destroy();
      hogar.destroy();
      flode.destroy();
      final.destroy();
      pool.destroy();
      root.remove();
    },
  };
}
