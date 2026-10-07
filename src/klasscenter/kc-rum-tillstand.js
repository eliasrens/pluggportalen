// ============================================================================
// Klasscentrets rum – lokalt tillstånd mot den gemensamma layouten (#490).
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM, ingen Firebase) → testas i Node (test/kc-rum.test.js).
// Laddas bara dynamiskt (via kc-rum-vy.js, #271).
//
// Modellen bakom "Spara"-knappen:
//   bas      = senaste layout från servern som rummet utgår från (version N)
//   lokal    = det som visas och dras i (kopia av bas.placedItems + ändringar)
//   osparat  = lokal skiljer sig från bas
//   vantande = en NYARE serverversion som kom medan eleven hade osparade
//              ändringar eller drog en sak – den skriver ALDRIG över en
//              pågående drag eller osparat arbete. UI:t erbjuder "Visa deras";
//              sparar eleven ändå vinner den senaste sparningen (BESLUT #489)
//              och den andras version ligger kvar i Historik.
//
// API
//   skapaKcRumTillstand() → {
//     placements, version, osparat, vantande, laddad, placedItemsAttSpara(),
//     fjarr(layout, { dragPagar }) → "ritad" | "vantar" | "samma",
//     andrat(), efterDrag() → bool (visade en väntande version),
//     visaVantande() → bool, sparat(plan), aterstallt(plan), rang(nyckel),
//     ovanpa(nyckel) }
//   sammaLayout(a, b) → bool
//   statusHtml({ fel, laddad, kan, visaOnly, vantande, osparat, sparatNyss })
//       → statusradens markup ("" = dölj)
// ============================================================================

import { KC_Z_MAX } from "./kc-layout-plan.js";

const kopia = (pi) => {
  const ut = {};
  for (const [k, p] of Object.entries(pi || {})) ut[k] = { x: p.x, y: p.y, z: p.z ?? 0 };
  return ut;
};

const r2 = (v) => Math.round(Number(v) * 100) / 100;

/** Samma layout? (oberoende av nyckelordning, positioner på 0,01 %). */
export function sammaLayout(a = {}, b = {}) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => b[k] && r2(a[k].x) === r2(b[k].x) && r2(a[k].y) === r2(b[k].y) &&
    Math.round(a[k].z ?? 0) === Math.round(b[k].z ?? 0));
}

export function skapaKcRumTillstand() {
  let bas = { placedItems: {}, version: 0, updatedBy: null, updatedAt: null };
  let lokal = {};
  let osparat = false;
  let vantande = null;
  let laddad = false;

  function ta(layout) {
    bas = { ...layout, placedItems: kopia(layout.placedItems) };
    lokal = kopia(layout.placedItems);
    osparat = false;
    vantande = null;
  }

  return {
    get placements() { return lokal; },
    get version() { return bas.version; },
    get bas() { return bas; },
    get osparat() { return osparat; },
    get vantande() { return vantande; },
    get laddad() { return laddad; },

    /** Det som skickas till saveLayout (z avrundat, x/y 2 decimaler). */
    placedItemsAttSpara() {
      const ut = {};
      for (const [k, p] of Object.entries(lokal)) ut[k] = { x: r2(p.x), y: r2(p.y), z: Math.round(p.z ?? 0) };
      return ut;
    },

    /** En snapshot från servern (subscribeLayout). */
    fjarr(layout, { dragPagar = false } = {}) {
      if (!laddad) {
        laddad = true;
        ta(layout);
        return "ritad";
      }
      if (layout.version === bas.version) return "samma";
      if (osparat || dragPagar) {
        vantande = layout;
        return "vantar";
      }
      ta(layout);
      return "ritad";
    },

    /** Lokala placements ändrades (motorn har redan muterat objektet). */
    andrat() {
      osparat = !sammaLayout(lokal, bas.placedItems);
    },

    /** Drag/klick slut: en väntande version visas om inget är osparat. */
    efterDrag() {
      if (osparat || !vantande) return false;
      ta(vantande);
      return true;
    },

    /** "Visa deras": släpp lokala ändringar och visa den väntande versionen. */
    visaVantande() {
      if (!vantande) return false;
      ta(vantande);
      return true;
    },

    /** Sparningen/återställningen lyckades: plan = { version, placedItems, uid }. */
    sparat(plan) {
      bas = { placedItems: kopia(plan.placedItems), version: plan.version, updatedBy: plan.uid ?? null, updatedAt: null };
      osparat = !sammaLayout(lokal, bas.placedItems);
      if (vantande && vantande.version <= plan.version) vantande = null;
    },

    /** Återställd layout: visas direkt (ersätter lokala ändringar). */
    aterstallt(plan) {
      ta({ placedItems: plan.placedItems, version: plan.version, updatedBy: plan.uid ?? null, updatedAt: null });
    },

    rang: (nyckel) => lokal[nyckel]?.z ?? 0,

    /** Lägg en sak överst (z = högsta + 1; numrera om nära taket). */
    ovanpa(nyckel) {
      if (!lokal[nyckel]) return;
      const ovriga = Object.keys(lokal).filter((k) => k !== nyckel);
      const max = ovriga.reduce((m, k) => Math.max(m, lokal[k].z ?? 0), -1);
      if (max + 1 > KC_Z_MAX) {
        ovriga.sort((a, b) => (lokal[a].z ?? 0) - (lokal[b].z ?? 0)).forEach((k, i) => { lokal[k].z = i; });
        lokal[nyckel].z = ovriga.length;
      } else {
        lokal[nyckel].z = max + 1;
      }
    },
  };
}

/** Statusraden (ren – testas i Node). Tom sträng = dölj raden. */
export function statusHtml({ fel = "", laddad, kan, visaOnly, vantande, osparat, sparatNyss }) {
  if (fel) return fel;
  if (!laddad) return "Hämtar rummet…";
  if (!kan) {
    return visaOnly
      ? "👀 Du är på besök – bara klassen själv kan inreda här. Hovra över sakerna och titta dig omkring!"
      : "👀 Du kan titta på rummet, men läraren har stängt av inredning för dig.";
  }
  if (vantande) {
    return `🔔 Någon i klassen sparade rummet nyss. <button type="button" class="kc-lank" data-kc="visa-deras">Visa deras</button>
      – eller tryck Spara för att använda din (deras finns kvar i Historik).`;
  }
  if (osparat) return "✏️ Ändringar som inte är sparade – tryck Spara så ser hela klassen dem.";
  if (sparatNyss) return "✓ Sparat! Alla i klassen ser nu rummet så här.";
  return "";
}
