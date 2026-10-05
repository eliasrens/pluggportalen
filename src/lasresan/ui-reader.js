// ============================================================================
// Läsresan – läsvyn (src/lasresan/ui-reader.js)  ·  STUB (issue #399)
// ----------------------------------------------------------------------------
// KONTRAKT (byggs ut på riktigt i issue #401 – behåll signaturen):
//
//   renderReader(container, {
//     text,     // ReadingText enligt Innehållskontraktet (docs/LASRESAN.md)
//     onDone,   // (result) => void, anropas EN gång när sista frågan besvarats
//   }) → { destroy() }
//
//   result = { answers: [{ qid, chosen }] }
//     chosen = index i textens ORIGINALordning av `options` (0–3), även om vyn
//     blandar visningsordningen. Rättning, procent, pengar och nivå räknas av
//     kärnan (data-lasresan.completeText) – vyn skickar bara valen.
//
// Spec §7: texten står kvar hela tiden, EN fråga i taget, 4 alternativ, svaret
// låses direkt, ✅/❌ visas, sedan nästa fråga. Visa ALDRIG nivån.
// Stubben ritar texten och alla frågor som enkla knappar i följd.
// ============================================================================

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function renderReader(container, { text, onDone } = {}) {
  const answers = [];
  let i = 0;
  const paras = String(text.body || "").split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join("");
  container.innerHTML = `
    <div class="panel lasresan-reader-stub">
      <h2>${esc(text.title)}</h2>
      <div class="lasresan-text">${paras}</div>
      <div class="lasresan-question" data-lr-q></div>
    </div>`;
  const host = container.querySelector("[data-lr-q]");
  function show() {
    const q = text.questions[i];
    host.innerHTML = `<p><strong>${esc(q.question)}</strong></p>` +
      q.options.map((o, k) => `<button class="btn" type="button" data-k="${k}">${esc(o)}</button>`).join(" ");
  }
  function onClick(e) {
    const b = e.target.closest("button[data-k]");
    if (!b || host.dataset.locked) return;
    host.dataset.locked = "1";
    const q = text.questions[i];
    const chosen = Number(b.dataset.k);
    answers.push({ qid: q.id, chosen });
    b.insertAdjacentText("beforeend", chosen === q.answerIndex ? " ✅" : " ❌");
    setTimeout(() => {
      delete host.dataset.locked;
      i += 1;
      if (i < text.questions.length) show();
      else if (onDone) onDone({ answers });
    }, 600);
  }
  host.addEventListener("click", onClick);
  show();
  return { destroy: () => host.removeEventListener("click", onClick) };
}
