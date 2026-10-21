// ============================================================================
// Meteorstormen (#820): BALANSSIMULERING (spec §2.3.2). Kör den riktiga motorn
// (src/live/formats/meteorstorm/delat/) med påhittade klasser som svarar olika
// bra och väljer handlingar med enkla strategier. Energin räknas som servern
// gör (1 per rätt, Solstorm ×2, Kometsvans +1, tak 5).
//
//   node admin/ms-balans-sim.mjs            → tabellen (200 frön per rad)
//   node admin/ms-balans-sim.mjs --n 50     → färre frön (snabbare)
//   node admin/ms-balans-sim.mjs --md       → tabellen som markdown (docs/METEORSTORMEN.md)
//
// Exporterar spelaMatch/SCENARIER så att testerna kan köra en kort variant.
// ============================================================================

import { fileURLToPath } from "node:url";
import * as motorModul from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import * as ageraModul from "../src/live/formats/meteorstorm/delat/ms-agera.js";
import { skapaPrng } from "../src/live/formats/meteorstorm/delat/ms-prng.js";
import { ENERGI_TAK, KOSTNAD, SKOLD_TAK, LADDNING_TAK } from "../src/live/formats/meteorstorm/delat/ms-balans.js";

const START = 1_700_000_000_000;

// ---- Strategier: (station, elev, tillstånd, t) → "skold" | "laser" | "drag" | null (spara) ----

/** Slumpar mellan sköld och laser, men väljer det andra när en mätare är full. */
function blandar(st, rng) {
  const skoldFull = st.skold >= SKOLD_TAK - 0.5;
  const laserFull = st.laddning >= LADDNING_TAK - 0.05;
  if (skoldFull && laserFull) return null;
  if (skoldFull) return "laser";
  if (laserFull) return "skold";
  return rng.tal() < 0.5 ? "skold" : "laser";
}

const STRATEGIER = {
  blandar: (ctx) => blandar(ctx.st, ctx.rng),
  "bara-skold": (ctx) => (ctx.st.skold >= SKOLD_TAK - 0.5 ? null : "skold"),
  "bara-laser": (ctx) => (ctx.st.laddning >= LADDNING_TAK - 0.05 ? null : "laser"),
  /** Blandar som "blandar", men drar i dragstrålen så fort den kan – mot vilken meteor som helst. */
  naiv: (ctx) => {
    const { st, elev } = ctx;
    if (ctx.dragOk && elev.energi >= st.drag.kostnad) return "drag";
    if (ctx.dragOk && elev.reserv && elev.energi < st.drag.kostnad) return null;
    return blandar(st, ctx.rng);
  },
  /**
   * Smart: drar lika ofta som "naiv", men väntar in en större meteor när den
   * närmaste är liten och en större redan är på väg, och laddar lasern mot
   * slungade meteorer och jättemeteorer innan den blandar.
   */
  smart: (ctx) => {
    const { st, tillstand, elev } = ctx;
    const egna = tillstand.meteorer.filter((m) => m.mal === st.classId);
    const storm = egna.filter((m) => !m.jatte && !m.kastadAv).sort((a, b) => a.ankomstMs - b.ankomstMs);
    if (ctx.dragOk) {
      const vantaIn = storm[0]?.storlek === "liten" && storm.slice(1).some((m) => m.storlek !== "liten");
      if (elev.energi >= st.drag.kostnad && !vantaIn) return "drag";
      if (elev.reserv && elev.energi < st.drag.kostnad) return null;
    }
    const hot = egna.filter((m) => m.jatte || m.kastadAv).reduce((s, m) => s + m.hp, 0);
    if (hot > st.skott && st.laddning < LADDNING_TAK - 0.05) return "laser";
    return blandar(st, ctx.rng);
  },
};

// ---- En match ------------------------------------------------------------------

/**
 * klasser: [{ classId, elever, andelRatt, takt (s/fråga), strategi }]
 * → { tillstand (slut), cfg }
 */
export function spelaMatch({ seed, klasser, lage = "en-klass", attacker = "milda", varaktighetMs = 600_000 },
  { skapaMotor, energiEffekt } = { ...motorModul, ...ageraModul }) {
  const cfg = {
    seed, startMs: START, varaktighetMs, installningar: { lage, attacker },
    stationer: klasser.map((k) => ({ classId: k.classId, aktiva: k.elever })),
  };
  const motor = skapaMotor(cfg);
  const rng = skapaPrng(seed, "sim");
  const svar = [];
  for (const k of klasser) {
    for (let e = 0; e < k.elever; e++) {
      const elev = { uid: `${k.classId}-${e}`, classId: k.classId, energi: 0, reserv: e % 5 === 0, rng: skapaPrng(seed, `elev-${k.classId}-${e}`) };
      let t = START + Math.round(elev.rng.mellan(1000, k.takt * 1000));
      while (t < START + varaktighetMs) {
        svar.push({ t, elev, k });
        t += Math.round(elev.rng.mellan(0.75, 1.25) * k.takt * 1000);
      }
    }
  }
  svar.sort((a, b) => a.t - b.t || (a.elev.uid < b.elev.uid ? -1 : 1));
  const handlingar = [];
  const senasteDrag = new Map();
  let id = 0;
  for (const { t, elev, k } of svar) {
    if (elev.rng.tal() >= k.andelRatt) continue;
    elev.energi = Math.min(ENERGI_TAK, elev.energi + energiEffekt(cfg, t).energi);
    const tillstand = motor.tillstand(t);
    const st = tillstand.stationer.find((s) => s.classId === k.classId);
    for (let varv = 0; varv < ENERGI_TAK && elev.energi > 0; varv++) {
      // Samma kontroll som kanAgera (servern), men utan att bygga om loggen för varje tryck.
      const dragOk = st.drag.tillaten && !st.drag.armerad && t >= st.drag.redoMs && senasteDrag.get(k.classId) !== tillstand.speltidMs;
      const val = STRATEGIER[k.strategi]({ st, tillstand, t, elev, rng, dragOk });
      if (!val) break;
      const kostnad = val === "drag" ? st.drag.kostnad : KOSTNAD[val];
      if (elev.energi < kostnad) break;
      if (val === "drag" && !dragOk) break;
      elev.energi -= kostnad;
      const h = { id: `h${String(++id).padStart(6, "0")}`, t, classId: k.classId, uid: elev.uid, typ: val };
      handlingar.push(h);
      motor.laggTill(h);
      if (val === "drag") { senasteDrag.set(k.classId, tillstand.speltidMs); break; }
    }
  }
  return { tillstand: motor.tillstand(START + varaktighetMs), cfg: { ...cfg, handlingar } };
}

// ---- Scenarierna (§2.3.2) -------------------------------------------------------

const klass = (classId, andelRatt, strategi = "blandar", elever = 25, takt = 8) => ({ classId, elever, andelRatt, takt, strategi });

export const SCENARIER = [
  { namn: "80 % rätt, blandar", mal: "70–90 (⭐⭐⭐)", klasser: [klass("A", 0.8)] },
  { namn: "60 % rätt, blandar", mal: "45–65 (⭐⭐)", klasser: [klass("A", 0.6)] },
  { namn: "40 % rätt, blandar", mal: "10–30 (⭐)", klasser: [klass("A", 0.4)] },
  { namn: "Nästan inget (5 % rätt)", mal: "0 vid ~halva tiden", klasser: [klass("A", 0.05)] },
  { namn: "80 % rätt, bara sköld", mal: "sämre än blandar", klasser: [klass("A", 0.8, "bara-skold")] },
  { namn: "80 % rätt, bara laser", mal: "sämre än blandar", klasser: [klass("A", 0.8, "bara-laser")] },
  { namn: "60 % rätt, 19 elever", mal: "≈ 60 % med 25", klasser: [klass("A", 0.6, "blandar", 19)] },
];

export const KMK = [
  { namn: "60 % smart mot 70 % naiv", mal: "60 % vinner ≥ 25 %", klasser: [klass("A", 0.6, "smart"), klass("B", 0.7, "naiv")] },
  { namn: "60 % smart mot 70 % smart", mal: "70 % vinner oftast", klasser: [klass("A", 0.6, "smart"), klass("B", 0.7, "smart")] },
  { namn: "60 % naiv mot 70 % naiv", mal: "70 % vinner oftast", klasser: [klass("A", 0.6, "naiv"), klass("B", 0.7, "naiv")] },
  { namn: "60 % blandar mot 70 % blandar", mal: "70 % vinner oftast", klasser: [klass("A", 0.6, "blandar"), klass("B", 0.7, "blandar")] },
  { namn: "60 % smart mot 70 % blandar", mal: "–", klasser: [klass("A", 0.6, "smart"), klass("B", 0.7, "blandar")] },
];

const medel = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const percentil = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

export function korEnKlass(sc, n) {
  const skrov = [];
  const noll = [];
  const stjarnor = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const { tillstand } = spelaMatch({ seed: `sim-${i}`, klasser: sc.klasser });
    const st = tillstand.stationer[0];
    skrov.push(st.skrov);
    if (st.nollVidMs !== null) noll.push((st.nollVidMs - START) / 1000);
    stjarnor[tillstand.resultat.stjarnor]++;
  }
  return { skrov: medel(skrov), p10: percentil(skrov, 0.1), p90: percentil(skrov, 0.9), noll, stjarnor };
}

export function korKmk(sc, n, attacker = "milda") {
  let vinstA = 0;
  let vinstB = 0;
  let lika = 0;
  const a = [];
  const b = [];
  for (let i = 0; i < n; i++) {
    const { tillstand } = spelaMatch({ seed: `kmk-${i}`, klasser: sc.klasser, lage: "klass-mot-klass", attacker });
    const r = tillstand.resultat;
    if (r.oavgjort) lika++;
    else if (r.vinnare === "A") vinstA++;
    else vinstB++;
    a.push(tillstand.stationer[0].skrov);
    b.push(tillstand.stationer[1].skrov);
  }
  return { vinstA: vinstA / n, vinstB: vinstB / n, lika: lika / n, skrovA: medel(a), skrovB: medel(b) };
}

const f0 = (x) => Math.round(x).toString();
const pct = (x) => `${Math.round(x * 100)} %`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const iN = process.argv.indexOf("--n");
  const n = iN > 0 ? Number(process.argv[iN + 1]) : 200;
  const md = process.argv.includes("--md");
  const rader = [];
  for (const sc of process.argv.includes("--kmk") ? [] : SCENARIER) {
    const r = korEnKlass(sc, n);
    const noll = r.noll.length ? `${r.noll.length}/${n}, median ${f0(percentil(r.noll, 0.5))} s` : "–";
    rader.push([sc.namn, sc.mal, f0(r.skrov), `${f0(r.p10)}–${f0(r.p90)}`, noll, r.stjarnor.join(" / ")]);
  }
  const kmk = [];
  for (const sc of KMK) {
    for (const attacker of ["milda", "vilda"]) {
      const r = korKmk(sc, n, attacker);
      kmk.push([`${sc.namn} (${attacker})`, sc.mal, pct(r.vinstA), pct(r.vinstB), pct(r.lika), `${f0(r.skrovA)} / ${f0(r.skrovB)}`]);
    }
  }
  const tabell = (huvud, rr) => md
    ? [`| ${huvud.join(" | ")} |`, `| ${huvud.map(() => "---").join(" | ")} |`, ...rr.map((r) => `| ${r.join(" | ")} |`)].join("\n")
    : [huvud, ...rr].map((r) => r.map((c) => String(c).padEnd(30)).join("")).join("\n");
  console.log(`En klass, 25 elever, en fråga per ~8 s, 10 min, ${n} frön:\n`);
  console.log(tabell(["Klass", "Mål", "Skrov (medel)", "Skrov p10–p90", "Skrov 0 (antal, median)", "Stjärnor 0/1/2/3"], rader));
  console.log(`\nKlass mot klass, 25 + 25 elever, ${n} frön:\n`);
  console.log(tabell(["Match", "Mål", "A vinner", "B vinner", "Oavgjort", "Skrov A / B"], kmk));
}
