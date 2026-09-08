// ============================================================================
// Pluggportalen – trädgården: köpbara utomhussaker runt huset (issue #132)
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
// Z-LAGER: designsystemets scen-tokens (--z-scen-*), inte hårdkodade z-index.
// Placerade saker ligger på --z-scen-markor; den sak som dras lyfts till
// --z-scen-drag (samma som room-item.dragging). Lagret självt är pointer-
// events:none så klick på tom gräsmatta/huset går vidare till ute-scenen (gå in
// i huset), medan varje sak sätter pointer-events:auto.
//
// PERSISTENS: studentData.garden.placements (data-room.js getGardenFrom/
// saveGarden), skilt från rummet (studentData.room) och bakåtkompatibelt –
// saknas fältet är trädgården tom. Nyckeln är sak-id ("trad") eller "<id>#<n>"
// för extra exemplar, precis som rummets placements.
// ============================================================================

import { el, clamp } from "./ui.js";
import { getItem, isGardenItem, isFlatItem, itemIdFromKey } from "./shop-items.js";
import { itemSvg, itemSize } from "./art-items.js";
import * as data from "./data.js";

// Spridningsmönster för nyplacerade saker: punkter på gräset (i % av scenen),
// utspridda i gården nedanför/kring huset så de inte hamnar i en hög. Center-
// ankrade saker (translate(-50%,-50%)), så y ligger en bit ner (mark).
const SPREAD = [
  { x: 20, y: 78 }, { x: 80, y: 80 }, { x: 33, y: 70 }, { x: 68, y: 72 },
  { x: 12, y: 86 }, { x: 88, y: 88 }, { x: 50, y: 84 }, { x: 26, y: 90 },
];

/**
 * Montera trädgårds-lagret + lådan.
 * @param {object} o
 * @param {HTMLElement} o.uteLager  ute-scenens lager (#ute-lager) – lagret läggs in här
 * @param {HTMLElement} o.tray      lådan i panelen (owned saker att placera)
 * @param {HTMLElement} o.trayHint  hint-texten ovanför lådan
 * @param {object}      o.sd        studentData (läses för ägande + start-placeringar)
 * @returns {{ render: () => void }} kontroll-API (render ritar om lagret + lådan)
 */
export function mountTradgard({ uteLager, tray, trayHint, sd }) {
  // Ägda trädgårdssaker (id:n). ownedCounts/ownedItems via samma ownedCount.
  const owned = (sd.ownedItems || []).filter((id) => isGardenItem(id) && getItem(id));

  // Placeringarna (levande arbetskopia). Rensa bort ej-ägda/okända saker och
  // klampa in gamla lägen – samma defensiva filter som rummets filterPlacements.
  const saved = data.getGardenFrom(sd).placements;
  const placements = {};
  for (const [key, pos] of Object.entries(saved)) {
    const id = itemIdFromKey(key);
    if (pos && data.ownedCount(sd, id) > 0 && isGardenItem(id)) {
      placements[key] = { x: clamp(pos.x, 3, 97), y: clamp(pos.y, 8, 96) };
    }
  }

  // Placerings-lagret (ovanpå husScen-SVG:n). pointer-events:none → husklick/
  // gräsklick går vidare till scenen; varje sak slår på pointer-events själv.
  const layer = el(`<div class="tradgard-lager" aria-label="Din trädgård"></div>`);
  uteLager.appendChild(layer);

  let selectedKey = null;

  // --- Hur många exemplar är kvar att placera av en sak? --------------------
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

  // Nästa lediga standard-spot (roterar genom SPREAD efter antal placerade).
  function nextSpot() {
    return SPREAD[Object.keys(placements).length % SPREAD.length];
  }

  // --- Rendering ------------------------------------------------------------
  function renderLayer() {
    layer.replaceChildren();
    // Platta saker (rabatt/parkering) först → övriga staplas ovanpå dem.
    const keys = Object.keys(placements).sort(
      (a, b) => (isFlatItem(itemIdFromKey(a)) ? 0 : 1) - (isFlatItem(itemIdFromKey(b)) ? 0 : 1)
    );
    for (const key of keys) {
      const id = itemIdFromKey(key);
      const item = getItem(id);
      if (!item) continue;
      const pos = placements[key];
      const size = itemSize(id);
      // Storleken skalar med scenBREDDEN (1cqw = 1 % av lagret), cap:ad per enhet
      // – skrivs DIREKT här (Chromium resolvar annars cqw mot fel container).
      layer.appendChild(el(`<div class="garden-item${selectedKey === key ? " selected" : ""}"
        data-key="${key}" style="left:${pos.x}%;top:${pos.y}%" title="${item.name}">
        <span class="gi-bild" style="width:calc(${size.w} * min(var(--gard-koeff, 2.4) * 1cqw, var(--gard-cap, 34px)));height:calc(${size.h} * min(var(--gard-koeff, 2.4) * 1cqw, var(--gard-cap, 34px)))">${itemSvg(id) || item.emoji}</span>
        <button class="gi-remove" data-remove="${key}" title="Plocka bort">🗑️</button>
      </div>`));
    }
  }

  function renderTray() {
    tray.replaceChildren();
    const notPlaced = owned.filter((id) => remainingToPlace(id) > 0);
    if (owned.length === 0) {
      trayHint.textContent = "Du har inga utomhussaker än. Köp träd, buskar och fordon i shoppen! 🌳";
    } else if (notPlaced.length === 0) {
      trayHint.textContent = "Allt du äger står ute i trädgården. 🎉";
    } else {
      trayHint.textContent = "Klicka på en sak för att ställa ut den i trädgården.";
    }
    for (const id of notPlaced) {
      const item = getItem(id);
      const rem = remainingToPlace(id);
      const namn = rem > 1 ? `${item.name} (${rem})` : item.name;
      tray.appendChild(el(`<button class="tray-item" data-place="${id}" title="${item.name}">
        <span class="tray-emoji">${itemSvg(id) || item.emoji}</span>
        <span class="tray-namn">${namn}</span>
      </button>`));
    }
  }

  function render() {
    renderLayer();
    renderTray();
  }

  // --- Sparning (debounce, samma mönster som rummets scheduleSaveRoom) ------
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      data.saveGarden({ placements }).catch(() => {});
    }, 250);
  }

  // --- Placera en sak ur lådan ----------------------------------------------
  tray.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-place]");
    if (!btn) return;
    const id = btn.dataset.place;
    if (remainingToPlace(id) <= 0) return;
    const spot = nextSpot();
    placements[makeKey(id)] = { x: spot.x, y: spot.y };
    render();
    scheduleSave();
  });

  // --- Ta bort en placerad sak (🗑️) ----------------------------------------
  layer.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove]");
    if (!rm) return;
    delete placements[rm.dataset.remove];
    selectedKey = null;
    render();
    scheduleSave();
  });

  // --- Dra-och-släpp (pointer events, procentbaserat) -----------------------
  // Samma pipeline som rummet: pointerdown fångar saken, pointermove clampar
  // hela saken innanför scenen (center-ankrad → halva bredden/höjden som marginal),
  // pointerup sparar om den flyttades, annars = klick → markera/avmarkera.
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
    placements[drag.key] = { x, y };
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
      renderLayer();
    }
    drag = null;
  }
  layer.addEventListener("pointerup", endDrag);
  layer.addEventListener("pointercancel", endDrag);

  render();
  return { render };
}
