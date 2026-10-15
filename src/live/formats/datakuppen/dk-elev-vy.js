// ============================================================================
// Datakuppen 💾 (#653): ELEVENS SPELYTA utan Firebase – datakuppen-student.js
// kopplar in Firestore/Cloud Functions (api), förhandsvisningen en låtsas-
// server. Spec §1.2–1.7, §4.1, §4.3. Kärnan äger lobbyns ram, 3-2-1-KÖR!,
// närvaro, sen anslutning och slutskärmens ram; här ritas resten.
//
// Layout (Chromebook 1366×768 först, allt utan scroll):
//   överst   data stort ("💾 250 MB", SVG), läget ("20 MB bakom Alma" – aldrig
//            placering som nummer), "Din kod: •••• [👁 Visa kod]" (dold tills
//            eleven trycker, #719), "🛡️ Skyddad 0:42", ljudknapp, avatar i hörnet
//   mitten   fråga (kistspelets frågeflöde: multiplikation skriv själv/flerval,
//            quiz, tidslinje) ELLER tre filer (dk-filer.js) ELLER hacket i två
//            steg (dk-hack-vy.js: målväljaren, sedan kodkorten)
//   notis    "💻 Omar knäckte din kod och tog 45 MB!" ~2 s, blockerar aldrig.
//            Koden behålls hela matchen (#719) – inget nytt kodval efter hack.
// Lobbyn: fyra kodförslag (dk-kod-vy.js) + roterande säkerhetstips.
// Omladdning: en oöppnad fil (attemptId i localStorage) visas igen; ett
// väntande hack öppnar målväljaren, ett valt mål kodkorten (dkSelf.hack).
// Ljud: diskreta effekter AV som standard (dk-ljud.js).
// Stilar: datakuppen-elev.css, datakuppen-hack.css, datakuppen-filer.css (egna filer).
//
// API
//   createDkStage({ view, host, uid, classId, session, mode, answerKind },
//                 { api, now, roster?, onCoins?, css? }) → { update(st, player), destroy() }
//     api = datakuppen-data.js (answer, openFile, pickCode, chooseTarget,
//           guessCode, watchDkPlayers, watchMySelf, getQuestions, getMyAnswer)
//     now() = serverkorrigerad klocka · onCoins() = läraren har betalat ut
// ============================================================================

import { ensureLiveCss } from "../../live-css.js";
import { myReward } from "../../live-rewards.js";
import { createAvatarRoster } from "../../design/live-avatars.js";
import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { react, setAvatarState, prefersReducedMotion } from "../../design/live-reactions.js";
import { createGoldCounter } from "../guldrush/gr-guld.js";
import { createQuestionFlow } from "../../kistspel/ks-fraga.js";
import { protectedLeftMs } from "./delat/datakuppen-regler.js";
import { goldStanding, standingText, createHitWatcher, endStanding, stageAction, chestKey, myProtection } from "./dk-elev.js";
import { dataIcon } from "./dk-ikoner.js";
import { playFiles } from "./dk-filer.js";
import { createHackFlow } from "./dk-hack-vy.js";
import { createCodeArea } from "./dk-kod-vy.js";
import { createCodeReveal } from "./dk-kodval.js";
import { createDkSound } from "./dk-ljud.js";
import { createDkNotice } from "./dk-notis.js";
import { createTipRotator } from "./dk-skarmar.js";

export const DK_CSS = ["src/live/formats/datakuppen/datakuppen-elev.css", "src/live/formats/datakuppen/datakuppen-hack.css"];
// Läge i mitten → delen som syns.
const PART_OF = { laddar: "vanta", fraga: "svar", filer: "filer", offer: "offer", kod: "kod", slut: null };

export function createDkStage({ view, host, uid, classId, session, mode, answerKind }, { api, now, roster: rosterIn, onCoins = () => {}, css = DK_CSS }) {
  ensureLiveCss(css);
  view.classList.add("dk-elev-vy");
  const sid = session.id;
  const reduced = prefersReducedMotion();
  host.innerHTML = `<div class="dk-elev">
      <div class="dk-topp">
        <div class="dk-data-ruta" aria-live="polite"><span class="dk-data-ikon">${dataIcon("100%")}</span>
          <b class="dk-data">0</b><span class="dk-data-enh">MB</span></div>
        <div class="dk-info"><p class="dk-lage"></p>
          <p class="dk-rad2"><span class="dk-minkod" hidden></span><span class="dk-skydd" hidden></span></p></div>
        <button type="button" class="dk-ljud" aria-pressed="false"></button>
        <span class="dk-horn"></span>
      </div>
      <p class="dk-felrad" role="alert" hidden></p>
      <div class="dk-mitt">
        <div class="dk-svar"></div>
        <div class="dk-filer" hidden></div>
        <div class="dk-offer" hidden></div>
        <div class="dk-kodkort" hidden></div>
        <p class="dk-vanta" hidden>⏳ Ansluter till nätverket …</p>
      </div>
      <div class="dk-notis" role="status" aria-live="polite" hidden></div>
    </div>`;
  const $ = (s) => host.querySelector(s);
  const root = $(".dk-elev");
  const parts = { svar: $(".dk-svar"), filer: $(".dk-filer"), offer: $(".dk-offer"), kod: $(".dk-kodkort"), vanta: $(".dk-vanta") };

  const roster = rosterIn || createAvatarRoster();
  const pool = createAvatarPool({ roster });
  roster.ensure([{ uid, classId }]).catch(() => {});
  const me = pool.el(uid);
  me.classList.add("vantar");

  const sound = createDkSound();
  const ljud = $(".dk-ljud");
  const drawLjud = () => {
    ljud.textContent = sound.on ? "🔊" : "🔇";
    ljud.setAttribute("aria-pressed", String(sound.on));
    ljud.setAttribute("aria-label", sound.on ? "Effektljud på – stäng av" : "Effektljud av – slå på");
    ljud.title = sound.on ? "Effektljud på" : "Effektljud av";
  };
  ljud.addEventListener("click", () => { sound.toggle(); drawLjud(); });
  drawLjud();

  let st = null;
  let player = null;
  let destroyed = false;
  let dkPlayers = [];
  let mine = null; // mitt dkPlayers-dokument
  let self = null; // mitt dkSelf (kod, förslag, pågående hackkoder)
  let gotPlayers = false;
  let gotSelf = false;
  let unsubPlayers = null;
  let unsubSelf = null;
  let retryT = 0;
  let quizQs = [];
  let ready = false;
  let starting = false;
  let mode_ = "laddar"; // "laddar" | "fraga" | "filer" | "offer" | "kod" | "slut"
  let files = null;
  let coinTimers = null;
  let reacted = "";
  const hits = createHitWatcher();
  const data = createGoldCounter($(".dk-data"), { reduced });
  const notis = createDkNotice($(".dk-notis"), { pool, roster });
  const tips = createTipRotator(() => view.querySelector(".live-elev-lobby [data-dk-tips]"), { reduced });
  const mood = (m) => react(me, m).catch(() => {});
  let protT = 0;
  const minKod = createCodeReveal($(".dk-minkod"));

  // --- Toppraden --------------------------------------------------------------
  function drawTop() {
    data.sync(mine?.gold);
    const { rel } = goldStanding(dkPlayers, uid);
    $(".dk-lage").textContent = standingText(rel) || (gotPlayers ? "Svara rätt – öppna en fil!" : "");
    const kod = $(".dk-minkod");
    kod.hidden = !self?.code;
    minKod.set(self?.code);
    drawSkydd();
  }

  // "🛡️ Skyddad 0:42" bara medan skyddet gäller – räknas ned varje sekund.
  function drawSkydd() {
    const skydd = $(".dk-skydd");
    const t = now();
    const text = myProtection(mine, t);
    skydd.hidden = !text;
    if (skydd.textContent !== text) skydd.textContent = text;
    setAvatarState(me, "skyddad", !!text);
    clearTimeout(protT);
    const left = protectedLeftMs(mine, t);
    if (left > 0) protT = setTimeout(drawSkydd, (left % 1000 || 1000) + 20);
  }

  // --- Lägen i mitten ---------------------------------------------------------
  function show(lage) {
    mode_ = lage;
    for (const [k, el] of Object.entries(parts)) el.hidden = k !== PART_OF[lage];
    root.dataset.lage = lage;
  }
  let problemT = 0;
  function problem(msg) {
    const f = $(".dk-felrad");
    f.textContent = msg ? `😕 ${msg}` : "";
    f.hidden = !msg;
    clearTimeout(problemT);
    if (msg) problemT = setTimeout(() => { f.hidden = true; }, 3500);
  }
  const over = () => destroyed || stageAction(st?.phase) !== "spel";

  const flow = createQuestionFlow(parts.svar, {
    mode, answerKind, tlCls: "dk-svar-tl",
    questions: () => quizQs,
    send: (payload) => api.answer({ sid, ...payload }),
    onCorrect: ({ attemptId, answerP }) => startFiles(attemptId, answerP),
    onProblem: (err) => { if (!over()) problem(err?.message || "Svaret kom inte fram."); },
  });

  const hack = createHackFlow({
    parts, api, sid, uid, now, pool, roster, stage: root, reduced, sound,
    show: (lage) => { flow.hide(); show(lage); },
    onGold: (gold) => data.reveal(Number(mine?.gold) || 0, gold),
    onMood: mood,
    onDone: () => { if (!over()) nextQuestion(); },
  });

  const code = createCodeArea({
    view, api, sid, sound,
    onError: (err) => { if (!destroyed) problem(err?.message); },
  });

  function clearMiddle() {
    files?.destroy();
    files = null;
    hack.destroy();
  }

  function nextQuestion() {
    clearMiddle();
    data.hold(false);
    drawTop();
    if (over()) return;
    show("fraga");
    flow.show();
  }

  async function openWithRetry(attemptId, fileIndex) {
    for (let n = 0; ; n++) {
      try {
        return await api.openFile({ sid, attemptId, fileIndex });
      } catch (err) {
        // "En fil i taget!" (minsta tid mellan filer) → vänta en sekund.
        if (err?.code !== "resource-exhausted" || n >= 2) throw err;
        await new Promise((r) => setTimeout(r, 1100));
      }
    }
  }

  // --- Tre filer ----------------------------------------------------------------
  function startFiles(attemptId, answerP) {
    if (over()) return;
    try { localStorage.setItem(chestKey(sid, uid), attemptId); } catch {}
    flow.hide();
    clearMiddle();
    show("filer");
    problem("");
    const forget = () => { try { localStorage.removeItem(chestKey(sid, uid)); } catch {} };
    let answerFailed = false;
    files = playFiles(parts.filer, {
      sound, reduced,
      open: async (i) => {
        let res;
        try { res = await answerP; } catch (err) { answerFailed = true; throw err; }
        if (!res?.correct) { answerFailed = true; throw Object.assign(new Error("Svaret räknades inte som rätt."), { code: "fel-svar" }); }
        data.hold(true);
        return openWithRetry(attemptId, i);
      },
      onReveal(v) {
        data.reveal(Number(mine?.gold) || 0, v.gold);
        if (v.mood) mood(v.mood);
      },
      onError(err) {
        data.hold(false);
        if (over()) return;
        if (err?.code === "already-exists" || answerFailed) {
          forget();
          problem(answerFailed ? err?.message : "");
          return nextQuestion();
        }
        if (err?.code === "failed-precondition" && mine?.pending) {
          forget();
          files?.destroy();
          files = null;
          return hack.resume(mine, self, dkPlayers);
        }
        problem(err?.message || "Filen gick inte att öppna – försök igen.");
      },
    });
    files.done.then((v) => {
      forget();
      if (over()) return;
      files?.destroy();
      files = null;
      if (v.pending) hack.target({ ...v.pending, kind: "steal" }, mine, dkPlayers);
      else nextQuestion();
    });
  }

  // --- Data -----------------------------------------------------------------------
  function onPlayers(list) {
    dkPlayers = list;
    mine = list.find((p) => p.uid === uid) || null;
    const first = !gotPlayers;
    gotPlayers = true;
    if (mine?.nextQ != null && first) flow.setNextQ(mine.nextQ);
    const hit = hits.take(mine);
    if (hit && !over()) {
      notis.show(hit, list.find((p) => p.uid === hit.byUid));
      mood(hit.mood);
    }
    hack.update(mine, dkPlayers);
    // Hacket avgjordes på annat håll (annan flik, servern slumpade) → vidare.
    if (hack.settled(mine)) nextQuestion();
    else if (!over() && ready && mine?.pending && (mode_ === "fraga" || mode_ === "laddar")) hack.resume(mine, self, dkPlayers);
    drawTop();
    if (!over() && gotSelf) code.live(self);
    if (first) begin();
  }

  function onSelf(doc) {
    self = doc;
    gotSelf = true;
    drawTop();
    if (stageAction(st?.phase) === "lobby") code.lobby(self);
    else if (!over()) {
      code.live(self);
      // Steg 2 efter omladdning: koderna kom efter dkPlayers.
      if (ready && mode_ === "laddar" && mine?.pending) hack.resume(mine, self, dkPlayers);
    }
    begin();
  }

  function startWatch() {
    if (!player || destroyed) return;
    const retry = () => { clearTimeout(retryT); retryT = setTimeout(startWatch, 3000); };
    // Läsreglerna kräver spelardokumentet – försök igen om en stund.
    unsubPlayers ||= api.watchDkPlayers(sid, onPlayers, () => { unsubPlayers = null; retry(); });
    unsubSelf ||= api.watchMySelf(sid, uid, onSelf, () => { unsubSelf = null; gotSelf = true; retry(); });
  }

  // Första gången spelet ritas: quizfrågorna + en oöppnad fil / ett väntande hack.
  async function begin() {
    if (starting || ready || !gotPlayers || !gotSelf || stageAction(st?.phase) !== "spel") return;
    starting = true;
    show("laddar");
    if (mode.id === "plugga_quiz" && !quizQs.length) quizQs = await api.getQuestions(sid).catch(() => []);
    let open = null;
    try { open = localStorage.getItem(chestKey(sid, uid)); } catch {}
    const a = open ? await api.getMyAnswer(sid, open) : null;
    ready = true;
    if (over()) return;
    code.live(self);
    if (mine?.pending) return hack.resume(mine, self, dkPlayers);
    if (a && a.uid === uid && a.isCorrect === true && !a.chest) return startFiles(open, Promise.resolve({ correct: true }));
    if (open) try { localStorage.removeItem(chestKey(sid, uid)); } catch {}
    nextQuestion();
  }

  // --- Faser ----------------------------------------------------------------------
  function place(slot) {
    if (slot && me.parentNode !== slot) slot.appendChild(me);
  }

  function drawEnd() {
    if (mode_ !== "slut") {
      flow.hide();
      clearMiddle();
      minKod.hide();
      show("slut");
    }
    place(view.querySelector(".live-elev-end [data-dk-av]"));
    if (!st.result) return;
    const { podium } = endStanding(st.result, uid);
    if (podium && reacted !== "final") {
      reacted = "final";
      mood("jubel");
    }
    // Läraren betalar ut direkt efter result – visa det nya saldot i menyn.
    if (!coinTimers && myReward(st.result, uid)) {
      const refresh = () => { if (!destroyed) onCoins(); };
      coinTimers = [setTimeout(refresh, 4000), setTimeout(refresh, 15000)];
    }
  }

  function sync() {
    if (destroyed || !st) return;
    const head = view.querySelector(".live-elev-me");
    if (head) head.textContent = "";
    const what = stageAction(st.phase);
    tips.run(what === "lobby");
    if (player) startWatch();
    if (what === "lobby") {
      place(view.querySelector(".live-elev-lobby [data-dk-av]"));
      if (gotSelf) code.lobby(self);
      return;
    }
    if (what === "slut") return drawEnd();
    if (what !== "spel") return;
    place($(".dk-horn"));
    if (!player) return show("laddar");
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
      data.destroy();
      notis.destroy();
      tips.destroy();
      code.destroy();
      minKod.destroy();
      clearTimeout(retryT);
      clearTimeout(problemT);
      clearTimeout(protT);
      (coinTimers || []).forEach(clearTimeout);
      unsubPlayers?.();
      unsubSelf?.();
      clearMiddle();
      flow.destroy();
      sound.destroy();
      pool.destroy();
      view.classList.remove("dk-elev-vy");
    },
  };
}
