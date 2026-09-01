// ============================================================================
// Pluggportalen – Mitt husdjur (#/elev/husdjur)
// ----------------------------------------------------------------------------
// Tamagotchi-light: eleven köper ett mystiskt ägg i shoppen, ser en nedräkning
// tills det kläcks (~3 dagar, halva tiden med värmelampa), får en slumpad
// varelse och matar den 1 gång/dygn så den växer genom 3 steg. Den kan aldrig
// dö. All data i studentData.pet via data-pet.js; allt räknas ut vid inläsning.
// ============================================================================

import * as data from "./data.js";
import * as petData from "./data-pet.js";
import { app, el, go, loading, renderTopbar, flash, pageError } from "./ui.js";
import { getSpecies, creatureSvg } from "./art-pets-creatures.js";
import { eggSvg } from "./art-pets.js";
import { confetti } from "./fx.js";

const STAGE_NAMES = ["", "Bebis", "Halvstor", "Fullvuxen"];

/** "kläcks om ~2 dagar" – barnvänlig grov nedräkning. */
function countdownText(msLeft) {
  if (msLeft <= 0) return "kläcks vilken sekund som helst!";
  const min = Math.ceil(msLeft / 60000);
  if (min < 60) return `kläcks om ~${min} minut${min === 1 ? "" : "er"}`;
  const hours = Math.ceil(msLeft / 3600000);
  if (hours <= 36) return `kläcks om ~${hours} timm${hours === 1 ? "e" : "ar"}`;
  const days = Math.round(msLeft / 86400000) || 1;
  return `kläcks om ~${days} dag${days === 1 ? "" : "ar"}`;
}

export async function pageElevHusdjur() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  let pet, justHatched = false;
  try {
    pet = await petData.getPet();
    // Dags att kläckas? Räknas ut vid inläsning – ingen bakgrundsprocess.
    if (pet && pet.eggBoughtAt && !pet.hatchedAt) {
      const res = await petData.hatchIfReady();
      pet = res.pet;
      justHatched = res.justHatched;
    }
  } catch (err) {
    return pageError("Kunde inte ladda ditt husdjur", err);
  }

  if (!pet || !pet.eggBoughtAt) return renderNoEgg();
  if (!pet.hatchedAt) return renderEgg(pet);
  renderCreature(pet, justHatched);
}

// --- Inget ägg än: peka mot shoppen -----------------------------------------

function renderNoEgg() {
  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel center">
      <h1>Mitt husdjur 🥚</h1>
      <div class="pet-figur pet-agg">${eggSvg()}</div>
      <p>I shoppen finns ett <b>mystiskt ägg</b>. Ingen vet vad som bor där inne…</p>
      <p class="hint">Köp ägget, vänta några dagar och se vem som kläcks fram!
        En <b>värmelampa</b> får ägget att kläckas dubbelt så snabbt.</p>
      <button class="btn stor gron" id="to-shop">🛍️ Till shoppen</button>
    </div>
  </div>`);
  view.querySelector("#back").addEventListener("click", () => go("#/elev/hem"));
  view.querySelector("#to-shop").addEventListener("click", () => go("#/elev/shop"));
  app.replaceChildren(view);
}

// --- Ägget ruvar: nedräkning ------------------------------------------------

function renderEgg(pet) {
  const hatchAt = petData.hatchTimeFor(pet);
  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel center">
      <h1>Ditt ägg ruvar… 🥚</h1>
      <div class="pet-figur pet-agg pet-wiggle">${eggSvg()}</div>
      <p class="pet-nedrakning" id="nedrakning">Ägget ${countdownText(hatchAt - Date.now())}</p>
      ${pet.hasHeatLamp
        ? '<p class="hint">🔦 Din värmelampa värmer ägget – det kläcks dubbelt så snabbt!</p>'
        : '<p class="hint">Tips: en <b>värmelampa</b> från shoppen får ägget att kläckas dubbelt så snabbt. <a id="lamp-link" style="cursor:pointer;text-decoration:underline">Till shoppen</a></p>'}
      <p class="hint">Ingen vet vilken varelse som bor där inne. Titta in igen snart! 💤</p>
    </div>
  </div>`);
  view.querySelector("#back").addEventListener("click", () => go("#/elev/hem"));
  const lampLink = view.querySelector("#lamp-link");
  if (lampLink) lampLink.addEventListener("click", () => go("#/elev/shop"));

  // Ticka nedräkningen; när tiden är ute laddas sidan om (och kläcker).
  const label = view.querySelector("#nedrakning");
  const timer = setInterval(() => {
    if (!document.contains(label)) return clearInterval(timer); // lämnat sidan
    const left = hatchAt - Date.now();
    if (left <= 0) {
      clearInterval(timer);
      pageElevHusdjur();
      return;
    }
    label.textContent = `Ägget ${countdownText(left)}`;
  }, 30000);

  app.replaceChildren(view);
}

// --- Kläckt: varelse + matning + tillväxt -----------------------------------

function renderCreature(pet, justHatched) {
  const species = getSpecies(pet.speciesId);
  if (!species) {
    return pageError("Hoppsan", new Error("Okänd varelse: " + pet.speciesId));
  }
  const stage = pet.stage || 1;
  const svg = creatureSvg(pet.speciesId);
  const next = petData.feedsToNextStage(pet.feedCount);
  const kanMata = petData.canFeed(pet);

  // Tillväxtindikator: prickar för matningar fram till nästa steg.
  let vaxHtml;
  if (next) {
    const dots = [];
    const from = stage === 1 ? 0 : petData.STAGE2_FEEDS;
    for (let i = from; i < next.needed; i++) {
      dots.push(`<span class="pet-prick${i < next.have ? " full" : ""}"></span>`);
    }
    vaxHtml = `<p class="hint">Mata ${next.needed - next.have} gång${next.needed - next.have === 1 ? "" : "er"} till så växer ${species.name} till nästa steg!</p>
      <div class="pet-prickar">${dots.join("")}</div>`;
  } else {
    vaxHtml = `<p class="hint">🌟 ${species.name} är fullvuxen – vilken bjässe! Du kan fortfarande mata den varje dag om du vill mysa.</p>`;
  }

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel center">
      <h1>${species.name} ${justHatched ? "har kläckts! 🎉" : ""}</h1>
      <div class="pet-steg">
        ${[1, 2, 3].map((s) => `<span class="pet-steg-chip${s === stage ? " aktiv" : ""}${s < stage ? " klar" : ""}">Steg ${s}<br><small>${STAGE_NAMES[s]}</small></span>`).join("")}
      </div>
      <div class="pet-figur pet-stage-${stage}${justHatched ? " pet-pop" : ""}" id="figur">${svg}</div>
      <p class="hint">${justHatched
        ? `Ur ägget kläcktes… <b>${species.name}</b>! Mata din nya kompis varje dag så växer den.`
        : `Din kompis <b>${species.name}</b> är på steg ${stage} av 3.`}</p>
      <div id="mata-rad">
        ${kanMata
          ? '<button class="btn stor gron" id="mata">🍎 Mata ' + species.name + "</button>"
          : '<button class="btn stor" disabled>✓ Matad idag</button><p class="hint">Kom tillbaka imorgon och mata igen! 💤</p>'}
      </div>
      <div id="vax">${vaxHtml}</div>
      <p class="hint">Antal matningar totalt: 🍎 ${pet.feedCount || 0}</p>
    </div>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => go("#/elev/hem"));

  const mataBtn = view.querySelector("#mata");
  if (mataBtn) {
    mataBtn.addEventListener("click", async () => {
      mataBtn.disabled = true;
      mataBtn.textContent = "Mums…";
      try {
        const res = await petData.feedPet();
        if (res.ok) {
          if (res.stageUp) {
            confetti();
            flash(`${species.name} växte till steg ${res.pet.stage}! 🎉`);
          } else {
            flash(`Mums! ${species.name} smaskar glatt. 😋`);
          }
          renderCreature(res.pet, false);
        } else {
          flash(res.reason === "redan-matad"
            ? `${species.name} är redan mätt idag – kom tillbaka imorgon!`
            : "Det gick inte att mata just nu.", true);
          renderCreature(res.pet || pet, false);
        }
      } catch (err) {
        flash("Något gick fel: " + err.message, true);
        mataBtn.disabled = false;
        mataBtn.textContent = `🍎 Mata ${species.name}`;
      }
    });
  }

  if (justHatched) confetti();
  app.replaceChildren(view);
}
