// ============================================================================
// Matchdagen (#873, Etapp 3): BALANSEN för Mästarcupen (spec §10.2, §12) – körs
// av admin/md-balans-sim.mjs (npm run balans:matchdagen) och
// test/matchdagen-balans.test.js. Den riktiga rena koden: md-mastarcup.js
// (lottningen: tre toppklubbar 0,86–0,95, svagast först) och spelaMatch ur
// md-balans-sim.mjs med avgor: true (oavgjort → straffar).
//
//   mcBalans({ andelRatt, stjarnor, n })  n försök: hur långt laget går, andelen vunna
//                                         Mästarcuper, vinst per runda, straffar, minuter
//   MC_MAL                                §12: 80 % rätt, tränat lag (snitt 4★) vinner
//                                         Mästarcupen "ungefär var femte försök"
// ============================================================================

import { DIVISIONER, MASTARCUP, TOPP_DIV } from "../src/matchdagen/delat/md-config.js";
import { mcLottning } from "../src/matchdagen/delat/md-mastarcup.js";
import { ROBOT, SUPER, spelaMatch, tranatLag } from "./md-balans-sim.mjs";

/** §12: "Mästarcupen vinns sällan, ungefär var femte försök" – 15–25 % för 80 % rätt med 4★. */
export const MC_MAL = { andelRatt: SUPER.andelRatt, stjarnor: SUPER.stjarnor, mcVinst: [0.15, 0.25] };
/** Raderna i rapporten: andel rätt, lagets snittstjärnor. */
export const MC_RADER = [[0.8, 4], [0.8, 5], [0.7, 4], [0.9, 4], [0.7, 5]];

export function mcBalans({ andelRatt, stjarnor = 4, n = 400 }) {
  const bonus = tranatLag(stjarnor);
  const ut = [0, 0, 0, 0]; // antal vunna rundor 0–3
  const perRunda = MASTARCUP.rundor.map(() => ({ spelade: 0, vunna: 0 }));
  let straffar = 0;
  let matcher = 0;
  let sek = 0;
  for (let i = 0; i < n; i++) {
    const seed = `mc|${andelRatt}|${stjarnor}|${i}`;
    const mot = mcLottning({ sasong: 1, klubb: {} }, seed);
    let vunna = 0;
    for (const [r, t] of mot.entries()) {
      const m = spelaMatch({ seed: `${seed}|${r}`, andelRatt, styrka: t.styrka, div: TOPP_DIV, bonus, avgor: true });
      matcher++;
      sek += m.sekunder + ROBOT.mellanMatchS;
      if (m.straffar) straffar++;
      perRunda[r].spelade++;
      if (!m.vann) break;
      perRunda[r].vunna++;
      vunna++;
    }
    ut[vunna]++;
  }
  return {
    andelRatt, stjarnor, n,
    /** Andelen försök där laget vann så här många rundor (0–3). */
    rundor: ut.map((x) => x / n),
    mcVinst: ut[MASTARCUP.rundor.length] / n,
    perRunda: perRunda.map((x) => (x.spelade ? x.vunna / x.spelade : null)),
    straffar: matcher ? straffar / matcher : 0,
    matcherPerForsok: matcher / n,
    minPerForsok: sek / n / 60,
  };
}

/** Raden mot §12-målet – tom lista = godkänd (bara 80 % rätt med 4★ prövas). */
export function bedomMc(r) {
  if (r.andelRatt !== MC_MAL.andelRatt || r.stjarnor !== MC_MAL.stjarnor) return [];
  const [lo, hi] = MC_MAL.mcVinst;
  return r.mcVinst >= lo && r.mcVinst <= hi ? [] : [`mcVinst ${r.mcVinst.toFixed(3)} utanför ${lo}–${hi}`];
}

const pct = (v) => (v == null ? "–" : `${Math.round(v * 100)} %`);
const dec = (v, n = 1) => v.toFixed(n).replace(".", ",");

export function mcTabell(rader, md = false) {
  const huvud = ["Rätt", "Laget", "Ute i kvart", "Ute i semi", "Förlorad final", "Vunnen", "Vinst kvart/semi/final", "Straffar", "Matcher/försök",
    "Min/försök", "Mål (15–25 %)"];
  const rad = (r) => [pct(r.andelRatt), `${r.stjarnor}★`, ...r.rundor.slice(0, 3).map(pct), pct(r.mcVinst), r.perRunda.map(pct).join(" / "),
    pct(r.straffar), dec(r.matcherPerForsok), dec(r.minPerForsok, 0),
    r.andelRatt === MC_MAL.andelRatt && r.stjarnor === MC_MAL.stjarnor ? (bedomMc(r).length ? `NEJ: ${bedomMc(r).join("; ")}` : "ja") : "–"];
  const alla = [huvud, ...rader.map(rad)];
  if (md) return [`| ${huvud.join(" | ")} |`, `|${huvud.map(() => " --- ").join("|")}|`, ...rader.map((r) => `| ${rad(r).join(" | ")} |`)].join("\n");
  const bredd = huvud.map((_, i) => Math.max(...alla.map((x) => x[i].length)));
  return alla.map((x) => x.map((c, i) => (i === x.length - 1 ? c : c.padEnd(bredd[i]))).join("  ")).join("\n");
}

export const MC_RUBRIK = `${MASTARCUP.namn} i ${DIVISIONER[TOPP_DIV]}`;
