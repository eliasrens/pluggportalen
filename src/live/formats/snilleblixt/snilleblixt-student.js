// ============================================================================
// Snilleblixten – elevens skärm (#558, designspec §5.8). Laddas LATT av
// page-elev-live.js via SNILLEBLIXT.studentView(). Kärnan äger lobby,
// 3-2-1-KÖR!, närvaro/puls, sen anslutning (går med automatiskt) och
// slutskärmens ram; formatet äger spelytan (createStage) eftersom läraren
// styr frågorna – eleven får session.q, inte en egen frågekälla.
//
// Lägena räknas ut i snilleblixt-elev.js (ren logik); här ritas de:
//   Flerval     choice-answer.js (#552): fyra skärmfyllande knappar, färg +
//               form, 1–4. Valet låses direkt (ett försök).
//   Skriv själv src/mult/fast-answer.js: fokus, ENTER, tomt räknas inte,
//               ingen RÄTT/FEL-rad (feedback:false) – facit kommer vid avslöjandet.
//   "Visa frågan på elevskärm" av → bara knapparna/svarsfältet.
//   Omladdning: elevens eget svarsdokument läses EN gång för pågående fråga
//   (finns = "Svar inskickat", inget nytt försök). Reglerna nekar ändå ett
//   andra svar (create-only {i}_{uid}).
// Inga ljud på elevdatorn (designspec §8). Lätt: inga bakgrundsanimationer,
// bara en smal tidsstapel (transform) och avatarens reaktion vid rätt svar.
// Stilar: snilleblixt-elev.css (egen fil).
//
// API (studentView-kontraktet, live-formats.js)
//   lobbyHtml(s)  joinedText  endHtml(st, player, classId)
//   createStage({ view, host, uid, classId, session, mode, answerKind })
//     → { update(st, player), destroy() }
// ============================================================================

import { escHtml, renderTopbar } from "../../../ui.js";
import { invalidateStudentData } from "../../../data.js";
import { ensureLiveCss } from "../../live-css.js";
import { serverNow } from "../../live-clock.js";
import { placeText, myReward, rewardSummary, sessionRewards } from "../../live-rewards.js";
import { elevLage, formatPoints } from "./snilleblixt-elev.js";
import { createAvatarRoster } from "../../design/live-avatars.js";
import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { react, setAvatarState } from "../../design/live-reactions.js";
import { mountChoiceAnswer, choiceShapeSvg, CHOICE_STYLES } from "../../choice-answer.js";
import { mountFastAnswer } from "../../../mult/fast-answer.js";
import { submitAnswer, getMyAnswer, watchScores } from "./snilleblixt-data.js";

const CSS = "src/live/formats/snilleblixt/snilleblixt-elev.css";
const AV = '<span class="sb-av" data-sb-av aria-hidden="true"></span>';

export const joinedText = "Du är med! Väntar på start …";

export function lobbyHtml() {
  return `<div class="sb-lobby">${AV}</div>`;
}

/** Slutskärmen (§7.2.4): placering, avatar och pluggmynt ur result (verifierat). */
export function endHtml(st, player) {
  if (st.phase === "cancelled") return `<div class="big-emoji">🛑</div><h2>Matchen avbröts</h2>`;
  const r = st.result;
  if (!r) return `<div class="sb-final">${AV}<h2>⚡ Snilleblixten är slut!</h2><p class="hint">Resultatet räknas ihop…</p></div>`;
  const uid = player?.uid;
  const row = (r.ranking || []).find((p) => p.uid === uid);
  const sum = rewardSummary(myReward(r, uid));
  if (!row && !sum) return `<div class="sb-final"><h2>⚡ Snilleblixten är slut!</h2><p class="hint">Du var inte med i den här matchen.</p></div>`;
  const title = sum?.title || `${{ 1: "🥇", 2: "🥈", 3: "🥉" }[row.rank] || "🏅"} Du kom ${placeText(row.rank)}!`;
  const stats = row ? `<p class="sb-final-poang">${formatPoints(row.points)} poäng · ${row.correct} rätt</p>` : "";
  let coins = "";
  if (sum) {
    coins = `<ul class="sb-mynt">${sum.lines.map((l) => `<li><span>${escHtml(l.label)}</span><b>${l.coins}</b></li>`).join("")}</ul>
      <p class="sb-mynt-tot">Totalt: <b>${sum.total}</b> pluggmynt 🎉</p>`;
  } else if (sessionRewards(st.session)) {
    coins = `<p class="hint">Inga pluggmynt den här gången – svara på frågorna nästa gång!</p>`;
  }
  return `<div class="sb-final">${AV}<h2>${escHtml(title)}</h2>${stats}${coins}</div>`;
}

// Kortens text per läge (avatar visas där det står av: true).
const KORT = {
  ansluter: { ikon: "⏳", rubrik: "Ansluter …" },
  laddar: { ikon: "⏳", rubrik: "Hämtar frågan …" },
  forsta: { ikon: "⚡", rubrik: "Gör dig redo!", text: "Första frågan kommer snart …", av: true },
  sen: { ikon: "👋", rubrik: "Du är med!", text: "Du kommer in från nästa fråga.", av: true },
  "tid-ute": { ikon: "⏰", rubrik: "Tiden är ute!", text: "Rätt svar visas snart …" },
  svarat: { ikon: "⚡", rubrik: "Svar inskickat!", text: "Håll tummarna …", av: true },
  ratt: { ikon: "✅", rubrik: "Rätt!", av: true },
  fel: { ikon: "❌", rubrik: "Inte rätt den här gången" },
  "inget-svar": { ikon: "⏰", rubrik: "Inget svar den här gången" },
  "visa-svar": { ikon: "👀", rubrik: "Du är med från nästa fråga!" },
  hoppad: { ikon: "⏭️", rubrik: "Frågan hoppades över", text: "Nästa fråga kommer snart …" },
};

export function createStage({ view, host, uid, classId, session, mode, answerKind }) {
  ensureLiveCss([CSS]);
  view.classList.add("sb-elev-vy");
  const sid = session.id;
  const choice = answerKind === "choice";
  const numeric = (mode?.inputMode || "numeric") === "numeric";
  host.innerHTML = `<div class="sb-elev">
      <div class="sb-rad"><span class="sb-nr"></span><span class="sb-tid" hidden><i></i></span></div>
      <p class="sb-felrad" role="alert" hidden></p>
      <div class="sb-svar"></div>
      <div class="sb-skickat" hidden><span class="sb-av-plats"></span><span>⚡ Svar inskickat! Håll tummarna …</span></div>
      <div class="sb-kort" role="status" aria-live="polite" hidden>
        <div class="sb-kort-ikon" aria-hidden="true"></div><span class="sb-av-plats"></span>
        <h2 class="sb-kort-rubrik"></h2><p class="sb-kort-poang"></p><div class="sb-kort-text"></div><p class="sb-kort-plats"></p>
      </div></div>`;
  const $ = (s) => host.querySelector(s);
  const svar = $(".sb-svar");

  const roster = createAvatarRoster();
  const pool = createAvatarPool({ roster });
  roster.ensure([{ uid, classId }]).catch(() => {});
  const me = pool.el(uid);

  let st = null;
  let player = null;
  let scores = [];
  let unsubScores = null;
  let scoresRetry = 0;
  const mineBy = new Map(); // fråga → svarsdokument | null (vet att inget svar finns)
  let fetchedFirst = false;
  let shownIndex = null; // frågan som visas i svarskomponenten
  let current = null; // { index, question } för skriv själv
  let timer = 0;
  let reacted = "";
  let coinTimers = null;
  let destroyed = false;

  const showQ = session.showQuestionOnStudent !== false;
  const qText = (q) => (!showQ || !q ? "" : numeric && !choice ? `${q.text} = ?` : String(q.text ?? ""));

  function send(payload) {
    const index = st?.session?.q?.index;
    if (!Number.isInteger(index) || mineBy.get(index)) return;
    mineBy.set(index, payload); // låst direkt – ett försök
    $(".sb-felrad").hidden = true;
    draw();
    submitAnswer({ sid, s: st.session, uid, classId, ...payload })
      .then(async (res) => {
        if (res === "redan-svarat") mineBy.set(index, await getMyAnswer(sid, index, uid).catch(() => payload) || payload);
      })
      .catch((err) => {
        console.warn("Snilleblixten: svaret kom inte fram", err);
        mineBy.delete(index);
        shownIndex = null;
        const f = $(".sb-felrad");
        f.textContent = "😕 Svaret kom inte fram – försök igen!";
        f.hidden = false;
      })
      .finally(() => draw());
  }

  const comp = choice
    ? mountChoiceAnswer(svar, { onChoose: (i) => send({ choiceIndex: i }), sentText: "", enabled: false })
    : mountFastAnswer(svar, {
      source: { next: () => ({ key: `sb:${current?.index}`, text: qText(current?.question) }) },
      check: (_q, raw) => ({ valid: String(raw ?? "").trim() !== "", correct: false, correctAnswer: "" }),
      onAnswer: (attempt) => {
        comp.setEnabled(false, ""); // synkront: en andra ENTER når aldrig fram
        send({ answer: attempt.raw });
      },
      inputMode: numeric ? "numeric" : "text",
      feedback: false,
      suffix: "",
      enabled: false,
      idleText: "",
    });

  function startScores() {
    if (unsubScores || !player || destroyed) return;
    unsubScores = watchScores(sid, (list) => { scores = list; draw(); }, () => {
      // Läsregeln kräver spelardokumentet – försök igen om en stund.
      unsubScores = null;
      clearTimeout(scoresRetry);
      scoresRetry = setTimeout(startScores, 3000);
    });
  }

  function place(slot) {
    if (slot && me.parentNode !== slot) slot.appendChild(me);
  }

  function correctHtml(facit) {
    if (!facit) return "";
    const i = facit.answerIndex;
    const text = escHtml(facit.correctAnswer ?? st?.session?.q?.question?.options?.[i] ?? "");
    if (choice && Number.isInteger(i) && CHOICE_STYLES[i]) {
      return `<span class="sb-rattsvar">Rätt svar: <span class="sb-chip sb-chip-${CHOICE_STYLES[i].key}">${choiceShapeSvg(i)}<b>${text}</b></span></span>`;
    }
    return `<span class="sb-rattsvar">Rätt svar: <b>${text}</b></span>`;
  }

  function showAnswer(l, q) {
    svar.hidden = false;
    if (choice) {
      if (shownIndex !== l.index) {
        comp.setQuestion({ options: q.options || [], question: qText(q) });
        shownIndex = l.index;
      }
      if (l.kind === "svarat" && Number.isInteger(l.mine?.choiceIndex)) {
        if (comp.chosen() !== l.mine.choiceIndex) comp.showChosen(l.mine.choiceIndex);
      } else comp.setEnabled(l.kind === "fraga");
      return;
    }
    if (shownIndex !== l.index) {
      comp.setEnabled(false);
      current = { index: l.index, question: q };
      shownIndex = l.index;
    }
    comp.setEnabled(true);
  }

  function timeBar(l) {
    const bar = $(".sb-tid");
    const on = l.kind === "fraga" && l.endMs != null && l.startMs != null;
    bar.hidden = !on;
    if (!on) return;
    const key = String(l.index);
    if (bar.dataset.q === key) return;
    bar.dataset.q = key;
    const total = l.endMs - l.startMs;
    const i = bar.querySelector("i");
    i.style.animation = "none";
    void i.offsetWidth;
    i.style.animation = `sb-tid ${total}ms linear ${-(serverNow() - l.startMs)}ms forwards`;
  }

  function draw() {
    if (destroyed || !st?.session) return;
    const s = st.session;
    const q = s.q || null;
    // Omladdning mitt i en fråga: läs elevens eget svar EN gång.
    if (q && player && !mineBy.has(q.index)) {
      if (fetchedFirst) mineBy.set(q.index, null);
      else {
        fetchedFirst = true;
        const index = q.index;
        getMyAnswer(sid, index, uid).then((a) => { if (!mineBy.get(index)) mineBy.set(index, a); }, () => mineBy.set(index, null)).finally(draw);
      }
    }
    const loading = q && player && !mineBy.has(q.index);
    const l = elevLage({ s, player, uid, mine: q ? mineBy.get(q.index) || null : null, scores, now: serverNow() });
    const kind = loading ? "laddar" : l.kind;

    $(".sb-nr").textContent = l.number > 0 ? `Fråga ${l.number} av ${l.total}` : "";
    view.querySelector(".live-elev-me").textContent = player ? `${formatPoints(l.totalPoints)} poäng` : "";
    view.classList.toggle("sb-ratt", kind === "ratt");
    view.classList.toggle("sb-fel", kind === "fel");
    timeBar({ ...l, kind });
    clearTimeout(timer);
    if (kind === "fraga" && l.endMs != null) timer = setTimeout(draw, Math.max(50, l.endMs - serverNow() + 30));

    const answerArea = kind === "fraga" || (kind === "svarat" && choice);
    if (answerArea) showAnswer({ ...l, kind }, l.question);
    else {
      svar.hidden = true;
      if (!choice) comp.setEnabled(false, "");
      else comp.setEnabled(false);
    }
    const sk = $(".sb-skickat");
    sk.hidden = !(kind === "svarat" && choice);
    if (!sk.hidden) place(sk.querySelector(".sb-av-plats"));

    setAvatarState(me, "svarat", kind === "svarat");
    const kort = $(".sb-kort");
    const k = answerArea ? null : KORT[kind];
    kort.hidden = !k;
    kort.dataset.lage = kind;
    if (k) {
      $(".sb-kort-ikon").textContent = k.ikon;
      $(".sb-kort-rubrik").textContent = k.rubrik;
      const reveal = ["ratt", "fel", "inget-svar", "visa-svar"].includes(kind);
      $(".sb-kort-poang").textContent = kind === "ratt" ? `+${formatPoints(l.points)}` : kind === "fel" ? "0 poäng" : "";
      let text = k.text ? escHtml(k.text) : "";
      if (kind === "svarat" && !choice && l.mine?.answer != null) text += `<span class="sb-ditt">Ditt svar: <b>${escHtml(l.mine.answer)}</b></span>`;
      if (reveal && kind !== "ratt") text = correctHtml(l.facit);
      $(".sb-kort-text").innerHTML = text;
      $(".sb-kort-plats").textContent = reveal ? `Du ligger ${placeText(l.rank)}` : "";
      const slot = kort.querySelector(".sb-av-plats");
      slot.hidden = !k.av;
      if (k.av) place(slot);
      if (kind === "ratt" && reacted !== `r${l.index}`) {
        reacted = `r${l.index}`;
        react(me, "glad").catch(() => {});
      }
    }
  }

  function drawEnd() {
    const slot = view.querySelector(".live-elev-end [data-sb-av]");
    view.classList.remove("sb-ratt", "sb-fel");
    if (!slot) return;
    place(slot);
    const row = (st.result?.ranking || []).find((p) => p.uid === uid);
    if (row && row.rank <= 3 && reacted !== "final") {
      reacted = "final";
      react(me, "jubel").catch(() => {});
    }
    if (player) view.querySelector(".live-elev-me").textContent = row ? `${formatPoints(row.points)} poäng` : "";
    // Läraren betalar ut direkt efter result – visa det nya saldot i menyn.
    if (!coinTimers && myReward(st.result, uid)) {
      const refresh = () => { if (!destroyed) { invalidateStudentData(uid); renderTopbar(); } };
      coinTimers = [setTimeout(refresh, 4000), setTimeout(refresh, 15000)];
    }
  }

  return {
    update(next, p) {
      st = next;
      player = p;
      if (player) startScores();
      if (st.phase === "live") return draw();
      clearTimeout(timer);
      if (st.phase === "lobby") place(view.querySelector(".live-elev-lobby [data-sb-av]"));
      else if (st.phase === "finished" || st.phase === "cancelled") drawEnd();
    },
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      clearTimeout(scoresRetry);
      (coinTimers || []).forEach(clearTimeout);
      unsubScores?.();
      comp.destroy();
      pool.destroy();
      view.classList.remove("sb-elev-vy", "sb-ratt", "sb-fel");
    },
  };
}
