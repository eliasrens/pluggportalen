// ============================================================================
// Pluggporten – laggårdens "🧰 Verktyg"-panel (issue #359)
// ----------------------------------------------------------------------------
// Verktyg INNE i laggården: välj vilka bondgårdsdjur som ska stå i ladan +
// mata dem – utan att behöva gå hem till rummets "Mina djur". Panelen är RENT
// ÅTERBRUK av befintlig mekanik:
//
//   * Placeringen går via RUMMETS kontroller (rum-gettern → listFarmDjur/
//     placeraFarmDjur i varld-rum.js, samma väg som Mina djur-raderna) – så
//     rummets in-memory-djurlista, scenen och Mina djur-lådan hålls i synk
//     direkt, och lad-taket (#333 barnPlaceCountForLevel) ger samma snälla
//     "Ladan är full"-flash. Raderna återanvänder .djurtray-farm-*-CSS:en.
//   * Matningen öppnar foder-panelen (#332, varld-foder.js oppna) – exakt
//     samma panel som ett klick på djuret i ladan.
//
// Knapp + panel monteras i .varld-ui-topp/.varld-ui (mountLadaSkin-mönstret,
// #353) och visas BARA på laggard-nivån (varld-gard.js anropar visa(nivaId)
// vid varje nivåbyte); .varld-panel → pages-varld.js stangPaneler() stänger
// den vid nivåbyten som alla andra. Ingen ny CSS behövs.
//
// OBS BOOTGRAFEN (incident #271): modulen importeras BARA av varld-gard.js
// (som själv är dynamisk) – håll den utanför statiska bootkedjor.
// ============================================================================

import { el } from "./ui.js";

/** Platsvalen (samma ordning/etiketter som Mina djur, varld-rum-djurtray.js). */
const PLATSER = [
  { id: "room", label: "🛏️ Rummet" },
  { id: "paddock", label: "🌾 Hagen" },
  { id: "barn", label: "🏠 Ladan" },
];

/**
 * Montera laggårdens Verktyg (EN gång, från varld-gard.js bygg()).
 *
 * @param {object} o
 * @param {HTMLElement} o.stage  scenen (.varld-stage) med .varld-ui/.varld-ui-topp
 * @param {() => object|null} o.rum  getter till rums-kontrollern (pages-varld.js
 *        rumCtl): listFarmDjur/placeraFarmDjur/farmBarnCap (varld-rum.js, #359)
 * @param {(uid: string, namn: string) => void} o.oppnaFoder  öppna foder-panelen
 *        (#332) för ett djur i ladan (varld-foder.js oppna)
 * @param {() => void} [o.onPlaced]  körs när en flytt SPARATS (rita om djuren
 *        i hagen/ladan – gard-djur.js läser placeringen färskt ur Firestore)
 * @returns {{ visa: (nivaId: string) => void, stang: () => void }}
 */
export function mountLadaVerktyg({ stage, rum, oppnaFoder, onPlaced }) {
  const ui = stage.querySelector(".varld-ui");
  const btn = el(`<button class="varld-knapp" id="lada-verktyg-btn" hidden
    title="Välj vilka djur som bor i ladan och mata dem">🧰 <span>Verktyg</span></button>`);
  (ui.querySelector(".varld-ui-topp") || ui).appendChild(btn);
  const panel = el(`<div class="varld-panel" id="panel-lada-verktyg" hidden>
    <button type="button" class="varld-panel-stang" aria-label="Stäng panelen">✕</button>
    <h3>Ladan 🧰</h3>
    <p class="hint" id="lada-verktyg-hint"></p>
    <div class="room-tray" id="ladaverktygtray"></div>
  </div>`);
  ui.appendChild(panel);
  const hint = panel.querySelector("#lada-verktyg-hint");
  const tray = panel.querySelector("#ladaverktygtray");

  function stang() {
    panel.hidden = true;
  }
  panel.querySelector(".varld-panel-stang").addEventListener("click", stang);

  /** Rita om raderna ur rummets färska in-memory-tillstånd (synkront). */
  function rita() {
    const ctl = rum?.();
    if (!ctl) {
      hint.textContent = "Djuren kunde inte hämtas just nu.";
      tray.replaceChildren();
      return;
    }
    const djur = ctl.listFarmDjur();
    const iLadan = djur.filter((d) => d.location === "barn").length;
    if (djur.length === 0) {
      hint.textContent = "Inga bondgårdsdjur än – köp häst, ko eller gris i shoppen! 🛍️";
      tray.replaceChildren();
      return;
    }
    hint.textContent = `Välj vilka djur som bor i ladan – ${iLadan} av ${ctl.farmBarnCap()} platser används. Djur i ladan kan matas här!`;
    tray.replaceChildren(...djur.map((d) => {
      // Samma rad-UI som Mina djur (#330): konst + namn + tre platsval, aktivt
      // val ifylld/disabled. Djur i ladan får dessutom en "🧺 Mata"-knapp.
      const knappar = PLATSER.map((p) => `<button class="btn liten${p.id === d.location ? "" : " ghost"}"
          data-plats-id="${d.id}" data-plats-loc="${p.id}" type="button"
          ${p.id === d.location ? 'aria-pressed="true" disabled' : 'aria-pressed="false"'}>${p.label}</button>`)
        .join("");
      const mata = d.location === "barn"
        ? `<button class="btn liten gron" data-mata-id="${d.id}" data-mata-namn="${d.name}"
            type="button" title="Mata ${d.name}">🧺 Mata</button>`
        : "";
      return el(`<div class="djurtray-farm-rad" title="${d.name}">
        <span class="tray-emoji">${d.artHtml}</span>
        <span class="tray-namn">${d.name}</span>
        <span class="djurtray-farm-val">${knappar}${mata}</span>
      </div>`);
    }));
  }

  tray.addEventListener("click", (e) => {
    const mata = e.target.closest("[data-mata-id]");
    if (mata) {
      // En panel åt gången: Verktyg stängs, foder-panelen (#332) tar över.
      stang();
      oppnaFoder(mata.dataset.mataId, mata.dataset.mataNamn);
      return;
    }
    const val = e.target.closest("[data-plats-id]");
    if (!val) return;
    // Rummets placerings-mekanik (varld-rum.js): uppdaterar rummet + Mina djur
    // och flashar själv ("Ladan är full" vid #333-taket). Raderna ritas om
    // direkt (in-memory); scenens djur ritas om först när skrivningen landat
    // (spar-löftet) – gard-djur.js läser placeringen ur Firestore.
    const sparat = rum?.()?.placeraFarmDjur(val.dataset.platsId, val.dataset.platsLoc);
    if (!sparat) return;
    rita();
    Promise.resolve(sparat).then(() => onPlaced?.());
  });

  btn.addEventListener("click", () => {
    if (!panel.hidden) return stang();
    panel.hidden = false;
    rita();
  });

  /** Visa/dölj triggern per nivå – knappen hör bara hemma inne i laggården. */
  function visa(nivaId) {
    const pa = nivaId === "laggard";
    btn.hidden = !pa;
    if (!pa) stang();
  }

  return { visa, stang };
}
