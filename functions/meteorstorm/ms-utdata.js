// ============================================================================
// Meteorstormen (#820, utbruten #824): motorns UTDATA – det interna tillståndet
// (heltal i MILLI, stationer som index) → "Tillståndet" i ms-motor.js filhuvud
// (decimaltal, classId, absoluta tider). REN som resten av delat/.
//   utdata(M, S, rel) → tillståndet; M/S som i ms-steg.js, rel = ms sedan start
// ============================================================================

import { STEG_MS, MILLI, HJALP_DRAG_KOSTNAD } from "./ms-balans.js";
import { aktivHandelse } from "./ms-storm.js";
import { buildResultat } from "./ms-resultat.js";
import { posVid } from "./ms-steg.js";

function dragKostnadFor(M, st) {
  if (!M.dragTillaten) return 0;
  return st.hjalp ? Math.min(M.att.kostnad, HJALP_DRAG_KOSTNAD) : M.att.kostnad;
}

export function utdata(M, S, rel) {
  const { cfg, abs } = M;
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
      tillaten: M.dragTillaten,
      kostnad: dragKostnadFor(M, st),
      armerad: !!st.armerad,
      redoMs: M.dragTillaten ? abs(st.dragRedo) : null,
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
  const h = aktivHandelse(M.plan.handelser, T);
  const bidrag = {};
  for (const u of Object.keys(S.bidrag)) bidrag[u] = { ...S.bidrag[u] };
  const klart = S.n >= M.N;
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
