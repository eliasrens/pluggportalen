// ============================================================================
// Datakuppen 💾 (#832): BALANSSIMULERING (uppdraget datakuppen-klassradet.md
// §11). Kör samma match med två regeluppsättningar och skriver ut båda:
//   FÖRE   filtabellen före klassrådet (fryst kopia nedan: Liten fil 10 MB,
//          Tom mapp, virus −10 %, Överklockning ×2 högst +150, inget kodbyte
//          efter hack (#719), brandvägg under hack = hacket förbrukat,
//          ingen att hacka → Mapp 25 MB)
//   EFTER  den riktiga konfigurationen (delat/files-config.js DK_BALANS +
//          delat/dk-filregler.js – samma kod som servern slumpar med)
//
//   npm run balans:datakuppen          → båda tabellerna (200 matcher per rad)
//   node admin/datakuppen-balans.mjs --n 50 --md   → färre matcher, markdown
//
// Modellen: 25 elever, 10 minuter. Varje elev svarar var 6–12:e sekund och
// har en egen träffsäkerhet (50–95 %). Rätt svar → en fil (filerna är dolda,
// så valet bland tre är slumpen). Hack: slumpat giltigt mål, gissningen ~5 s
// senare bland koderna som är kvar i minnet (1/3, 1/2, säkert). Brandväggar
// hinner komma emellan. Exporterar spelaMatch/REGLER för testerna.
// ============================================================================

import { fileURLToPath } from "node:url";
import { createKistRegler } from "../src/live/kistspel/delat/ks-regler.js";
import { DK_FILES, DK_RULES } from "../src/live/formats/datakuppen/delat/files-config.js";
import { rollFile, applyFile, virusAllowed, leakLimit, hackFallbackId, fileTable } from "../src/live/formats/datakuppen/delat/dk-filregler.js";

// --- Filtabellen FÖRE klassrådet (main @ 34cad9d) ------------------------------------
const OLD_FILES = Object.freeze([
  { id: "liten_fil", weight: 22, effect: { kind: "gold", amount: 10 } },
  { id: "mapp", weight: 20, effect: { kind: "gold", amount: 25 } },
  { id: "stor_fil", weight: 9, effect: { kind: "gold", amount: 50 } },
  { id: "serverhall", weight: 3, effect: { kind: "gold", amount: 100 } },
  { id: "overklockning", weight: 7, effect: { kind: "double", cap: 150 } },
  { id: "virus", weight: 8, effect: { kind: "lose", share: 0.1 } },
  { id: "tom_mapp", weight: 13, effect: { kind: "empty" } },
  { id: "brandvagg", weight: 6, effect: { kind: "shield" } },
  { id: "hack", weight: 9, effect: { kind: "steal", share: 0.15 } },
]);
const OLD = createKistRegler({ chests: OLD_FILES, rules: DK_RULES });

export const REGLER = {
  fore: {
    namn: "FÖRE",
    table: (hacking) => OLD.chestTable(hacking).map((r) => ({ id: r.chest.id, weight: r.weight })),
    roll: (hacking, _felIRad, rng) => OLD.rollChest(hacking, rng),
    apply: (f, gold) => OLD.applySelfEffect(f, gold),
    fallback: "mapp",
    kodbyteEfterHack: false,
    avbrytVidSkydd: false,
    kodlacka: false,
  },
  efter: {
    namn: "EFTER",
    table: (hacking, virus = true) => fileTable({ hacking, virus }).map((r) => ({ id: r.chest.id, weight: r.weight })),
    roll: (hacking, felIRad, rng) => rollFile({ hacking, virus: virusAllowed(felIRad) }, rng),
    apply: (f, gold, rng) => applyFile(f, gold, rng),
    fallback: hackFallbackId(),
    kodbyteEfterHack: true,
    avbrytVidSkydd: true,
    kodlacka: true,
  },
};

const fileOf = (id) => DK_FILES.find((f) => f.id === id) || OLD_FILES.find((f) => f.id === id);

/** Mulberry32 – samma frö ger samma match. */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * En match. opts = { elever = 25, minuter = 10, hacking = true, accuracy?: fast
 * träffsäkerhet för alla }. → { players[], stats }
 */
export function spelaMatch(regel, seed, { elever = 25, minuter = 10, hacking = true, accuracy = null } = {}) {
  const rng = prng(seed);
  const END = minuter * 60_000;
  const players = Array.from({ length: elever }, (_, i) => ({
    i, gold: 0, superMb: 0, protectedUntil: 0, lastVictim: null, felIRad: 0, correct: 0,
    acc: accuracy ?? 0.5 + rng() * 0.45, every: 6_000 + rng() * 6_000, next: rng() * 8_000, codeV: 1, knownBy: new Set(),
  }));
  const memory = new Map(); // `${hackare}:${mål}` → { codeV, struck }
  const stats = { filer: {}, virus: 0, superserver: 0, hack: 0, lyckade: 0, avbrutna: 0, fallback: 0, lackor: 0, ratt: 0 };
  const limit = leakLimit(elever);
  const eligible = (thief, t) => players.filter((v) => v !== thief && v.protectedUntil <= t &&
    thief.lastVictim !== v.i && Math.floor(v.gold * 0.15) >= 1);
  const newCode = (v) => { v.codeV++; v.knownBy = new Set(); };

  const guesses = []; // väntande gissningar { thief, v, at, prev, tries }

  function hack(thief, t, tries = 0) {
    const cands = eligible(thief, t);
    if (!cands.length || tries > 5) {
      const eff = regel.apply(fileOf(regel.fallback), thief.gold, rng);
      thief.gold = eff.gold;
      stats.fallback++;
      return;
    }
    const v = cands[Math.floor(rng() * cands.length)];
    guesses.push({ thief, v, at: t + 5_000, prev: thief.lastVictim, tries });
    thief.lastVictim = v.i;
    thief.next = Math.max(thief.next, t + 5_000);
    stats.hack++;
  }

  function guess({ thief, v, at, prev, tries }) {
    if (v.protectedUntil > at) {
      // Brandväggen hann före gissningen.
      if (regel.avbrytVidSkydd) { stats.avbrutna++; stats.hack--; thief.lastVictim = prev; hack(thief, at, tries + 1); }
      return;
    }
    const key = `${thief.i}:${v.i}`;
    let mem = memory.get(key);
    if (!mem || mem.codeV !== v.codeV) memory.set(key, (mem = { codeV: v.codeV, struck: 0 }));
    if (rng() < 1 / (3 - mem.struck)) {
      const amount = Math.floor(v.gold * 0.15);
      v.gold -= amount;
      thief.gold += amount;
      v.protectedUntil = at + DK_RULES.protectionMs;
      stats.lyckade++;
      if (regel.kodbyteEfterHack) newCode(v);
      return;
    }
    mem.struck++;
    if (regel.kodlacka && mem.struck >= 2) {
      v.knownBy.add(thief.i);
      if (v.knownBy.size >= limit) { stats.lackor++; newCode(v); }
    }
  }

  for (;;) {
    const p = players.reduce((a, b) => (b.next < a.next ? b : a));
    const g = guesses.reduce((a, b) => (!a || b.at < a.at ? b : a), null);
    if (g && g.at <= p.next) {
      guesses.splice(guesses.indexOf(g), 1);
      if (g.at < END) guess(g);
      continue;
    }
    const t = p.next;
    if (t >= END) break;
    p.next = t + p.every;
    if (rng() >= p.acc) { p.felIRad++; continue; }
    stats.ratt++;
    const f = regel.roll(hacking, p.felIRad, rng);
    p.felIRad = 0;
    stats.filer[f.id] = (stats.filer[f.id] || 0) + 1;
    if (f.effect.kind === "steal") { hack(p, t); continue; }
    const eff = regel.apply(f, p.gold, rng);
    if (f.effect.kind === "lose") stats.virus++;
    if (f.id === "superserver") { stats.superserver++; p.superMb += eff.delta; }
    if (eff.protect) p.protectedUntil = t + DK_RULES.shieldMs;
    p.gold = eff.gold;
  }
  return { players, stats };
}

const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;
const num = (x, d = 1) => x.toFixed(d).replace(".", ",");

/** Alla mätvärden för en regeluppsättning (n matcher per rad). */
export function mat(regel, n = 200) {
  const out = { regel: regel.namn };
  // Förväntat MB per rätt svar utan hack (Hackning av), snitt över matcherna.
  let mb = 0, ratt = 0;
  for (let s = 1; s <= n; s++) {
    const { players, stats } = spelaMatch(regel, s, { hacking: false });
    mb += players.reduce((a, p) => a + p.gold, 0);
    ratt += stats.ratt;
  }
  out.mbPerRatt = mb / ratt;
  // Andel filer (tabellen med hackning på; EFTER: med och utan virus möjligt).
  out.tabell = regel.table(true);
  if (regel.namn === "EFTER") out.tabellUtanVirus = regel.table(true, false);
  // Virus vid olika träffsäkerhet: virus per rätt svar och per match och elev.
  out.virus = [0.5, 0.7, 0.9].map((acc) => {
    let v = 0, r = 0;
    for (let s = 1; s <= n; s++) {
      const { stats } = spelaMatch(regel, 10_000 + s, { accuracy: acc });
      v += stats.virus;
      r += stats.ratt;
    }
    return { acc, perRatt: v / r, perElev: v / n / 25 };
  });
  // Superserverns andel av poängen (25 elever, 10 min, hackning på).
  let andelAlla = 0, andelVinnare = 0, vinnareMedSuper = 0, hackLyckade = 0, hackForsok = 0, avbrutna = 0, lackor = 0;
  for (let s = 1; s <= n; s++) {
    const { players, stats } = spelaMatch(regel, 20_000 + s);
    const total = players.reduce((a, p) => a + p.gold, 0);
    andelAlla += total ? players.reduce((a, p) => a + p.superMb, 0) / total : 0;
    const w = players.reduce((a, b) => (b.gold > a.gold ? b : a));
    andelVinnare += w.gold ? Math.min(1, w.superMb / w.gold) : 0;
    if (w.superMb > 0) vinnareMedSuper++;
    hackLyckade += stats.lyckade; hackForsok += stats.hack; avbrutna += stats.avbrutna; lackor += stats.lackor;
  }
  Object.assign(out, {
    superAlla: andelAlla / n, superVinnare: andelVinnare / n, vinnareMedSuper: vinnareMedSuper / n,
    hackPerMatch: hackForsok / n, lyckadePerMatch: hackLyckade / n, avbrutnaPerMatch: avbrutna / n, lackorPerMatch: lackor / n,
  });
  return out;
}

function print(res, md) {
  const row = md ? (cells) => `| ${cells.join(" | ")} |` : (cells) => cells.map((c, i) => String(c).padEnd(i ? 14 : 34)).join("");
  const lines = [];
  lines.push(md ? `### ${res.regel}` : `\n=== ${res.regel} ===`);
  if (md) lines.push("", row(["Mått", "Värde"]), row(["---", "---:"]));
  lines.push(row(["MB per rätt svar (utan hack)", num(res.mbPerRatt)]));
  for (const v of res.virus) {
    lines.push(row([`Virus vid ${Math.round(v.acc * 100)} % rätt`, `${pct(v.perRatt)} av filerna, ${num(v.perElev, 2)}/elev och match`]));
  }
  lines.push(row(["Superserver: andel av all data", pct(res.superAlla)]));
  lines.push(row(["Superserver: andel av vinnarens", pct(res.superVinnare)]));
  lines.push(row(["Vinnaren hade ≥ 1 Superserver", pct(res.vinnareMedSuper)]));
  lines.push(row(["Hack/match (lyckade)", `${num(res.hackPerMatch)} (${num(res.lyckadePerMatch)})`]));
  lines.push(row(["Avbrutna hack/match", num(res.avbrutnaPerMatch)]));
  lines.push(row(["Kodläckor/match", num(res.lackorPerMatch)]));
  if (md) lines.push("", row(["Fil", "Andel (hackning på)", ...(res.tabellUtanVirus ? ["Utan felsvit"] : [])]), row(["---", "---:", ...(res.tabellUtanVirus ? ["---:"] : [])]));
  else lines.push("-- andel filer (hackning på" + (res.tabellUtanVirus ? "; utan felsvit)" : ")"));
  for (const r of res.tabell) {
    const u = res.tabellUtanVirus?.find((x) => x.id === r.id);
    lines.push(row([r.id, pct(r.weight / res.tabell.reduce((a, x) => a + x.weight, 0)), ...(res.tabellUtanVirus ? [u ? pct(u.weight) : "–"] : [])]));
  }
  if (res.superVinnare > 0.25) lines.push(`⚠️ Superservrar står för mer än 25 % av vinnarens poäng (${pct(res.superVinnare)}) – redovisas, värdet ändras inte (§11).`);
  console.log(lines.join("\n"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const n = Number(argv[argv.indexOf("--n") + 1]) || 200;
  const md = argv.includes("--md");
  for (const regel of [REGLER.fore, REGLER.efter]) print(mat(regel, n), md);
}
