// ============================================================================
// Pluggportalen – husvärlden (#/elev/hus & #/elev/rum) – EN stateful spelscen
// ----------------------------------------------------------------------------
// Hus-vyn (huset utifrån, med elevens avatar framför) och Mitt rum är numera
// EN gemensam scen med två zoomnivåer: "hus" (ute) och "rum" (inne). Klick på
// huset zoomar kameran in genom fönstret till rummet – HELT klientsidigt, utan
// sidladdning; "Gå ut" zoomar ut igen.
//
// Routing: #/elev/hus startar ute och #/elev/rum inne (djuplänkar funkar som
// förut). Båda routerna pekar hit; om scenen redan står i DOM:en byter vi bara
// zoomnivå (mjuk kameraresa) i stället för att rendera om sidan – även
// bakåt/framåt-knapparna ger alltså den sömlösa övergången.
//
// Byggstenar:
//   varld-kamera.js  kameran (zoomnivåer, korszoom, by-förberedd)
//   art-hus-ute.js   ute-scenens SVG (hus + gård + avatar framför huset)
//   varld-rum.js     rummets innehåll (saker, husdjur, drag & drop, AI)
//   varld-by.js      layouthjälpare för kommande by-nivån (klassbyn)
//
// Scenens kontroller (Måla om, Lådan, Kläder, husdjurspanelen, ut-knappen)
// ligger som overlays I spelvyn; sidomenyn till vänster är orörd.
// ============================================================================

import * as data from "./data.js";
import * as petData from "./data-pet.js";
import { app, el, go, loading, renderTopbar, pageError, flash } from "./ui.js";
import { getPalette, paletteIdFromStudentData, renderPalettePicker } from "./room-palettes.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { husScen } from "./art-hus-ute.js";
import { mountRumScen } from "./varld-rum.js";
import { createKamera } from "./varld-kamera.js";

// Levande scen (för sömlösa route-byten): när routern träffar #/elev/hus eller
// #/elev/rum och scenen redan står i DOM:en byter vi bara kameranivå i stället
// för att bygga om sidan.
let liveScen = null; // { stage: HTMLElement, visaNiva(nivaId) }

/**
 * Sidfunktion för BÅDA routerna. `startNiva` = "hus" (ute) eller "rum" (inne).
 */
export async function pageElevVarld(startNiva) {
  if (!data.isLoggedIn()) return go("#/elev");

  // Sömlöst: scenen lever redan → mjuk kameraresa, ingen omrendering.
  if (liveScen && liveScen.stage.isConnected) {
    liveScen.visaNiva(startNiva);
    return;
  }
  liveScen = null;

  loading();
  await renderTopbar();
  const session = data.getSession();

  let sd, pets, justHatchedIds;
  try {
    sd = await data.getStudentData();
    // Husdjuren: migrera ev. gammalt singular-pet och kläck färdiga ägg.
    const res = await petData.hatchReadyPets();
    pets = res.pets;
    justHatchedIds = res.justHatchedIds;
  } catch (err) {
    return pageError("Kunde inte ladda ditt hem", err);
  }

  const pal = getPalette(paletteIdFromStudentData(sd));
  const avatarId = sd.avatarId || DEFAULT_AVATAR;

  // --- Scen-DOM: två fullstora lager + overlay-UI ---------------------------
  const view = el(`<div class="varld-sida">
    <div class="varld-stage" id="varld-stage"
      style="--hus-house:${pal.house};--hus-roof:${pal.roof};--hus-wall:${pal.wall};--hus-wall2:${pal.wall2}">
      <div class="varld-lager varld-ute" id="ute-lager">${husScen(avatarMarkup(avatarId, sd.avatarItems || []))}</div>
      <div class="varld-lager room-stage varld-rum" id="rum-lager"></div>

      <div class="varld-ui">
        <div class="varld-ui-topp">
          <button class="varld-knapp" id="ut-btn"></button>
          <div class="varld-titel" id="titel"></div>
          <div class="varld-verktyg">
            <button class="varld-knapp" data-panel="palett" title="Måla om huset och väggarna">🎨 <span>Måla om</span></button>
            <button class="varld-knapp bara-rum" data-panel="lada" title="Dina saker">📦 <span>Lådan</span></button>
            <button class="varld-knapp bara-rum" data-panel="klader" title="Klä på din figur">👗 <span>Kläder</span></button>
            <button class="varld-knapp" id="to-shop" title="Till shoppen">🛍️</button>
          </div>
        </div>

        <div class="varld-panel" id="panel-palett" hidden>
          <h3>Måla om 🎨</h3>
          <p class="hint">Välj en färgpalett – samma färger används på huset och väggarna i ditt rum! Golvet behåller sin färg.</p>
          <div class="palett-rad" id="palettrad"></div>
        </div>
        <div class="varld-panel" id="panel-lada" hidden>
          <h3>Lådan 📦</h3>
          <p class="hint" id="tray-hint"></p>
          <div class="room-tray" id="tray"></div>
        </div>
        <div class="varld-panel" id="panel-klader" hidden>
          <h3>Klä på din figur 👗</h3>
          <p class="hint">Klicka för att sätta på eller ta av. Din figur syns i menyn och framför huset.</p>
          <div class="wear-tray" id="weartray"></div>
        </div>

        <div class="varld-petpanel" id="pet-panel"></div>
        <div class="hus-hint" id="hint"></div>
      </div>
    </div>
  </div>`);

  const stage = view.querySelector("#varld-stage");
  const uteLager = view.querySelector("#ute-lager");
  const rumLager = view.querySelector("#rum-lager");
  const hint = view.querySelector("#hint");
  const titel = view.querySelector("#titel");
  const utBtn = view.querySelector("#ut-btn");

  // --- Kameran: nivåer ordnade ytterst → innerst ----------------------------
  // Fokus 48,5 % / 52 % = husets fönster; zoom 6 = gamla .gar-in-skalan.
  // KLASSBY: lägg by-lagret FÖRST i listan (se varld-kamera.js + varld-by.js).
  const kamera = createKamera({
    nivaer: [
      { id: "hus", el: uteLager, fokus: { x: 48.5, y: 52 }, zoom: 6 },
      { id: "rum", el: rumLager, fokus: { x: 50, y: 50 }, zoom: 6 },
    ],
    startId: startNiva === "rum" ? "rum" : "hus",
    onNiva: (id) => updateUi(id),
  });

  // --- Overlay-UI per nivå --------------------------------------------------
  function stangPaneler() {
    for (const p of view.querySelectorAll(".varld-panel")) p.hidden = true;
    for (const b of view.querySelectorAll("[data-panel]")) b.classList.remove("aktiv");
  }

  function updateUi(nivaId) {
    stage.dataset.niva = nivaId;
    stangPaneler();
    if (nivaId === "hus") {
      utBtn.innerHTML = "← <span>Hem</span>";
      utBtn.title = "Till startsidan";
      titel.textContent = `${session.namn ? session.namn + "s" : "Mitt"} hus 🏠`;
      hint.textContent = "🏠 Klicka på huset för att gå in!";
      hint.hidden = false;
    } else {
      utBtn.innerHTML = "🚪 <span>Gå ut</span>";
      utBtn.title = "Gå ut ur huset";
      titel.textContent = "Mitt rum 🛏️";
      hint.textContent = "Dra saker för att flytta dem · klicka på ett husdjur för att mysa! 🐾";
      hint.hidden = false;
      // Låt inne-hinten smälta undan av sig själv efter en stund.
      setTimeout(() => {
        if (stage.dataset.niva === "rum") hint.hidden = true;
      }, 5000);
    }
  }
  updateUi(kamera.aktivId);

  // Sömlösa route-byten: registrera den levande scenen för routern.
  liveScen = {
    stage,
    visaNiva(nivaId) {
      if (nivaId === "hus" && kamera.aktivId !== "hus") {
        hint.textContent = "Hej då, rummet! 👋";
      } else if (nivaId === "rum" && kamera.aktivId !== "rum") {
        hint.textContent = "Välkommen hem! 🏡";
      }
      kamera.gaTill(nivaId);
    },
  };

  // Ut-knappen: gå ut ur rummet till huset. På hus-nivån ÄR vi redan hemma
  // (hus-scenen är elevens landningssida sedan hem-hjälten slopades), så där
  // blir klicket en no-op i stället för att peka på en borttagen sida.
  utBtn.addEventListener("click", () => go("#/elev/hus"));
  view.querySelector("#to-shop").addEventListener("click", () => go("#/elev/shop"));

  // Verktygspaneler (en öppen åt gången, klick igen stänger).
  for (const btn of view.querySelectorAll("[data-panel]")) {
    btn.addEventListener("click", () => {
      const panel = view.querySelector(`#panel-${btn.dataset.panel}`);
      const oppna = panel.hidden;
      stangPaneler();
      if (oppna) {
        panel.hidden = false;
        btn.classList.add("aktiv");
      }
    });
  }

  // --- Gå in i huset: klick på husgruppen → route-byte (kameran zoomar) -----
  const husgrupp = view.querySelector("#husgrupp");
  function gaIn() {
    if (stage.dataset.niva !== "hus") return;
    go("#/elev/rum");
  }
  husgrupp.addEventListener("click", gaIn);
  husgrupp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      gaIn();
    }
  });

  // --- Paletten: färgar huset (ute) OCH väggarna (inne) i ett svep ----------
  let paletteId = paletteIdFromStudentData(sd);
  function applyPalette() {
    const p = getPalette(paletteId);
    stage.style.setProperty("--hus-house", p.house);
    stage.style.setProperty("--hus-roof", p.roof);
    stage.style.setProperty("--hus-wall", p.wall);
    stage.style.setProperty("--hus-wall2", p.wall2);
    rumLager.style.setProperty("--rum-wall", p.wall);
    rumLager.style.setProperty("--rum-wall2", p.wall2);
  }
  applyPalette();
  renderPalettePicker(view.querySelector("#palettrad"), paletteId, (id) => {
    paletteId = id;
    applyPalette();
    data.saveRoom({ paletteId: id }).catch((err) => {
      flash("Kunde inte spara färgvalet: " + err.message, true);
    });
  });

  // --- Rummet: hela inne-vyn monteras i sitt lager (varld-rum.js) -----------
  mountRumScen({
    stage: rumLager,
    petPanel: view.querySelector("#pet-panel"),
    tray: view.querySelector("#tray"),
    trayHint: view.querySelector("#tray-hint"),
    wearTray: view.querySelector("#weartray"),
    sd, pets, justHatchedIds,
    onEquippedChange(equipped) {
      // Avataren framför huset speglar alltid aktuell klädsel.
      const holder = uteLager.querySelector("#ute-avatar");
      if (holder) holder.innerHTML = avatarMarkup(avatarId, equipped);
    },
  });

  app.replaceChildren(view);
}
