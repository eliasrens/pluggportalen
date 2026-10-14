// ============================================================================
// Kistspel 🎁 (#651, utbrutet ur Guldrushens gr-fraga.js #564/#601): FRÅGA →
// SVAR i egen takt (funktionsspec §6.1, DEL 2) – gemensamt för alla kistformat.
//   Skriv själv  src/mult/fast-answer.js – fokus ligger kvar genom svars-
//                cyklerna (ENTER → nästa direkt). Bara multiplikation.
//   Flerval      choice-answer.js (#552): fyra knappar, färg + form, 1–4.
//                Multiplikation: alternativen ur spelläget; quiz: frågorna
//                ur formatets publika dokument (utan facit) och SERVERN väljer nästa fråga
//                (svarets nextQ, §4.4 – ingen kan pröva sig fram).
// Rättningen som räknas görs alltid av servern (send → formatets Answer-funktion).
// Multiplikationens facit är inte hemligt (a·b), så klienten visar rätt/fel
// direkt och låter kistorna dyka upp medan svaret är på väg (tempot, §6.7) –
// kistan öppnas ändå först när servern bekräftat rätt svar. Quiz väntar på
// serverns besked.
// Fel → kort ❌ och nästa fråga direkt, inga kistor.
// Tidslinjefråga (#601, epic #595, kind "timeline"): i stället för
//                alternativen visas tidslinjen (src/timeline/timeline-answer.js,
//                kompakt, laddas latt) – dra, finjustera, lås → send({ q, year }).
//                Servern rättar (exakt år = rätt → kistor). Fel → kort ❌ +
//                rätt år på linjen en stund, sedan nästa fråga.
//
// API
//   createQuestionFlow(host, { mode, answerKind, send, onCorrect, onProblem,
//                              questions?, tlCls }) → { show(), hide(), setNextQ(n), destroy() }
//     send(payload) → Promise<{ correct, correctAnswer, nextQ }>  (attemptId med)
//     onCorrect({ attemptId, answerP })  rätt svar → vyn visar kistorna
//     onProblem(err)  svaret kom inte fram / nekades
//     questions()     quizets elevsynliga frågor
//     tlCls           tidslinjerutans CSS-klass (Guldrushen: "gr-svar-tl")
// ============================================================================

import { mountFastAnswer } from "../../mult/fast-answer.js";
import { mountChoiceAnswer } from "../choice-answer.js";
import { newAttemptId } from "../../mult/attempt-id.js";

const WRONG_MS = 750;
const TL_WRONG_MS = 1800; // rätt år ska hinna läsas
const TL_URL = "../../timeline/timeline-answer.js";

export function createQuestionFlow(host, { mode, answerKind, send, onCorrect, onProblem = () => {}, questions = () => [], tlCls }) {
  const choice = answerKind === "choice";
  const quiz = mode.id === "plugga_quiz";
  let enabled = false;
  let destroyed = false;
  let nextQ = null;
  let current = null;
  let wrongT = 0;
  let comp;
  let showChoice = () => {};
  let tl = null; // tidslinjen (bara quiz med tidslinjefrågor)
  let tlP = null;

  function flashWrong() {
    host.dataset.fel = "";
    clearTimeout(wrongT);
    wrongT = setTimeout(() => delete host.dataset.fel, WRONG_MS);
  }

  if (!choice) {
    comp = mountFastAnswer(host, {
      source: mode.createSource(),
      check: mode.checkAnswer,
      inputMode: mode.inputMode || "numeric",
      feedbackMs: { correct: 500, wrong: 1300 },
      enabled: false,
      idleText: "",
      onAnswer(attempt) {
        const q = attempt.question;
        const p = send({ attemptId: attempt.attemptId, factorA: q.a, factorB: q.b, answer: attempt.raw });
        if (attempt.result.correct) {
          comp.setEnabled(false, ""); // synkront: nästa ENTER når aldrig fram
          enabled = false;
          onCorrect({ attemptId: attempt.attemptId, answerP: p });
        } else {
          flashWrong();
          p.catch((err) => { if (!destroyed) onProblem(err); });
        }
      },
    });
  } else {
    const src = quiz ? null : mode.createSource();
    comp = mountChoiceAnswer(host, { onChoose, sentText: "", enabled: false });
    if (quiz && questions().some((q) => q?.kind === "timeline")) ensureTl().catch(() => {});

    showChoice = (again = null) => {
      if (again) {
        current = again;
      } else if (quiz) {
        const qs = questions();
        if (!qs.length) return;
        const i = Number.isInteger(nextQ) && qs[nextQ] ? nextQ : Math.floor(Math.random() * qs.length);
        current = { q: i, options: qs[i].options || [], text: String(qs[i].text ?? ""), context: String(qs[i].passage ?? ""), attemptId: newAttemptId() };
        if (qs[i].kind === "timeline") Object.assign(current, { tl: true, question: qs[i] });
      } else {
        const q = src.next();
        const ch = mode.choices(q);
        current = { question: q, options: ch.options, answerIndex: ch.answerIndex, text: `${q.text} = ?`, attemptId: newAttemptId() };
      }
      if (current.tl) return showTimeline(current);
      delete host.dataset.tl;
      tl?.disable();
      comp.setQuestion({ options: current.options, question: current.text, context: current.context || "" });
    };

    function wrong(correctIndex) {
      if (correctIndex >= 0) comp.reveal(correctIndex);
      else comp.setEnabled(false);
      flashWrong();
      setTimeout(() => { if (enabled && !destroyed) showChoice(); }, WRONG_MS);
    }

    async function onChoose(i) {
      const c = current;
      if (!c || !enabled) return;
      const payload = quiz
        ? { attemptId: c.attemptId, q: c.q, choiceIndex: i }
        : { attemptId: c.attemptId, factorA: c.question.a, factorB: c.question.b, answer: String(c.options[i]), choiceIndex: i };
      const p = send(payload);
      if (!quiz) {
        if (i === c.answerIndex) {
          enabled = false;
          comp.setEnabled(false);
          onCorrect({ attemptId: c.attemptId, answerP: p });
        } else {
          p.catch((err) => { if (!destroyed) onProblem(err); });
          wrong(c.answerIndex);
        }
        return;
      }
      let res;
      try {
        res = await p;
      } catch (err) {
        if (destroyed) return;
        onProblem(err);
        // Samma försök igen (servern ger samma utfall för samma attemptId).
        if (enabled) showChoice(c);
        return;
      }
      if (destroyed) return;
      if (Number.isInteger(res?.nextQ)) nextQ = res.nextQ;
      if (res?.correct) {
        enabled = false;
        comp.setEnabled(false);
        onCorrect({ attemptId: c.attemptId, answerP: Promise.resolve(res) });
      } else {
        wrong(c.options.findIndex((o) => String(o) === String(res?.correctAnswer)));
      }
    }
  }

  // --- Tidslinjefrågor (#601) ---------------------------------------------------
  function ensureTl() {
    tlP ||= import(TL_URL).then(({ mountTimelineAnswer }) => {
      if (destroyed) return null;
      const box = host.ownerDocument.createElement("div");
      box.className = tlCls;
      host.appendChild(box);
      tl = mountTimelineAnswer(box, { span: { min: 1500, max: 1600 }, compact: true, enabled: false, celebrate: false, onLock });
      return tl;
    });
    return tlP;
  }

  async function showTimeline(c) {
    comp.setEnabled(false);
    host.dataset.tl = "";
    let t;
    try {
      t = await ensureTl();
    } catch (err) {
      tlP = null;
      if (!destroyed) onProblem(err);
      return;
    }
    if (!t || destroyed || current !== c || !enabled) return;
    const q = c.question;
    t.setQuestion({ span: q.span, question: c.text, context: [q.event, q.description].filter(Boolean).join(": ") });
    t.enable();
  }

  async function onLock(year) {
    const c = current;
    if (!c?.tl || !enabled) return;
    let res;
    try {
      res = await send({ attemptId: c.attemptId, q: c.q, year });
    } catch (err) {
      if (destroyed) return;
      onProblem(err);
      // Svaret finns redan (låst år) → vidare; annars samma försök igen.
      if (enabled) showChoice(err?.code === "already-exists" ? null : c);
      return;
    }
    if (destroyed) return;
    if (Number.isInteger(res?.nextQ)) nextQ = res.nextQ;
    if (res?.correct) {
      enabled = false;
      tl.disable();
      onCorrect({ attemptId: c.attemptId, answerP: Promise.resolve(res) });
      return;
    }
    if (Number.isInteger(res?.correctYear)) tl.reveal(res.correctYear);
    else tl.disable();
    flashWrong();
    setTimeout(() => { if (enabled && !destroyed && current === c) showChoice(); }, TL_WRONG_MS);
  }

  return {
    show() {
      if (destroyed) return;
      enabled = true;
      if (choice) showChoice();
      else comp.setEnabled(true);
    },
    hide() {
      enabled = false;
      tl?.disable();
      if (choice) comp.setEnabled(false);
      else comp.setEnabled(false, "");
    },
    setNextQ(n) {
      if (Number.isInteger(n)) nextQ = n;
    },
    destroy() {
      destroyed = true;
      clearTimeout(wrongT);
      tl?.destroy();
      comp.destroy();
    },
  };
}
