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
import { CATEGORIES, getItem, itemsInCategory, isConsumable, isAnimalItem, isMultiItem, isMysteryBox } from "./shop-items.js";
import { runMysteryBox } from "./pages-shop-mystery.js";
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
    <div id="katalog"></div>
  </div>`);

  const katalog = view.querySelector("#katalog");

  // Bara kategorier som faktiskt har köpbara varor blir flikar. CATEGORIES-
  // ordningen bevaras, så mysteryboxen (sist i listan) hamnar sist i flikraden.
  const tabCats = CATEGORIES.filter((cat) => itemsInCategory(cat.id).length > 0);

  // Aktiv flik minns i localStorage (tåligt om storage saknas/är blockerad).
  // Default: första kategorin med varor.
  let activeCat = readSavedCat(tabCats) || (tabCats[0] && tabCats[0].id) || null;

  // Rita flikraden + den aktiva kategorins varor. Anropas om vid varje köp så
  // knapparnas läge ("köp" / "har inte råd" / "köpt") alltid stämmer med saldot,
  // och vid flikbyte (ingen sidladdning – bara listan byts).
  function renderKatalog() {
    const cat = tabCats.find((c) => c.id === activeCat) || tabCats[0];
    if (!cat) {
      katalog.replaceChildren(el(`<p class="hint">Shoppen är tom just nu.</p>`));
      return;
    }
    activeCat = cat.id;

    const tabs = tabCats
      .map((c) => {
        const ico = categorySvg(c.id);
        const label = ico
          ? `<span class="cat-ico">${ico}</span>`
          : `<span class="shop-tab-emoji">${c.emoji}</span>`;
        const on = c.id === cat.id;
        return `<button type="button" class="shop-tab${on ? " active" : ""}"
          role="tab" aria-selected="${on ? "true" : "false"}" data-cat="${c.id}">
          ${label}<span class="shop-tab-namn">${c.name}</span>
        </button>`;
      })
      .join("");

    const cards = itemsInCategory(cat.id)
      .map((it) => shopCardHtml(it, state))
      .join("");
    const hint = cat.hint ? `<p class="hint shop-cat-hint">${cat.hint}</p>` : "";

    katalog.replaceChildren(
      el(`<div>
        <div class="shop-tabs" role="tablist">${tabs}</div>
        <section class="shop-cat" role="tabpanel">
          ${hint}
          <div class="shop-grid">${cards}</div>
        </section>
      </div>`)
    );
  }

  renderKatalog();


  // Flikbyte (delegerat). Byter aktiv kategori, sparar valet och ritar om
  // listan – ingen sidladdning. Köp-listenern nedan ignorerar flik-klick.
  katalog.addEventListener("click", (e) => {
    const tab = e.target.closest(".shop-tab");
    if (!tab) return;
    const id = tab.dataset.cat;
    if (!id || id === activeCat) return;
    activeCat = id;
    saveCat(id);
    renderKatalog();
  });

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

    // Mysterybox: köp & öppna → reveal-flöde (pages-shop-mystery.js). Boxen kan
    // köpas hur många gånger som helst; den lottade saken sparas i ownedItems.
    if (isMysteryBox(id)) {
      btn.disabled = true;
      btn.textContent = "Öppnar…";
      try {
        const res = await runMysteryBox({ price: item.price });
        if (res.ok) {
          state.coins = res.coins;
          if (res.owned) state.owned = new Set(res.owned);
          renderKatalog();
          await renderTopbar();
        } else {
          renderKatalog();
          flash("Du har inte råd med en mysterybox just nu.", true);
        }
      } catch (err) {
        renderKatalog();
        flash("Något gick fel när boxen öppnades: " + err.message, true);
      }
      return;
    }

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

// Nyckeln som minns senast valda shop-flik mellan besök.
const ACTIVE_CAT_KEY = "pp:shop:aktivFlik";

/** Läs sparad aktiv flik, men bara om den fortfarande finns bland flikarna. */
function readSavedCat(tabCats) {
  try {
    const id = localStorage.getItem(ACTIVE_CAT_KEY);
    if (id && tabCats.some((c) => c.id === id)) return id;
  } catch (_) {
    // storage saknas/blockerad (privat läge m.m.) – strunta i det.
  }
  return null;
}

/** Spara vald flik (tåligt om storage saknas). */
function saveCat(id) {
  try {
    localStorage.setItem(ACTIVE_CAT_KEY, id);
  } catch (_) {
    // ignorera – valet lever ändå kvar i minnet under sessionen.
  }
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
  const box = isMysteryBox(it.id); // mysteryboxen – öppnas hur många gånger som helst
  // Dessa kan alltid köpas igen (blockeras aldrig som "Köpt"); övriga single-
  // saker (kläder/hus/…) blockeras när de redan ägs.
  const rebuyable = consumable || multi || animal || box;
  const owned = !rebuyable && state.owned.has(it.id);
  const affordable = state.coins >= it.price;
  // Priset sitter numera PÅ köp-knappen (eget chip) i stället för på en egen rad.
  const pris = `<span class="buy-pris">${coinIcon(15)} ${it.price}</span>`;
  let btn;
  if (it.comingSoon) {
    btn = `<button class="buy-btn nej" disabled title="Snart kläcks nya vänner här!">🔒 Kommer snart</button>`;
  } else if (owned) {
    btn = `<button class="buy-btn kopt" disabled>✓ Köpt</button>`;
  } else if (!affordable) {
    btn = `<button class="buy-btn nej" disabled title="Du behöver ${it.price - state.coins} coins till">${pris}</button>`;
  } else {
    btn = `<button class="buy-btn" data-id="${it.id}"><span class="buy-text">${box ? "Öppna 🎁" : "Köp"}</span>${pris}</button>`;
  }
  // Kläder ritas av art-wearables.js, övriga rums-saker av art-items.js.
  // emoji-fältet är kvar som ofarlig fallback om konst saknas.
  const bild =
    (it.category === "klader" ? wearableSvg(it.id) : itemSvg(it.id)) || it.emoji;
  // Rebuyable-saker visar hur många man redan äger i stället för "Köpt".
  // Mysteryboxen är en handling (öppnas), inte en ägd sak → ingen antal-rad.
  let have = 0;
  if (consumable) have = state.appleCount;
  else if (animal) have = state.animalCounts[it.id] || 0;
  else if (multi) have = multiCount(it.id, state);
  const antal = rebuyable && !box ? `<div class="shop-antal">Du har: ${have} st</div>` : "";
  return `<div class="shop-card${owned ? " is-owned" : ""}">
    <div class="shop-emoji">${bild}</div>
    <div class="shop-namn">${it.name}</div>
    ${antal}
    ${btn}
  </div>`;
}
