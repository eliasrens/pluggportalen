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
import { app, el, go, loading, renderTopbar, pageError, flash } from "./ui.js";
import { CATEGORIES, getItem, itemsInCategory } from "./shop-items.js";
import { wearableSvg } from "./art-wearables.js";
import { itemSvg, categorySvg } from "./art-items.js";

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
  };

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel shop-head">
      <div>
        <h1>Shoppen 🛍️</h1>
        <p class="hint">Köp saker för dina pluggcoins. Kläder sätter du på din figur,
          möbler och husdjur placerar du i <b>Mitt rum</b>.</p>
      </div>
      <div class="shop-saldo">Ditt saldo<br /><span class="coins" id="saldo">🪙 ${state.coins}</span></div>
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

  view.querySelector("#back").addEventListener("click", () => go("#/elev/hem"));
  view.querySelector("#to-rum").addEventListener("click", () => go("#/elev/rum"));

  // Ett köp-klick (delegerat). Knappen låses direkt så dubbelklick inte kan
  // trigga två köp; buyItem() i datamodulen är dessutom en transaktion.
  katalog.addEventListener("click", async (e) => {
    const btn = e.target.closest(".buy-btn");
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    const item = getItem(id);
    if (!item || state.owned.has(id)) return;

    btn.disabled = true;
    btn.textContent = "Köper…";
    try {
      // Ägget/värmelampan sätter även studentData.pet (kläckningsklockan) och
      // köps därför via data-pet.js – i övrigt samma transaktionsmönster.
      let res;
      if (item.id === EGG_ITEM_ID) res = await buyEgg(item.price);
      else if (item.id === LAMP_ITEM_ID) res = await buyHeatLamp(item.price);
      else res = await data.buyItem(item.id, item.price);
      state.coins = res.coins;
      state.owned = new Set(res.owned);
      saldoEl.textContent = `🪙 ${state.coins}`;
      renderKatalog();
      if (res.ok) {
        await renderTopbar(); // uppdatera saldot i sidhuvudet
        if (item.id === EGG_ITEM_ID) {
          flash(`Du köpte ett mystiskt ägg! 🥚 Se det på sidan Mitt husdjur.`);
        } else if (item.id === LAMP_ITEM_ID) {
          flash(`Du köpte en värmelampa! 🔦 Nu kläcks ägget dubbelt så snabbt.`);
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
  const owned = state.owned.has(it.id);
  const affordable = state.coins >= it.price;
  let btn;
  if (owned) {
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
  return `<div class="shop-card${owned ? " is-owned" : ""}">
    <div class="shop-emoji">${bild}</div>
    <div class="shop-namn">${it.name}</div>
    <div class="shop-pris">🪙 ${it.price}</div>
    ${btn}
  </div>`;
}
