// ============================================================================
// Pluggportalen – matning via Mysterymat på golvet (Mitt rum)
// ----------------------------------------------------------------------------
// Systermodul till varld-rum.js (som varld-rum-wear.js): äger Mysterymat-
// matningen.
//   * "Mysterymat"-knappen: går in i ett PLACERA-LÄGE (markerad knapp +
//     hårkors-pekare över golvet). Nästa klick PÅ GOLVET lägger ett stycke mat
//     på exakt den klickade positionen (ingen slump). Man kan fortsätta lägga
//     ut mat så länge man har kvar; läget avslutas med Esc, klick på knappen
//     igen, eller när maten tar slut. Klick utanför golvzonen ignoreras.
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
import { placeApple, newAppleId } from "./data-pet-mat.js";
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
 * @param {() => void} o.renderScene  rita om rumsscenen (visar mat + djur)
 * @param {() => void} o.renderPanel  rita om husdjurspanelen (ny feedCount)
 * @param {(petId: string) => boolean} o.isSelected  är djurets panel öppen?
 * @param {() => void} [o.onActivate]  körs när placera-läget slås PÅ (så
 *   husvärlden kan stänga öppna paneler – lägena är ömsesidigt uteslutande)
 * @returns {{ apples: () => object[], onEat: (pet, apple) => void, exitPlacing: () => void }}
 *   apples() = mat på golvet (för scenritning + AI), onEat = ät-callback åt AI:n,
 *   exitPlacing() = gemensam väg att avsluta mat-läget (panel-/menystängning).
 */
export function mountRumMat({ matBtn, stage, sd, getPets, renderScene, renderPanel, isSelected, onActivate }) {
  // Speglar studentData: floorApples (på golvet) + appleCount (outlagd mat).
  let floorApples = Array.isArray(sd.floorApples) ? sd.floorApples.map((a) => ({ ...a })) : [];
  let appleCount = sd.appleCount || 0;
  const eating = new Set(); // mat-id:n där en ät-transaktion redan pågår
  let placing = false; // är vi i placera-läget (nästa golvklick lägger mat)?

  function updateMatBtn() {
    if (!matBtn) return;
    const label = placing ? "Klicka på golvet" : "Mysterymat";
    matBtn.innerHTML = `🍎 <span>${label}${appleCount > 0 ? ` (${appleCount})` : ""}</span>`;
    matBtn.disabled = appleCount <= 0;
    matBtn.classList.toggle("aktiv", placing);
    matBtn.setAttribute("aria-pressed", placing ? "true" : "false");
    matBtn.title = appleCount > 0
      ? (placing
          ? "Klicka på golvet för att lägga ut Mysterymat (Esc för att avsluta)"
          : "Klicka ut Mysterymat på golvet – bara mystery-djuren går och äter")
      : "Köp Mysterymat i shoppen för att kunna mata dina mystery-djur";
  }

  // --- Placera-läget ---------------------------------------------------------

  function setPlacing(on) {
    const next = on && appleCount > 0;
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

  // Klick i scenen medan vi placerar: räkna ut position i procent, kräv att det
  // är på GOLVET (annars ignoreras klicket) och lägg ut ett stycke mat där.
  function onPlaceClick(e) {
    // Stoppa scenens drag/markera-hanterare (bubbel på samma nod) + defaultval.
    e.preventDefault();
    e.stopPropagation();
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
      setPlacing(false);
      flash("Du har ingen Mysterymat kvar – köp mer i shoppen! 🍎", true);
      return;
    }
    const apple = { id: newAppleId(), x, y };
    floorApples.push(apple);
    appleCount -= 1;
    renderScene();
    // Slut på mat → lämna placera-läget automatiskt.
    if (appleCount <= 0) setPlacing(false);
    updateMatBtn();

    placeApple(x, y, undefined, apple.id).then((res) => {
      if (!res.ok) {
        // Servern hade slut på mat: rulla tillbaka biten och korrigera räknaren.
        floorApples = floorApples.filter((a) => a.id !== apple.id);
        appleCount = res.appleCount;
        renderScene();
        updateMatBtn();
        flash("Du har ingen Mysterymat kvar.", true);
      }
      // OK → den optimistiska maten står redan rätt (samma id) – inget att göra.
    }).catch((err) => {
      // Nätverksfel: ta bort spökmaten och ge tillbaka räknaren.
      floorApples = floorApples.filter((a) => a.id !== apple.id);
      appleCount += 1;
      renderScene();
      updateMatBtn();
      flash("Kunde inte lägga ut maten: " + err.message, true);
    });
  }

  // Ett djur nådde fram till ett stycke mat (kallas av promenad-AI:n). Ta bort
  // maten ur scenen direkt (så inget annat djur siktar på det), kör
  // transaktionen som ökar feedCount + räknar om steget, och visa uttryck.
  async function onEat(pet, apple) {
    if (eating.has(apple.id)) return;
    eating.add(apple.id);
    floorApples = floorApples.filter((a) => a.id !== apple.id);
    renderScene();
    setPetMood(pet, "ater", 1800); // gnager en stund (partikel/uttryck 🍎)
    try {
      const res = await petData.eatApple(pet.id, apple.id);
      if (res.ok && res.pet) {
        floorApples = res.floorApples.map((a) => ({ ...a }));
        const pets = getPets();
        const idx = pets.findIndex((p) => p.id === res.pet.id);
        if (idx !== -1) {
          const keepPos = pets[idx].pos; // behåll dit AI:n gått (servern är äldre)
          pets[idx] = { ...res.pet, pos: keepPos };
        }
        if (res.stageUp) {
          confetti();
          flash(`${petDisplayName(res.pet)} växte till steg ${res.pet.stage}! 🎉`);
        }
        renderScene();
        if (isSelected(res.pet.id)) renderPanel(); // panelen visar ny feedCount
        const grownPet = idx !== -1 ? pets[idx] : res.pet;
        setTimeout(() => setPetMood(grownPet, "glad", 2200), 1800);
      } else {
        renderScene(); // maten var redan borta / annat djur hann först
      }
    } catch (err) {
      // Nätverksfel: lägg tillbaka maten så den inte försvinner spårlöst.
      if (!floorApples.some((a) => a.id === apple.id)) floorApples.push({ ...apple });
      renderScene();
    } finally {
      eating.delete(apple.id);
    }
  }

  // Knappen togglar placera-läget (i stället för att slumpa ut ett äpple direkt).
  if (matBtn) {
    matBtn.addEventListener("click", () => {
      if (appleCount <= 0) {
        flash("Du har ingen Mysterymat – köp i shoppen! 🍎", true);
        return;
      }
      setPlacing(!placing);
    });
  }
  updateMatBtn();

  return { apples: () => floorApples, onEat, exitPlacing: () => setPlacing(false) };
}
