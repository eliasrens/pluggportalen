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
//   * pos.y = FÖTTERNAS höjd (pivot vid fötterna), så ett nivåbyte växer draken
//     uppåt från samma golvpunkt. Ryms den inte där ritas den mindre (husPassning)
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
import { drakeSvg, husMatt, husPassning } from "./art-drake.js";
import { startaTomgang } from "./art-drake-anim.js";
import { DRAGON_DEFAULT_NAME } from "./schema/regler.js";

const CSS = `
.room-drake{pointer-events:none}
.room-drake .ri-emoji svg .bd-andas{pointer-events:visiblePainted;cursor:pointer}
.room-drake.dragging .ri-emoji svg .bd-andas{cursor:grabbing}
.room-drake .rp-namn{position:absolute;left:50%;top:100%;transform:translateX(-50%);white-space:nowrap;pointer-events:auto;cursor:pointer}
.tray-drake svg{width:100%;height:100%}
`;
function installeraCss() {
  if (document.getElementById("rum-drake-css")) return;
  const s = document.createElement("style");
  s.id = "rum-drake-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

const nivaAv = (bd) => Math.max(1, Math.min(15, Math.floor(Number(bd?.level)) || 1));
const fotY = (y) => Math.max(FLOOR_TOP + 4, Math.min(99, Number(y)));
const STARTPLATS = { x: 50, y: 90 };

/** Har eleven en kläckt drake i huset? (ägget visas aldrig där) */
export const harHusdrake = (sd) => !!(sd?.brakdrake && sd.brakdrake.id);

/** Drakens rum: sparat index som huset (längre) saknar → rum 1. */
function rumFor(bd, roomCount) {
  const i = Math.floor(Number(bd?.room));
  return Number.isFinite(i) && i >= 0 && i < roomCount ? i : 0;
}

/**
 * Nodens HTML. pos.y är fötterna: noden (centrerad med translate(-50%,-50%)
 * som alla .room-item) får top = fötterna − halva höjden.
 */
function nodHtml(d, { w, h, enhet, vald, lasLage }) {
  const namn = escHtml(d.name);
  const titel = `${namn}, Bråkdraken nivå ${d.level}`;
  return `<div class="room-item room-pet room-drake${lasLage ? " readonly" : ""}${vald ? " selected" : ""}"
      ${lasLage ? "" : `data-pet-id="${escHtml(d.id)}"`} style="left:${d.pos.x}%;top:calc(${d.pos.y}% - ${h / 2} * ${enhet})" title="${titel}">
      <span class="ri-emoji" style="width:calc(${w} * ${enhet});height:calc(${h} * ${enhet})">${drakeSvg(d.level, { hus: true, titel })}</span>
      <span class="rp-namn${lasLage ? "" : " rp-namn-tap"}"${lasLage ? "" : ` data-rename="${escHtml(d.id)}"`} title="${lasLage ? namn : "Öppna drakpanelen"}">🐉 ${namn}</span>
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

  /** Rums-enheten och scenens mått i px just nu (0 när scenen är dold). */
  function scenMatt() {
    const r = stage.getBoundingClientRect();
    const cs = getComputedStyle(stage);
    const koeff = parseFloat(cs.getPropertyValue("--rum-koeff")) || 2.5;
    const cap = parseFloat(cs.getPropertyValue("--rum-cap")) || 25;
    return { enhetPx: Math.min((koeff * r.width) / 100, cap), scenW: r.width, scenH: r.height };
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
    const nod = el(nodHtml(d, { w, h, enhet: RUM_ENHET, vald }));
    stopp = startaTomgang(nod.querySelector("svg"), { vy: stage });
    return nod;
  }

  return {
    drake: d,
    list: (rum) => (!d.stowed && d.room === rum ? [d] : []),
    stowedList: () => (d.stowed ? [d] : []),
    roomOf: () => d.room,
    byId: (id) => (id === d.id ? d : undefined),
    stageNode,
    /** Draget: kärnan ger nodens CENTRUM – fötterna ligger en halv höjd nedanför. */
    flytt(x, y, halfH) {
      d.pos = { x, y: fotY(y + halfH) };
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
 * Läsläget (klasskamratens hus): en stilla drake på sin plats, utan klick.
 * pages-klasskamrat ritar i rem i stället för rums-enheter.
 * @returns {{ node: HTMLElement, room: number } | null}
 */
export function drakeLasNod(sd, roomCount) {
  if (!harHusdrake(sd) || sd.brakdrake.stowed) return null;
  installeraCss();
  const bd = sd.brakdrake;
  const d = {
    id: bd.id, level: nivaAv(bd), name: bd.name || DRAGON_DEFAULT_NAME,
    pos: bd.pos && Number.isFinite(bd.pos.x) && Number.isFinite(bd.pos.y) ? { x: bd.pos.x, y: fotY(bd.pos.y) } : { ...STARTPLATS },
  };
  const m = husMatt(d.level);
  return { node: el(nodHtml(d, { ...m, enhet: "1rem", lasLage: true })), room: rumFor(bd, roomCount) };
}
