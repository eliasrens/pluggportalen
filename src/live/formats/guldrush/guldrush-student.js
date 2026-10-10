// ============================================================================
// Guldrushen 💰 – elevens skärm (#564, funktionsspec §6.1, §6.4, §6.7, §6.9,
// §7.2.4, designspec §6.4–6.6). Laddas LATT av page-elev-live.js via
// GULDRUSH.studentView(). Kärnan äger lobby, 3-2-1-KÖR!, närvaro/puls, sen
// anslutning (går med automatiskt → 0 guld, börja direkt) och slutskärmens
// ram; formatet äger spelytan (createStage) – eleven spelar i egen takt och
// varje rätt svar ger kistor via servern.
//
// Layout (Chromebook 1366×768 först, allt utan scroll):
//   överst   eget guld stort och glänsande + läget ("20 guld bakom Alma" –
//            ingen placering som nummer, se gr-elev.js) + ljudknapp + avatar
//            i hörnet som reagerar (Glad, Jubel, Aj, Skyddad)
//   mitten   fråga + svarsfält/alternativ (gr-fraga.js) ELLER de tre kistorna
//            (gr-kistor.js) ELLER offerväljaren (gr-offer.js)
//   notis    "🦝 Leo knyckte 20 guld från dig!" glider in från kanten ~2 s,
//            blockerar aldrig (pointer-events: none)
// Guldet kommer ur grPlayers (servern). Under en kistöppning hålls siffran
// tills locket öppnas, sedan räknas den upp.
// Omladdning: en oöppnad kista (attemptId i localStorage, svaret läses EN gång)
// visas igen; en väntande stöld/byte (grPlayers.pending) öppnar offerväljaren.
// Ljud: diskret kistljud AV som standard (designspec §8, gr-ljud.js).
// Stilar: guldrush-elev.css (egen fil).
//
// API (studentView-kontraktet, live-formats.js)
//   lobbyHtml(s)  joinedText  endHtml(st, player)
//   createStage({ view, host, uid, classId, session, mode, answerKind })
//     → { update(st, player), destroy() }
// ============================================================================

import { renderTopbar } from "../../../ui.js";
import { invalidateStudentData } from "../../../data.js";
import { ensureLiveCss } from "../../live-css.js";
import { serverNow } from "../../live-clock.js";
import { myReward } from "../../live-rewards.js";
import { createAvatarRoster } from "../../design/live-avatars.js";
import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { react, setAvatarState, prefersReducedMotion } from "../../design/live-reactions.js";
import { goldStanding, standingText, createHitWatcher, endStanding, stageAction, chestKey } from "./gr-elev.js";
import { isProtected, toMs } from "./delat/guldrush-regler.js";
import { createQuestionFlow } from "./gr-fraga.js";
import { playChests } from "./gr-kistor.js";
import { pickVictim } from "./gr-offer.js";
import { createChestSound } from "./gr-ljud.js";
import { createGoldCounter } from "./gr-guld.js";
import { createNotice } from "./gr-notis.js";
import * as gr from "./guldrush-data.js";

export { joinedText, lobbyHtml, endHtml } from "./gr-skarmar.js";

const CSS = "src/live/formats/guldrush/guldrush-elev.css";
// Läge i mitten → delen som syns.
const PART_OF = { laddar: "vanta", fraga: "svar", kistor: "kistor", offer: "offer", slut: null };

export function createStage({ view, host, uid, classId, session, mode, answerKind }) {
  ensureLiveCss([CSS]);
  view.classList.add("gr-elev-vy");
  const sid = session.id;
  const reduced = prefersReducedMotion();
  host.innerHTML = `<div class="gr-elev">
      <div class="gr-topp">
        <div class="gr-guld-ruta" aria-live="polite"><span class="gr-guld-mynt" aria-hidden="true"></span>
          <span class="gr-guld-pos"><b class="gr-guld">0</b></span><span class="gr-guld-enh">guld</span></div>
        <div class="gr-info"><p class="gr-lage"></p><p class="gr-skydd" hidden></p></div>
        <button type="button" class="gr-ljud" aria-pressed="false"></button>
        <span class="gr-horn"></span>
      </div>
      <p class="gr-felrad" role="alert" hidden></p>
      <div class="gr-mitt">
        <div class="gr-svar"></div>
        <div class="gr-kistor" hidden></div>
        <div class="gr-offer" hidden></div>
        <p class="gr-vanta" hidden>⏳ Hämtar …</p>
      </div>
      <div class="gr-notis" role="status" aria-live="polite" hidden></div>
    </div>`;
  const $ = (s) => host.querySelector(s);
  const root = $(".gr-elev");
  const goldEl = $(".gr-guld");
  const parts = { svar: $(".gr-svar"), kistor: $(".gr-kistor"), offer: $(".gr-offer"), vanta: $(".gr-vanta") };

  const roster = createAvatarRoster();
  const pool = createAvatarPool({ roster });
  roster.ensure([{ uid, classId }]).catch(() => {});
  const me = pool.el(uid);
  me.classList.add("vantar");

  const sound = createChestSound();
  const ljud = $(".gr-ljud");
  const drawLjud = () => {
    ljud.textContent = sound.on ? "🔊" : "🔇";
    ljud.setAttribute("aria-pressed", String(sound.on));
    ljud.setAttribute("aria-label", sound.on ? "Kistljud på – stäng av" : "Kistljud av – slå på");
    ljud.title = sound.on ? "Kistljud på" : "Kistljud av";
  };
  ljud.addEventListener("click", () => { sound.toggle(); drawLjud(); });
  drawLjud();

  let st = null;
  let player = null;
  let destroyed = false;
  let grPlayers = [];
  let mine = null; // mitt grPlayers-dokument
  let gotPlayers = false;
  let unsubPlayers = null;
  let retryT = 0;
  let quizQs = [];
  let ready = false; // omladdningskontrollen klar
  let starting = false;
  let mode_ = "laddar"; // "laddar" | "fraga" | "kistor" | "offer" | "slut"
  let chests = null;
  let offer = null;
  let offerChosen = false;
  let coinTimers = null;
  let reacted = "";
  const hits = createHitWatcher();

  const gold = createGoldCounter(goldEl, { reduced });
  let protT = 0;
  const notis = createNotice($(".gr-notis"), { pool, roster });

  function drawTop() {
    gold.sync(mine?.gold);
    const { rel } = goldStanding(grPlayers, uid);
    const lage = standingText(rel) || (gotPlayers ? "Svara rätt – öppna en kista! 🗝️" : "");
    $(".gr-lage").textContent = lage;
    const skydd = $(".gr-skydd");
    const prot = isProtected(mine, serverNow());
    skydd.hidden = !(mine?.shield || prot);
    // Stöldskyddet tar slut av sig självt – rita om då.
    clearTimeout(protT);
    if (prot) protT = setTimeout(drawTop, toMs(mine.protectedUntil) - serverNow() + 100);
    skydd.textContent = mine?.shield ? "🛡️ Sköld – stoppar nästa stöld" : "🛡️ Stöldskydd en liten stund";
    setAvatarState(me, "skyddad", !!mine?.shield);
  }

  // --- Lägen i mitten -----------------------------------------------------------
  function show(lage) {
    mode_ = lage;
    for (const [k, el] of Object.entries(parts)) el.hidden = k !== PART_OF[lage];
    root.dataset.lage = lage;
  }
  let problemT = 0;
  function problem(msg) {
    const f = $(".gr-felrad");
    f.textContent = msg ? `😕 ${msg}` : "";
    f.hidden = !msg;
    clearTimeout(problemT);
    if (msg) problemT = setTimeout(() => { f.hidden = true; }, 3500);
  }
  const over = () => destroyed || stageAction(st?.phase) !== "spel";

  const flow = createQuestionFlow(parts.svar, {
    mode, answerKind,
    questions: () => quizQs,
    send: (payload) => gr.answer({ sid, ...payload }),
    onCorrect: ({ attemptId, answerP }) => startChests(attemptId, answerP),
    onProblem: (err) => { if (!over()) problem(err?.message || "Svaret kom inte fram."); },
  });

  function nextQuestion() {
    chests?.destroy();
    chests = null;
    offer?.destroy();
    offer = null;
    gold.hold(false);
    drawTop();
    if (over()) return;
    show("fraga");
    flow.show();
  }

  async function openWithRetry(attemptId, chestIndex) {
    for (let n = 0; ; n++) {
      try {
        return await gr.openChest({ sid, attemptId, chestIndex });
      } catch (err) {
        // "En kista i taget!" (minsta tid mellan kistor) → vänta en sekund.
        if (err?.code !== "resource-exhausted" || n >= 2) throw err;
        await new Promise((r) => setTimeout(r, 1100));
      }
    }
  }

  function startChests(attemptId, answerP) {
    if (over()) return;
    try { localStorage.setItem(chestKey(sid, uid), attemptId); } catch {}
    flow.hide();
    show("kistor");
    problem("");
    const forget = () => { try { localStorage.removeItem(chestKey(sid, uid)); } catch {} };
    let answerFailed = false;
    chests = playChests(parts.kistor, {
      sound, avatar: me, gold: goldEl, reduced,
      open: async (i) => {
        let res;
        try { res = await answerP; } catch (err) { answerFailed = true; throw err; }
        if (!res?.correct) { answerFailed = true; throw Object.assign(new Error("Svaret räknades inte som rätt."), { code: "fel-svar" }); }
        gold.hold(true);
        return openWithRetry(attemptId, i);
      },
      onReveal(v) {
        gold.reveal(Number(mine?.gold) || 0, v.gold);
        if (v.mood === "skyddad") react(me, "skyddad").catch(() => {});
        else if (v.mood) react(me, v.mood).catch(() => {});
      },
      onError(err) {
        gold.hold(false);
        if (over()) return;
        if (err?.code === "already-exists" || answerFailed) {
          forget();
          problem(answerFailed ? err?.message : "");
          return nextQuestion();
        }
        if (err?.code === "failed-precondition" && mine?.pending) {
          forget();
          return openOffer(mine.pending);
        }
        problem(err?.message || "Kistan gick inte att öppna – försök igen.");
      },
    });
    chests.done.then((v) => {
      forget();
      if (over()) return;
      if (v.pending) openOffer({ ...v.pending, kind: v.pending.kind || v.chest?.effect?.kind });
      else nextQuestion();
    });
  }

  function openOffer(pending) {
    if (over() || offer) return;
    chests?.destroy();
    chests = null;
    flow.hide();
    show("offer");
    offerChosen = false;
    offer = pickVictim(parts.offer, {
      kind: pending.kind, me: { ...(mine || { uid, gold: 0 }), uid, pending }, players: grPlayers, pending,
      now: serverNow, pool, roster, stage: root, reduced,
      choose: (victimUid) => {
        offerChosen = true;
        return gr.chooseVictim({ sid, victimUid }).catch((err) => { offerChosen = false; throw err; });
      },
      onResult(v) {
        gold.reveal(Number(mine?.gold) || 0, v.gold);
        if (v.mood) react(me, v.mood).catch(() => {});
      },
    });
    offer.done.then(() => { if (!over()) nextQuestion(); });
  }

  // --- Data ----------------------------------------------------------------------------
  function onPlayers(list) {
    grPlayers = list;
    mine = list.find((p) => p.uid === uid) || null;
    const first = !gotPlayers;
    gotPlayers = true;
    if (mine?.nextQ != null && first) flow.setNextQ(mine.nextQ);
    const hit = hits.take(mine);
    if (hit && !over()) {
      notis.show(hit, list.find((p) => p.uid === hit.byUid));
      react(me, hit.mood).catch(() => {});
    }
    offer?.update(mine, grPlayers);
    // Stölden/bytet avgjordes på annat håll (annan flik, servern slumpade) → vidare.
    if (offer && mode_ === "offer" && !mine?.pending && !offerChosen) nextQuestion();
    else if (!over() && ready && mine?.pending && mode_ === "fraga") openOffer(mine.pending);
    drawTop();
    if (first) begin();
  }

  function startPlayers() {
    if (unsubPlayers || !player || destroyed) return;
    unsubPlayers = gr.watchGrPlayers(sid, onPlayers, () => {
      // Läsregeln kräver spelardokumentet – försök igen om en stund.
      unsubPlayers = null;
      clearTimeout(retryT);
      retryT = setTimeout(startPlayers, 3000);
    });
  }

  // Första gången spelet ritas: quizfrågorna + en oöppnad kista / väntande offer.
  async function begin() {
    if (starting || ready || !gotPlayers || stageAction(st?.phase) !== "spel") return;
    starting = true;
    show("laddar");
    if (mode.id === "plugga_quiz" && !quizQs.length) quizQs = await gr.getQuestions(sid).catch(() => []);
    let open = null;
    try { open = localStorage.getItem(chestKey(sid, uid)); } catch {}
    const a = open ? await gr.getMyAnswer(sid, open) : null;
    ready = true;
    if (over()) return;
    if (mine?.pending) return openOffer(mine.pending);
    if (a && a.uid === uid && a.isCorrect === true && !a.chest) return startChests(open, Promise.resolve({ correct: true }));
    if (open) try { localStorage.removeItem(chestKey(sid, uid)); } catch {}
    nextQuestion();
  }

  // --- Faser -------------------------------------------------------------------------
  function place(slot) {
    if (slot && me.parentNode !== slot) slot.appendChild(me);
  }

  function drawEnd() {
    if (mode_ !== "slut") {
      flow.hide();
      chests?.destroy();
      chests = null;
      offer?.destroy();
      offer = null;
      show("slut");
    }
    place(view.querySelector(".live-elev-end [data-gr-av]"));
    if (!st.result) return;
    const { podium } = endStanding(st.result, uid);
    if (podium && reacted !== "final") {
      reacted = "final";
      react(me, "jubel").catch(() => {});
    }
    // Läraren betalar ut direkt efter result – visa det nya saldot i menyn.
    if (!coinTimers && myReward(st.result, uid)) {
      const refresh = () => { if (!destroyed) { invalidateStudentData(uid); renderTopbar(); } };
      coinTimers = [setTimeout(refresh, 4000), setTimeout(refresh, 15000)];
    }
  }

  function sync() {
    if (destroyed || !st) return;
    view.querySelector(".live-elev-me").textContent = "";
    const what = stageAction(st.phase);
    if (what === "lobby") return place(view.querySelector(".live-elev-lobby [data-gr-av]"));
    if (what === "slut") return drawEnd();
    if (what !== "spel") return;
    place($(".gr-horn"));
    if (!player) return show("laddar");
    startPlayers();
    if (!ready) begin();
  }

  return {
    update(next, p) {
      st = next;
      player = p;
      sync();
    },
    destroy() {
      destroyed = true;
      gold.destroy();
      notis.destroy();
      clearTimeout(retryT);
      clearTimeout(problemT);
      clearTimeout(protT);
      (coinTimers || []).forEach(clearTimeout);
      unsubPlayers?.();
      chests?.destroy();
      offer?.destroy();
      flow.destroy();
      sound.destroy();
      pool.destroy();
      view.classList.remove("gr-elev-vy");
    },
  };
}
