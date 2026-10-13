// ============================================================================
// Tester: Ekvationsresan – färdighetsmodellen, val av nästa uppgift och
// lärarens sammanfattningar (#626, spec E2.4, E2.5, E2.7 "Färdighetsmodellen
// påverkar valet av nästa uppgift", "Lärarvyns nya sammanfattningar stämmer
// med elevens faktiska resultat").
// ----------------------------------------------------------------------------
// Eleverna spelas med spelets egen logik (admin/qa-ekvationsresan-spela.mjs –
// samma som QA-seeden), så modellen räknas ur riktiga försök.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTask, seededRng } from "../src/ekvationsresan/generator.js";
import { levelConfig, rulesFor, FARDIGHET, SKILLS } from "../src/ekvationsresan/config.js";
import { extendTask } from "../src/ekvationsresan/uppgiftstyper.js";
import { applyCompletion, normalizeProgress, skyddadFranFonstret } from "../src/ekvationsresan/framsteg.js";
import { ekvationsslag, observera, uppdatera, modellUrForsok, las, fragePoang, ekvationer, indikatorer } from "../src/ekvationsresan/fardigheter.js";
import { fokusFor, blandning, nastaUppgift, formSlag } from "../src/ekvationsresan/nasta-uppgift.js";
import { sammanfattningar, slagLagen, fardighetsbild, FOR_LITE } from "../src/ekvationsresan/sammanfattning.js";
import { klassRader } from "../src/ekvationsresan/larare.js";
import { spela } from "../admin/qa-ekvationsresan-spela.mjs";

let klocka = 1_000;

/** Enstegsekvationer med +/− själv, med koefficient (ax, x/a) bara med 💡 – utan att nå nästa nivå. */
const KOEF = ["x+a=b", "ax=b", "x/a=b", "x-a=b", "ax=b", "x/a=b", "x+a=b", "ax=b", "x/a=b"].map((form) => ({
  type: "B", form, plan: form.startsWith("x") && !form.startsWith("x/") ? {} : { help: 2 },
}));

/**
 * Spela en elev: [{ level?, type?, form?, plan, antal }] i ordning från startnivån.
 * Uppgifterna genereras på elevens AKTUELLA nivå (som i spelet). → { progress, attempts }
 */
function elev(start, block, seed = "elev") {
  const rng = seededRng(seed);
  let p = normalizeProgress({ level: start, maxLevel: start });
  const attempts = [];
  for (const { type = null, form = null, plan = {}, antal = 1 } of block) {
    for (let i = 0; i < antal; i++) {
      const task = generateTask(p.level, { rng, type, form });
      const a = spela(task, plan, { id: `t${String(++klocka).padStart(8, "0")}`, at: klocka });
      attempts.push(a);
      p = applyCompletion(p, a, { now: klocka }).progress;
    }
  }
  return { progress: p, attempts };
}

const andel = (tasks, pred) => tasks.filter(pred).length / tasks.length;
function dragningar(progress, n = 400, seed = "drag") {
  const rng = seededRng(seed);
  const out = [];
  let prev = null;
  for (let i = 0; i < n; i++) out.push((prev = nastaUppgift(progress, { rng, previous: prev })));
  return out;
}

// --- modellen -------------------------------------------------------------------------

test("ekvationsslag ur den optimala vägen: ett steg, två steg, x i båda leden, +/−, ·/÷", () => {
  const slag = (level, form) => ekvationsslag(generateTask(level, { form, type: "A", rng: seededRng(form) })).sort();
  assert.deepEqual(slag(1, "x+a=b"), ["addSub", "ettSteg"]);
  assert.deepEqual(slag(2, "ax=b"), ["ettSteg", "multDiv"]);
  assert.deepEqual(slag(2, "x/a=b"), ["ettSteg", "multDiv"]);
  assert.deepEqual(slag(3, "ax+b=c"), ["addSub", "multDiv", "tvaSteg"]);
  assert.deepEqual(slag(7, "ax=cx+d"), ["bada", "multDiv"]);
  assert.deepEqual(slag(8, "ax+b=cx+d"), ["addSub", "bada", "multDiv"]);
});

test("observera: lösningsdelen ger ekvationsslag, operation, självständighet (A även balans)", () => {
  const t = generateTask(3, { rng: seededRng("obs-a"), type: "A", form: "ax+b=c" });
  const ok = spela(t).skills.obs;
  assert.deepEqual(Object.keys(ok).sort(), ["addSub", "balans", "multDiv", "operation", "sjalv", "tvaSteg"]);
  assert.ok(Object.values(ok).every((o) => o.s === 100 && o.h === 0));
  const b = generateTask(3, { rng: seededRng("obs-b"), type: "B", form: "ax+b=c" });
  const hjalp = spela(b, { help: 2 }).skills.obs;
  assert.deepEqual(hjalp.multDiv, { s: 60, h: 1 }, "💡 steg 2 → ⭐⭐ och hjälp");
  assert.equal(hjalp.operation.s, 100, "rätt operationer trots hjälp");
  assert.equal(hjalp.sjalv.s, 50);
  assert.ok(!("balans" in hjalp), "B (vågen diskret) säger inget om balans");
  const omvag = spela(b, { extra: 3 }).skills.obs;
  assert.equal(omvag.operation.s, 20, "många extra drag");
  assert.equal(omvag.tvaSteg.s, 100, "löst själv – omvägen mäts bara i operation");
  const visa = spela(b, { reveal: true }).skills.obs;
  assert.deepEqual(visa.tvaSteg, { s: 0, h: 1 });
  assert.deepEqual(visa.sjalv, { s: 0, h: 1 });
  assert.ok(!("operation" in visa), "Visa lösningen säger inget om dragen");
});

test("observera: C förenkling (+ skrivsätt när eleven skriver), D skrivsätt, E balans/förenkling, F text + problemlösning", () => {
  const c = generateTask(6, { rng: seededRng("obs-c"), type: "C" });
  assert.equal(c.nastaRad.mode, "skriv");
  const oc = spela(c, { fel: { rad: 1 } }).skills.obs;
  assert.equal(oc.forenkling.s, c.optimalMoves === 1 ? 60 : 20);
  assert.equal(oc.skrivsatt.s, oc.forenkling.s);
  // Välj-läget (nivå ≤ NEXT_ROW_CHOICE_MAX_LEVEL) nås inte av generatorn sedan C börjar på nivå 6 (#657) – byggs här direkt.
  const rngCv = seededRng("obs-cv");
  const cValj = spela(extendTask({ ...generateTask(2, { rng: rngCv, type: "A", form: "ax=b" }), type: "C" }, rulesFor(2), rngCv)).skills.obs;
  assert.ok(!("skrivsatt" in cValj), "välj-läget är inget skrivsätt");
  const od = spela(generateTask(3, { rng: seededRng("obs-d"), type: "D" }), { fel: { ekvation: "visa" } }).skills.obs;
  assert.deepEqual(od.skrivsatt, { s: 0, h: 1 });
  assert.deepEqual(od.sjalv, { s: 0, h: 1 });
  const rngE = seededRng("obs-e");
  let e;
  do e = generateTask(6, { rng: rngE, type: "E" }); while (e.fel.kind !== "enaSidan" || e.fel.rad === 0);
  assert.deepEqual(spela(e, { fel: { steg: 1 } }).skills.obs.balans, { s: 60, h: 0 });
  const f = generateTask(4, { rng: seededRng("obs-f"), type: "F" });
  const of = spela(f, { fel: { ekvation: 2 } }).skills.obs;
  assert.equal(of.text.s, 20);
  assert.equal(of.problem.s, 20, "hela kedjan fick ⭐");
  assert.equal(of.tvaSteg.s, 100, "lösningsdelen gick felfritt");
  // svar som inte räknas som fel
  assert.equal(fragePoang([{ k: "ekvation", ok: false, annan: true }, { k: "ekvation", ok: true }], ["ekvation"]).s, 100);
  assert.equal(fragePoang([], ["ekvation"]), null);
});

test("uppdatera: glidande medelvärde, de första väger 1/n, sedan minst 25 %; okända nycklar ignoreras", () => {
  let m = uppdatera({}, { text: { s: 100, h: 0 } });
  assert.deepEqual(m.text, { v: 100, h: 0, n: 1 });
  m = uppdatera(m, { text: { s: 0, h: 1 } });
  assert.deepEqual(m.text, { v: 50, h: 50, n: 2 });
  for (let i = 0; i < 10; i++) m = uppdatera(m, { text: { s: 0, h: 1 } });
  assert.ok(m.text.v <= 5 && m.text.h >= 95, "de senaste väger tyngst");
  m = uppdatera(m, { text: { s: 100, h: 0 } });
  assert.ok(m.text.v >= 25, "en ny observation flyttar minst 25 %");
  assert.ok(!("hacker" in uppdatera({}, { hacker: { s: 1, h: 0 } })));
  assert.deepEqual(las({}, "text"), { v: null, h: null, n: 0 });
});

test("progress.skills = modellen ombyggd ur försöken (samma data som lärarvyn sammanfattar)", () => {
  const { progress, attempts } = elev(3, [
    { type: "A", antal: 3 }, { type: "B", plan: { help: 2 }, antal: 3 }, { type: "F", plan: { fel: { ekvation: 1 } }, antal: 2 },
    { type: "C", antal: 2 }, { type: "E", plan: { fel: { steg: 1 } }, antal: 2 }, { type: "B", plan: { reveal: true }, antal: 1 },
  ]);
  assert.deepEqual(progress.skills, modellUrForsok([...attempts].reverse()), "ordningen sorteras på completedAt");
  assert.deepEqual(Object.keys(progress.skills).sort(), SKILLS.map((s) => s.key).filter((k) => k in progress.skills).sort());
  const json = JSON.parse(JSON.stringify(progress));
  assert.deepEqual(json.skills, progress.skills, "JSON-rent (Firestore)");
  assert.ok(Object.values(progress.skills).every((e) => Number.isInteger(e.v) && Number.isInteger(e.h) && Number.isInteger(e.n)));
  // äldre försök utan observation (Etapp 1) hoppas över
  assert.deepEqual(modellUrForsok([{ skills: null, completedAt: 1 }]), {});
});

// --- val av nästa uppgift (E2.4) -------------------------------------------------------

test("utan underlag: nivåns vanliga andelar (inget fokus), nivån är alltid elevens", () => {
  const p = normalizeProgress({ level: 5 });
  const b = blandning(5, p.skills);
  assert.deepEqual(b.mix.types, levelConfig(5).types);
  assert.equal(b.mix.typeB, levelConfig(5).typeB);
  assert.deepEqual(b.mix.forms, levelConfig(5).forms);
  assert.deepEqual(b.fokusTyper, {});
  assert.ok(dragningar(p, 60).every((t) => t.level === 5 && !t.fokus));
});

test("scenario 1: stark på ekvationer, svag på text → ekvation ⇒ fler problemlösningsuppgifter PÅ NIVÅN, ingen sänkning", () => {
  const { progress } = elev(5, [
    { type: "B", antal: 6 },
    { type: "F", plan: { fel: { ekvation: "visa" } }, antal: 3 },
  ], "text-svag");
  const f = fokusFor(progress.skills);
  assert.ok(f.text, "text-fokus");
  assert.ok(!f.bro);
  assert.ok(progress.level >= 5, "starka ekvationer + misslyckade F – aldrig lägre");
  const b = blandning(progress.level, progress.skills);
  assert.equal(b.mix.types.F, FARDIGHET.textAndel);
  assert.equal(b.fokusTyper.F, "text");
  const med = dragningar(progress);
  const utan = dragningar(normalizeProgress({ level: progress.level }));
  const fMed = andel(med, (t) => t.type === "F");
  const fUtan = andel(utan, (t) => t.type === "F");
  assert.ok(fMed > 0.3 && fMed > 2 * fUtan, `F ${fMed} mot ${fUtan}`);
  assert.ok(med.every((t) => t.level === progress.level), "samma nivå – inte lättare ekvationer");
  assert.ok(med.filter((t) => t.type === "F").every((t) => t.fokus === "text"));
  assert.ok(med.filter((t) => t.type !== "F").every((t) => !t.fokus));
});

test("scenario 1: misslyckade fokusuppgifter räknas inte i nivåfönstret – vanliga gör det", () => {
  const { progress } = elev(5, [{ type: "B", antal: 6 }, { type: "F", plan: { fel: { ekvation: "visa" } }, antal: 3 }], "text-svag");
  const L = progress.level;
  let p = { ...progress, window: [] };
  let q = { ...progress, window: [] };
  const rng = seededRng("fonster");
  for (let i = 0; i < 6; i++) {
    const t = nastaUppgift(progress, { rng });
    const fokusTask = { ...generateTask(L, { rng, type: "F" }), fokus: "text" };
    const a = spela(fokusTask, { reveal: true }, { at: ++klocka });
    assert.ok(skyddadFranFonstret(a));
    p = applyCompletion(p, a, { now: klocka }).progress;
    const vanlig = spela({ ...fokusTask, fokus: undefined }, { reveal: true }, { at: ++klocka });
    q = applyCompletion(q, vanlig, { now: klocka }).progress;
    assert.equal(t.level, L);
  }
  assert.equal(p.level, L, "fokusuppgifterna sänker inte");
  assert.deepEqual(p.window, []);
  assert.equal(p.tasks, progress.tasks + 6, "men räknas i statistiken");
  assert.equal(q.level, L - 1, "samma resultat utan fokus sänker som i Etapp 1");
  const bra = spela({ ...generateTask(L, { rng, type: "F" }), fokus: "text" }, {}, { at: ++klocka });
  assert.ok(!skyddadFranFonstret(bra), "en lyckad fokusuppgift räknas som vanligt");
});

test("scenario 2: förstår vågen men svårt med symboler ⇒ fler broar mellan bild och skrivsätt", () => {
  const { progress } = elev(6, [
    { type: "A", antal: 4 },
    { type: "D", plan: { fel: { ekvation: "visa" } }, antal: 2 },
    { type: "C", plan: { fel: { rad: 2 } }, antal: 2 },
  ], "bro");
  const f = fokusFor(progress.skills);
  assert.ok(f.bro, "bro-fokus");
  assert.ok(!f.text);
  const b = blandning(progress.level, progress.skills);
  assert.equal(b.mix.types.D, FARDIGHET.broD);
  assert.equal(b.mix.types.C, FARDIGHET.broC);
  assert.equal(b.mix.typeB, Math.min(levelConfig(progress.level).typeB, FARDIGHET.broTypeB));
  const med = dragningar(progress);
  const utan = dragningar(normalizeProgress({ level: progress.level }));
  const bro = (t) => t.type === "D" || t.type === "C";
  assert.ok(andel(med, bro) > andel(utan, bro) + 0.2, `broar ${andel(med, bro)} mot ${andel(utan, bro)}`);
  const aAvAB = (ts) => andel(ts.filter((t) => t.type === "A" || t.type === "B"), (t) => t.type === "A");
  assert.ok(aAvAB(med) > aAvAB(utan) + 0.1, `vågen i fokus oftare än Lös själv: ${aAvAB(med)} mot ${aAvAB(utan)}`);
  assert.ok(med.every((t) => t.level === progress.level));
  // nivå 1–5 saknar C (#657): broarna blir D + A, aldrig nästa rad
  const lag = blandning(4, progress.skills);
  assert.ok(!("C" in lag.mix.types) && !("E" in lag.mix.types));
  assert.equal(lag.mix.types.D, FARDIGHET.broD);
  assert.ok(dragningar({ ...progress, level: 4 }).every((t) => t.type !== "C" && t.type !== "E"));
  // nivå 9+ saknar D: broarna blir C + A
  const hog = blandning(10, progress.skills);
  assert.ok(!("D" in hog.mix.types));
  assert.equal(hog.mix.types.C, FARDIGHET.broC);
});

test("svagt ekvationsslag (x med koefficient kräver 💡) ⇒ nivåns former med koefficient väger dubbelt", () => {
  const { progress } = elev(6, KOEF, "koef");
  assert.equal(progress.level, 6, "⭐⭐ med hjälp – eleven stannar på nivån");
  assert.equal(fokusFor(progress.skills).svagast, "multDiv");
  const b = blandning(6, progress.skills);
  for (const [id, w] of Object.entries(levelConfig(6).forms)) {
    const koef = formSlag(6, id).includes("multDiv");
    assert.equal(b.mix.forms[id], koef ? 2 * w : w, id);
  }
  const med = dragningar(progress, 500);
  const utan = dragningar(normalizeProgress({ level: 6 }), 500);
  const koef = (t) => ekvationsslag(t).includes("multDiv");
  assert.ok(andel(med, koef) > andel(utan, koef) + 0.05, `${andel(med, koef)} mot ${andel(utan, koef)}`);
});

test("blandningen: C–F högst maxAndel, nivå 12 behåller sin stora F-andel", () => {
  const stark = { v: 90, h: 0, n: 10 };
  const svagt = { v: 10, h: 80, n: 5 };
  const skills = { ettSteg: stark, tvaSteg: stark, bada: stark, addSub: stark, multDiv: stark, text: svagt, balans: stark, skrivsatt: svagt };
  for (let level = 1; level <= 12; level++) {
    const { types } = blandning(level, skills).mix;
    const sum = Object.values(types).reduce((s, x) => s + x, 0);
    assert.ok(sum <= FARDIGHET.maxAndel + 1e-9, `nivå ${level}: ${sum}`);
  }
  assert.equal(blandning(12, skills).mix.types.F, levelConfig(12).types.F);
  assert.equal(blandning(2, skills).fokusTyper.D, "text", "nivå 1–2 saknar F: bild → ekvation");
});

// --- lärarens sammanfattningar (E2.5) ---------------------------------------------------

const meningar = (progress) => sammanfattningar(progress.skills).map((r) => r.text);

test("sammanfattning: 'Behärskar enstegsekvationer självständigt.'", () => {
  const { progress } = elev(1, [{ type: "B", antal: 4 }], "ett-steg");
  assert.ok(meningar(progress).includes("Behärskar enstegsekvationer självständigt."));
  assert.deepEqual(slagLagen(progress.skills).kan, ["enstegsekvationer", "ta bort ett tal (+ och −)"]);
});

test("sammanfattning: 'Behöver ofta hjälp när x har en koefficient.' (och inte för enkla tal)", () => {
  const { progress } = elev(6, KOEF, "koef");
  const m = meningar(progress);
  assert.ok(m.includes("Behöver ofta hjälp när x har en koefficient."), m.join(" | "));
  assert.ok(!m.some((t) => /få bort ett tal/.test(t)), "+/− klarar eleven själv");
  assert.ok(slagLagen(progress.skills).svart.includes("x med koefficient (· och ÷)"));
});

test("sammanfattning: 'Löser ekvationer bra men har svårt att skapa ekvation från text.'", () => {
  const { progress } = elev(5, [{ type: "B", antal: 6 }, { type: "F", plan: { fel: { ekvation: "visa" } }, antal: 3 }], "text-svag");
  assert.ok(meningar(progress).includes("Löser ekvationer bra men har svårt att skapa ekvation från text."));
  const bild = fardighetsbild(progress);
  assert.equal(bild.problem.text.n, 3);
  assert.ok(bild.problem.text.v < FARDIGHET.svag);
});

test("sammanfattning: 'Tar ofta många extra steg trots korrekta slutsvar.'", () => {
  const { progress } = elev(3, [{ type: "B", plan: { extra: 3 }, antal: 5 }], "omvag");
  assert.equal(progress.solved, 5, "alla lösta");
  const [rad] = klassRader([{ studentId: "x", progress }]);
  assert.ok(rad.fardighet.rader.some((r) => r.text === "Tar ofta många extra steg trots korrekta slutsvar."));
  assert.ok(rad.fardighet.rader.some((r) => r.text === "Behärskar tvåstegsekvationer självständigt."), "slutsvaren är korrekta");
  assert.ok(!rad.fardighet.rader.some((r) => /svårt med ekvationer i två steg|koefficient/.test(r.text)));
  const visar = elev(3, [{ type: "B", plan: { reveal: true }, antal: 5 }], "visar").progress;
  assert.ok(!meningar(visar).some((t) => /extra steg/.test(t)), "Visa lösningen är inga extra steg");
  assert.ok(rad.fardighet.korthet.some((r) => r.ton === "svart"), "syns i klassöversikten");
});

test("sammanfattning: 'Förstår vågen men har svårt att skriva ekvationen med symboler.'", () => {
  const { progress } = elev(6, [{ type: "A", antal: 4 }, { type: "D", plan: { fel: { ekvation: "visa" } }, antal: 2 }, { type: "C", plan: { fel: { rad: 2 } }, antal: 2 }], "bro");
  assert.ok(meningar(progress).includes("Förstår vågen men har svårt att skriva ekvationen med symboler."));
});

test("sammanfattning: för lite underlag, en helt ny elev och ingen falsk varning", () => {
  assert.deepEqual(meningar(normalizeProgress(null)), [FOR_LITE]);
  assert.deepEqual(meningar(elev(3, [{ type: "B", antal: 2 }], "lite").progress), [FOR_LITE]);
  const stabil = elev(3, [{ type: "B", antal: 5 }], "stabil").progress;
  assert.ok(sammanfattningar(stabil.skills).every((r) => r.ton !== "svart"));
  const [ny] = klassRader([{ studentId: "n", progress: null }]);
  assert.deepEqual(ny.fardighet.korthet.map((r) => r.text), [FOR_LITE]);
  assert.equal(ekvationer({}).n, 0);
  assert.ok(indikatorer({}).every((i) => i.lage === "ingen"));
});

test("observationen ändrar inte stjärnor, mynt eller Etapp 1-anpassningen för vanliga uppgifter", () => {
  const t = generateTask(3, { rng: seededRng("e1"), type: "B" });
  const a = spela(t, { help: 2 });
  assert.equal(a.stars, 2);
  assert.equal(a.coins, 2);
  const p = applyCompletion(normalizeProgress({ level: 3 }), a, { now: 1 }).progress;
  assert.deepEqual(p.window, [2]);
  assert.equal(observera(t, a).multDiv.s, 60);
});
