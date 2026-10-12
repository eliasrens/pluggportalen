// ============================================================================
// Hitta rätt! – en omgångs logik på klienten (src/hitta-ratt/hr-omgang.js) · #608
// ----------------------------------------------------------------------------
// Ren modul (ingen DOM, inget Firebase) så att den kan testas i Node.
// Spelvyn (hr-spel.js) håller bara DOM och kartan – allt som går att räkna
// ligger här:
//
//   blanda(lista, slump?)       ny slumpad ordning per försök (§12), crypto som standard
//   skapaStoppur(nu?)           AKTIV tid (§11): går från att frågan blir aktiv
//                               till "Lås svar", står still under feedbacken
//   skapaOmgang(pack, ordning)  rättar varje lås direkt med SAMMA delade
//                               moduler som servern (delat/poang.js) och samlar
//                               svaren till hittaRattSubmit (arkitektur §4.1)
//   berom(p, nr) / omradeText   kort, varierad och positiv feedback (§6)
//   formatKm(km)                "34 km" · "1 240 km" · "under 1 km"
//
// Servern räknar om allt; klientens summa visas bara medan eleven spelar.
// Coins krediteras EN gång per omgång av functionen (result.godkanda).
// ============================================================================

import { poang, avstandKm, godkandPunkt } from "./delat/poang.js";
import { MIN_MS_PER_FRAGA } from "./delat/omgang.js";

/** Fisher–Yates med crypto.getRandomValues (eller en egen slump i tester). */
export function blanda(lista, slump = cryptoSlump) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(slump() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cryptoSlump() {
  const u = new Uint32Array(1);
  globalThis.crypto.getRandomValues(u);
  return u[0] / 2 ** 32;
}

/**
 * Stoppur för aktiv svarstid. `starta()` när frågan blir aktiv, `stoppa()` vid
 * lås → frågans ms. Mellan stoppa() och nästa starta() (feedbacken) går ingen
 * tid. `nuMs()` = total aktiv tid hittills (för klockan i vyn).
 */
export function skapaStoppur(nu = () => performance.now()) {
  let summa = 0;
  let start = null;
  return {
    starta() {
      if (start === null) start = nu();
    },
    stoppa() {
      if (start === null) return 0;
      const ms = Math.max(0, nu() - start);
      start = null;
      summa += ms;
      return ms;
    },
    get pagar() {
      return start !== null;
    },
    nuMs() {
      return summa + (start === null ? 0 : Math.max(0, nu() - start));
    },
  };
}

/**
 * Frågans ms till servern: heltal och minst serverns golv (700 ms). Ett lås
 * snabbare än golvet räknas som golvet – omgången ska inte nekas för det, och
 * Σms håller sig ändå under verklig tid eftersom feedbacken tar tid.
 */
export const serverMs = (ms) => Math.max(MIN_MS_PER_FRAGA, Math.round(Number(ms) || 0));

/**
 * En omgång. `ordning` = packens items i den ordning eleven får dem.
 *   lasPunkt(guess)  → { p, km, godkand }
 *   lasOmrade(id, ms)→ { ratt, godkand, valtNamn }
 *   svar()           → svaren till hittaRattSubmit (punkt { itemId, lon, lat } ·
 *                      område { itemId, omrade, ms })
 *   summa()          → { typ, n, besvarade, max, s | r,t, godkanda, snitt? }
 */
export function skapaOmgang(pack, ordning) {
  const typ = pack.type === "area" ? "area" : "point";
  const cfg = pack.scoringConfig || {};
  const namnFor = new Map(pack.items.filter((it) => it.omrade).map((it) => [it.omrade, it.name]));
  const svar = [];
  const utfall = [];
  let nr = 0;

  const aktuell = () => ordning[nr] || null;
  const krav = () => {
    const it = aktuell();
    if (!it) throw new Error("Omgången är slut.");
    if (svar.length > nr) throw new Error("Frågan är redan låst.");
    return it;
  };

  return {
    typ,
    get nr() { return nr; },
    get antal() { return ordning.length; },
    get aktuell() { return aktuell(); },
    get sista() { return nr === ordning.length - 1; },
    get klar() { return svar.length === ordning.length; },

    lasPunkt(guess) {
      const it = krav();
      const km = avstandKm([guess.lon, guess.lat], [it.lon, it.lat]);
      const p = poang(km, cfg);
      svar.push({ itemId: it.id, lon: guess.lon, lat: guess.lat });
      const u = { p, km, godkand: godkandPunkt(p) };
      utfall.push(u);
      return u;
    },

    lasOmrade(omrade, ms) {
      const it = krav();
      const ratt = omrade === it.omrade;
      const t = serverMs(ms);
      svar.push({ itemId: it.id, omrade, ms: t });
      const u = { ratt, godkand: ratt, ms: t, valtNamn: namnFor.get(omrade) || null };
      utfall.push(u);
      return u;
    },

    /** Till nästa fråga. false = omgången är slut. */
    nasta() {
      if (svar.length <= nr) throw new Error("Lås svaret först.");
      if (nr >= ordning.length - 1) return false;
      nr += 1;
      return true;
    },

    svar: () => svar.map((s) => ({ ...s })),

    summa() {
      const besvarade = utfall.length;
      const godkanda = utfall.filter((u) => u.godkand).length;
      if (typ === "area") {
        const r = utfall.filter((u) => u.ratt).length;
        const ms = utfall.reduce((s, u) => s + u.ms, 0);
        return { typ, n: ordning.length, besvarade, max: ordning.length, r, t: Math.round(ms / 100), godkanda };
      }
      const s = utfall.reduce((sum, u) => sum + u.p, 0);
      return { typ, n: ordning.length, besvarade, max: 100 * ordning.length, s, godkanda, snitt: snitt(s, besvarade) };
    },
  };
}

/** Snitt per plats, heltal (0 om inget besvarat). */
export const snitt = (s, n) => (n > 0 ? Math.round(s / n) : 0);

/** "34 km", "1 240 km" (sv-SE, hårt mellanslag), "under 1 km". */
export function formatKm(km) {
  const k = Number(km);
  if (!Number.isFinite(k)) return "";
  if (k < 1) return "under 1 km";
  return `${Math.round(k).toLocaleString("sv-SE")} km`;
}

/** Kort, varierad och positiv ton (§6). `nr` roterar varianterna. */
const BEROM = [
  [100, ["Fullträff!", "Mitt i prick!", "Pricksäkert!"]],
  [85, ["Otroligt nära!", "Jättenära!", "Snyggt!"]],
  [60, ["Nära!", "Bra där!", "Inte långt ifrån!"]],
  [1, ["Bra försök!", "På rätt spår!", "Det närmar sig!"]],
  [0, ["Nu vet du var den ligger!", "Kika var den ligger – nästa gång sitter den!", "Bra att lära sig!"]],
];

export function berom(p, nr = 0) {
  const [, lista] = BEROM.find(([min]) => p >= min) || BEROM[BEROM.length - 1];
  return lista[Math.abs(nr) % lista.length];
}

const RATT = ["Rätt!", "Helt rätt!", "Snyggt – rätt!"];

/**
 * Text efter ett områdessvar – rätt/fel står i ORD, inte bara som färg.
 * @returns {{ rubrik: string, text: string }}
 */
export function omradeText({ ratt, valtNamn }, namn, nr = 0) {
  if (ratt) return { rubrik: RATT[Math.abs(nr) % RATT.length], text: `Det här är ${namn}.` };
  return {
    rubrik: "Inte riktigt.",
    text: `${valtNamn ? `Du valde ${valtNamn}. ` : ""}${namn} är markerat i grönt.`,
  };
}
