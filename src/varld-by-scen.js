// ============================================================================
// Pluggporten – klassbyn (by-nivån i husvärldens kamera)
// ----------------------------------------------------------------------------
// Ritar innehållet i by-lagret: en gräsby med vägar (layout-matten ligger i
// varld-by.js) och ETT minihus per elev i klassen, med elevens egen palett och
// avatar framför (husMini i art-hus-ute.js – samma husskal + avatar-rigg som
// ute-scenen, så skalningen blir automatiskt proportionerlig). Den egna tomten
// märks med "Du!" och blir kamerans fokuspunkt när man zoomar by ↔ hus.
//
// Modulen är ren rendering: klick-hantering (eget hus → zooma in, kamratens
// hus → deras rum i läsläge) kopplas av pages-varld.js via .by-tomt[data-id].
//
// Klasscentret (#480, epic #476): med `klasscenter` tar byns hjärta de första
// 2–3 platserna i slingan (varld-by.js) och ritas i en egen .by-klasscenter-
// ruta (INTE .by-tomt, så hus-klicken i pages-varld/grannbyn rör den inte).
// Byggnad, mätare och klick fylls av klasscenter/kc-by.js som laddas
// DYNAMISKT – den och art-klasscenter*.js hålls utanför bootgrafen (#271).
// ============================================================================

import { byLayout, byParams, byVagarSvg, byDekor, BY_ZOOM } from "./varld-by.js";
import { DEKOR_ART, DEKOR_MATT, dekorMarkSvg } from "./art-by-dekor.js";
import { husMini, DEFAULT_HUS_SKAL } from "./art-hus-ute.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { getPalette } from "./room-palettes.js";
import { possessiv } from "./text-format.js";

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
 * @param {{classId:string, visaOnly?:boolean, klassNamn?:string,
 *   kalla?:Function}|null} [o.klasscenter]  rita klassens Klasscenter först i
 *   slingan (null/utelämnad = ingen klass → ingen plats reserveras). visaOnly =
 *   grannby (en annan klass). kalla = EXP-källa (preview), se kc-by.js.
 * @returns {{fokus:{x:number,y:number}, zoom:number,
 *   fokusById:Record<string,{x:number,y:number}>,
 *   klasscenterFokus:{x:number,y:number}|null}}
 *   kamerafokus (den egna tomtens mitt) + zoom för by-nivån, samt en karta
 *   id → tomtfokus för VARJE elev (kompis-hus-nivån zoomar mot en kamrats tomt).
 */
export function mountByScen({ lager, meId, students, klasscenter = null }) {
  const kc = klasscenter && klasscenter.classId ? klasscenter : null;
  const layout = byLayout(byParams(students.length, { klasscenter: !!kc }));
  const dekor = byDekor(layout);

  // Marken: himmelsrand + gräs + den slingrande vägen + platt markdekor (damm,
  // rabatter, tuvor). viewBox 0 0 100 100 + preserveAspectRatio="none" gör att
  // procentkoordinaterna (samma som kamerans fokus och tomternas left/top)
  // mappar 1:1 mot lagret. Några stora ljusa gräsfläckar ger marken liv utan
  // att kosta något (platta ellipser, inga filter).
  // Gräs + himmelsrand ÖVERtecknas långt bortom viewBoxen (0–100) så de fyller
  // hela det full-bleed:ade staget sömlöst på desktop (svg overflow:visible i
  // styles.css .by-mark). Husen, vägen och dekoren behåller sina 0–100-koordinater
  // → oförändrad storlek/placering (#373), bara marken breder ut sig runt om.
  const mark = `<svg class="by-mark" viewBox="0 0 100 100" preserveAspectRatio="none"
      aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <rect x="-60" y="-60" width="220" height="240" fill="#A8DA8F"/>
    <ellipse cx="22" cy="34" rx="20" ry="9" fill="#B4E19B" opacity="0.55"/>
    <ellipse cx="74" cy="62" rx="24" ry="10" fill="#B4E19B" opacity="0.5"/>
    <ellipse cx="40" cy="88" rx="18" ry="7" fill="#9ED584" opacity="0.5"/>
    <rect x="-60" y="-60" width="220" height="66" fill="#9AD3F0"/>
    <path d="M-60 6 Q25 4 50 6 Q75 8 160 5.5 L160 9 L-60 9 Z" fill="#8FCB74"/>
    ${byVagarSvg(layout)}
    ${dekorMarkSvg(dekor)}
  </svg>`;

  // Uppstående dekor (träd/granar/buskar/lyktor): egna små SVG:er som bottnar
  // på sin markpunkt. z-index efter markpunktens y ger enkel målarordning så
  // ett träd framför ett hus ritas över det, och bakom ritas under.
  const dekorHtml = dekor.uppst
    .map((d) => {
      const m = DEKOR_MATT[d.typ];
      return `<div class="by-dekor" style="left:${d.x.toFixed(2)}%;top:${d.y.toFixed(2)}%;width:${(m.w * d.s).toFixed(2)}%;height:${(m.h * d.s).toFixed(2)}%;z-index:${Math.round(d.y * 10)}">${DEKOR_ART[d.typ]()}</div>`;
    })
    .join("");

  const tomter = students
    .map((s, i) => {
      const t = layout.tomter[i];
      if (!t) return "";
      const me = s.id === meId;
      // Låst kamrat-hus (husLast → studentData-läsningen nekades, se
      // getStudentsWithLooks): huset ritas låst och klicket öppnar en liten
      // "🔒"-ruta i stället för att navigera in (pages-varld.js). Egna huset
      // låser vi aldrig ute – man kommer alltid in i sitt eget.
      const last = !me && !!s.locked;
      const namn = esc(s.namn || s.username || s.id);
      const pal = getPalette(s.paletteId);
      const aria = me
        ? "Ditt hus – zooma in"
        : last
          ? `${possessiv(namn)} hus – låst just nu`
          : `${possessiv(namn)} hus – titta in i deras rum`;
      return `<div class="by-tomt${me ? " du" : ""}${last ? " last" : ""}" role="button" tabindex="0"
        data-id="${esc(s.id)}"${me ? ` data-me="1"` : ""}${last ? ` data-locked="1"` : ""} aria-label="${aria}"
        style="left:${t.x.toFixed(2)}%;top:${t.y.toFixed(2)}%;width:${layout.cellW.toFixed(2)}%;height:${layout.radHojd.toFixed(2)}%;z-index:${Math.round((t.y + layout.radHojd / 2) * 10)};--hus-house:${pal.house};--hus-roof:${pal.roof};--hus-wall:${pal.wall};--hus-wall2:${pal.wall2}">
        ${me ? '<span class="by-du">Du!</span>' : ""}
        ${last ? '<span class="by-last-ikon" aria-hidden="true">🔒</span>' : ""}
        ${husMini({
          skalId: s.husSkalId || DEFAULT_HUS_SKAL,
          avatarHtml: avatarMarkup(s.avatarId || DEFAULT_AVATAR, s.avatarItems || []),
        })}
        <span class="by-namn">${namn}</span>
      </div>`;
    })
    .join("");

  // Klasscentrets ruta: botten på radens marklinje (samma som husen), z-index
  // efter botten som tomterna. Tom tills kc-by.js fyllt den.
  const c = kc && layout.klasscenter;
  const kcHtml = c
    ? `<div class="by-klasscenter" role="button" tabindex="0" aria-label="Klasscentret"
        data-class-id="${esc(kc.classId)}"${kc.visaOnly ? ` data-visa-only="1"` : ""}
        style="left:${c.x.toFixed(2)}%;top:${c.topp.toFixed(2)}%;width:${c.bredd.toFixed(2)}%;height:${c.hojd.toFixed(2)}%;z-index:${Math.round(c.botten * 10)}"></div>`
    : "";

  lager.innerHTML = mark + dekorHtml + kcHtml + tomter;

  if (c) {
    const slot = lager.querySelector(".by-klasscenter");
    import("./klasscenter/kc-by.js")
      .then((m) => m.mountKlasscenterIBy(slot, kc))
      .catch((err) => console.warn("[klasscenter] kunde inte laddas", err));
  }

  // Kamerafokus per elev-id (den egna tomten OCH alla kamraters) – används
  // av by↔hus (egen) och kompis-hus-nivån (en klickad kamrats tomt).
  const fokusById = {};
  students.forEach((s, i) => {
    const t = layout.tomter[i];
    if (t) fokusById[s.id] = layout.fokusFor(t);
  });

  const minIndex = students.findIndex((s) => s.id === meId);
  const minTomt = layout.tomter[minIndex] || layout.tomter[0];
  // Utan elever (bara Klasscentret) fokuserar kameran på centret.
  const fokus = minTomt ? layout.fokusFor(minTomt) : c ? { x: c.x, y: c.y } : { x: 50, y: 50 };
  return { fokus, zoom: BY_ZOOM, fokusById, klasscenterFokus: c ? { x: c.x, y: c.y } : null };
}
