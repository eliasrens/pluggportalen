// ============================================================================
// Meteorstormen (#820, utbruten #824): ETT STEG i motorn – handlingarna,
// meteorerna, dragstrålarna, lasrarna, nedslagen och hjälpen (stegen 1–6 i
// ms-motor.js filhuvud). REN som resten av delat/.
//
// Funktionerna tar motorns fasta del M och det aktuella tillståndet S (S byts
// ut när motorn spolar tillbaka – därför skickas det in, aldrig sparas här).
//   M = { cfg, plan, nSt, stationIndex, kmk, att, dragTillaten, dragSista,
//         skoldPer, laserPer, abs }
//   S = { n, h, p, st, met, logg, bidrag } (heltal i MILLI)
//   tillampa(M, S, h, T), slappMeteorer(M, S, T), dragstralar(M, S, T),
//   lasrar(M, S, T), nedslag(M, S, T), hjalpen(M, S, T)
//   posVid(m, T), forstAnkommer(a, b), bidragFor(S, uid)
// ============================================================================

import {
  MILLI, STORLEKAR, STORRE, LASER_RACKVIDD, SKOTT_PER_STEG, KAST_FLYGTID_MS,
  HJALP_SKILLNAD, HJALP_SKOLD_FAKTOR,
} from "./ms-balans.js";
import { fyllSkold, laddaLaser, avfyra, slaNer } from "./ms-station.js";

const logga = (S, post) => S.logg.push(Object.freeze(post));

export const posVid = (m, T) => (T - m.spawnMs) / (m.ankomstMs - m.spawnMs);
export const forstAnkommer = (a, b) => a.ankomstMs - b.ankomstMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function bidragFor(S, uid) {
  if (!uid) return null;
  return (S.bidrag[uid] ||= { skold: 0, laser: 0, drag: 0, nedskjutna: 0, kast: 0 });
}

function dragMal(M, S, i, onskat) {
  const j = onskat ? M.stationIndex.get(onskat) : undefined;
  if (j !== undefined && j !== i) return j;
  let bast = -1;
  for (let k = 0; k < M.nSt; k++) {
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

/** 1. En handling. */
export function tillampa(M, S, h, T) {
  const st = S.st[h.i];
  if (h.typ === "drag" && (!M.dragTillaten || st.armerad || T < st.dragRedo || T > M.dragSista)) return;
  if (h.typ === "spara") return;
  const b = bidragFor(S, h.uid);
  if (h.typ === "skold") {
    fyllSkold(st, st.hjalp ? Math.round(M.skoldPer[h.i] * HJALP_SKOLD_FAKTOR) : M.skoldPer[h.i]);
    st.antal.skold++;
    if (b) b.skold++;
  } else if (h.typ === "laser") {
    laddaLaser(st, M.laserPer[h.i], h.uid);
    st.antal.laser++;
    if (b) b.laser++;
  } else {
    st.armerad = { uid: h.uid, mal: h.mal, sedan: T };
    st.antal.drag++;
    if (b) b.drag++;
  }
}

/** 2. Nya meteorer (spegelvänt: en per station). */
export function slappMeteorer(M, S, T) {
  const { plan, nSt } = M;
  while (S.p < plan.meteorer.length && plan.meteorer[S.p].spawnMs <= T) {
    const pm = plan.meteorer[S.p++];
    for (let i = 0; i < nSt; i++) {
      S.met.push({
        id: `${pm.n}.${i}`, mal: i, storlek: pm.storlek, hp: STORLEKAR[pm.storlek].skott,
        bana: pm.bana, spawnMs: pm.spawnMs, ankomstMs: pm.ankomstMs, jatte: !!pm.jatte, kastadAv: -1,
      });
    }
  }
}

/** 3. Väntande dragstrålar fångar närmaste inkommande stormmeteor. */
export function dragstralar(M, S, T) {
  const { cfg, att } = M;
  for (let i = 0; i < M.nSt; i++) {
    const st = S.st[i];
    if (!st.armerad) continue;
    if (T > M.dragSista) { st.armerad = null; continue; }
    let fangst = null;
    for (const m of S.met) {
      if (m.mal !== i || m.jatte || m.kastadAv >= 0) continue;
      if (!fangst || forstAnkommer(m, fangst) < 0) fangst = m;
    }
    if (!fangst) continue;
    const mal = dragMal(M, S, i, st.armerad.mal);
    if (mal < 0) continue;
    const storlek = att.storre ? STORRE[fangst.storlek] || fangst.storlek : fangst.storlek;
    Object.assign(fangst, {
      mal, kastadAv: i, storlek, hp: STORLEKAR[storlek].skott, spawnMs: T, ankomstMs: T + KAST_FLYGTID_MS,
    });
    logga(S, { t: M.abs(T), typ: "kast", classId: cfg.stationer[i].classId, mot: cfg.stationer[mal].classId, uid: st.armerad.uid, storlek, meteor: fangst.id });
    const b = bidragFor(S, st.armerad.uid);
    if (b) b.kast++;
    st.kastade++;
    st.armerad = null;
    st.dragRedo = T + att.vantetidMs;
  }
}

/** 4. Lasrarna (högst SKOTT_PER_STEG per station) mot meteorer inom räckvidd. */
export function lasrar(M, S, T) {
  const { cfg } = M;
  for (let i = 0; i < M.nSt; i++) {
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
      logga(S, {
        t: M.abs(T), typ: "nedskjuten", classId: cfg.stationer[i].classId, uid, storlek: mal.storlek, meteor: mal.id,
        ...(mal.jatte ? { jatte: true } : {}),
        ...(mal.kastadAv >= 0 ? { fran: cfg.stationer[mal.kastadAv].classId } : {}),
      });
    }
  }
}

/** 5. Meteorer som nått fram slår ner: skölden först, sedan skrovet. */
export function nedslag(M, S, T) {
  const { cfg } = M;
  const nere = S.met.filter((m) => m.ankomstMs <= T).sort(forstAnkommer);
  if (!nere.length) return;
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
      logga(S, { t: M.abs(T), typ: "flyter", classId, ...extra });
      continue;
    }
    const { iSkold, iSkrov } = slaNer(st, STORLEKAR[m.storlek].skada * MILLI);
    logga(S, { t: M.abs(T), typ: iSkrov > 0 ? "traff" : "skold", classId, skold: iSkold / MILLI, skrov: iSkrov / MILLI, ...extra });
    if (st.skrov === 0 && st.noll === null) {
      st.noll = T;
      logga(S, { t: M.abs(T), typ: "noll", classId });
    }
  }
}

/** 6. Hjälpen till den som ligger efter (bara Klass mot klass). */
export function hjalpen(M, S, T) {
  if (!M.kmk) return;
  let max = 0;
  for (const st of S.st) max = Math.max(max, st.skrov);
  for (let i = 0; i < M.nSt; i++) {
    const st = S.st[i];
    const hjalp = max - st.skrov >= HJALP_SKILLNAD * MILLI;
    if (hjalp !== st.hjalp) logga(S, { t: M.abs(T), typ: hjalp ? "hjalp" : "hjalp-slut", classId: M.cfg.stationer[i].classId });
    st.hjalp = hjalp;
  }
}
