// ============================================================================
// Pluggporten – rummets golv-geometri + drag-kärna (delad)
// ----------------------------------------------------------------------------
// 1. Promenad-AI:ns golvzon (rum-promenad.js): pickTarget, seekStep OCH den
//    hårda re-clampen i walkStep.
// 2. Inrednings-kärnan (#490) som Mitt rum (varld-rum.js) och Klasscentrets
//    rum (rum-inredning.js → klasscenter/kc-rum-vy.js) DELAR: drag-klamringen
//    (golv/vägg/fönster), ritordningen, startplatsen för en ny sak, placerings-
//    nycklarna, sak-noden och pekar-pipelinen (kopplaRumDrag).
// Kärnan bor här – inte i en ny fil – eftersom varld-rum.js ligger i den
// statiska bootgrafen och nya bootfiler är förbjudna (#271: Pages-deployen är
// inte atomär). Allt utom kopplaRumDrag är ren matematik/strängar utan DOM, så
// det regressionstestas fristående (test/rum-promenad-golv.test.js,
// test/rum-inredning.test.js); kopplaRumDrag rör DOM:en först när den anropas.
//
// Regression #63: husdjur (t.ex. E:s hund) gick upp på väggarna igen. Rotorsaken
// var att halfH mättes på HELA rum-noden (som är center-ankrad och även innehåller
// namn-etiketten under spriten) → halfH blåstes upp → golvzonens minY sköts uppåt
// och släppte djurets centrum, och därmed fötterna, upp på väggen. Fixen: mät
// själva spriten (.ri-emoji) och re-klampa varje steg mot denna zon.
// ============================================================================

import { FLOOR_TOP } from "./art-room.js";

/** Klampa ett tal till [min, max] (min vinner om intervallet är inverterat). */
export const clampRange = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Golvzonen (i procent av scenen) ett djur får ha sitt CENTRUM i, utifrån dess
 * halva bredd/höjd (mätt på själva spriten, inte hela noden). Modellen: djuret
 * står med fötterna vid `centrum + halfH`, så `minY = FLOOR_TOP + 4 - halfH`
 * håller fötterna på golvytan (FLOOR_TOP) medan `Math.max(halfH, …)` ser till att
 * ett stort djurs ÖVERKANT (centrum − halfH) inte skjuts av skärmen.
 * @param {number} halfW  halva spritebredden i procent av scenen
 * @param {number} halfH  halva spritehöjden i procent av scenen
 */
export function petWalkZone(halfW, halfH) {
  return {
    minX: Math.max(3, halfW),
    maxX: Math.min(97, 100 - halfW),
    minY: Math.max(halfH, FLOOR_TOP + 4 - halfH),
    maxY: 100 - halfH,
  };
}

// --- Inrednings-kärnan (#490) ----------------------------------------------

/** Som ui.js clamp (max vinner om intervallet är inverterat, NaN → min). */
function klampa(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Var en dragen sak får stå (procent av scenen). Hela saken hålls innanför
 * scenkanterna; golvsaker (zon "golv") nere i golvzonen, fönstret (zon
 * "fonster") med centrum ovanför golvlinjen, väggdekor (zon "vagg") får hela
 * väggen. halfW/halfH = halva sakens bredd/höjd i procent av scenen.
 */
export function dragPos({ px, py, halfW, halfH, zon, golvTopp = FLOOR_TOP }) {
  const x = klampa(px, halfW, 100 - halfW);
  let minY = halfH;
  let maxY = 100 - halfH;
  if (zon === "fonster") {
    maxY = golvTopp; // fönstrets centrum korsar aldrig golvlinjen
  } else if (zon === "golv") {
    minY = Math.max(halfH, golvTopp + 4 - halfH);
  }
  return { x, y: klampa(py, minY, maxY) };
}

/**
 * Placeringarnas nycklar i ritordning: stigande rang(nyckel), lika rang
 * behåller nyckelordningen (stabil sortering). Mitt rum: platta golvsaker
 * (mattor) rang 0, resten 1; Klasscentret: sparat z.
 */
export function ordnaNycklar(placements, rang) {
  return Object.keys(placements).sort((a, b) => rang(a) - rang(b));
}

// Utspritt startläge för en NY sak från lådan: golvsaker sprids i sidled längs
// golvet, väggdekor längs väggen. Vi cyklar genom ett utspritt x-mönster
// (mitten först, sedan ut mot kanterna) utifrån hur många saker som redan står
// i samma zon, och radar i höjdled när ett varv är fullt. Så staplas aldrig
// flera nyplacerade saker på exakt samma punkt ("klump mot mitten").
const SPREAD_X = [50, 30, 70, 20, 80, 40, 60, 15, 85];

/** Nästa lediga startplats i zonen (golv = true). arGolv(nyckel) → bool. */
export function nastaPlats(placements, golv, arGolv) {
  const n = Object.keys(placements).filter((k) => arGolv(k) === golv).length;
  const x = SPREAD_X[n % SPREAD_X.length];
  const row = Math.floor(n / SPREAD_X.length);
  const y = golv ? 78 - (row % 2) * 8 : 32 + (row % 2) * 12;
  return { x, y };
}

/**
 * Unik placerings-nyckel för ett NYTT exemplar av en sak. Första exemplaret
 * får det rena sak-id:t (bakåtkompatibelt med gammal data och enrums-hus),
 * extra exemplar får "<id>#<n>".
 */
export function nyPlaceringsNyckel(placements, id) {
  if (!(id in placements)) return id;
  let n = 2;
  while (`${id}#${n}` in placements) n++;
  return `${id}#${n}`;
}

/**
 * En placerad sak (.room-item) som HTML-sträng. Bredd/höjd (w/h i rums-
 * enheter) skalas med scenBREDDEN (1cqw = 1 % av scen), cap:ad per enhet, se
 * .varld-lager.room-stage i styles.css → saken upptar samma andel av scenen
 * vid varje bredd (ingen ihopklumpning). cqw skrivs DIREKT här (inte via en
 * egen var) – annars resolvas den mot fel container i Chromium. calc →
 * faktiskt layoutmått, så drag-clampen (offsetWidth/Height) följer med.
 * taBort = false → ingen 🗑️ (läsläge).
 */
export function rumSakHtml({ key, x, y, titel, art, w, h, vald = false, taBort = true }) {
  const enhet = "min(var(--rum-koeff, 2.5) * 1cqw, var(--rum-cap, 25px))";
  return `<div class="room-item${vald ? " selected" : ""}"
        data-id="${key}" style="left:${x}%;top:${y}%" title="${titel}">
        <span class="ri-emoji" style="width:calc(${w} * ${enhet});height:calc(${h} * ${enhet})">${art}</span>
        ${taBort ? `<button class="ri-remove" data-remove="${key}" title="Plocka bort">🗑️</button>` : ""}
      </div>`;
}

/**
 * Dra-och-släpp i en rumsscen (pointer events, procentbaserat). Samma
 * pipeline för saker (data-id) och djur (data-pet-id); 🗑️ (data-remove) och
 * ✏️ (data-rename) hanteras som klick och startar ingen drag.
 *
 * @param {HTMLElement} stage
 * @param {object} h
 * @param {(node:HTMLElement) => ("golv"|"vagg"|"fonster"|null)} h.zon
 *        nodens zon; null = får inte dras (läsläge)
 * @param {() => void} [h.tomYta]  pointerdown utanför alla saker
 * @param {(drag:object, x:number, y:number) => void} h.flytt  ny klamrad plats
 *        (noden flyttas av kärnan efteråt)
 * @param {(drag:object) => void} h.slapp  drag.moved = false → det var ett klick
 * @param {number} [h.golvTopp]
 * @returns {{ pagar: () => (object|null) }}  pågående drag (id, petId, node …)
 */
export function kopplaRumDrag(stage, { zon, tomYta, flytt, slapp, golvTopp = FLOOR_TOP }) {
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    const node = e.target.closest(".room-item");
    if (!node) {
      tomYta?.();
      return;
    }
    if (e.target.closest("[data-remove]") || e.target.closest("[data-rename]")) return;
    const z = zon(node);
    if (!z) return;
    const rect = stage.getBoundingClientRect();
    drag = {
      id: node.dataset.id || null,
      petId: node.dataset.petId || null,
      node, rect, zon: z, moved: false, startX: e.clientX, startY: e.clientY,
      // Halva sakens bredd/höjd i procent av scenen → hela saken hålls
      // innanför rummet (saker är centrerade med translate(-50%,-50%)).
      halfW: ((node.offsetWidth / rect.width) * 100) / 2,
      halfH: ((node.offsetHeight / rect.height) * 100) / 2,
    };
    node.setPointerCapture(e.pointerId);
    node.classList.add("dragging");
  });

  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3) {
      drag.moved = true;
    }
    const { x, y } = dragPos({
      px: ((e.clientX - drag.rect.left) / drag.rect.width) * 100,
      py: ((e.clientY - drag.rect.top) / drag.rect.height) * 100,
      halfW: drag.halfW, halfH: drag.halfH, zon: drag.zon, golvTopp,
    });
    flytt(drag, x, y);
    drag.node.style.left = x + "%";
    drag.node.style.top = y + "%";
  });

  function endDrag() {
    if (!drag) return;
    const d = drag;
    d.node.classList.remove("dragging");
    slapp(d);
    drag = null;
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  return { pagar: () => drag };
}
