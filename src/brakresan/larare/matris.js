// ============================================================================
// Bråkresan – lärarens matris (src/brakresan/larare/matris.js) · K #716
// ----------------------------------------------------------------------------
// Spec §12 "Matris": elever i rader, de 50 utmaningarna i kolumner i fast
// nivåordning. Sticky namnkolumn, ämnesgrupperna som rubrikrad, horisontell
// scroll. Varje cell = en knapp med 0–3 stjärnor + symbol (status läsbar utan
// färg: – inte påbörjad, ↻ tränar, ◔ pågående omgång, ✓ bemästrad); färgen
// kompletterar. Klick → elevens resultat för just den utmaningen (individvyn).
// Ämnesfiltret visar en grupp åt gången. Inga nya läsningar – bara state.
// ============================================================================

import { avatarEmoji } from "../../avatars.js";
import { CHALLENGES, SECTIONS } from "../schema/katalog.js";
import { matrisCell } from "./statistik.js";
import { esc, namnPa } from "./vy-delat.js";

let filter = "alla";

function cellHtml(studentId, c, entry, saknas) {
  if (saknas) return `<td class="brm-cell brm-saknas"><span aria-label="kunde inte läsas">–</span></td>`;
  const m = matrisCell(entry);
  const stj = `${"★".repeat(m.stars)}${"☆".repeat(3 - m.stars)}`;
  return `<td class="brm-cell brm--${m.status}">
    <button type="button" class="brm-knapp" data-student="${esc(studentId)}" data-u="${c.id}"
      aria-label="${esc(`${c.id} ${c.name}: ${m.label}`)}" title="${esc(`${c.id} ${c.name}\n${m.label}`)}">
      <span class="brm-stj" aria-hidden="true">${stj}</span><span class="brm-sym" aria-hidden="true">${m.symbol || "&nbsp;"}</span>
    </button></td>`;
}

/**
 * @param {HTMLElement} host
 * @param {{ students: object[], stateAv: (id) => object|null, onCell: (studentId, challengeId) => void }} o
 */
export function ritaMatris(host, { students, stateAv, onCell }) {
  host.innerHTML = `<div class="brl-rad">
      <label for="brm-filter">Ämnesgrupp</label>
      <select id="brm-filter" class="brm-filter">
        <option value="alla">Alla 50 utmaningar</option>
        ${SECTIONS.map((s) => `<option value="${s.id}">${s.from}–${s.to} ${esc(s.name)}</option>`).join("")}
      </select>
    </div>
    <div class="brm-scroll" tabindex="0" role="region" aria-label="Matris: elever och utmaningar"><table class="brm"></table></div>
    <p class="cx-legend lrt-legend brm-legend">
      <span class="cx-legend-item"><b>★★☆</b> stjärnor (0–3)</span>
      <span class="cx-legend-item"><b>–</b> inte påbörjad</span>
      <span class="cx-legend-item"><b>↻</b> tränar, ingen stjärna än</span>
      <span class="cx-legend-item"><b>◔</b> pågående omgång</span>
      <span class="cx-legend-item"><b>✓</b> bemästrad (3 stjärnor)</span>
      <span class="cx-legend-tip">Klicka på en ruta för elevens resultat i utmaningen</span>
    </p>`;
  const tabell = host.querySelector(".brm");
  const sel = host.querySelector(".brm-filter");
  sel.value = filter;
  const rita = () => {
    const grupper = SECTIONS.filter((s) => filter === "alla" || s.id === filter);
    const kol = grupper.flatMap((s) => CHALLENGES.filter((c) => c.section === s.id));
    tabell.innerHTML = `<thead>
      <tr><th scope="col" rowspan="2" class="brm-namn brm-hornet">Elev</th>${grupper.map((s) =>
        `<th scope="colgroup" colspan="${s.to - s.from + 1}" class="brm-grupp brm-grupp--${s.id}">${esc(s.name)} <span class="brm-ak">åk ${esc(s.grade)}</span></th>`).join("")}</tr>
      <tr>${kol.map((c) => `<th scope="col" class="brm-kol brm-grupp--${c.section}" title="${esc(`${c.id} ${c.name}`)}"><abbr title="${esc(c.name)}">${c.id}</abbr></th>`).join("")}</tr>
    </thead>
    <tbody>${students.map((s) => {
      const st = stateAv(s.id);
      return `<tr><th scope="row" class="brm-namn"><span class="cx-avatar">${avatarEmoji(s.avatarId)}</span> <span>${esc(namnPa(s))}</span></th>
        ${kol.map((c) => cellHtml(s.id, c, st?.challenges?.[c.id], !st)).join("")}</tr>`;
    }).join("")}</tbody>`;
  };
  sel.addEventListener("change", () => {
    filter = sel.value;
    rita();
  });
  tabell.addEventListener("click", (e) => {
    const b = e.target.closest(".brm-knapp");
    if (b) onCell(b.dataset.student, b.dataset.u);
  });
  rita();
}
