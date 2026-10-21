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

import {
  STEG_MS, MILLI, SKOLD_KLASSVARV, LASER_KLASSVARV,
  STORLEKAR, STORRE, LASER_RACKVIDD, SKOTT_PER_STEG, ATTACKER, KAST_FLYGTID_MS,
  HJALP_SKILLNAD, HJALP_DRAG_KOSTNAD, HJALP_SKOLD_FAKTOR, DRAG_STOPP_FORE_SLUT_MS, perElevMilli,
} from "./ms-balans.js";
import { skapaPlan, aktivHandelse } from "./ms-storm.js";
import { normCfg, cfgNyckel, jamforHandling, normHandlingar, sammaHandling } from "./ms-indata.js";
import { buildResultat } from "./ms-resultat.js";
import { nyStation, klonaStation, fyllSkold, laddaLaser, avfyra, slaNer } from "./ms-station.js";

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

function bidragFor(S, uid) {
  if (!uid) return null;
  return (S.bidrag[uid] ||= { skold: 0, laser: 0, drag: 0, nedskjutna: 0, kast: 0 });
}

// ---- Motorn ------------------------------------------------------------------

export function skapaMotor(cfgIn) {
  const cfg = normCfg(cfgIn);
  const plan = skapaPlan(cfg.seed, cfg.varaktighetMs);
  const N = cfg.varaktighetMs / STEG_MS;
  const nSt = cfg.stationer.length;
  const stationIndex = new Map(cfg.stationer.map((s, i) => [s.classId, i]));
  const kmk = cfg.installningar.lage === "klass-mot-klass" && nSt >= 2;
  const att = ATTACKER[cfg.installningar.attacker];
  const dragTillaten = kmk && att.drag;
  const skoldPer = cfg.stationer.map((s) => perElevMilli(SKOLD_KLASSVARV, s.aktiva));
  const laserPer = cfg.stationer.map((s) => perElevMilli(LASER_KLASSVARV, s.aktiva));
  const dragSista = cfg.varaktighetMs - DRAG_STOPP_FORE_SLUT_MS;
  const handelseStart = new Map(plan.handelser.map((h) => [h.startMs, h]));

  let handlingar = [];
  let senasteLista = null;
  let senasteLangd = -1;
  let S = { n: 0, h: 0, p: 0, st: cfg.stationer.map(nyStation), met: [], logg: [], bidrag: {} };
  let kontroll = [klonaTillstand(S)];

  const logga = (post) => S.logg.push(Object.freeze(post));
  const abs = (rel) => cfg.startMs + rel;

  function dragKostnadFor(st) {
    if (!dragTillaten) return 0;
    return st.hjalp ? Math.min(att.kostnad, HJALP_DRAG_KOSTNAD) : att.kostnad;
  }

  function dragMal(i, onskat) {
    const j = onskat ? stationIndex.get(onskat) : undefined;
    if (j !== undefined && j !== i) return j;
    let bast = -1;
    for (let k = 0; k < nSt; k++) {
      if (k === i) continue;
      const a = S.st[k];
      if (bast < 0) { bast = k; continue; }
      const b = S.st[bast];
      const aFlyter = a.skrov === 0;
      const bFlyter = b.skrov === 0;
      if (aFlyter !== bFlyter ? !aFlyter : a.skrov > b.skrov) bast = k;
    }
    return bast;
  }

  function tillampa(h, T) {
    const st = S.st[h.i];
    if (h.typ === "drag" && (!dragTillaten || st.armerad || T < st.dragRedo || T > dragSista)) return;
    if (h.typ === "spara") return;
    const b = bidragFor(S, h.uid);
    if (h.typ === "skold") {
      fyllSkold(st, st.hjalp ? Math.round(skoldPer[h.i] * HJALP_SKOLD_FAKTOR) : skoldPer[h.i]);
      st.antal.skold++;
      if (b) b.skold++;
    } else if (h.typ === "laser") {
      laddaLaser(st, laserPer[h.i], h.uid);
      st.antal.laser++;
      if (b) b.laser++;
    } else {
      st.armerad = { uid: h.uid, mal: h.mal, sedan: T };
      st.antal.drag++;
      if (b) b.drag++;
    }
  }

  const posVid = (m, T) => (T - m.spawnMs) / (m.ankomstMs - m.spawnMs);
  const forstAnkommer = (a, b) => a.ankomstMs - b.ankomstMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  function steg() {
    const n = S.n + 1;
    const T = n * STEG_MS;
    // 1. handlingar
    while (S.h < handlingar.length && handlingar[S.h].t - cfg.startMs < T) tillampa(handlingar[S.h++], T);
    // händelser som börjar nu
    const hand = handelseStart.get(T);
    if (hand) logga({ t: abs(T), typ: "handelse", handelse: hand.typ, slutMs: abs(hand.slutMs) });
    // 2. nya meteorer (spegelvänt: en per station)
    while (S.p < plan.meteorer.length && plan.meteorer[S.p].spawnMs <= T) {
      const pm = plan.meteorer[S.p++];
      for (let i = 0; i < nSt; i++) {
        S.met.push({
          id: `${pm.n}.${i}`, mal: i, storlek: pm.storlek, hp: STORLEKAR[pm.storlek].skott,
          bana: pm.bana, spawnMs: pm.spawnMs, ankomstMs: pm.ankomstMs, jatte: !!pm.jatte, kastadAv: -1,
        });
      }
    }
    // 3. dragstrålar
    for (let i = 0; i < nSt; i++) {
      const st = S.st[i];
      if (!st.armerad) continue;
      if (T > dragSista) { st.armerad = null; continue; }
      let fangst = null;
      for (const m of S.met) {
        if (m.mal !== i || m.jatte || m.kastadAv >= 0) continue;
        if (!fangst || forstAnkommer(m, fangst) < 0) fangst = m;
      }
      if (!fangst) continue;
      const mal = dragMal(i, st.armerad.mal);
      if (mal < 0) continue;
      const storlek = att.storre ? STORRE[fangst.storlek] || fangst.storlek : fangst.storlek;
      Object.assign(fangst, {
        mal, kastadAv: i, storlek, hp: STORLEKAR[storlek].skott, spawnMs: T, ankomstMs: T + KAST_FLYGTID_MS,
      });
      logga({ t: abs(T), typ: "kast", classId: cfg.stationer[i].classId, mot: cfg.stationer[mal].classId, uid: st.armerad.uid, storlek, meteor: fangst.id });
      const b = bidragFor(S, st.armerad.uid);
      if (b) b.kast++;
      st.kastade++;
      st.armerad = null;
      st.dragRedo = T + att.vantetidMs;
    }
    // 4. lasrar
    for (let i = 0; i < nSt; i++) {
      const st = S.st[i];
      for (let skott = 0; skott < SKOTT_PER_STEG && st.ladd >= MILLI; skott++) {
        let mal = null;
        for (const m of S.met) {
          if (m.mal !== i || posVid(m, T) < LASER_RACKVIDD) continue;
          if (!mal || forstAnkommer(m, mal) < 0) mal = m;
        }
        if (!mal) break;
        const uid = avfyra(st);
        mal.hp--;
        if (mal.hp > 0) continue;
        S.met.splice(S.met.indexOf(mal), 1);
        st.nedskjutna++;
        const b = bidragFor(S, uid);
        if (b) b.nedskjutna++;
        logga({
          t: abs(T), typ: "nedskjuten", classId: cfg.stationer[i].classId, uid, storlek: mal.storlek, meteor: mal.id,
          ...(mal.jatte ? { jatte: true } : {}),
          ...(mal.kastadAv >= 0 ? { fran: cfg.stationer[mal.kastadAv].classId } : {}),
        });
      }
    }
    // 5. nedslag
    const nere = S.met.filter((m) => m.ankomstMs <= T).sort(forstAnkommer);
    if (nere.length) {
      S.met = S.met.filter((m) => m.ankomstMs > T);
      for (const m of nere) {
        const st = S.st[m.mal];
        const classId = cfg.stationer[m.mal].classId;
        const extra = {
          storlek: m.storlek, meteor: m.id,
          ...(m.jatte ? { jatte: true } : {}),
          ...(m.kastadAv >= 0 ? { fran: cfg.stationer[m.kastadAv].classId } : {}),
        };
        if (st.skrov === 0) {
          logga({ t: abs(T), typ: "flyter", classId, ...extra });
          continue;
        }
        const { iSkold, iSkrov } = slaNer(st, STORLEKAR[m.storlek].skada * MILLI);
        logga({ t: abs(T), typ: iSkrov > 0 ? "traff" : "skold", classId, skold: iSkold / MILLI, skrov: iSkrov / MILLI, ...extra });
        if (st.skrov === 0 && st.noll === null) {
          st.noll = T;
          logga({ t: abs(T), typ: "noll", classId });
        }
      }
    }
    // 6. hjälpen
    if (kmk) {
      let max = 0;
      for (const st of S.st) max = Math.max(max, st.skrov);
      for (let i = 0; i < nSt; i++) {
        const st = S.st[i];
        const hjalp = max - st.skrov >= HJALP_SKILLNAD * MILLI;
        if (hjalp !== st.hjalp) logga({ t: abs(T), typ: hjalp ? "hjalp" : "hjalp-slut", classId: cfg.stationer[i].classId });
        st.hjalp = hjalp;
      }
    }
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
   * Byt hela loggen. Spolar tillbaka (till senaste kontrollpunkt före ändringen)
   * bara om en handling som redan tillämpats ändrats, eller om en ny handling
   * har en tid före det redan beräknade.
   */
  function satHandlingar(lista) {
    if (lista === senasteLista && Array.isArray(lista) && lista.length === senasteLangd) return;
    senasteLista = lista;
    senasteLangd = Array.isArray(lista) ? lista.length : 0;
    const ny = normHandlingar(lista, stationIndex);
    let k = 0;
    const max = Math.min(ny.length, handlingar.length);
    while (k < max && sammaHandling(ny[k], handlingar[k])) k++;
    handlingar = ny;
    const relNy = k < ny.length ? ny[k].t - cfg.startMs : Infinity;
    if (k >= S.h && relNy >= S.n * STEG_MS) return;
    let j = kontroll.length - 1;
    while (j > 0 && (kontroll[j].h > k || kontroll[j].n * STEG_MS > relNy || kontroll[j].n > S.n)) j--;
    kontroll.length = j + 1;
    aterstall(kontroll[j]);
  }

  /** Lägg till en handling (snabbväg när den kommer sist och efter det redan beräknade). */
  function laggTill(h) {
    const [n] = normHandlingar([h], stationIndex);
    if (!n) return;
    const sist = handlingar[handlingar.length - 1];
    if ((!sist || jamforHandling(sist, n) <= 0) && n.t - cfg.startMs >= S.n * STEG_MS) {
      handlingar.push(n);
      senasteLista = null;
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
    return utdata(Number.isFinite(rel) ? rel : 0);
  }

  function utdata(rel) {
    const T = S.n * STEG_MS;
    const stationer = S.st.map((st, i) => ({
      classId: cfg.stationer[i].classId,
      aktiva: cfg.stationer[i].aktiva,
      skrov: st.skrov / MILLI,
      skold: st.skold / MILLI,
      laddning: st.ladd / MILLI,
      skott: Math.floor(st.ladd / MILLI),
      nedskjutna: st.nedskjutna,
      traffar: st.traffar,
      skadaTagen: st.skada / MILLI,
      hjalp: st.hjalp,
      flyter: st.skrov === 0,
      nollVidMs: st.noll === null ? null : abs(st.noll),
      handlingar: { ...st.antal },
      kastade: st.kastade,
      drag: {
        tillaten: dragTillaten,
        kostnad: dragKostnadFor(st),
        armerad: !!st.armerad,
        redoMs: dragTillaten ? abs(st.dragRedo) : null,
      },
    }));
    const meteorer = S.met.map((m) => ({
      id: m.id, mal: cfg.stationer[m.mal].classId,
      pos: Math.min(1, Math.max(0, posVid(m, rel))),
      storlek: m.storlek, hp: m.hp, bana: m.bana,
      spawnMs: abs(m.spawnMs), ankomstMs: abs(m.ankomstMs),
      ...(m.jatte ? { jatte: true } : {}),
      ...(m.kastadAv >= 0 ? { kastadAv: cfg.stationer[m.kastadAv].classId } : {}),
    }));
    const h = aktivHandelse(plan.handelser, T);
    const bidrag = {};
    for (const u of Object.keys(S.bidrag)) bidrag[u] = { ...S.bidrag[u] };
    const klart = S.n >= N;
    const ut = {
      tMs: abs(rel), speltidMs: T, kvarMs: cfg.varaktighetMs - T, klart,
      stationer, meteorer,
      handelser: h ? [{ ...h, startMs: abs(h.startMs), slutMs: abs(h.slutMs) }] : [],
      logg: S.logg.slice(),
      bidrag,
    };
    if (klart) ut.resultat = buildResultat(stationer, cfg.installningar.lage);
    return ut;
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
