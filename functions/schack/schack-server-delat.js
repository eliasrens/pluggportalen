// ============================================================================
// Schack – ren logik som DELAS av klienten och servern (#779, Etapp 2A)
// ----------------------------------------------------------------------------
// Inga importer, inget DOM, ingen Firebase: samma fil körs i webbläsaren
// (klockvisningen i 2B, lobbyns filtrering) och i Cloud Functions (kopian
// functions/schack/schack-server-delat.js – admin/sync-schack-functions.mjs,
// redigera ALDRIG kopian). Alla tider är epoch-ms från SERVERNS klocka (`nu`);
// klienten räknar bara om för visning (serverNow), aldrig för beslut.
//
//   klockan      nyKlocka, klockaNu, klockaEfterDrag, tidSlut      (§7.2)
//   lämnat       harLamnat (5 min), arGammalt (24 h)                 (§7.3)
//   fokusläget   activeLockMal (aktivt lås = schacket stängt)
//   lobbyn       normaliseraKlocka, rensaLobby, partiFor             (§7.1)
//   topplistan   nyPoang, uppdateraTabell, tabellRad (Elo-lik, golv 800) (§8)
// ============================================================================

/** Tillåtna klockval: ingen klocka eller minuter per spelare (§7.1). */
export const KLOCKOR = Object.freeze([null, 5, 10, 15]);
/** En utmaning försvinner efter 2 min, en väntan efter 10 min (§7.1). */
export const UTMANING_MS = 2 * 60_000;
export const VANTAN_MS = 10 * 60_000;
/** Utan klocka: motståndaren får kräva vinst när den på tur inte dragit på 5 min (§7.3). */
export const LAMNAT_MS = 5 * 60_000;
/** 2B visar "Din tur! Om en minut kan din motståndare avsluta partiet" efter 4 min. */
export const LAMNAT_VARNING_MS = 4 * 60_000;
/** Ett parti utan drag på 24 h avslutas som avbrutet (§7.3). */
export const GAMMALT_MS = 24 * 60 * 60_000;
/** Topplistan (§8): start, golv och spannen för vinst/förlust. */
export const START_POANG = 1000;
export const GOLV_POANG = 800;
export const VINST_MIN = 10;
export const VINST_MAX = 30;
export const FORLUST_MIN = 5;
export const FORLUST_MAX = 20;
export const REMI_MAX = 5;

/** null | 5 | 10 | 15, eller undefined när värdet inte är ett giltigt klockval. */
export function normaliseraKlocka(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (n === 0) return null;
  return KLOCKOR.includes(n) ? n : undefined;
}

// --- klockan (§7.2) ---------------------------------------------------------------

/** En ny klocka vid partiets start: båda har hela tiden, den på tur (vit) börjar räkna nu. */
export function nyKlocka(minuter, nu) {
  const ms = minuter * 60_000;
  return { minuter, vitMs: ms, svartMs: ms, senastDragAt: nu };
}

const sidaMs = (klocka, tur) => (tur === "w" ? klocka.vitMs : klocka.svartMs);

/**
 * Klockorna just nu: den på tur har förbrukat tiden sedan senaste draget.
 * @returns {{ vitMs:number, svartMs:number, slut:boolean }} slut = den på tur har 0 kvar
 */
export function klockaNu(klocka, tur, nu) {
  if (!klocka) return { vitMs: Infinity, svartMs: Infinity, slut: false };
  const kvar = Math.max(0, sidaMs(klocka, tur) - Math.max(0, nu - klocka.senastDragAt));
  return {
    vitMs: tur === "w" ? kvar : klocka.vitMs,
    svartMs: tur === "b" ? kvar : klocka.svartMs,
    slut: kvar <= 0,
  };
}

/** Har den på tur fått slut på tid (serverns klocka)? */
export function tidSlut(klocka, tur, nu) {
  return Boolean(klocka) && klockaNu(klocka, tur, nu).slut;
}

/**
 * Klockan efter ett drag av `tur`: den förbrukade tiden dras, nästa spelares
 * tid börjar räkna från `nu`. null om tiden redan var slut (draget är ogiltigt).
 */
export function klockaEfterDrag(klocka, tur, nu) {
  if (!klocka) return null;
  const k = klockaNu(klocka, tur, nu);
  if (k.slut) return null;
  return { minuter: klocka.minuter, vitMs: k.vitMs, svartMs: k.svartMs, senastDragAt: nu };
}

/** Utan klocka: den på tur har inte dragit på 5 min → motståndaren får kräva vinst (§7.3). */
export const harLamnat = (senastDragAt, nu) => nu - senastDragAt >= LAMNAT_MS;
/** 24 h utan drag → partiet avbryts utan tabellpåverkan (§7.3). */
export const arGammalt = (senastDragAt, nu) => nu - senastDragAt >= GAMMALT_MS;

// --- fokusläget ----------------------------------------------------------------

/**
 * Målet för ett AKTIVT fokuslås på klassen (`lock.till` i framtiden) eller null –
 * samma tolkning som src/class-lock.js activeLock. Schack är inte låsbart, så
 * varje aktivt lås stänger schacket (docs/FOKUSLAGE.md).
 */
export function activeLockMal(lock, nu) {
  if (!lock || typeof lock !== "object") return null;
  if (typeof lock.mal?.typ !== "string") return null;
  const till = Number(lock.till);
  if (!Number.isFinite(till) || till <= nu) return null;
  return lock.mal;
}

// --- lobbyn (§7.1) ----------------------------------------------------------------

const utgangen = (post, maxMs, nu) => !post || typeof post.sedan !== "number" || nu - post.sedan >= maxMs;

/**
 * Lobbyn utan utgångna poster: väntan äldre än 10 min och utmaningar äldre än
 * 2 min filtreras bort. Servern anropar den i varje skrivning av klass-
 * dokumentet (inga skrivningar per sekund – ingen behöver "pinga"), klienten
 * vid varje visning (så försvinner de även utan skrivning).
 * @returns {{ vantar:object, utmaningar:object, andrad:boolean }}
 */
export function rensaLobby(klass, nu) {
  const vantar = {};
  const utmaningar = {};
  let andrad = false;
  for (const [uid, v] of Object.entries(klass?.vantar || {})) {
    if (utgangen(v, VANTAN_MS, nu)) andrad = true;
    else vantar[uid] = v;
  }
  for (const [id, u] of Object.entries(klass?.utmaningar || {})) {
    if (utgangen(u, UTMANING_MS, nu)) andrad = true;
    else utmaningar[id] = u;
  }
  return { vantar, utmaningar, andrad };
}

/** Elevens pågående kompisparti i klassen (partiId) eller null – "ett parti åt gången" (§7.1). */
export function partiFor(partier, uid) {
  for (const [id, p] of Object.entries(partier || {})) {
    if (p && (p.vit === uid || p.svart === uid)) return id;
  }
  return null;
}

// --- topplistan (§8) ---------------------------------------------------------------

/** Elos förväntade utfall för A mot B (0–1). */
export const forvantat = (poangA, poangB) => 1 / (1 + 10 ** ((poangB - poangA) / 400));

/**
 * Poängändringen för en spelare: utfall 1 (vinst), 0 (förlust) eller 0.5 (remi).
 * Vinst ger +10 (mot någon mycket svagare) … +30 (mot någon mycket starkare),
 * förlust −5 (mot starkare) … −20 (mot svagare), remi −5 … +5. En Elo-liknande
 * formel med låg K: spannet är (max − min) och det förväntade utfallet styr var
 * i spannet man hamnar.
 */
export function poangDelta(egen, motstandare, utfall) {
  const e = forvantat(egen, motstandare);
  if (utfall === 1) return Math.round(VINST_MIN + (VINST_MAX - VINST_MIN) * (1 - e));
  if (utfall === 0) return -Math.round(FORLUST_MIN + (FORLUST_MAX - FORLUST_MIN) * e);
  return Math.round(2 * REMI_MAX * (0.5 - e));
}

/** Ny poäng efter ett parti – aldrig under golvet 800. */
export function nyPoang(egen, motstandare, utfall) {
  return Math.max(GOLV_POANG, egen + poangDelta(egen, motstandare, utfall));
}

/** En tabellrad med alla fält (saknad rad = nybörjare på 1000). */
export function tabellRad(tabell, uid) {
  const r = (tabell && Object.hasOwn(tabell, uid) && tabell[uid]) || {};
  const n = (v) => (Number.isFinite(v) ? v : 0);
  return {
    poang: Number.isFinite(r.poang) ? r.poang : START_POANG,
    vinster: n(r.vinster), forluster: n(r.forluster), remier: n(r.remier), partier: n(r.partier),
  };
}

/** Utfallet för vit och svart ur resultatet "1-0" | "0-1" | "½-½". */
export function utfallFor(resultat) {
  if (resultat === "1-0") return { w: 1, b: 0 };
  if (resultat === "0-1") return { w: 0, b: 1 };
  return { w: 0.5, b: 0.5 };
}

/**
 * Tabellen efter ett avslutat parti (båda raderna räknas ur samma gamla poäng,
 * så ordningen spelar ingen roll). Ett avbrutet parti ska INTE hit.
 * @returns {{ [uid]: { poang, vinster, forluster, remier, partier } }} bara de två raderna
 */
export function uppdateraTabell(tabell, { vit, svart, resultat }) {
  const v = tabellRad(tabell, vit);
  const s = tabellRad(tabell, svart);
  const u = utfallFor(resultat);
  const rad = (gammal, egen, motst, utfall) => ({
    poang: nyPoang(egen, motst, utfall),
    vinster: gammal.vinster + (utfall === 1 ? 1 : 0),
    forluster: gammal.forluster + (utfall === 0 ? 1 : 0),
    remier: gammal.remier + (utfall === 0.5 ? 1 : 0),
    partier: gammal.partier + 1,
  });
  return { [vit]: rad(v, v.poang, s.poang, u.w), [svart]: rad(s, s.poang, v.poang, u.b) };
}

/** Topplistan sorterad: poäng, sedan vinster, sedan namn (stabil). */
export function topplista(tabell, namnFor = () => "") {
  return Object.keys(tabell || {})
    .map((uid) => ({ uid, namn: namnFor(uid), ...tabellRad(tabell, uid) }))
    .sort((a, b) => b.poang - a.poang || b.vinster - a.vinster || a.namn.localeCompare(b.namn, "sv"))
    .map((r, i) => ({ ...r, plats: i + 1 }));
}
