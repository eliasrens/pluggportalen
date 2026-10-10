// ============================================================================
// Snilleblixten – TV-studion (#559): LÄRARKONTROLLERNA i projektorvyn
// (funktionsspec §5.6) – läraren behöver aldrig lämna vyn:
//   NÄSTA FRÅGA (efter avslöjandet; sista frågan → "🏆 Till pallen") ·
//   Avsluta frågan nu · Hoppa över fråga · Avsluta spelet (bekräftelse).
// Ljud på/av och fullskärm ligger kvar i skalets verktygsrad (projector.js).
// Varje knapp går till kopplingens transaktioner (sb-koppling.js →
// snilleblixt-data.js) som utgår från AKTUELLT frågeindex – två lärare som
// trycker samtidigt ger exakt ett steg. Knappen är låst medan steget pågår.
// Visas inte på elevskärmen (#533).
//
// API
//   createKontroller(host, { koppling }) → { update(), el, destroy() }
// ============================================================================

export function createKontroller(host, { koppling }) {
  const root = document.createElement("div");
  root.className = "sbc";
  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Lärarens kontroller");
  root.innerHTML = `
    <button class="sbc-nasta" data-a="next"></button>
    <button class="sbc-btn" data-a="close" title="Stäng frågan innan tiden är slut">⏹ Avsluta frågan nu</button>
    <button class="sbc-btn" data-a="skip" title="Hoppa över frågan – inga poäng delas ut">⏭ Hoppa över</button>
    <button class="sbc-btn sbc-fara" data-a="end">✖ Avsluta spelet</button>
    <span class="sbc-hint" aria-live="polite"></span>`;
  host.appendChild(root);
  const $ = (s) => root.querySelector(s);
  let busy = false;

  async function run(action) {
    if (busy) return;
    if (action === "end" && !confirm("Avsluta Snilleblixten NU? Ställningen räknas som den står – frågor som inte avslöjats räknas inte.")) return;
    busy = true;
    update();
    try {
      if (action === "next") await koppling.next();
      else if (action === "close") await koppling.closeNow();
      else if (action === "skip") await koppling.skip();
      else if (action === "end") await koppling.endGame();
    } finally {
      busy = false;
      update();
    }
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]");
    if (b && !b.disabled) run(b.dataset.a);
  });

  function update() {
    const c = koppling.controls();
    const nb = $(".sbc-nasta");
    nb.hidden = !c.next;
    const txt = c.next === "finish" ? "🏆 Till pallen!" : "NÄSTA FRÅGA ▶";
    if (nb.textContent !== txt) nb.textContent = txt;
    nb.disabled = busy;
    $('[data-a="close"]').hidden = !c.closeNow;
    $('[data-a="close"]').disabled = busy;
    $('[data-a="skip"]').hidden = !c.skip;
    $('[data-a="skip"]').disabled = busy;
    $('[data-a="end"]').hidden = !c.end;
    $('[data-a="end"]').disabled = busy;
    const hint = c.next ? "" : c.closeNow ? "Frågan pågår …" : c.skip ? "Rätt svar på väg …" : "";
    if ($(".sbc-hint").textContent !== hint) $(".sbc-hint").textContent = hint;
    root.hidden = !c.end;
  }

  update();
  return { el: root, update, destroy() { root.remove(); } };
}
