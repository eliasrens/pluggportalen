// ============================================================================
// Snilleblixten – STATISTIKVYN på projektorn (#559, designspec §7). ANONYM
// (Elias 2026-10-10: projektorn får aldrig hänga ut elever): inga elevnamn,
// inga poäng och inga rätt per elev – bara klassen som helhet:
//   • nuläget: "Fråga 4 av 10 · ⏱ 12 s kvar · 17 av 24 har svarat"
//   • pågående frågans svarsfördelning – FÖRST efter avslöjandet (staplar per
//     alternativ med färg + form och rätt markerat / rätt svar, andel rätt och
//     vanligaste felsvaren). Under frågan visas inga svar (påverkar inte).
//   • andel rätt per fråga (vilka frågor klassen hade svårast för) + klassens
//     totala andel rätt.
// Hela listan per elev finns bara i lärarens historik (#560). Samma studio-
// färger och miljö (stilla). Lärarkontrollerna och automatiken finns här
// också (sb-koppling), så spelet går vidare även när läraren visar
// statistiken. finale: true – efter slutet står klassens summering kvar
// (pallplatsen visas i Studion).
//
// API: createStatsView(host, { st, actions, screen, deps }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { CHOICE_STYLES, choiceShapeSvg } from "../../choice-answer.js";
import { createSbKoppling } from "./sb-koppling.js";
import { ensureStudioCss, miljoHtml, logoHtml } from "./sb-miljo.js";
import { questionClock, revealInfo, classSummary } from "./sb-scen.js";
import { createKontroller } from "./sb-kontroller.js";

function fordelningHtml(q, sc, kind) {
  const info = revealInfo(q, sc, kind);
  const titel = `<h2 class="sbx-h">Fråga ${q.index + 1}: <span>${esc(q.question?.text || "")}</span></h2>`;
  if (q.phase === "skipped") return `${titel}<p class="sbx-tom">⏭ Frågan hoppades över.</p>`;
  if (!info.ready) return `${titel}<p class="sbx-tom">Svaren räknas …</p>`;
  if (info.kind === "choice") {
    const opts = q.question?.options || [];
    return `${titel}<ol class="sbx-alt">${info.counts.map((n, i) => `
      <li class="sbx-opt sbs-${CHOICE_STYLES[i].key}${i === info.correctIndex ? " sbx-ratt" : ""}">
        <span class="sbx-form">${choiceShapeSvg(i)}</span><span class="sbx-otext">${esc(opts[i] ?? "")}${i === info.correctIndex ? " ✓" : ""}</span>
        <span class="sbx-stapel"><i style="transform:scaleX(${(n / info.max).toFixed(3)})"></i></span><b>${n}</b></li>`).join("")}</ol>
      <p class="sbx-andel"><b>${info.share} %</b> rätt <small>(${info.correct} av ${info.answered} svar)</small></p>`;
  }
  const wrong = info.topWrong.map((w) => `<span>${esc(w.answer)} <small>(${w.n} st)</small></span>`).join(" · ");
  return `${titel}<p class="sbx-fritt">Rätt svar: <b>${esc(info.correctText)}</b></p>
    <p class="sbx-andel"><b>${info.share} %</b> rätt <small>(${info.correct} av ${info.answered} svar)</small></p>
    ${wrong ? `<p class="sbx-vanliga">Vanliga felsvar: ${wrong}</p>` : ""}`;
}

export function createStatsView(host, { st, actions = {}, screen = false, deps = null }) {
  ensureStudioCss();
  const sid = st.sessionId || st.session?.id;
  const root = document.createElement("div");
  root.className = "sb sb-stat sb-stilla";
  root.dataset.scene = "statistik";
  root.classList.toggle("sb-skarm", !!screen);
  root.innerHTML = `${miljoHtml()}
    <header class="sbx-topp">${logoHtml({ size: "liten" })}<div class="sbx-status" aria-live="polite"></div></header>
    <div class="sbx-grid">
      <section class="sbx-senaste" aria-label="Svarsfördelning"></section>
      <section class="sbx-perfraga" aria-label="Andel rätt per fråga"><h2 class="sbx-h">Andel rätt per fråga</h2><div class="sbx-staplar"></div></section>
    </div>
    <footer class="sbx-klass" aria-live="polite"></footer>`;
  host.replaceChildren(root);
  const $ = (q) => root.querySelector(q);
  let cur = st;
  let dead = false;
  let lastKey = "";
  const koppling = createSbKoppling({ sid, st, deps, actions, screen, onChange: () => render(), say: (t) => console.warn("Snilleblixten:", t) });
  const kontroll = screen ? null : createKontroller(root, { koppling });

  function render() {
    if (dead) return;
    const s = cur.session;
    if (!s) return;
    const q = s.q || null;
    const clock = q?.phase === "open" ? questionClock(s, koppling.now()) : null;
    const prog = q?.phase === "open" ? koppling.progress() : null;
    const status = cur.phase === "finished" ? "🏁 Matchen är slut"
      : q ? `Fråga ${q.index + 1} av ${s.questionCount}${clock ? ` · ⏱ <b class="${clock.tension ? "sbx-rod" : ""}">${clock.secs} s</b> kvar` : q.phase === "open" ? "" : " · ✔ klar"}${
        prog ? ` · <b>${prog.answered}</b> av <b>${prog.eligible}</b> har svarat` : ""}`
        : "Väntar på första frågan";
    if ($(".sbx-status").innerHTML !== status) $(".sbx-status").innerHTML = status;

    const scores = koppling.scores;
    const sc = q ? scores.find((x) => x.index === q.index) || null : null;
    const key = JSON.stringify([q?.index, q?.phase, !!q?.facit, scores.map((x) => [x.index, x.answered, x.correctCount, x.skipped]), s.questionCount]);
    if (key === lastKey) { kontroll?.update(); return; }
    lastKey = key;
    // Svarsfördelningen först efter avslöjandet (inget som påverkar svaren).
    $(".sbx-senaste").innerHTML = q && (q.phase === "revealed" || q.phase === "skipped")
      ? fordelningHtml(q, sc, s.answerKind)
      : `<h2 class="sbx-h">${q ? `Fråga ${q.index + 1} pågår` : "Snart börjar det!"}</h2><p class="sbx-tom">Svaren visas när rätt svar avslöjats.</p>`;
    const sum = classSummary(scores);
    const by = new Map(sum.perQuestion.map((x) => [x.index, x]));
    const total = Math.max(Number(s.questionCount) || 0, sum.perQuestion.length);
    $(".sbx-staplar").style.setProperty("--n", total);
    $(".sbx-staplar").innerHTML = Array.from({ length: total }, (_, i) => {
      const x = by.get(i);
      const label = !x ? "" : x.skipped ? "⏭" : `${x.share} %`;
      return `<div class="sbx-kol${x ? "" : " sbx-kommer"}${x?.skipped ? " sbx-hoppad" : ""}" title="${x && !x.skipped ? `Fråga ${i + 1}: ${x.correct} av ${x.answered} rätt` : `Fråga ${i + 1}`}">
        <span class="sbx-pct">${label}</span><span class="sbx-ror"><i style="transform:scaleY(${x && !x.skipped ? (x.share / 100).toFixed(3) : 0})"></i></span><b>${i + 1}</b></div>`;
    }).join("");
    $(".sbx-klass").innerHTML = sum.answered
      ? `Hela klassen: <b>${sum.share} %</b> rätt svar <small>(${sum.perQuestion.filter((x) => !x.skipped).length} av ${s.questionCount} frågor klara)</small>`
      : "";
    kontroll?.update();
  }

  const iv = setInterval(render, 250);
  render();
  return {
    update(next) {
      cur = next;
      koppling.update(next);
      render();
    },
    destroy() {
      dead = true;
      clearInterval(iv);
      koppling.destroy();
      kontroll?.destroy();
      root.remove();
    },
  };
}
