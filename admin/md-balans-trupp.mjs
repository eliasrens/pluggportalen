// ============================================================================
// Matchdagen (#871, Etapp 2b): BALANSEN för truppen, marknaden och träningslägret
// (spec §8, §12) – körs av admin/md-balans-sim.mjs (npm run balans:matchdagen) och
// test/matchdagen-balans.test.js. Den riktiga rena koden: md-trupp.js (priset,
// marknaden, köpet, träningen), md-sasong.js (pengarna) och md-motor.js (lagbonusen).
//
//   ekonomi({ andelRatt, n })   §12 "Ekonomin": efter hur många matcher i Division 6
//                               har eleven råd med en 3-stjärnig spelare som finns till salu?
//   karriarMedTrupp({ andelRatt, n, sasonger })
//                               karriären med en klubb som tränar i varje läger och köper på
//                               marknaden (ersätter 2a:s antagande "tränas 2★ → 4★")
//
// Robotklubbens beteende (antaganden, inte spelregler – står i docs/MATCHDAGEN.md §15):
// KLUBB nedan.
// ============================================================================

import { lagbonus } from "../src/matchdagen/delat/md-motor.js";
import { styrkaFor } from "../src/matchdagen/delat/md-liga.js";
import { nyTrupp, pengarFor } from "../src/matchdagen/delat/md-sasong.js";
import { kop, kopInfo, nyMarknad, pris, tranaSpelare } from "../src/matchdagen/delat/md-trupp.js";
import { CUP, DIVISIONER, KASSA, TOPP_DIV, TRANING } from "../src/matchdagen/delat/md-config.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import { spelaMatch, spelaSasong } from "./md-balans-sim.mjs";

/** Robotklubben: tränar i varje läger den sämsta spelaren under 5★ och köper den största förbättringen den har råd med. */
export const KLUBB = {
  /** Köp bara när förbättringen är minst så här många stjärnor (1 = varje bättre spelare). */
  minForbattring: 1,
};

/** §12: 60 % rätt ska kunna köpa en 3★ efter ungefär 3 matcher i Division 6 (snittet). */
export const EKONOMI_MAL = { andelRatt: 0.6, stjarnor: 3, matcher: [2.5, 3.5] };

/**
 * Efter hur många matcher i Division 6 har eleven råd med en spelare med `stjarnor` stjärnor
 * som finns på marknaden (nya spelare efter varje match)? Kassan börjar på KASSA.start.
 */
export function ekonomi({ andelRatt = EKONOMI_MAL.andelRatt, n = 1000, stjarnor = EKONOMI_MAL.stjarnor } = {}) {
  const antal = [];
  let pengar = 0;
  let matcher = 0;
  for (let i = 0; i < n; i++) {
    const rng = skapaPrng(`eko|${andelRatt}|${i}`, "klubb");
    const K = { div: 0, trupp: nyTrupp(rng.tal), reserver: [], kassa: KASSA.start };
    for (let k = 1; k <= 30; k++) {
      const r = spelaMatch({ seed: `eko|${andelRatt}|${i}|${k}`, andelRatt, styrka: styrkaFor(0, rng.tal) });
      const p = pengarFor(r, r.ratt, 0);
      pengar += p;
      matcher++;
      K.kassa += p;
      K.marknad = nyMarknad(K, rng.tal);
      if (K.kassa >= pris(stjarnor) && K.marknad.some((x) => x.st >= stjarnor)) { antal.push(k); break; }
    }
  }
  const sorterad = antal.slice().sort((a, b) => a - b);
  const andelInom = (k) => antal.filter((x) => x <= k).length / n;
  return {
    andelRatt, n, stjarnor, pris: pris(stjarnor),
    medel: antal.reduce((a, b) => a + b, 0) / antal.length,
    median: sorterad[Math.floor(sorterad.length / 2)],
    inom2: andelInom(2), inom3: andelInom(3), inom4: andelInom(4),
    perMatch: pengar / matcher,
  };
}

/** Ekonomiraden mot målet – tom lista = godkänd. */
export function bedomEkonomi(r) {
  const [lo, hi] = EKONOMI_MAL.matcher;
  return r.medel >= lo && r.medel <= hi ? [] : [`medel ${r.medel.toFixed(2)} matcher utanför ${lo}–${hi}`];
}

const snittSt = (trupp) => trupp.reduce((s, p) => s + p.st, 0) / trupp.length;

/** En robotklubb: kassan, marknaden och träningslägret mellan matcherna. */
export function robotKlubb({ andelRatt, seed }) {
  const rng = skapaPrng(seed, "klubb");
  const K = { div: 0, sasong: 1, kassa: KASSA.start, trupp: nyTrupp(rng.tal), reserver: [], marknad: [] };
  K.marknad = nyMarknad(K, rng.tal);
  const klubb = { K, lager: 0, kop: 0 };

  function lager() {
    const kandidater = K.trupp.map((p, i) => [p, i]).filter(([p]) => p.st < TRANING.maxSt);
    if (!kandidater.length) return;
    const [, i] = kandidater.reduce((a, b) => (b[0].st * 100 + b[0].xp < a[0].st * 100 + a[0].xp ? b : a));
    let p = K.trupp[i];
    for (let f = 0; f < TRANING.fragor; f++) p = tranaSpelare(p, rng.tal() < andelRatt).p;
    K.trupp[i] = p;
    klubb.lager++;
  }
  function handla() {
    for (;;) {
      const bast = K.marknad.map((p) => kopInfo(K, p.id)).filter((x) => x.kan && x.ny.st - x.ersatt.st >= KLUBB.minForbattring)
        .sort((a, b) => (b.ny.st - b.ersatt.st) - (a.ny.st - a.ersatt.st) || a.kostnad - b.kostnad)[0];
      if (!bast) return;
      const slapp = bast.masteSlappa ? bast.slappbara.slice().sort((a, b) => a.st - b.st)[0].id : null;
      Object.assign(K, kop(K, bast.ny.id, { slapp }).K);
      klubb.kop++;
    }
  }
  /** Före matchen: lagbonusen ur truppen – före kvalet först det extra träningslägret (§8.4). */
  klubb.bonus = (o) => {
    if (o === "kval") lager();
    return lagbonus(K.trupp);
  };
  /** Efter matchen: pengarna, en ny marknad, lägret (efter en ligaomgång – inte efter kval och cup) och köpen. */
  klubb.efterMatch = (r, o) => {
    const extra = o === "kval" && r.vann ? KASSA.uppflyttning : r.cupSeger ? CUP.seger : 0;
    K.kassa += pengarFor(r, r.ratt, K.div) + Math.round(extra * (1 + K.div * KASSA.perDiv));
    if (o === "kval" && r.vann) K.div = Math.min(TOPP_DIV, K.div + 1);
    K.marknad = nyMarknad(K, rng.tal);
    if (o !== "kval" && o !== "cup") lager();
    handla();
  };
  klubb.snittSt = () => snittSt(K.trupp);
  return klubb;
}

/**
 * Karriären med den riktiga truppen och Silverpokalen (#872): n elever × `sasonger` säsonger. Per division:
 * andelen som når den, median säsonger och speltimmar dit, lagets snittstjärnor då
 * och andelen vunna matcher medan laget spelade där.
 */
export function karriarMedTrupp({ andelRatt, n = 100, sasonger = 30 }) {
  const nar = DIVISIONER.map(() => []);
  const spelat = DIVISIONER.map(() => ({ matcher: 0, vinst: 0 }));
  for (let k = 0; k < n; k++) {
    const klubb = robotKlubb({ andelRatt, seed: `trupp|${andelRatt}|${k}` });
    let sek = 0;
    nar[0].push({ sasong: 0, h: 0, st: klubb.snittSt() });
    for (let s = 1; s <= sasonger && klubb.K.div < TOPP_DIV; s++) {
      const div = klubb.K.div;
      klubb.K.sasong = s;
      const S = spelaSasong({ seed: `trupp|${andelRatt}|${k}|${s}`, andelRatt, div, bonus: klubb.bonus, efterMatch: klubb.efterMatch, cup: true });
      sek += S.sekunder;
      spelat[div].matcher += S.matcher.length;
      spelat[div].vinst += S.matcher.filter((m) => m.utfall === "vinst").length;
      if (klubb.K.div > div) nar[klubb.K.div].push({ sasong: s, h: sek / 3600, st: klubb.snittSt() });
    }
  }
  const median = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
  return {
    andelRatt, n, sasonger, trupp: true,
    div: nar.map((l, d) => ({
      div: d, andel: l.length / n, sasonger: median(l.map((x) => x.sasong)), timmar: median(l.map((x) => x.h)),
      stjarnor: median(l.map((x) => x.st)), vinst: spelat[d].matcher ? spelat[d].vinst / spelat[d].matcher : null,
    })),
  };
}

const pct = (v) => `${Math.round(v * 100)} %`;
const dec = (v, n = 1) => v.toFixed(n).replace(".", ",");

function skriv(huvud, rader, md) {
  if (md) return [`| ${huvud.join(" | ")} |`, `|${huvud.map(() => " --- ").join("|")}|`, ...rader.map((r) => `| ${r.join(" | ")} |`)].join("\n");
  const alla = [huvud, ...rader];
  const bredd = huvud.map((_, i) => Math.max(...alla.map((r) => r[i].length)));
  return alla.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(bredd[i]))).join("  ")).join("\n");
}

/** Ekonomitabellen: en rad per andel rätt. */
export function ekonomiTabell(rader, md = false) {
  const huvud = ["Rätt", "Spelare", "Pris", "kr/match", "Matcher (snitt)", "Median", "Inom 2", "Inom 3", "Inom 4", "Mål"];
  return skriv(huvud, rader.map((r) => [pct(r.andelRatt), `${r.stjarnor}★`, `${r.pris} kr`, String(Math.round(r.perMatch)), dec(r.medel, 2), String(r.median),
    pct(r.inom2), pct(r.inom3), pct(r.inom4), r.andelRatt === EKONOMI_MAL.andelRatt ? (bedomEkonomi(r).length ? `NEJ: ${bedomEkonomi(r).join("; ")}` : "ja") : "–"]), md);
}

/** Karriären med truppen: andel · säsonger · timmar · lagets snitt när divisionen nås, och vinstandelen där. */
export function truppKarriarTabell(karriarer, md = false) {
  const huvud = ["Rätt", ...DIVISIONER];
  const cell = (d) => (d.andel ? `${d.div ? `${pct(d.andel)} · ${d.sasonger} säs. · ${dec(d.timmar)} h · ` : ""}${dec(d.stjarnor)}★${d.vinst == null ? "" : ` · vinst ${pct(d.vinst)}`}` : "–");
  return skriv(huvud, karriarer.map((k) => [pct(k.andelRatt), ...k.div.map(cell)]), md);
}
