// ============================================================================
// Matchdagen (#868, Etapp 1b): BALANSSIMULERING (spec §12). Kör den riktiga
// motorn (src/matchdagen/delat/) med påhittade elever som svarar rätt med en
// viss sannolikhet, säsong efter säsong i Division 6 (6 lag, 5 omgångar), och
// skriver ut måtten mot målen i §12:
//   70 % rätt: vinner 55–65 % av matcherna, ligan ungefär varannan säsong
//   50 % rätt: vinner 30–40 %, kan vinna ligan med lite tur
//   30 % rätt: minst ett mål i hälften av matcherna, inga stora förluster varje match
//   alla:      1,5–4 mål per match, inga 9–0, matchen 6–8 minuter
// Når målen inte: justera BARA src/matchdagen/delat/md-config.js.
//
//   npm run balans:matchdagen             → tabellen (1 000 säsonger per rad)
//   node admin/md-balans-sim.mjs --n 200  → färre säsonger (snabbare)
//   node admin/md-balans-sim.mjs --md     → tabellen som markdown (docs/MATCHDAGEN.md)
//
// Robotarnas beteende (antaganden, inte spelregler – står i docs/MATCHDAGEN.md):
// ROBOT nedan. Exporterar spelaMatch/spelaSasong/korBalans/bedom/tabell så att
// testet (test/matchdagen-balans.test.js) kan köra en kort variant.
// ============================================================================

import { fileURLToPath } from "node:url";
import { nyMatch, lage, spela, andraHalvlek, resultat } from "../src/matchdagen/delat/md-motor.js";
import { schema, styrkaFor, simMal, nyTabell, laggTill, sorteraTabell } from "../src/matchdagen/delat/md-liga.js";
import { LAGANTAL, TID, SKOTT_MAX_D } from "../src/matchdagen/delat/md-config.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

/** Robotarnas beteende – antaganden om hur en elev spelar, inte spelregler. */
export const ROBOT = {
  /** Skjuter alltid på "Bra läge" och "Jätteläge" (d ≤ detta) … */
  skjutD: 28,
  /** … och tar ett långskott (28 < d ≤ 45) så här ofta. */
  langskott: 0.1,
  /** Annars: kort pass, långt pass eller dribbling i de här andelarna – på egen och på deras planhalva. */
  pass: { egen: { kort: 0.4, lang: 0.4, dribbla: 0.2 }, deras: { kort: 0.6, lang: 0.1, dribbla: 0.3 } },
  /** Försvar: tackla så här ofta, annars täck. */
  tackla: 0.7,
  /** Träningslägret (Etapp 2b) i säsongens tid: 8 frågor + så här många sekunder runt omkring. */
  traningFragor: 8,
  traningExtraS: 30,
  /** Rutorna runt en match (före avspark, efter matchen, tabellen): sekunder per match. */
  mellanMatchS: 30,
};

/** Målen i §12 (Division 6) – bedom() fäller en rad utanför dem. */
export const MAL = {
  0.7: { vinst: [0.55, 0.65], liga: [0.35, 0.65] },
  0.5: { vinst: [0.3, 0.4], liga: [0.03, 0.35] },
  0.3: { minstEttMal: [0.5, 1], storForlust: [0, 0.15] },
  alla: { malPerMatch: [1.5, 4], jattestor: [0, 0.01], matchMin: [6, 8], sasongMin: [45, 60] },
};
export const NIVAER = [0.7, 0.5, 0.3];
/** En "stor förlust": så här många mål eller mer i underläge. "9–0"-gränsen: så här stor skillnad. */
const STOR_FORLUST = 4;
const JATTESTOR = 6;

function valjAnfall(l, rng) {
  if (l.d <= ROBOT.skjutD || (l.d <= SKOTT_MAX_D && rng.tal() < ROBOT.langskott)) return "skjut";
  let u = rng.tal();
  for (const [id, andel] of Object.entries(l.d > 50 ? ROBOT.pass.egen : ROBOT.pass.deras)) {
    if (u < andel) return id;
    u -= andel;
  }
  return "kort";
}

/** Animationstiden för en händelse (TID.anim i md-config.js). */
function animS(h) {
  const a = TID.anim;
  if (h.utfall === "mal") return a.mal + a.avspark;
  if (h.horna) return a.horna;
  if (h.typ === "anfall") return h.val === "skjut" ? (h.utfall === "raddning" ? a.raddning : a.skott) : h.utfall === "bruten" ? a.bruten : a.pass;
  if (h.typ === "derasPass") return a.derasPass;
  if (h.typ === "forsvar") return a.tackling;
  return h.utfall === "raddning" ? a.raddning : a.skott;
}

/**
 * En match mot ett lag med styrkan `styrka`, där eleven svarar rätt med `andelRatt`.
 * @returns {{ oss, dem, utfall, sekunder, fragor, ratt, stat }}
 */
export function spelaMatch({ seed, andelRatt, styrka, div = 0 }) {
  const rng = skapaPrng(seed, "motor");
  const elev = skapaPrng(seed, "elev");
  let m = nyMatch({ mot: { namn: "Motståndarna", styrka }, div });
  let sek = 0;
  for (let i = 0; i < 400 && !m.slut; i++) {
    if (m.halvtid) {
      m = andraHalvlek(m);
      sek += TID.halvtid;
      continue;
    }
    const l = lage(m);
    let valId = null;
    let fragor = l.fragor;
    if (l.typ === "anfall") valId = valjAnfall(l, elev);
    else if (l.typ === "forsvar") valId = elev.tal() < ROBOT.tackla ? "tackla" : "tack";
    if (valId) {
      fragor = l.val.find((v) => v.id === valId).fragor;
      sek += TID.val;
    }
    const svar = [];
    for (let k = 0; k < fragor; k++) {
      svar.push({ ratt: elev.tal() < andelRatt, kalla: "sim" });
      sek += elev.mellan(TID.svar.min, TID.svar.max);
    }
    const r = spela(m, valId, svar, rng.tal);
    m = r.m;
    sek += animS(r.h);
  }
  sek += TID.slut;
  const res = resultat(m);
  return { oss: res.oss, dem: res.dem, utfall: res.utfall, sekunder: sek, fragor: res.stat.fragor, ratt: res.stat.ratt, stat: res.stat };
}

/** En säsong i en division: eleven + datorlag, round robin, övriga matcher med simMal. */
export function spelaSasong({ seed, andelRatt, div = 0 }) {
  const rng = skapaPrng(seed, "liga");
  const n = LAGANTAL[div];
  const ids = ["oss", ...Array.from({ length: n - 1 }, (_, i) => `lag${i + 1}`)];
  const styrka = Object.fromEntries(ids.slice(1).map((id) => [id, styrkaFor(div, rng.tal)]));
  let tabell = nyTabell(ids);
  const matcher = [];
  let sek = 0;
  schema(ids).forEach((omg, o) => {
    for (const [a, b] of omg) {
      if (a === "oss" || b === "oss") {
        const mot = a === "oss" ? b : a;
        const r = spelaMatch({ seed: `${seed}|${o}`, andelRatt, styrka: styrka[mot], div });
        matcher.push(r);
        sek += r.sekunder + ROBOT.mellanMatchS + ROBOT.traningFragor * (TID.svar.min + TID.svar.max) / 2 + ROBOT.traningExtraS;
        tabell = a === "oss" ? laggTill(tabell, a, b, r.oss, r.dem) : laggTill(tabell, a, b, r.dem, r.oss);
      } else {
        const [ma, mb] = simMal(styrka[a], styrka[b], rng.tal);
        tabell = laggTill(tabell, a, b, ma, mb);
      }
    }
  });
  const placering = sorteraTabell(tabell).findIndex((r) => r.id === "oss") + 1;
  return { matcher, placering, sekunder: sek, tabell };
}

/** n säsonger vid andelRatt → måtten. */
export function korBalans({ andelRatt, n = 1000, div = 0 }) {
  const matcher = [];
  let ligor = 0;
  let sasongS = 0;
  for (let i = 0; i < n; i++) {
    const s = spelaSasong({ seed: `md|${andelRatt}|${div}|${i}`, andelRatt, div });
    matcher.push(...s.matcher);
    if (s.placering === 1) ligor++;
    sasongS += s.sekunder;
  }
  const andel = (f) => matcher.filter(f).length / matcher.length;
  const snitt = (f) => matcher.reduce((s, m) => s + f(m), 0) / matcher.length;
  return {
    andelRatt, n, matcher: matcher.length,
    vinst: andel((m) => m.utfall === "vinst"),
    oavgjort: andel((m) => m.utfall === "oavgjort"),
    forlust: andel((m) => m.utfall === "forlust"),
    liga: ligor / n,
    gjorda: snitt((m) => m.oss),
    insl: snitt((m) => m.dem),
    malPerMatch: snitt((m) => m.oss + m.dem),
    minstEttMal: andel((m) => m.oss >= 1),
    storForlust: andel((m) => m.dem - m.oss >= STOR_FORLUST),
    jattestor: andel((m) => Math.abs(m.oss - m.dem) >= JATTESTOR),
    storstaSkillnad: Math.max(...matcher.map((m) => Math.abs(m.oss - m.dem))),
    fragorPerMatch: snitt((m) => m.fragor),
    matchMin: snitt((m) => m.sekunder) / 60,
    sasongMin: sasongS / n / 60,
  };
}

/** Raden mot målen: en lista med det som ligger utanför (tom = godkänd). */
export function bedom(rad) {
  const fel = [];
  const mal = { ...MAL.alla, ...(MAL[rad.andelRatt] || {}) };
  for (const [matt, [lo, hi]] of Object.entries(mal)) {
    const v = rad[matt];
    if (!(v >= lo && v <= hi)) fel.push(`${matt} ${Number(v).toFixed(3)} utanför ${lo}–${hi}`);
  }
  return fel;
}

const pct = (v) => `${Math.round(v * 100)} %`;
const dec = (v, n = 2) => v.toFixed(n).replace(".", ",");

/** Tabellen (text eller markdown). */
export function tabell(rader, md = false) {
  const huvud = ["Rätt", "Vinst", "Oavgj.", "Förlust", "Ligan", "Mål/match", "Gjorda", "Insl.", "≥1 eget mål", "Förlust ≥4", "Skillnad ≥6", "Störst", "Frågor/match", "Match (min)", "Säsong (min)", "Mål"];
  const rad = (r) => [pct(r.andelRatt), pct(r.vinst), pct(r.oavgjort), pct(r.forlust), pct(r.liga), dec(r.malPerMatch), dec(r.gjorda), dec(r.insl),
    pct(r.minstEttMal), pct(r.storForlust), `${dec(r.jattestor * 100, 1)} %`, String(r.storstaSkillnad), dec(r.fragorPerMatch, 1), dec(r.matchMin, 1), dec(r.sasongMin, 0),
    bedom(r).length ? `NEJ: ${bedom(r).join("; ")}` : "ja"];
  if (md) return [`| ${huvud.join(" | ")} |`, `|${huvud.map(() => " --- ").join("|")}|`, ...rader.map((r) => `| ${rad(r).join(" | ")} |`)].join("\n");
  const alla = [huvud, ...rader.map(rad)];
  const bredd = huvud.map((_, i) => Math.max(...alla.map((r) => r[i].length)));
  return alla.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(bredd[i]))).join("  ")).join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv.slice(2);
  const n = Number(arg[arg.indexOf("--n") + 1]) || 1000;
  const md = arg.includes("--md");
  const t0 = performance.now();
  const rader = NIVAER.map((andelRatt) => korBalans({ andelRatt, n }));
  console.log(`Matchdagen – balans i Division 6 (${n} säsonger à 5 matcher per rad)\n`);
  console.log(tabell(rader, md));
  console.log(`\n${Math.round(performance.now() - t0)} ms`);
  process.exitCode = rader.some((r) => bedom(r).length) ? 1 : 0;
}
