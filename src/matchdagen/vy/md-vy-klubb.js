// ============================================================================
// Matchdagen (#869): klubbens namn och tröjfärg (spec §5, §14) – formuläret för
// en ny klubb (Match-fliken första gången) och för att döpa om laget (Truppen).
// Namnet 1–24 tecken (lagnamnOk), en av de 8 tröjfärgerna.
//
//   klubbFormular(el, { namn, farg, knapp, rubrik?, text? }) → Promise<{ namn, farg }>
// ============================================================================

import { TROJFARGER, TROJFARG_NAMN } from "../delat/md-namn.js";
import { LAGNAMN_MAX } from "../delat/md-config.js";
import { lagnamnOk } from "../delat/md-sasong.js";
import { esc } from "./md-vy-delat.js";

export const fargKnappar = (vald) => `<div class="md-farger" role="radiogroup" aria-label="Lagets tröjfärg">${TROJFARGER.map((f, i) =>
  `<button type="button" class="md-farg" role="radio" data-farg="${f}" style="background:${f}" aria-label="${TROJFARG_NAMN[i]}" aria-checked="${f === vald}"></button>`).join("")}</div>`;

export function klubbFormular(el, { namn = "", farg = TROJFARGER[0], knapp = "Spara", rubrik = "", text = "" }) {
  return new Promise((ok) => {
    let valdFarg = TROJFARGER.includes(farg) ? farg : TROJFARGER[0];
    el.innerHTML = `<form class="md-klubb" autocomplete="off" novalidate>
      ${rubrik ? `<h2>${rubrik}</h2>` : ""}${text ? `<p class="md-svag">${text}</p>` : ""}
      <label class="md-etikett" for="md-lagnamn">Lagets namn</label>
      <input id="md-lagnamn" class="md-namnfalt" maxlength="${LAGNAMN_MAX}" value="${esc(namn)}" placeholder="t.ex. Blixtarna IF" spellcheck="false" />
      <p class="md-etikett">Tröjfärg</p>
      ${fargKnappar(valdFarg)}
      <p class="md-fel" aria-live="polite"></p>
      <button type="submit" class="md-stor">${esc(knapp)}</button>
    </form>`;
    const form = el.querySelector("form");
    const input = form.querySelector("input");
    form.querySelectorAll(".md-farg").forEach((b) => b.addEventListener("click", () => {
      valdFarg = b.dataset.farg;
      form.querySelectorAll(".md-farg").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const n = lagnamnOk(input.value);
      if (!n) {
        form.querySelector(".md-fel").textContent = `Skriv ett namn på 1–${LAGNAMN_MAX} tecken.`;
        input.focus();
        return;
      }
      ok({ namn: n, farg: valdFarg });
    });
    input.focus({ preventScroll: true });
  });
}
