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
import { getPalette } from "./room-palettes.js";
import { mountRumDjur } from "./varld-rum-djur.js";
import { itemSvg, itemSize } from "./art-items.js";
import { petStageNode, petBellyFlop, petPat, isPetBusy, petDisplayName, petArtThumb } from "./pages-rum-pets.js";
import { renderPetPanel, animalNamePanel } from "./pages-rum-pet-panel.js";
import { startPetPromenad } from "./rum-promenad.js";
import { confetti } from "./fx.js";
import { roomBackdropHtml, FLOOR_TOP, WINDOW_ID } from "./art-room.js";
import { mountRumFonster } from "./varld-rum-fonster.js";
import { mountWearTray } from "./varld-rum-wear.js";
import { mountRumMat } from "./varld-rum-mat.js";
import { mountRumDjurTray } from "./varld-rum-djurtray.js";
import { mountRumVaxlare } from "./varld-rum-vaxlare.js";

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
 * @param {HTMLElement} o.djurTray  behållare för "Mina djur"-lådan (undanstuvade)
 * @param {HTMLElement} o.djurHint  hint-rad ovanför "Mina djur"-lådan
 * @param {HTMLElement} o.wearTray  behållare för klädlådan
 * @param {HTMLElement} [o.matBtn]  "Lägg mat"-knappen (lägger äpplen på golvet)
 * @param {object} o.sd             studentData (ägda saker, rum, avatar)
 * @param {Array}  o.pets           husdjuren (redan kläck-kollade)
 * @param {string[]} o.justHatchedIds nykläckta denna sidladdning
 * @param {(equipped: string[]) => void} [o.onEquippedChange]
 *        körs när klädseln ändrats (så ute-avataren kan ritas om)
 * @param {number} [o.startRoom=0]  rum-index att starta i (flerrums-huset)
 * @param {(index:number, paletteId:string|null) => void} [o.onRoomChange]
 *        körs vid rums-byte (så husvärlden kan uppdatera palett/verktyg per rum)
 * @returns {{ count:number, current:()=>number, wallPaletteId:()=>string|null,
 *   setWallPalette:(id:string)=>void }} styr-API för husvärldens palett/verktyg
 */
export function mountRumScen({ stage, petPanel, tray, trayHint, djurTray, djurHint, wearTray, matBtn, sd, pets, justHatchedIds, onEquippedChange, startRoom = 0, onRoomChange }) {
  const owned = sd.ownedItems || [];
  const hasLamp = owned.includes(petData.LAMP_ITEM_ID);

  // De VANLIGA djuren (hund/katt …) är LEVANDE promenerande djur med fast
  // storlek – egen modul (varld-rum-djur.js, data: studentData.roomAnimals).
  // walkers() = allt som promenerar (mystery-djur + vanliga djur): de delar
  // promenad-AI, drag-pipeline och selectedPetId men bor i skilda datamodeller.
  const djur = mountRumDjur({ sd });
  // Bara djur som är I RUMMET promenerar/ritas; undanstuvade (stowed) mystery-
  // djur hålls utanför precis som de vanliga djuren (djur.list() filtrerar dem).
  const roomPets = () => pets.filter((p) => !p.stowed);
  const walkers = () => [...roomPets(), ...djur.list()];

  // "Mina djur"-lådan (undanstuvade djur) monteras längre ner; stow/return-
  // hjälparna refererar den vid klicktillfället (då är den satt).
  let djurTrayCtl = null;

  // Stuva undan / lägg tillbaka ett djur: uppdaterar data (via djur-modulen
  // resp. petData) + scenen + "Mina djur"-lådan. Djuret tappas aldrig, bara
  // flaggan flyttas. `kind` skiljer vanliga djur ("animal") från mystery ("pet").
  function setStowed(kind, id, stowed) {
    if (kind === "animal") {
      djur.setStowed(id, stowed);
    } else {
      const p = pets.find((x) => x.id === id);
      if (p) p.stowed = stowed;
      petData.setPetStowed(id, stowed).catch(() => {});
    }
    if (stowed && selectedPetId === id) selectedPetId = null;
    renderStage();
    renderPets();
    djurTrayCtl?.render();
    flash(stowed ? "Djuret vilar nu i Mina djur 🐾" : "Djuret är tillbaka i rummet! 🐾");
  }

  // --- Flerrums-modell (issue #34) -----------------------------------------
  // Huset kan ha flera rum (getRooms → 0-indexerad lista, rum0 = det gamla
  // studentData.room). VARJE rum har egen möblering (placements), väggpalett och
  // eget fönster; husdjur/vanliga djur/mat hör bara till GRUNDRUMMET (rum 0) –
  // de bor i huset och promenerar i huvudrummet. Vi bygger en modell per rum och
  // pekar `placements`/`fonster` mot det AKTIVA rummet (byts av goToRoom).
  const roomsData = data.getRooms(sd); // längd = antal upplåsta rum (≥1)
  const roomCount = roomsData.length;

  // Behåll bara placeringar för saker eleven fortfarande äger och som hör hemma
  // i rummet (inte kläder; ägget ritas som husdjur, inte som vanlig sak; vanliga
  // djur promenerar och har ingen statisk placering längre). Samma owned-lista
  // gäller alla rum → en ägd sak kan ställas in i valfritt/flera rum.
  function filterPlacements(saved) {
    const out = {};
    for (const [id, pos] of Object.entries(saved || {})) {
      if (owned.includes(id) && !isWearable(id) && !isAnimalItem(id) && id !== petData.EGG_ITEM_ID && pos) {
        // Golvsaker (möbler/husdjur) hålls nere i golvzonen även i gammal data.
        const minY = isFloorItem(id) ? FLOOR_TOP - 8 : 4;
        out[id] = { x: clamp(pos.x, 3, 97), y: clamp(pos.y, minY, 96) };
      }
    }
    return out;
  }
  // Fönstret är ett flyttbart/raderbart VÄGG-objekt (inte en shop-sak) – egen
  // modul (varld-rum-fonster.js) per rum, som sparar till rätt rum via saveRoomAt.
  const roomModels = roomsData.map((room, i) => ({
    placements: filterPlacements(room.placements),
    paletteId: room.paletteId || null,
    fonster: mountRumFonster({
      saved: room.window,
      save: (win) => data.saveRoomAt(i, { window: win }),
    }),
  }));
  let currentRoom = clamp(startRoom, 0, roomCount - 1);
  let placements = roomModels[currentRoom].placements;
  let fonster = roomModels[currentRoom].fonster;
  // Husdjur/mat syns bara i grundrummet; extra rum är möbler + väggfärg + fönster.
  const showPets = () => currentRoom === 0;

  // Utspritt startläge för en NY sak från lådan: golvsaker sprids i sidled längs
  // golvet, väggdekor längs väggen. Vi cyklar genom ett utspritt x-mönster
  // (mitten först, sedan ut mot kanterna) utifrån hur många saker som redan står
  // i samma zon, och radar i höjdled när ett varv är fullt. Så staplas aldrig
  // flera nyplacerade saker på exakt samma punkt ("klump mot mitten").
  const SPREAD_X = [50, 30, 70, 20, 80, 40, 60, 15, 85];
  function nextSpot(floor) {
    const n = Object.keys(placements).filter((pid) => isFloorItem(pid) === floor).length;
    const x = SPREAD_X[n % SPREAD_X.length];
    const row = Math.floor(n / SPREAD_X.length);
    const y = floor ? 78 - (row % 2) * 8 : 32 + (row % 2) * 12;
    return { x, y };
  }

  // Vanliga djur hör INTE hemma i lådan/placements längre – de promenerar.
  const roomItemsOwned = owned.filter(
    (id) => !isWearable(id) && !isAnimalItem(id) && id !== petData.EGG_ITEM_ID && getItem(id)
  );

  let selectedId = null; // vald placerad sak (visar borttagningsknapp)
  let selectedPetId = null; // djur vars namn-/matnings-vy är öppen (via ✏️)
  let openRenameForId = null; // ✏️ nyss klickad → öppna namnfältet + fokusera (engångs)
  let justHatchedId = justHatchedIds[0] || null; // firas i panelen en gång

  // Spara rummet (debounce – tät dragrörelse skriver inte varje pixel). Index +
  // placeringsobjekt fångas vid schemaläggningen så en snabb rums-växling inte
  // råkar spara det gamla rummets ändring till fel rum.
  let saveTimer = null;
  let saveTarget = null; // { idx, pl } för den vändande skrivningen
  function scheduleSaveRoom() {
    saveTarget = { idx: currentRoom, pl: placements };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const t = saveTarget;
      saveTarget = null;
      if (t) data.saveRoomAt(t.idx, { placements: t.pl }).catch(() => {});
    }, 250);
  }
  // Skriv en väntande rums-sparning DIREKT (t.ex. innan man byter rum) så inget
  // tappas när debounce-timern annars skulle brytas av nästa rums placeringar.
  function flushRoomSave() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    const t = saveTarget;
    saveTarget = null;
    if (t) data.saveRoomAt(t.idx, { placements: t.pl }).catch(() => {});
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
        onStow: () => setStowed("animal", animal.id, true),
      }));
      return;
    }
    renderPetPanel(petPanel, pet, {
      hasLamp,
      justHatched: !!pet && pet.id === justHatchedId,
      startRename: openRename === selectedPetId,
      onStow: pet && pet.hatchedAt ? () => setStowed("pet", pet.id, true) : null,
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
      // Bredd/höjd skalas med scenBREDDEN (1cqw = 1 % av scen), cap:ad per enhet,
      // se .varld-lager.room-stage i styles.css → saken upptar samma andel av
      // scenen vid varje bredd (ingen ihopklumpning). cqw skrivs DIREKT här (inte
      // via en egen var) – annars resolvas den mot fel container i Chromium. calc
      // → faktiskt layoutmått, så drag-clampen (offsetWidth/Height) följer med.
      stage.appendChild(el(`<div class="room-item${selectedId === id ? " selected" : ""}"
        data-id="${id}" style="left:${pos.x}%;top:${pos.y}%" title="${item.name}">
        <span class="ri-emoji" style="width:calc(${size.w} * min(var(--rum-koeff, 2.5) * 1cqw, var(--rum-cap, 25px)));height:calc(${size.h} * min(var(--rum-koeff, 2.5) * 1cqw, var(--rum-cap, 25px)))">${itemSvg(id) || item.emoji}</span>
        <button class="ri-remove" data-remove="${id}" title="Plocka bort">🗑️</button>
      </div>`));
    }
    // Husdjur/mat hör bara till grundrummet (rum 0) – extra rum ritar bara
    // möbler/dekor. Äpplen på golvet ritas UNDER husdjuren (så djuret syns
    // ovanpå när det gnager). De är inga .room-item (data-id) och räknas därför
    // inte som hinder i promenad-AI:n – precis som husdjuren själva (data-pet-id).
    if (showPets()) {
      for (const apple of mat.apples()) {
        stage.appendChild(el(`<div class="room-apple" data-apple-id="${apple.id}"
          style="left:${apple.x}%;top:${apple.y}%" title="Mysterymat">🍎</div>`));
      }
      for (const pet of roomPets()) {
        if (!pet.pos) pet.pos = { x: 50, y: 70 };
        stage.appendChild(petStageNode(pet, selectedPetId === pet.id));
      }
      // Vanliga djur (fast storlek) promenerar bland mystery-djuren.
      for (const a of djur.list()) {
        stage.appendChild(djur.stageNode(a, selectedPetId === a.id));
      }
    }
    const petsHere = showPets() && (roomPets().length > 0 || djur.list().length > 0);
    if (Object.keys(placements).length === 0 && !petsHere) {
      stage.appendChild(el(`<div class="room-empty">${roomCount > 1
        ? `Rum ${currentRoom + 1} är tomt – öppna Lådan 📦 och möblera det!`
        : "Ditt rum är tomt – öppna Lådan 📦 och ställ in dina saker!"}</div>`));
    }
    // Rums-växlaren (dörrar + rumslista) läggs överst – bara i flerrums-hus.
    // Samma nod-objekt återanvänds vid varje renderStage så lyssnarna sitter kvar.
    if (roomCount > 1 && vaxlare) {
      stage.appendChild(vaxlare.listBar);
      stage.appendChild(vaxlare.doorsWrap);
      vaxlare.render();
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

  // "Mina djur"-lådan (undanstuvade djur) lever i sin egen modul. Vi räknar fram
  // korten här (vanliga djur + kläckta mystery-djur som är undanstuvade) och
  // låter ett klick lägga tillbaka djuret i rummet.
  djurTrayCtl = mountRumDjurTray({
    tray: djurTray,
    hint: djurHint,
    listStowed: () => [
      ...djur.stowedList().map((a) => ({
        kind: "animal", id: a.id, name: djur.displayName(a),
        artHtml: itemSvg(a.id) || (getItem(a.id)?.emoji ?? "🐾"),
      })),
      ...pets.filter((p) => p.stowed && p.hatchedAt).map((p) => ({
        kind: "pet", id: p.id, name: petDisplayName(p), artHtml: petArtThumb(p),
      })),
    ],
    onReturn: (kind, id) => setStowed(kind, id, false),
  });

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

  // --- Rums-växling (dörrar + rumslista) -----------------------------------
  // Väggpaletten sätts per rum DIREKT på scenen (rum 0:s palett = husets, se
  // pages-varld.js); okänt/saknat palett-id faller tillbaka på default via
  // getPalette. Extra rummets palett rör aldrig husets exteriör.
  function applyWallPalette() {
    const p = getPalette(roomModels[currentRoom].paletteId);
    stage.style.setProperty("--rum-wall", p.wall);
    stage.style.setProperty("--rum-wall2", p.wall2);
  }
  applyWallPalette();

  // Byt aktivt rum: spara ev. väntande ändring i det gamla rummet, peka om
  // placements/fonster, färga väggarna och rita om. onRoomChange låter husvärlden
  // uppdatera palettväljaren och dölja rum-0-verktyg (mat/djur) i extra rum.
  function goToRoom(index) {
    index = clamp(index, 0, roomCount - 1);
    if (index === currentRoom) return;
    if (mat && mat.cancelPlacing) mat.cancelPlacing(); // lämna ev. mat-placering
    flushRoomSave();
    currentRoom = index;
    placements = roomModels[index].placements;
    fonster = roomModels[index].fonster;
    selectedId = null;
    selectedPetId = null;
    petPanel.replaceChildren();
    applyWallPalette();
    renderStage();
    renderTray();
    if (onRoomChange) onRoomChange(index, roomModels[index].paletteId);
  }

  // Växlaren byggs bara när huset faktiskt har fler än ett rum (enrums-hus är
  // helt oförändrade). Den läggs in i scenen av renderStage().
  const vaxlare = roomCount > 1
    ? mountRumVaxlare({ count: roomCount, getCurrent: () => currentRoom, onPick: goToRoom })
    : null;

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
    // Golvsaker ställs på golvet, väggdekor hängs på väggen – men SPRIDS ut i
    // sidled i stället för att alla landa mitt i scenen (annars staplas nya
    // saker ovanpå varandra och ser "hopklumpade mot mitten" ut). Nästa lediga
    // punkt väljs ur ett utspritt mönster utifrån hur många som redan står i
    // samma zon; positionen är fortfarande procent så den kan dras/sparas fritt.
    placements[id] = nextSpot(isFloorItem(id));
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
    // Djuren promenerar bara i grundrummet – i extra rum ritas de inte, så
    // getPets ger tom lista där (AI:n har då inget att flytta).
    getPets: () => (showPets() ? walkers() : []),
    isPetPaused: (pet) => pet.id === selectedPetId || !!(drag && drag.petId === pet.id) || isPetBusy(pet.id),
    getApples: () => (showPets() ? mat.apples() : []),
    onEat: mat.onEat,
    onSettled: () => {
      saveWalkPositions();
      djur.saveWalkPositions();
    },
  });

  // Styr-API åt husvärlden (pages-varld.js): palett per rum + verktygssynlighet.
  return {
    count: roomCount,
    current: () => currentRoom,
    wallPaletteId: () => roomModels[currentRoom].paletteId,
    // Sätt & spara AKTIVA rummets väggpalett (används av "Måla om"-panelen).
    // Rum 0:s palett är även husets exteriör – den delen sköts i pages-varld.js.
    setWallPalette: (id) => {
      roomModels[currentRoom].paletteId = id;
      applyWallPalette();
      data.saveRoomAt(currentRoom, { paletteId: id }).catch(() => {});
    },
  };
}
