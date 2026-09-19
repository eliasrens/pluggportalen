// ============================================================================
// Pluggportalen – odlingsbädden på gården: så, väx via plugguppgifter, skörda
// ----------------------------------------------------------------------------
// Issue #329: gör odlingsbädd-zonen i gårds-scenen (art-gard.js) levande.
// Fröer köps i shoppen (crop_* i shop-items.js, antal i ownedCounts), sås här i
// en tom slot (plantSeed – förbrukar ett frö i samma transaktion), växer ett
// TILLVÄXTSTEG varje gång eleven klarar en plugguppgift (kroken i game-shared.
// js › awardExercise → growCropsFromExercise) och skördas här till skörde-
// förrådet farm.inventoryHarvest – maten till gårdens kommande djur.
//
// Rendering: grödorna ritas som SVG-grupper i gårds-scenens ankargrupp
// #odling-slots (positioner från odlingSlotPos, konst per steg från
// cropStageArt i art-garden.js). Klick-/tangentbordsriggen speglar laggårds-
// dörrens (varld-gard.js): delegat på gårds-lagret, bara aktiv på gård-nivån.
//   tom slot        → frö-väljarpanelen (.varld-panel, samma UI som Trädgård)
//   växande gröda   → hint om hur den växer (plugguppgifter!)
//   skördeklar (✨) → skördas direkt, förrådet ökar
//
// OBS BOOTGRAFEN (#271): modulen importeras BARA av varld-gard.js som själv är
// dynamiskt laddad – håll den utanför alla statiska kedjor.
// ============================================================================

import { el, flash } from "./ui.js";
import { SHOP_ITEMS } from "./shop-items.js";
import { CROPS, cropStageArt } from "./art-garden.js";
import { odlingSlotPos } from "./art-gard.js";
import * as data from "./data.js";
import { getFarm, plantSeed, harvestCrop } from "./data-farm.js";
import { slotCountForTier, cropInSlot, FARM_MAX_GROWTH_STAGE } from "./farm-core.js";

/**
 * Montera odlingsbädden i gårds-scenen.
 * @param {object} o
 * @param {HTMLElement} o.stage      scenen (.varld-stage; läser data-niva)
 * @param {HTMLElement} o.gardLager  gård-lagret (innehåller #odling-slots)
 * @returns {{visa: () => Promise<void>, stang: () => void}}
 */
export function mountOdling({ stage, gardLager }) {
  let farm = null; // senast lästa farm-tillstånd
  let sd = null; //   … och studentData (fröantal i ownedCounts)
  let valdSlot = -1; // sloten frö-panelen sår i
  let laddar = false;

  // --- Frö-väljarpanelen (samma .varld-panel-UI som Trädgård/Möbler) --------
  const panel = el(`<div class="varld-panel" id="panel-odling" hidden>
    <button type="button" class="varld-panel-stang" aria-label="Stäng panelen">✕</button>
    <h3>Så ett frö 🌱</h3>
    <p class="hint" id="odling-hint"></p>
    <div class="room-tray" id="odling-tray"></div>
    <p class="hint" id="odling-forrad"></p>
  </div>`);
  stage.querySelector(".varld-ui").appendChild(panel);
  const hintEl = panel.querySelector("#odling-hint");
  const trayEl = panel.querySelector("#odling-tray");
  const forradEl = panel.querySelector("#odling-forrad");
  panel.querySelector(".varld-panel-stang").addEventListener("click", stang);

  function stang() {
    panel.hidden = true;
    valdSlot = -1;
  }

  /** Antal frön eleven har av en gröda (ownedCounts via data.ownedCount). */
  const froAntal = (cropId) => (sd ? data.ownedCount(sd, cropId) : 0);

  // Skörde-förrådet som läsbar rad, t.ex. "Förråd: 🥕 2 · ☘️ 1".
  function forradText() {
    const poster = Object.entries(farm?.inventoryHarvest || {})
      .filter(([id]) => CROPS[id])
      .map(([id, n]) => `${CROPS[id].emoji} ${n}`);
    return poster.length ? `Förråd (mat till gårdens djur): ${poster.join(" · ")}` : "";
  }

  function renderPanel() {
    trayEl.replaceChildren();
    const froer = SHOP_ITEMS.filter((it) => it.seed);
    const agda = froer.filter((it) => froAntal(it.id) > 0);
    if (agda.length === 0) {
      hintEl.textContent = "Du har inga frön än. Köp Morotsfrön, Klöverfrön eller Magiska bärfrön i shoppen! 🛍️";
    } else {
      hintEl.textContent = "Välj ett frö att så. Grödan växer varje gång du klarar en plugguppgift! 📚";
      for (const it of agda) {
        const meta = CROPS[it.id];
        trayEl.appendChild(el(`<button class="tray-item" data-so="${it.id}"
          title="Skörden blir mat till ${meta ? meta.mat : "gårdens djur"}">
          <span class="tray-emoji">${it.emoji}</span>
          <span class="tray-namn">${it.name} ×${froAntal(it.id)}</span>
        </button>`));
      }
    }
    forradEl.textContent = forradText();
  }

  trayEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-so]");
    if (!btn || valdSlot < 0) return;
    const cropId = btn.dataset.so;
    const res = await plantSeed(valdSlot, cropId);
    if (res.ok) {
      const meta = CROPS[cropId];
      flash(`Du sådde ${meta ? meta.name.toLowerCase() : "ett frö"}! ${meta ? meta.emoji : "🌱"} Klara plugguppgifter så växer den.`);
      stang();
      await visa();
    } else {
      flash(res.error === "inga frön kvar" ? "Fröna är slut – köp fler i shoppen!" : "Det gick inte att så just nu.", true);
      await visa();
    }
  });

  // --- Rendering av slots i scenen ------------------------------------------
  function render() {
    const ankare = gardLager.querySelector("#odling-slots");
    if (!ankare || !farm) return;
    const antal = slotCountForTier(farm.gardenTier);
    // Legacy-skydd (#333 krympte tier 1 från 4 → 2 slots): en gröda som redan
    // står i en slot UTANFÖR dagens bädd ritas ändå (och kan skördas), men nya
    // frön kan bara sås i dagens slots – tomma rutor utanför bädden hoppas över.
    const maxPlanterad = farm.gardenSlots.reduce((m, s) => Math.max(m, s.slotIndex), -1);
    const ritAntal = Math.max(antal, maxPlanterad + 1);
    const pos = odlingSlotPos(ritAntal);
    let markup = "";
    for (let i = 0; i < ritAntal; i++) {
      const slot = cropInSlot(farm, i);
      if (!slot && i >= antal) continue;
      const meta = slot && CROPS[slot.cropId];
      const klar = slot && slot.growthStage >= FARM_MAX_GROWTH_STAGE;
      const namn = meta ? meta.name : "gröda";
      const label = !slot
        ? `Tom odlingsruta ${i + 1} – så ett frö`
        : klar
          ? `${namn} är skördeklar – skörda!`
          : `${namn} växer (steg ${slot.growthStage} av ${FARM_MAX_GROWTH_STAGE})`;
      const art = slot
        ? cropStageArt(slot.cropId, slot.growthStage)
        : `<ellipse cx="0" cy="0" rx="17" ry="6" fill="#5C4433" opacity="0.35"/>
           <ellipse cx="0" cy="0" rx="17" ry="6" fill="none" stroke="#FFF3DC" stroke-width="2.5" stroke-dasharray="5 5" opacity="0.9"/>
           <path d="M0 -12 L0 -4 M-4 -8 L4 -8" stroke="#FFF3DC" stroke-width="3" stroke-linecap="round" opacity="0.9"/>`;
      markup += `<g class="odling-slot${klar ? " odling-klar" : ""}" data-slot="${i}"
          role="button" tabindex="0" aria-label="${label}" transform="translate(${pos[i].x} ${pos[i].y})">
        <rect x="-26" y="-52" width="52" height="62" fill="transparent" stroke="none"/>
        ${art}
      </g>`;
    }
    ankare.innerHTML = markup;
  }

  /** Läs färskt tillstånd och rita om (körs vid varje gårds-besök m.m.). */
  async function visa() {
    if (laddar) return;
    laddar = true;
    try {
      [farm, sd] = await Promise.all([getFarm(), data.getStudentData()]);
      render();
      if (!panel.hidden) renderPanel();
    } finally {
      laddar = false;
    }
  }

  // --- Klick & tangentbord (delegat, samma mönster som laggårds-dörren) -----
  gardLager.addEventListener("click", async (e) => {
    if (stage.dataset.niva !== "gard") return;
    const g = e.target.closest(".odling-slot");
    if (!g || !farm) return;
    const i = Number(g.dataset.slot);
    const slot = cropInSlot(farm, i);
    if (!slot) {
      valdSlot = i;
      renderPanel();
      panel.hidden = false;
      return;
    }
    const meta = CROPS[slot.cropId];
    if (slot.growthStage < FARM_MAX_GROWTH_STAGE) {
      flash(`${meta ? meta.emoji : "🌱"} ${meta ? meta.name : "Grödan"} växer – steg ${slot.growthStage} av ${FARM_MAX_GROWTH_STAGE}. Klara plugguppgifter så växer den vidare!`);
      return;
    }
    const res = await harvestCrop(i);
    if (res.ok) {
      farm = res.farm;
      render();
      const antal = farm.inventoryHarvest[slot.cropId] || 0;
      flash(`${meta ? meta.emoji : "🌾"} Du skördade ${meta ? meta.name.toLowerCase() : "en gröda"}! Nu finns ${antal} i förrådet.`);
      if (!panel.hidden) renderPanel();
    } else {
      flash("Det gick inte att skörda just nu.", true);
      await visa();
    }
  });
  gardLager.addEventListener("keydown", (e) => {
    const g = e.target.closest(".odling-slot");
    if ((e.key === "Enter" || e.key === " ") && g) {
      e.preventDefault();
      g.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });

  return { visa, stang };
}
