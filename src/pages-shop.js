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
import { CATEGORIES, getItem, itemsInCategory, isConsumable, isAnimalItem } from "./shop-items.js";
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
    owned: new Set(sd.ownedItems || []),
    appleCount: sd.appleCount || 0, // förbrukningsvara: antal, inte "ägd"
    // Vanliga djur bor i roomAnimals (inte ownedItems) – ett per art.
    animals: new Set(animalsFromData(sd).map((a) => a.id)),
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
    // Förbrukningsvaror (äpplen) kan köpas hur många gånger som helst; övriga
    // saker bara om de inte redan ägs.
    if (!item || item.comingSoon) return;
    if (!isConsumable(id) && (state.owned.has(id) || state.animals.has(id))) return;

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
      if (res.animals) state.animals = new Set(res.animals.map((a) => a.id));
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
        } else if (item.category === "hus") {
          flash(`Du köpte ${item.name}! ${item.emoji} Byt till det via 🏠 Nytt hus i din husvärld.`);
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

/** HTML för ett shop-kort, med rätt knappläge utifrån ägande/saldo. */
function shopCardHtml(it, state) {
  const consumable = isConsumable(it.id);
  // Förbrukningsvaror "ägs" aldrig – de har ett antal och kan alltid köpas fler.
  // Vanliga djur "ägs" när de bor i rummet (roomAnimals) – ett per art.
  const owned = !consumable && (state.owned.has(it.id) || state.animals.has(it.id));
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
  // Förbrukningsvaror visar hur många man redan har i stället för "Köpt".
  const antal = consumable
    ? `<div class="shop-antal">Du har: ${state.appleCount} st</div>`
    : "";
  return `<div class="shop-card${owned ? " is-owned" : ""}">
    <div class="shop-emoji">${bild}</div>
    <div class="shop-namn">${it.name}</div>
    <div class="shop-pris">${coinIcon(16)} ${it.price}</div>
    ${antal}
    ${btn}
  </div>`;
}
