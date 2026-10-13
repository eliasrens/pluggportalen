// ============================================================================
// Tester: Ekvationsresan – uppgiftstyperna C–F (#625, spec E2.3).
// ----------------------------------------------------------------------------
// Generering per typ (nästa rad, bild → ekvation, hitta felet, problemlösning),
// rättning per typ, de kompletterande stjärnreglerna, försöket (typ + svar) och
// att problemlösning finns från nivå 3. Flödet i webbläsaren verifieras mot
// emulatorn (admin/qa-ekvationsresan-seed.mjs --typ C|D|E|F).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTask, similarTask, seededRng } from "../src/ekvationsresan/generator.js";
import { LEVELS, rulesFor, TYPE_STARS } from "../src/ekvationsresan/config.js";
import { fromJSON, solve, equationKey, parseEquation } from "../src/ekvationsresan/equation.js";
import { eq as same, q } from "../src/ekvationsresan/rational.js";
import { statesAlong } from "../src/ekvationsresan/vag-visning.js";
import { felRader } from "../src/ekvationsresan/hitta-felet.js";
import { fragor, hasSolvePhase, extendTask } from "../src/ekvationsresan/uppgiftstyper.js";
import { readEquation, compareEquation, startTyp, svara, losningKlar, typStars, typResultat, typKlar } from "../src/ekvationsresan/typ-svar.js";
import { startRun, playMove } from "../src/ekvationsresan/losning.js";
import { revealSolution } from "../src/ekvationsresan/hjalp.js";
import { buildAttempt, applyCompletion, defaultProgress } from "../src/ekvationsresan/framsteg.js";
import { forsokRader, svarRader } from "../src/ekvationsresan/larare.js";

const N = 400;
const SERIES = Object.fromEntries(
  LEVELS.map(({ level }) => {
    const rng = seededRng(`typer-${level}`);
    const out = [];
    let prev = null;
    for (let i = 0; i < N; i++) out.push((prev = generateTask(level, { rng, previous: prev })));
    return [level, out];
  }),
);
const ofType = (type) => LEVELS.flatMap(({ level }) => SERIES[level].filter((t) => t.type === type));
const rng = seededRng("typer-svar");
/** C i välj-läget (nivå ≤ NEXT_ROW_CHOICE_MAX_LEVEL): generatorn ger inte C under nivå 6 (#657), så den byggs direkt. */
function valjTask(level, seed, form = "ax+b=c") {
  const r = seededRng(seed);
  for (;;) {
    const t = extendTask({ ...generateTask(level, { rng: r, type: "A", form, swap: false }), type: "C" }, rulesFor(level), r);
    if (t) return t;
  }
}

/** Firestore tål inte listor direkt i listor. */
function noNestedArrays(v, inArray = false) {
  if (Array.isArray(v)) return !inArray && v.every((x) => noNestedArrays(x, true));
  if (v && typeof v === "object") return Object.values(v).every((x) => noNestedArrays(x, false));
  return true;
}

/** Svara rätt på aktuell fråga. */
function rattSvar(st) {
  const f = st.fragor[st.qi];
  if (f.kind === "rad") return f.val ? f.val.findIndex((e) => equationKey(e) === equationKey(f.after)) : txt(f.after);
  if (f.kind === "ekvation") return txt(f.target);
  return f.answer;
}
const txt = (eq) => {
  const term = (t) => (t.x ? `${Math.abs(t.n) === 1 ? "" : Math.abs(t.n)}x` : `${Math.abs(t.n)}`) + (t.d > 1 ? `/${t.d}` : "");
  const side = (s) => (s.length ? s.map((t, i) => `${t.n < 0 ? "-" : i ? "+" : ""}${term(t)}`).join("") : "0");
  return `${side(eq.left)}=${side(eq.right)}`;
};

// --- generering ---------------------------------------------------------------------

test("typerna varierar inom nivåerna; problemlösning (F) först från nivå 3, nästa rad (C) och hitta felet (E) från nivå 6, F störst på nivå 12", () => {
  for (const { level } of LEVELS) {
    const types = new Set(SERIES[level].map((t) => t.type));
    assert.equal(types.has("C"), level >= 6, `C på nivå ${level}`);
    assert.equal(types.has("F"), level >= 3, `F på nivå ${level}`);
    assert.equal(types.has("E"), level >= 6, `E på nivå ${level}`);
    assert.ok(types.has("A") || types.has("B"), `vanliga lösningsuppgifter finns kvar på nivå ${level}`);
  }
  const f = (l) => SERIES[l].filter((t) => t.type === "F").length / N;
  assert.ok(f(3) > 0.05 && f(3) < 0.25, `F är en mindre andel på nivå 3 (${f(3)})`);
  assert.ok(f(12) > 0.4, `F dominerar nivå 12 (${f(12)})`);
});

test("alla uppgifter är JSON-rena utan listor i listor (sparas i Firestore)", () => {
  for (const type of ["C", "D", "E", "F"]) {
    for (const t of ofType(type).slice(0, 60)) {
      assert.deepEqual(JSON.parse(JSON.stringify(t)), t);
      assert.ok(noNestedArrays(t), `${type} ${t.text}`);
    }
  }
});

test("C Nästa rad: skriv på alla nivåer där C finns (6–12); välj-läget (nivå ≤ 3) ger rätt rad + två olika fel", () => {
  assert.ok(ofType("C").every((t) => t.level >= 6 && t.nastaRad.mode === "skriv"));
  const valj = [1, 2, 3].flatMap((level) => LEVELS[level - 1] && Object.keys(LEVELS[level - 1].forms).map((form) => valjTask(level, `valj-${level}-${form}`, form)));
  for (const t of valj) {
    assert.equal(t.nastaRad.mode, "valj");
    const states = statesAlong(fromJSON(t.equation), t.optimalPath, rulesFor(t.level));
    assert.equal(t.nastaRad.steg.length, t.optimalPath.length);
    t.nastaRad.steg.forEach((s, i) => {
      const keys = s.val.map((e) => equationKey(fromJSON(e)));
      assert.equal(keys.length, 3);
      assert.equal(new Set(keys).size, 3, "tre olika alternativ");
      assert.equal(keys.filter((k) => k === equationKey(states[i + 1])).length, 1, `${t.text}: rätt rad finns en gång`);
    });
  }
});

test("D Bild → ekvation: texten beskriver ekvationen, x till vänster, vågen visar föremål eller block", () => {
  const d = ofType("D");
  assert.ok(d.length > 50);
  for (const t of d) {
    assert.equal(t.swapped, false);
    assert.notEqual(t.display, "stiliserad");
    assert.ok([...t.equation.left, ...t.equation.right].every((x) => x.n > 0 && x.d === 1));
    for (const x of t.equation.right.filter((x) => !x.x)) assert.ok(t.bild.text.includes(String(x.n)), `${t.text}: ${t.bild.text}`);
    assert.match(t.bild.x, /^x = antalet /);
  }
  const ex = generateTask(3, { rng: seededRng("d-ex"), type: "D", form: "ax+b=c" });
  assert.match(ex.bild.text, /^(Två|Tre|Fyra|Fem) \S+ och \d+ \S+ är lika mycket som \d+ /);
});

test("E Hitta felet: exakt en felrad, raderna före stämmer, felet fortplantar sig till fel x", () => {
  const e = ofType("E");
  assert.ok(e.length > 100);
  const kinds = new Set();
  for (const t of e) {
    const start = fromJSON(t.equation);
    const rows = felRader(t.fel, start, rulesFor(t.level));
    assert.equal(rows.filter((r) => r.fel).length, 1, t.text);
    assert.equal(rows.findIndex((r) => r.fel), t.fel.rad);
    // stegen före felsteget är den riktiga lösningen
    const k = t.fel.steg.findIndex((s) => s.fel);
    for (let i = 0; i < k; i++) assert.ok(same(solve(fromJSON(t.fel.steg[i].after)), solve(start)), `${t.text}: steg ${i} ska stämma`);
    // slutraden är x = något annat än lösningen
    const last = fromJSON(t.fel.steg.at(-1).after);
    assert.ok(!same(solve(last), solve(start)), `${t.text}: felet ska ge fel x`);
    assert.ok(t.optimalMoves >= 2);
    kinds.add(t.fel.kind);
  }
  assert.deepEqual([...kinds].sort(), ["delning", "enaSidan", "olika", "raknefel"]);
});

test("F Problemlösning: texten, frågan och tre meningar med x – bara en sann", () => {
  const f = ofType("F");
  assert.ok(f.length > 200);
  for (const t of f) {
    const p = t.problem;
    assert.equal(t.swapped, false);
    assert.ok(p.text && p.fraga.endsWith("?"));
    assert.equal(p.val.length, 3);
    assert.equal(new Set(p.val).size, 3);
    assert.equal(p.val[p.ratt], p.svar);
    const x = q(t.solution.n, t.solution.d);
    const xs = (x.d === 1 ? String(x.n) : null) ?? "";
    if (xs) assert.ok(p.val.every((v) => v.includes(xs)), `${t.text}: alla meningar har talet x (${p.val})`);
    if (p.bild) assert.equal(t.display, "foremal");
  }
  const ex = generateTask(3, { rng: seededRng("f-ex"), type: "F", form: "ax+b=c" });
  assert.ok(ex.problem.text.length > 20);
});

test("Försök igen behåller typen (C–F) och ger en ny, liknande uppgift", () => {
  for (const type of ["C", "D", "E", "F"]) {
    for (const t of ofType(type).slice(0, 15)) {
      const s = similarTask(t, { rng });
      assert.equal(s.type, type);
      assert.equal(s.form, t.form);
      assert.notEqual(s.key, t.key);
    }
  }
});

// --- rättning ------------------------------------------------------------------------

test("readEquation: tål mellanslag, ·/*, − och komma; kräver = och x", () => {
  assert.equal(equationKey(readEquation("3·x + 1 = 7").eq), equationKey(parseEquation("3x+1=7")));
  assert.equal(equationKey(readEquation(" 2*x −4 = 6").eq), equationKey(parseEquation("2x-4=6")));
  assert.ok(readEquation("2,5x + 4 = 19").ok);
  assert.equal(readEquation("2x + 4").error, "unreadable");
  assert.equal(readEquation("6 + 7 = 13").error, "needsX");
  assert.equal(readEquation("hej").error, "unreadable");
});

test("compareEquation: leden förenklas (x + x + 3), leden får byta plats", () => {
  const target = parseEquation("2x + 3 = 13");
  assert.ok(compareEquation(parseEquation("x + x + 3 = 13"), target).match);
  assert.ok(compareEquation(parseEquation("13 = 3 + 2x"), target).match);
  const other = compareEquation(parseEquation("2x = 10"), target);
  assert.ok(!other.match && other.sameSolution);
  const half = compareEquation(parseEquation("2x + 3 = 15"), target);
  assert.ok(!half.match && half.leftOk && !half.rightOk && half.anySide);
});

test("C skriv: riktad ledtråd för fel led, oläsbart räknas inte, rätt → nästa rad", () => {
  const t = generateTask(6, { rng: seededRng("c-skriv"), type: "C", form: "ax+b=c", swap: false });
  let st = startTyp(t);
  const f = st.fragor[0];
  let r = svara(st, "hej");
  assert.equal(r.utfall.kind, "ogiltig");
  assert.equal(r.st.fel, 0);
  const wrong = `${txt({ left: f.after.left, right: [] }).split("=")[0]}=${f.after.right[0].n + 1}`;
  r = svara(st, wrong);
  assert.equal(r.utfall.kind, "fel");
  assert.match(r.utfall.message, /^Vänster led stämmer\. Räkna höger led igen: .+ = \?$/);
  st = r.st;
  r = svara(st, txt(f.after));
  assert.equal(r.utfall.kind, "ratt");
  st = r.st;
  assert.equal(st.qi, 1);
  st = svara(st, txt(st.fragor[1].after)).st;
  assert.ok(typKlar(st));
  assert.equal(typStars(st), 2, "ett fel → ⭐⭐");
});

test("C välj: ett fel stryker alternativet, andra felet visar svaret (ett alternativ kvar)", () => {
  const t = valjTask(3, "c-valj");
  let st = startTyp(t);
  const f = st.fragor[0];
  const right = f.val.findIndex((e) => equationKey(e) === equationKey(f.after));
  const wrongs = [0, 1, 2].filter((i) => i !== right);
  let r = svara(st, wrongs[0]);
  assert.equal(r.utfall.kind, "fel");
  assert.equal(svara(r.st, wrongs[0]).utfall.kind, "ogiltig", "samma fel igen räknas inte");
  r = svara(r.st, wrongs[1]);
  assert.equal(r.utfall.kind, "visad");
  assert.equal(r.st.qi, 1);
  st = svara(r.st, rattSvar(r.st)).st;
  assert.ok(typKlar(st));
  assert.equal(typStars(st), 1, "ett visat delsvar → högst ⭐");
});

test("D: annan sann ekvation räknas inte som fel; tre fel visar svaret → ej löst", () => {
  const t = generateTask(3, { rng: seededRng("d-svar"), type: "D", form: "ax+b=c" });
  let st = startTyp(t);
  const sol = solve(fromJSON(t.equation));
  let r = svara(st, `x = ${sol.n}`);
  assert.equal(r.utfall.kind, "annan");
  assert.equal(r.st.fel, 0);
  for (let i = 0; i < TYPE_STARS.maxWrong - 1; i++) {
    r = svara(r.st, `${i + 7}x = 1`);
    assert.equal(r.utfall.kind, "fel");
  }
  r = svara(r.st, "9x = 2");
  assert.equal(r.utfall.kind, "visad");
  assert.ok(typKlar(r.st));
  const res = typResultat(t, r.st);
  assert.equal(res.stars, 0);
  assert.equal(res.solved, false);
  assert.equal(res.coins, 0, "inga mynt när svaret visades");
});

test("E: en följdrad räknas inte, en rätt rad är fel, felraden är rätt", () => {
  const t = ofType("E").find((x) => x.fel.rad > 0 && x.fel.rad < felRader(x.fel, fromJSON(x.equation), rulesFor(x.level)).length - 1);
  let st = startTyp(t);
  let r = svara(st, t.fel.rad + 1);
  assert.equal(r.utfall.kind, "senare");
  assert.equal(r.st.fel, 0);
  r = svara(r.st, 0);
  assert.equal(r.utfall.kind, "fel");
  r = svara(r.st, t.fel.rad);
  assert.equal(r.utfall.kind, "ratt");
  assert.equal(typResultat(t, r.st).stars, 2);
  assert.deepEqual(svarRader(r.st.svar), ["✗ rad 1", "✓ rad " + (t.fel.rad + 1)]);
});

test("F: hela kedjan – ekvation → lösning → vad x betyder → ⭐⭐⭐ och mynt", () => {
  const t = generateTask(3, { rng: seededRng("f-kedja"), type: "F", form: "ax+b=c" });
  let st = startTyp(t);
  assert.deepEqual(st.fragor.map((f) => f.kind), ["ekvation", "los", "betydelse"]);
  st = svara(st, t.text).st; // texten är ekvationen
  assert.equal(st.fragor[st.qi].kind, "los");
  let run = startRun(fromJSON(t.equation), { rules: rulesFor(3) });
  for (const m of t.optimalPath) run = playMove(run, m).run;
  assert.ok(run.solved);
  st = losningKlar(st);
  assert.equal(st.fragor[st.qi].kind, "betydelse");
  const wrong = [0, 1, 2].find((i) => i !== t.problem.ratt);
  const withErr = svara(st, wrong).st;
  st = svara(st, t.problem.ratt).st;
  assert.ok(typKlar(st));
  const res = typResultat(t, st, { run, help: { maxStep: 0 } });
  assert.equal(res.stars, 3);
  assert.equal(res.coins, 2);
  assert.equal(res.moves, t.optimalMoves);
  // ett fel i "Vad betyder x?" → ⭐⭐; omvägar i lösningen begränsar också
  assert.equal(typResultat(t, svara(withErr, t.problem.ratt).st, { run }).stars, 2);
  assert.equal(typResultat(t, st, { run, help: { maxStep: 4 } }).stars, 1, "hjälpsteg 4 gäller i lösningsdelen");
});

test("F: Visa lösningen i lösningsdelen = ej löst, inga mynt", () => {
  const t = generateTask(4, { rng: seededRng("f-visa"), type: "F" });
  let st = svara(startTyp(t), t.text).st;
  const run = revealSolution(startRun(fromJSON(t.equation), { rules: rulesFor(4) })).run;
  const res = typResultat(t, st, { run });
  assert.equal(res.stars, 0);
  assert.equal(res.revealed, true);
  assert.equal(res.coins, 0);
});

test("stjärnreglerna för C–F: 0 fel ⭐⭐⭐, 1 fel ⭐⭐, fler ⭐, visat delsvar ⭐, allt visat ej löst", () => {
  const base = { fragor: [{ kind: "rad" }, { kind: "rad" }], visade: 0 };
  assert.equal(typStars({ ...base, fel: 0 }), 3);
  assert.equal(typStars({ ...base, fel: 1 }), 2);
  assert.equal(typStars({ ...base, fel: 2 }), 1);
  assert.equal(typStars({ ...base, fel: 5 }), 1);
  assert.equal(typStars({ ...base, fel: 0, visade: 1 }), 1);
  assert.equal(typStars({ ...base, fel: 3, visade: 2 }), 0);
});

// --- data -------------------------------------------------------------------------

test("försöket sparar typ och svar; C sparar räknegången, drag räknas bara för A/B/F", () => {
  const t = generateTask(6, { rng: seededRng("c-data"), type: "C" });
  let st = startTyp(t);
  while (!typKlar(st)) st = svara(st, rattSvar(st)).st;
  const result = typResultat(t, st);
  const a = buildAttempt({ id: "a".repeat(12), task: t, run: null, help: null, result, completedAt: 9 });
  assert.equal(a.type, "C");
  assert.equal(a.moves.length, t.optimalMoves, "C: räknegången eleven fyllde i");
  assert.equal(a.moveCount, 0);
  assert.equal(a.answers.length, t.optimalMoves);
  assert.ok(a.answers.every((x) => x.ok && typeof x.a === "string"));
  const p = applyCompletion({ ...defaultProgress(), level: 6 }, a, { now: 1 }).progress;
  assert.equal(p.movesSolved, 0);
  assert.equal(p.optimalSolved, 0, "C–E påverkar inte lärarens drag jämfört med optimalt");
  assert.equal(p.solved, 1);
  assert.deepEqual(p.window, [3]);
  const row = forsokRader([a])[0];
  assert.equal(row.solvePhase, false);
  assert.equal(row.typeName, "Nästa rad");
  assert.ok(hasSolvePhase("F") && hasSolvePhase("A") && !hasSolvePhase("E"));
  // A/B: inga answers-fält (äldre regler tar fortfarande emot dem)
  const ab = generateTask(4, { rng: seededRng("ab-data"), type: "B" });
  let run = startRun(fromJSON(ab.equation), { rules: rulesFor(4) });
  for (const m of ab.optimalPath) run = playMove(run, m).run;
  const aAB = buildAttempt({ id: "b".repeat(12), task: ab, run, help: { log: [] }, result: typResultat({ ...ab, type: "F" }, { fragor: [], fel: 0, visade: 0, svar: [] }, { run }), completedAt: 9 });
  assert.ok(!("answers" in aAB));
});

test("frågorna per typ", () => {
  const kinds = (type) => fragor(generateTask(6, { rng: seededRng(`fr-${type}`), type }), rulesFor(6)).map((f) => f.kind);
  assert.ok(kinds("C").every((k) => k === "rad"));
  assert.deepEqual(kinds("D"), ["ekvation"]);
  assert.deepEqual(kinds("E"), ["steg"]);
  assert.deepEqual(kinds("F"), ["ekvation", "los", "betydelse"]);
});
