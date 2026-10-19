// ============================================================================
// Schack – lärarens sektion, de rena delarna (#781, spec §10). Ingen DOM och
// ingen Firebase: modulvalet, statistiken, topplistan, partilistan, åskådar-
// brädets inställningar, dragsynken, slutet och vakten som stänger lyssnarna.
// Markupen ligger i schack-larare-markup.js. Testas i test/schack-larare.test.js.
// ============================================================================

import { normalizeEnabledModules, normalizeHiddenModules } from "../../gamemode-visibility.js";
import { tabellRad, topplista } from "../schack-server-delat.js";

export const MODUL = "schack";

/**
 * Åskådarbrädet: samma bräde som Etapp 1, men ingen får flytta (interaktiv:
 * false), ingen beforeMove och vit nederst. Dragen kommer bara från servern
 * (brade.move/loadGame ur lyssnaren).
 */
export const ASKADAR_OPT = Object.freeze({ egenFarg: null, motstandare: "kompis", interaktiv: false, orientering: "w" });

/** Är schack på för klassen? (opt-in: i enabledModules och inte dold.) */
export function schackPa(cls) {
  return normalizeEnabledModules(cls?.enabledModules).includes(MODUL) && !normalizeHiddenModules(cls?.hiddenModules).includes(MODUL);
}

/** Klassens nya { hidden, enabled } när schack slås på/av – övriga moduler orörda. */
export function modulAndring(cls, pa) {
  const dolda = normalizeHiddenModules(cls?.hiddenModules);
  const enabled = normalizeEnabledModules(cls?.enabledModules).filter((id) => id !== MODUL);
  if (pa) enabled.push(MODUL);
  // På: inte heller dold. Av: räcker att ta bort den ur enabledModules.
  return { hidden: pa ? dolda.filter((id) => id !== MODUL) : dolda, enabled };
}

/** Elev-id → namn: lärarsidans elevlista först, sedan projektionen, sist reserv. */
export function skapaNamnFor(students = [], members = {}) {
  const lista = new Map((students || []).map((s) => [s.id, s.namn]));
  return (uid) => lista.get(uid) || (members && Object.hasOwn(members, uid) && members[uid]?.namn) || "Okänd elev";
}

/** Id som namnFor inte känner igen (behöver projektionen). */
export function okandaId(ids, students = []) {
  const kanda = new Set((students || []).map((s) => s.id));
  return [...new Set(ids)].filter((id) => id && !kanda.has(id));
}

/** "m:ss" (och "h:mm:ss" över en timme); null/Infinity → "". */
export function klockText(ms) {
  if (ms == null || !Number.isFinite(ms)) return "";
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Klocktypen i klartext: null → "Utan klocka", 10 → "10 min". */
export const klockTyp = (k) => (Number.isFinite(k) && k > 0 ? `${k} min` : "Utan klocka");

/** Pågående partier ur schackKlass.partier, äldst först. */
export function partiRader(partier) {
  return Object.entries(partier || {})
    .filter(([id, p]) => id && p && typeof p === "object")
    .map(([id, p]) => ({
      id,
      vit: p.vit, svart: p.svart,
      vitNamn: p.vitNamn || "Vit", svartNamn: p.svartNamn || "Svart",
      klocka: Number.isFinite(p.klocka) ? p.klocka : null,
      start: Number.isFinite(p.start) ? p.start : 0,
    }))
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/**
 * Statistiken per elev i klassen: partier mot kompisar (tabell[uid].partier)
 * och mot datorn (studentData.schack.datorPartier; null = inte hämtat/nekat).
 * @param {string[]} studentIds
 * @param {{ tabell?: object, dator?: Map<string, number|null>|null, namnFor: (uid:string)=>string }} o
 */
export function statistikRader(studentIds, { tabell = {}, dator = null, namnFor }) {
  return [...new Set(studentIds || [])]
    .filter(Boolean)
    .map((uid) => {
      const r = tabellRad(tabell, uid);
      const d = dator ? dator.get(uid) : undefined;
      const datorAntal = Number.isFinite(d) ? d : null; // null = inte hämtat eller nekat
      return {
        uid, namn: namnFor(uid),
        kompis: r.partier, vinster: r.vinster, forluster: r.forluster, remier: r.remier,
        dator: datorAntal,
        totalt: r.partier + (datorAntal || 0),
      };
    })
    .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
}

/** Klassens summa: { kompis, dator } (kompispartier räknas en gång per parti, inte per spelare). */
export function statistikSumma(rader) {
  const kompis = Math.round(rader.reduce((s, r) => s + r.kompis, 0) / 2);
  const dator = rader.some((r) => r.dator != null) ? rader.reduce((s, r) => s + (r.dator || 0), 0) : null;
  return { kompis, dator };
}

/** studentData-dokumentet → antal datorpartier (saknat/trasigt = 0). */
export function datorPartierUr(data) {
  const v = data?.schack?.datorPartier;
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export { topplista };

/**
 * Hur brädet ska gå från de drag det visar till serverns: { nya } om servern
 * bara lagt till drag (spela dem med move – det sista glider), annars null
 * (ladda om hela partiet med loadGame).
 */
export function synkaDrag(visade, server) {
  const a = Array.isArray(visade) ? visade : [];
  const b = Array.isArray(server) ? server : [];
  if (b.length < a.length) return null;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return null;
  return { nya: b.slice(a.length) };
}

const VINNARE = { "1-0": "w", "0-1": "b" };

/**
 * Serverns slut som brädets avsluta()-argument: titel och förklaring för
 * läraren. Matt/patt/remi enligt reglerna (brädet ser dem själv) får också en
 * rad, så att avbrutet/gav upp/tid/lämnade aldrig ser ut som "Vit drar".
 */
export function slutInfo(p) {
  if (!p || p.status !== "slut") return null;
  const vinnare = VINNARE[p.resultat] || null;
  const namn = { w: p.vitNamn || "Vit", b: p.svartNamn || "Svart" };
  const forlorare = vinnare === "w" ? "b" : vinnare === "b" ? "w" : null;
  const vann = vinnare ? `${namn[vinnare]} vann` : "Ingen vann";
  const text = {
    matt: "Schack matt.",
    patt: "Patt – den som var på tur kunde inte flytta.",
    remi: "Remi.",
    "gav-upp": forlorare ? `${namn[forlorare]} gav upp.` : "Någon gav upp.",
    tid: forlorare ? `${namn[forlorare]}s tid tog slut.` : "Tiden tog slut.",
    lamnade: forlorare ? `${namn[forlorare]} lämnade partiet.` : "Någon lämnade partiet.",
    avbrutet: "Ingen vann – topplistan påverkades inte.",
  }[p.orsak] || "Partiet är slut.";
  const titel = p.orsak === "avbrutet" ? "Partiet avbröts" : vinnare ? `${vann}!` : "Remi – ingen vann";
  return { resultat: p.resultat || "½-½", orsak: p.orsak || "avbrutet", vinnare, titel, text };
}

/** Vem är på tur i klartext: "Alva (vit) drar". */
export function turText(p) {
  if (!p || p.status !== "pagar") return "";
  return p.tur === "b" ? `${p.svartNamn || "Svart"} (svart) drar` : `${p.vitNamn || "Vit"} (vit) drar`;
}

/**
 * Vakten som stänger allt sektionen öppnat (lyssnare, intervall) när den
 * lämnas: när `arKvar()` blir falskt (värden har lämnat DOM:en – annan flik,
 * annan klass, annan sida) eller vid hashchange. `lagg(stopp)` registrerar en
 * avstängning; efter att vakten stängts körs en ny avstängning direkt.
 */
export function skapaVakt(arKvar, { ms = 1000, timers = globalThis, fonster = globalThis.window } = {}) {
  const stopp = new Set();
  let stangd = false;
  const stang = () => {
    if (stangd) return;
    stangd = true;
    timers.clearInterval(tick);
    fonster?.removeEventListener?.("hashchange", viaHash);
    for (const fn of stopp) {
      try { fn(); } catch (err) { console.error("schack: avstängning", err); }
    }
    stopp.clear();
  };
  function kontrollera() {
    if (!stangd && !arKvar()) stang();
    return !stangd;
  }
  // Efter routerns omritning (direkt efter hashchange) har värden lämnat DOM:en.
  const viaHash = () => timers.setTimeout(kontrollera, 0);
  const tick = timers.setInterval(kontrollera, ms);
  fonster?.addEventListener?.("hashchange", viaHash);
  return {
    lagg(fn) {
      if (typeof fn !== "function") return () => {};
      if (stangd) {
        fn();
        return () => {};
      }
      stopp.add(fn);
      return () => {
        if (stopp.delete(fn)) fn();
      };
    },
    kontrollera,
    stang,
    get stangd() {
      return stangd;
    },
    get antal() {
      return stopp.size;
    },
  };
}
