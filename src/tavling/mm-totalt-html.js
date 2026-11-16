// ============================================================================
// Mattematchen – tabellen "Totalt per klass" som HTML (#863)
// ----------------------------------------------------------------------------
// Ren modul (ingen DOM/Firebase) → testas i Node (test/mm-teacher-totalt-863).
// Vyn (teacher-mm-totalt.js) sätter in den. Indata = mm-teacher-core.classTotals.
//   Klass | Rätt | Fel | Felprocent
//   klasserna årskursvis med "Åk N totalt" efter varje (bara om > 1 årskurs),
//   sedan "Mina klasser" (årskurskonto) och/eller "Hela skolan".
// ============================================================================

import { formatFelprocent } from "./mm-teacher-core.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const dash = `<span class="lrt-dash" aria-label="inga svar än">–</span>`;
// Kapat result (#863 F3): en klass utan rader kan ha svar som inte sparades.
const okant = `<span class="lrt-dash mmt-okant" title="Kan saknas i det kapade resultatet" aria-label="okänt – kapat resultat">?</span>`;

function rad(r, cls = "", kapad = false) {
  const n = (v) => (r.total > 0 ? String(v) : kapad ? okant : dash);
  const namn = cls ? `<th scope="row">${esc(r.name)}</th>` : `<td>${esc(r.name)}</td>`;
  return `<tr class="${cls}">${namn}<td class="lrt-num">${n(r.correct)}</td><td class="lrt-num">${n(r.incorrect)}</td>
    <td class="lrt-num">${formatFelprocent(r.pctWrong)}</td></tr>`;
}

/** Tabellens HTML ur classTotals-resultatet. */
export function totalsHtml(t) {
  if (!t.rows.length) return `<p class="hint">Inga klasser att visa.</p>`;
  const body = [];
  // Flera årskurser: klasserna årskursvis med en delsumma efter varje; annars bara klasserna.
  if (t.arskurser.length) {
    for (const a of t.arskurser) {
      body.push(...t.rows.filter((r) => r.ak === a.ak).map((r) => rad(r, "", t.kapad)));
      body.push(rad({ ...a, name: `${a.label} totalt` }, "mmt-tot-ak", t.kapad));
    }
  } else {
    body.push(...t.rows.map((r) => rad(r, "", t.kapad)));
  }
  // "Mina klasser" bara när den säger något mer än den enda klassraden.
  if (t.mina && t.rows.length > 1) body.push(rad({ ...t.mina, name: "Mina klasser" }, "mmt-tot-skola", t.kapad));
  if (t.skola) body.push(rad({ ...t.skola, name: t.skolanLabel }, "mmt-tot-skola", t.kapad));
  return `<div class="table-scroll"><table class="tbl mmt-totalt-tbl">
    <thead><tr><th scope="col">Klass</th><th scope="col" class="lrt-num">Rätt</th>
      <th scope="col" class="lrt-num">Fel</th><th scope="col" class="lrt-num">Felprocent</th></tr></thead>
    <tbody>${body.join("")}</tbody></table></div>`;
}
