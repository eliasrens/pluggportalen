// ============================================================================
// Pluggportalen – Shoppen
// ----------------------------------------------------------------------------
// Eleven köper saker för pluggcoins. Kläder sätts på avataren (i Mitt rum eller
// profilen), möbler/husdjur/dekor placeras i rummet. Köp går via datamodulens
// buyItem() – en transaktion som drar coins och lägger till saken i samma steg,
// så inga negativa saldon och inga dubbelköp (dubbelklick låser dessutom knappen).
// ============================================================================

import * as data from "./data.js";
import { buyEgg, buyHeatLamp, EGG_ITEM_ID, LAMP_ITEM_ID } from "./data-pet.js";
import { buyApple, APPLE_ITEM_ID } from "./data-pet-mat.js";
import { app, el, go, loading, renderTopbar, pageError, flash } from "./ui.js";
import { buyAnimal, animalsFromData } from "./data-animals.js";
import { CATEGORIES, getItem, itemsInCategory, isConsumable, isAnimalItem, isMultiItem } from "./shop-items.js";
import { wearableSvg } from "./art-wearables.js";
import { itemSvg, categorySvg } from "./art-items.js";
import { coinIcon } from "./icons.js";

export async function pageElevShop() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  let sd;
  try {
    sd = await data.getStudentData();
  } catch (err) {
    return pageError("Kunde inte ladda shoppen", err);
  }

  // Lokalt tillstånd som speglar Firestore. Uppdateras vid varje köp.
  const state = {
    coins: sd.coins || 0,
    owned: new Set(sd.ownedItems || []), // binärt "ägd" (single-kategorier & legacy)
    ownedCounts: { ...(sd.ownedCounts || {}) }, // antal per multi-sak (möbler/dekor)
    appleCount: sd.appleCount || 0, // förbrukningsvara: antal, inte "ägd"
    // Vanliga djur bor i roomAnimals (inte ownedItems) – flera exemplar per art
    // tillåts, så vi räknar antal per art.
    animalCounts: countAnimalsByArt(animalsFromData(sd)),
  };

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel shop-head">
      <div>
        <h1>Shoppen 🛍️</h1>
        <p class="hint">Köp saker för dina pluggcoins. Kläder sätter du på din figur,
          möbler placerar du i <b>Mitt rum</b> – husdjur flyttar in själva och
          promenerar omkring där!</p>
      </div>
      <div class="shop-saldo">Ditt saldo<br /><span class="coins" id="saldo">${coinIcon(24)} ${state.coins}</span></div>
    </div>
    <div id="katalog"></div>
    <div class="center" style="margin-top:8px">
      <button class="btn ghost" id="to-rum">🛏️ Gå till Mitt rum</button>
    </div>
  </div>`);

  const katalog = view.querySelector("#katalog");
  const saldoEl = view.querySelector("#saldo");

  // Rita katalogen (per kategori). Anropas om vid varje köp så knapparnas läge
  // ("köp" / "har inte råd" / "köpt") alltid stämmer med saldot.
  function renderKatalog() {
    katalog.replaceChildren(
      ...CATEGORIES.map((cat) => {
        const cards = itemsInCategory(cat.id)
          .map((it) => shopCardHtml(it, state))
          .join("");
        const ico = categorySvg(cat.id);
        const rubrik = ico ? `<span class="cat-ico">${ico}</span>` : cat.emoji;
        return el(`<section class="shop-cat">
          <h2>${rubrik} ${cat.name}</h2>
          <div class="shop-grid">${cards}</div>
        </section>`);
      })
    );
  }

  renderKatalog();

  view.querySelector("#back").addEventListener("click", () => go("#/elev/hus"));
  view.querySelector("#to-rum").addEventListener("click", () => go("#/elev/rum"));

  // Ett köp-klick (delegerat). Knappen låses direkt så dubbelklick inte kan
  // trigga två köp; buyItem() i datamodulen är dessutom en transaktion.
  katalog.addEventListener("click", async (e) => {
    const btn = e.target.closest(".buy-btn");
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    const item = getItem(id);
    // Förbrukningsvaror (äpplen), multi-saker (möbler/dekor) och vanliga djur kan
    // köpas hur många gånger som helst; single-saker bara om de inte redan ägs.
    if (!item || item.comingSoon) return;
    const rebuyable = isConsumable(id) || isMultiItem(id) || isAnimalItem(id);
    if (!rebuyable && state.owned.has(id)) return;

    btn.disabled = true;
    btn.textContent = "Köper…";
    try {
      // Ägget/värmelampan uppdaterar även studentData.pets (kläckningsklockan)
      // och köps därför via data-pet.js – i övrigt samma transaktionsmönster.
      // Ägget kan köpas FLERA gånger (varje köp = ett nytt ägg i rummet) och
      // hamnar därför aldrig i ownedItems.
      // Vanliga djur (hund/katt …) blir LEVANDE, promenerande djur i rummet
      // (studentData.roomAnimals) – inte statiska saker i ownedItems.
      let res;
      if (item.id === EGG_ITEM_ID) res = await buyEgg(item.price);
      else if (item.id === LAMP_ITEM_ID) res = await buyHeatLamp(item.price);
      else if (item.id === APPLE_ITEM_ID) res = await buyApple(item.price);
      else if (isAnimalItem(item.id)) res = await buyAnimal(item.id, item.price);
      else res = await data.buyItem(item.id, item.price);
      state.coins = res.coins;
      if (res.owned) state.owned = new Set(res.owned);
      if (res.counts) state.ownedCounts = { ...res.counts };
      if (res.animals) state.animalCounts = countAnimalsByArt(res.animals);
      if (typeof res.appleCount === "number") state.appleCount = res.appleCount;
      saldoEl.innerHTML = `${coinIcon(24)} ${state.coins}`;
      renderKatalog();
      if (res.ok) {
        await renderTopbar(); // uppdatera saldot i sidhuvudet
        if (item.id === EGG_ITEM_ID) {
          flash(`Du köpte ett mystiskt ägg! 🥚 Det ruvar nu i Mitt rum.`);
        } else if (item.id === LAMP_ITEM_ID) {
          flash(`Du köpte en värmelampa! 🔦 Nu kläcks ägget dubbelt så snabbt.`);
        } else if (item.id === APPLE_ITEM_ID) {
          flash(`Du köpte ett äpple! 🍎 Du har nu ${state.appleCount} st – lägg ut dem i Mitt rum så äter husdjuren.`);
        } else if (isAnimalItem(item.id)) {
          flash(`Du köpte ${item.name}! ${item.emoji} Den promenerar nu omkring i Mitt rum.`);
        } else if (item.roomUpgrade) {
          flash(`Du köpte ${item.name}! 🚪 Ett nytt rum finns nu i ditt hus – gå in och byt rum via dörren eller rumslistan.`);
        } else if (item.category === "hus") {
          flash(`Du köpte ${item.name}! ${item.emoji} Byt till det via 🏠 Nytt hus i din husvärld.`);
        } else if (item.category === "tradgard") {
          flash(`Du köpte ${item.name}! ${item.emoji} Ställ ut den via 🌳 Trädgård i din husvärld.`);
        } else {
          flash(item.category === "klader"
            ? `Du köpte ${item.name}! Sätt på den i Mitt rum.`
            : `Du köpte ${item.name}! Placera den i Mitt rum.`);
        }
      } else {
        // Täcker inte (t.ex. saldot ändrat i en annan flik).
        flash("Du har inte råd med den just nu.", true);
      }
    } catch (err) {
      renderKatalog();
      flash("Något gick fel vid köpet: " + err.message, true);
    }
  });

  app.replaceChildren(view);
}

/** Antal vanliga djur per art ur en animalsFromData-lista: { [art]: n }. */
function countAnimalsByArt(animals) {
  const counts = {};
  for (const a of animals || []) counts[a.id] = (counts[a.id] || 0) + 1;
  return counts;
}

/** Hur många exemplar eleven äger av en multi-sak (möbler/dekor) i shop-state. */
function multiCount(id, state) {
  const counts = state.ownedCounts || {};
  if (Object.prototype.hasOwnProperty.call(counts, id)) return Math.max(0, Math.round(counts[id] || 0));
  return state.owned.has(id) ? 1 : 0;
}

/** HTML för ett shop-kort, med rätt knappläge utifrån ägande/saldo. */
function shopCardHtml(it, state) {
  const consumable = isConsumable(it.id);
  const multi = isMultiItem(it.id); // möbler/dekor – flera exemplar tillåts
  const animal = isAnimalItem(it.id); // vanliga djur – flera exemplar tillåts
  // Dessa kan alltid köpas igen (blockeras aldrig som "Köpt"); övriga single-
  // saker (kläder/hus/…) blockeras när de redan ägs.
  const rebuyable = consumable || multi || animal;
  const owned = !rebuyable && state.owned.has(it.id);
  const affordable = state.coins >= it.price;
  let btn;
  if (it.comingSoon) {
    btn = `<button class="buy-btn nej" disabled title="Snart kläcks nya vänner här!">🔒 Kommer snart</button>`;
  } else if (owned) {
    btn = `<button class="buy-btn kopt" disabled>✓ Köpt</button>`;
  } else if (!affordable) {
    btn = `<button class="buy-btn nej" disabled title="Du behöver ${it.price - state.coins} coins till">Har inte råd</button>`;
  } else {
    btn = `<button class="buy-btn" data-id="${it.id}">Köp</button>`;
  }
  // Kläder ritas av art-wearables.js, övriga rums-saker av art-items.js.
  // emoji-fältet är kvar som ofarlig fallback om konst saknas.
  const bild =
    (it.category === "klader" ? wearableSvg(it.id) : itemSvg(it.id)) || it.emoji;
  // Rebuyable-saker visar hur många man redan äger i stället för "Köpt".
  let have = 0;
  if (consumable) have = state.appleCount;
  else if (animal) have = state.animalCounts[it.id] || 0;
  else if (multi) have = multiCount(it.id, state);
  const antal = rebuyable ? `<div class="shop-antal">Du har: ${have} st</div>` : "";
  return `<div class="shop-card${owned ? " is-owned" : ""}">
    <div class="shop-emoji">${bild}</div>
    <div class="shop-namn">${it.name}</div>
    <div class="shop-pris">${coinIcon(16)} ${it.price}</div>
    ${antal}
    ${btn}
  </div>`;
}
