// ============================================================================
// Pluggportalen – Mitt rum
// ----------------------------------------------------------------------------
// Eleven placerar ut sina köpta saker (möbler/husdjur/dekor) i ett eget rum och
// sätter kläder på avataren. Här BOR även de kläckbara husdjuren (mystery
// eggs): ägg ruvar och kläcks i rummet, djuren namnges/matas via panelen under
// scenen (pages-rum-pets.js, data i studentData.pets via data-pet.js).
// Placeringar sparas i procent av scenen → ser likadana ut oavsett skärm.
// ============================================================================

import * as data from "./data.js";
import * as petData from "./data-pet.js";
import { app, el, go, loading, renderTopbar, pageError, flash, clamp } from "./ui.js";
import { getItem, isWearable } from "./shop-items.js";
import { wearableSvg } from "./art-wearables.js";
import { itemSvg, itemSize } from "./art-items.js";
import { petStageNode, renderPetPanel } from "./pages-rum-pets.js";
import { confetti } from "./fx.js";
import { roomBackdropHtml, FLOOR_TOP } from "./art-room.js";
import { getPalette, paletteIdFromStudentData, renderPalettePicker } from "./room-palettes.js";

/** Saker som står på golvet (möbler & husdjur) – får inte hamna på väggen. */
function isFloorItem(id) {
  const it = getItem(id);
  return !!(it && (it.category === "mobler" || it.category === "husdjur"));
}

export async function pageElevRum() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  let sd, pets, justHatchedIds;
  try {
    sd = await data.getStudentData();
    // Husdjuren: migrera ev. gammalt singular-pet och kläck färdiga ägg.
    const res = await petData.hatchReadyPets();
    pets = res.pets;
    justHatchedIds = res.justHatchedIds;
  } catch (err) {
    return pageError("Kunde inte ladda ditt rum", err);
  }

  const owned = sd.ownedItems || [];
  const hasLamp = owned.includes(petData.LAMP_ITEM_ID);
  // Behåll bara placeringar för saker eleven fortfarande äger och som hör hemma
  // i rummet (inte kläder; ägget ritas som husdjur, inte som vanlig sak).
  const placements = {};
  const savedPlacements = (sd.room && sd.room.placements) || {};
  for (const [id, pos] of Object.entries(savedPlacements)) {
    if (owned.includes(id) && !isWearable(id) && id !== petData.EGG_ITEM_ID && pos) {
      // Golvsaker (möbler/husdjur) hålls nere i golvzonen även i gammal data.
      const minY = isFloorItem(id) ? FLOOR_TOP - 8 : 4;
      placements[id] = { x: clamp(pos.x, 3, 97), y: clamp(pos.y, minY, 96) };
    }
  }

  // Burna klädsaker (för avatarstället längst ner).
  const equipped = new Set(sd.avatarItems || []);

  const roomItemsOwned = owned.filter(
    (id) => !isWearable(id) && id !== petData.EGG_ITEM_ID && getItem(id)
  );
  const wearItemsOwned = owned.filter((id) => isWearable(id) && getItem(id));

  const view = el(`<div>
    <a class="back-link" id="back">← Gå ut ur huset</a>
    <div class="panel">
      <h1>Mitt rum 🛏️</h1>
      <p class="hint">Klicka på en sak i lådan för att ställa den i rummet. Dra för att
        flytta. Klicka på en placerad sak och välj 🗑️ för att plocka bort den.
        Dina husdjur bor också här – klicka på ett djur för att mata eller döpa det! 🐾</p>
    </div>

    <div class="room-stage" id="stage"></div>
    <div id="pet-panel"></div>

    <div class="panel">
      <h2>Måla om 🎨</h2>
      <p class="hint">Välj en färgpalett till dina väggar och ditt hus – de hänger ihop!
        Golvet behåller sin färg.</p>
      <div class="palett-rad" id="palettrad"></div>
    </div>

    <div class="panel">
      <h2>Lådan 📦</h2>
      <p class="hint" id="tray-hint"></p>
      <div class="room-tray" id="tray"></div>
    </div>

    <div class="panel">
      <h2>Klä på din figur 👗</h2>
      <p class="hint">Klicka för att sätta på eller ta av. Din figur syns i sidhuvudet.</p>
      <div class="wear-tray" id="weartray"></div>
    </div>

    <div class="center">
      <button class="btn ghost" id="to-shop">🛍️ Till shoppen</button>
    </div>
  </div>`);

  const stage = view.querySelector("#stage");
  const petPanel = view.querySelector("#pet-panel");
  const tray = view.querySelector("#tray");
  const trayHint = view.querySelector("#tray-hint");
  const wearTray = view.querySelector("#weartray");

  // Väggfärgerna = elevens palettval (delas med husets fasad, se pages-hus.js).
  // Golvet ligger i .room-bg och färgas aldrig om.
  let paletteId = paletteIdFromStudentData(sd);
  function applyPalette() {
    const pal = getPalette(paletteId);
    stage.style.setProperty("--rum-wall", pal.wall);
    stage.style.setProperty("--rum-wall2", pal.wall2);
  }
  applyPalette();
  renderPalettePicker(view.querySelector("#palettrad"), paletteId, (id) => {
    paletteId = id;
    applyPalette();
    data.saveRoom({ paletteId: id }).catch((err) => {
      flash("Kunde inte spara färgvalet: " + err.message, true);
    });
  });

  let selectedId = null; // vald placerad sak (visar borttagningsknapp)
  let selectedPetId = null; // valt husdjur (visar husdjurspanelen)
  let justHatchedId = justHatchedIds[0] || null; // firas i panelen en gång

  // Spara rummet (debounce – tät dragrörelse skriver inte varje pixel).
  let saveTimer = null;
  function scheduleSaveRoom() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      data.saveRoom({ placements }).catch(() => {});
    }, 250);
  }

  // Spara husdjurens positioner (samma debounce-mönster).
  let petSaveTimer = null;
  function scheduleSavePets() {
    clearTimeout(petSaveTimer);
    petSaveTimer = setTimeout(() => {
      const positions = {};
      for (const p of pets) positions[p.id] = { x: p.pos.x, y: p.pos.y };
      petData.savePetPositions(positions).catch(() => {});
    }, 250);
  }

  // Husdjurspanelen under scenen (valt djur, eller det nykläckta).
  function renderPets() {
    const pet = pets.find((p) => p.id === selectedPetId) || null;
    renderPetPanel(petPanel, pet, {
      hasLamp,
      justHatched: !!pet && pet.id === justHatchedId,
      onUpdate(nextPets, petId) {
        pets = nextPets;
        if (petId === justHatchedId) justHatchedId = null; // firad
        selectedPetId = petId;
        renderStage();
        renderPets();
      },
    });
  }

  // --- Rita rummets scen (saker + husdjur) ---------------------------------
  function renderStage() {
    stage.replaceChildren();
    stage.insertAdjacentHTML("beforeend", roomBackdropHtml());
    for (const id of Object.keys(placements)) {
      const item = getItem(id);
      if (!item) continue;
      const pos = placements[id];
      const size = itemSize(id);
      stage.appendChild(el(`<div class="room-item${selectedId === id ? " selected" : ""}"
        data-id="${id}" style="left:${pos.x}%;top:${pos.y}%" title="${item.name}">
        <span class="ri-emoji" style="width:${size.w}rem;height:${size.h}rem">${itemSvg(id) || item.emoji}</span>
        <button class="ri-remove" data-remove="${id}" title="Plocka bort">🗑️</button>
      </div>`));
    }
    for (const pet of pets) {
      if (!pet.pos) pet.pos = { x: 50, y: 70 };
      stage.appendChild(petStageNode(pet, selectedPetId === pet.id));
    }
    if (Object.keys(placements).length === 0 && pets.length === 0) {
      stage.appendChild(el(`<div class="room-empty">Ditt rum är tomt – välj saker i lådan nedan! 👇</div>`));
    }
  }

  // --- Rita lådan (ägda, oplacerade rums-saker) ----------------------------
  function renderTray() {
    tray.replaceChildren();
    const notPlaced = roomItemsOwned.filter((id) => !(id in placements));
    if (roomItemsOwned.length === 0) {
      trayHint.textContent = "Du har inga saker än. Köp möbler, husdjur och dekor i shoppen!";
    } else if (notPlaced.length === 0) {
      trayHint.textContent = "Alla dina saker står i rummet. 🎉";
    } else {
      trayHint.textContent = "Klicka på en sak för att ställa den i rummet.";
    }
    for (const id of notPlaced) {
      const item = getItem(id);
      tray.appendChild(el(`<button class="tray-item" data-place="${id}" title="${item.name}">
        <span class="tray-emoji">${itemSvg(id) || item.emoji}</span>
        <span class="tray-namn">${item.name}</span>
      </button>`));
    }
  }

  // --- Rita klädlådan ------------------------------------------------------
  function renderWearTray() {
    wearTray.replaceChildren();
    if (wearItemsOwned.length === 0) {
      wearTray.appendChild(el(`<p class="hint">Du har inga kläder än – köp kläder & accessoarer i shoppen! 🧢</p>`));
      return;
    }
    for (const id of wearItemsOwned) {
      const item = getItem(id);
      const on = equipped.has(id);
      wearTray.appendChild(el(`<button class="wear-item${on ? " on" : ""}" data-wear="${id}" title="${item.name}">
        <span class="tray-emoji">${wearableSvg(id) || item.emoji}</span>
        <span class="tray-namn">${item.name}</span>
        <span class="wear-state">${on ? "På ✓" : "Sätt på"}</span>
      </button>`));
    }
  }

  // Nykläckt ägg? Fira och öppna panelen för namngivning direkt.
  if (justHatchedId) {
    selectedPetId = justHatchedId;
    confetti();
    flash("Ett ägg har kläckts i ditt rum! 🎉");
  }

  renderStage();
  renderTray();
  renderWearTray();
  renderPets();

  // "Ut ur huset" = tillbaka till hus-vyn (rummet nås via huset, #/elev/hus).
  view.querySelector("#back").addEventListener("click", () => go("#/elev/hus"));
  view.querySelector("#to-shop").addEventListener("click", () => go("#/elev/shop"));

  // Placera en sak från lådan (klick).
  tray.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-place]");
    if (!btn) return;
    const id = btn.dataset.place;
    if (id in placements) return;
    // Golvsaker ställs på golvet, väggdekor hängs på väggen.
    placements[id] = isFloorItem(id) ? { x: 50, y: 78 } : { x: 50, y: 32 };
    selectedId = null; // ny sak placeras utan ram – markeras först vid klick
    renderStage();
    renderTray();
    scheduleSaveRoom();
  });

  // Klädsaker: sätt på / ta av (en per slot).
  wearTray.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-wear]");
    if (!btn) return;
    const id = btn.dataset.wear;
    const item = getItem(id);
    if (!item) return;
    if (equipped.has(id)) {
      equipped.delete(id);
    } else {
      // Bara en sak per slot – ta av ev. annan i samma slot.
      for (const otherId of [...equipped]) {
        const other = getItem(otherId);
        if (other && other.slot === item.slot) equipped.delete(otherId);
      }
      equipped.add(id);
    }
    renderWearTray();
    try {
      await data.saveAvatarItems([...equipped]);
      await renderTopbar(); // figuren i sidhuvudet uppdateras direkt
    } catch (err) {
      flash("Kunde inte spara påklädnaden: " + err.message, true);
    }
  });

  // Ta bort en placerad sak (🗑️). Husdjur kan inte plockas bort – de bor här.
  stage.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove]");
    if (!removeBtn) return;
    const id = removeBtn.dataset.remove;
    delete placements[id];
    if (selectedId === id) selectedId = null;
    renderStage();
    renderTray();
    scheduleSaveRoom();
  });

  // --- Dra-och-släpp i rummet (pointer events, procentbaserat) -------------
  // Samma pipeline för saker och husdjur: data-id = sak, data-pet-id = husdjur.
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    const node = e.target.closest(".room-item");
    if (!node) {
      // Klick på tom yta i rummet → avmarkera direkt (ram + 🗑️/panel försvinner).
      if (selectedId !== null || selectedPetId !== null) {
        selectedId = null;
        selectedPetId = null;
        renderStage();
        renderPets();
      }
      return;
    }
    if (e.target.closest("[data-remove]")) return; // låt borttagning ske
    const rect = stage.getBoundingClientRect();
    drag = {
      id: node.dataset.id || null,
      petId: node.dataset.petId || null,
      node, rect, moved: false, startX: e.clientX, startY: e.clientY,
      // Halva sakens bredd/höjd i procent av scenen → hela saken hålls
      // innanför rummet (saker är centrerade med translate(-50%,-50%)).
      halfW: ((node.offsetWidth / rect.width) * 100) / 2,
      halfH: ((node.offsetHeight / rect.height) * 100) / 2,
      // Möbler, husdjur-saker OCH levande husdjur hör hemma i golvzonen.
      floor: !!node.dataset.petId || isFloorItem(node.dataset.id),
    };
    node.setPointerCapture(e.pointerId);
    node.classList.add("dragging");
  });

  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3) {
      drag.moved = true;
    }
    // MÖBLER ENDAST INOMHUS: hela saken clampas innanför scenkanterna, och
    // golvsaker (möbler/husdjur) måste dessutom stå nere i golvzonen.
    const x = clamp(
      ((e.clientX - drag.rect.left) / drag.rect.width) * 100,
      drag.halfW, 100 - drag.halfW
    );
    const minY = drag.floor ? Math.max(drag.halfH, FLOOR_TOP + 4 - drag.halfH) : drag.halfH;
    const y = clamp(
      ((e.clientY - drag.rect.top) / drag.rect.height) * 100,
      minY, 100 - drag.halfH
    );
    if (drag.petId) {
      const pet = pets.find((p) => p.id === drag.petId);
      if (pet) pet.pos = { x, y };
    } else {
      placements[drag.id] = { x, y };
    }
    drag.node.style.left = x + "%";
    drag.node.style.top = y + "%";
  });

  function endDrag() {
    if (!drag) return;
    drag.node.classList.remove("dragging");
    if (drag.moved) {
      if (drag.petId) scheduleSavePets();
      else scheduleSaveRoom();
    } else if (drag.petId) {
      // Klick på ett husdjur → välj det (öppnar husdjurspanelen).
      selectedPetId = selectedPetId === drag.petId ? null : drag.petId;
      selectedId = null;
      renderStage();
      renderPets();
    } else {
      // Ingen förflyttning = klick → markera/avmarkera (visar 🗑️).
      selectedId = selectedId === drag.id ? null : drag.id;
      selectedPetId = null;
      renderStage();
      renderPets();
    }
    drag = null;
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  app.replaceChildren(view);
}
