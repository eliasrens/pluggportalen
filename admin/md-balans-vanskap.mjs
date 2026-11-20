// ============================================================================
// Matchdagen (#874, Etapp 4): BALANSEN för vänskapsmatcherna (spec §11.3, §12) –
// körs av admin/md-balans-sim.mjs (npm run balans:matchdagen) och
// test/matchdagen-vanskap.test.js. Den riktiga rena motorn: md-vanskap.js.
//
//   vanskapBalans({ ratt: [a, b], stjarnor: [a, b], n })  n matcher: vinst a / oavgjort / vinst b,
//                                                         mål per match, lägen och matchens längd
//   VANSKAP_MAL                                            gränserna (specens §12-mål för målen och tiden)
// Robotarna väljer som i solospelet (ROBOT i md-balans-sim.mjs): skjuter vid d ≤ 28, ett långskott
// ibland, annars pass efter planhalvan; försvaret tacklar i 70 % av fallen. Tiden: båda svarar
// samtidigt, så ett läge tar det långsammaste svaret + valet + animationen.
// ============================================================================

import { SKOTT_MAX_D, TID } from "../src/matchdagen/delat/md-config.js";
import { lagbonus } from "../src/matchdagen/delat/md-motor.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import { nyVanskap, vAndraHalvlek, vLage, vResultat, vSpela } from "../src/matchdagen/delat/md-vanskap.js";
import { ROBOT } from "./md-balans-sim.mjs";

/** Specens §12: 1,5–4 mål per match, 6–8 minuter; lika lag ska vinna ungefär lika ofta. */
export const VANSKAP_MAL = { mal: [1.5, 4], minuter: [6, 9], likaSkillnad: 0.08 };
export const VANSKAP_RADER = [[[0.7, 0.7], [2, 2]], [[0.7, 0.5], [2, 2]], [[0.5, 0.5], [2, 2]], [[0.9, 0.3], [2, 2]], [[0.7, 0.7], [4, 2]]];

const trupp = (st) => ["MV", "FÖR", "FÖR", "MIT", "MIT", "ANF", "ANF"].map((pos) => ({ pos, st }));

function valAnf(rng, d, egenHalva) {
  if (d <= ROBOT.skjutD || (d <= SKOTT_MAX_D && rng() < ROBOT.langskott)) return "skjut";
  const p = egenHalva ? ROBOT.pass.egen : ROBOT.pass.deras;
  const u = rng();
  return u < p.kort ? "kort" : u < p.kort + p.lang ? "lang" : "dribbla";
}

export function vanskapBalans({ ratt = [0.7, 0.7], stjarnor = [2, 2], n = 1000, seed = "vanskap" } = {}) {
  const ut = { a: 0, o: 0, b: 0, mal: 0, lagen: 0, sek: 0, n };
  for (let i = 0; i < n; i++) {
    const r = skapaPrng(`${seed}|${ratt}|${stjarnor}|${i}`).tal;
    let V = nyVanskap({ a: { namn: "A", bonus: lagbonus(trupp(stjarnor[0])) }, b: { namn: "B", bonus: lagbonus(trupp(stjarnor[1])) }, avspark: i % 2 ? "b" : "a" });
    const andel = { a: ratt[0], b: ratt[1] };
    let sek = 0;
    while (!V.slut) {
      if (V.halvtid) { V = vAndraHalvlek(V); sek += TID.halvtid; continue; }
      const l = vLage(V);
      const svar = {
        [l.anf]: { val: valAnf(r, l.d, l.d > 50), ratt: r() < andel[l.anf] },
        [l.forsv]: { val: r() < ROBOT.tackla ? "tackla" : "tack", ratt: r() < andel[l.forsv] },
      };
      const { V: V2, h } = vSpela(V, svar, r);
      V = V2;
      sek += TID.val + Math.max(TID.svar.min + r() * (TID.svar.max - TID.svar.min), TID.svar.min + r() * (TID.svar.max - TID.svar.min));
      sek += h.utfall === "mal" ? TID.anim.mal : h.typ === "skott" ? TID.anim.skott : TID.anim.pass;
    }
    const res = vResultat(V);
    ut[res.vinnare || "o"]++;
    ut.mal += res.stallning.a + res.stallning.b;
    ut.lagen += V.lagen;
    ut.sek += sek + TID.slut;
  }
  return { vinstA: ut.a / n, oavgjort: ut.o / n, vinstB: ut.b / n, malPerMatch: ut.mal / n, lagen: ut.lagen / n, minuter: ut.sek / n / 60 };
}

/** Fel mot VANSKAP_MAL (tom lista = inom målen). */
export function bedomVanskap(rad, { ratt, stjarnor }) {
  const fel = [];
  const [lo, hi] = VANSKAP_MAL.mal;
  if (rad.malPerMatch < lo || rad.malPerMatch > hi) fel.push(`mål/match ${rad.malPerMatch.toFixed(2)}`);
  if (rad.minuter < VANSKAP_MAL.minuter[0] || rad.minuter > VANSKAP_MAL.minuter[1]) fel.push(`minuter ${rad.minuter.toFixed(1)}`);
  if (ratt[0] === ratt[1] && stjarnor[0] === stjarnor[1] && Math.abs(rad.vinstA - rad.vinstB) > VANSKAP_MAL.likaSkillnad) fel.push("lika lag vinner olika ofta");
  if (ratt[0] > ratt[1] && stjarnor[0] >= stjarnor[1] && rad.vinstA <= rad.vinstB) fel.push("fler rätt svar vinner inte oftare");
  return fel;
}

/** Tabellen i rapporten (Markdown). */
export function vanskapTabell(n = 2000) {
  const p = (x) => `${Math.round(x * 100)} %`;
  const rader = ["| Rätt a / b | Stjärnor a / b | Vinst a | Oavgj. | Vinst b | Mål/match | Lägen | Match (min) |", "| --- | --- | --- | --- | --- | --- | --- | --- |"];
  let fel = false;
  for (const [ratt, stjarnor] of VANSKAP_RADER) {
    const r = vanskapBalans({ ratt, stjarnor, n });
    const f = bedomVanskap(r, { ratt, stjarnor });
    fel ||= f.length > 0;
    rader.push(`| ${ratt.map(p).join(" / ")} | ${stjarnor.join(" / ")} | ${p(r.vinstA)} | ${p(r.oavgjort)} | ${p(r.vinstB)} | ${r.malPerMatch.toFixed(2).replace(".", ",")} | ${r.lagen.toFixed(1).replace(".", ",")} | ${r.minuter.toFixed(1).replace(".", ",")} |${f.length ? ` ⚠️ ${f.join(", ")}` : ""}`);
  }
  return { text: rader.join("\n"), fel };
}

if (process.argv[1]?.endsWith("md-balans-vanskap.mjs")) {
  const t = vanskapTabell();
  console.log(t.text);
  process.exitCode = t.fel ? 1 : 0;
}
