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

/**
 * DOM-nod för ett husdjur i rumsscenen (samma dra-pipeline som sakerna:
 * klassen room-item + data-pet-id, position i procent).
 */
export function petStageNode(pet, selected) {
  const pos = pet.pos || { x: 50, y: 70 };
  const art = pet.hatchedAt ? creatureSvg(pet.speciesId) || "🐾" : eggSvg();
  const stageClass = pet.hatchedAt ? ` pet-vuxen-${pet.stage || 1}` : " pet-agg-i-rum";
  const label = pet.hatchedAt
    ? `<span class="rp-namn">${petDisplayName(pet)}</span>`
    : `<span class="rp-namn rp-agg">🥚 ruvar…</span>`;
  return el(`<div class="room-item room-pet${stageClass}${selected ? " selected" : ""}"
    data-pet-id="${pet.id}" style="left:${pos.x}%;top:${pos.y}%" title="${petDisplayName(pet)}">
    <span class="ri-emoji">${art}</span>
    ${label}
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
  const kanMata = petData.canFeed(pet);
  const behoverNamn = !pet.name;

  let vaxHtml;
  if (next) {
    const dots = [];
    const from = stage === 1 ? 0 : petData.STAGE2_FEEDS;
    for (let i = from; i < next.needed; i++) {
      dots.push(`<span class="pet-prick${i < next.have ? " full" : ""}"></span>`);
    }
    const kvar = next.needed - next.have;
    vaxHtml = `<p class="hint">Mata ${kvar} gång${kvar === 1 ? "" : "er"} till så växer ${namn} till nästa steg!</p>
      <div class="pet-prickar">${dots.join("")}</div>`;
  } else {
    vaxHtml = `<p class="hint">🌟 ${namn} är fullvuxen – vilken bjässe! Du kan fortfarande mata den varje dag om du vill mysa.</p>`;
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
    <div id="mata-rad">
      ${kanMata
        ? `<button class="btn stor gron" id="mata">🍎 Mata ${namn}</button>`
        : '<button class="btn stor" disabled>✓ Matad idag</button><p class="hint">Kom tillbaka imorgon och mata igen! 💤</p>'}
    </div>
    <div id="vax">${vaxHtml}</div>
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

  // Matning.
  const mataBtn = view.querySelector("#mata");
  if (mataBtn) {
    mataBtn.addEventListener("click", async () => {
      mataBtn.disabled = true;
      mataBtn.textContent = "Mums…";
      try {
        const res = await petData.feedPet(pet.id);
        if (res.ok) {
          if (res.stageUp) {
            confetti();
            flash(`${petDisplayName(res.pet)} växte till steg ${res.pet.stage}! 🎉`);
          } else {
            flash(`Mums! ${petDisplayName(res.pet)} smaskar glatt. 😋`);
          }
        } else {
          flash(res.reason === "redan-matad"
            ? `${namn} är redan mätt idag – kom tillbaka imorgon!`
            : "Det gick inte att mata just nu.", true);
        }
        opts.onUpdate(res.pets, res.pet ? res.pet.id : pet.id);
      } catch (err) {
        flash("Något gick fel: " + err.message, true);
        mataBtn.disabled = false;
        mataBtn.textContent = `🍎 Mata ${namn}`;
      }
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
