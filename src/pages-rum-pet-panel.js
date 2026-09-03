// ============================================================================
// Pluggportalen – husdjurspanelen under rumsscenen (Mitt rum)
// ----------------------------------------------------------------------------
// Systermodul till pages-rum-pets.js (som äger djurens scen-noder + klick-lek):
// den PANEL som ritas under scenen för det valda djuret. Ägg → nedräkning,
// kläckt djur → namn/matnings-mätare/tillväxt + "Stuva undan", och den
// lättviktiga namn-vyn för vanliga (fast-storleks) djur. Datan bor i
// studentData.pets via data-pet.js; namn saneras med cleanPetName.
// ============================================================================

import * as petData from "./data-pet.js";
import { el, flash } from "./ui.js";
import { getSpecies } from "./art-pets-creatures.js";
import { confetti } from "./fx.js";
import { petDisplayName } from "./pages-rum-pets.js";

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

/**
 * Rita husdjurspanelen (under rumsscenen) för det valda djuret.
 * opts: { hasLamp, justHatched, onUpdate(pets), onStow(), onClose() }
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
  // Öppna namnfältet direkt när djuret saknar namn ELLER när panelen nåddes via
  // ✏️-affordansen (namn-etiketten under djuret) – matnings-mätaren visas ändå.
  const visaNamnfalt = behoverNamn || !!opts.startRename;

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
    <div id="namn-rad">${visaNamnfalt
      ? `<p><b>${behoverNamn ? "Vad ska din nya kompis heta?" : `Vad ska ${namn} heta?`}</b></p>${nameFormHtml(pet.name || "")}`
      : `<p class="hint">${species ? `Art: <b>${species.name}</b> · ` : ""}Steg ${stage} av 3 · 🍎 ${pet.feedCount || 0} matningar</p>`}
    </div>
    <div id="vax">${vaxHtml}</div>
    ${next
      ? `<p class="hint pet-mat-tips">🍎 Mata ${namn} genom att köpa <b>Mysterymat</b> i shoppen och lägga ut den på golvet med <b>🍎 Mysterymat</b> – då går ${namn} dit och äter!</p>`
      : ""}
    ${visaNamnfalt ? "" : '<button class="btn liten ghost" id="byt-namn">✏️ Byt namn</button>'}
    ${opts.onStow ? '<button class="btn liten ghost" id="stuva-djur" type="button" title="Lägg djuret i Mina djur">📦 Stuva undan</button>' : ""}
  </div>`);

  // Namnformulär (nytt namn eller byte).
  wireNameForm(view, pet, opts);
  // Nåddes panelen via ✏️-affordansen? Fokusera namnfältet direkt (efter att
  // noden monterats i DOM:en av anroparen).
  if (visaNamnfalt && opts.startRename) {
    setTimeout(() => view.querySelector(".pet-namn-input")?.focus(), 0);
  }
  const bytBtn = view.querySelector("#byt-namn");
  if (bytBtn) {
    bytBtn.addEventListener("click", () => {
      const rad = view.querySelector("#namn-rad");
      rad.innerHTML = `<p><b>Vad ska ${namn} heta i stället?</b></p>${nameFormHtml(pet.name || "")}`;
      wireNameForm(view, pet, opts);
      rad.querySelector(".pet-namn-input")?.focus();
    });
  }
  // "Stuva undan": flytta djuret till Mina djur (rummet sköter data + omritning).
  const stuvaBtn = view.querySelector("#stuva-djur");
  if (stuvaBtn) stuvaBtn.addEventListener("click", () => opts.onStow());

  return view;
}

function nameFormHtml(value) {
  return `<form class="pet-namn-form" id="namn-form">
    <input class="pet-namn-input" maxlength="${petData.NAME_MAX_LEN}" value="${value.replace(/"/g, "&quot;")}"
      placeholder="Skriv ett namn…" autocomplete="off" />
    <button class="btn gron" type="submit">Spara namn</button>
  </form>`;
}

/**
 * LÄTTVIKTIG namn-vy för ett vanligt djur (varld-rum-djur.js): bara det lilla
 * inline-namnfältet (samma nameFormHtml-stil som mystery-djuren) – ingen
 * matnings-/tillväxtinfo, för de vanliga djuren har ingen. Nås via ✏️-
 * affordansen (namn-etiketten), aldrig genom att panelen tvingas fram vid klick.
 * En "📦 Stuva undan"-knapp (om onStow ges) lägger djuret i Mina djur.
 *
 * @param {object} o
 * @param {string} o.displayName  djurets visningsnamn just nu (namn ell. art)
 * @param {string} o.currentName  ev. sparat namn att förifylla (tom sträng = inget)
 * @param {(clean: string) => Promise<{ok: boolean}>} o.onSave  sparar namnet
 * @param {() => void} [o.onStow]  stuva undan djuret (visar knappen om satt)
 * @param {boolean} [o.autoFocus] fokusera fältet direkt (öppnat via ✏️)
 */
export function animalNamePanel({ displayName, currentName, onSave, onStow, autoFocus }) {
  const behoverNamn = !currentName;
  const view = el(`<div class="panel center rum-pet-panel rum-namn-panel">
    <p><b>${behoverNamn ? "Vad ska ditt djur heta?" : `Vad ska ${displayName} heta?`}</b></p>
    ${nameFormHtml(currentName || "")}
    <p class="hint">Klick på djuret = klappa det! 💚</p>
    ${onStow ? '<button class="btn liten ghost" id="stuva-djur" type="button" title="Lägg djuret i Mina djur">📦 Stuva undan</button>' : ""}
  </div>`);
  const form = view.querySelector("#namn-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector(".pet-namn-input");
    const clean = petData.cleanPetName(input.value);
    if (!clean) {
      flash("Skriv ett namn först! ✏️", true);
      input.focus();
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Sparar…";
    try {
      const res = await onSave(clean);
      if (res && res.ok) {
        confetti();
        flash(`${clean} – vilket fint namn! 💚`);
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
  // "Stuva undan": rummet sköter data + omritning (samma som mystery-djuren).
  const stuvaBtn = view.querySelector("#stuva-djur");
  if (stuvaBtn) stuvaBtn.addEventListener("click", () => onStow());
  if (autoFocus) setTimeout(() => view.querySelector(".pet-namn-input")?.focus(), 0);
  return view;
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
