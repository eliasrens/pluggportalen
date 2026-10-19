// ============================================================================
// Prov (#810, spec §5.6): helskärmsläget – ren logik, ingen Firebase/DOM
// (testas i test/prov-helskarm.test.js).
//   tillfället   helskarm: false stänger av (saknas = på, standard)
//                helskarmUndantag: [uid] – de eleverna skriver som utan helskärm
//   svar/{uid}   pausad, pausadAt, pausOrsak ("helskarm"|"flik"|"fokus"),
//                pausLogg [{ at: ms, orsak }], slapptInAt, helskarmFel
//                Antalet pauser är flikbyten (#748) – EN räknare, inte två.
// Extra tid när läraren släpper in: tillfällets extraTid (#748), +5 min.
// ============================================================================

import { EXTRA_TID_MAX, extraMin, flikbyteText, tolkaFlikbyten } from "./prov-anpassningar.js";

export const PAUS_ORSAKER = Object.freeze(["helskarm", "flik", "fokus"]);
// Fönstret får tappa fokus så här länge innan provet pausas (Alt+Tab, Windows-tangenten).
export const FOKUS_GRANS_MS = 2_000;
// Chrome lämnar helskärmen FÖRE flikbytet: vänta så här länge innan orsaken bestäms.
export const HELSKARM_VANTA_MS = 300;
// "+5 min" när läraren släpper in.
export const SLAPP_IN_EXTRA_MIN = 5;
// Så många pauser sparas med tid och orsak (reglerna: högst 200).
export const PAUS_LOGG_MAX = 200;
// "Släpp in alla": så många elever per batch (två skrivningar per elev med +5 min).
export const SLAPP_IN_BATCH = 200;

export const HJALPTEXT = "Helskärmsläget gör det svårare att fuska, men inte omöjligt.";
export const FORKLARING = "Provet visas i helskärm. Om du lämnar helskärmen pausas provet och din lärare måste släppa in dig igen.";

/** Är helskärmsläget på i tillfället (standard: på)? */
export const helskarmPa = (tf) => tf?.helskarm !== false;

/** Gäller helskärmsläget eleven? Av för tillfället, eller eleven undantagen → som förut. */
export function helskarmFor(tf, uid) {
  if (!helskarmPa(tf)) return false;
  return !(Array.isArray(tf?.helskarmUndantag) && tf.helskarmUndantag.includes(uid));
}

/** Lärarens undantag → det som sparas: bara elever som finns, inga dubbletter, högst 100. */
export function rensaUndantag(val, giltiga = null) {
  const ok = giltiga ? new Set(giltiga) : null;
  return [...new Set((val || []).filter((u) => typeof u === "string" && u && (!ok || ok.has(u))))].slice(0, 100);
}

export const arPausad = (svarDok) => svarDok?.pausad === true && svarDok?.inlamnad !== true;

/** Hur orsaken skrivs för läraren: "bytte flik" osv. */
export function orsakText(orsak) {
  if (orsak === "flik") return "bytte flik";
  if (orsak === "fokus") return "bytte program";
  if (orsak === "helskarm") return "gick ur helskärm";
  return "lämnade provet";
}

const klockslag = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Pausloggen tolkad: bara poster med en tid och en känd orsak. */
export function tolkaPausLogg(v) {
  return (Array.isArray(v) ? v : [])
    .filter((p) => p && Number.isFinite(p.at) && PAUS_ORSAKER.includes(p.orsak))
    .slice(-PAUS_LOGG_MAX);
}

/**
 * Elevens paus-skrivning (EN per paus): svaren, pausen och räknaren.
 * @param {{ flikbyten?: number, pausLogg?: object[] }} fore  det eleven vet om sitt svar
 * @param {string} orsak
 * @param {number} nu  serverns tid (ms) – loggens klockslag
 * @returns {{ flikbyten: number, pausLogg: object[], pausOrsak: string }}
 */
export function pausFalt(fore, orsak, nu) {
  const o = PAUS_ORSAKER.includes(orsak) ? orsak : "helskarm";
  return {
    pausOrsak: o,
    flikbyten: Math.min(tolkaFlikbyten(fore?.flikbyten) + 1, 10_000),
    pausLogg: [...tolkaPausLogg(fore?.pausLogg), { at: nu, orsak: o }].slice(-PAUS_LOGG_MAX),
  };
}

/**
 * Till rättningen: "Lämnade provet 2 gånger (10:42 bytte flik, 10:58 gick ur
 * helskärm)". Utan pauslogg (helskärmsläget av) som förut: "Lämnade provet 2 gånger".
 * Inget straffas – det är information till läraren.
 */
export function lamnadeText(svarDok) {
  const logg = tolkaPausLogg(svarDok?.pausLogg);
  const bas = flikbyteText(Math.max(tolkaFlikbyten(svarDok?.flikbyten), logg.length));
  if (!logg.length) return bas;
  return `${bas} (${logg.map((p) => `${klockslag(p.at)} ${orsakText(p.orsak)}`).join(", ")})`;
}

/** Raden överst i lärarens översikt: "⏸ Elias lämnade provet 10:42 (bytte flik)". */
export function pausRadText(namn, svarDok, pausadMs) {
  const nar = Number.isFinite(pausadMs) ? ` ${klockslag(pausadMs)}` : "";
  return `⏸ ${namn || "Okänd elev"} lämnade provet${nar} (${orsakText(svarDok?.pausOrsak)})`;
}

/** Elevens extra tid efter "+5 min" (aldrig över 240, reglernas gräns). */
export function extraEfterSlappIn(tf, uid, plus = SLAPP_IN_EXTRA_MIN) {
  return Math.min(extraMin(tf, uid) + plus, EXTRA_TID_MAX);
}

/**
 * Pausvakten: fullscreenchange (ur helskärm), visibilitychange (fliken dold)
 * och blur längre än FOKUS_GRANS_MS. Utbytbara beroenden så att den kan testas
 * utan webbläsare. onPaus(orsak) anropas högst en gång tills aterstall().
 * @param {object} o
 * @param {(orsak: string) => void} o.onPaus
 * @param {{ add, remove }} o.doc     document-liknande: addEventListener/removeEventListener + hidden + fullscreenElement
 * @param {{ add, remove }} o.win     window-liknande: addEventListener/removeEventListener
 * @param {() => boolean} [o.harFokus]  document.hasFocus()
 * @param {boolean} [o.kravHelskarm]    pausa när eleven lämnar helskärmen (av om helskärm inte gick)
 */
export function skapaPausvakt({ onPaus, doc, win, harFokus = () => true, kravHelskarm = true, timer = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) } }) {
  let aktiv = false;
  let pausad = false;
  let fokusTimer = null;
  let helskarmTimer = null;
  const rensa = () => {
    if (fokusTimer) timer.clear(fokusTimer);
    if (helskarmTimer) timer.clear(helskarmTimer);
    fokusTimer = helskarmTimer = null;
  };
  const paus = (orsak) => {
    if (!aktiv || pausad) return;
    pausad = true;
    rensa();
    onPaus(orsak);
  };
  // Ut ur helskärmen: Esc/F11 – eller ett flikbyte (Chrome lämnar helskärmen först).
  // Döljs fliken strax efter räknas det som ett flikbyte; annars "helskarm".
  const helskarm = () => {
    if (!kravHelskarm || doc.fullscreenElement || helskarmTimer || !aktiv || pausad) return;
    helskarmTimer = timer.set(() => {
      helskarmTimer = null;
      if (!doc.fullscreenElement) paus(doc.hidden ? "flik" : "helskarm");
    }, HELSKARM_VANTA_MS);
  };
  const synlighet = () => { if (doc.hidden) paus("flik"); };
  const blur = () => {
    if (!aktiv || pausad || fokusTimer) return;
    fokusTimer = timer.set(() => {
      fokusTimer = null;
      if (!harFokus()) paus("fokus");
    }, FOKUS_GRANS_MS);
  };
  const fokus = () => {
    if (fokusTimer) timer.clear(fokusTimer);
    fokusTimer = null;
  };
  return {
    starta() {
      if (aktiv) return;
      aktiv = true;
      doc.addEventListener("fullscreenchange", helskarm);
      doc.addEventListener("visibilitychange", synlighet);
      win.addEventListener("blur", blur);
      win.addEventListener("focus", fokus);
    },
    stoppa() {
      if (!aktiv) return;
      aktiv = false;
      rensa();
      doc.removeEventListener("fullscreenchange", helskarm);
      doc.removeEventListener("visibilitychange", synlighet);
      win.removeEventListener("blur", blur);
      win.removeEventListener("focus", fokus);
    },
    /** Läraren har släppt in eleven och hen är tillbaka i provet. */
    aterstall() { pausad = false; },
    /** Pausa nu (t.ex. eleven kom tillbaka till provet utan helskärm). */
    pausa: paus,
    /** Redan pausad (svaret säger det): vakten tyst tills aterstall(), utan onPaus. */
    markeraPausad() { pausad = true; },
    set kravHelskarm(v) { kravHelskarm = !!v; },
    get aktiv() { return aktiv; },
    get pausad() { return pausad; },
  };
}
