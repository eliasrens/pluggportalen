// ============================================================================
// Pluggportalen – Mitt rum
// ----------------------------------------------------------------------------
// Eleven placerar ut sina köpta saker (möbler/husdjur/dekor) i ett eget rum och
// sätter kläder på avataren. Placeringar sparas i procent av scenen → ser
// likadana ut oavsett skärm/dator. Allt sparas per elev i Firestore via
// datamodulen (saveRoom / saveAvatarItems).
// ============================================================================

import * as data from "./data.js";
import { app, el, go, loading, renderTopbar, pageError, flash, clamp } from "./ui.js";
import { getItem, isWearable } from "./shop-items.js";
import { wearableSvg } from "./art-wearables.js";
import { itemSvg } from "./art-items.js";

export async function pageElevRum() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  let sd;
  try {
    sd = await data.getStudentData();
  } catch (err) {
    return pageError("Kunde inte ladda ditt rum", err);
  }

  const owned = sd.ownedItems || [];
  // Behåll bara placeringar för saker eleven fortfarande äger och som hör hemma
  // i rummet (inte kläder). Positioner i procent (0–100) av scenen.
  const placements = {};
  const savedPlacements = (sd.room && sd.room.placements) || {};
  for (const [id, pos] of Object.entries(savedPlacements)) {
    if (owned.includes(id) && !isWearable(id) && pos) {
      placements[id] = { x: clamp(pos.x, 0, 100), y: clamp(pos.y, 0, 100) };
    }
  }

  // Burna klädsaker (för avatarstället längst ner).
  const equipped = new Set(sd.avatarItems || []);

  const roomItemsOwned = owned.filter((id) => !isWearable(id) && getItem(id));
  const wearItemsOwned = owned.filter((id) => isWearable(id) && getItem(id));

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel">
      <h1>Mitt rum 🛏️</h1>
      <p class="hint">Klicka på en sak i lådan för att ställa den i rummet. Dra för att
        flytta. Klicka på en placerad sak och välj 🗑️ för att plocka bort den.</p>
    </div>

    <div class="room-stage" id="stage"></div>

    <div class="panel">
      <h2>Lådan 📦</h2>
      <p class="hint" id="tray-hint"></p>
      <div class="room-tray" id="tray"></div>
    </div>

    <div class="panel">
      <h2>Klä på din figur 👗</h2>
      <p class="hint">Klicka för att sätta på eller ta av. Din figur syns i sidhuvudet.</p>
      <div class="wear-tray" id="weartray"></div>
    </div>

    <div class="center">
      <button class="btn ghost" id="to-shop">🛍️ Till shoppen</button>
      <button class="btn ghost" id="to-husdjur">🥚 Mitt husdjur</button>
    </div>
  </div>`);

  const stage = view.querySelector("#stage");
  const tray = view.querySelector("#tray");
  const trayHint = view.querySelector("#tray-hint");
  const wearTray = view.querySelector("#weartray");

  let selectedId = null; // vald placerad sak (visar borttagningsknapp)

  // Spara rummet (debounce – tät dragrörelse skriver inte varje pixel).
  let saveTimer = null;
  function scheduleSaveRoom() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      data.saveRoom({ placements }).catch(() => {});
    }, 250);
  }

  // --- Rita rummets scen ---------------------------------------------------
  function renderStage() {
    stage.replaceChildren();
    for (const id of Object.keys(placements)) {
      const item = getItem(id);
      if (!item) continue;
      const pos = placements[id];
      stage.appendChild(el(`<div class="room-item${selectedId === id ? " selected" : ""}"
        data-id="${id}" style="left:${pos.x}%;top:${pos.y}%" title="${item.name}">
        <span class="ri-emoji">${itemSvg(id) || item.emoji}</span>
        <button class="ri-remove" data-remove="${id}" title="Plocka bort">🗑️</button>
      </div>`));
    }
    if (Object.keys(placements).length === 0) {
      stage.appendChild(el(`<div class="room-empty">Ditt rum är tomt – välj saker i lådan nedan! 👇</div>`));
    }
  }

  // --- Rita lådan (ägda, oplacerade rums-saker) ----------------------------
  function renderTray() {
    tray.replaceChildren();
    const notPlaced = roomItemsOwned.filter((id) => !(id in placements));
    if (roomItemsOwned.length === 0) {
      trayHint.textContent = "Du har inga saker än. Köp möbler, husdjur och dekor i shoppen!";
    } else if (notPlaced.length === 0) {
      trayHint.textContent = "Alla dina saker står i rummet. 🎉";
    } else {
      trayHint.textContent = "Klicka på en sak för att ställa den i rummet.";
    }
    for (const id of notPlaced) {
      const item = getItem(id);
      tray.appendChild(el(`<button class="tray-item" data-place="${id}" title="${item.name}">
        <span class="tray-emoji">${itemSvg(id) || item.emoji}</span>
        <span class="tray-namn">${item.name}</span>
      </button>`));
    }
  }

  // --- Rita klädlådan ------------------------------------------------------
  function renderWearTray() {
    wearTray.replaceChildren();
    if (wearItemsOwned.length === 0) {
      wearTray.appendChild(el(`<p class="hint">Du har inga kläder än – köp kläder & accessoarer i shoppen! 🧢</p>`));
      return;
    }
    for (const id of wearItemsOwned) {
      const item = getItem(id);
      const on = equipped.has(id);
      wearTray.appendChild(el(`<button class="wear-item${on ? " on" : ""}" data-wear="${id}" title="${item.name}">
        <span class="tray-emoji">${wearableSvg(id) || item.emoji}</span>
        <span class="tray-namn">${item.name}</span>
        <span class="wear-state">${on ? "På ✓" : "Sätt på"}</span>
      </button>`));
    }
  }

  renderStage();
  renderTray();
  renderWearTray();

  view.querySelector("#back").addEventListener("click", () => go("#/elev/hem"));
  view.querySelector("#to-shop").addEventListener("click", () => go("#/elev/shop"));
  view.querySelector("#to-husdjur").addEventListener("click", () => go("#/elev/husdjur"));

  // Placera en sak från lådan (klick).
  tray.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-place]");
    if (!btn) return;
    const id = btn.dataset.place;
    if (id in placements) return;
    placements[id] = { x: 50, y: 50 }; // mitten
    selectedId = null; // ny sak placeras utan ram – markeras först vid klick
    renderStage();
    renderTray();
    scheduleSaveRoom();
  });

  // Klädsaker: sätt på / ta av (en per slot).
  wearTray.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-wear]");
    if (!btn) return;
    const id = btn.dataset.wear;
    const item = getItem(id);
    if (!item) return;
    if (equipped.has(id)) {
      equipped.delete(id);
    } else {
      // Bara en sak per slot – ta av ev. annan i samma slot.
      for (const otherId of [...equipped]) {
        const other = getItem(otherId);
        if (other && other.slot === item.slot) equipped.delete(otherId);
      }
      equipped.add(id);
    }
    renderWearTray();
    try {
      await data.saveAvatarItems([...equipped]);
      await renderTopbar(); // figuren i sidhuvudet uppdateras direkt
    } catch (err) {
      flash("Kunde inte spara påklädnaden: " + err.message, true);
    }
  });

  // Ta bort en placerad sak (🗑️).
  stage.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove]");
    if (!removeBtn) return;
    const id = removeBtn.dataset.remove;
    delete placements[id];
    if (selectedId === id) selectedId = null;
    renderStage();
    renderTray();
    scheduleSaveRoom();
  });

  // --- Dra-och-släpp i rummet (pointer events, procentbaserat) -------------
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    const node = e.target.closest(".room-item");
    if (!node) {
      // Klick på tom yta i rummet → avmarkera direkt (ram + 🗑️ försvinner).
      // Görs på pointerdown (inte click) för att undvika krock med att
      // renderStage() bygger om DOM-noderna innan ev. click-event hinner fyra.
      if (selectedId !== null) {
        selectedId = null;
        renderStage();
      }
      return;
    }
    if (e.target.closest("[data-remove]")) return; // låt borttagning ske
    const rect = stage.getBoundingClientRect();
    drag = { id: node.dataset.id, node, rect, moved: false, startX: e.clientX, startY: e.clientY };
    node.setPointerCapture(e.pointerId);
    node.classList.add("dragging");
  });

  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3) {
      drag.moved = true;
    }
    const x = clamp(((e.clientX - drag.rect.left) / drag.rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - drag.rect.top) / drag.rect.height) * 100, 0, 100);
    placements[drag.id] = { x, y };
    drag.node.style.left = x + "%";
    drag.node.style.top = y + "%";
  });

  function endDrag() {
    if (!drag) return;
    drag.node.classList.remove("dragging");
    if (drag.moved) {
      scheduleSaveRoom();
    } else {
      // Ingen förflyttning = klick → markera/avmarkera (visar 🗑️).
      selectedId = selectedId === drag.id ? null : drag.id;
      renderStage();
    }
    drag = null;
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  app.replaceChildren(view);
}
