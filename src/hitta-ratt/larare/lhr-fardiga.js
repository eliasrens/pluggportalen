// ============================================================================
// Hitta rätt! – "Färdiga områden" (src/hitta-ratt/larare/lhr-fardiga.js) · #634
// ----------------------------------------------------------------------------
// #/larare/hitta-ratt?vy=fardiga. De officiella packen ur content/packs/index.json,
// grupperade som på elevens startsida. Per pack: "Visa innehåll" (frågorna ur
// packs/<id>.json), "Provspela" och "Duplicera till Mina områden" (→ osparad kopia
// i formuläret). Inga Firestore-läsningar.
// ============================================================================

import { el, esc, icon } from "../../teacher-shared.js";
import { grupperaPack, PACK_IKON, SVARIGHET } from "../hr-start-vy.js";
import { TYPER, geoNamn } from "./lhr-modell.js";
import { hamtaOfficielltPack, hamtaPackIndex } from "./lhr-data.js";

const HASH = "#/larare/hitta-ratt";

/** Frågorna i ett pack som en lista (lärarvyn får visa namnen). */
export function innehallHtml(pack) {
  const items = pack?.items || [];
  if (!items.length) return `<p class="hint">Inga frågor.</p>`;
  return `<ol class="lhr-innehall">${items.map((it) => `<li><b>${esc(it.name)}</b>${
    it.prompt ? ` <span class="hint">– ${esc(it.prompt)}</span>` : ""}</li>`).join("")}</ol>`;
}

/** Koppla "Visa innehåll" på en knapp: hämtar packet första gången och fäller ut/ihop. */
export function kopplaInnehall(knapp, ruta, hamta) {
  let laddad = false;
  knapp.addEventListener("click", async () => {
    const oppen = !ruta.hidden;
    ruta.hidden = oppen;
    knapp.setAttribute("aria-expanded", String(!oppen));
    knapp.lastElementChild.textContent = oppen ? "Visa innehåll" : "Dölj innehåll";
    if (oppen || laddad) return;
    ruta.innerHTML = `<div class="spinner">Laddar…</div>`;
    try {
      ruta.innerHTML = innehallHtml(await hamta());
      laddad = true;
    } catch {
      ruta.innerHTML = `<p class="err-inline">Innehållet gick inte att hämta.</p>`;
    }
  });
}

function kortHtml(p) {
  const typ = TYPER[p.type] || TYPER.point;
  const sv = SVARIGHET[p.difficulty] || SVARIGHET.medel;
  return `<article class="lhr-kort" data-pack="${esc(p.id)}">
    <div class="lhr-kort-topp">
      <span class="lhr-kort-ikon" aria-hidden="true">${PACK_IKON[p.id] || typ.ikon}</span>
      <div><h3 class="lhr-kort-namn">${esc(p.title)}</h3>
        <p class="hint">${esc(p.description || "")}</p></div>
    </div>
    <div class="lhr-taggar">
      <span class="lhr-tagg">${typ.ikon} ${typ.namn}</span>
      <span class="lhr-tagg">${Number(p.antal) || 0} frågor</span>
      <span class="lhr-tagg">${esc(geoNamn(p.geo))}</span>
      <span class="lhr-tagg lhr-niva-${sv.farg}">${sv.namn}</span>
    </div>
    <div class="lhr-knappar">
      <button type="button" class="btn small ghost" data-act="innehall" aria-expanded="false">${icon("book", 16)}<span>Visa innehåll</span></button>
      <button type="button" class="btn small ghost" data-act="prov">${icon("eye", 16)}<span>Provspela</span></button>
      <button type="button" class="btn small" data-act="kopia">${icon("copy", 16)}<span>Duplicera till Mina områden</span></button>
    </div>
    <div class="lhr-innehall-ruta" hidden></div>
  </article>`;
}

export async function renderFardiga(ctx, host) {
  host.replaceChildren(el(`<div class="spinner">Laddar…</div>`));
  let index;
  try {
    index = await hamtaPackIndex();
  } catch {
    host.replaceChildren(el(`<p class="err-inline">De färdiga områdena gick inte att ladda. Ladda om sidan.</p>`));
    return;
  }
  const vy = el(`<div class="lhr-fardiga">
    <p class="hint lhr-ingress">Områdena som följer med Hitta rätt!. Alla klasser med modulen påslagen ser dem.
      Provspela för att se hur eleverna möter dem, eller duplicera ett område och gör det till ditt eget.</p>
    ${grupperaPack(index).map((g) => `<section class="lhr-grupp">
      <h2 class="subhead"><span aria-hidden="true">${g.ikon}</span> ${esc(g.namn)}</h2>
      <div class="lhr-kort-grid">${g.pack.map(kortHtml).join("")}</div>
    </section>`).join("")}
  </div>`);
  vy.querySelectorAll(".lhr-kort").forEach((kort) => {
    const id = kort.dataset.pack;
    kopplaInnehall(kort.querySelector('[data-act="innehall"]'), kort.querySelector(".lhr-innehall-ruta"), () => hamtaOfficielltPack(id));
    kort.querySelector('[data-act="prov"]').addEventListener("click", () => ctx.go(`${HASH}?prov=${encodeURIComponent(id)}&fran=fardiga`));
    kort.querySelector('[data-act="kopia"]').addEventListener("click", () => ctx.go(`${HASH}?vy=ny&kopia=${encodeURIComponent(id)}`));
  });
  host.replaceChildren(vy);
}
