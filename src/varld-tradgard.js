// ============================================================================
// Pluggporten – trädgården: köpbara utomhussaker runt huset (issue #132)
// ----------------------------------------------------------------------------
// Monterar ett placerings-lager OVANPÅ ute-scenen (art-hus-ute.js, #ute-lager i
// pages-varld.js) där eleven ställer ut träd, buskar, blomrabatter, en
// parkeringsruta och fordon som köpts i shopens nya "Trädgård & utomhus"-
// kategori. Mekaniken ÅTERANVÄNDER rummets placerings-idé (varld-rum.js): saker
// är .garden-item, absolut-positionerade i procent av scenen, center-ankrade,
// dragbara med pointer-events + pointer capture, valbara (🗑️ tas bort). Platta
// saker (isFlatItem: rabatt/parkering) ritas UNDER övriga så fordon/träd staplas
// ovanpå dem – samma painter-order-regel som mattorna i rummet.
//
// TVÅ SCENER (#356): samma motor driver nu även GÅRDEN (baksidan, #gard-lager)
// – en "🧰 Verktyg"-knapp uppe till höger på gård-nivån (samma mönster som
// "🛖 Ny lada", varld-lada-skin.js) öppnar en låda med samma ägda saker och
// placerar dem i gårds-scenen. En placering bär då `scen: "gard"` (saknas
// fältet = framsidan, bakåtkompatibelt); ägande-räkningen delas över scenerna
// så man aldrig kan ställa ut fler exemplar än man äger. Gårds-lagret måste
// ÅTERSKAPAS efter varje scen-ombyggnad (bygg()/lada-skin-byte i varld-gard.js
// skriver innerHTML) – därför sakraLager + gardRita-kroken.
//
// Z-LAGER: designsystemets scen-tokens (--z-scen-*), inte hårdkodade z-index.
// Placerade saker ligger på --z-scen-markor; den sak som dras lyfts till
// --z-scen-drag (samma som room-item.dragging). Lagret självt är pointer-
// events:none så klick på tom gräsmatta/huset (eller laggårds-dörren på
// gården) går vidare till scenen, medan varje sak sätter pointer-events:auto.
//
// PERSISTENS: studentData.garden.placements (data-room.js getGardenFrom/
// saveGarden), skilt från rummet (studentData.room) och bakåtkompatibelt –
// saknas fältet är trädgården tom. Nyckeln är sak-id ("trad") eller "<id>#<n>"
// för extra exemplar, precis som rummets placements.
// ============================================================================

import { el, clamp } from "./ui.js";
import { getItem, isGardenItem, isFlatItem, isSeedItem, itemIdFromKey } from "./shop-items.js";
import { itemSvg, itemSize } from "./art-items.js";
import * as data from "./data.js";

// Spridningsmönster för nyplacerade saker: punkter på gräset (i % av scenen),
// utspridda i gården nedanför/kring huset så de inte hamnar i en hög. Center-
// ankrade saker (translate(-50%,-50%)), så y ligger en bit ner (mark).
const SPREAD = [
  { x: 20, y: 78 }, { x: 80, y: 80 }, { x: 33, y: 70 }, { x: 68, y: 72 },
  { x: 12, y: 86 }, { x: 88, y: 88 }, { x: 50, y: 84 }, { x: 26, y: 90 },
];

// Gårds-scenens lediga gräs (#356): mittbandet mellan horisonten (~50 %) och
// zonernas överkant (~72 %) + remsan framför odlingsbädden/hagen. Undviker
// odlingsbädden (v), hagen (mitten), laggården (h) och trädet i bakkanten.
const GARD_SPREAD = [
  { x: 18, y: 62 }, { x: 46, y: 64 }, { x: 32, y: 58 }, { x: 58, y: 60 },
  { x: 12, y: 68 }, { x: 40, y: 93 }, { x: 14, y: 93 }, { x: 60, y: 93 },
];

/**
 * Montera trädgårds-lagret + lådan (och ev. gårdens Verktyg-låda, #356).
 * @param {object} o
 * @param {HTMLElement} o.uteLager  ute-scenens lager (#ute-lager) – lagret läggs in här
 * @param {HTMLElement} o.tray      lådan i panelen (owned saker att placera)
 * @param {HTMLElement} o.trayHint  hint-texten ovanför lådan
 * @param {object}      o.sd        studentData (läses för ägande + start-placeringar)
 * @param {{stage: HTMLElement, lager: HTMLElement}} [o.gard]  gårds-scenen (#356):
 *        stage = .varld-stage (för .varld-ui – knapp/panel monteras där),
 *        lager = #gard-lager (placerings-lagret återskapas i det vid behov).
 * @returns {{ render: () => void, gardVisa: (nivaId: string) => void,
 *   gardRita: () => void }} kontroll-API (render ritar om lager + lådor;
 *   gardVisa/gardRita anropas av gårds-grenen, se varld-gard.js)
 */
export function mountTradgard({ uteLager, tray, trayHint, sd, gard }) {
  // Ägda trädgårdssaker (id:n). ownedCounts/ownedItems via samma ownedCount.
  // Fröer (isSeedItem, #329) är tradgard-kategori men sås i gårdens odlingsbädd
  // – de ska aldrig dyka upp som placerbara trädgårdssaker här.
  const owned = (sd.ownedItems || []).filter((id) => isGardenItem(id) && !isSeedItem(id) && getItem(id));

  // Placeringarna (levande arbetskopia). Rensa bort ej-ägda/okända saker och
  // klampa in gamla lägen – samma defensiva filter som rummets filterPlacements.
  // `scen: "gard"` (#356) följer med; allt annat/saknat = framsidan ("ute").
  const saved = data.getGardenFrom(sd).placements;
  const placements = {};
  for (const [key, pos] of Object.entries(saved)) {
    const id = itemIdFromKey(key);
    if (pos && data.ownedCount(sd, id) > 0 && isGardenItem(id)) {
      placements[key] = {
        x: clamp(pos.x, 3, 97), y: clamp(pos.y, 8, 96),
        ...(pos.scen === "gard" ? { scen: "gard" } : {}),
      };
    }
  }

  let selectedKey = null;

  /** Vilken scen hör en placering till? (saknat scen-fält = framsidan) */
  const scenFor = (key) => (placements[key]?.scen === "gard" ? "gard" : "ute");

  // Scenerna: framsidans trädgård alltid; gården bara när pages-varld.js
  // skickar in den. Gårds-lagret skapas LAT (första gårds-besöket) och
  // återskapas när gårds-scenens innerHTML skrivits om (sakraLager).
  const scener = {
    ute: { id: "ute", host: uteLager, layer: null, spread: SPREAD },
    ...(gard ? { gard: { id: "gard", host: gard.lager, layer: null, spread: GARD_SPREAD } } : {}),
  };

  /** Se till att scenens placerings-lager finns kvar i DOM:en (annars nytt). */
  function sakraLager(scen) {
    if (scen.layer && scen.layer.isConnected) return;
    scen.layer = el(`<div class="tradgard-lager" aria-label="${
      scen.id === "gard" ? "Trädgårdssaker på gården" : "Din trädgård"}"></div>`);
    bindLager(scen);
    scen.host.appendChild(scen.layer);
  }

  // --- Hur många exemplar är kvar att placera av en sak? --------------------
  // Räknas över BÅDA scenerna – ägandet är gemensamt.
  function placedCount(id) {
    return Object.keys(placements).filter((k) => itemIdFromKey(k) === id).length;
  }
  function remainingToPlace(id) {
    return data.ownedCount(sd, id) - placedCount(id);
  }

  // Unik placerings-nyckel: rent id först, sedan "<id>#2", "<id>#3" …
  function makeKey(id) {
    if (!(id in placements)) return id;
    let n = 2;
    while (`${id}#${n}` in placements) n++;
    return `${id}#${n}`;
  }

  // Nästa lediga standard-spot i scenen (roterar genom scenens spridning).
  function nextSpot(scen) {
    const n = Object.keys(placements).filter((k) => scenFor(k) === scen.id).length;
    return scen.spread[n % scen.spread.length];
  }

  // --- Rendering ------------------------------------------------------------
  function renderLayer(scen) {
    if (!scen || !scen.layer) return; // gården ej besökt än – inget att rita
    scen.layer.replaceChildren();
    // Platta saker (rabatt/parkering) först → övriga staplas ovanpå dem.
    const keys = Object.keys(placements)
      .filter((k) => scenFor(k) === scen.id)
      .sort((a, b) => (isFlatItem(itemIdFromKey(a)) ? 0 : 1) - (isFlatItem(itemIdFromKey(b)) ? 0 : 1));
    for (const key of keys) {
      const id = itemIdFromKey(key);
      const item = getItem(id);
      if (!item) continue;
      const pos = placements[key];
      const size = itemSize(id);
      // Storleken skalar med scenBREDDEN (1cqw = 1 % av lagret), cap:ad per enhet
      // – skrivs DIREKT här (Chromium resolvar annars cqw mot fel container).
      scen.layer.appendChild(el(`<div class="garden-item${selectedKey === key ? " selected" : ""}"
        data-key="${key}" style="left:${pos.x}%;top:${pos.y}%" title="${item.name}">
        <span class="gi-bild" style="width:calc(${size.w} * min(var(--gard-koeff, 2.4) * 1cqw, var(--gard-cap, 34px)));height:calc(${size.h} * min(var(--gard-koeff, 2.4) * 1cqw, var(--gard-cap, 34px)))">${itemSvg(id) || item.emoji}</span>
        <button class="gi-remove" data-remove="${key}" title="Plocka bort">🗑️</button>
      </div>`));
    }
  }

  function renderTrayIn(trayEl, hintEl, scenId) {
    trayEl.replaceChildren();
    const notPlaced = owned.filter((id) => remainingToPlace(id) > 0);
    if (owned.length === 0) {
      hintEl.textContent = "Du har inga utomhussaker än. Köp träd, buskar och fordon i shoppen! 🌳";
    } else if (notPlaced.length === 0) {
      hintEl.textContent = "Allt du äger står redan ute. 🎉";
    } else {
      hintEl.textContent = scenId === "gard"
        ? "Klicka på en sak för att ställa ut den på gården."
        : "Klicka på en sak för att ställa ut den i trädgården.";
    }
    for (const id of notPlaced) {
      const item = getItem(id);
      const rem = remainingToPlace(id);
      const namn = rem > 1 ? `${item.name} (${rem})` : item.name;
      trayEl.appendChild(el(`<button class="tray-item" data-place="${id}" title="${item.name}">
        <span class="tray-emoji">${itemSvg(id) || item.emoji}</span>
        <span class="tray-namn">${namn}</span>
      </button>`));
    }
  }

  function renderTrays() {
    renderTrayIn(tray, trayHint, "ute");
    if (gardUi) renderTrayIn(gardUi.tray, gardUi.hint, "gard");
  }

  function render() {
    renderLayer(scener.ute);
    renderLayer(scener.gard);
    renderTrays();
  }

  // --- Sparning (debounce, samma mönster som rummets scheduleSaveRoom) ------
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      data.saveGarden({ placements }).catch(() => {});
    }, 250);
  }

  // --- Placera en sak ur en låda (delas av båda scenernas trays) ------------
  function bindTray(trayEl, scen) {
    trayEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-place]");
      if (!btn) return;
      const id = btn.dataset.place;
      if (remainingToPlace(id) <= 0) return;
      const spot = nextSpot(scen);
      placements[makeKey(id)] = {
        x: spot.x, y: spot.y,
        ...(scen.id === "gard" ? { scen: "gard" } : {}),
      };
      sakraLager(scen);
      render();
      scheduleSave();
    });
  }
  bindTray(tray, scener.ute);

  // --- Ta bort / dra-och-släpp per scen-lager -------------------------------
  // Samma pipeline som rummet: pointerdown fångar saken, pointermove clampar
  // hela saken innanför scenen (center-ankrad → halva bredden/höjden som
  // marginal), pointerup sparar om den flyttades, annars = klick → markera/
  // avmarkera. Binds om varje gång ett lager (åter)skapas – gamla lager
  // slängs med sina lyssnare när scenen skrivits om.
  function bindLager(scen) {
    const layer = scen.layer;
    layer.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-remove]");
      if (!rm) return;
      delete placements[rm.dataset.remove];
      selectedKey = null;
      render();
      scheduleSave();
    });

    let drag = null;
    layer.addEventListener("pointerdown", (e) => {
      const node = e.target.closest(".garden-item");
      if (!node || e.target.closest("[data-remove]")) return;
      const rect = layer.getBoundingClientRect();
      drag = {
        key: node.dataset.key, node, rect, moved: false,
        startX: e.clientX, startY: e.clientY,
        halfW: ((node.offsetWidth / rect.width) * 100) / 2,
        halfH: ((node.offsetHeight / rect.height) * 100) / 2,
      };
      node.setPointerCapture(e.pointerId);
      node.classList.add("dragging");
    });

    layer.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3) {
        drag.moved = true;
      }
      const x = clamp(((e.clientX - drag.rect.left) / drag.rect.width) * 100, drag.halfW, 100 - drag.halfW);
      const y = clamp(((e.clientY - drag.rect.top) / drag.rect.height) * 100, drag.halfH, 100 - drag.halfH);
      // Muteras (inte ersätts) så scen-fältet följer med placeringen.
      Object.assign(placements[drag.key], { x, y });
      drag.node.style.left = x + "%";
      drag.node.style.top = y + "%";
    });

    function endDrag() {
      if (!drag) return;
      drag.node.classList.remove("dragging");
      if (drag.moved) {
        scheduleSave();
      } else {
        // Klick (ingen förflyttning) → markera/avmarkera (visar 🗑️).
        selectedKey = selectedKey === drag.key ? null : drag.key;
        renderLayer(scen);
      }
      drag = null;
    }
    layer.addEventListener("pointerup", endDrag);
    layer.addEventListener("pointercancel", endDrag);
  }

  // --- Gårdens "🧰 Verktyg"-låda (#356) -------------------------------------
  // Knapp + panel uppe till höger på gård-nivån – exakt samma mönster som
  // "🛖 Ny lada" (varld-lada-skin.js): monteras i .varld-ui-topp/.varld-ui och
  // visas bara av gårds-grenen (gardVisa). Panelen är en .varld-panel →
  // pages-varld.js stangPaneler() stänger den vid nivåbyten som alla andra.
  let gardUi = null;
  if (gard) {
    const ui = gard.stage.querySelector(".varld-ui");
    const btn = el(`<button class="varld-knapp" id="gard-verktyg-btn" hidden
      title="Ställ ut dina trädgårdssaker på gården">🧰 <span>Verktyg</span></button>`);
    (ui.querySelector(".varld-ui-topp") || ui).appendChild(btn);
    const panel = el(`<div class="varld-panel" id="panel-gard-verktyg" hidden>
      <button type="button" class="varld-panel-stang" aria-label="Stäng panelen">✕</button>
      <h3>Verktyg 🧰</h3>
      <p class="hint" id="gard-verktyg-hint"></p>
      <div class="room-tray" id="gardverktygtray"></div>
    </div>`);
    ui.appendChild(panel);
    panel.querySelector(".varld-panel-stang").addEventListener("click", () => (panel.hidden = true));
    btn.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) renderTrays(); // färska antal varje öppning
    });
    gardUi = { btn, panel, tray: panel.querySelector("#gardverktygtray"), hint: panel.querySelector("#gard-verktyg-hint") };
    bindTray(gardUi.tray, scener.gard);
  }

  /** Nivåbyte i gårds-grenen: Verktyg-knappen hör bara hemma på gård-nivån. */
  function gardVisa(nivaId) {
    if (!gardUi) return;
    const pa = nivaId === "gard";
    gardUi.btn.hidden = !pa;
    if (!pa) gardUi.panel.hidden = true;
  }

  /** Rita (om) gårds-scenens saker – anropas efter varje scen-ombyggnad. */
  function gardRita() {
    if (!scener.gard) return;
    sakraLager(scener.gard);
    renderLayer(scener.gard);
  }

  sakraLager(scener.ute);
  render();
  return { render, gardVisa, gardRita };
}
