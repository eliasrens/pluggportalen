// ============================================================================
// Pluggportalen – rummets innehåll i husvärlden ("rum"-nivåns lager)
// ----------------------------------------------------------------------------
// Monterar hela inne-vyn i ett givet scen-lager: bakdrop, placerade saker,
// husdjuren (ägg/varelser, matning, klick-på-rygg), drag & drop och
// promenad-AI:n. Systermoduler äger delarna: kläder (varld-rum-wear), maten
// (varld-rum-mat), vanliga djur (varld-rum-djur) och fönstret (varld-rum-
// fonster); overlay-panelerna ägs av husvärldssidan (pages-varld.js).
// Placeringar sparas i procent av scenen → ser likadana ut oavsett skärm.
// ============================================================================

import * as data from "./data.js";
import * as petData from "./data-pet.js";
import { el, flash, clamp } from "./ui.js";
import { getItem, isWearable, isFlatItem, isAnimalItem } from "./shop-items.js";
import { mountRumDjur } from "./varld-rum-djur.js";
import { itemSvg, itemSize } from "./art-items.js";
import { petStageNode, renderPetPanel, petBellyFlop, petPat, isPetBusy, animalNamePanel } from "./pages-rum-pets.js";
import { startPetPromenad } from "./rum-promenad.js";
import { confetti } from "./fx.js";
import { roomBackdropHtml, FLOOR_TOP, WINDOW_ID } from "./art-room.js";
import { mountRumFonster } from "./varld-rum-fonster.js";
import { mountWearTray } from "./varld-rum-wear.js";
import { mountRumMat } from "./varld-rum-mat.js";

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
 * @param {HTMLElement} [o.matBtn]  "Lägg mat"-knappen (lägger äpplen på golvet)
 * @param {object} o.sd             studentData (ägda saker, rum, avatar)
 * @param {Array}  o.pets           husdjuren (redan kläck-kollade)
 * @param {string[]} o.justHatchedIds nykläckta denna sidladdning
 * @param {(equipped: string[]) => void} [o.onEquippedChange]
 *        körs när klädseln ändrats (så ute-avataren kan ritas om)
 */
export function mountRumScen({ stage, petPanel, tray, trayHint, wearTray, matBtn, sd, pets, justHatchedIds, onEquippedChange }) {
  const owned = sd.ownedItems || [];
  const hasLamp = owned.includes(petData.LAMP_ITEM_ID);

  // De VANLIGA djuren (hund/katt …) är LEVANDE promenerande djur med fast
  // storlek – egen modul (varld-rum-djur.js, data: studentData.roomAnimals).
  // walkers() = allt som promenerar (mystery-djur + vanliga djur): de delar
  // promenad-AI, drag-pipeline och selectedPetId men bor i skilda datamodeller.
  const djur = mountRumDjur({ sd });
  const walkers = () => [...pets, ...djur.list()];

  // Behåll bara placeringar för saker eleven fortfarande äger och som hör hemma
  // i rummet (inte kläder; ägget ritas som husdjur, inte som vanlig sak; vanliga
  // djur promenerar och har ingen statisk placering längre).
  const placements = {};
  const savedPlacements = (sd.room && sd.room.placements) || {};
  for (const [id, pos] of Object.entries(savedPlacements)) {
    if (owned.includes(id) && !isWearable(id) && !isAnimalItem(id) && id !== petData.EGG_ITEM_ID && pos) {
      // Golvsaker (möbler/husdjur) hålls nere i golvzonen även i gammal data.
      const minY = isFloorItem(id) ? FLOOR_TOP - 8 : 4;
      placements[id] = { x: clamp(pos.x, 3, 97), y: clamp(pos.y, minY, 96) };
    }
  }

  // Fönstret är ett flyttbart/raderbart VÄGG-objekt (inte en shop-sak) – egen
  // modul (varld-rum-fonster.js, data: studentData.room.window).
  const fonster = mountRumFonster({ sd });

  // Vanliga djur hör INTE hemma i lådan/placements längre – de promenerar.
  const roomItemsOwned = owned.filter(
    (id) => !isWearable(id) && !isAnimalItem(id) && id !== petData.EGG_ITEM_ID && getItem(id)
  );

  let selectedId = null; // vald placerad sak (visar borttagningsknapp)
  let selectedPetId = null; // djur vars namn-/matnings-vy är öppen (via ✏️)
  let openRenameForId = null; // ✏️ nyss klickad → öppna namnfältet + fokusera (engångs)
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

  // Namn-/matnings-vyn (overlay under scenen). Öppnas ENBART via ✏️-affordansen
  // (namn-etiketten) eller vid nykläckning – klick på djuret självt klappar det
  // bara (ingen inforuta). openRenameForId är engångs: konsumeras vid ritning.
  function renderPets() {
    const openRename = openRenameForId;
    openRenameForId = null;
    const pet = pets.find((p) => p.id === selectedPetId) || null;
    // Vanliga djur (fast storlek): lättviktig namn-vy (bara inline-namnfältet).
    const animal = !pet && djur.byId(selectedPetId);
    if (animal) {
      petPanel.replaceChildren(animalNamePanel({
        displayName: djur.displayName(animal),
        currentName: animal.name || "",
        autoFocus: openRename === animal.id,
        onSave: async (clean) => {
          const res = await djur.saveName(animal.id, clean);
          if (res.ok) { renderStage(); renderPets(); }
          return res;
        },
      }));
      return;
    }
    renderPetPanel(petPanel, pet, {
      hasLamp,
      justHatched: !!pet && pet.id === justHatchedId,
      startRename: openRename === selectedPetId,
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
    const winNode = fonster.stageNode(selectedId === WINDOW_ID);
    if (winNode) stage.appendChild(winNode);
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
    // Äpplen på golvet ritas UNDER husdjuren (så djuret syns ovanpå när det
    // står och gnager). De är inga .room-item (data-id) och räknas därför inte
    // som hinder i promenad-AI:n – precis som husdjuren själva (data-pet-id).
    for (const apple of mat.apples()) {
      stage.appendChild(el(`<div class="room-apple" data-apple-id="${apple.id}"
        style="left:${apple.x}%;top:${apple.y}%" title="Mysterymat">🍎</div>`));
    }
    for (const pet of pets) {
      if (!pet.pos) pet.pos = { x: 50, y: 70 };
      stage.appendChild(petStageNode(pet, selectedPetId === pet.id));
    }
    // Vanliga djur (fast storlek) promenerar bland mystery-djuren.
    for (const a of djur.list()) {
      stage.appendChild(djur.stageNode(a, selectedPetId === a.id));
    }
    if (Object.keys(placements).length === 0 && pets.length === 0 && djur.list().length === 0) {
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
    const winBtn = fonster.trayNode();
    if (winBtn) tray.appendChild(winBtn);
  }

  // Klädlådan lever i sin egen modul (rendering + sätt-på/ta-av + sparning).
  mountWearTray({ wearTray, sd, onEquippedChange });

  // Matningen (äpplen på golvet) lever i sin egen modul: äger floorApples +
  // "Lägg mat"-knappen och ger promenad-AI:n apples()/onEat. renderStage() läser
  // äpplena via mat.apples(), så mat måste skapas före första ritningen.
  const mat = mountRumMat({
    matBtn, stage, sd,
    getPets: () => pets,
    renderScene: () => renderStage(),
    renderPanel: () => renderPets(),
    isSelected: (petId) => selectedPetId === petId,
  });

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
      fonster.restore();
      selectedId = null;
      renderStage();
      renderTray();
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
    // ✏️-affordansen (namn-etiketten under ett djur): öppna namn-/matnings-vyn.
    // Gäller BÅDE mystery-djur och vanliga djur – döpningen känns likadan.
    const renameBtn = e.target.closest("[data-rename]");
    if (renameBtn) {
      openRenameForId = renameBtn.dataset.rename;
      selectedPetId = renameBtn.dataset.rename;
      selectedId = null;
      renderStage();
      renderPets();
      return;
    }
    const removeBtn = e.target.closest("[data-remove]");
    if (!removeBtn) return;
    const id = removeBtn.dataset.remove;
    // Fönstret raderas (kvarstår borta efter reload) – kan läggas tillbaka via
    // lådan. Övriga saker plockas bort ur placements som förr.
    if (id === WINDOW_ID) {
      fonster.remove();
      if (selectedId === WINDOW_ID) selectedId = null;
      renderStage();
      renderTray();
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
    // Låt 🗑️ (borttagning) och ✏️ (namn-etikett/döpning) hanteras som klick –
    // starta ingen drag-rörelse på dem.
    if (e.target.closest("[data-remove]") || e.target.closest("[data-rename]")) return;
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
      const pet = walkers().find((p) => p.id === drag.petId);
      if (pet) pet.pos = { x, y };
    } else if (drag.win) {
      fonster.setPos(x, y);
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
      if (drag.petId) (djur.byId(drag.petId) ? djur.scheduleSave() : scheduleSavePets());
      else if (drag.win) fonster.scheduleSave();
      else scheduleSaveRoom();
    } else if (drag.petId) {
      // Klick på ett djur → KLAPPA det (ingen inforuta): mystery-djur lägger sig
      // på rygg och sprattlar (petBellyFlop), vanliga fast-storleks-djur gör ett
      // gulligt glädjeskutt med hjärtan (petPat). Namn-/matnings-vyn öppnas i
      // stället via ✏️-affordansen på namn-etiketten under djuret.
      const pet = pets.find((p) => p.id === drag.petId);
      if (pet && pet.hatchedAt) petBellyFlop(pet);
      else if (djur.byId(drag.petId)) petPat(drag.petId);
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
  // (rum-promenad.js). Finns äpplen på golvet styr hungriga djur dit och äter
  // (seek-läge, mat.onEat). Valda/dragna djur pausar; loopen stoppar sig själv
  // när scenen försvinner ur DOM:en (sidbyte).
  startPetPromenad({
    stage,
    // Mystery-djur OCH vanliga djur promenerar; bara mystery-djuren är
    // hungriga (isHungry i data-pet.js) så maten träffar aldrig de vanliga.
    getPets: walkers,
    isPetPaused: (pet) => pet.id === selectedPetId || !!(drag && drag.petId === pet.id) || isPetBusy(pet.id),
    getApples: mat.apples,
    onEat: mat.onEat,
    onSettled: () => {
      saveWalkPositions();
      djur.saveWalkPositions();
    },
  });
}
