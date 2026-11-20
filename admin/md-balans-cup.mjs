// ============================================================================
// Matchdagen (#872, Etapp 2c): BALANSEN för Silverpokalen (spec §9.1, §12) –
// körs av admin/md-balans-sim.mjs (npm run balans:matchdagen) och
// test/matchdagen-balans.test.js. Den riktiga rena koden: md-cup.js (schemat
// och lottningen: divisioner inom ±2) och md-balans-sim.mjs spelaSasong({ cup: true }).
//
//   cupBalans({ andelRatt, div, bonus, n })  n säsonger: hur långt laget går i cupen,
//                                            andelen vunna cuper, skrällar (vinst mot ett lag
//                                            från en högre division), straffar, kronor och
//                                            säsongens längd med och utan cupen
//   CUP_MAL                                  rimlighetsgränserna (specen har inga tal för cupen)
// ============================================================================

import { CUP, DIVISIONER, KASSA } from "../src/matchdagen/delat/md-config.js";
import { pengarFor } from "../src/matchdagen/delat/md-sasong.js";
import { ROBOT, spelaSasong, tranatLag } from "./md-balans-sim.mjs";

/**
 * Specen sätter inga tal för cupen – bara att skrällar ska vara möjliga. Gränserna här är
 * rimlighet i Division 6 med startlaget: med 70 % rätt ska cupen gå att vinna men inte vara
 * gratis, och ett lag från en högre division ska gå att slå – också med 50 % rätt.
 * bedomCup() fäller en rad utanför dem (andra rader redovisas bara).
 */
export const CUP_MAL = { 0.7: { cupVinst: [0.1, 0.5], skrall: [0.3, 0.9] }, 0.5: { skrall: [0.05, 0.6] } };
/** Raderna i rapporten: andel rätt, division, lagets snittstjärnor. */
export const CUP_RADER = [[0.7, 0, 2], [0.5, 0, 2], [0.3, 0, 2], [0.7, 3, 4], [0.8, 7, 4], [0.8, 7, 5]];

export function cupBalans({ andelRatt, div = 0, stjarnor = 2, n = 400 }) {
  const bonus = tranatLag(stjarnor);
  const rundor = [0, 0, 0, 0, 0];
  let vunna = 0;
  let hogre = 0;
  let hogreVunna = 0;
  let straffar = 0;
  let matcher = 0;
  let kr = 0;
  let sekLiga = 0;
  let sekCup = 0;
  for (let i = 0; i < n; i++) {
    const S = spelaSasong({ seed: `cup|${andelRatt}|${div}|${stjarnor}|${i}`, andelRatt, div, bonus, cup: true });
    const c = S.cup;
    rundor[c.rundor - (c.ute ? 1 : 0)]++;
    if (c.vann) vunna++;
    for (const r of c.matcher) {
      matcher++;
      if (r.straffar) straffar++;
      if (r.motDiv > div) { hogre++; if (r.vann) hogreVunna++; }
      kr += pengarFor(r, r.ratt, div) + (r.cupSeger ? Math.round(CUP.seger * (1 + div * KASSA.perDiv)) : 0);
      sekCup += r.sekunder + ROBOT.mellanMatchS;
    }
    sekLiga += S.sekunder;
  }
  return {
    andelRatt, div, stjarnor, n,
    /** Andelen säsonger där laget vann så här många rundor (0–4). */
    rundor: rundor.map((x) => x / n),
    cupVinst: vunna / n,
    matcherPerSasong: matcher / n,
    skrall: hogre ? hogreVunna / hogre : null,
    straffar: matcher ? straffar / matcher : 0,
    krPerSasong: kr / n,
    /** Säsongens längd i minuter: ligan + lägren (som i §12) och cupen ovanpå. */
    sasongMin: (sekLiga - sekCup) / n / 60,
    sasongMedCupMin: sekLiga / n / 60,
  };
}

/** Raden mot rimlighetsgränserna – tom lista = godkänd. */
export function bedomCup(r) {
  const fel = [];
  const mal = r.div === 0 && r.stjarnor === 2 ? CUP_MAL[r.andelRatt] || {} : {};
  for (const [k, [lo, hi]] of Object.entries(mal)) {
    if (r[k] != null && !(r[k] >= lo && r[k] <= hi)) fel.push(`${k} ${r[k].toFixed(3)} utanför ${lo}–${hi}`);
  }
  return fel;
}

const pct = (v) => (v == null ? "–" : `${Math.round(v * 100)} %`);
const dec = (v, n = 1) => v.toFixed(n).replace(".", ",");

export function cupTabell(rader, md = false) {
  const huvud = ["Division", "Rätt", "Laget", "Ute i 1:a", "Ute i kvart", "Ute i semi", "Förlorad final", "Vunnen", "Cupmatcher/säsong", "Skrällar", "Straffar",
    "kr/säsong", "Säsong (min)", "Med cupen (min)", "Mål"];
  const rad = (r) => [DIVISIONER[r.div], pct(r.andelRatt), `${r.stjarnor}★`, ...r.rundor.slice(0, 4).map(pct), pct(r.cupVinst), dec(r.matcherPerSasong),
    pct(r.skrall), pct(r.straffar), String(Math.round(r.krPerSasong)), dec(r.sasongMin, 0), dec(r.sasongMedCupMin, 0), r.div === 0 && CUP_MAL[r.andelRatt] ? (bedomCup(r).length ? `NEJ: ${bedomCup(r).join("; ")}` : "ja") : "–"];
  const alla = [huvud, ...rader.map(rad)];
  if (md) return [`| ${huvud.join(" | ")} |`, `|${huvud.map(() => " --- ").join("|")}|`, ...rader.map((r) => `| ${rad(r).join(" | ")} |`)].join("\n");
  const bredd = huvud.map((_, i) => Math.max(...alla.map((r) => r[i].length)));
  return alla.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(bredd[i]))).join("  ")).join("\n");
}
