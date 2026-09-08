// ============================================================================
// Pluggportalen – lärarsidan: nivå- och frågeredigerarna för läsförståelse
// (teacher-reading-level.js)
// ----------------------------------------------------------------------------
// Utbrutet ur teacher-reading.js för att hålla den under radtaket: de rena
// DOM-byggarna för EN kryssfråga (questionEditor) och för den aktiva nivåns
// panel (levelPane, brödtext + frågelista). De muterar objekten de får (q, t)
// direkt – ingen egen state, inget Firestore – och används av editor-skalet.
// All inmatning skrivs in säkert via .value (aldrig rå HTML).
// ============================================================================

import { el, esc } from "./teacher-shared.js";

/** En tom kryssfråga (4 alternativ, första som rätt). */
export function blankQuestion() {
  return { question: "", options: ["", "", "", ""], answerIndex: 0, explanation: "" };
}

/** Editor för EN fråga (frågetext, alternativ med radioknapp för rätt svar). */
export function questionEditor(q, qi, onRemove) {
  const box = el(`<div class="rt-q"></div>`);
  const head = el(`<div class="rt-q-head"><span class="badge">Fråga ${qi + 1}</span></div>`);
  const delQ = el(`<button type="button" class="btn ghost small danger">🗑️ Ta bort</button>`);
  delQ.addEventListener("click", () => onRemove(qi));
  head.appendChild(delQ);

  const qIn = el(`<textarea class="rt-input" rows="2" placeholder="Skriv frågan…"></textarea>`);
  qIn.value = q.question;
  qIn.addEventListener("input", () => (q.question = qIn.value));

  const optsWrap = el(`<div class="rt-opts"></div>`);
  const rname = "rt-ans-" + Math.random().toString(36).slice(2, 8);
  function renderOpts() {
    optsWrap.replaceChildren();
    q.options.forEach((o, oi) => {
      const row = el(`<label class="rt-opt"></label>`);
      const radio = el(`<input type="radio" name="${rname}" title="Markera det rätta svaret" />`);
      radio.checked = q.answerIndex === oi;
      radio.addEventListener("change", () => (q.answerIndex = oi));
      const inp = el(`<input type="text" class="rt-input" placeholder="Svarsalternativ ${oi + 1}" />`);
      inp.value = o;
      inp.addEventListener("input", () => (q.options[oi] = inp.value));
      const del = el(`<button type="button" class="btn ghost small danger" title="Ta bort alternativet">✕</button>`);
      del.addEventListener("click", () => {
        if (q.options.length <= 2) return;
        q.options.splice(oi, 1);
        if (q.answerIndex >= q.options.length) q.answerIndex = 0;
        renderOpts();
      });
      row.append(radio, inp, del);
      optsWrap.appendChild(row);
    });
  }
  renderOpts();

  const addOpt = el(`<button type="button" class="btn ghost small">➕ Alternativ</button>`);
  addOpt.addEventListener("click", () => {
    if (q.options.length < 6) {
      q.options.push("");
      renderOpts();
    }
  });

  const expl = el(`<input type="text" class="rt-input" placeholder="Förklaring till rätt svar (valfritt)" />`);
  expl.value = q.explanation || "";
  expl.addEventListener("input", () => (q.explanation = expl.value));

  box.append(
    head,
    qIn,
    el(`<div class="rt-lbl hint">Svarsalternativ (markera det rätta):</div>`),
    optsWrap,
    addOpt,
    el(`<div class="rt-lbl hint" style="margin-top:8px">Förklaring:</div>`),
    expl
  );
  return box;
}

/** Panel för den aktiva nivån av en läs-text: brödtext + frågor. */
export function levelPane(t) {
  const lvl = t._active;
  const L = t.levels[lvl];
  const pane = el(`<div class="rt-level"></div>`);

  const bodyLbl = el(`<div class="rt-lbl hint">📄 Text för nivå ${esc(lvl)} (skriv gärna flera stycken – tomrad mellan):</div>`);
  const body = el(`<textarea class="rt-input rt-body" rows="6" placeholder="Läs-texten för nivå ${esc(lvl)}…"></textarea>`);
  body.value = L.body;
  body.addEventListener("input", () => (L.body = body.value));

  const qHead = el(`<div class="rt-lbl hint" style="margin-top:12px">❓ Kryssfrågor för nivå ${esc(lvl)} (${L.questions.length} st, håll 3–5):</div>`);
  const qList = el(`<div class="rt-qlist"></div>`);
  function renderQs() {
    qList.replaceChildren();
    L.questions.forEach((q, qi) =>
      qList.appendChild(
        questionEditor(q, qi, (idx) => {
          L.questions.splice(idx, 1);
          renderQs();
          qHead.textContent = `❓ Kryssfrågor för nivå ${lvl} (${L.questions.length} st, håll 3–5):`;
        })
      )
    );
  }
  renderQs();

  const addQ = el(`<button type="button" class="btn ghost small">➕ Lägg till fråga</button>`);
  addQ.addEventListener("click", () => {
    L.questions.push(blankQuestion());
    renderQs();
    qHead.textContent = `❓ Kryssfrågor för nivå ${lvl} (${L.questions.length} st, håll 3–5):`;
  });

  pane.append(bodyLbl, body, qHead, qList, addQ);
  return pane;
}
