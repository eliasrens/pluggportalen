// ============================================================================
// Pluggportalen – rummets innehåll i husvärlden ("rum"-nivåns lager)
// ----------------------------------------------------------------------------
// Monterar hela inne-vyn i ett givet scen-lager: bakdrop, placerade saker,
// husdjuren (ägg/varelser, matning, klick-på-rygg), drag & drop och
// promenad-AI:n. Logiken är porterad oförändrad från gamla pages-rum.js –
// skillnaden är bara att lådan/klädlådan/husdjurspanelen numera ritas i
// overlay-paneler som husvärldssidan (pages-varld.js) äger och skickar in.
// Placeringar sparas i procent av scenen → ser likadana ut oavsett skärm.
// ============================================================================

import * as data from "./data.js";
import * as petData from "./data-pet.js";
import { el, flash, clamp } from "./ui.js";
import { getItem, isWearable, isFlatItem } from "./shop-items.js";
import { itemSvg, itemSize } from "./art-items.js";
import { petStageNode, renderPetPanel, petBellyFlop } from "./pages-rum-pets.js";
import { startPetPromenad } from "./rum-promenad.js";
import { confetti } from "./fx.js";
import { roomBackdropHtml, FLOOR_TOP, WINDOW_ID, WINDOW_DEFAULT, windowItemHtml } from "./art-room.js";
import { mountWearTray } from "./varld-rum-wear.js";

/** Saker som står på golvet (möbler & husdjur) – får inte hamna på väggen. */
function isFloorItem(id) {
  const it = getItem(id);
  return !!(it && (it.category === "mobler" || it.category === "husdjur"));
}

/**
 * Montera rummet i `stage` (ett fullstort lager i husvärldens scen).
 *
 * @param {object} o
 * @param {HTMLElement} o.stage     rummets lager (får .room-item-barn m.m.)
 * @param {HTMLElement} o.petPanel  overlay-behållare för husdjurspanelen
 * @param {HTMLElement} o.tray      behållare för sak-lådan
 * @param {HTMLElement} o.trayHint  hint-rad ovanför sak-lådan
 * @param {HTMLElement} o.wearTray  behållare för klädlådan
 * @param {object} o.sd             studentData (ägda saker, rum, avatar)
 * @param {Array}  o.pets           husdjuren (redan kläck-kollade)
 * @param {string[]} o.justHatchedIds nykläckta denna sidladdning
 * @param {(equipped: string[]) => void} [o.onEquippedChange]
 *        körs när klädseln ändrats (så ute-avataren kan ritas om)
 */
export function mountRumScen({ stage, petPanel, tray, trayHint, wearTray, sd, pets, justHatchedIds, onEquippedChange }) {
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

  // Fönstret är ett flyttbart/raderbart VÄGG-objekt (inte en shop-sak). Läget
  // sparas separat i room.window = { x, y, removed }: saknas data → default vid
  // väggskarven; removed:true → borttaget (kvarstår efter reload, kan läggas
  // tillbaka via lådan). Positionen clampas till väggzonen (ovanför golvet).
  const savedWin = (sd.room && sd.room.window) || null;
  let windowRemoved = !!(savedWin && savedWin.removed);
  let windowPos = {
    x: savedWin && Number.isFinite(savedWin.x) ? clamp(savedWin.x, 3, 97) : WINDOW_DEFAULT.x,
    y: savedWin && Number.isFinite(savedWin.y) ? clamp(savedWin.y, 4, FLOOR_TOP) : WINDOW_DEFAULT.y,
  };

  const roomItemsOwned = owned.filter(
    (id) => !isWearable(id) && id !== petData.EGG_ITEM_ID && getItem(id)
  );

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

  // Spara fönstrets läge/borttagning (samma debounce – dot-path room.window).
  let winSaveTimer = null;
  function scheduleSaveWindow() {
    clearTimeout(winSaveTimer);
    winSaveTimer = setTimeout(() => {
      data.saveRoom({ window: { x: windowPos.x, y: windowPos.y, removed: windowRemoved } }).catch(() => {});
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

  // Promenad-AI:ns positionsändringar sparas glest (Firestore-skrivningar är
  // inte gratis) – som mest en gång per minut, och bara när ett djur stannat.
  let lastWalkSave = 0;
  function saveWalkPositions() {
    const now = Date.now();
    if (now - lastWalkSave < 60000) return;
    lastWalkSave = now;
    const positions = {};
    for (const p of pets) if (p.pos) positions[p.id] = { x: p.pos.x, y: p.pos.y };
    petData.savePetPositions(positions).catch(() => {});
  }

  // Husdjurspanelen (overlay i scenen – valt djur, eller det nykläckta).
  function renderPets() {
    const pet = pets.find((p) => p.id === selectedPetId) || null;
    renderPetPanel(petPanel, pet, {
      hasLamp,
      justHatched: !!pet && pet.id === justHatchedId,
      onUpdate(nextPets, petId) {
        // Behåll rummets aktuella positioner – serverns pos kan vara äldre än
        // dit promenad-AI:n hunnit gå (positioner sparas glest).
        for (const np of nextPets) {
          const old = pets.find((p) => p.id === np.id);
          if (old && old.pos) np.pos = old.pos;
        }
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
    // Fönstret (väggobjekt) ritas direkt ovanpå bakgrunden så golvsaker/möbler
    // kan staplas framför det. Borttaget fönster ritas inte alls.
    if (!windowRemoved) {
      stage.appendChild(el(windowItemHtml({ x: windowPos.x, y: windowPos.y, selected: selectedId === WINDOW_ID })));
    }
    // Rita platta golvsaker (mattor) FÖRST så vanliga möbler, dekor och husdjur
    // alltid staplas ovanpå dem – oavsett i vilken ordning de placerats/flyttats.
    const orderedIds = Object.keys(placements).sort(
      (a, b) => (isFlatItem(a) ? 0 : 1) - (isFlatItem(b) ? 0 : 1)
    );
    for (const id of orderedIds) {
      const item = getItem(id);
      if (!item) continue;
      const pos = placements[id];
      const size = itemSize(id);
      // Bredd/höjd skalas med scenens --rum-skala (calc → faktiskt layoutmått,
      // så drag-clampen som läser offsetWidth/Height följer med automatiskt).
      stage.appendChild(el(`<div class="room-item${selectedId === id ? " selected" : ""}"
        data-id="${id}" style="left:${pos.x}%;top:${pos.y}%" title="${item.name}">
        <span class="ri-emoji" style="width:calc(${size.w}rem * var(--rum-skala, 1));height:calc(${size.h}rem * var(--rum-skala, 1))">${itemSvg(id) || item.emoji}</span>
        <button class="ri-remove" data-remove="${id}" title="Plocka bort">🗑️</button>
      </div>`));
    }
    for (const pet of pets) {
      if (!pet.pos) pet.pos = { x: 50, y: 70 };
      stage.appendChild(petStageNode(pet, selectedPetId === pet.id));
    }
    if (Object.keys(placements).length === 0 && pets.length === 0) {
      stage.appendChild(el(`<div class="room-empty">Ditt rum är tomt – öppna Lådan 📦 och ställ in dina saker!</div>`));
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
    // Borttaget fönster kan alltid läggas tillbaka härifrån (hamnar då åter
    // vid väggskarven). Visas bara när fönstret faktiskt är borttaget.
    if (windowRemoved) {
      tray.appendChild(el(`<button class="tray-item" data-restore="${WINDOW_ID}" title="Fönster">
        <span class="tray-emoji">🪟</span>
        <span class="tray-namn">Fönster</span>
      </button>`));
    }
  }

  // Klädlådan lever i sin egen modul (rendering + sätt-på/ta-av + sparning).
  mountWearTray({ wearTray, sd, onEquippedChange });

  // Nykläckt ägg? Fira och öppna panelen för namngivning direkt.
  if (justHatchedId) {
    selectedPetId = justHatchedId;
    confetti();
    flash("Ett ägg har kläckts i ditt rum! 🎉");
  }

  renderStage();
  renderTray();
  renderPets();

  // Placera en sak från lådan (klick).
  tray.addEventListener("click", (e) => {
    // Lägg tillbaka ett borttaget fönster (åter vid väggskarven).
    const restoreBtn = e.target.closest("[data-restore]");
    if (restoreBtn && restoreBtn.dataset.restore === WINDOW_ID) {
      windowRemoved = false;
      windowPos = { ...WINDOW_DEFAULT };
      selectedId = null;
      renderStage();
      renderTray();
      scheduleSaveWindow();
      return;
    }
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

  // Ta bort en placerad sak (🗑️). Husdjur kan inte plockas bort – de bor här.
  stage.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove]");
    if (!removeBtn) return;
    const id = removeBtn.dataset.remove;
    // Fönstret raderas (kvarstår borta efter reload) – kan läggas tillbaka via
    // lådan. Övriga saker plockas bort ur placements som förr.
    if (id === WINDOW_ID) {
      windowRemoved = true;
      if (selectedId === WINDOW_ID) selectedId = null;
      renderStage();
      renderTray();
      scheduleSaveWindow();
      return;
    }
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
      // Fönstret är ett väggobjekt → egen väggzon-clamp (inte golv-clampen).
      win: node.dataset.id === WINDOW_ID,
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
    // Väggobjekt (fönstret) hålls i väggzonen ovanför golvlinjen; golvsaker
    // hålls nere i golvzonen; övrig väggdekor får hela väggen.
    let minY = drag.halfH;
    let maxY = 100 - drag.halfH;
    if (drag.win) {
      maxY = FLOOR_TOP; // fönstrets centrum korsar aldrig golvlinjen
    } else if (drag.floor) {
      minY = Math.max(drag.halfH, FLOOR_TOP + 4 - drag.halfH);
    }
    const y = clamp(
      ((e.clientY - drag.rect.top) / drag.rect.height) * 100,
      minY, maxY
    );
    if (drag.petId) {
      const pet = pets.find((p) => p.id === drag.petId);
      if (pet) pet.pos = { x, y };
    } else if (drag.win) {
      windowPos = { x, y };
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
      else if (drag.win) scheduleSaveWindow();
      else scheduleSaveRoom();
    } else if (drag.petId) {
      // Klick på ett husdjur → välj det (öppnar husdjurspanelen) och låt det
      // lägga sig på rygg och sprattla av glädje (efter omritningen, så
      // animationen träffar den nya noden).
      selectedPetId = selectedPetId === drag.petId ? null : drag.petId;
      selectedId = null;
      renderStage();
      renderPets();
      const pet = pets.find((p) => p.id === drag.petId);
      if (pet && pet.hatchedAt) petBellyFlop(pet);
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

  // Promenad-AI: kläckta husdjur går själva omkring på golvet mellan möblerna
  // (rum-promenad.js). Valda/dragna djur pausar; loopen stoppar sig själv när
  // scenen försvinner ur DOM:en (sidbyte).
  startPetPromenad({
    stage,
    getPets: () => pets,
    isPetPaused: (pet) => pet.id === selectedPetId || !!(drag && drag.petId === pet.id),
    onSettled: saveWalkPositions,
  });
}
