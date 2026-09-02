// ============================================================================
// Pluggportalen – matning via äpplen på golvet (Mitt rum)
// ----------------------------------------------------------------------------
// Systermodul till varld-rum.js (som varld-rum-wear.js): äger äpple-matningen.
//   * "Lägg mat"-knappen: lägger ett äpple på golvet (procent-position i
//     golvzonen) så länge eleven har äpplen kvar (studentData.appleCount).
//   * floorApples: äpplena som ligger på golvet – ritas i scenen och söks upp
//     av promenad-AI:n (rum-promenad.js seek-läge).
//   * onEat(): när ett djur nått fram och ätit → ta bort äpplet, öka djurets
//     feedCount (transaktion i data-pet.js), räkna om steget och visa uttryck.
//
// Rummet (varld-rum.js) äger scenen och pets-listan; den här modulen får in
// callbacks för att rita om scenen/panelen och läser/muterar pets via getPets.
// ============================================================================

import * as petData from "./data-pet.js";
import { flash } from "./ui.js";
import { confetti } from "./fx.js";
import { setPetMood, petDisplayName } from "./pages-rum-pets.js";
import { FLOOR_TOP } from "./art-room.js";

/**
 * Montera matnings-kontrollern.
 *
 * @param {object} o
 * @param {HTMLElement} [o.matBtn]  "Lägg mat"-knappen (i husvärldens verktygsrad)
 * @param {object} o.sd             studentData (läser appleCount + floorApples)
 * @param {() => object[]} o.getPets  aktuell pets-lista (muteras vid matning)
 * @param {() => void} o.renderScene  rita om rumsscenen (visar äpplen + djur)
 * @param {() => void} o.renderPanel  rita om husdjurspanelen (ny feedCount)
 * @param {(petId: string) => boolean} o.isSelected  är djurets panel öppen?
 * @returns {{ apples: () => object[], onEat: (pet: object, apple: object) => void }}
 *   apples() = äpplen på golvet (för scenritning + AI), onEat = ät-callback åt AI:n.
 */
export function mountRumMat({ matBtn, sd, getPets, renderScene, renderPanel, isSelected }) {
  // Speglar studentData: floorApples (på golvet) + appleCount (outlagda äpplen).
  let floorApples = Array.isArray(sd.floorApples) ? sd.floorApples.map((a) => ({ ...a })) : [];
  let appleCount = sd.appleCount || 0;
  const eating = new Set(); // äpple-id:n där en ät-transaktion redan pågår

  function updateMatBtn() {
    if (!matBtn) return;
    matBtn.innerHTML = `🍎 <span>Lägg mat${appleCount > 0 ? ` (${appleCount})` : ""}</span>`;
    matBtn.disabled = appleCount <= 0;
    matBtn.title = appleCount > 0
      ? "Lägg ut ett äpple på golvet – närmaste hungriga djur går och äter"
      : "Köp äpplen i shoppen för att kunna mata dina djur";
  }

  // Slumpa en golvposition (inom golvzonen, en bit in från kanterna). Ingen
  // hinderkoll behövs – djuren tar sig runt möbler i seek-läget.
  function pickApplePos() {
    const yMin = FLOOR_TOP + 6;
    return {
      x: 12 + Math.round(Math.random() * 76),
      y: Math.round(yMin + Math.random() * (92 - yMin)),
    };
  }

  async function placeOne() {
    if (appleCount <= 0) {
      flash("Du har inga äpplen – köp fler i shoppen! 🍎", true);
      return;
    }
    if (matBtn) matBtn.disabled = true;
    try {
      const pos = pickApplePos();
      const res = await petData.placeApple(pos.x, pos.y);
      appleCount = res.appleCount;
      if (res.ok && res.apple) {
        floorApples.push({ ...res.apple });
        renderScene();
        flash("Du la ut ett äpple! 🍎 Närmaste hungriga djur kommer och äter.");
      } else {
        flash("Du har inga äpplen kvar.", true);
      }
    } catch (err) {
      flash("Kunde inte lägga ut äpplet: " + err.message, true);
    }
    updateMatBtn();
  }

  // Ett djur nådde fram till ett äpple (kallas av promenad-AI:n). Ta bort äpplet
  // ur scenen direkt (så inget annat djur siktar på det), kör transaktionen som
  // ökar feedCount + räknar om steget, och visa ät-/glädjeuttryck.
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
        renderScene(); // äpplet var redan borta / annat djur hann först
      }
    } catch (err) {
      // Nätverksfel: lägg tillbaka äpplet så det inte försvinner spårlöst.
      if (!floorApples.some((a) => a.id === apple.id)) floorApples.push({ ...apple });
      renderScene();
    } finally {
      eating.delete(apple.id);
    }
  }

  if (matBtn) matBtn.addEventListener("click", placeOne);
  updateMatBtn();

  return { apples: () => floorApples, onEat };
}
