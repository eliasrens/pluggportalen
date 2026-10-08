// ============================================================================
// Klasscentret – shoppens "Klasscentrum"-kort: ren HTML + beloppslogik (#488).
// ----------------------------------------------------------------------------
// Ingen DOM, ingen Firestore (testas i Node: test/kc-shop-kort.test.js).
// kc-shop-vy.js monterar korten, prenumererar på insamlingen och skickar
// donationerna. Laddas BARA dynamiskt (via kc-shop-vy.js, #271).
//
// Anonymt (BESLUT, spec §4): korten visar bara klassens totalsumma – aldrig
// vem som donerat. "Du har bidragit med X" är elevens EGEN siffra (räknas
// lokalt i kc-shop-vy.js), inga andras uid läses.
//
// API
//   SNABBVAL                               [10, 50, 100, 500]
//   donationsGrans(fund, coins)            → { saknas, max, kopt }
//       max = det mest eleven kan skänka nu = min(saldo, det som saknas)
//   klampaBelopp(v, max)                   → heltal 0..max (0 = ogiltigt)
//   snabbvalLista(grans)                   → [{ belopp, etikett, av }]
//   kortHtml(item, fund, { coins, bidrag, bild })   → hela kortet
//   matareHtml(fund, bidrag)               → mätaren ("150 / 5000 mynt insamlade")
//   handlingHtml(fund, coins, kassa?)      → "Donera"-knappen eller "Köpt!";
//       kassa = { kan, saldo } (#526): kassör/lärare får "Från klasskassan"
//   panelHtml(grans, belopp, { kassa? })   → donationspanelen (snabbval + fält);
//       kassa:true = samma panel men beloppet tas ur klasskassan
//   skankText(belopp, kassa)               → knapptexten i panelen
// ============================================================================

export const SNABBVAL = Object.freeze([10, 50, 100, 500]);

const tal = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("sv-SE");

/** Hur mycket som saknas och hur mycket eleven kan skänka just nu. */
export function donationsGrans(fund, coins) {
  const mal = Math.max(0, Math.floor(Number(fund?.targetPrice) || 0));
  const insamlat = Math.max(0, Math.floor(Number(fund?.fundedAmount) || 0));
  const saknas = Math.max(0, mal - insamlat);
  const kopt = fund?.isUnlocked === true || saknas === 0;
  const saldo = Math.max(0, Math.floor(Number(coins) || 0));
  return { saknas, max: kopt ? 0 : Math.min(saldo, saknas), kopt };
}

/** Beloppet ur fältet, klampat till 0..max (0 = inget giltigt belopp). */
export function klampaBelopp(v, max) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(n, Math.max(0, Math.floor(Number(max) || 0)));
}

/**
 * Snabbvalen. Belopp över max blir avstängda (inte tysta klamp – barnet ser
 * varför). Saknas det mindre än största snabbvalet och eleven har råd med
 * resten läggs "Resten" till, så klassen kan nå exakt 100 %.
 */
export function snabbvalLista({ saknas, max }) {
  const lista = SNABBVAL.map((b) => ({ belopp: b, etikett: String(b), av: b > max }));
  if (saknas > 0 && saknas <= max && !SNABBVAL.includes(saknas) && saknas < SNABBVAL[SNABBVAL.length - 1]) {
    lista.push({ belopp: saknas, etikett: `Resten (${tal(saknas)})`, av: false });
  }
  return lista;
}

/** Mätaren: progress bar + "150 / 5000 mynt insamlade" (+ elevens eget bidrag). */
export function matareHtml(fund, bidrag = 0) {
  const mal = Math.max(1, Math.floor(Number(fund?.targetPrice) || 0));
  const insamlat = Math.min(mal, Math.max(0, Math.floor(Number(fund?.fundedAmount) || 0)));
  const pct = Math.round((insamlat / mal) * 1000) / 10;
  const eget = bidrag > 0 ? `<div class="kcs-eget">Du har bidragit med ${tal(bidrag)} mynt 💛</div>` : "";
  return `<div class="kcs-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${mal}"
      aria-valuenow="${insamlat}" aria-label="Insamlat">
      <div class="kcs-bar-fyll" style="width:${pct}%"></div>
    </div>
    <div class="kcs-insamlat"><b>${tal(insamlat)}</b> / ${tal(mal)} mynt insamlade</div>${eget}`;
}

/**
 * Knappraden: "Köpt!" vid 100 %, annars "Donera" (avstängd utan mynt). Är
 * eleven kassör (kassa.kan) finns även "Från klasskassan" (avstängd när
 * kassan är tom).
 */
export function handlingHtml(fund, coins, kassa = null) {
  const g = donationsGrans(fund, coins);
  if (g.kopt) {
    return `<div class="kcs-kopt">✓ Köpt! Finns i klassens möbellåda</div>`;
  }
  const egen = g.max < 1
    ? `<button type="button" class="buy-btn nej" disabled title="Du har inga mynt just nu">Donera</button>`
    : `<button type="button" class="buy-btn kcs-donera">Donera 💛</button>`;
  if (!kassa?.kan) return egen;
  const tom = Math.floor(Number(kassa.saldo) || 0) < 1;
  return `<div class="kcs-knappar">${egen}<button type="button" class="buy-btn kcs-fran-kassan"${tom
    ? ` disabled title="Klasskassan är tom"` : ""}>🏦 Från klasskassan</button></div>`;
}

/** Panelens skicka-knapp: "Skänk 50" / "Lägg 50 från kassan". */
export function skankText(belopp, kassa = false) {
  if (!belopp) return kassa ? "Lägg från kassan" : "Skänk";
  return kassa ? `Lägg ${tal(belopp)} från kassan` : `Skänk ${tal(belopp)}`;
}

/** Donationspanelen (öppnas i kortet): snabbval, fritt fält, skänk/avbryt. */
export function panelHtml(grans, belopp = 0, { kassa = false } = {}) {
  const b = klampaBelopp(belopp, grans.max);
  const chips = snabbvalLista(grans)
    .map((c) => `<button type="button" class="kcs-chip${c.belopp === b ? " active" : ""}"
      data-belopp="${c.belopp}"${c.av ? " disabled" : ""}>${c.etikett}</button>`)
    .join("");
  return `<div class="kcs-panel${kassa ? " kcs-panel-kassa" : ""}">
    ${kassa ? `<div class="kcs-panel-rubrik">🏦 Från klasskassan</div>` : ""}
    <div class="kcs-saknas">Bara <b>${tal(grans.saknas)}</b> mynt saknas!</div>
    <div class="kcs-chips">${chips}</div>
    <label class="kcs-falt">Eget belopp
      <input type="number" class="kcs-belopp" inputmode="numeric" min="1" max="${grans.max}"
        step="1" value="${b || ""}" placeholder="1–${grans.max}" />
    </label>
    <div class="kcs-maxinfo">${kassa ? `Högst ${tal(grans.max)} mynt ur kassan.` : `Du kan skänka högst ${tal(grans.max)} mynt.`}</div>
    <div class="kcs-panel-knappar">
      <button type="button" class="kcs-avbryt">Avbryt</button>
      <button type="button" class="buy-btn kcs-skank"${b ? "" : " disabled"}>${skankText(b, kassa)}</button>
    </div>
  </div>`;
}

/** Hela kortet. bild = konstens <svg> (eller null → katalogens emoji). */
export function kortHtml(item, fund, { coins = 0, bidrag = 0, bild = null, kassa = null } = {}) {
  const kopt = donationsGrans(fund, coins).kopt;
  return `<div class="shop-card kcs-kort${kopt ? " is-owned" : ""}" data-kc="${item.id}">
    <div class="kcs-bild kcs-bild-${item.zon}">${bild || `<span class="kcs-emoji">${item.emoji}</span>`}</div>
    <div class="shop-namn">${item.namn}</div>
    <div class="kcs-mal">Mål: ${tal(item.targetPrice)} mynt</div>
    <div class="kcs-matare">${matareHtml(fund, bidrag)}</div>
    <div class="kcs-handling">${handlingHtml(fund, coins, kassa)}</div>
  </div>`;
}
