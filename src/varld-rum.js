// ============================================================================
// Pluggporten – rummets innehåll i husvärlden ("rum"-nivåns lager)
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
import { getItem, isWearable, isFlatItem, isAnimalItem, isHouseItem, isGardenItem, itemIdFromKey } from "./shop-items.js";
import { getPalette } from "./room-palettes.js";
import { mountRumDjur, djurMatSektion } from "./varld-rum-djur.js";
import { farmFromData, roomIndexOf, roomLocation, isRoomLocation } from "./farm-core.js";
import { itemSvg, itemSize, itemRiktning, kanRoteras, kanVandas, riktningsFalt, vridPlacering } from "./art-items.js";
import { petStageNode, petBellyFlop, petPat, isPetBusy, petDisplayName, petArtThumb, setPetMood } from "./pages-rum-pets.js";
import { renderPetPanel, animalNamePanel } from "./pages-rum-pet-panel.js";
import { startPetPromenad } from "./rum-promenad.js";
import { confetti } from "./fx.js";
import { roomBackdropHtml, FLOOR_TOP, WINDOW_ID } from "./art-room.js";
import { mountRumFonster } from "./varld-rum-fonster.js";
import { mountWearTray } from "./varld-rum-wear.js";
import { mountRumMat } from "./varld-rum-mat.js";
import { mountRumDjurTray } from "./varld-rum-djurtray.js";
import { mountRumVaxlare } from "./varld-rum-vaxlare.js";
// Inrednings-kärnan (drag/klamring/ritning) delas med Klasscentrets rum (#490).
import { kopplaRumDrag, ordnaNycklar, nastaPlats, nyPlaceringsNyckel, rumSakHtml, sakVerktygHtml, kopplaVridTangenter } from "./rum-promenad-golv.js";

// Kartmästare-pokaler (Hitta rätt! #610): ingen ägd sak – de ritas ur
// hittaRattMeta/ledare (src/hitta-ratt/hr-pokal-rum.js, laddas dynamiskt) och
// bara PLACERINGEN sparas här, under nyckeln "hrpokal-<packId>".
const HR_POKAL = "hrpokal-";
const arHrPokal = (id) => String(id).startsWith(HR_POKAL);
const hrPokalAviserade = new Set(); // "ligger i Möbler"-tipset en gång per pokal och session

/** Saker som står på golvet (möbler, husdjur, pokaler) – får inte hamna på väggen. */
function isFloorItem(id) {
  if (arHrPokal(id)) return true;
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
 * @param {() => void} [o.onMatActivate]  körs när mat-läget slås på (så husvärlden
 *        kan stänga öppna paneler – mat och paneler är ömsesidigt uteslutande)
 * @returns {{ count:number, current:()=>number, wallPaletteId:()=>string|null,
 *   setWallPalette:(id:string)=>void, exitMat:()=>void }} styr-API för husvärldens
 *   palett/verktyg per rum + exitMat() som avslutar mat-läget
 */
export function mountRumScen({ stage, petPanel, tray, trayHint, djurTray, djurHint, wearTray, matBtn, sd, pets, justHatchedIds, onEquippedChange, startRoom = 0, onRoomChange, onMatActivate }) {
  const owned = sd.ownedItems || [];
  const hasLamp = owned.includes(petData.LAMP_ITEM_ID);

  // De VANLIGA djuren (hund/katt …) är LEVANDE promenerande djur med fast
  // storlek – egen modul (varld-rum-djur.js, data: studentData.roomAnimals).
  // walkers() = allt som promenerar (mystery-djur + vanliga djur): de delar
  // promenad-AI, drag-pipeline och selectedPetId men bor i skilda datamodeller.
  const djur = mountRumDjur({ sd, roomCount: data.getRoomCount(sd) });
  const startFarm = farmFromData(sd);
  // Magiska bär i gårdens skörde-förråd (#332) – lokal räknare för panelens
  // bär-knapp, uppdateras ur varje feedPetBerry-svar (servern är sanningen).
  let barKvar = startFarm.inventoryHarvest[petData.BERRY_CROP_ID] || 0;
  // Djur i alla rum (#698): mystery-djurens rum bor i farm.placedAnimals
  // ("room:N"; ingen post = rum 1). Hålls i en egen karta (petId → plats) så
  // den överlever att pets-listan byts ut (matning, kläckning).
  const petPlats = new Map(startFarm.placedAnimals.map((p) => [p.petId, p.location]));
  /** Rummet ett mystery-djur bor i – sparat rum som huset saknar → rum 1. */
  function petRoom(p) {
    const i = roomIndexOf(petPlats.get(p.id) || "room");
    return i !== null && i < roomCount ? i : 0;
  }
  // Bara djur som är I DET AKTIVA RUMMET promenerar/ritas; undanstuvade (stowed)
  // mystery-djur hålls utanför precis som de vanliga djuren (djur.list(rum)).
  const roomPets = () => pets.filter((p) => !p.stowed && petRoom(p) === currentRoom);
  const walkers = () => [...roomPets(), ...djur.list(currentRoom)];
  // Bråkdraken (#714) bor i studentData.brakdrake och laddas LAT (bara när den
  // finns): dras, flyttar mellan rum och vilar i Mina djur som ett djur, men
  // promenerar inte – därför inte bland walkers().
  let drake = null;
  const harHar = () => [...walkers(), ...(drake?.list(currentRoom) || [])];

  // "Mina djur"-lådan (undanstuvade djur) monteras längre ner; stow/return-
  // hjälparna refererar den vid klicktillfället (då är den satt).
  let djurTrayCtl = null;

  // Stuva undan / lägg tillbaka ett djur: uppdaterar data (via djur-modulen
  // resp. petData) + scenen + "Mina djur"-lådan. Djuret tappas aldrig, bara
  // flaggan flyttas. `kind` skiljer vanliga djur ("animal") från mystery ("pet").
  function setStowed(kind, id, stowed) {
    // Ett djur som släpps ut igen kommer fram i rummet eleven står i (#698).
    if (!stowed && roomCount > 1) flyttaTillRum(id, currentRoom);
    if (kind === "animal") {
      djur.setStowed(id, stowed);
    } else if (kind === "drake") {
      drake?.setStowed(stowed);
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
  // eget fönster. Djuren bor i det rum de placerats i (#698, farm.placedAnimals
  // "room:N" – ingen post = rum 1) och Mysterymaten ligger i det rum den lagts
  // ut i. Vi bygger en modell per rum och pekar `placements`/`fonster` mot det
  // AKTIVA rummet (byts av goToRoom).
  const roomsData = data.getRooms(sd); // längd = antal upplåsta rum (≥1)
  const roomCount = roomsData.length;

  // Behåll bara placeringar för saker eleven fortfarande äger och som hör hemma
  // i rummet (inte kläder; ägget ritas som husdjur, inte som vanlig sak; vanliga
  // djur promenerar och har ingen statisk placering längre). Samma owned-lista
  // gäller alla rum → en ägd sak kan ställas in i valfritt/flera rum. Husskal
  // (isHouseItem) är exteriör, aldrig en golvsak i rummet.
  // Nyckeln kan vara ett rent sak-id (ett exemplar / äldre data) eller "<id>#<n>"
  // (extra exemplar av samma möbel/dekor). Sak-id:t härleds med itemIdFromKey.
  function filterPlacements(saved) {
    const out = {};
    for (const [key, pos] of Object.entries(saved || {})) {
      const id = itemIdFromKey(key);
      // Pokaler behålls tills ledarlistan lästs (laddaHusPokaler städar då).
      if (arHrPokal(key) && pos) {
        out[key] = { x: clamp(pos.x, 3, 97), y: clamp(pos.y, FLOOR_TOP - 8, 96) };
      } else if (data.ownedCount(sd, id) > 0 && !isWearable(id) && !isAnimalItem(id) && !isHouseItem(id) && !isGardenItem(id) && id !== petData.EGG_ITEM_ID && pos) {
        // Golvsaker (möbler/husdjur) hålls nere i golvzonen även i gammal data.
        const minY = isFloorItem(id) ? FLOOR_TOP - 8 : 4;
        // rot/flip (#699) följer med; saknas = framifrån och ovänd.
        out[key] = { x: clamp(pos.x, 3, 97), y: clamp(pos.y, minY, 96), ...riktningsFalt(pos) };
      }
    }
    return out;
  }
  // Fönstret är ett flyttbart/raderbart VÄGG-objekt (inte en shop-sak) – egen
  // modul (varld-rum-fonster.js) per rum, som sparar till rätt rum via saveRoomAt.
  const roomModels = roomsData.map((room, i) => ({
    placements: filterPlacements(room.placements),
    paletteId: room.paletteId || null,
    // Rums-dörrarnas sparade lägen per sida ({ prev:{x,y}, next:{x,y} }); saknas
    // → växlaren placerar dörren på sin snygga default-plats på väggen (#59).
    doors: room.doors && typeof room.doors === "object" ? { ...room.doors } : {},
    fonster: mountRumFonster({
      saved: room.window,
      save: (win) => data.saveRoomAt(i, { window: win }),
    }),
  }));
  let currentRoom = clamp(startRoom, 0, roomCount - 1);
  let placements = roomModels[currentRoom].placements;
  let fonster = roomModels[currentRoom].fonster;

  // Vanliga djur hör INTE hemma i lådan/placements längre – de promenerar.
  // Husskal (köpta hus) hör INTE hemma i lådan – de väljs separat i "Nytt hus"-
  // panelen och byter husets exteriör, inte rummets möblering.
  // Trädgårdssaker (isGardenItem) placeras UTE (varld-tradgard.js), aldrig i
  // rummets möbel-låda → filtrera bort dem här också. Köpbara avatarer (#694)
  // väljs i avatarvalet, inte i lådan.
  const roomItemsOwned = owned.filter(
    (id) => !isWearable(id) && !isAnimalItem(id) && !isHouseItem(id) && !isGardenItem(id) && id !== petData.EGG_ITEM_ID && getItem(id) && getItem(id).category !== "avatar"
  );

  // Elevens Kartmästare-pokaler (nyckel → pokal) + modulen som ritar dem –
  // tomma tills ledarlistan lästs; en pokal utan ledning ritas aldrig.
  let hrPokaler = new Map();
  let hrPokalMod = null;

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

  // Spara rums-dörrarnas lägen (debounce per rum, samma mönster som placements).
  // doorSaveTargets samlar väntande sidor per rum-index så en snabb rums-växling
  // inte skriver ett rums dörrläge till fel rum.
  let doorSaveTimer = null;
  const doorSaveTargets = new Map(); // idx → doors-objekt att skriva
  function scheduleSaveDoors() {
    doorSaveTargets.set(currentRoom, { ...roomModels[currentRoom].doors });
    clearTimeout(doorSaveTimer);
    doorSaveTimer = setTimeout(() => {
      doorSaveTimer = null;
      for (const [idx, doors] of doorSaveTargets) {
        data.saveRoomAt(idx, { doors }).catch(() => {});
      }
      doorSaveTargets.clear();
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
      const panelNod = animalNamePanel({
        displayName: djur.displayName(animal),
        currentName: animal.name || "",
        autoFocus: openRename === animal.id,
        onSave: async (clean) => {
          const res = await djur.saveName(animal.id, clean);
          if (res.ok) { renderStage(); renderPets(); }
          return res;
        },
        // Bondgårdsdjur stuvas inte undan – de FLYTTAS (rum/hage/lada) via
        // platsvalet i Mina djur (#330). Stuva-knappen gäller bara vanliga djur.
        onStow: animal.farmAnimal ? null : () => setStowed("animal", animal.id, true),
      });
      petPanel.replaceChildren(panelNod);
      // Bondgårdsdjur i rummet matas här (#332): samma foder-sektion som gårds-
      // panelen, dynamiskt laddad (varld-foder.js hålls utanför bootgrafen).
      // Sektionen uppdaterar mood/🎁 på scen-noden själv; spegla nya fält
      // in-memory så nästa renderStage ritar samma humör.
      if (animal.farmAnimal) {
        import("./varld-foder.js").then(({ foderInnehall }) => {
          if (!panelNod.isConnected) return; // panelen hann stängas
          panelNod.appendChild(foderInnehall(animal.id, {
            onChanged: (fresh) => Object.assign(animal, {
              trivsel: fresh.trivsel, lastFedAt: fresh.lastFedAt, lastGiftAt: fresh.lastGiftAt,
            }),
          }));
        }).catch(() => {});
      } else {
        // Vanliga djur matas också (#349) – men som REN FX: hjärtan (petPat),
        // ingen tillväxt, inget förbrukas, ingen skrivning. Cooldown per session
        // i varld-rum-djur.js hindrar hjärt-spam.
        panelNod.appendChild(djurMatSektion(animal, { namn: djur.displayName(animal), hjarta: petPat }));
      }
      return;
    }
    renderPetPanel(petPanel, pet, {
      hasLamp,
      justHatched: !!pet && pet.id === justHatchedId,
      startRename: openRename === selectedPetId,
      onStow: pet && pet.hatchedAt ? () => setStowed("pet", pet.id, true) : null,
      // Magiska bär från gårdens skörd (#332): matar mystery-djuret direkt ur
      // förrådet – feedCount/steg räknas precis som äppelmatningen (som är orörd).
      berryCount: barKvar,
      onFeedBerry: pet && pet.hatchedAt && petData.isMysteryPet(pet) && !petData.isFullGrown(pet) && barKvar > 0
        ? async () => {
            const res = await petData.feedPetBerry(pet.id);
            if (!res.ok) {
              barKvar = res.berriesLeft;
              flash("Bären är slut – odla fler magiska bär på gården! 🫐", true);
              renderPets();
              return;
            }
            barKvar = res.berriesLeft;
            petPat(pet.id); // hjärtan poppar 💚
            setPetMood(res.pet, "ater", 1500);
            const idx = pets.findIndex((p) => p.id === res.pet.id);
            if (idx !== -1) {
              pets[idx] = { ...res.pet, pos: pets[idx].pos, stowed: pets[idx].stowed };
            }
            if (res.stageUp) {
              confetti();
              flash(`${petDisplayName(res.pet)} växte till steg ${res.pet.stage}! 🎉`);
              renderStage(); // djuret VÄXTE (ny storlek)
            }
            renderPets(); // ny feedCount/bär-räknare i panelen
            const grown = idx !== -1 ? pets[idx] : res.pet;
            setTimeout(() => setPetMood(grown, "glad", 2200), 1500);
          }
        : null,
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

  // DOM-nod för ett golväpple (Mysterymat). Delas av full-ritningen (renderStage)
  // och den inkrementella syncApples() så markup/utseende alltid är identiskt.
  function appleNode(apple) {
    return el(`<div class="room-apple" data-apple-id="${apple.id}"
      style="left:${apple.x}%;top:${apple.y}%" title="Mysterymat">🍎</div>`);
  }

  // Inkrementell mat-uppdatering (issue #60): lägg till/ta bort BARA de golväpplen
  // som ändrats i stället för att bygga om hela scenen (renderStage) vid varje
  // utplacering/ätning. Djur- och husdjursnoder rörs aldrig → pågående promenad-
  // animationer nollställs inte, och att snabbt lägga ut flera bitar känns
  // omedelbart (bara den nya .room-apple-noden appendas, med sin egen pop-in).
  // Nya äpplen sätts FÖRE första djuret så de fortsatt ritas UNDER husdjuren.
  function syncApples() {
    const wanted = new Map(mat.apples().map((a) => [a.id, a]));
    for (const node of stage.querySelectorAll(".room-apple")) {
      const id = node.dataset.appleId;
      if (wanted.has(id)) wanted.delete(id); // redan ritad → behåll
      else node.remove(); // borttagen (äten/rollback) → ta bort enstaka nod
    }
    const firstPet = stage.querySelector(".room-pet");
    for (const apple of wanted.values()) {
      const node = appleNode(apple);
      if (firstPet) stage.insertBefore(node, firstPet);
      else stage.appendChild(node);
    }
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
    // Nycklar kan vara "<id>#<n>" för extra exemplar.
    for (const key of ordnaNycklar(placements, (k) => (isFlatItem(itemIdFromKey(k)) ? 0 : 1))) {
      const id = itemIdFromKey(key);
      const pos = placements[key];
      if (arHrPokal(key)) {
        const p = hrPokaler.get(key);
        if (p && hrPokalMod) stage.appendChild(el(hrPokalMod.pokalSakHtml(p, { key, x: pos.x, y: pos.y, vald: selectedId === key })));
        continue;
      }
      const item = getItem(id);
      if (!item) continue;
      // Riktningen (#699): aktuell vys bild och mått – samma höjd i alla vyer,
      // så golvpunkten står still när möbeln vrids.
      const { rot, spegel } = itemRiktning(id, pos);
      const size = itemSize(id, rot);
      stage.appendChild(el(rumSakHtml({
        key, x: pos.x, y: pos.y, titel: item.name, art: itemSvg(id, { rot }) || item.emoji,
        w: size.w, h: size.h, vald: selectedId === key, spegel,
      })));
    }
    // ⟳/↔ vid den markerade saken (#699) – egen nod så ritordningen är orörd.
    const verktyg = verktygFor(selectedId);
    if (verktyg) stage.appendChild(el(verktyg));
    // Djuren och maten i DET HÄR rummet (#698). Äpplen på golvet ritas UNDER
    // husdjuren (så djuret syns ovanpå när det gnager). De är inga .room-item
    // (data-id) och räknas därför inte som hinder i promenad-AI:n – precis som
    // husdjuren själva (data-pet-id).
    for (const apple of mat.apples()) {
      stage.appendChild(appleNode(apple));
    }
    for (const pet of roomPets()) {
      if (!pet.pos) pet.pos = { x: 50, y: 70 };
      stage.appendChild(petStageNode(pet, selectedPetId === pet.id));
    }
    // Vanliga djur (fast storlek) promenerar bland mystery-djuren.
    for (const a of djur.list(currentRoom)) {
      stage.appendChild(djur.stageNode(a, selectedPetId === a.id));
    }
    if (drake) {
      if (drake.list(currentRoom).length) stage.appendChild(drake.stageNode(false));
      else drake.stopp();
    }
    const petsHere = harHar().length > 0;
    if (Object.keys(placements).length === 0 && !petsHere) {
      stage.appendChild(el(`<div class="room-empty">${roomCount > 1
        ? `Rum ${currentRoom + 1} är tomt – öppna Möbler 📦 och möblera det!`
        : "Ditt rum är tomt – öppna Möbler 📦 och ställ in dina saker!"}</div>`));
    }
    // Rums-växlaren (dörrar + rumslista) läggs överst – bara i flerrums-hus.
    // Samma nod-objekt återanvänds vid varje renderStage så lyssnarna sitter kvar.
    if (roomCount > 1 && vaxlare) {
      stage.appendChild(vaxlare.listBar);
      stage.appendChild(vaxlare.doorsWrap);
      vaxlare.render();
    }
  }

  // --- ⟳ Rotera / ↔ Vänd (#699) --------------------------------------------
  // Gäller vanliga placerade saker (inte fönstret, inte Kartmästare-pokalerna).
  function vridbar(key) {
    return !!(key && key !== WINDOW_ID && !arHrPokal(key) && placements[key]);
  }
  function verktygFor(key) {
    if (!vridbar(key)) return null;
    const id = itemIdFromKey(key);
    const pos = placements[key];
    return sakVerktygHtml({
      key, x: pos.x, y: pos.y, h: itemSize(id, itemRiktning(id, pos).rot).h,
      rotera: kanRoteras(id), vand: kanVandas(id),
    });
  }
  /** Rotera ("rot") eller vänd ("flip") en sak; ritar om och sparar. */
  function vrid(key, typ) {
    if (!vridbar(key) || !vridPlacering(itemIdFromKey(key), placements[key], typ)) return false;
    renderStage();
    scheduleSaveRoom();
    return true;
  }
  // R/F på tangentbordet – bara när rummet är nivån som syns.
  kopplaVridTangenter(stage, {
    aktiv: () => stage.closest("[data-niva]")?.dataset.niva === "rum",
    gor: (typ) => vrid(selectedId, typ),
  });

  // --- Rita lådan (ägda, oplacerade rums-saker) ----------------------------
  // Hur många exemplar av `id` som står ute i HELA huset – summerat över ALLA
  // rum, inte bara det aktiva. roomModels håller varje rums placements i minnet,
  // och det aktiva rummets `placements` är SAMMA objekt-referens som
  // roomModels[currentRoom].placements, så nyss placerade/borttagna saker i
  // detta rum räknas med direkt (live). Att räkna över alla rum gör att en ägd
  // möbel bara kan stå på ETT ställe totalt – annars kan samma soffa dubbleras
  // in i varje rum.
  function placedCountAllRooms(id) {
    let n = 0;
    for (const room of roomModels) {
      for (const key of Object.keys(room.placements)) {
        if (itemIdFromKey(key) === id) n++;
      }
    }
    return n;
  }
  // Hur många exemplar av `id` som ännu KAN ställas in någonstans (ägda − redan
  // placerade i hela huset). Multi-saker (möbler/dekor) kan ägas i flera
  // exemplar och fördelas då över rummen (N totalt, inte N per rum);
  // single-saker är kvar på max 1. Att "flytta" en möbel till ett annat rum
  // görs genom att plocka bort den här (åter till lådan) och ställa den där.
  function remainingToPlace(id) {
    if (arHrPokal(id)) return (hrPokaler.has(id) ? 1 : 0) - placedCountAllRooms(id);
    return data.ownedCount(sd, id) - placedCountAllRooms(id);
  }

  function renderTray() {
    tray.replaceChildren();
    const pokalerKvar = [...hrPokaler.values()].filter((p) => remainingToPlace(p.nyckel) > 0);
    const notPlaced = roomItemsOwned.filter((id) => remainingToPlace(id) > 0);
    if (roomItemsOwned.length === 0 && hrPokaler.size === 0) {
      trayHint.textContent = "Du har inga saker än. Köp möbler, husdjur och dekor i shoppen!";
    } else if (notPlaced.length === 0 && pokalerKvar.length === 0) {
      trayHint.textContent = "Alla dina saker står i rummet. 🎉";
    } else {
      trayHint.textContent = "Klicka på en sak för att ställa den i rummet.";
    }
    for (const id of notPlaced) {
      const item = getItem(id);
      const rem = remainingToPlace(id);
      // Visa antal kvar att ställa in när man äger flera exemplar.
      const namn = rem > 1 ? `${item.name} (${rem})` : item.name;
      tray.appendChild(el(`<button class="tray-item" data-place="${id}" title="${item.name}">
        <span class="tray-emoji">${itemSvg(id) || item.emoji}</span>
        <span class="tray-namn">${namn}</span>
      </button>`));
    }
    // Pokalerna först i lådan – de kommer och går med topplistan.
    tray.prepend(...pokalerKvar.map((p) => el(hrPokalMod.pokalLadaHtml(p))));
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
        artHtml: itemSvg(a.art) || (getItem(a.art)?.emoji ?? "🐾"),
      })),
      ...pets.filter((p) => p.stowed && p.hatchedAt).map((p) => ({
        kind: "pet", id: p.id, name: petDisplayName(p), artHtml: petArtThumb(p),
      })),
      ...(drake?.stowedList() || []).map((d) => ({ kind: "drake", id: d.id, name: d.name, artHtml: drake.tumnagel() })),
    ],
    onReturn: (kind, id) => setStowed(kind, id, false),
    // Bondgårdsdjuren (#330): listas alltid i Mina djur med platsval. Ett byte
    // uppdaterar datan (farm.placedAnimals) + rummet direkt; hagen/ladan ritas
    // av gårds-grenen vid nästa besök (den läser placeringen färskt).
    listFarm: listFarmDjur,
    // Djur i alla rum (#698): i flerrums-hus får husets djur rumsval.
    listHouse: listHusDjur,
    roomCount,
    onPlace: placeraDjur,
  });

  /** Bondgårdsdjuren som placerings-rader ({ id, name, location, room, artHtml })
   * – delas av Mina djur (ovan) och laggårdens Verktyg-panel (#359). */
  function listFarmDjur() {
    return djur.farmList().map((a) => ({
      id: a.id, name: djur.displayName(a), location: a.location, room: djur.roomOf(a),
      artHtml: itemSvg(a.art) || (getItem(a.art)?.emoji ?? "🐾"),
    }));
  }

  /** Husets djur (kläckta mystery-djur + vanliga djur, ej undanstuvade) som
   * placerings-rader med sitt rum ({ id, name, room, artHtml }) – #698. */
  function listHusDjur() {
    return [
      ...pets.filter((p) => p.hatchedAt && !p.stowed).map((p) => ({
        id: p.id, name: petDisplayName(p), room: petRoom(p), artHtml: petArtThumb(p),
      })),
      ...djur.houseList().map((a) => ({
        id: a.id, name: djur.displayName(a), room: djur.roomOf(a),
        artHtml: itemSvg(a.art) || (getItem(a.art)?.emoji ?? "🐾"),
      })),
      ...(drake && !drake.drake.stowed ? [{ id: drake.drake.id, name: drake.drake.name, room: drake.roomOf(), artHtml: drake.tumnagel() }] : []),
    ];
  }

  /**
   * Sätt platsen för ett djur i data + minne (ingen omritning). Mystery-djur
   * kan bara bo i husets rum; övriga går via djur-modulen (som håller lad-taket).
   * @returns {false|Promise} false = inget ändrat; annars spar-löftet
   */
  function sattPlats(id, location) {
    if (drake?.byId(id)) {
      if (!isRoomLocation(location)) return false;
      drake.setRoom(roomIndexOf(location));
      return Promise.resolve();
    }
    if (!pets.some((p) => p.id === id)) return djur.setLocation(id, location);
    if (!isRoomLocation(location)) return false;
    petPlats.set(id, location);
    return data.setAnimalPlacement(id, location).catch(() => {});
  }

  /** Flytta ett djur i huset till rum `index` tyst (ingen omritning/flash). */
  function flyttaTillRum(id, index) {
    const nu = drake?.byId(id) ? drake.roomOf() : pets.some((p) => p.id === id) ? petRoom({ id }) : djur.roomOf(djur.byId(id) || {});
    if (nu !== index) sattPlats(id, roomLocation(index));
  }

  /**
   * Flytta ett djur (rum N/hage/lada): uppdaterar rummet + Mina djur direkt och
   * sparar i bakgrunden. Delas av Mina djur och laggårdens Verktyg (#359, via
   * rum-gettern i pages-varld.js).
   * @returns {false|Promise} false = inget ändrat (t.ex. ladan full); annars
   *   spar-löftet, så anroparen kan rita om gårds-scenen när skrivningen landat.
   */
  function placeraDjur(id, location) {
    const sparat = sattPlats(id, location);
    if (!sparat) {
      // Ladan kan vara full (#333: nivå-tak på laggårds-platserna) – då ändras
      // inget och eleven pekas mot uppgraderingen i shoppen.
      if (location === "barn") flash("Ladan är full! Uppgradera laggården i shoppen så får fler djur plats. 🏠", true);
      return false;
    }
    if (selectedPetId === id) selectedPetId = null;
    renderStage();
    renderPets();
    djurTrayCtl?.render();
    const rum = roomIndexOf(location);
    flash(rum !== null ? (roomCount > 1 ? `Djuret bor nu i Rum ${rum + 1}! 🛏️` : "Djuret bor nu i ditt rum! 🛏️")
      : location === "paddock" ? "Djuret går nu ute i hagen! 🌾"
      : "Djuret bor nu i ladan! 🏠");
    return sparat;
  }

  // Matningen (äpplen på golvet) lever i sin egen modul: äger floorApples +
  // "Lägg mat"-knappen och ger promenad-AI:n apples()/onEat. renderStage() läser
  // äpplena via mat.apples(), så mat måste skapas före första ritningen.
  const mat = mountRumMat({
    matBtn, stage, sd,
    getRoom: () => currentRoom,
    roomCount,
    getPets: () => pets,
    renderScene: () => renderStage(),
    renderApples: () => syncApples(),
    renderPanel: () => renderPets(),
    isSelected: (petId) => selectedPetId === petId,
    onActivate: onMatActivate,
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
  // placements/fonster, färga väggarna och rita om (rummets egna djur + mat).
  // onRoomChange låter husvärlden uppdatera palettväljaren.
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
    mat.refresh(); // mat-knappen räknar bara det nya rummets golvmat (#698)
    djurTrayCtl?.render();
    if (onRoomChange) onRoomChange(index, roomModels[index].paletteId);
  }

  // Växlaren byggs bara när huset faktiskt har fler än ett rum (enrums-hus är
  // helt oförändrade). Den läggs in i scenen av renderStage().
  const vaxlare = roomCount > 1
    ? mountRumVaxlare({
        count: roomCount,
        getCurrent: () => currentRoom,
        onPick: goToRoom,
        getDoorPos: (side) => roomModels[currentRoom].doors[side] || null,
        saveDoorPos: (side, pos) => {
          roomModels[currentRoom].doors[side] = pos;
          scheduleSaveDoors();
        },
      })
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

  // Kartmästare-pokalerna (#610): EN läsning av ledarlistan (cachad). Placeringar
  // för pokaler eleven inte längre har (tappad ledning) städas bort och sparas.
  import("./hitta-ratt/hr-pokal-rum.js")
    .then(async (m) => {
      const res = await m.laddaHusPokaler({ uid: data.currentStudentId(), rum: roomModels.map((r) => r.placements) });
      if (!res || !stage.isConnected) return;
      hrPokalMod = m;
      hrPokaler = res.pokaler;
      for (const i of res.rensade) {
        if (i === currentRoom) scheduleSaveRoom();
        else data.saveRoomAt(i, { placements: roomModels[i].placements }).catch(() => {});
      }
      if (selectedId && arHrPokal(selectedId) && !hrPokaler.has(selectedId)) selectedId = null;
      renderStage();
      renderTray();
      const nya = [...hrPokaler.keys()].filter((k) => remainingToPlace(k) > 0 && !hrPokalAviserade.has(k));
      nya.forEach((k) => hrPokalAviserade.add(k));
      if (nya.length) flash(`🏆 Du leder topplistan! Din Kartmästare-pokal ligger i Möbler 📦`);
    })
    .catch(() => {});

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
    // Inga fler exemplar kvar att ställa in i det här rummet? Gör inget.
    if (remainingToPlace(id) <= 0) return;
    // Golvsaker ställs på golvet, väggdekor hängs på väggen – men SPRIDS ut i
    // sidled i stället för att alla landa mitt i scenen (annars staplas nya
    // saker ovanpå varandra och ser "hopklumpade mot mitten" ut). Nästa lediga
    // punkt väljs ur ett utspritt mönster utifrån hur många som redan står i
    // samma zon; positionen är fortfarande procent så den kan dras/sparas fritt.
    // En unik nyckel gör att flera exemplar av samma möbel/dekor kan samsas.
    placements[nyPlaceringsNyckel(placements, id)] =
      nastaPlats(placements, isFloorItem(id), (k) => isFloorItem(itemIdFromKey(k)));
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
    if (renameBtn && drake?.byId(renameBtn.dataset.rename)) {
      oppnaDrakpanel(renameBtn);
      return;
    }
    if (renameBtn) {
      openRenameForId = renameBtn.dataset.rename;
      selectedPetId = renameBtn.dataset.rename;
      selectedId = null;
      renderStage();
      renderPets();
      return;
    }
    const vridBtn = e.target.closest("[data-rotera],[data-vand]");
    if (vridBtn) {
      vrid(vridBtn.dataset.rotera || vridBtn.dataset.vand, vridBtn.dataset.rotera ? "rot" : "flip");
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

  // --- Dra-och-släpp i rummet (delad kärna, rum-promenad-golv.js) ----------
  // Samma pipeline för saker och husdjur: data-id = sak, data-pet-id = husdjur.
  const dragCtl = kopplaRumDrag(stage, {
    // Möbler, husdjur-saker OCH levande husdjur hör hemma i golvzonen; fönstret
    // är ett väggobjekt (egen väggzon-clamp); övrig väggdekor får hela väggen.
    // data-id är en placerings-nyckel ("<id>#<n>" för extra exemplar) → härled id.
    zon: (node) => (node.dataset.id === WINDOW_ID ? "fonster"
      : node.dataset.petId || isFloorItem(itemIdFromKey(node.dataset.id)) ? "golv" : "vagg"),
    // Klick på tom yta i rummet → avmarkera direkt (ram + 🗑️/panel försvinner).
    tomYta: () => {
      if (selectedId !== null || selectedPetId !== null) {
        selectedId = null;
        selectedPetId = null;
        renderStage();
        renderPets();
      }
    },
    flytt: (drag, x, y) => {
      if (drag.petId && drake?.byId(drag.petId)) {
        drake.flytt(x, y, drag.halfH);
        markeraDorr(dorrUnder(drag));
      } else if (drag.petId) {
        const pet = walkers().find((p) => p.id === drag.petId);
        if (pet) pet.pos = { x, y };
        markeraDorr(pet && pet.hatchedAt ? dorrUnder(drag) : null);
      } else if (drag.zon === "fonster") {
        fonster.setPos(x, y);
      } else {
        // Behåll rot/flip (#699) – bara platsen flyttas.
        placements[drag.id] = { ...placements[drag.id], x, y };
      }
    },
    slapp: (drag) => {
      // Ett djur som släpps på en dörr flyttar in i grannrummet (#698).
      markeraDorr(null);
      if (drag.moved && drag.petId && slapptPaDorr(drag)) return;
      if (drag.moved) {
        if (drag.petId) sparaDjurPlats(drag.petId);
        else if (drag.zon === "fonster") fonster.scheduleSave();
        else {
          scheduleSaveRoom();
          // En dragen sak blir markerad → ⟳/↔ syns direkt vid den (#699).
          selectedId = drag.id;
          selectedPetId = null;
          renderStage();
          renderPets();
        }
      } else if (drag.petId && drake?.byId(drag.petId)) {
        oppnaDrakpanel(drag.node); // klick på draken → samma drakpanel som i Bråkresan
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
    },
  });

  /** Rums-dörren under pekaren i ett pågående drag (null = ingen/enrums-hus). */
  function dorrUnder(drag) {
    if (!vaxlare || drag.lastX == null) return null;
    return [...stage.querySelectorAll(".rum-dorr[data-door]")].find((b) => {
      if (b.hidden) return false;
      const r = b.getBoundingClientRect();
      return drag.lastX >= r.left && drag.lastX <= r.right && drag.lastY >= r.top && drag.lastY <= r.bottom;
    }) || null;
  }

  /** Låt dörren under ett draget djur lysa (släpp där = flytta dit). */
  function markeraDorr(dorr) {
    for (const b of stage.querySelectorAll(".rum-dorr.dorr-mal")) if (b !== dorr) b.classList.remove("dorr-mal");
    dorr?.classList.add("dorr-mal");
  }

  /**
   * Släpptes det dragna djuret på en av rums-dörrarna? Då flyttar det in i
   * grannrummet bakom dörren (#698) och kommer in vid den dörr som leder
   * tillbaka. Pekarens sista punkt avgör (djuret självt hålls på golvet).
   * @returns {boolean} true = djuret flyttades (draget är hanterat)
   */
  function slapptPaDorr(drag) {
    const dorr = dorrUnder(drag);
    if (!dorr) return false;
    const mal = currentRoom + (dorr.dataset.door === "next" ? 1 : -1);
    if (mal < 0 || mal >= roomCount) return false;
    const djuret = harHar().find((p) => p.id === drag.petId);
    if (!djuret || !djuret.hatchedAt || !placeraDjur(drag.petId, roomLocation(mal))) return false;
    // In genom grannrummets motsatta dörr: till vänster om man gick "framåt".
    djuret.pos = { x: dorr.dataset.door === "next" ? 15 : 85, y: djuret.drake ? 92 : 80 };
    sparaDjurPlats(drag.petId);
    return true;
  }

  /** Spara ett djurs plats i rätt datamodell (debounce i respektive modul). */
  function sparaDjurPlats(id) {
    if (drake?.byId(id)) drake.scheduleSave();
    else if (djur.byId(id)) djur.scheduleSave();
    else scheduleSavePets();
  }

  /** Drakpanelen (Bråkresans, drakpanel.js) från huset – stuva/namnbyte ritas om här. */
  function oppnaDrakpanel(fokus) {
    drake?.oppnaPanel({
      fokus,
      onStow: () => setStowed("drake", drake.drake.id, true),
      onNamn: () => { renderStage(); djurTrayCtl?.render(); },
    });
  }

  // Draken laddas lat (#714) – rummet ritas först, draken kommer in direkt efter.
  if (sd.brakdrake?.id) {
    import("./brakresan/rum-drake.js").then((m) => {
      drake = m.mountRumDrake({ sd, roomCount, stage });
      renderStage();
      djurTrayCtl?.render();
    }).catch(() => {});
  }

  // Promenad-AI: kläckta husdjur går själva omkring på golvet mellan möblerna
  // (rum-promenad.js). Finns äpplen på golvet styr hungriga djur dit och äter
  // (seek-läge, mat.onEat). Valda/dragna djur pausar; loopen stoppar sig själv
  // när scenen försvinner ur DOM:en (sidbyte).
  startPetPromenad({
    stage,
    // Mystery-djur OCH vanliga djur promenerar; bara mystery-djuren är
    // hungriga (isHungry i data-pet.js) så maten träffar aldrig de vanliga.
    // Bara djuren och maten i AKTIVA rummet (#698) – mat lockar alltså bara
    // djur i samma rum.
    getPets: walkers,
    isPetPaused: (pet) => pet.id === selectedPetId || dragCtl.pagar()?.petId === pet.id || isPetBusy(pet.id),
    getApples: () => mat.apples(),
    onEat: mat.onEat,
    onSettled: () => {
      saveWalkPositions();
      djur.saveWalkPositions();
    },
  });

  // --- Live-kläckning: kläck ägg medan rummet står öppet (utan sidrefresh) ---
  // hatchReadyPets() körs annars bara en gång vid sidinit. Här kollar vi lokalt
  // (utan Firestore-läsning) om något ägg PASSERAT sin kläcktid och persisterar
  // först då – nykläckta firas som vid init via justHatchedId. Timern städas när
  // scenen lämnar DOM:en (sidbyte) – samma självstädning som promenad-AI:n.
  // (Ägg bor i rum 1; kläckningen visas nästa gång rum 1 ritas, men firandet
  // sker direkt.)
  let hatching = false;
  function anyEggDue() {
    const now = Date.now();
    return pets.some(
      (p) => p.eggBoughtAt && !p.hatchedAt && now >= petData.hatchTimeFor(p, hasLamp)
    );
  }
  const hatchTimer = setInterval(async () => {
    if (!stage.isConnected) return clearInterval(hatchTimer); // vy stängd → städa
    if (hatching || !anyEggDue()) return;
    hatching = true;
    try {
      const res = await petData.hatchReadyPets();
      if (!res.justHatchedIds.length) return;
      // Behåll rummets aktuella positioner + undanstuvning (serverns pos kan vara
      // äldre än dit promenad-AI:n hunnit gå; stow-flaggan lever lokalt).
      for (const np of res.pets) {
        const old = pets.find((p) => p.id === np.id);
        if (old) {
          if (old.pos) np.pos = old.pos;
          np.stowed = old.stowed;
        }
      }
      pets = res.pets;
      justHatchedId = res.justHatchedIds[0];
      selectedPetId = justHatchedId;
      confetti();
      flash("Ett ägg har kläckts i ditt rum! 🎉");
      renderStage();
      renderPets();
    } catch {
      // Nätverksfel: låt nästa tick försöka igen (ägget är fortfarande "due").
    } finally {
      hatching = false;
    }
  }, 15000);

  // Styr-API åt husvärlden (pages-varld.js): palett/verktyg per rum + exitMat()
  // som avslutar mat-läget (panel-/nivåbyten stänger mat-läget).
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
    exitMat: mat.exitPlacing,
    // Laggårdens Verktyg (#359): läs/flytta bondgårdsdjuren via rummets
    // placerings-mekanik – samma minne som Mina djur, så rummet och lådan
    // ritas om direkt när ett djur flyttas från laggårds-panelen.
    listFarmDjur,
    placeraFarmDjur: placeraDjur,
    farmBarnCap: () => djur.barnCap(),
  };
}
