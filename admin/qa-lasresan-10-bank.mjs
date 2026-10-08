// ============================================================================
// Slut-QA Läsresan 10 nivåer (#525, epic #516) – bankkontroll, ingen Firebase.
// ----------------------------------------------------------------------------
// Spec §3, §4, §8: 10 nivåer, ≥ 30 texter per nivå, ≥ 300 totalt,
// validateBank 0 fel, rätt antal frågor per nivå, exakt ett giltigt facit,
// 4 alternativ, unika id:n, id-konvention ↔ nivå, pickText per nivå. Dessutom:
// de GAMLA texterna (nivå 1–7 i epic #482-grenen) ska ligga på nivå +3 och vara
// IDENTISKA utöver `level` (samma id, titel, brödtext, frågor, facit).
//
//   node admin/qa-lasresan-10-bank.mjs [jämförelse-rev]
//   (default rev: origin/epic/l-sresan-40-texter-per-niv-l-rarstyrda-n-7ef183)
// ============================================================================
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { LEVEL_MIN, LEVEL_MAX, OPTIONS_PER_QUESTION } from "../src/lasresan/config.js";
import { validateBank, validateText, questionRange, levelFromId } from "../src/lasresan/content/validate.js";
import { pickText } from "../src/lasresan/picker.js";

const REV = process.argv[2] || "origin/epic/l-sresan-40-texter-per-niv-l-rarstyrda-n-7ef183";
const BANK_DIR = new URL("../src/lasresan/content/bank/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", BANK_DIR), "utf8"));
const BANK = Object.values(manifest.levels).flat().flatMap((f) => JSON.parse(readFileSync(new URL(f, BANK_DIR), "utf8")));

let fel = 0;
function kontroll(namn, ok, extra = "") {
  if (!ok) fel++;
  console.log(`  ${ok ? "✓" : "✗"} ${namn}${extra ? ` – ${extra}` : ""}`);
}

console.log(`[bank] ${BANK.length} texter i manifestet (${Object.keys(manifest.levels).length} nivåer)`);
const r = validateBank(BANK);
kontroll("validateBank", r.errors.length === 0, `${r.errors.length} fel / ${r.warnings.length} varningar`);
for (const w of r.warnings) console.log(`    varning: ${w}`);
kontroll("≥ 300 texter totalt", BANK.length >= 300, String(BANK.length));
kontroll("manifestet har exakt nivå 1–10", isDeepStrictEqual(Object.keys(manifest.levels).map(Number).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
kontroll("text-id unika", new Set(BANK.map((t) => t.id)).size === BANK.length);

for (let lvl = LEVEL_MIN; lvl <= LEVEL_MAX; lvl++) {
  const pool = BANK.filter((t) => t.level === lvl);
  const [qmin, qmax] = questionRange(lvl);
  const giltiga = pool.filter((t) => validateText(t).errors.length === 0).length;
  const antal = pool.map((t) => t.questions.length);
  const fragorOk = antal.every((n) => n >= qmin && n <= qmax);
  const facitOk = pool.every((t) => t.questions.every((q) =>
    Array.isArray(q.options) && q.options.length === OPTIONS_PER_QUESTION
    && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < q.options.length
    && new Set(q.options.map((o) => String(o).trim().toLowerCase())).size === q.options.length));
  const idOk = pool.every((t) => levelFromId(t.id) === lvl);
  const valda = new Set();
  for (let i = 0; i < 200; i++) valda.add(pickText(lvl, [], BANK).level);
  const typer = pool.reduce((m, t) => ({ ...m, [t.textType]: (m[t.textType] || 0) + 1 }), {});
  kontroll(
    `nivå ${lvl}: ${giltiga}/${pool.length} giltiga (${typer.story || 0} story/${typer.fact || 0} fact), frågor ${Math.min(...antal)}–${Math.max(...antal)} (krav ${qmin}–${qmax}), 4 unika alternativ + ett facit, id ↔ nivå, pickText ger ${[...valda]}`,
    pool.length >= 30 && giltiga === pool.length && fragorOk && facitOk && idOk && valda.size === 1 && valda.has(lvl),
  );
}

// --- Gamla texter oförändrade utöver level (+3) -------------------------------------
console.log(`\n[gamla texter] jämför mot ${REV}`);
let gammal = [];
try {
  const oldManifest = JSON.parse(execSync(`git show ${REV}:src/lasresan/content/bank/manifest.json`, { encoding: "utf8" }));
  gammal = Object.values(oldManifest.levels).flat()
    .flatMap((f) => JSON.parse(execSync(`git show ${REV}:src/lasresan/content/bank/${f}`, { encoding: "utf8", maxBuffer: 64 << 20 })));
} catch (e) {
  kontroll(`kunde läsa banken i ${REV}`, false, String(e.message).split("\n")[0]);
}
if (gammal.length) {
  const ny = new Map(BANK.map((t) => [t.id, t]));
  const saknas = gammal.filter((t) => !ny.has(t.id)).map((t) => t.id);
  const flyttFel = gammal.filter((t) => ny.has(t.id) && ny.get(t.id).level !== t.level + 3).map((t) => t.id);
  const andrade = gammal.filter((t) => {
    const n = ny.get(t.id);
    if (!n) return false;
    const { level: _a, ...o } = t;
    const { level: _b, ...m } = n;
    return !isDeepStrictEqual(o, m);
  }).map((t) => t.id);
  kontroll(`alla ${gammal.length} gamla text-id finns kvar`, saknas.length === 0, saknas.slice(0, 5).join(", "));
  kontroll("varje gammal text ligger på gammal nivå + 3", flyttFel.length === 0, flyttFel.slice(0, 5).join(", "));
  kontroll("gamla texter identiska utöver level (titel, brödtext, frågor, facit)", andrade.length === 0, andrade.slice(0, 5).join(", "));
  const nyaId = BANK.filter((t) => !gammal.some((g) => g.id === t.id));
  kontroll(`nya texter: ${nyaId.length} st, alla lr-g1/2/3- på nivå 1–3`, nyaId.every((t) => /^lr-g[123]-/.test(t.id) && t.level <= 3));
}

console.log(fel ? `\n✗ ${fel} kontroll(er) föll` : "\n✓ alla bankkontroller gröna");
process.exit(fel ? 1 : 0);
