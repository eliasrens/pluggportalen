// ============================================================================
// Live `plugga_quiz` – lärarens val av ämne + arbetsområde (#553)
// ----------------------------------------------------------------------------
// "custom"-fältet i spellägets setupFields (live-setup-fields.js). Laddas latt
// av lärarformuläret (teacher-live-form.js) först när quizläget väljs. Visar
// hur många frågor området har och kan spelas – och en tydlig varning (för
// få, under formatets minQuestions) eller ett stopp (inga alls) – INNAN Skapa.
//
// API
//   mount(box, inner, { format?, content? }) → { sync(), value() }
//     format   formatet som valts (minQuestions + namnet i varningen)
//     content  { getSubjects(), getAreas(subjectId) } – default
//              src/data-content.js (dynamiskt); förhandsvisningen stubbar.
//   value() → { subjectId, areaId, subjectName, areaName, usable, total } | null
// ============================================================================

import { summarizeQuizArea, quizAreaMessage, minQuestionsFor } from "./plugga-quiz-core.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const nameOf = (x) => x?.name || x?.title || x?.id || "";

export function mount(box, inner, ctx = {}) {
  box.hidden = false;
  const minQuestions = minQuestionsFor(ctx.format);
  const contentP = ctx.content ? Promise.resolve(ctx.content) : import("../../data-content.js");
  inner.innerHTML = `<div class="live-quiz-pick">
      <select class="live-quiz-subject" aria-label="Ämne"><option value="">Laddar ämnen…</option></select>
      <select class="live-quiz-area" aria-label="Arbetsområde" disabled><option value="">Välj ämne först</option></select>
    </div>
    <p class="live-quiz-info hint" role="status" aria-live="polite"></p>`;
  const subjSel = inner.querySelector(".live-quiz-subject");
  const areaSel = inner.querySelector(".live-quiz-area");
  const info = inner.querySelector(".live-quiz-info");
  let subjects = [];
  let areas = [];
  let picked = null;
  let token = 0;

  function setInfo(level, text) {
    info.className = `live-quiz-info ${level === "ok" ? "hint" : `msg ${level === "warn" ? "warn" : "error"}`}`;
    info.textContent = text;
  }

  async function loadSubjects() {
    try {
      const content = await contentP;
      subjects = await content.getSubjects();
      subjSel.innerHTML = `<option value="">Välj ämne…</option>${subjects.map((s) =>
        `<option value="${esc(s.id)}">${esc(`${s.icon ? `${s.icon} ` : ""}${nameOf(s)}`)}</option>`).join("")}`;
    } catch (err) {
      subjSel.innerHTML = `<option value="">Kunde inte ladda ämnen</option>`;
      setInfo("error", `Kunde inte ladda ämnena: ${err.message}`);
    }
  }

  async function loadAreas(subjectId) {
    const my = ++token;
    picked = null;
    areas = [];
    info.textContent = "";
    areaSel.disabled = true;
    if (!subjectId) {
      areaSel.innerHTML = `<option value="">Välj ämne först</option>`;
      return;
    }
    areaSel.innerHTML = `<option value="">Laddar arbetsområden…</option>`;
    try {
      const content = await contentP;
      const list = await content.getAreas(subjectId);
      if (my !== token) return;
      areas = list.map((a) => ({ a, s: summarizeQuizArea(a.quiz, { minQuestions }) }));
      areaSel.innerHTML = `<option value="">Välj arbetsområde…</option>${areas.map(({ a, s }) =>
        `<option value="${esc(a.id)}">${esc(`${nameOf(a)} (${s.usable} ${s.usable === 1 ? "fråga" : "frågor"})`)}</option>`).join("")}`;
      areaSel.disabled = false;
      if (!areas.length) setInfo("error", "Ämnet har inga arbetsområden.");
    } catch (err) {
      if (my !== token) return;
      areaSel.innerHTML = `<option value="">Kunde inte ladda</option>`;
      setInfo("error", `Kunde inte ladda arbetsområdena: ${err.message}`);
    }
  }

  function pickArea(areaId) {
    const hit = areas.find(({ a }) => a.id === areaId);
    if (!hit) {
      picked = null;
      info.textContent = "";
      return;
    }
    const subject = subjects.find((s) => s.id === subjSel.value);
    picked = {
      subjectId: subjSel.value, areaId: hit.a.id, subjectName: nameOf(subject), areaName: nameOf(hit.a),
      usable: hit.s.usable, total: hit.s.total,
    };
    const m = quizAreaMessage(hit.s, ctx.format?.displayName || "");
    setInfo(m.level, m.text);
  }

  subjSel.addEventListener("change", () => loadAreas(subjSel.value));
  areaSel.addEventListener("change", () => pickArea(areaSel.value));
  loadSubjects();

  return {
    sync() {},
    value: () => picked,
  };
}
