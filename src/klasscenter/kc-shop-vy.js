// ============================================================================
// Klasscentret – shoppens "Klasscentrum"-flik (#488, epic #475).
// ----------------------------------------------------------------------------
// Laddas ALLTID DYNAMISKT från pages-shop.js när fliken väljs (#271: shoppen
// ligger i den statiska bootgrafen; den här modulen, dess CSS och konsten gör
// det inte). pages-shop.js ger bara en tom yta + saldot och anropar stopp()
// när fliken byts; sidbyte (hash-byte) stänger prenumerationen härifrån.
//
// Eleven crowdfundar föremål tillsammans med klassen: mätaren följer
// classCenters/{classId}/fund i realtid (subscribeFunds), "Donera" öppnar en
// panel (snabbval + fritt fält, klampat till saldo och det som saknas) och
// donate() drar mynten + ökar insamlat i EN transaktion (kc-fund-plan.js).
// Anonymt: inga donatorer visas. "Du har bidragit med X" räknas lokalt
// (localStorage per elev+klass) – donationsposterna läses bara av lärare.
//
// API
//   mountKcShop(yta, { coins, onCoins, flash, deps? }) → stopp()
//     coins   elevens saldo nu; onCoins(nytt) efter varje lyckad donation
//     deps    (tester/preview) { uid, klasser(), subscribeFunds, donate, bild }
// ============================================================================

import { KC_SHOP_ITEMS, kcShopItem } from "./kc-shop-items.js";
import { donationsGrans, handlingHtml, klampaBelopp, kortHtml, matareHtml, panelHtml } from "./kc-shop-kort.js";

const CSS = "src/klasscenter/kc-shop-vy.css";
const VALD_KLASS_KEY = "pp:kc:shopKlass";

function laddaCss() {
  if (document.querySelector(`link[data-kc-css="${CSS}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS;
  link.dataset.kcCss = CSS;
  document.head.appendChild(link);
}

/** Riktiga beroenden (Firestore + konsten) – laddas först när fliken öppnas. */
async function riktigaDeps() {
  const [data, klasser, fund, art] = await Promise.all([
    import("../data.js"),
    import("../data-classes.js"),
    import("./kc-fund-data.js"),
    import("../art-klasscenter-inredning.js"),
  ]);
  const uid = data.currentStudentId();
  return {
    uid,
    klasser: async () => (await klasser.getClasses())
      .filter((k) => Array.isArray(k.studentIds) && k.studentIds.includes(uid)),
    subscribeFunds: fund.subscribeFunds,
    donate: fund.donate,
    bild: (it) => art.kcInredningSvg(it.art, { aria: it.namn }),
  };
}

const lasLS = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const skrivLS = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* ignorera */ } };

/** Elevens egna bidrag per föremål (bara på den här enheten). */
function bidragKey(uid, classId) {
  return `pp:kc:bidrag:${uid}:${classId}`;
}
function lasBidrag(uid, classId) {
  try { return JSON.parse(lasLS(bidragKey(uid, classId)) || "{}") || {}; } catch (_) { return {}; }
}

export function mountKcShop(yta, { coins = 0, onCoins = () => {}, flash = () => {}, deps = null } = {}) {
  laddaCss();
  let aktiv = true;
  let avsluta = null; // subscribeFunds-avregistrering
  const st = { coins, funds: null, classId: null, uid: null, bidrag: {}, oppen: null, belopp: 0, skickar: false };

  function stopp() {
    if (!aktiv) return;
    aktiv = false;
    window.removeEventListener("hashchange", vidHash);
    if (avsluta) avsluta();
    avsluta = null;
  }
  // Sidbyte: shoppen ritas inte om, så stäng prenumerationen här.
  function vidHash() {
    if (!(window.location.hash || "").startsWith("#/elev/shop")) stopp();
  }
  window.addEventListener("hashchange", vidHash);

  yta.innerHTML = `<p class="hint">Laddar klassens insamling…</p>`;

  (async () => {
    const d = deps || (await riktigaDeps());
    if (!aktiv) return;
    st.uid = d.uid;
    const klasser = await d.klasser();
    if (!aktiv) return;
    if (!klasser.length) {
      yta.innerHTML = `<p class="hint kcs-ingen-klass">🏛️ Klasscentrum är klassens gemensamma
        insamling. Du är inte med i någon klass än – be din lärare lägga till dig, så kan du
        hjälpa klassen att samla ihop till statyer, fontäner och annat pampigt!</p>`;
      return;
    }
    const sparad = lasLS(VALD_KLASS_KEY);
    st.classId = (klasser.find((k) => k.id === sparad) || klasser[0]).id;
    ritaSkal(d, klasser);
    prenumerera(d);
  })().catch((err) => {
    console.warn("[klasscenter] shoppen kunde inte laddas", err);
    if (aktiv) yta.innerHTML = `<p class="hint">Klasscentrum kunde inte laddas just nu. Försök igen om en stund.</p>`;
  });

  function ritaSkal(d, klasser) {
    const val = klasser.length > 1
      ? `<label class="kcs-klassval">Klass: <select class="kcs-klass">${klasser
        .map((k) => `<option value="${k.id}"${k.id === st.classId ? " selected" : ""}>${k.name || k.id}</option>`)
        .join("")}</select></label>`
      : "";
    yta.innerHTML = `<p class="hint shop-cat-hint">Samla ihop till något stort tillsammans med
      klassen! Alla bidrag läggs ihop – när mätaren är full är saken köpt och hamnar i
      klassens möbellåda i Klasscentret.</p>${val}<div class="shop-grid kcs-grid"><p class="hint">Laddar…</p></div>`;
    yta.querySelector(".kcs-klass")?.addEventListener("change", (e) => {
      st.classId = e.target.value;
      skrivLS(VALD_KLASS_KEY, st.classId);
      st.oppen = null;
      prenumerera(d);
    });
    yta.onclick = (e) => klick(d, e);
    yta.oninput = (e) => {
      if (!e.target.classList.contains("kcs-belopp")) return;
      st.belopp = Number(e.target.value) || 0;
      uppdateraPanel(e.target.closest(".kcs-kort"), false);
    };
  }

  function prenumerera(d) {
    if (avsluta) avsluta();
    st.funds = null;
    st.bidrag = lasBidrag(st.uid, st.classId);
    const classId = st.classId;
    avsluta = d.subscribeFunds(classId, (funds) => {
      if (!aktiv || classId !== st.classId) return;
      const forsta = !st.funds;
      st.funds = funds;
      if (forsta) ritaKort(d);
      else for (const it of KC_SHOP_ITEMS) uppdateraKort(it.id);
    }, (err) => {
      console.warn("[klasscenter] insamlingen kunde inte läsas", err?.code || err);
      const grid = yta.querySelector(".kcs-grid");
      if (grid && aktiv) grid.innerHTML = `<p class="hint">Insamlingen kunde inte läsas just nu.</p>`;
    });
  }

  function ritaKort(d) {
    const grid = yta.querySelector(".kcs-grid");
    if (!grid) return;
    grid.innerHTML = KC_SHOP_ITEMS
      .map((it) => kortHtml(it, st.funds[it.id], { coins: st.coins, bidrag: st.bidrag[it.id] || 0, bild: d.bild(it) }))
      .join("");
  }

  const kortFor = (id) => yta.querySelector(`.kcs-kort[data-kc="${id}"]`);

  /** Mätare + knapprad för ett föremål (panelen hålls öppen om den kan). */
  function uppdateraKort(id) {
    const kort = kortFor(id);
    const fund = st.funds && st.funds[id];
    if (!kort || !fund) return;
    kort.querySelector(".kcs-matare").innerHTML = matareHtml(fund, st.bidrag[id] || 0);
    const g = donationsGrans(fund, st.coins);
    kort.classList.toggle("is-owned", g.kopt);
    if (st.oppen === id && !g.kopt && g.max > 0) return uppdateraPanel(kort, true);
    if (st.oppen === id) st.oppen = null; // köpt (eller saldot slut) under tiden
    kort.querySelector(".kcs-handling").innerHTML = handlingHtml(fund, st.coins);
  }

  /** Rita panelen; hel = false → bara knappen/chippen (fältet behåller fokus). */
  function uppdateraPanel(kort, hel) {
    if (!kort) return;
    const g = donationsGrans(st.funds[kort.dataset.kc], st.coins);
    if (hel) {
      const fokus = document.activeElement?.classList.contains("kcs-belopp");
      kort.querySelector(".kcs-handling").innerHTML = panelHtml(g, st.belopp);
      const falt = kort.querySelector(".kcs-belopp");
      if (fokus && falt) falt.focus();
      return;
    }
    const b = klampaBelopp(st.belopp, g.max);
    const falt = kort.querySelector(".kcs-belopp");
    if (falt && Number(falt.value) > g.max) falt.value = String(g.max); // klampa synligt
    if (falt && b) st.belopp = b;
    for (const c of kort.querySelectorAll(".kcs-chip")) c.classList.toggle("active", Number(c.dataset.belopp) === b);
    const skank = kort.querySelector(".kcs-skank");
    skank.disabled = !b;
    skank.textContent = b ? `Skänk ${b.toLocaleString("sv-SE")}` : "Skänk";
  }

  async function klick(d, e) {
    const kort = e.target.closest(".kcs-kort");
    if (!kort || st.skickar) return;
    const id = kort.dataset.kc;
    if (e.target.closest(".kcs-donera")) {
      const forra = st.oppen;
      st.oppen = id;
      st.belopp = 0;
      if (forra && forra !== id) uppdateraKort(forra);
      return uppdateraPanel(kort, true);
    }
    if (e.target.closest(".kcs-avbryt")) {
      st.oppen = null;
      return uppdateraKort(id);
    }
    const chip = e.target.closest(".kcs-chip");
    if (chip && !chip.disabled) {
      st.belopp = Number(chip.dataset.belopp) || 0;
      const falt = kort.querySelector(".kcs-belopp");
      if (falt) falt.value = String(st.belopp);
      return uppdateraPanel(kort, false);
    }
    const skank = e.target.closest(".kcs-skank");
    if (skank && !skank.disabled) await skanka(d, kort, id, skank);
  }

  async function skanka(d, kort, id, knapp) {
    const g = donationsGrans(st.funds[id], st.coins);
    const belopp = klampaBelopp(st.belopp, g.max);
    if (!belopp) return;
    st.skickar = true;
    knapp.disabled = true;
    knapp.textContent = "Skänker…";
    const classId = st.classId;
    let res;
    try {
      res = await d.donate(classId, id, belopp);
    } finally {
      st.skickar = false;
    }
    if (!aktiv) return;
    const namn = kcShopItem(id)?.namn || id;
    if (res && res.ok) {
      st.coins = res.coins;
      st.bidrag[id] = (st.bidrag[id] || 0) + res.amount;
      skrivLS(bidragKey(st.uid, classId), JSON.stringify(st.bidrag));
      st.oppen = null;
      onCoins(res.coins);
      flash(res.isUnlocked
        ? `🎉 Klassen klarade det! ${namn} är köpt och finns i klassens möbellåda.`
        : `Tack! Du skänkte ${res.amount} mynt till ${namn}.${res.cappat ? " (Det behövdes inte mer än så!)" : ""}`);
    } else {
      flash((res && res.error) || "Donationen gick inte igenom. Försök igen.", true);
    }
    // Alla kort: saldot ändrades (knapparnas läge), mätaren kommer via snapshot.
    for (const it of KC_SHOP_ITEMS) uppdateraKort(it.id);
  }

  return stopp;
}
