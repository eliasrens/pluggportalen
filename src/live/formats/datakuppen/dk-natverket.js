// ============================================================================
// Datakuppen – NÄTVERKET (#654, spec §0.2, §4.2): projektorns huvudvy
// (views-posten "natverket", finale: true – vyn spelar pallen). Guldrushens
// Skattkammare (layout och logik ur kistspelsmodulen #651) med ny grafik:
//   Överst   FREDAD rad: logga · stor timer · totalrutan "Tillsammans 2 140
//            MB" med förloppsmätare mot nästa milstolpe (dk-totalruta). En
//            milstolpe firas I RUTAN (puls, mätare, datakonfetti av ettor
//            och nollor) – aldrig som notis över timern. Ingen banderoll.
//   Golvet   topp 10 som avatarer vid egna serverskåp (dk-servrar) – lysdioderna
//            tänds när datan växer; läsordning 1–5 överst, 6–10 underst
//   Kanten   terminalen (dk-terminal) – monospace, högst 4 rader, en rad per
//            händelse ("> Omar hackade Leo: +45 MB"; namn av → "Någon")
//   Hack     en ljuslinje ≈ 1 s längs en kretsbana mellan servrarna (dk-
//            hacklinje) – inne i golvet, UNDER platserna och skyltarna, så
//            den skymmer aldrig timer, topplista eller text
//   Dekor    noder/paket/robotar som hamnar bakom text, namn eller avatarer
//            döljs (dk-natverk createDekorVakt)
//   Final    pallplatsen EN gång (dk-pall), sedan resultatskärmen med
//            totalraden och ett säkerhetstips
//
// Händelserna kommer från servern (dkEvents) via den gemensamma regin (#571).
// Vyn räknar inte själv ut vad som hänt. Regin startar först när BÅDE datan
// och händelserna kommit (dk-koppling ready): första sync = baslinje, så en
// omladdning visar direkt rätt data och spelar aldrig upp gamla händelser.
// Data och ordning ritas alltid direkt ur dkPlayers – aldrig via kön.
//
// API: createNatverket(host, { st, sound, screen, deps }) → { update(st), destroy() }
// ============================================================================

import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { createLiveRegi } from "../../design/live-regi.js";
import { prefersReducedMotion } from "../../design/live-reactions.js";
import { sessionRewards, placementPrize } from "../../live-rewards.js";
import { toMs } from "../../live-time.js";
import { createDkKoppling, avatarRoster } from "./dk-koppling.js";
import { ensureNatverkCss, natverkHtml, logoHtml, createDekorVakt } from "./dk-natverk.js";
import { createServrar } from "./dk-servrar.js";
import { createTerminal } from "./dk-terminal.js";
import { createHacklinje } from "./dk-hacklinje.js";
import { createFinal } from "./dk-pall.js";
import { createTotalruta, TOTALRUTA_HTML } from "./dk-totalruta.js";
import {
  matchClock, topPiles, createPileScale, isProtected, feedItem, hackLink,
  podiumGroups, togetherHtml, FINAL_TITLE, tal,
} from "./dk-proj-scen.js";

const TICK_MS = 200;
const IGNORE = new Set(["join", "answered", "correct", "wrong", "rank", "leader"]);

// "Tillsammans": första värdet direkt (omladdning visar rätt data), sedan räknar siffran mjukt dit.
function createTills(el) {
  let shown = null;
  let raf = 0;
  return {
    sync(total) {
      if (shown === null || prefersReducedMotion()) {
        shown = total;
        el.textContent = tal(total);
        return;
      }
      if (total === shown) return;
      cancelAnimationFrame(raf);
      const from = shown;
      const t0 = performance.now();
      const step = (t) => {
        const x = Math.min(1, (t - t0) / 600);
        shown = x >= 1 ? total : Math.round(from + (total - from) * (1 - (1 - x) ** 3));
        el.textContent = tal(shown);
        if (x < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    },
    destroy() { cancelAnimationFrame(raf); },
  };
}

export function createNatverket(host, { st, sound = null, screen = false, deps = null }) {
  ensureNatverkCss();
  const s0 = st.session;
  const sid = st.sessionId || s0?.id;
  const root = document.createElement("div");
  root.className = "dkn dknv";
  root.classList.toggle("dkn-skarm", !!screen);
  root.innerHTML = `${natverkHtml({ variant: "natverk" })}
    <header class="dknv-topp">
      ${logoHtml({ size: "liten" })}
      <div class="dknv-klocka" role="timer" aria-label="Tid kvar"><b data-klocka>00:00</b></div>
      <div class="dknv-tills">${TOTALRUTA_HTML}</div>
    </header>
    <main class="dknv-golv"><p class="dknv-tom" hidden>&gt; Nätverket startar – första filen laddas snart …</p></main>
    <div class="dknv-kant"></div>`;
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
  const koppling = createDkKoppling({ sid, deps, onChange: () => render(), say: (t) => console.warn("Datakuppen:", t) });
  const tills = createTills($("[data-tills]"));
  const totalruta = createTotalruta($(".dknv-tills"), { sound });
  const golv = $(".dknv-golv");
  const servrar = createServrar(golv, { pool });
  const linje = createHacklinje(golv, {
    point: (uid) => servrar.rackPoint(uid, golv),
    lift: () => parseFloat(getComputedStyle(servrar.el).getPropertyValue("--dkns-fig")) * 1.05,
  });
  const terminal = createTerminal($(".dknv-kant"), { pool });
  const final = createFinal(root, { pool, sound, now: () => koppling.now() });
  // Dekor får aldrig ligga bakom text, namn eller avatarer: den översta
  // raden, terminalens ruta och alla tio serverplatser.
  const vakt = createDekorVakt(root, () => [
    ...[...root.querySelectorAll(".dknv-topp > *, .dknf, .dknv-tom:not([hidden]), .dknp-rubrik, .dknp-steg, .dknp-tillsammans, .dknp-tips, .dknp-folk")]
      .map((el) => el.getBoundingClientRect()),
    ...servrar.areas(),
  ]);
  const names = () => cur.session?.showNames !== false;

  // Serverhändelse → terminalen direkt + ljud + reaktioner vid servrarna +
  // hack-linjen (lyckat hack).
  function mapEvent(evt) {
    if (evt.type !== "server") return IGNORE.has(evt.type) ? [] : undefined;
    const ev = { ...evt, type: evt.serverType };
    const item = feedItem(ev, { names: names() });
    if (!item) return [];
    terminal.add([item]);
    const link = hackLink(ev);
    if (link) linje.play(link.from, link.to);
    if (item.cue) sound?.cue?.(item.cue);
    return item.reactions.filter((r) => servrar.has(r.uid)).map((r) => ({ kind: "reaction", uid: r.uid, reaction: r.reaction }));
  }

  const regi = createLiveRegi({
    sessionId: sid,
    pool,
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
      title: FINAL_TITLE,
      together: standing.totalGold > 0 ? togetherHtml(standing.totalGold) : "",
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
    root.classList.toggle("dknv-final", finished);

    // Klockan: sista 10 s varm färg + mjuk puls + tick varje sekund.
    const kl = $("[data-klocka]");
    if (kl.textContent !== clock.text) kl.textContent = clock.text;
    $(".dknv-klocka").classList.toggle("dknv-spanning", clock.tension);
    if (clock.tension && clock.secs !== lastSec && lastSec !== null && clock.secs > 0) sound?.cue?.("tick");
    lastSec = clock.phase === "live" ? clock.secs : null;

    if (!koppling.ready) return;
    const standing = koppling.standings(cur);
    tills.sync(standing.totalGold);
    // Milstolpe: firas i totalrutan (bara uppåt, bara under spelet; första
    // värdet = baslinje, så en omladdning firar inga gamla milstolpar).
    totalruta.sync(standing.totalGold, { celebrate: !finished });

    // Topp 10 vid servrarna – direkt ur datan.
    const top = topPiles(standing.players).map((p) => ({ ...p, prot: isProtected(p, now) }));
    servrar.update(top, { ref: scale.ref(top[0]?.gold || 0), leader: standing.winnerId });
    for (const p of top) {
      const before = prevGold.get(p.uid);
      if (before != null && p.gold > before) servrar.bump(p.uid);
    }
    prevGold.clear();
    for (const p of standing.players) prevGold.set(p.uid, p.gold);
    $(".dknv-tom").hidden = top.length > 0 || finished;

    roster.ensure(cur.players || []);
    regi.sync({
      phase: finished ? "finished" : cur.phase === "lobby" ? "lobby" : "live",
      players: standing.players.map((p) => ({ uid: p.uid, name: p.name })),
      ranks: {},
      // dkEvents kommer nyast först – regin spelar dem i den ordning de hände.
      events: [...koppling.events].reverse(),
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
      vakt.destroy();
      koppling.destroy();
      tills.destroy();
      totalruta.destroy();
      linje.destroy();
      servrar.destroy();
      terminal.destroy();
      final.destroy();
      pool.destroy();
      root.remove();
    },
  };
}
