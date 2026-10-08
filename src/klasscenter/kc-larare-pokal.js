// ============================================================================
// Klasscentret – lärarsidans pokalblock, rena delar (#528). Ingen DOM/
// Firebase → testas i Node (test/kc-larare-pokal.test.js). Kopplingen är
// teacher-class-pokaler.js (dynamisk).
// ----------------------------------------------------------------------------
// API
//   lasresanRad(antal) → { antal, nadda: number[], nasta: number|null, text }
//   motivHtml(valt?)   → radioknappar med en bild per LARAR_MOTIV
//   formularHtml()     → hela "Dela ut en egen pokal"-formuläret
//   pokalListaHtml(pokaler) → klassens pokaler (Pokal[] ur normaliseraPokaler);
//       lärarens egna får en Ta bort-knapp (data-kc-ta-bort="<id>")
// ============================================================================

import { kcPokalSvg } from "../art-klasscenter-pokaler.js";
import {
  LARAR_MOTIV, LASRESAN_MILSTOLPAR, POKAL_DETALJ_MAX, POKAL_TITEL_MAX, lasresanMilstolpar, pokalTooltip,
} from "./kc-pokal-typer.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Läsresan-läget för klassen: hur långt till nästa milstolpe. */
export function lasresanRad(antal) {
  const n = Math.max(0, Math.floor(Number(antal) || 0));
  const nadda = lasresanMilstolpar(n);
  const nasta = LASRESAN_MILSTOLPAR.find((m) => m > n) ?? null;
  const text = nasta == null
    ? `Klassen har läst ${n} godkända Läsresan-texter – alla milstolpar är nådda! 🎉`
    : `Klassen har läst ${n} godkända Läsresan-texter tillsammans. ` +
      `Nästa pokal vid ${nasta} (${nasta - n} kvar).`;
  return { antal: n, nadda, nasta, text };
}

export function motivHtml(valt = LARAR_MOTIV[0].id) {
  return LARAR_MOTIV.map((m) => `<label class="kclp-motiv">
      <input type="radio" name="kclp-motiv" value="${m.id}"${m.id === valt ? " checked" : ""} />
      <span class="kclp-motiv-bild">${kcPokalSvg(m.art, { animera: false }) || "🏆"}</span>
      <span>${esc(m.namn)}</span>
    </label>`).join("");
}

export function formularHtml() {
  return `<form class="kclp-form" autocomplete="off">
    <div class="kclp-motiv-rad" role="radiogroup" aria-label="Pokalmotiv">${motivHtml()}</div>
    <label class="kclp-falt">Titel
      <input type="text" name="titel" maxlength="${POKAL_TITEL_MAX}" required
        placeholder="Bästa samarbetet i oktober!" />
    </label>
    <label class="kclp-falt">Text (valfri)
      <textarea name="text" rows="2" maxlength="${POKAL_DETALJ_MAX}"
        placeholder="För att ni hjälpte varandra med bråken hela veckan."></textarea>
    </label>
    <div class="row-inline">
      <button type="submit" class="btn gron small">🏆 <span>Dela ut pokalen</span></button>
      <span class="kclp-resultat"></span>
    </div>
  </form>`;
}

export function pokalListaHtml(pokaler = []) {
  if (!pokaler.length) return `<p class="hint">Klassen har inga pokaler än.</p>`;
  return `<ul class="kclp-lista">${pokaler.map((p) => {
    const tt = pokalTooltip(p);
    const fot = [tt.detalj, tt.datum].filter(Boolean).map(esc).join(" · ");
    const egen = p.typ === "larare";
    return `<li class="kclp-rad">
      <span class="kclp-bild">${kcPokalSvg(p.art, { animera: false }) || "🏆"}</span>
      <span class="kclp-info"><b>${esc(tt.rubrik)}</b>${tt.text ? `<span>${esc(tt.text)}</span>` : ""}
        ${fot ? `<small>${fot}${egen ? " · från läraren" : ""}</small>` : ""}</span>
      ${egen ? `<button type="button" class="btn ghost small danger" data-kc-ta-bort="${esc(p.id)}">Ta bort</button>` : ""}
    </li>`;
  }).join("")}</ul>`;
}
