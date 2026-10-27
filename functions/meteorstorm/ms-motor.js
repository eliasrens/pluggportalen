// ============================================================================
// Meteorstormen (#820): MOTORN – en deterministisk storm. Stationernas
// tillstånd räknas fram ur fröet, speltiden, klasserna och handlingsloggen.
// REN: ingen DOM, ingen Firebase, ingen Math.random()/Date.now(). Delas med
// servern (functions/meteorstorm/ är en genererad kopia – npm run sync:meteorstorm).
// Reglerna och alla tal: ms-balans.js. Kontraktet för B–E: docs/METEORSTORMEN.md.
//
// API
//   simulera({ seed, startMs, varaktighetMs, stationer, handlingar, installningar }, tMs)
//       → tillståndet vid tMs (se "Tillståndet" nedan). Samma indata → samma svar.
//         Billig att anropa varje bildruta: indata med samma frö/klasser/inställningar
//         återanvänder en motor (cache) som stegar vidare från senaste tid, och
//         spolar bara tillbaka till närmaste kontrollpunkt (var 5:e s) när loggen
//         ändrats FÖRE den tiden.
//   skapaMotor(cfg)      → { tillstand(tMs), satHandlingar(lista), laggTill(h), plan, cfg }
//                          (samma motor som simulera använder – för sim och projektor)
//   buildResultat        (ms-resultat.js, återexporterad) – slutet ur stationerna
//   Stationens mekanik (sköld, laser, nedslag): ms-station.js
//   Stegen 1–6 nedan: ms-steg.js · tillståndet ut: ms-utdata.js (utbrutna #824)
//   Serverns hjälpare (stormPlan, energiEffekt, kanAgera, effektPerTryck): ms-agera.js
//
// Indata
//   seed            tal eller sträng (sessionens msSeed)
//   startMs         serverns tid när stormen börjar (ms)
//   varaktighetMs   speltiden (5–20 min)
//   stationer       [{ classId, aktiva }] – aktiva = antal aktiva elever (fast för matchen)
//   handlingar      [{ id, t, classId, uid?, typ: "skold"|"laser"|"drag"|"spara", mal? }]
//                   t = serverns tidsstämpel (ms). Samma t ordnas på id (strängjämförelse).
//                   Okänd klass/typ ignoreras. En drag som inte är tillåten när den
//                   tillämpas ignoreras (servern ska redan ha nekat den).
//   installningar   { lage: "en-klass"|"klass-mot-klass", attacker: "av"|"milda"|"vilda" }
//
// Stegen (STEG_MS = 100 ms). Steg n flyttar tiden från (n−1)·STEG till n·STEG:
//   1. handlingar med t < startMs + n·STEG tillämpas (i ordning t, id)
//   2. meteorer i planen släpps (en kopia per station, id "<n>.<station>")
//   3. väntande dragstrålar fångar närmaste inkommande stormmeteor
//   4. lasrar avfyras (högst SKOTT_PER_STEG/station) mot meteorer inom räckvidd
//   5. meteorer som nått fram slår ner: skölden först, sedan skrovet
//   6. hjälpen till den som ligger efter räknas om
// tillstand(tMs) = efter steg floor((tMs − startMs)/STEG), klämt till [0, slut].
//
// Tillståndet
//   { tMs, speltidMs, kvarMs, klart,
//     stationer: [{ classId, skrov, skold, laddning, skott, nedskjutna, traffar,
//                   skadaTagen, hjalp, flyter, nollVidMs, handlingar: {skold,laser,drag},
//                   kastade, drag: { tillaten, kostnad, armerad, redoMs } }],
//     meteorer: [{ id, mal, pos, storlek, hp, bana, spawnMs, ankomstMs, kastadAv?, jatte? }],
//     handelser: [{ id, typ, startMs, slutMs }]   ← pågående (högst en)
//     logg: [{ t, typ, classId, … }]               ← allt som hänt, äldst först
//     bidrag: { uid: { skold, laser, drag, nedskjutna, kast } },
//     resultat?: (när klart) se ms-resultat.js }
//   pos ∈ [0,1] räknas för exakt tMs (mjuk rendering), allt annat på stegnätet.
// ============================================================================

import { STEG_MS, SKOLD_KLASSVARV, LASER_KLASSVARV, ATTACKER, DRAG_STOPP_FORE_SLUT_MS, perElevMilli } from "./ms-balans.js";
import { skapaPlan } from "./ms-storm.js";
import { normCfg, cfgNyckel, jamforHandling, normHandlingar, sammaHandling } from "./ms-indata.js";
import { buildResultat } from "./ms-resultat.js";
import { nyStation, klonaStation } from "./ms-station.js";
import { tillampa, slappMeteorer, dragstralar, lasrar, nedslag, hjalpen } from "./ms-steg.js";
import { utdata } from "./ms-utdata.js";

const KONTROLLPUNKT_STEG = 50;

// ---- Tillståndet (internt, heltal i MILLI) -------------------------------------

function klonaTillstand(S) {
  const bidrag = {};
  for (const u of Object.keys(S.bidrag)) bidrag[u] = { ...S.bidrag[u] };
  return {
    n: S.n, h: S.h, p: S.p, logg: S.logg.length,
    st: S.st.map(klonaStation), met: S.met.map((m) => ({ ...m })), bidrag,
  };
}

// ---- Motorn ------------------------------------------------------------------

export function skapaMotor(cfgIn) {
  const cfg = normCfg(cfgIn);
  const plan = skapaPlan(cfg.seed, cfg.varaktighetMs);
  const nSt = cfg.stationer.length;
  const kmk = cfg.installningar.lage === "klass-mot-klass" && nSt >= 2;
  const att = ATTACKER[cfg.installningar.attacker];
  // Motorns fasta del (ms-steg.js/ms-utdata.js) – ändras aldrig efter skapandet.
  const M = {
    cfg, plan, nSt, kmk, att,
    N: cfg.varaktighetMs / STEG_MS,
    stationIndex: new Map(cfg.stationer.map((s, i) => [s.classId, i])),
    dragTillaten: kmk && att.drag,
    dragSista: cfg.varaktighetMs - DRAG_STOPP_FORE_SLUT_MS,
    skoldPer: cfg.stationer.map((s) => perElevMilli(SKOLD_KLASSVARV, s.aktiva)),
    laserPer: cfg.stationer.map((s) => perElevMilli(LASER_KLASSVARV, s.aktiva)),
    abs: (rel) => cfg.startMs + rel,
  };
  const { stationIndex } = M;
  const handelseStart = new Map(plan.handelser.map((h) => [h.startMs, h]));

  let handlingar = [];
  let S = { n: 0, h: 0, p: 0, st: cfg.stationer.map(nyStation), met: [], logg: [], bidrag: {} };
  let kontroll = [klonaTillstand(S)];

  function steg() {
    const n = S.n + 1;
    const T = n * STEG_MS;
    // 1. handlingar
    while (S.h < handlingar.length && handlingar[S.h].t - cfg.startMs < T) tillampa(M, S, handlingar[S.h++], T);
    // händelser som börjar nu
    const hand = handelseStart.get(T);
    if (hand) S.logg.push(Object.freeze({ t: M.abs(T), typ: "handelse", handelse: hand.typ, slutMs: M.abs(hand.slutMs) }));
    slappMeteorer(M, S, T); // 2.
    dragstralar(M, S, T); // 3.
    lasrar(M, S, T); // 4.
    nedslag(M, S, T); // 5.
    hjalpen(M, S, T); // 6.
    S.n = n;
    if (n % KONTROLLPUNKT_STEG === 0 && kontroll.length === n / KONTROLLPUNKT_STEG) kontroll.push(klonaTillstand(S));
  }

  function aterstall(k) {
    const S0 = k;
    const logg = S.logg.slice(0, S0.logg);
    const bidrag = {};
    for (const u of Object.keys(S0.bidrag)) bidrag[u] = { ...S0.bidrag[u] };
    S = { n: S0.n, h: S0.h, p: S0.p, st: S0.st.map(klonaStation), met: S0.met.map((m) => ({ ...m })), logg, bidrag };
  }

  /**
   * Släpp kontrollpunkter som inte längre stämmer med loggen: de som tillämpat
   * fler än de maxH första (oförändrade) handlingarna, eller som ligger efter
   * relGrans (en ny handling med den tiden hade redan tillämpats där).
   */
  function rensaKontroll(maxH, relGrans) {
    let j = kontroll.length - 1;
    while (j > 0 && (kontroll[j].h > maxH || kontroll[j].n * STEG_MS > relGrans)) j--;
    kontroll.length = j + 1;
  }

  /**
   * Byt hela loggen (ge gärna en ny array – samma array jämförs ändå i sin
   * helhet). Ogiltiga kontrollpunkter släpps alltid; tillståndet spolas
   * tillbaka bara om en redan tillämpad handling ändrats eller om en ny
   * handling har en tid före det redan beräknade.
   */
  function satHandlingar(lista) {
    const ny = normHandlingar(lista, stationIndex);
    let k = 0;
    const max = Math.min(ny.length, handlingar.length);
    while (k < max && sammaHandling(ny[k], handlingar[k])) k++;
    if (k === ny.length && k === handlingar.length) return;
    handlingar = ny;
    const relNy = k < ny.length ? ny[k].t - cfg.startMs : Infinity;
    rensaKontroll(k, relNy);
    if (k >= S.h && relNy >= S.n * STEG_MS) return;
    let j = kontroll.length - 1;
    while (j > 0 && kontroll[j].n > S.n) j--;
    aterstall(kontroll[j]);
  }

  /** Lägg till en handling (snabbväg när den kommer sist och efter det redan beräknade). */
  function laggTill(h) {
    const [n] = normHandlingar([h], stationIndex);
    if (!n) return;
    const sist = handlingar[handlingar.length - 1];
    if ((!sist || jamforHandling(sist, n) <= 0) && n.t - cfg.startMs >= S.n * STEG_MS) {
      handlingar.push(n);
      rensaKontroll(handlingar.length, n.t - cfg.startMs);
      return;
    }
    satHandlingar([...handlingar, n]);
  }

  function stegTill(n) {
    if (n < S.n) {
      const j = Math.floor(n / KONTROLLPUNKT_STEG);
      aterstall(kontroll[Math.min(j, kontroll.length - 1)]);
    }
    while (S.n < n) steg();
  }

  function tillstand(tMs) {
    const rel = Math.min(cfg.varaktighetMs, Math.max(0, Number(tMs) - cfg.startMs));
    const n = Math.floor(rel / STEG_MS);
    stegTill(n);
    return utdata(M, S, Number.isFinite(rel) ? rel : 0);
  }

  return {
    cfg, plan, tillstand, satHandlingar, laggTill,
    /** Antal beräknade steg just nu (för tester av cachen). */
    get steg() { return S.n; },
  };
}

// ---- simulera (cachad) ---------------------------------------------------------

const motorCache = new Map();
const CACHE_MAX = 4;

function motorFor(input) {
  const cfg = normCfg(input);
  const nyckel = cfgNyckel(cfg);
  let m = motorCache.get(nyckel);
  if (m) {
    motorCache.delete(nyckel);
  } else {
    m = skapaMotor(cfg);
    if (motorCache.size >= CACHE_MAX) motorCache.delete(motorCache.keys().next().value);
  }
  motorCache.set(nyckel, m);
  return m;
}

/** Tillståndet vid tMs (se filhuvudet). Deterministisk; cachen ändrar aldrig svaret. */
export function simulera(input, tMs) {
  const m = motorFor(input);
  m.satHandlingar(input?.handlingar || []);
  return m.tillstand(tMs);
}


export { buildResultat };
