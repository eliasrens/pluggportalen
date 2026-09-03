// ============================================================================
// Pluggportalen – klassbyn (by-nivån i husvärldens kamera)
// ----------------------------------------------------------------------------
// Ritar innehållet i by-lagret: en gräsby med vägar (layout-matten ligger i
// varld-by.js) och ETT minihus per elev i klassen, med elevens egen palett och
// avatar framför (husMini i art-hus-ute.js – samma husskal + avatar-rigg som
// ute-scenen, så skalningen blir automatiskt proportionerlig). Den egna tomten
// märks med "Du!" och blir kamerans fokuspunkt när man zoomar by ↔ hus.
//
// Modulen är ren rendering: klick-hantering (eget hus → zooma in, kamratens
// hus → deras rum i läsläge) kopplas av pages-varld.js via .by-tomt[data-id].
// ============================================================================

import { byLayout, byParams, byVagarSvg, BY_ZOOM } from "./varld-by.js";
import { husMini, DEFAULT_HUS_SKAL } from "./art-hus-ute.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { getPalette } from "./room-palettes.js";

/** Minimal HTML-escape för elevnamn/id:n som kommer från Firestore. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/**
 * Rita byn i `lager` (ett .varld-lager-element).
 *
 * @param {object} o
 * @param {HTMLElement} o.lager  by-lagret (töms och fylls)
 * @param {string} o.meId       inloggade elevens id (märks "Du!")
 * @param {Array<{id:string, namn?:string, username?:string, avatarId?:string,
 *   avatarItems?:string[], paletteId?:string, husSkalId?:string}>} o.students
 *   eleverna som ska bo i byn, i visningsordning (tomt 0 = första).
 * @returns {{fokus:{x:number,y:number}, zoom:number,
 *   fokusById:Record<string,{x:number,y:number}>}}
 *   kamerafokus (den egna tomtens mitt) + zoom för by-nivån, samt en karta
 *   id → tomtfokus för VARJE elev (kompis-hus-nivån zoomar mot en kamrats tomt).
 */
export function mountByScen({ lager, meId, students }) {
  const layout = byLayout(byParams(students.length));

  // Marken: himmelsrand + gräs + vägarna mellan husraderna. viewBox 0 0 100 100
  // + preserveAspectRatio="none" gör att procentkoordinaterna (samma som
  // kamerans fokus och tomternas left/top) mappar 1:1 mot lagret.
  const mark = `<svg class="by-mark" viewBox="0 0 100 100" preserveAspectRatio="none"
      aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <rect x="-2" y="-2" width="104" height="104" fill="#A8DA8F"/>
    <rect x="-2" y="-2" width="104" height="8" fill="#9AD3F0"/>
    <path d="M-2 6 Q25 4 50 6 Q75 8 102 5.5 L102 9 L-2 9 Z" fill="#8FCB74"/>
    ${byVagarSvg(layout)}
  </svg>`;

  const tomter = students
    .map((s, i) => {
      const t = layout.tomter[i];
      if (!t) return "";
      const me = s.id === meId;
      const namn = esc(s.namn || s.username || s.id);
      const pal = getPalette(s.paletteId);
      const aria = me ? "Ditt hus – zooma in" : `${namn}s hus – titta in i deras rum`;
      return `<div class="by-tomt${me ? " du" : ""}" role="button" tabindex="0"
        data-id="${esc(s.id)}"${me ? ` data-me="1"` : ""} aria-label="${aria}"
        style="left:${t.x.toFixed(2)}%;top:${t.y.toFixed(2)}%;width:${layout.cellW.toFixed(2)}%;height:${layout.radHojd.toFixed(2)}%;--hus-house:${pal.house};--hus-roof:${pal.roof};--hus-wall:${pal.wall};--hus-wall2:${pal.wall2}">
        ${me ? '<span class="by-du">Du!</span>' : ""}
        ${husMini({
          skalId: s.husSkalId || DEFAULT_HUS_SKAL,
          avatarHtml: avatarMarkup(s.avatarId || DEFAULT_AVATAR, s.avatarItems || []),
        })}
        <span class="by-namn">${namn}</span>
      </div>`;
    })
    .join("");

  lager.innerHTML = mark + tomter;

  // Kamerafokus per elev-id (den egna tomten OCH alla kamraters) – används
  // av by↔hus (egen) och kompis-hus-nivån (en klickad kamrats tomt).
  const fokusById = {};
  students.forEach((s, i) => {
    const t = layout.tomter[i];
    if (t) fokusById[s.id] = layout.fokusFor(t);
  });

  const minIndex = students.findIndex((s) => s.id === meId);
  const minTomt = layout.tomter[minIndex] || layout.tomter[0];
  return { fokus: layout.fokusFor(minTomt), zoom: BY_ZOOM, fokusById };
}
