// ============================================================================
// Pluggporten – Shoppen
// Eleven köper saker för pluggcoins. Köp går via datamodulens buyItem() – en
// transaktion som drar coins och lägger till saken i samma steg (inga negativa
// saldon, inga dubbelköp; dubbelklick låser dessutom knappen).
// ============================================================================

import * as data from "./data.js";
import { buyEgg, buyHeatLamp, EGG_ITEM_ID, LAMP_ITEM_ID } from "./data-pet.js";
import { buyApple, APPLE_ITEM_ID } from "./data-pet-mat.js";
import { app, el, go, loading, renderTopbar, pageError, flash } from "./ui.js";
import { buyAnimal, animalsFromData } from "./data-animals.js";
import { buyFarmAnimal, buyFarmUpgrade } from "./data-farm.js";
import { CATEGORIES, SHOP_ITEMS, getItem, itemsInCategory, isConsumable, isAnimalItem, isFarmAnimalItem, isFarmUpgradeItem, isGardenItem, isMultiItem, isMysteryBox, isSeedItem } from "./shop-items.js";
import { runMysteryBox } from "./pages-shop-mystery.js";
import { wearableSvg } from "./art-wearables.js";
import { itemSvg, categorySvg } from "./art-items.js";
import { coinIcon } from "./icons.js";

// --- "🌾 Baksidan"-fliken (#358) --------------------------------------------
// Ren UI-GRUPPERING: samlar allt gård/trädgård-relaterat i en egen flik. Items
// behåller sina category-fält (köp/placering beror på dem); flik-tillhörigheten
// avgörs av predikaten nedan. Sektionerna är disjunkta (varje sak matchar exakt
// en); tömda trädgårds-/mat-flikar försvinner ur flikraden (tomma visas ej).
const BAKSIDAN_TAB = {
  id: "baksidan", name: "Baksidan", emoji: "🌾",
  hint: "Allt till gården och trädgården bakom ditt hus – frön, djur, mat, pynt och uppgraderingar.",
};
// id:t är stabilt (för att minnas vald sub-flik i localStorage, #364); rubrik
// visas som sub-flik-etikett. Ordning/match orörda (#358-grupperingen).
const BAKSIDAN_SEKTIONER = [
  { id: "odling", rubrik: "🌱 Odling", match: (it) => isSeedItem(it.id) },
  { id: "bondgardsdjur", rubrik: "🐴 Bondgårdsdjur", match: (it) => isFarmAnimalItem(it.id) },
  // Mysterymaten (äpplet) är djurmat som läggs ut åt husdjuren → hör hemma här.
  { id: "foder", rubrik: "🍎 Djurmat & foder", match: (it) => isConsumable(it.id) },
  { id: "tradgard", rubrik: "🌳 Trädgård & pynt", match: (it) => isGardenItem(it.id) && !isSeedItem(it.id) && !isFarmUpgradeItem(it.id) },
  { id: "uppgraderingar", rubrik: "⬆️ Uppgraderingar", match: (it) => isFarmUpgradeItem(it.id) },
  // Lada-skins (#353) har category "hus" men väljs på gården (🛖 Ny lada).
  { id: "lada", rubrik: "🛖 Lada-typer", match: (it) => !!it.barnSkin },
];

/** Hör saken hemma i Baksidan-fliken (och ska bort ur sin vanliga flik)? */
function isBaksidanItem(it) {
  return BAKSIDAN_SEKTIONER.some((s) => s.match(it));
}

/** Varorna i en vanlig kategoriflik: Baksidan-sakerna är lyfta UR den. */
function itemsInTab(catId) {
  return itemsInCategory(catId).filter((it) => !isBaksidanItem(it));
}

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
    // Vanliga djur (roomAnimals) resp. bondgårdsdjur (#330, farm.animals) tillåter
    // flera exemplar per art → vi räknar antal per art.
    animalCounts: countAnimalsByArt(animalsFromData(sd)),
    farmAnimalCounts: countFarmAnimalsByArt(data.farmFromData(sd).animals),
    // Gårds-uppgraderingarnas nivåer (#333): sparade fält i farm (aldrig
    // ownedItems) – korten härleder "Köpt"/"🔒 nästa nivå" härifrån.
    farmLevels: farmLevelsFrom(data.farmFromData(sd)),
  };

  const view = el(`<div>
    <div id="katalog"></div>
  </div>`);

  const katalog = view.querySelector("#katalog");

  // Bara kategorier som faktiskt har köpbara varor blir flikar. CATEGORIES-
  // ordningen bevaras, så mysteryboxen (sist i listan) hamnar sist i flikraden.
  // Baksidan-fliken (#358) tar den tömda trädgårds-flikens plats.
  const tabCats = [];
  for (const cat of CATEGORIES) {
    if (cat.id === "tradgard") tabCats.push(BAKSIDAN_TAB);
    if (itemsInTab(cat.id).length > 0) tabCats.push(cat);
  }

  // Aktiv flik minns i localStorage (tåligt om storage saknas/är blockerad).
  // Default: första kategorin med varor.
  let activeCat = readSavedCat(tabCats) || (tabCats[0] && tabCats[0].id) || null;

  // Aktiv sub-flik inne i Baksidan (#364). Rå-läses här; giltigheten (att
  // sektionen finns & har varor) avgörs i renderKatalog mot de icke-tomma
  // sektionerna. Default: första sub-fliken med varor.
  let activeBaksidan = readLS(ACTIVE_BAKSIDAN_KEY);

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

    // Baksidan (#358) navigeras med klickbara sub-flikar (#364) i stället för en
    // lång scroll: en sub-flik per sektion MED varor, bara den aktivas kort visas
    // (så mysterymaten i "Djurmat & foder" hittas utan att scrolla). Övriga = grid.
    let varor;
    if (cat.id === BAKSIDAN_TAB.id) {
      // Tomma sektioner får ingen sub-flik (samma tomhets-regel som huvudflikarna).
      const sektioner = BAKSIDAN_SEKTIONER
        .map((s) => ({ id: s.id, rubrik: s.rubrik,
          items: SHOP_ITEMS.filter((it) => !it.mysteryOnly && s.match(it)) }))
        .filter((s) => s.items.length > 0);
      const aktiv = sektioner.find((s) => s.id === activeBaksidan) || sektioner[0];
      activeBaksidan = aktiv ? aktiv.id : null;
      const subtabs = sektioner
        .map((s) => {
          const on = aktiv && s.id === aktiv.id;
          return `<button type="button" class="shop-subtab${on ? " active" : ""}"
            role="tab" aria-selected="${on ? "true" : "false"}" data-sub="${s.id}">${s.rubrik}</button>`;
        })
        .join("");
      const cards = aktiv ? aktiv.items.map((it) => shopCardHtml(it, state)).join("") : "";
      varor = `<div class="shop-subtabs" role="tablist">${subtabs}</div>
        <div class="shop-grid">${cards}</div>`;
    } else {
      const cards = itemsInTab(cat.id).map((it) => shopCardHtml(it, state)).join("");
      varor = `<div class="shop-grid">${cards}</div>`;
    }
    const hint = cat.hint ? `<p class="hint shop-cat-hint">${cat.hint}</p>` : "";

    katalog.replaceChildren(
      el(`<div>
        <div class="shop-tabs" role="tablist">${tabs}</div>
        <section class="shop-cat" role="tabpanel">
          ${hint}
          ${varor}
        </section>
      </div>`)
    );
  }

  renderKatalog();

  // Flik- och sub-flikbyte (delegerat, ingen sidladdning). Huvudflik → byt
  // kategori; sub-flik (#364) → byt Baksidan-sektion. Klasserna .shop-tab/
  // .shop-subtab/.buy-btn är disjunkta, så köp-listenern nedan är opåverkad.
  katalog.addEventListener("click", (e) => {
    const tab = e.target.closest(".shop-tab");
    if (tab) {
      const id = tab.dataset.cat;
      if (!id || id === activeCat) return;
      activeCat = id;
      writeLS(ACTIVE_CAT_KEY, id);
      renderKatalog();
      return;
    }
    const sub = e.target.closest(".shop-subtab");
    if (!sub) return;
    const id = sub.dataset.sub;
    if (!id || id === activeBaksidan) return;
    activeBaksidan = id;
    writeLS(ACTIVE_BAKSIDAN_KEY, id);
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
        const res = await runMysteryBox({ price: item.price, legendaryChance: item.legendaryChance });
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

    const rebuyable = isConsumable(id) || isMultiItem(id) || isAnimalItem(id) || isFarmAnimalItem(id);
    if (!rebuyable && state.owned.has(id)) return;

    btn.disabled = true;
    btn.textContent = "Köper…";
    try {
      // Ägg/värmelampa köps via data-pet.js (uppdaterar kläckningsklockan);
      // ägget kan köpas flera gånger och hamnar aldrig i ownedItems. Vanliga djur
      // blir levande djur i roomAnimals – inte statiska ownedItems.
      let res;
      if (item.id === EGG_ITEM_ID) res = await buyEgg(item.price);
      else if (item.id === LAMP_ITEM_ID) res = await buyHeatLamp(item.price);
      else if (item.id === APPLE_ITEM_ID) res = await buyApple(item.price);
      else if (isAnimalItem(item.id)) res = await buyAnimal(item.id, item.price);
      else if (isFarmAnimalItem(item.id)) res = await buyFarmAnimal(item.id, item.price);
      // Gårds-uppgraderingar (#333): coins + nivå-fältet i EN transaktion
      // (buyFarmUpgrade, data-farm.js) – aldrig ownedItems.
      else if (isFarmUpgradeItem(item.id)) res = await buyFarmUpgrade(item.id, item.price);
      else res = await data.buyItem(item.id, item.price);
      state.coins = res.coins;
      if (res.owned) state.owned = new Set(res.owned);
      if (res.counts) state.ownedCounts = { ...res.counts };
      if (res.animals) state.animalCounts = countAnimalsByArt(res.animals);
      if (res.farm) {
        state.farmAnimalCounts = countFarmAnimalsByArt(res.farm.animals);
        state.farmLevels = farmLevelsFrom(res.farm);
      }
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
        } else if (isFarmAnimalItem(item.id)) {
          flash(`Du köpte ${item.name}! ${item.emoji} Den bor i Mitt rum – välj rum, hage eller lada under 🐾 Mina djur.`);
        } else if (item.farmUpgrade === "garden") {
          flash(`Du köpte ${item.name}! ${item.emoji} Odlingsbädden på gården är nu större – så fler grödor där.`);
        } else if (item.farmUpgrade === "barn") {
          flash(`Du köpte ${item.name}! ${item.emoji} Laggården är uppgraderad – fler djur får plats i ladan.`);
        } else if (item.roomUpgrade) {
          flash(`Du köpte ${item.name}! 🚪 Ett nytt rum finns nu i ditt hus – gå in och byt rum via dörren eller rumslistan.`);
        } else if (item.barnSkin) {
          // Lada-skins (#353): väljs på gården (🛖 Ny lada), inte i 🏠 Nytt hus.
          flash(`Du köpte ${item.name}! ${item.emoji} Byt till den via 🛖 Ny lada på gården bakom ditt hus.`);
        } else if (item.category === "hus") {
          flash(`Du köpte ${item.name}! ${item.emoji} Byt till det via 🏠 Nytt hus i din husvärld.`);
        } else if (item.seed) {
          flash(`Du köpte ${item.name}! ${item.emoji} Så dem i odlingsbädden på gården bakom ditt hus.`);
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

// Nycklar som minns senast valda flik + Baksidan-sub-flik (#364) mellan besök.
const ACTIVE_CAT_KEY = "pp:shop:aktivFlik";
const ACTIVE_BAKSIDAN_KEY = "pp:shop:baksidanFlik";

/** localStorage-läsning (tålig om storage saknas/är blockerad → null). */
function readLS(key) {
  try { return localStorage.getItem(key) || null; } catch (_) { return null; }
}

/** localStorage-skrivning (tålig; valet lever annars kvar i minnet). */
function writeLS(key, val) {
  try { localStorage.setItem(key, val); } catch (_) { /* ignorera */ }
}

/** Sparad aktiv flik, men bara om den fortfarande finns bland flikarna. */
function readSavedCat(tabCats) {
  const id = readLS(ACTIVE_CAT_KEY);
  if (id && tabCats.some((c) => c.id === id)) return id;
  if (id === "tradgard" || id === "mat") return "baksidan"; // #358-flytt → Baksidan
  return null;
}

/** Antal vanliga djur per art ur en animalsFromData-lista: { [art]: n }. */
function countAnimalsByArt(animals) {
  const counts = {};
  for (const a of animals || []) counts[a.id] = (counts[a.id] || 0) + 1;
  return counts;
}

/** Antal bondgårdsdjur per art ur farm.animals (#330) – samma form som ovan. */
function countFarmAnimalsByArt(animals) {
  return countAnimalsByArt(animals);
}

/** Gårds-nivåerna ur ett farm-objekt (#333): { garden, barn }. */
function farmLevelsFrom(farm) {
  return { garden: farm.gardenTier, barn: farm.barnLevel };
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
  const farmAnimal = isFarmAnimalItem(it.id); // bondgårdsdjur (#330) – också flera
  const box = isMysteryBox(it.id); // mysteryboxen – öppnas hur många gånger som helst
  // Rebuyable köps alltid igen; övriga single-saker (kläder/hus/…) blockeras
  // som "Köpt" när de ägs.
  const rebuyable = consumable || multi || animal || farmAnimal || box;
  // Gårds-uppgraderingar (#333): "Köpt"/låst härleds ur nivå-fältet (farm.
  // gardenTier/barnLevel via state.farmLevels), aldrig ownedItems – och nästa
  // nivå är låst tills föregående är köpt (de köps i ordning).
  const upLevel = it.farmUpgrade
    ? (it.farmUpgrade === "garden" ? state.farmLevels.garden : state.farmLevels.barn)
    : 0;
  const upLocked = !!it.farmUpgrade && it.upgradeLevel > upLevel + 1;
  const owned = (!rebuyable && state.owned.has(it.id)) || (!!it.farmUpgrade && upLevel >= it.upgradeLevel);
  const affordable = state.coins >= it.price;
  // Priset sitter numera PÅ köp-knappen (eget chip) i stället för på en egen rad.
  const pris = `<span class="buy-pris">${coinIcon(15)} ${it.price}</span>`;
  let btn;
  if (it.comingSoon) {
    btn = `<button class="buy-btn nej" disabled title="Snart kläcks nya vänner här!">🔒 Kommer snart</button>`;
  } else if (upLocked) {
    btn = `<button class="buy-btn nej" disabled title="Köp föregående uppgradering först">🔒 ${pris}</button>`;
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
  else if (farmAnimal) have = state.farmAnimalCounts[it.id] || 0;
  else if (multi) have = multiCount(it.id, state);
  const antal = rebuyable && !box ? `<div class="shop-antal">Du har: ${have} st</div>` : "";
  return `<div class="shop-card${owned ? " is-owned" : ""}">
    <div class="shop-emoji">${bild}</div>
    <div class="shop-namn">${it.name}</div>
    ${antal}
    ${btn}
  </div>`;
}
