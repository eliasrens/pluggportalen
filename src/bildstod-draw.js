// ============================================================================
// Pluggportalen – rit-lager ovanpå bildstödet (bildstod-draw.js, issue #325)
// ----------------------------------------------------------------------------
// Lägger en TRANSPARENT rit-canvas som ett LAGER ÖVER ett bildstöds-SVG (array/
// rutnät från matte-bildstod.js resp. klocka/kulpåse/diagram/koordinat från
// matte-visuals.js) så eleven kan rita DIREKT ovanpå bilden: dra visare på
// klockan, pricka i array-rutorna, markera punkter i rutnätet.
//
// LAGER-KONTRAKTET (varför strecken hamnar i linje): bildstödet och canvasen bor
// i EXAKT samma box – en wrapper (position:relative) med SVG:n som bakgrund och
// canvasen ovanpå (position:absolute; inset:0; width/height:100%). Canvasen
// täcker alltså alltid precis SVG:ns yta. Rit-motorn (attachScratchpad) mappar
// pekpunkter mot canvasens egen getBoundingClientRect och bevarar ritningen
// SKALAD över en storleksändring. När kortet fälls ut till fullskärm skalar SVG
// och canvas med SAMMA faktor (samma box) → en prick mitt på urtavlan ligger
// kvar mitt på urtavlan. Inget eget koordinatsystem behövs; alignment följer av
// att de delar box.
//
// REN & IMPORT-FRI (jfr scratch-enlarge.js/matte-bildstod.js): filen har MEDVETET
// inga importer och kan därför enhetstestas direkt mot en minimal fejk-DOM (ingen
// jsdom i projektet). Själva rit-MOTORN (attachScratchpad) injiceras utifrån via
// opts.attach – vi återanvänder alltså den befintliga pennan/sudden/rutnätet
// (#314) i stället för att skriva ny ritkod, utan att dra in ui.js-kedjan hit.
//
// BOOT-SÄKERHET (jfr #271/#290): nås BARA dynamiskt (games-rakna.js gör
// `await import(...)`). Får ALDRIG statiskt importeras av en bootnådd fil.
// ============================================================================

/**
 * Bygg wrapper-strukturen: SVG:n som bakgrundslager + en transparent canvas
 * ovanpå, i exakt samma box. REN DOM-byggare (ingen rit-logik) så den kan testas
 * fristående mot fejk-DOM.
 *
 * @param {SVGElement} svg  bildstöds-SVG:n (från renderBildstod/renderTopicVisual)
 * @param {object} [opts]
 * @param {Document} [opts.document]  injicerbar document (annars global)
 * @returns {{ wrapper: HTMLElement, canvas: HTMLElement }}
 */
export function wrapDrawable(svg, opts = {}) {
  const doc = opts.document || (typeof document !== "undefined" ? document : null);
  if (!doc) throw new Error("wrapDrawable: ingen document tillgänglig");

  const wrapper = doc.createElement("div");
  wrapper.className = "bildstod-draw";

  // Ge wrappern bildstödets EGET bildförhållande (ur viewBox) så boxen får en
  // definitiv storlek utan att bero på SVG:ns bräckliga inneboende px-storlek
  // (en SVG med width="100%" bidrar med 0 till innehållsstorleken → skulle annars
  // kollapsa som flex-item, se #325/lärdom 0d06e829). Både SVG och canvas fyller
  // sedan wrappern (100 %) och delar alltså EXAKT samma box → strecken i linje.
  const ar = aspectFromViewBox(svg);
  if (ar && wrapper.style) wrapper.style.aspectRatio = `${ar.w} / ${ar.h}`;

  const canvas = doc.createElement("canvas");
  canvas.className = "bildstod-draw-canvas";
  // Pekbart rit-lager: samma touch/urval-regler som huvud-kladdytan (.a4-scratch)
  // så ett finger ritar i stället för att skrolla, och drag inte markerar bilden.
  canvas.setAttribute("aria-label", "Rita ovanpå bildstödet");

  // Ordning = staplingsordning: SVG FÖRST (bakgrund), canvas SEDAN (ovanpå).
  wrapper.appendChild(svg);
  wrapper.appendChild(canvas);
  return { wrapper, canvas };
}

/** Läs bildförhållandet {w,h} ur en SVG:s viewBox ("minX minY bredd höjd"). */
function aspectFromViewBox(svg) {
  const vb = svg && svg.getAttribute && svg.getAttribute("viewBox");
  if (!vb) return null;
  const p = String(vb).trim().split(/[\s,]+/).map(Number);
  if (p.length === 4 && p[2] > 0 && p[3] > 0) return { w: p[2], h: p[3] };
  return null;
}

/**
 * Wrappa ett bildstöd till ett ritbart lager OCH koppla rit-motorn.
 * Rit-motorn injiceras via `opts.attach` (= attachScratchpad från scratchpad.js)
 * så den här modulen förblir import-fri/testbar; skickas ingen attach byggs bara
 * strukturen (då är `pad` null).
 *
 * @param {SVGElement} svg
 * @param {object} [opts]
 * @param {Document} [opts.document]
 * @param {(canvas:HTMLElement)=>object} [opts.attach]  rit-motorn (attachScratchpad)
 * @returns {{ wrapper: HTMLElement, canvas: HTMLElement, pad: object|null, destroy: ()=>void }}
 */
export function attachDrawLayer(svg, opts = {}) {
  const { wrapper, canvas } = wrapDrawable(svg, opts);
  const pad = typeof opts.attach === "function" ? opts.attach(canvas) : null;
  return {
    wrapper,
    canvas,
    pad,
    destroy() { if (pad && pad.destroy) pad.destroy(); },
  };
}
