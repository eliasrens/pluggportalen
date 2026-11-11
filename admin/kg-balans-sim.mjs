// ============================================================================
// Kurragömma (#836): BALANSSIMULERING (spec §11.5). Kör de riktiga reglerna
// (src/live/formats/kurragomma/delat/) med 25 påhittade elever i 8 minuter
// vid 60, 75 och 90 % rätt, och skriver ut de fyra måtten:
//   1. medelpoäng för startsökare, gömmare som hittas och gömmare som klarar sig
//   2. gömda kvar vid slutet (riktmärke 15–40 %)
//   3. visslingar per minut i klassen (riktmärke ≤ 6)
//   4. andel av poängen från rätt svar (riktmärke ≥ 60 %)
// Når riktmärkena inte: justera BARA src/…/delat/kg-config.js.
//
//   npm run balans:kurragomma           → tabellen (200 frön per rad)
//   node admin/kg-balans-sim.mjs --n 50 → färre frön (snabbare)
//   node admin/kg-balans-sim.mjs --md   → tabellen som markdown (docs/KURRAGOMMA.md)
//
// Robotarnas beteende (antaganden, inte spelregler – står i docs/KURRAGOMMA.md §6):
//   ROBOT nedan. Exporterar spelaMatch/korBalans så att testerna kan köra en kort variant.
// ============================================================================

import { fileURLToPath } from "node:url";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { skydd, narmasteGiltiga } from "../src/live/formats/kurragomma/delat/kg-geometri.js";
import {
  svarsEffekt, laddningarVidLetStart, laddningarNySokare, kontrolleraSokning, sok, visslingsplats,
  poangVidHittad, poangGomdVidSlut, poangForHittad, antalStartsokare, valjSlumpade,
} from "../src/live/formats/kurragomma/delat/kg-regler.js";
import { POANG, LADDNING_MAX } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { skapaPrng } from "../src/live/formats/kurragomma/delat/kg-prng.js";

/** Robotarnas beteende – antaganden om hur en klass spelar, inte spelregler. */
export const ROBOT = {
  /** Sekunder per fråga för en gömd som sitter still (±25 %), som Meteorstormens sim. */
  gomdTakt: 8,
  /** Sekunder per fråga för en sökare som också går omkring (±25 %). */
  sokarTakt: 12,
  /** Effektiv gångfart (m/s) – barn går inte raka vägen. */
  fart: 4,
  /** En sökare går mot en vissling om den är högst så här långt bort … */
  jagaM: 18,
  /** … och visslingen är högst så här gammal (pilen mot senaste visslingen). */
  jagaMs: 15_000,
  /** Sökpunkten vid en vissling: markören + brus inom så här många meter (första, andra sökningen). */
  sokBrus: [1, 2.5],
  /** Hur gömmarna väljer gömställe (andelar): inne i lov, vid kanten, nära, ute på ängen. */
  gomVal: { lov: 0.35, kant: 0.35, nara: 0.2, ute: 0.1 },
  /** Andel sökare som letar vid varje föremål de går förbi (resten sparar till full ficklampa). */
  andelSpammar: 0.5,
};

const STEG_MS = 250;

function gomstalle(rng) {
  const kat = (() => {
    let r = rng.tal();
    for (const [k, v] of Object.entries(ROBOT.gomVal)) { r -= v; if (r < 0) return k; }
    return "ute";
  })();
  const fm = ON.foremal.filter((f) => f.r > 0 && (kat !== "lov" || f.lov));
  const f = rng.valj(fm);
  const a = rng.mellan(0, 2 * Math.PI);
  let d;
  if (kat === "lov") d = f.r * Math.sqrt(rng.tal()) * 0.95;
  else if (kat === "kant") d = f.r + rng.mellan(-0.3, 0.6);
  else if (kat === "nara") d = f.r + rng.mellan(0.6, 2);
  if (kat === "ute") {
    const r = 28 * Math.sqrt(rng.tal());
    return narmasteGiltiga(Math.cos(a) * r, Math.sin(a) * r);
  }
  return narmasteGiltiga(f.x + Math.cos(a) * d, f.z + Math.sin(a) * d);
}

const brus = (rng, x, z, m) => {
  const r = m * Math.sqrt(rng.tal());
  const a = rng.mellan(0, 2 * Math.PI);
  return narmasteGiltiga(x + Math.cos(a) * r, z + Math.sin(a) * r);
};

/**
 * En match. → { elever: [{ uid, start, roll, poang, rattPoang, hittadAt? }], visslingar,
 *               letMs, gomdaStart, gomdaKvar, hittadeEfterVissling }
 */
export function spelaMatch({ seed = 1, elever = 25, andelRatt = 0.75, speltidMin = 8, gomtidS = 30, startsokare = "auto" } = {}) {
  const rng = skapaPrng(seed, "kg-balans");
  const uids = Array.from({ length: elever }, (_, i) => `e${i}`);
  const sokarIds = new Set(valjSlumpade(uids, antalStartsokare(elever, startsokare), rng.tal));
  const letStartAt = gomtidS * 1000;
  const slutAt = letStartAt + speltidMin * 60_000;
  const nasta = (takt) => Math.round(rng.mellan(0.75, 1.25) * takt * 1000);

  const el = uids.map((uid) => {
    const sk = sokarIds.has(uid);
    const e = { uid, start: sk ? "sokare" : "gomd", roll: sk ? "sokare" : "gomd", poang: 0, rattPoang: 0,
      laddningar: 0, svarAt: 0, senastVisslingAt: null, spammar: rng.tal() < ROBOT.andelSpammar,
      jagade: new Set(), mal: null };
    if (sk) {
      Object.assign(e, { ...ON.sokarStart, startpunkt: null, senasteSok: null });
      e.svarAt = nasta(ROBOT.sokarTakt);
    } else {
      Object.assign(e, gomstalle(rng));
      e.skydd = skydd(e.x, e.z);
      e.svarAt = letStartAt + nasta(ROBOT.gomdTakt);
    }
    return e;
  });

  const visslingar = [];
  let hittadeEfterVissling = 0;
  let nu = 0;
  let letat = false;

  const svara = (e) => {
    const ratt = rng.tal() < andelRatt;
    const eff = svarsEffekt({ roll: e.roll, ratt, fas: nu < letStartAt ? "gom" : "leta", laddningar: e.laddningar, senastVisslingAt: e.senastVisslingAt, nu });
    e.poang += eff.poang;
    e.rattPoang += eff.poang;
    e.laddningar = eff.laddningar;
    if (eff.vissling) {
      e.senastVisslingAt = nu;
      visslingar.push({ id: visslingar.length, at: nu, ...visslingsplats(e.x, e.z, rng.tal(), rng.tal()) });
    }
    e.svarAt = nu + nasta(e.roll === "sokare" ? ROBOT.sokarTakt : ROBOT.gomdTakt);
  };

  const leta = (s, x, z, viaVissling) => {
    const k = kontrolleraSokning({ roll: "sokare", laddningar: s.laddningar, x, z, nu, senasteSok: s.senasteSok, startpunkt: s.startpunkt });
    if (!k.ok) return false;
    s.laddningar -= 1;
    s.senasteSok = { x, z, at: nu };
    const gomda = el.filter((g) => g.roll === "gomd");
    for (const uid of sok({ x, z, nu }, gomda)) {
      const g = el.find((q) => q.uid === uid);
      g.roll = "sokare";
      g.hittadAt = nu;
      g.poang += poangVidHittad({ letStartAt, hittadAt: nu });
      g.laddningar = laddningarNySokare();
      g.startpunkt = { x: g.x, z: g.z, at: nu };
      g.senasteSok = null;
      g.svarAt = nu + nasta(ROBOT.sokarTakt);
      s.poang += poangForHittad();
      if (viaVissling) hittadeEfterVissling++;
    }
    return true;
  };

  const valjMal = (s) => {
    const v = visslingar[visslingar.length - 1];
    if (v && nu - v.at <= ROBOT.jagaMs && !s.jagade.has(v.id) && Math.hypot(v.x - s.x, v.z - s.z) <= ROBOT.jagaM) {
      s.jagade.add(v.id);
      const p = brus(rng, v.x, v.z, ROBOT.sokBrus[0]);
      return { ...p, vissling: v, forsok: 0 };
    }
    if (s.mal) return s.mal;
    const f = rng.valj(ON.foremal.filter((q) => q.r > 0));
    return { ...brus(rng, f.x, f.z, f.r * 0.6), vissling: null };
  };

  for (; nu <= slutAt; nu += STEG_MS) {
    if (!letat && nu >= letStartAt) {
      letat = true;
      for (const s of el) if (s.roll === "sokare") {
        s.laddningar = laddningarVidLetStart(s.laddningar);
        s.startpunkt = { x: s.x, z: s.z, at: nu };
      }
    }
    for (const e of el) if (nu >= e.svarAt && (e.roll === "sokare" || nu >= letStartAt)) svara(e);
    if (!letat) continue;
    if (!el.some((e) => e.roll === "gomd")) break;
    for (const s of el) {
      if (s.roll !== "sokare") continue;
      s.mal = valjMal(s);
      const d = Math.hypot(s.mal.x - s.x, s.mal.z - s.z);
      const steg = (ROBOT.fart * STEG_MS) / 1000;
      if (d > steg) {
        s.x += ((s.mal.x - s.x) / d) * steg;
        s.z += ((s.mal.z - s.z) / d) * steg;
        continue;
      }
      s.x = s.mal.x;
      s.z = s.mal.z;
      const v = s.mal.vissling;
      const villLeta = v ? true : (s.spammar || s.laddningar >= LADDNING_MAX);
      if (villLeta && s.laddningar >= 1) {
        if (!leta(s, s.x, s.z, !!v)) continue;
        if (v && s.mal.forsok === 0 && s.laddningar >= 1) {
          s.mal = { ...brus(rng, v.x, v.z, ROBOT.sokBrus[1]), vissling: v, forsok: 1 };
          continue;
        }
      }
      s.mal = null;
    }
  }
  const slut = Math.min(nu, slutAt);
  for (const e of el) if (e.roll === "gomd") e.poang += poangGomdVidSlut({ letStartAt, slutAt: slut });
  const gomdaStart = el.filter((e) => e.start === "gomd").length;
  return {
    elever: el.map(({ uid, start, roll, poang, rattPoang, hittadAt }) => ({ uid, start, roll, poang, rattPoang, hittadAt })),
    visslingar: visslingar.length,
    letMs: slut - letStartAt,
    gomdaStart,
    gomdaKvar: el.filter((e) => e.roll === "gomd").length,
    hittadeEfterVissling,
  };
}

const medel = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const percentil = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/** Kör n frön vid en träffsäkerhet och räknar de fyra måtten. */
export function korBalans({ andelRatt, n = 200, ...opt }) {
  const startsok = [];
  const hittade = [];
  const klarade = [];
  const kvarAndel = [];
  const vpm = [];
  let ratt = 0;
  let total = 0;
  let viaVissling = 0;
  let hittadeTot = 0;
  for (let i = 0; i < n; i++) {
    const m = spelaMatch({ seed: `${andelRatt}-${i}`, andelRatt, ...opt });
    for (const e of m.elever) {
      if (e.start === "sokare") startsok.push(e.poang);
      else if (e.roll === "sokare") hittade.push(e.poang);
      else klarade.push(e.poang);
      ratt += e.rattPoang;
      total += e.poang;
    }
    kvarAndel.push(m.gomdaKvar / m.gomdaStart);
    vpm.push(m.visslingar / Math.max(1 / 60, m.letMs / 60_000));
    viaVissling += m.hittadeEfterVissling;
    hittadeTot += m.gomdaStart - m.gomdaKvar;
  }
  return {
    andelRatt,
    startsokare: medel(startsok),
    hittade: medel(hittade),
    klarade: medel(klarade),
    kvar: medel(kvarAndel),
    kvarP10: percentil(kvarAndel, 0.1),
    kvarP90: percentil(kvarAndel, 0.9),
    visslingarPerMin: medel(vpm),
    andelRattPoang: ratt / total,
    hittadeViaVissling: hittadeTot ? viaVissling / hittadeTot : 0,
  };
}

export const NIVAER = [0.6, 0.75, 0.9];

const pct = (v) => `${Math.round(v * 100)} %`;
const ett = (v) => (Number.isFinite(v) ? v.toFixed(1).replace(".", ",") : "–");
const hel = (v) => (Number.isFinite(v) ? String(Math.round(v)) : "–");

export function tabell(rader, md = false) {
  const rubrik = ["Rätt", "Startsökare (p)", "Hittade gömmare (p)", "Klarade gömmare (p)",
    "Gömda kvar (p10–p90)", "Visslingar/min", "Poäng från rätt svar", "Hittade efter vissling"];
  const rad = (r) => [pct(r.andelRatt), hel(r.startsokare), hel(r.hittade), hel(r.klarade),
    `${pct(r.kvar)} (${pct(r.kvarP10)}–${pct(r.kvarP90)})`, ett(r.visslingarPerMin), pct(r.andelRattPoang), pct(r.hittadeViaVissling)];
  if (md) {
    return [`| ${rubrik.join(" | ")} |`, `| ${rubrik.map(() => "---").join(" | ")} |`,
      ...rader.map((r) => `| ${rad(r).join(" | ")} |`)].join("\n");
  }
  const alla = [rubrik, ...rader.map(rad)];
  const bredd = rubrik.map((_, i) => Math.max(...alla.map((r) => r[i].length)));
  return alla.map((r) => r.map((c, i) => c.padEnd(bredd[i])).join("  ")).join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv.slice(2);
  const ni = arg.indexOf("--n");
  const n = ni >= 0 ? Number(arg[ni + 1]) : 200;
  const rader = NIVAER.map((andelRatt) => korBalans({ andelRatt, n }));
  console.log(`Kurragömma – balans: 25 elever, 8 min, gömtid 30 s, startsökare auto, ${n} frön per rad`);
  console.log(`Riktmärken: gömda kvar 15–40 %, visslingar/min ≤ 6, poäng från rätt svar ≥ ${pct(0.6)}`);
  console.log(`(${POANG.ratt} p per rätt, ${POANG.hittade} p per hittad, ${POANG.overlevnad} p per 10 s gömd, ${POANG.gomdVidSlut} p gömd vid slutet)\n`);
  console.log(tabell(rader, arg.includes("--md")));
}
