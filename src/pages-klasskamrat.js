// ============================================================================
// Pluggportalen – Klasskamratens rum (#/elev/klasskamrat?id=<studentId>)
// ----------------------------------------------------------------------------
// En LÄS-ENDAST vy av en annan elevs rum: deras utplacerade saker + figur. Ingen
// redigering – ingen drag/drop, ingen låda, ingen 🗑️. Öppnas genom att klicka
// på en klasskamrat i "Min klass" (#/elev/klassfoto).
//
// Vi läser BARA andras data (getStudentData/getRoom för den andra eleven) och
// skriver aldrig. Rummets scen återanvänder .room-stage/.room-item-stilarna, men
// utan interaktiva knappar/dragging.
//
// Additivt tillägg – håll separat för enkel rebase.
// ============================================================================

import * as data from "./data.js";
import { avatarMarkup, DEFAULT_AVATAR, avatarName } from "./avatars.js";
import { evoFromStudentData } from "./evolution.js";
import { app, el, go, loading, pageError, getParams, clamp } from "./ui.js";
import { getItem, isWearable } from "./shop-items.js";
import { itemSvg, itemSize } from "./art-items.js";
import { roomBackdropHtml } from "./art-room.js";

/** Minimal HTML-escape för elevnamn som kommer från Firestore. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export async function pageElevKlasskamrat() {
  if (!data.isLoggedIn()) return go("#/elev");

  const otherId = getParams().id;
  if (!otherId) return go("#/elev/klassfoto");

  // Säkerhetsnät: den egna profilen redigeras i det riktiga rummet.
  if (otherId === data.currentStudentId()) return go("#/elev/rum");

  loading("Kikar in i hemmet…");

  let sd;
  let student;
  try {
    // Endast LÄSNING av den andra elevens data.
    const [sdRes, studentsRes] = await Promise.all([
      data.getStudentData(otherId),
      data.getStudents().catch(() => []),
    ]);
    sd = sdRes;
    student = studentsRes.find((s) => s.id === otherId) || null;
  } catch (err) {
    return pageError("Kunde inte ladda rummet", err);
  }

  const namn = esc(
    student?.namn || student?.username || sd.namn || avatarName(sd.avatarId || DEFAULT_AVATAR)
  );
  const owned = sd.ownedItems || [];
  const equipped = sd.avatarItems || [];
  const evo = evoFromStudentData(sd);

  // Behåll bara placeringar för saker eleven fortfarande äger och som hör hemma
  // i rummet (inte kläder). Positioner i procent (0–100) av scenen.
  const placements = {};
  const savedPlacements = (sd.room && sd.room.placements) || {};
  for (const [id, pos] of Object.entries(savedPlacements)) {
    if (owned.includes(id) && !isWearable(id) && getItem(id) && pos) {
      placements[id] = { x: clamp(pos.x, 0, 100), y: clamp(pos.y, 0, 100) };
    }
  }

  const items = Object.keys(placements)
    .map((id) => {
      const item = getItem(id);
      const pos = placements[id];
      const size = itemSize(id);
      return `<div class="room-item readonly" style="left:${pos.x}%;top:${pos.y}%" title="${esc(item.name)}">
        <span class="ri-emoji" style="width:${size.w}rem;height:${size.h}rem">${itemSvg(id) || item.emoji}</span>
      </div>`;
    })
    .join("");

  const view = el(`<div>
    <a class="back-link" id="back">← Till Min klass</a>
    <div class="panel center">
      <div class="klasskamrat-figur">${avatarMarkup(sd.avatarId || DEFAULT_AVATAR, equipped, evo)}</div>
      <h1>${namn}s rum 🛏️</h1>
      <p class="hint">Du tittar in i ${namn}s rum. Det här är bara en titt – du kan inte ändra något här. 👀</p>
    </div>

    <div class="room-stage readonly" id="stage">
      ${roomBackdropHtml()}
      ${items || '<div class="room-empty">Det här rummet är fortfarande tomt. 🕸️</div>'}
    </div>

    <div class="center">
      <button class="btn ghost" id="to-klass">👩‍👦‍👦 Till Min klass</button>
    </div>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => go("#/elev/klassfoto"));
  view.querySelector("#to-klass").addEventListener("click", () => go("#/elev/klassfoto"));

  app.replaceChildren(view);
}
