// ============================================================================
// Pluggportalen – Klasskamratens rum (#/elev/klasskamrat?id=<studentId>)
// ----------------------------------------------------------------------------
// En LÄS-ENDAST vy av en annan elevs rum: deras utplacerade saker + figur. Ingen
// redigering – ingen drag/drop, ingen låda, ingen 🗑️. Öppnas genom att klicka
// på en klasskamrats hus i klassbyn (#/elev/by).
//
// Vi läser BARA andras data (getStudentData/getRoom för den andra eleven) och
// skriver aldrig. Rummets scen återanvänder .room-stage/.room-item-stilarna, men
// utan interaktiva knappar/dragging.
//
// Additivt tillägg – håll separat för enkel rebase.
// ============================================================================

import * as data from "./data.js";
import { avatarMarkup, DEFAULT_AVATAR, avatarName } from "./avatars.js";
import { app, el, go, loading, pageError, getParams, clamp } from "./ui.js";
import { getItem, isWearable, isFlatItem } from "./shop-items.js";
import { itemSvg, itemSize } from "./art-items.js";
import { roomBackdropHtml, windowItemHtml, WINDOW_DEFAULT } from "./art-room.js";
import { getPalette, paletteIdFromStudentData } from "./room-palettes.js";
import { petsFromData } from "./data-pet.js";
import { petReadonlyNode } from "./pages-rum-pets.js";
import { animalsFromData } from "./data-animals.js";

/** Minimal HTML-escape för elevnamn som kommer från Firestore. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export async function pageElevKlasskamrat() {
  if (!data.isLoggedIn()) return go("#/elev");

  const otherId = getParams().id;
  if (!otherId) return go("#/elev/by");

  // Säkerhetsnät: den egna profilen redigeras i det riktiga rummet.
  if (otherId === data.currentStudentId()) return go("#/elev/rum");

  loading("Kikar in i hemmet…");

  let sd;
  let student;
  try {
    // Endast LÄSNING av den andra elevens data. Hämta bara DEN eleven per
    // dokument (getStudent) – en elev får inte lista hela students-kollektionen,
    // bara läsa klasskamrater i samma klass (se firestore.rules sharesClass).
    const [sdRes, studentRes] = await Promise.all([
      data.getStudentData(otherId),
      data.getStudent(otherId).catch(() => null),
    ]);
    sd = sdRes;
    student = studentRes;
  } catch (err) {
    return pageError("Kunde inte ladda rummet", err);
  }

  const namn = esc(
    student?.namn || student?.username || sd.namn || avatarName(sd.avatarId || DEFAULT_AVATAR)
  );
  // Kamratens väggfärger (palettval delas med huset – golvet färgas aldrig om).
  const pal = getPalette(paletteIdFromStudentData(sd));
  const owned = sd.ownedItems || [];
  const equipped = sd.avatarItems || [];

  // Behåll bara placeringar för saker eleven fortfarande äger och som hör hemma
  // i rummet (inte kläder). Positioner i procent (0–100) av scenen.
  const placements = {};
  const savedPlacements = (sd.room && sd.room.placements) || {};
  for (const [id, pos] of Object.entries(savedPlacements)) {
    if (owned.includes(id) && !isWearable(id) && getItem(id) && pos) {
      placements[id] = { x: clamp(pos.x, 0, 100), y: clamp(pos.y, 0, 100) };
    }
  }

  // Kamratens fönster (läs-läge): ritas på sin sparade plats, borttaget om så
  // sparats. Default vid väggskarven precis som i elevens eget rum.
  const savedWin = (sd.room && sd.room.window) || null;
  const windowHtml =
    savedWin && savedWin.removed
      ? ""
      : windowItemHtml({
          x: savedWin && Number.isFinite(savedWin.x) ? clamp(savedWin.x, 0, 100) : WINDOW_DEFAULT.x,
          y: savedWin && Number.isFinite(savedWin.y) ? clamp(savedWin.y, 0, 100) : WINDOW_DEFAULT.y,
          interactive: false,
        });

  // Platta golvsaker (mattor) ritas FÖRST så möbler/dekor staplas ovanpå dem.
  const items = Object.keys(placements)
    .sort((a, b) => (isFlatItem(a) ? 0 : 1) - (isFlatItem(b) ? 0 : 1))
    .map((id) => {
      const item = getItem(id);
      const pos = placements[id];
      const size = itemSize(id);
      return `<div class="room-item readonly" style="left:${pos.x}%;top:${pos.y}%" title="${esc(item.name)}">
        <span class="ri-emoji" style="width:${size.w}rem;height:${size.h}rem">${itemSvg(id) || item.emoji}</span>
      </div>`;
    })
    .join("");

  // Kompisens djur (READ-ONLY): mystery-djuren (kläckta pets) + vanliga djuren.
  // De ritas som stilla noder EFTER möblerna så de staplas ovanpå mattor/möbler
  // (samma z-känsla som eget rum). Inga listeners, ingen matning, inga skrivningar.
  const petNodes = petsFromData(sd)
    .map((pet) => petReadonlyNode(pet))
    .filter(Boolean);
  const djurNodes = animalsFromData(sd)
    .map((a) => animalReadonlyNode(a))
    .filter(Boolean);
  const hasDjur = petNodes.length > 0 || djurNodes.length > 0;

  const view = el(`<div>
    <a class="back-link" id="back">← Till klassbyn</a>
    <div class="panel center">
      <div class="klasskamrat-figur">${avatarMarkup(sd.avatarId || DEFAULT_AVATAR, equipped)}</div>
      <h1>${namn}s rum 🛏️</h1>
      <p class="hint">Du tittar in i ${namn}s rum. Det här är bara en titt – du kan inte ändra något här. 👀</p>
    </div>

    <div class="room-stage readonly" id="stage"
      style="--rum-wall:${pal.wall};--rum-wall2:${pal.wall2}">
      ${roomBackdropHtml()}
      ${windowHtml}
      ${items || (hasDjur ? "" : '<div class="room-empty">Det här rummet är fortfarande tomt. 🕸️</div>')}
    </div>

    <div class="center">
      <button class="btn ghost" id="to-klass">🏘️ Till klassbyn</button>
    </div>
  </div>`);

  // Djuren läggs in som DOM-noder EFTER möblerna (som redan står i #stage), så
  // de hamnar överst i staplingen. Mystery-djur först, sedan vanliga djur –
  // samma ordning som i elevens eget rum (varld-rum.js).
  const stage = view.querySelector("#stage");
  for (const node of petNodes) stage.appendChild(node);
  for (const node of djurNodes) stage.appendChild(node);

  view.querySelector("#back").addEventListener("click", () => go("#/elev/by"));
  view.querySelector("#to-klass").addEventListener("click", () => go("#/elev/by"));

  app.replaceChildren(view);
}

/**
 * READ-ONLY nod för ett VANLIGT djur (hund/katt m.fl.) i kompisens rum: fast
 * storlek (itemSize, som i varld-rum-djur.js) men utan drag/klick/panel. Bara
 * att titta på – inga listeners, inga skrivningar.
 */
function animalReadonlyNode(a) {
  const item = getItem(a.id);
  if (!item) return null;
  const size = itemSize(a.id);
  return el(`<div class="room-item room-pet room-djur readonly"
    style="left:${a.pos.x}%;top:${a.pos.y}%" title="${esc(item.name)}">
    <span class="ri-emoji" style="width:${size.w}rem;height:${size.h}rem">${itemSvg(a.id) || item.emoji}</span>
    <span class="rp-namn">${esc(item.name)}</span>
  </div>`);
}
