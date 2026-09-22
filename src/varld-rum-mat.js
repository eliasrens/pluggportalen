// ============================================================================
// Pluggporten – matning via Mysterymat på golvet (Mitt rum)
// ----------------------------------------------------------------------------
// Systermodul till varld-rum.js (som varld-rum-wear.js): äger Mysterymat-
// matningen.
//   * "Mysterymat"-knappen: går in i ett PLACERA-LÄGE (markerad knapp +
//     hårkors-pekare över golvet). Nästa klick PÅ GOLVET lägger ett stycke mat
//     på exakt den klickade positionen (ingen slump). Man kan fortsätta lägga
//     ut mat så länge man har kvar; läget avslutas med Esc, klick på knappen
//     igen, eller när maten tar slut. Klick utanför golvzonen ignoreras.
//     I samma läge går utlagd mat att PLOCKA UPP igen (#347): klick på en
//     matbit på golvet flyttar den tillbaka till förrådet (appleCount + 1),
//     så läget går även att öppna med tomt förråd så länge det ligger mat ute.
//   * floorApples: maten som ligger på golvet – ritas i scenen och söks upp av
//     promenad-AI:n (rum-promenad.js seek-läge). BARA mystery-djuren (sprite-
//     arterna Fjärlis/Flammis) dras mot och äter maten – se isHungry i
//     data-pet.js.
//   * onEat(): när ett mystery-djur nått fram och ätit → ta bort maten, öka
//     djurets feedCount (transaktion i data-pet.js), räkna om steget (10/20
//     matningar) och visa uttryck.
//
// Rummet (varld-rum.js) äger scenen och pets-listan; den här modulen får in
// callbacks för att rita om scenen/panelen och läser/muterar pets via getPets.
// ============================================================================

import * as petData from "./data-pet.js";
import { placeApple, pickUpApple, newAppleId } from "./data-pet-mat.js";
import { flash } from "./ui.js";
import { confetti } from "./fx.js";
import { setPetMood, petDisplayName } from "./pages-rum-pets.js";
import { FLOOR_TOP } from "./art-room.js";

/**
 * Montera matnings-kontrollern.
 *
 * @param {object} o
 * @param {HTMLElement} [o.matBtn]  "Mysterymat"-knappen (i husvärldens verktygsrad)
 * @param {HTMLElement} o.stage     rumsscenen (.room-stage) – klick placerar mat
 * @param {object} o.sd             studentData (läser appleCount + floorApples)
 * @param {() => object[]} o.getPets  aktuell pets-lista (muteras vid matning)
 * @param {() => void} o.renderScene  rita om HELA rumsscenen (bara vid tillväxt –
 *   djuret byter storlek). Vardaglig mat-ritning går via renderApples (issue #60).
 * @param {() => void} o.renderApples  inkrementell mat-ritning: lägg till/ta bort
 *   bara ändrade golväpplen utan att röra djur-/husdjursnoderna (bevarar promenad-
 *   animationer). Anropas efter varje mutation av floorApples.
 * @param {() => void} o.renderPanel  rita om husdjurspanelen (ny feedCount)
 * @param {(petId: string) => boolean} o.isSelected  är djurets panel öppen?
 * @param {() => void} [o.onActivate]  körs när placera-läget slås PÅ (så
 *   husvärlden kan stänga öppna paneler – lägena är ömsesidigt uteslutande)
 * @returns {{ apples: () => object[], onEat: (pet, apple) => void, exitPlacing: () => void }}
 *   apples() = mat på golvet (för scenritning + AI), onEat = ät-callback åt AI:n,
 *   exitPlacing() = gemensam väg att avsluta mat-läget (panel-/menystängning).
 */
export function mountRumMat({ matBtn, stage, sd, getPets, renderScene, renderApples, renderPanel, isSelected, onActivate }) {
  // Speglar studentData: floorApples (på golvet) + appleCount (outlagd mat).
  let floorApples = Array.isArray(sd.floorApples) ? sd.floorApples.map((a) => ({ ...a })) : [];
  let appleCount = sd.appleCount || 0;
  const eating = new Set(); // mat-id:n där en ät-transaktion redan pågår
  const placingPending = new Set(); // mat-id:n vars placeApple-skrivning är i luften
  let placing = false; // är vi i placera-läget (nästa golvklick lägger mat)?

  function updateMatBtn() {
    if (!matBtn) return;
    const label = placing ? "Klicka på golvet" : "Mysterymat";
    matBtn.innerHTML = `🍎 <span>${label}${appleCount > 0 ? ` (${appleCount})` : ""}</span>`;
    // Knappen ska gå att använda även med tomt förråd om det ligger mat på
    // golvet – läget behövs då för att kunna plocka upp den (#347).
    matBtn.disabled = appleCount <= 0 && floorApples.length === 0;
    matBtn.classList.toggle("aktiv", placing);
    matBtn.setAttribute("aria-pressed", placing ? "true" : "false");
    matBtn.title = appleCount > 0 || floorApples.length > 0
      ? (placing
          ? "Klicka på golvet för att lägga ut Mysterymat, eller på en matbit för att plocka upp den (Esc för att avsluta)"
          : "Klicka ut Mysterymat på golvet – bara mystery-djuren går och äter. Utlagd mat kan plockas upp igen.")
      : "Köp Mysterymat i shoppen för att kunna mata dina mystery-djur";
  }

  // --- Placera-läget ---------------------------------------------------------

  function setPlacing(on) {
    // Läget är meningsfullt både med mat i förrådet (lägga ut) och med mat på
    // golvet (plocka upp, #347) – därav dubbelvillkoret.
    const next = on && (appleCount > 0 || floorApples.length > 0);
    if (next === placing) {
      updateMatBtn();
      return;
    }
    placing = next;
    stage.classList.toggle("mat-placering", placing);
    if (placing) {
      // Fånga golvklick i capture-fasen så scenens vanliga drag/markera-logik
      // (bubbel-fasen på samma nod) inte kör – klicket ska bara lägga mat.
      // pointerdown ligger på stage → försvinner med scenen. keydown MÅSTE ligga
      // på document (Esc ska fångas oavsett fokus), så den städar sig själv om
      // scenen lämnats (se onKeyDown) – samma isConnected-mönster som rum-promenad.js.
      stage.addEventListener("pointerdown", onPlaceClick, true);
      document.addEventListener("keydown", onKeyDown, true);
      // Mat och paneler (Kläder m.fl.) är ömsesidigt uteslutande: att slå på
      // mat-läget stänger öppna paneler (husvärlden sköter själva stängningen).
      onActivate?.();
    } else {
      stage.removeEventListener("pointerdown", onPlaceClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    }
    updateMatBtn();
  }

  function onKeyDown(e) {
    // Rummet lämnat (scenen borta ur DOM:en) medan placera-läget var aktivt?
    // Då avregistrerade setPlacing(false) aldrig lyssnaren – städa den här så
    // den varken läcker (håller den detacherade scenen vid liv) eller påverkar
    // fel scen med fantom-tangenttryck.
    if (!stage.isConnected) {
      document.removeEventListener("keydown", onKeyDown, true);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setPlacing(false);
    }
  }

  // Klick i scenen medan vi placerar: klick PÅ en utlagd matbit plockar upp den
  // (#347, .room-apple får pekhändelser bara i mat-läget – se styles.css);
  // annars räkna ut position i procent, kräv att det är på GOLVET (annars
  // ignoreras klicket) och lägg ut ett stycke mat där.
  function onPlaceClick(e) {
    // Stoppa scenens drag/markera-hanterare (bubbel på samma nod) + defaultval.
    e.preventDefault();
    e.stopPropagation();
    const appleNode = e.target && e.target.closest ? e.target.closest(".room-apple") : null;
    if (appleNode) {
      pickUp(appleNode.dataset.appleId);
      return;
    }
    if (appleCount <= 0) {
      if (floorApples.length === 0) {
        // Både förrådet och golvet tomt (djuren kan ha ätit upp allt medan
        // läget var öppet): inget kvar att göra – stäng läget.
        setPlacing(false);
        flash("Du har ingen Mysterymat kvar – köp mer i shoppen! 🍎", true);
        return;
      }
      // Tomt förråd men mat på golvet: golvklick lägger inget – hinta om att
      // matbitarna går att plocka upp.
      flash("Förrådet är tomt – klicka på en matbit för att plocka upp den! 🍎", true);
      return;
    }
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    // Golv-only: klick ovanför golvlinjen (på väggen) lägger ingen mat.
    if (y < FLOOR_TOP + 2) {
      flash("Klicka på golvet för att lägga ut Mysterymat! 🍎", true);
      return;
    }
    // Klampa in en bit från kanterna så maten alltid syns helt på golvet.
    const cx = Math.min(96, Math.max(4, x));
    const cy = Math.min(96, Math.max(FLOOR_TOP + 2, y));
    placeAt(cx, cy);
  }

  // OPTIMISTISK placering: rita maten direkt (ingen server-round-trip att vänta
  // på) och persistera i bakgrunden. Ingen toast per matbit – att lägga ut flera
  // bitar snabbt ska kännas omedelbart. Misslyckas persisteringen rullas biten
  // tillbaka så ingen "spökmat" blir kvar. Äpplet får sitt id lokalt och samma
  // id skickas till servern, så ät-flödet (onEat → eatApple) hittar rätt bit.
  function placeAt(x, y) {
    if (appleCount <= 0) {
      if (floorApples.length === 0) setPlacing(false);
      flash("Du har ingen Mysterymat kvar – köp mer i shoppen! 🍎", true);
      return;
    }
    const apple = { id: newAppleId(), x, y };
    floorApples.push(apple);
    appleCount -= 1;
    placingPending.add(apple.id); // plocka-upp väntar tills skrivningen landat (#347)
    renderApples(); // appenda BARA den nya matnoden (ingen full scen-ombyggnad)
    // Slut på mat OCH inget kvar på golvet att plocka upp → lämna läget.
    if (appleCount <= 0 && floorApples.length === 0) setPlacing(false);
    updateMatBtn();

    placeApple(x, y, undefined, apple.id).then((res) => {
      placingPending.delete(apple.id);
      if (!res.ok) {
        // Servern hade slut på mat: rulla tillbaka biten och korrigera räknaren.
        floorApples = floorApples.filter((a) => a.id !== apple.id);
        appleCount = res.appleCount;
        renderApples(); // ta bort den enstaka spökmaten
        updateMatBtn();
        flash("Du har ingen Mysterymat kvar.", true);
      }
      // OK → den optimistiska maten står redan rätt (samma id) – inget att göra.
    }).catch((err) => {
      // Nätverksfel: ta bort spökmaten och ge tillbaka räknaren.
      placingPending.delete(apple.id);
      floorApples = floorApples.filter((a) => a.id !== apple.id);
      appleCount += 1;
      renderApples(); // ta bort den enstaka spökmaten
      updateMatBtn();
      flash("Kunde inte lägga ut maten: " + err.message, true);
    });
  }

  // Plocka upp en matbit från golvet (#347): OPTIMISTISKT som placeAt fast i
  // omvänd riktning – ta bort biten lokalt + räkna upp förrådet direkt, och
  // persistera i bakgrunden (pickUpApple-transaktionen). Bitar som ett djur
  // just äter (eating) eller vars utläggning ännu inte landat på servern
  // (placingPending) lämnas ifred – ett nytt klick strax efter funkar.
  function pickUp(appleId) {
    if (!appleId || eating.has(appleId) || placingPending.has(appleId)) return;
    const apple = floorApples.find((a) => a.id === appleId);
    if (!apple) return;
    floorApples = floorApples.filter((a) => a.id !== appleId);
    appleCount += 1;
    renderApples(); // ta bort BARA den upplockade matnoden
    updateMatBtn();

    pickUpApple(appleId).then((res) => {
      if (!res.ok) {
        // Servern kände inte igen biten (ett djur hann äta upp den): ångra det
        // optimistiska förråds-plusset – biten är redan borta från golvet.
        appleCount = res.appleCount;
        updateMatBtn();
      }
      // OK → lokala spegeln stämmer redan (biten borta, förrådet +1).
    }).catch((err) => {
      // Nätverksfel: lägg tillbaka biten på golvet och ångra förråds-plusset.
      if (!floorApples.some((a) => a.id === appleId)) floorApples.push(apple);
      appleCount -= 1;
      renderApples();
      updateMatBtn();
      flash("Kunde inte plocka upp maten: " + err.message, true);
    });
  }

  // Ett djur nådde fram till ett stycke mat (kallas av promenad-AI:n). Ta bort
  // maten ur scenen direkt (så inget annat djur siktar på det), kör
  // transaktionen som ökar feedCount + räknar om steget, och visa uttryck.
  async function onEat(pet, apple) {
    if (eating.has(apple.id)) return;
    eating.add(apple.id);
    floorApples = floorApples.filter((a) => a.id !== apple.id);
    renderApples(); // ta bort BARA den ätna matnoden (rör inte djurens promenad)
    setPetMood(pet, "ater", 1800); // gnager en stund (partikel/uttryck 🍎)
    try {
      const res = await petData.eatApple(pet.id, apple.id);
      if (res.ok && res.pet) {
        floorApples = res.floorApples.map((a) => ({ ...a }));
        renderApples(); // stäm av golvmaten mot servern (utan att röra djuren)
        const pets = getPets();
        const idx = pets.findIndex((p) => p.id === res.pet.id);
        if (idx !== -1) {
          const keepPos = pets[idx].pos; // behåll dit AI:n gått (servern är äldre)
          pets[idx] = { ...res.pet, pos: keepPos };
        }
        if (res.stageUp) {
          confetti();
          flash(`${petDisplayName(res.pet)} växte till steg ${res.pet.stage}! 🎉`);
          renderScene(); // djuret VÄXTE (ny storlek) → rita om scenen en gång
        }
        if (isSelected(res.pet.id)) renderPanel(); // panelen visar ny feedCount
        const grownPet = idx !== -1 ? pets[idx] : res.pet;
        setTimeout(() => setPetMood(grownPet, "glad", 2200), 1800);
      } else {
        renderApples(); // maten var redan borta / annat djur hann först
      }
    } catch (err) {
      // Nätverksfel: lägg tillbaka maten så den inte försvinner spårlöst.
      if (!floorApples.some((a) => a.id === apple.id)) floorApples.push({ ...apple });
      renderApples();
    } finally {
      eating.delete(apple.id);
    }
  }

  // Knappen togglar placera-läget (i stället för att slumpa ut ett äpple direkt).
  if (matBtn) {
    matBtn.addEventListener("click", () => {
      if (appleCount <= 0 && floorApples.length === 0) {
        flash("Du har ingen Mysterymat – köp i shoppen! 🍎", true);
        return;
      }
      setPlacing(!placing);
    });
  }
  updateMatBtn();

  // Avsluta placera-läget utifrån. Två alias för samma sak: cancelPlacing()
  // används vid rums-byte i flerrums-huset (så golvets capture-lyssnare inte
  // sväljer klick på dörrar/rumslistan), exitPlacing() av husvärldens panel-/
  // menystängning (mat och paneler är ömsesidigt uteslutande lägen).
  const stopPlacing = () => setPlacing(false);
  return { apples: () => floorApples, onEat, cancelPlacing: stopPlacing, exitPlacing: stopPlacing };
}
