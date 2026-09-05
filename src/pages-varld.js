// ============================================================================
// Pluggportalen – husvärlden (#/elev/by, #/elev/hus & #/elev/rum) – EN scen
// ----------------------------------------------------------------------------
// Klassbyn (alla elevers hus), hus-vyn (huset utifrån, med elevens avatar
// framför) och Mitt rum är EN gemensam scen med tre zoomnivåer: "by" (ytterst),
// "hus" (ute) och "rum" (inne). Klick på huset zoomar kameran in genom
// fönstret till rummet; klick på klasskylten vid gårdskanten zoomar ut till
// byn – HELT klientsidigt, utan sidladdning; "Gå ut"/"Mitt hus" zoomar ut/in.
//
// KOMPIS-HUS-NIVÅN (#/elev/kompis?id=…): klick på en KAMRATS tomt zoomar först
// in till DERAS hus-exteriör (läs-vy) innan man går in i rummet – all logik i
// varld-kompis.js, kopplad in här via liveScen/updateUi.
//
// Routing: #/elev/by startar i byn, #/elev/hus ute och #/elev/rum inne
// (djuplänkar funkar). Alla tre routes pekar hit; om scenen redan står i
// DOM:en byter vi bara zoomnivå (mjuk kameraresa) i stället för att rendera om
// sidan – även bakåt/framåt-knapparna ger alltså den sömlösa övergången.
// Byns innehåll (klasskamraternas utseenden) hämtas LATT först när byn
// besöks – hus/rum laddar inte klasskamraternas data i onödan.
//
// Byggstenar:
//   varld-kamera.js   kameran (zoomnivåer, korszoom)
//   art-hus-ute.js    ute-scenens SVG (husskal + gård + skylt + avatar)
//   varld-rum.js      rummets innehåll (saker, husdjur, drag & drop, AI)
//   varld-by.js       by-layoutens matte (tomter, vägar, radmått)
//   varld-by-scen.js  byns rendering (minihus + avatar per klasskamrat)
//   varld-kompis.js   kompis-hus-nivån (läs-vy av en kamrats hus-exteriör)
//
// Scenens kontroller (Måla om, Lådan, Kläder, husdjurspanelen, ut-knappen)
// ligger som overlays I spelvyn; sidomenyn till vänster är orörd.
// ============================================================================

import * as data from "./data.js";
import * as petData from "./data-pet.js";
import { app, el, go, loading, renderTopbar, pageError, flash, getParams } from "./ui.js";
import { getPalette, paletteIdFromStudentData, renderPalettePicker } from "./room-palettes.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { husScen, husSkalMarkup, renderHusSkalPicker } from "./art-hus-ute.js";
import { mountRumScen } from "./varld-rum.js";
import { createKamera } from "./varld-kamera.js";
import { BY_ZOOM } from "./varld-by.js";
import { mountByScen } from "./varld-by-scen.js";
import { createKompisVy } from "./varld-kompis.js";

// Levande scen (för sömlösa route-byten): när routern träffar #/elev/hus eller
// #/elev/rum och scenen redan står i DOM:en byter vi bara kameranivå i stället
// för att bygga om sidan.
let liveScen = null; // { stage: HTMLElement, visaNiva(nivaId, id?) }

/**
 * Sidfunktion för ALLA tre routerna. `startNiva` = "by" (klassbyn), "hus"
 * (ute) eller "rum" (inne).
 */
export async function pageElevVarld(startNiva) {
  if (!data.isLoggedIn()) return go("#/elev");

  // Kompis-hus-nivån bär den klickade kamratens id i query (?id=…).
  const kompisId = startNiva === "kompis" ? getParams().id : null;

  // Sömlöst: scenen lever redan → mjuk kameraresa, ingen omrendering.
  if (liveScen && liveScen.stage.isConnected) {
    liveScen.visaNiva(startNiva, kompisId);
    return;
  }
  liveScen = null;

  loading();
  await renderTopbar();
  const session = data.getSession();
  const meId = data.currentStudentId();

  let sd, pets, justHatchedIds, klass;
  try {
    sd = await data.getStudentData();
    // Husdjuren: migrera ev. gammalt singular-pet och kläck färdiga ägg.
    // Klassen behövs för skylten vid gårdskanten (billig: en klasslistning).
    const [res, klassRes] = await Promise.all([
      petData.hatchReadyPets(),
      data.getClassForStudent(meId).catch(() => null),
    ]);
    pets = res.pets;
    justHatchedIds = res.justHatchedIds;
    klass = klassRes;
  } catch (err) {
    return pageError("Kunde inte ladda ditt hem", err);
  }

  const pal = getPalette(paletteIdFromStudentData(sd));
  const avatarId = sd.avatarId || DEFAULT_AVATAR;

  // Skylten vid gårdskanten: "Klass <namn> – <By>". Klassmodellen har inget
  // by-fält än – klass.by är ett VALFRITT Firestore-fält (fylls i för hand
  // per klass tills lärar-UI finns); saknas det visas bara klassnamnet.
  // Utan klass blir skylten en allmän "Vår by" (byn visar då alla elever).
  const klassNamn = klass?.name ? String(klass.name) : "";
  const byNamn = klass?.by ? String(klass.by) : "";
  const skyltTitel = klassNamn
    ? `Klass ${klassNamn}${byNamn ? ` – ${byNamn}` : ""}`
    : "Vår by";
  const skylt = {
    rad1: klassNamn ? `Klass ${klassNamn}` : "Vår by",
    rad2: byNamn ? `– ${byNamn} –` : "",
    aria: `${skyltTitel}. Zooma ut till byn och se hela klassens hus`,
  };

  // --- Scen-DOM: två fullstora lager + overlay-UI ---------------------------
  const view = el(`<div class="varld-sida">
    <div class="varld-stage" id="varld-stage"
      style="--hus-house:${pal.house};--hus-roof:${pal.roof};--hus-wall:${pal.wall};--hus-wall2:${pal.wall2}">
      <div class="varld-lager varld-by" id="by-lager"></div>
      <div class="varld-lager varld-ute" id="ute-lager">${husScen(avatarMarkup(avatarId, sd.avatarItems || []), { skalId: sd.husSkalId, skylt })}</div>
      <div class="varld-lager varld-ute varld-kompis varld-dold" id="kompis-lager"></div>
      <div class="varld-lager room-stage varld-rum" id="rum-lager"></div>

      <div class="varld-ui">
        <div class="varld-ui-topp">
          <button class="varld-knapp" id="ut-btn"></button>
          <div class="varld-titel" id="titel"></div>
          <!-- Verktygen samlas i EN rullgardin (samma på alla bredder) så scenen
               hålls ren – på mobil trängdes 7 pillerknappar annars ihop. Trigger-
               knappen ärver .varld-knapp; menyn ärver .varld-panel-känslan.
               Knapparna behåller sina bara-rum/rum-och-hus/data-panel-klasser +
               id:n, så både den kontextstyrda synlighets-CSS:en och panel-toggle-
               logiken fortsätter gälla oförändrat inuti menyn. -->
          <div class="varld-verktyg">
            <button class="varld-knapp varld-verktyg-trigger" id="verktyg-trigger"
              aria-haspopup="true" aria-expanded="false" aria-controls="verktyg-meny"
              title="Verktyg för rummet och huset">🧰 <span>Verktyg</span></button>
            <div class="varld-verktyg-meny" id="verktyg-meny" role="menu"
              aria-label="Verktyg" hidden>
              <button class="varld-knapp" role="menuitem" data-panel="palett" title="Måla om huset och väggarna">🎨 <span>Måla om</span></button>
              <button class="varld-knapp" role="menuitem" data-panel="hus" title="Byt husets utseende">🏠 <span>Nytt hus</span></button>
              <button class="varld-knapp bara-rum" role="menuitem" data-panel="lada" title="Dina saker">📦 <span>Lådan</span></button>
              <button class="varld-knapp bara-rum" role="menuitem" data-panel="djur" title="Dina undanstuvade djur">🐾 <span>Mina djur</span></button>
              <button class="varld-knapp rum-och-hus" role="menuitem" data-panel="klader" title="Klä på din figur">👗 <span>Kläder</span></button>
              <button class="varld-knapp bara-rum" role="menuitem" id="mat-btn" title="Klicka ut Mysterymat på golvet">🍎 <span>Mysterymat</span></button>
              <button class="varld-knapp" role="menuitem" id="to-shop" title="Till shoppen">🛍️ <span>Shop</span></button>
            </div>
          </div>
        </div>

        <div class="varld-panel" id="panel-palett" hidden>
          <h3>Måla om 🎨</h3>
          <p class="hint">Välj en färgpalett – samma färger används på huset och väggarna i ditt rum! Golvet behåller sin färg.</p>
          <div class="palett-rad" id="palettrad"></div>
        </div>
        <div class="varld-panel" id="panel-hus" hidden>
          <h3>Nytt hus 🏠</h3>
          <p class="hint">Byt husets utsida! Rummet inne är detsamma. Fler hus köper du i shoppen 🛍️</p>
          <div class="hus-skal-rad" id="husskalrad"></div>
        </div>
        <div class="varld-panel" id="panel-lada" hidden>
          <h3>Lådan 📦</h3>
          <p class="hint" id="tray-hint"></p>
          <div class="room-tray" id="tray"></div>
        </div>
        <div class="varld-panel" id="panel-djur" hidden>
          <h3>Mina djur 🐾</h3>
          <p class="hint" id="djur-hint"></p>
          <div class="room-tray" id="djurtray"></div>
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
  const byLager = view.querySelector("#by-lager");
  const uteLager = view.querySelector("#ute-lager");
  const kompisLager = view.querySelector("#kompis-lager");
  const rumLager = view.querySelector("#rum-lager");
  const hint = view.querySelector("#hint");
  const titel = view.querySelector("#titel");
  const utBtn = view.querySelector("#ut-btn");

  // --- Kameran: nivåer ordnade ytterst → innerst ----------------------------
  // Fokus 48,5 % / 52 % = husets fönster; zoom 6 = gamla .gar-in-skalan.
  // By-nivåns fokus (den egna tomten) är en platshållare tills byn byggts –
  // laddaBy() skriver in den riktiga punkten innan första by-övergången.
  const byNiva = { id: "by", el: byLager, fokus: { x: 50, y: 40 }, zoom: BY_ZOOM };
  const kamera = createKamera({
    nivaer: [
      byNiva,
      { id: "hus", el: uteLager, fokus: { x: 48.5, y: 52 }, zoom: 6 },
      { id: "rum", el: rumLager, fokus: { x: 50, y: 50 }, zoom: 6 },
    ],
    // Djuplänk till en kompis (#/elev/kompis?id=…) startar i byn – kompis-vyn
    // zoomar sedan in ovanpå, och "Till byn" har då nåt att zooma ut till.
    startId:
      startNiva === "rum" ? "rum"
      : startNiva === "by" || startNiva === "kompis" ? "by"
      : "hus",
    onNiva: (id) => updateUi(id),
  });

  // --- Klassbyn: innehållet hämtas & byggs lat (första by-besöket) ----------
  // Klasskamraternas utseenden (avatarer, paletter) läses först när byn
  // faktiskt öppnas. Utan klass, eller med tom klass, visas ALLA elever –
  // samma snälla fallback som gamla klassfotot.
  // laddaBy() resolvar med { students, fokusById } så kompis-hus-vyn kan slå
  // upp en kamrats utseende + tomtfokus utan en extra Firestore-runda.
  let byLaddning = null;
  function laddaBy() {
    byLaddning ??= (async () => {
      // Läs BARA sig själv + klasskamraterna, per dokument. En elev får enligt
      // reglerna inte lista hela students-kollektionen (world-read är borta) –
      // bara läsa kamrater i samma klass. Utan klass blir byn bara det egna huset.
      const classIds = Array.isArray(klass?.studentIds) ? klass.studentIds : [];
      const ids = [meId, ...classIds].filter(Boolean);
      let boende = await data.getStudentsWithLooks(ids);
      // Egen tomt först, resten i namnordning (svensk kollation).
      boende = boende.slice().sort((a, b) => {
        if (a.id === meId) return -1;
        if (b.id === meId) return 1;
        return String(a.namn || "").localeCompare(String(b.namn || ""), "sv");
      });
      const { fokus, fokusById } = mountByScen({ lager: byLager, meId, students: boende });
      byNiva.fokus = fokus; // kameran läser fokus vid varje övergång
      return { students: boende, fokusById };
    })().catch((err) => {
      byLaddning = null; // låt nästa försök hämta igen
      throw err;
    });
    return byLaddning;
  }

  // Klick i byn: eget hus → zooma in (ute-vyn); kamratens hus → zooma in till
  // DERAS hus-exteriör (kompis-hus-nivån), inte direkt in i rummet. Delegerat
  // på lagret så det funkar oavsett när byn byggs.
  byLager.addEventListener("click", (e) => {
    const tomt = e.target.closest(".by-tomt");
    if (!tomt || stage.dataset.niva !== "by") return;
    if (tomt.dataset.me) go("#/elev/hus");
    else go(`#/elev/kompis?id=${encodeURIComponent(tomt.dataset.id)}`);
  });
  byLager.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".by-tomt")) {
      e.preventDefault();
      e.target.closest(".by-tomt").click();
    }
  });

  // --- Kompis-hus-nivån (läs-vy av en kamrats hus-exteriör) -----------------
  // Egen modul (varld-kompis.js): en liten kamera som korszoomar byLager ↔
  // kompis-lager mot den klickade tomten. onNiva=updateUi delas med huvud-
  // kameran, så titel/knappar uppdateras likadant.
  const kompisVy = createKompisVy({
    stage, byLager, kompisLager, byNiva, meId,
    ensureBy: laddaBy,
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
    utBtn.style.display = "";
    if (nivaId === "by") {
      utBtn.innerHTML = "🏠 <span>Mitt hus</span>";
      utBtn.title = "Zooma in till ditt hus";
      titel.textContent = `${skyltTitel} 🏘️`;
      hint.textContent = "🏘️ Klicka på en kompis hus för att hälsa på – ditt eget hus tar dig hem!";
      hint.hidden = false;
    } else if (nivaId === "hus") {
      // Hus-nivån ÄR startsidan – ingen "hem"-knapp behövs (den vore en no-op).
      // Byn nås via klasskylten, rummet genom att klicka på huset.
      utBtn.style.display = "none";
      titel.textContent = `${session.namn ? session.namn + "s" : "Mitt"} hus 🏠`;
      hint.textContent = "🏠 Klicka på huset för att gå in – eller på skylten för att se hela byn!";
      hint.hidden = false;
    } else if (nivaId === "kompishus") {
      const k = kompisVy.kompis;
      const namn = (k && (k.namn || k.username)) || "Kompisens";
      utBtn.innerHTML = "← <span>Till byn</span>";
      utBtn.title = "Tillbaka till klassbyn";
      titel.textContent = `${namn}s hus 🏠`;
      hint.textContent = `🏠 Klicka på huset för att gå in i ${namn}s rum – eller på pilen tillbaka till byn.`;
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

  // Sömlösa route-byten: registrera den levande scenen för routern. By-nivån
  // kan behöva hämta sitt innehåll först (lat laddning) – därför async.
  liveScen = {
    stage,
    async visaNiva(nivaId, id) {
      // Kompis-hus-nivån: zooma in till den klickade kamratens exteriör.
      if (nivaId === "kompis") return kompisVy.visa(id);

      // Står vi på en kamrats hus? Tillbaka till byn = zooma ut med kompis-
      // kameran; hus/rum-hopp därifrån nollställs först (huvudkameran är kvar
      // i byn så länge vi rör oss i kompis-grenen).
      if (kompisVy.aktivId === "kompishus") {
        if (nivaId === "by") {
          kompisVy.tillbaka();
          return;
        }
        kompisVy.nollstall();
      }

      if (nivaId === "by" && kamera.aktivId !== "by") {
        if (!byLaddning) hint.textContent = "Hämtar byn… 🏘️";
        try {
          await laddaBy();
        } catch (err) {
          flash("Kunde inte hämta byn: " + err.message, true);
          return;
        }
      } else if (nivaId === "hus" && kamera.aktivId === "rum") {
        hint.textContent = "Hej då, rummet! 👋";
      } else if (nivaId === "rum" && kamera.aktivId !== "rum") {
        hint.textContent = "Välkommen hem! 🏡";
      }
      kamera.gaTill(nivaId);
    },
  };

  // Ut-knappen: på kompisens hus = tillbaka till byn; annars = ut till/in i
  // egna huset (i rummet = gå ut, i byn = zooma in). På hus-nivån är knappen
  // dold (updateUi), så den grenen nås aldrig därifrån.
  utBtn.addEventListener("click", () =>
    go(stage.dataset.niva === "kompishus" ? "#/elev/by" : "#/elev/hus")
  );
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

  // --- Verktygsmenyn (rullgardin) -------------------------------------------
  // Wrappar bara ÖPPNING/STÄNGNING runt den befintliga logiken ovan – varje
  // verktygsknapp gör exakt som förr när den väljs. Att välja ett verktyg
  // stänger menyn (panelen/mat-läget syns då ostört bakom den stängda menyn).
  const verktygTrigger = view.querySelector("#verktyg-trigger");
  const verktygMeny = view.querySelector("#verktyg-meny");
  function stangMeny() {
    verktygMeny.hidden = true;
    verktygTrigger.setAttribute("aria-expanded", "false");
  }
  function oppnaMeny() {
    verktygMeny.hidden = false;
    verktygTrigger.setAttribute("aria-expanded", "true");
    // Fokusera första synliga verktyget för tangentbordsnavigering.
    const forsta = [...verktygMeny.querySelectorAll(".varld-knapp")]
      .find((b) => b.offsetParent !== null);
    forsta?.focus();
  }
  verktygTrigger.addEventListener("click", () => {
    if (verktygMeny.hidden) oppnaMeny(); else stangMeny();
  });
  // Val av verktyg stänger menyn (efter att knappens egen handler kört).
  verktygMeny.addEventListener("click", (e) => {
    if (e.target.closest(".varld-knapp")) stangMeny();
  });
  // Esc stänger och lämnar fokus på triggern; klick utanför stänger.
  view.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !verktygMeny.hidden) {
      stangMeny();
      verktygTrigger.focus();
    }
  });
  // Scenen fyller vyn; scopa klick-utanför hit så listenern städas bort med
  // vyn (inget kvarlämnat document-lyssnare vid route-byten).
  view.addEventListener("pointerdown", (e) => {
    if (verktygMeny.hidden) return;
    if (!e.target.closest(".varld-verktyg")) stangMeny();
  });

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

  // --- Skylten vid gårdskanten: zooma UT till klassbyn ----------------------
  const skyltEl = view.querySelector("#klasskylt");
  function tillByn() {
    if (stage.dataset.niva !== "hus") return;
    go("#/elev/by");
  }
  skyltEl.addEventListener("click", tillByn);
  skyltEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      tillByn();
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

  // --- Husskal ("Nytt hus"): byter BARA husets exteriör, inte rummet --------
  // Väljaren visar default-stugan + ägda skal (ownedItems). Byte ritar om
  // husets skal live inuti #husgrupp (skylten/avataren, som ligger utanför
  // gruppen, rörs inte) och slår igenom i byn/kompisvyn nästa besök via det
  // sparade husSkalId. Förhandsvisningarna ärver --hus-* från scenen → följer
  // paletten live (ingen palette skickas med).
  const husgruppEl = view.querySelector("#husgrupp");
  renderHusSkalPicker(view.querySelector("#husskalrad"), {
    activeId: sd.husSkalId,
    owned: sd.ownedItems || [],
    onPick: (skalId) => {
      if (husgruppEl) husgruppEl.innerHTML = husSkalMarkup(skalId);
      data.saveHusSkal(skalId).catch((err) => {
        flash("Kunde inte spara husbytet: " + err.message, true);
      });
    },
  });

  // --- Rummet: hela inne-vyn monteras i sitt lager (varld-rum.js) -----------
  mountRumScen({
    stage: rumLager,
    petPanel: view.querySelector("#pet-panel"),
    tray: view.querySelector("#tray"),
    trayHint: view.querySelector("#tray-hint"),
    djurTray: view.querySelector("#djurtray"),
    djurHint: view.querySelector("#djur-hint"),
    wearTray: view.querySelector("#weartray"),
    matBtn: view.querySelector("#mat-btn"),
    sd, pets, justHatchedIds,
    onEquippedChange(equipped) {
      // Avataren framför huset speglar alltid aktuell klädsel.
      const holder = uteLager.querySelector("#ute-avatar");
      if (holder) holder.innerHTML = avatarMarkup(avatarId, equipped);
    },
  });

  // Djuplänk rakt in i byn (#/elev/by) eller till en kompis (#/elev/kompis):
  // bygg byn INNAN scenen visas, så kameran inte står och tittar på ett tomt
  // lager (kompis-vyn behöver dessutom byns fokuspunkter + kompisdata).
  if (startNiva === "by" || startNiva === "kompis") {
    try {
      await laddaBy();
    } catch (err) {
      return pageError("Kunde inte hämta byn", err);
    }
  }

  app.replaceChildren(view);

  // Djuplänk till en kompis: zooma in till deras hus när scenen står i DOM:en.
  if (startNiva === "kompis") kompisVy.visa(kompisId);
}
