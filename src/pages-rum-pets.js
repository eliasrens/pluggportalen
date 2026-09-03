// ============================================================================
// Pluggportalen – husdjuren i Mitt rum
// ----------------------------------------------------------------------------
// Husdjursdelen av rumssidan (pages-rum.js): ritar ägg/varelser som flyttbara
// objekt i rumsscenen och sköter husdjurspanelen (kläckning, namngivning,
// matning, tillväxt). Datan bor i studentData.pets via data-pet.js.
// Hålls separat så pages-rum.js stannar under filtaket.
// ============================================================================

import * as petData from "./data-pet.js";
import { el, flash } from "./ui.js";
import { getSpecies, creatureSvg } from "./art-pets-creatures.js";
import { spriteRigHtml, SPRITE_MOODS } from "./art-pet-sprites.js";
import { eggSvg } from "./art-pets.js";
import { confetti } from "./fx.js";

const STAGE_NAMES = ["", "Bebis", "Halvstor", "Fullvuxen"];

/** "kläcks om ~2 dagar" – barnvänlig grov nedräkning. */
export function countdownText(msLeft) {
  if (msLeft <= 0) return "kläcks vilken sekund som helst!";
  const min = Math.ceil(msLeft / 60000);
  if (min < 60) return `kläcks om ~${min} minut${min === 1 ? "" : "er"}`;
  const hours = Math.ceil(msLeft / 3600000);
  if (hours <= 36) return `kläcks om ~${hours} timm${hours === 1 ? "e" : "ar"}`;
  const days = Math.round(msLeft / 86400000) || 1;
  return `kläcks om ~${days} dag${days === 1 ? "" : "ar"}`;
}

/** Visningsnamn: elevens eget namn, annars artnamnet, annars "Ägg". */
export function petDisplayName(pet) {
  if (pet.name) return pet.name;
  const species = pet.speciesId ? getSpecies(pet.speciesId) : null;
  return species ? species.name : "Mystiskt ägg";
}

// --- Uttryck & klick-lek (flyktigt runtime-tillstånd, per djur) -------------
// Uttrycken sparas inte: äter när djuret når ett äpple, glad efter interaktion,
// nyfiken när pekaren är nära djuret. Timers är per djur och rör bara noder som
// fortfarande sitter i DOM:en.

const moodTimers = new Map(); // petId -> timeout (återgång till vilouttryck)
const moodBusy = new Map(); // petId -> tidsstämpel: tidsatt uttryck pågår

/** Vilouttryck: neutral (matningen sker via äpplen på golvet, inte här). */
function idleExpression() {
  return "";
}

function findPetNode(petId) {
  return document.querySelector(`.room-pet[data-pet-id="${petId}"]`);
}

/** Är husdjuret en sprite-riggad art (bild-delar) i stället för SVG? */
function isSpritePet(pet) {
  const species = pet.speciesId ? getSpecies(pet.speciesId) : null;
  return !!(species && species.kind === "sprite");
}

/** Figurens HTML: sprite-rigg för sprite-arter, annars procedurell SVG. */
function petArtHtml(pet, expr) {
  if (isSpritePet(pet)) {
    return spriteRigHtml(pet.speciesId, pet.stage || 1, expr) || "🐾";
  }
  return creatureSvg(pet.speciesId, expr) || "🐾";
}

function swapArt(node, pet, expr) {
  const slot = node && node.querySelector(".ri-emoji");
  if (!slot) return;
  // Sprite-arter: rita INTE om riggen (det skulle nollställa animationerna) –
  // uttrycket visas som humör-partikel vid huvudet (💤/❤️/🍎, designdoket).
  if (isSpritePet(pet)) {
    const fx = slot.querySelector(".ps-humor");
    if (fx) fx.textContent = SPRITE_MOODS[expr] || "";
    return;
  }
  slot.innerHTML = creatureSvg(pet.speciesId, expr) || "🐾";
}

/** Visa ett uttryck i ms millisekunder, sedan tillbaka till vilouttrycket. */
export function setPetMood(pet, expr, ms) {
  const node = findPetNode(pet.id);
  if (!node || !pet.hatchedAt) return;
  clearTimeout(moodTimers.get(pet.id));
  moodBusy.set(pet.id, Date.now() + ms);
  swapArt(node, pet, expr);
  moodTimers.set(pet.id, setTimeout(() => {
    moodBusy.delete(pet.id);
    swapArt(findPetNode(pet.id), pet, idleExpression(pet));
  }, ms));
}

// Tajming från design-facit: 700 ms flip + 2600 ms sprattel + 550 ms upp igen.
const RYGG_MS = 3850;

/** Klick-lek: djuret lägger sig på rygg, sprattlar och blir extra glatt. */
export function petBellyFlop(pet) {
  const node = findPetNode(pet.id);
  if (!node || !pet.hatchedAt || node.classList.contains("pet-rygg")) return;
  setPetMood(pet, "glad", RYGG_MS + 1500); // extra glad en stund efteråt
  node.classList.add("pet-rygg");
  const fx = el('<span class="pet-rygg-fx">💖</span>');
  node.appendChild(fx);
  setTimeout(() => {
    node.classList.remove("pet-rygg");
    fx.remove();
  }, RYGG_MS);
}

/**
 * DOM-nod för ett husdjur i rumsscenen (samma dra-pipeline som sakerna:
 * klassen room-item + data-pet-id, position i procent).
 */
export function petStageNode(pet, selected) {
  const pos = pet.pos || { x: 50, y: 70 };
  const art = pet.hatchedAt ? petArtHtml(pet, idleExpression(pet)) : eggSvg();
  const stageClass = pet.hatchedAt ? ` pet-vuxen-${pet.stage || 1}` : " pet-agg-i-rum";
  const label = pet.hatchedAt
    ? `<span class="rp-namn">${petDisplayName(pet)}</span>`
    : `<span class="rp-namn rp-agg">🥚 ruvar…</span>`;
  const node = el(`<div class="room-item room-pet${stageClass}${selected ? " selected" : ""}"
    data-pet-id="${pet.id}" style="left:${pos.x}%;top:${pos.y}%" title="${petDisplayName(pet)}">
    <span class="ri-emoji">${art}</span>
    ${label}
  </div>`);
  if (pet.hatchedAt) {
    // Nyfiken när man är nära (hovrar) – men stör inte pågående uttryck/lek.
    const calm = () => !node.classList.contains("pet-rygg") &&
      (moodBusy.get(pet.id) || 0) <= Date.now();
    node.addEventListener("pointerenter", () => {
      if (calm()) swapArt(node, pet, "nyfiken");
    });
    node.addEventListener("pointerleave", () => {
      if (calm()) swapArt(node, pet, idleExpression(pet));
    });
  }
  return node;
}

/**
 * READ-ONLY nod för ett KLÄCKT husdjur (t.ex. i en kompis läs-vy): exakt samma
 * sprite-/SVG-utseende som i eget rum, men helt stilla – inga hover-/klick-/
 * drag-listeners, ingen panel, inga humör-/matningsuttryck. Idle-andningen är
 * gratis via CSS-klasserna. Ägg (ej kläckta) ritas inte här → returnerar null.
 */
export function petReadonlyNode(pet) {
  if (!pet || !pet.hatchedAt) return null;
  const pos = pet.pos || { x: 50, y: 70 };
  const art = petArtHtml(pet, idleExpression(pet));
  return el(`<div class="room-item room-pet readonly pet-vuxen-${pet.stage || 1}"
    style="left:${pos.x}%;top:${pos.y}%" title="${petDisplayName(pet)}">
    <span class="ri-emoji">${art}</span>
    <span class="rp-namn">${petDisplayName(pet)}</span>
  </div>`);
}

/**
 * Rita husdjurspanelen (under rumsscenen) för det valda djuret.
 * opts: { hasLamp, justHatched, onUpdate(pets), onClose() }
 */
export function renderPetPanel(container, pet, opts) {
  container.replaceChildren();
  if (!pet) return;
  container.appendChild(
    pet.hatchedAt ? creaturePanel(pet, opts) : eggPanel(pet, opts)
  );
}

// --- Ägg: nedräkning --------------------------------------------------------

function eggPanel(pet, opts) {
  const hatchAt = petData.hatchTimeFor(pet, opts.hasLamp);
  const view = el(`<div class="panel center rum-pet-panel">
    <h2>Ett ägg ruvar… 🥚</h2>
    <p class="pet-nedrakning" id="nedrakning">Ägget ${countdownText(hatchAt - Date.now())}</p>
    ${pet.hasHeatLamp || opts.hasLamp
      ? '<p class="hint">🔦 Din värmelampa värmer ägget – det kläcks dubbelt så snabbt!</p>'
      : ""}
    <p class="hint">Ingen vet vilken varelse som bor där inne. Titta in igen snart! 💤</p>
  </div>`);
  // Ticka nedräkningen så länge panelen är kvar i DOM:en.
  const label = view.querySelector("#nedrakning");
  const timer = setInterval(() => {
    if (!document.contains(label)) return clearInterval(timer);
    label.textContent = `Ägget ${countdownText(hatchAt - Date.now())}`;
  }, 30000);
  return view;
}

// --- Kläckt djur: namn + matning + tillväxt ---------------------------------

function creaturePanel(pet, opts) {
  const species = getSpecies(pet.speciesId);
  const namn = petDisplayName(pet);
  const stage = pet.stage || 1;
  const next = petData.feedsToNextStage(pet.feedCount);
  const behoverNamn = !pet.name;

  let vaxHtml;
  if (next) {
    // Kompakt matnings-mätare (10 äpplen per steg) i stället för många prickar.
    const from = stage === 1 ? 0 : petData.STAGE2_FEEDS;
    const inSteg = Math.max(0, (pet.feedCount || 0) - from);
    const behovs = next.needed - from;
    const kvar = next.needed - next.have;
    const pct = Math.min(100, Math.round((inSteg / behovs) * 100));
    vaxHtml = `<p class="hint">Mata ${kvar} äppl${kvar === 1 ? "e" : "en"} till så växer ${namn} till nästa steg!</p>
      <div class="pet-matbar"><div class="pet-matbar-fyll" style="width:${pct}%"></div>
      <span class="pet-matbar-text">🍎 ${inSteg} / ${behovs}</span></div>`;
  } else {
    vaxHtml = `<p class="hint">🌟 ${namn} är fullvuxen – vilken bjässe! Den behöver ingen mer mat, men du kan förstås fortsätta mysa. 💚</p>`;
  }

  const view = el(`<div class="panel center rum-pet-panel">
    <h2>${opts.justHatched ? "Ägget har kläckts! 🎉" : namn}</h2>
    ${opts.justHatched ? `<p class="hint">Ur ägget kläcktes… en <b>${species ? species.name : "varelse"}</b>!</p>` : ""}
    <div class="pet-steg">
      ${[1, 2, 3].map((s) => `<span class="pet-steg-chip${s === stage ? " aktiv" : ""}${s < stage ? " klar" : ""}">Steg ${s}<br><small>${STAGE_NAMES[s]}</small></span>`).join("")}
    </div>
    <div id="namn-rad">${behoverNamn
      ? `<p><b>Vad ska din nya kompis heta?</b></p>${nameFormHtml("")}`
      : `<p class="hint">${species ? `Art: <b>${species.name}</b> · ` : ""}Steg ${stage} av 3 · 🍎 ${pet.feedCount || 0} matningar</p>`}
    </div>
    <div id="vax">${vaxHtml}</div>
    ${next
      ? `<p class="hint pet-mat-tips">🍎 Mata ${namn} genom att köpa <b>Mysterymat</b> i shoppen och lägga ut den på golvet med <b>🍎 Mysterymat</b> – då går ${namn} dit och äter!</p>`
      : ""}
    ${behoverNamn ? "" : '<button class="btn liten ghost" id="byt-namn">✏️ Byt namn</button>'}
  </div>`);

  // Namnformulär (nytt namn eller byte).
  wireNameForm(view, pet, opts);
  const bytBtn = view.querySelector("#byt-namn");
  if (bytBtn) {
    bytBtn.addEventListener("click", () => {
      const rad = view.querySelector("#namn-rad");
      rad.innerHTML = `<p><b>Vad ska ${namn} heta i stället?</b></p>${nameFormHtml(pet.name || "")}`;
      wireNameForm(view, pet, opts);
      rad.querySelector(".pet-namn-input")?.focus();
    });
  }

  return view;
}

function nameFormHtml(value) {
  return `<form class="pet-namn-form" id="namn-form">
    <input class="pet-namn-input" maxlength="${petData.NAME_MAX_LEN}" value="${value.replace(/"/g, "&quot;")}"
      placeholder="Skriv ett namn…" autocomplete="off" />
    <button class="btn gron" type="submit">Spara namn</button>
  </form>`;
}

function wireNameForm(view, pet, opts) {
  const form = view.querySelector("#namn-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector(".pet-namn-input");
    const clean = petData.cleanPetName(input.value);
    if (!clean) {
      flash("Skriv ett namn först! ✏️", true);
      input.focus();
      return;
    }
    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Sparar…";
    try {
      const res = await petData.setPetName(pet.id, clean);
      if (res.ok) {
        confetti();
        flash(`${clean} – vilket fint namn! 💚`);
        opts.onUpdate(res.pets, pet.id);
      } else {
        flash("Kunde inte spara namnet.", true);
        btn.disabled = false;
        btn.textContent = "Spara namn";
      }
    } catch (err) {
      flash("Kunde inte spara namnet: " + err.message, true);
      btn.disabled = false;
      btn.textContent = "Spara namn";
    }
  });
}
