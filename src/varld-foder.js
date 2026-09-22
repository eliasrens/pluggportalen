// ============================================================================
// Pluggporten – mata bondgårdsdjuren med skörden (issue #332)
// ----------------------------------------------------------------------------
// UI:t för foder-bryggan odling → djur: eleven ger skördad gröda ur
// farm.inventoryHarvest till ett bondgårdsdjur. Ett klick på djuret i hagen/
// ladan (mountFoder, delegat som laggårdsdörren) öppnar foder-panelen
// (.varld-panel, samma UI som odlingens frö-panel); i RUMMET återanvänds samma
// innehåll (foderInnehall) inuti djurets namn-panel via dynamisk import från
// varld-rum.js. All balanslogik bor i farm-core.js (feedFarmAnimalIn/
// trivselNow/claimGiftIn) och skrivs av data-farm.js – här är det bara DOM.
//
//   * Rätt gröda (FODER_FOR) → +25 trivsel FÖRSTA matningen per dag, annars
//     bara hjärtan (snällt: ingen skuld, extra matningar är fortfarande mysiga).
//   * Fel gröda → förbrukas INTE, bara en vänlig hint om favoritmaten.
//   * Trivsel ≥ 60 → 🎁-badge på djuret; gåvan (mynt) hämtas här, 1 gång/dygn.
//   * Hjärtan (hjartFx) poppar på djur-noden – samma anda som pet-klapp-fx.
//
// OBS BOOTGRAFEN (#271): modulen importeras BARA dynamiskt/av dynamiska moduler
// (varld-gard.js, import() i varld-rum.js) – håll den utanför statiska kedjor.
// ============================================================================

import { el, flash } from "./ui.js";
import { CROPS } from "./art-garden.js";
import { getItem } from "./shop-items.js";
import { getFarm, feedFarmAnimal, claimFarmAnimalGift } from "./data-farm.js";
import {
  trivselNow,
  giftReadyIn,
  moodForTrivsel,
  FODER_FOR,
  FEED_TRIVSEL,
  FARM_GIFT_COINS,
} from "./farm-core.js";
import { farmMoodSvg } from "./art-pets.js";
import { confetti } from "./fx.js";

/** Djur-noden i den scen som råkar vara uppe (rummet, hagen eller ladan). */
function djurNod(uid) {
  return document.querySelector(`.room-pet[data-pet-id="${uid}"]`);
}

/**
 * Hjärt-puff på djurets nod: tre små hjärtan som stiger och tonar bort –
 * samma inline-stil/animation som pet-klapp-fx (pet-rygg-fx-keyframes).
 */
export function hjartFx(uid) {
  const node = djurNod(uid);
  if (!node) return;
  for (let i = 0; i < 3; i++) {
    const fx = el(`<span class="foder-hjarta" style="animation-delay:${i * 0.22}s;margin-left:${(i - 1) * 12}px">💚</span>`);
    node.appendChild(fx);
    setTimeout(() => fx.remove(), 1600 + i * 220);
  }
}

/** Uppdatera mood-minen + 🎁-badgen på djurets scen-nod utifrån färsk data. */
export function uppdateraDjurNod(animal) {
  const node = djurNod(animal.uid);
  if (!node) return;
  const mood = node.querySelector(".fdjur-mood");
  if (mood) mood.innerHTML = farmMoodSvg(moodForTrivsel(trivselNow(animal)));
  giftBadge(node, giftReadyIn(animal));
}

/** Sätt/ta bort 🎁-badgen (gåva redo) på en djur-nod. */
export function giftBadge(node, redo) {
  let badge = node.querySelector(".fdjur-gava");
  if (redo && !badge) node.appendChild(el(`<span class="fdjur-gava" title="En gåva väntar!">🎁</span>`));
  else if (!redo && badge) badge.remove();
}

/**
 * Foder-sektionens innehåll för ETT bondgårdsdjur: trivsel-mätare, gåvo-rad och
 * gröd-knappar ur skörde-förrådet. Elementet laddar sitt eget tillstånd
 * (getFarm, färskt – cachen invalideras av varje matning/gåva) och ritar om sig
 * själv efter varje handling. Delas av gårds-panelen (mountFoder) och rummets
 * namn-panel (dynamisk import i varld-rum.js).
 *
 * @param {string} uid  djurets instans-id (farm.animals[].uid)
 * @param {object} [o]
 * @param {(animal: object) => void} [o.onChanged]  färskt djur efter matning/gåva
 * @returns {HTMLElement}
 */
export function foderInnehall(uid, { onChanged } = {}) {
  const rot = el(`<div class="foder-sektion"><p class="hint">Hämtar förrådet… 🧺</p></div>`);
  let upptagen = false;

  async function rita() {
    const farm = await getFarm();
    const a = farm.animals.find((x) => x.uid === uid);
    if (!a) {
      rot.replaceChildren(el(`<p class="hint">Djuret hittades inte just nu.</p>`));
      return;
    }
    const item = getItem(a.id);
    const namn = a.name || (item ? item.name : "Djuret");
    const trivsel = trivselNow(a);
    const favId = FODER_FOR[a.id];
    const fav = CROPS[favId];
    const redo = giftReadyIn(a);
    const forrad = Object.entries(farm.inventoryHarvest).filter(([id]) => CROPS[id]);

    // Gåvo-raden: knapp när den är redo, annars en SNÄLL statusrad (aldrig skuld).
    const gava = redo
      ? `<button class="btn liten gron" id="foder-gava">🎁 Hämta dagens gåva (+${FARM_GIFT_COINS} mynt)</button>`
      : trivsel >= 60
        ? `<p class="hint">🎁 Dagens gåva är hämtad – ${namn} har säkert en ny i morgon!</p>`
        : `<p class="hint">💚 Mata ${namn} med ${fav ? fav.name.toLowerCase() + " " + fav.emoji : "favoritmaten"} så blir det snart gåvor!</p>`;

    const knappar = forrad.map(([id, n]) => {
      const meta = CROPS[id];
      const arFav = id === favId;
      return `<button class="tray-item${arFav ? " foder-fav" : ""}" data-mata="${id}"
        title="${arFav ? `${namn}s favoritmat!` : `${meta.name} – mat till ${meta.mat}`}">
        <span class="tray-emoji">${meta.emoji}</span>
        <span class="tray-namn">${meta.name} ×${n}${arFav ? " ⭐" : ""}</span>
      </button>`;
    }).join("");

    rot.replaceChildren(el(`<div>
      <p class="foder-trivsel-rad"><span class="foder-mood">${farmMoodSvg(moodForTrivsel(trivsel))}</span>
        Trivsel: <b>${trivsel}</b> av 100</p>
      <div class="pet-matbar"><div class="pet-matbar-fyll" style="width:${trivsel}%"></div></div>
      <p class="hint">${fav ? `${namn} älskar ${fav.name.toLowerCase()} ${fav.emoji} – en om dagen håller humöret på topp!` : ""}</p>
      <div id="foder-gava-rad">${gava}</div>
      ${forrad.length
        ? `<div class="room-tray foder-tray">${knappar}</div>`
        : `<p class="hint">Förrådet är tomt – så och skörda grödor i odlingsbädden på gården! 🌱</p>`}
    </div>`));

    uppdateraDjurNod(a);

    rot.querySelector("#foder-gava")?.addEventListener("click", async () => {
      if (upptagen) return;
      upptagen = true;
      try {
        const res = await claimFarmAnimalGift(uid);
        if (res.ok) {
          confetti();
          flash(`🎁 ${namn} ger dig en gåva: +${res.coins} mynt! 💰`);
          onChanged?.(res.animal);
        } else {
          flash("Gåvan gick inte att hämta just nu.", true);
        }
      } catch (err) {
        flash("Kunde inte hämta gåvan: " + err.message, true);
      } finally {
        upptagen = false;
        rita().catch(() => {});
      }
    });

    for (const btn of rot.querySelectorAll("[data-mata]")) {
      btn.addEventListener("click", async () => {
        if (upptagen) return;
        upptagen = true;
        const cropId = btn.dataset.mata;
        try {
          const res = await feedFarmAnimal(uid, cropId);
          if (res.ok) {
            hjartFx(uid);
            const m = CROPS[cropId];
            flash(res.gavTrivsel
              ? `${namn} mumsar ${m ? m.name.toLowerCase() : "gott"} ${m ? m.emoji : ""} +${FEED_TRIVSEL} trivsel! 💚`
              : `${namn} mumsar glatt! 💚 (Ny trivsel i morgon – magen är nöjd för idag.)`);
            onChanged?.(res.animal);
          } else if (res.error === "fel gröda") {
            // Snäll fallback: inget förbrukas, bara en hint om favoriten.
            flash(`${namn} nosar lite… men vill helst ha ${fav ? fav.name.toLowerCase() + " " + fav.emoji : "sin favoritmat"}!`);
          } else {
            flash("Det gick inte att mata just nu.", true);
          }
        } catch (err) {
          flash("Kunde inte mata: " + err.message, true);
        } finally {
          upptagen = false;
          rita().catch(() => {});
        }
      });
    }
  }

  rita().catch(() => {
    rot.replaceChildren(el(`<p class="hint">Kunde inte hämta förrådet just nu.</p>`));
  });
  return rot;
}

/**
 * Montera foder-panelen för gårds-grenen: klick på ett bondgårdsdjur i hagen
 * (gård-nivån) eller ladan (laggård-nivån) öppnar panelen med foderInnehall.
 * Samma delegat-mönster som laggårdsdörren/odlingsslottarna i varld-gard.js.
 *
 * @param {object} o
 * @param {HTMLElement} o.stage         scenen (.varld-stage; läser data-niva)
 * @param {HTMLElement} o.gardLager     gårds-lagret (hagen)
 * @param {HTMLElement} o.laggardLager  laggårds-lagret (ladan)
 * @param {() => void} [o.onChanged]    efter matning/gåva (t.ex. rita om djuren)
 * @returns {{ stang: () => void }}
 */
export function mountFoder({ stage, gardLager, laggardLager, onChanged }) {
  const panel = el(`<div class="varld-panel" id="panel-foder" hidden>
    <button type="button" class="varld-panel-stang" aria-label="Stäng panelen">✕</button>
    <h3 id="foder-titel">Mata djuret</h3>
    <div id="foder-kropp"></div>
  </div>`);
  stage.querySelector(".varld-ui").appendChild(panel);
  panel.querySelector(".varld-panel-stang").addEventListener("click", stang);

  function stang() {
    panel.hidden = true;
  }

  function oppna(uid, namn) {
    panel.querySelector("#foder-titel").textContent = `Mata ${namn} 🧺`;
    const kropp = panel.querySelector("#foder-kropp");
    kropp.replaceChildren(foderInnehall(uid, { onChanged }));
    panel.hidden = false;
  }

  // Klick på ett djur i hagen (gård-nivån) resp. ladan (laggård-nivån).
  // Overlay-lagret är pointer-events:none; djur-noderna själva får klick via
  // .gard-djur-lager .gard-djur { pointer-events:auto } (styles.css, #332).
  for (const [lager, niva] of [[gardLager, "gard"], [laggardLager, "laggard"]]) {
    lager.addEventListener("click", (e) => {
      if (stage.dataset.niva !== niva) return;
      const nod = e.target.closest(".gard-djur");
      if (!nod) return;
      const uid = nod.dataset.petId;
      const namn = nod.querySelector(".rp-namn")?.textContent || "djuret";
      oppna(uid, namn);
    });
    // Tangentbord: Enter/Space på ett fokuserat djur = klick (som laggårdsdörren).
    lager.addEventListener("keydown", (e) => {
      const nod = e.target.closest(".gard-djur");
      if ((e.key === "Enter" || e.key === " ") && nod) {
        e.preventDefault();
        nod.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });
  }

  return { stang };
}
