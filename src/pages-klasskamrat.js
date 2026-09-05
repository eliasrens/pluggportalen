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
import { getPalette } from "./room-palettes.js";
import { petsFromData } from "./data-pet.js";
import { petReadonlyNode } from "./pages-rum-pets.js";
import { animalsFromData } from "./data-animals.js";
import { mountRumVaxlare } from "./varld-rum-vaxlare.js";

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

  // Huslås: har kamraten låst sitt hus visar vi ett "🔒 Låst"-tillstånd i
  // stället för rummets innehåll (samma husLast-fält som toggeln i by-vyn skriver;
  // isHouseLocked är den delade hjälparen så sub-issue #34 kan återanvända exakt
  // samma lås). Husets exteriör i byn påverkas inte – bara den inre läs-vyn.
  if (data.isHouseLocked(sd)) {
    const locked = el(`<div>
      <a class="back-link" id="back">← Till klassbyn</a>
      <div class="panel center klasskamrat-last">
        <div class="klasskamrat-last-ikon" aria-hidden="true">🔒</div>
        <h1>${namn}s hus är låst</h1>
        <p class="hint">${namn} har låst sitt hus, så rummet är privat just nu. Kika in en annan gång! 🙂</p>
        <button class="btn ghost" id="to-klass">🏘️ Till klassbyn</button>
      </div>
    </div>`);
    locked.querySelector("#back").addEventListener("click", () => go("#/elev/by"));
    locked.querySelector("#to-klass").addEventListener("click", () => go("#/elev/by"));
    app.replaceChildren(locked);
    return;
  }

  const owned = sd.ownedItems || [];
  const equipped = sd.avatarItems || [];

  // Kamratens rum (flerrums-stödet, issue #34): 0-indexerad logisk lista där
  // rum 0 = det gamla studentData.room. Vi låter läsaren BLÄDDRA mellan rummen
  // (dörrar + rumslista, samma UI som eget rum) men allt är läs-läge.
  const rooms = data.getRooms(sd);
  const roomCount = rooms.length;
  let curRoom = 0;

  // Kompisens djur (READ-ONLY): mystery-djuren + vanliga djuren. De bor bara i
  // GRUNDRUMMET (rum 0), precis som i elevens eget rum. Byggs en gång och läggs
  // in ovanpå möblerna när rum 0 visas.
  const petNodes = petsFromData(sd).map((pet) => petReadonlyNode(pet)).filter(Boolean);
  const djurNodes = animalsFromData(sd).map((a) => animalReadonlyNode(a)).filter(Boolean);
  const hasDjurRum0 = petNodes.length > 0 || djurNodes.length > 0;

  const view = el(`<div>
    <a class="back-link" id="back">← Till klassbyn</a>
    <div class="panel center">
      <div class="klasskamrat-figur">${avatarMarkup(sd.avatarId || DEFAULT_AVATAR, equipped)}</div>
      <h1>${namn}s rum 🛏️</h1>
      <p class="hint">Du tittar in i ${namn}s ${roomCount > 1 ? "hem – bläddra mellan rummen via dörrarna eller rumslistan" : "rum"}. Det här är bara en titt – du kan inte ändra något här. 👀</p>
    </div>

    <div class="room-stage readonly" id="stage"></div>

    <div class="center">
      <button class="btn ghost" id="to-klass">🏘️ Till klassbyn</button>
    </div>
  </div>`);

  const stage = view.querySelector("#stage");

  // Rums-växlaren (läs-läge): samma dörrar/rumslista som eget rum, men klicket
  // bläddrar bara (inga skrivningar). Bara i flerrums-hem.
  const vaxlare = roomCount > 1
    ? mountRumVaxlare({
        count: roomCount,
        getCurrent: () => curRoom,
        onPick: (i) => {
          curRoom = clamp(i, 0, roomCount - 1);
          renderRoomStage();
        },
      })
    : null;

  // Rita ett givet rum i #stage (bakgrund + fönster + möbler + ev. djur).
  function renderRoomStage() {
    const room = rooms[curRoom];
    const pal = getPalette(room.paletteId); // rum 0:s palett = husets; extra rum egen
    stage.style.setProperty("--rum-wall", pal.wall);
    stage.style.setProperty("--rum-wall2", pal.wall2);

    // Behåll bara placeringar för saker eleven fortfarande äger och som hör
    // hemma i rummet (inte kläder). Positioner i procent (0–100).
    const placements = {};
    for (const [id, pos] of Object.entries(room.placements || {})) {
      if (owned.includes(id) && !isWearable(id) && getItem(id) && pos) {
        placements[id] = { x: clamp(pos.x, 0, 100), y: clamp(pos.y, 0, 100) };
      }
    }
    // Platta golvsaker (mattor) ritas FÖRST så möbler/dekor staplas ovanpå dem.
    const itemsHtml = Object.keys(placements)
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

    // Fönstret (läs-läge): på sin sparade plats, borttaget om så sparats.
    const savedWin = room.window || null;
    const windowHtml =
      savedWin && savedWin.removed
        ? ""
        : windowItemHtml({
            x: savedWin && Number.isFinite(savedWin.x) ? clamp(savedWin.x, 0, 100) : WINDOW_DEFAULT.x,
            y: savedWin && Number.isFinite(savedWin.y) ? clamp(savedWin.y, 0, 100) : WINDOW_DEFAULT.y,
            interactive: false,
          });

    const showPets = curRoom === 0;
    const empty = Object.keys(placements).length === 0 && !(showPets && hasDjurRum0);
    const emptyHtml = empty
      ? `<div class="room-empty">${roomCount > 1 ? `Rum ${curRoom + 1} är fortfarande tomt. 🕸️` : "Det här rummet är fortfarande tomt. 🕸️"}</div>`
      : "";
    stage.innerHTML = roomBackdropHtml() + windowHtml + itemsHtml + emptyHtml;

    // Djuren läggs in EFTER möblerna så de hamnar överst (bara i rum 0).
    if (showPets) {
      for (const node of petNodes) stage.appendChild(node);
      for (const node of djurNodes) stage.appendChild(node);
    }
    // Rums-växlaren överst (samma nod-objekt varje gång → lyssnare kvar).
    if (vaxlare) {
      stage.appendChild(vaxlare.listBar);
      stage.appendChild(vaxlare.doorsWrap);
      vaxlare.render();
    }
  }
  renderRoomStage();

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
