// ============================================================================
// Bråkdraken i elevhuset (src/brakresan/rum-drake.js) · #714 I, spec §9
// ----------------------------------------------------------------------------
// LAT modul: varld-rum.js (Mitt rum) och pages-klasskamrat.js (läsläget)
// importerar den dynamiskt BARA när studentData.brakdrake finns – aldrig från
// bootgrafen (#271). Konsten (art-drake*.js) följer med härifrån.
//
// Draken är SAMMA individ som i Bråkresan: studentData.brakdrake
// { id, level, name, pos, stowed, room } (DATAMODELL.md). Servern skapar posten
// vid kläckningen och håller `level` aktuell; eleven skriver pos/stowed/room här.
// Ett nivåbyte ritar alltså om samma nod på samma plats – ingen ny drake.
//
// Den återbrukar husets mekanik utan att bli ett vanligt djur:
//   * noden är en .room-item.room-pet med data-pet-id (rummets drag-pipeline,
//     dörrarna mellan rummen, "Mina djur" och rumsvalet tar den som ett djur),
//     men den promenerar INTE (ingen promenad-AI) – den står där eleven ställt
//     den och gör lugna tomgångsgester. Inget hunger/skötsel.
//   * pos = FÖTTERNAS punkt (pivot vid fötterna), så ett nivåbyte växer draken
//     uppåt och åt sidorna från samma golvpunkt. Ryms den inte där ritas den mindre (husPassning)
//     och eleven får veta varför – positionen ändras aldrig av sig själv.
//   * klickytan är bara själva figuren (pointer-events på .bd-andas), inte rutan.
//   * klick öppnar SAMMA drakpanel som Bråkresan (drakpanel.js).
// ============================================================================

import { db } from "../firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, invalidateStudentData } from "../data.js";
import { el, flash, escHtml } from "../ui.js";
import { FLOOR_TOP } from "../art-room.js";
import { RUM_ENHET } from "../rum-promenad-golv.js";
import { drakeSvg, drakeMatt, husMatt, husPassning } from "./art-drake.js";
import { startaTomgang } from "./art-drake-anim.js";
import { DRAGON_DEFAULT_NAME } from "./schema/regler.js";

const CSS = `
.room-drake{pointer-events:none}
.room-drake .ri-emoji svg .bd-andas{pointer-events:visiblePainted;cursor:pointer}
.room-drake.dragging .ri-emoji svg .bd-andas{cursor:grabbing}
.room-drake .rp-namn{position:absolute;top:100%;left:var(--fot,50%);transform:translateX(-50%);white-space:nowrap;pointer-events:auto;cursor:pointer}
.tray-drake svg{width:100%;height:100%}
.room-drake .ri-emoji .bd-drake:not([class*=" bd-gest-"]) .bd-andas{animation:none}
.room-drake .bd-aura{animation:none}
.room-drake .ri-emoji{animation:rum-drake-andas 4.4s ease-in-out infinite;transform-origin:var(--fot,50%) 100%}
.room-drake:has(.bd-lugn) .ri-emoji{animation-play-state:paused}
@keyframes rum-drake-andas{0%,100%{transform:scale(1,1)}50%{transform:scale(1.008,1.02)}}
@media (prefers-reduced-motion: reduce){.room-drake .ri-emoji{animation:none}}
`;
// Andningen går på HTML-rutan (.ri-emoji) i huset, inte på SVG-gruppen: en
// transform på rutan kompositeras, medan en animerad SVG-grupp målar om hela
// den stora draken varje bildruta (#374). Gesterna (korta, glesa) är kvar i SVG:n.
function installeraCss() {
  if (document.getElementById("rum-drake-css")) return;
  const s = document.createElement("style");
  s.id = "rum-drake-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

const nivaAv = (bd) => Math.max(1, Math.min(15, Math.floor(Number(bd?.level)) || 1));
// Fötterna på golvet och namnskylten under dem kvar i bild.
const fotY = (y) => Math.max(FLOOR_TOP + 4, Math.min(97, Number(y)));
const STARTPLATS = { x: 50, y: 90 };

/** Har eleven en kläckt drake i huset? (ägget visas aldrig där) */
export const harHusdrake = (sd) => !!(sd?.brakdrake && sd.brakdrake.id);

/** Drakens rum: sparat index som huset (längre) saknar → rum 1. */
function rumFor(bd, roomCount) {
  const i = Math.floor(Number(bd?.room));
  return Number.isFinite(i) && i >= 0 && i < roomCount ? i : 0;
}

/** Fötternas plats i bilden (0–1 av bredden) – pivoten i drakeMatt. */
function fotAndel(niva) {
  const { vb, pivot } = drakeMatt(niva);
  return (pivot[0] - vb[0]) / vb[2];
}

/**
 * Nodens HTML. pos är fötterna: noden (centrerad med translate(-50%,-50%)
 * som alla .room-item) flyttas en halv höjd upp och fötternas avstånd från
 * mitten åt sidan. Sidled hålls hela draken inne i rummet (clamp) – den sparade
 * platsen ändras inte för det. Namnskylten står under fötterna.
 */
function nodHtml(d, { w, h, enhet, vald, lasLage }) {
  const namn = escHtml(d.name);
  const titel = `${namn}, Bråkdraken nivå ${d.level}`;
  const fa = fotAndel(d.level);
  const dx = Math.round((fa - 0.5) * w * 100) / 100;
  return `<div class="room-item room-pet room-drake${lasLage ? " readonly" : ""}${vald ? " selected" : ""}"
      ${lasLage ? "" : `data-pet-id="${escHtml(d.id)}"`} style="left:clamp(${w / 2} * ${enhet}, ${d.pos.x}% - ${dx} * ${enhet}, 100% - ${w / 2} * ${enhet});top:calc(${d.pos.y}% - ${h / 2} * ${enhet});--fot:${Math.round(fa * 1000) / 10}%" title="${titel}">
      <span class="ri-emoji" style="width:calc(${w} * ${enhet});height:calc(${h} * ${enhet})">${drakeSvg(d.level, { hus: true, titel })}</span>
      <span class="rp-namn${lasLage ? "" : " rp-namn-tap"}"${lasLage ? "" : ` data-rename="${escHtml(d.id)}"`} title="${lasLage ? namn : "Öppna drakpanelen"}">${namn}</span>
    </div>`;
}

/**
 * Montera draken för Mitt rum. null = ingen kläckt drake.
 * @param {object} o
 * @param {object} o.sd          studentData
 * @param {number} o.roomCount   antal rum i huset
 * @param {HTMLElement} o.stage  rumsscenen (tomgången pausas när den göms)
 */
export function mountRumDrake({ sd, roomCount, stage }) {
  if (!harHusdrake(sd)) return null;
  installeraCss();
  const bd = sd.brakdrake;
  const d = {
    id: bd.id,
    drake: true,
    hatchedAt: true, // husets djurlistor tar bara kläckta djur
    level: nivaAv(bd),
    name: bd.name || DRAGON_DEFAULT_NAME,
    pos: bd.pos && Number.isFinite(bd.pos.x) && Number.isFinite(bd.pos.y)
      ? { x: Math.max(3, Math.min(97, bd.pos.x)), y: fotY(bd.pos.y) } : { ...STARTPLATS },
    stowed: !!bd.stowed,
    room: rumFor(bd, roomCount),
  };
  let stopp = () => {};
  let aviseradNiva = 0; // "för stor för platsen" sägs en gång per nivå

  const ref = () => doc(db, "studentData", currentStudentId());
  async function skriv(falt) {
    try {
      await updateDoc(ref(), falt);
      invalidateStudentData();
    } catch { /* nätfel: nästa flytt skriver igen */ }
  }
  let sparTimer = null;
  function scheduleSave() {
    clearTimeout(sparTimer);
    sparTimer = setTimeout(() => skriv({ "brakdrake.pos": { x: Math.round(d.pos.x * 10) / 10, y: Math.round(d.pos.y * 10) / 10 } }), 250);
  }

  /**
   * Rums-enheten och scenens mått i px (0 när scenen inte är utlagd). Layout-
   * måtten (offset*), inte getBoundingClientRect: kamerans zoom skalar lagret
   * med transform medan rummet inte är nivån som syns.
   */
  function scenMatt() {
    const scenW = stage.offsetWidth, scenH = stage.offsetHeight;
    const cs = getComputedStyle(stage);
    const koeff = parseFloat(cs.getPropertyValue("--rum-koeff")) || 2.5;
    const cap = parseFloat(cs.getPropertyValue("--rum-cap")) || 25;
    return { enhetPx: Math.min((koeff * scenW) / 100, cap), scenW, scenH };
  }

  function stageNode(vald) {
    stopp();
    const m = husMatt(d.level);
    const s = husPassning(m, d.pos.y, scenMatt());
    if (s < 0.999 && aviseradNiva !== d.level) {
      aviseradNiva = d.level;
      flash(`${d.name} har vuxit och får inte plats där den står – den ritas lite mindre. Dra den längre ner i rummet! 🐉`);
    }
    const w = Math.round(m.w * s * 100) / 100, h = Math.round(m.h * s * 100) / 100;
    // Byggd i DETTA dokument (inte i en <template>), så att tomgångens
    // visibilitychange-lyssnare och CSS hamnar i sidan.
    const tmp = document.createElement("div");
    tmp.innerHTML = nodHtml(d, { w, h, enhet: RUM_ENHET, vald });
    const nod = tmp.firstElementChild;
    // Glesare blinkningar än i Bråkresan: varje SVG-gest målar om hela den
    // stora draken, och huset har redan promenerande djur (spec §14).
    stopp = startaTomgang(nod.querySelector("svg"), { vy: stage, blink: [6000, 12000] });
    return nod;
  }

  return {
    drake: d,
    list: (rum) => (!d.stowed && d.room === rum ? [d] : []),
    stowedList: () => (d.stowed ? [d] : []),
    roomOf: () => d.room,
    byId: (id) => (id === d.id ? d : undefined),
    stageNode,
    /** Draget: kärnan ger nodens CENTRUM (procent) – räkna om till fötterna. */
    flytt(x, y, halfW, halfH) {
      d.pos = { x: x + (fotAndel(d.level) - 0.5) * 2 * halfW, y: fotY(y + halfH) };
    },
    scheduleSave,
    setStowed(stowed) {
      d.stowed = !!stowed;
      if (stowed) stopp();
      skriv({ "brakdrake.stowed": d.stowed });
    },
    setRoom(index, pos = null) {
      d.room = index;
      if (pos) d.pos = { x: pos.x, y: fotY(pos.y) };
      skriv({ "brakdrake.room": index, ...(pos ? { "brakdrake.pos": d.pos } : {}) });
    },
    tumnagel: () => `<span class="tray-drake">${drakeSvg(d.level, { hus: true, titel: d.name })}</span>`,
    /**
     * Samma drakpanel som Bråkresan. Läser Bråkresans state (EN läsning) så
     * att panelen visar stjärnor/jakt; namnbytet ritas om i rummet via onNamn.
     */
    async oppnaPanel({ fokus = null, onStow = null, onNamn = null } = {}) {
      const [{ oppnaDrakpanel }, data] = await Promise.all([import("./drakpanel.js"), import("./data.js")]);
      let state;
      try {
        state = await data.getState();
      } catch {
        flash("Kunde inte hämta draken just nu. Försök igen om en stund.", true);
        return;
      }
      await oppnaDrakpanel({
        state,
        fokusTillbaka: fokus,
        onNamn: (namn) => { d.name = namn; onNamn?.(namn); },
        atgarder: onStow ? [{ text: "Låt draken vila i Mina djur 🐾", gor: onStow }] : [],
      });
    },
    stopp: () => stopp(),
  };
}

/**
 * Läsläget (klasskamratens hus): en stilla drake på sin plats, utan klick och
 * utan tomgång. pages-klasskamrat ritar i rem i stället för rums-enheter;
 * `stage` (utlagd) ger samma passning som i Mitt rum.
 * @returns {{ node: HTMLElement, room: number } | null}
 */
export function drakeLasNod(sd, roomCount, stage = null) {
  if (!harHusdrake(sd) || sd.brakdrake.stowed) return null;
  installeraCss();
  const bd = sd.brakdrake;
  const d = {
    id: bd.id, level: nivaAv(bd), name: bd.name || DRAGON_DEFAULT_NAME,
    pos: bd.pos && Number.isFinite(bd.pos.x) && Number.isFinite(bd.pos.y) ? { x: bd.pos.x, y: fotY(bd.pos.y) } : { ...STARTPLATS },
  };
  const m = husMatt(d.level);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const s = stage ? husPassning(m, d.pos.y, { enhetPx: rem, scenW: stage.offsetWidth, scenH: stage.offsetHeight }) : 1;
  const w = Math.round(m.w * s * 100) / 100, h = Math.round(m.h * s * 100) / 100;
  return { node: el(nodHtml(d, { w, h, enhet: "1rem", lasLage: true })), room: rumFor(bd, roomCount) };
}
