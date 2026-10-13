// Issue #598 (epic #595 Tidsjakten): lärarens hantering av tidslinjehändelser –
// lägga till/redigera/ta bort händelser och ändra tidsspannet i underraden
// (teacher-area-items-ops.js), minitidslinjen + granskningen före sparande
// (teacher-timeline-mini.js) och antalet händelser i "Skapa fler"-prompten.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArea } from "../src/validate.js";
import { VASATIDEN_JSON } from "./fixtures/vasatiden-tidsjakt.js";
import {
  applyItemOp,
  itemCounts,
  lastItemWarning,
  normalizeItemFields,
  sectionsFor,
  setTimelineSpan,
  tabsFor,
  ITEM_TABS,
} from "../src/teacher-area-items-ops.js";
import { miniTimelineHtml, previewSpan, timelineReviewHtml } from "../src/teacher-timeline-mini.js";
import { buildMorePrompt } from "../src/prompts.js";

/** Det sparade Vasatiden-området (som läraren fick efter Spara i wizarden). */
function vasa() {
  const res = validateArea(JSON.parse(VASATIDEN_JSON));
  assert.ok(res.ok, res.errors.join("\n"));
  return { ...res.value, hiddenModes: ["memory"], grade: "ak5" };
}

const ny = {
  event: "Dackefejden",
  question: "Vilket år började Dackefejden?",
  year: "1542",
  description: "Bönder i Småland gjorde uppror mot kungen under ledning av Nils Dacke.",
  explanation: "Dackefejden började 1542.",
};

test("Tidsjakten-fliken visas när området har typen eller händelser, före lästexterna", () => {
  assert.deepEqual(ITEM_TABS, ["quiz", "pairs", "timeline", "amnes", "texts"]); // "amnes" = Ämnesläsning (#673)
  assert.deepEqual(sectionsFor(vasa()), ["quiz", "pairs", "timeline", "texts"]);
  assert.deepEqual(
    tabsFor(vasa()).find((t) => t.id === "timeline"),
    { id: "timeline", count: 5 }
  );
  // Typen vald men inga händelser ännu → fliken finns (läraren kan lägga till).
  assert.deepEqual(sectionsFor({ exerciseTypes: ["tidsjakt"] }), ["timeline"]);
  // Gamla områden utan Tidsjakten får ingen ny flik.
  assert.deepEqual(sectionsFor({ exerciseTypes: ["quiz"], quiz: [{}] }), ["quiz"]);
  assert.equal(itemCounts(vasa()).timeline, 5);
});

test("normalizeItemFields: årtal från formuläret blir heltal, ogiltigt skickas vidare till valideringen", () => {
  assert.equal(normalizeItemFields("timeline", ny).year, 1542);
  assert.equal(normalizeItemFields("timeline", { ...ny, year: "-500" }).year, -500);
  assert.equal(normalizeItemFields("timeline", { ...ny, year: "15x" }).year, "15x");
});

test("lägg till en händelse: nästa e-id, övriga fält orörda, validateArea grönt", () => {
  const before = vasa();
  const res = applyItemOp(before, { type: "add", kind: "timeline", fields: ny });
  assert.ok(res.ok, res.errors.join("\n"));
  const added = res.area.timeline.at(-1);
  assert.equal(added.id, "e6");
  assert.equal(added.year, 1542);
  assert.equal(res.area.timeline.length, 6);
  for (const k of ["quiz", "pairs", "texts", "hiddenModes", "grade", "timelineSpan", "exerciseTypes"]) {
    assert.deepEqual(res.area[k], before[k], `${k} ändrades`);
  }
});

test("redigera en händelse: id bevaras; avslöjat årtal och år utanför spannet nekas", () => {
  const a = vasa();
  const ref = { index: 0, id: "e1" };
  const ok = applyItemOp(a, { type: "update", kind: "timeline", ref, fields: { ...a.timeline[0], question: "När skedde blodbadet i Stockholm?" } });
  assert.ok(ok.ok, ok.errors.join("\n"));
  assert.equal(ok.area.timeline[0].id, "e1");
  assert.equal(ok.area.timeline[0].question, "När skedde blodbadet i Stockholm?");

  const reveal = applyItemOp(a, { type: "update", kind: "timeline", ref, fields: { ...a.timeline[0], description: "Det hände år 1520." } });
  assert.equal(reveal.ok, false);
  assert.match(reveal.errors.join(" "), /avslöjar årtalet 1520/);

  const outside = applyItemOp(a, { type: "update", kind: "timeline", ref, fields: { ...a.timeline[0], year: "1611" } });
  assert.equal(outside.ok, false);
  assert.match(outside.errors.join(" "), /utanför tidsspannet 1500–1580/);
});

test("ta bort en händelse + varning när den sista tas bort", () => {
  const a = vasa();
  const res = applyItemOp(a, { type: "remove", kind: "timeline", ref: { index: 4, id: "e5" } });
  assert.ok(res.ok);
  assert.deepEqual(res.area.timeline.map((e) => e.id), ["e1", "e2", "e3", "e4"]);
  assert.equal(lastItemWarning({ timeline: [a.timeline[0]] }, "timeline"), "Området har då inga tidslinjehändelser kvar – eleverna ser inte Tidsjakten.");
  assert.equal(lastItemWarning(a, "timeline"), null);
});

test("ändra tidsspannet: heltal, för smalt spann nekas, tomt = automatiskt (fältet tas bort)", () => {
  const a = vasa();
  const wider = applyItemOp(a, { type: "span", kind: "timeline", span: { from: "1450", to: "1600" } });
  assert.ok(wider.ok, wider.errors.join("\n"));
  assert.deepEqual(wider.area.timelineSpan, { from: 1450, to: 1600 });
  assert.deepEqual(wider.area.timeline, a.timeline);

  const narrow = applyItemOp(a, { type: "span", kind: "timeline", span: { from: 1520, to: 1530 } });
  assert.equal(narrow.ok, false);
  assert.match(narrow.errors.join(" "), /utanför tidsspannet/);

  const reversed = applyItemOp(a, { type: "span", kind: "timeline", span: { from: 1600, to: 1500 } });
  assert.equal(reversed.ok, false);

  const auto = applyItemOp(a, { type: "span", kind: "timeline", span: null });
  assert.ok(auto.ok);
  assert.equal("timelineSpan" in auto.area, false);
  assert.equal("timelineSpan" in setTimelineSpan(a, { from: "", to: " " }), false);
});

test("previewSpan: lärarens spann vinner, annars händelsernas spann med marginal (aldrig ett enda svar i mitten)", () => {
  const a = vasa();
  assert.deepEqual(previewSpan(a.timeline, a.timelineSpan), { from: 1500, to: 1580, auto: false });
  assert.deepEqual(previewSpan(a.timeline, null), { from: 1514, to: 1566, auto: true });
  // Ogiltigt/halvifyllt spann i redigeraren → faller tillbaka på automatiskt.
  assert.equal(previewSpan(a.timeline, { from: "1500", to: "" }).auto, true);
  // En enda händelse → minst 40 år brett.
  const one = previewSpan([{ year: 1520 }], null);
  assert.equal(one.to - one.from, 40);
  assert.equal(previewSpan([], null), null);
});

test("miniTimelineHtml: en prick per händelse, utanför spannet markeras, f.Kr. skrivs ut", () => {
  const a = vasa();
  const html = miniTimelineHtml(a.timeline, a.timelineSpan);
  assert.equal((html.match(/class="tl-mini-dot"/g) || []).length, 5);
  assert.match(html, /1500–1580/);
  const out = miniTimelineHtml(a.timeline, { from: 1500, to: 1530 });
  assert.equal((out.match(/tl-mini-dot out/g) || []).length, 2);
  assert.match(miniTimelineHtml([{ event: "Rom grundas", year: -753 }], null), /f\.Kr\./);
  assert.equal(miniTimelineHtml([], null), "");
});

test("timelineReviewHtml: läraren ser årtal, fråga, före/efter-texter i årtalsordning och escapat", () => {
  const a = vasa();
  const shuffled = [a.timeline[3], a.timeline[0], { ...a.timeline[1], event: "<b>Kung</b>" }];
  const html = timelineReviewHtml(shuffled, a.timelineSpan);
  assert.match(html, /Tidsjakten <span class="badge">3<\/span>/);
  const order = [...html.matchAll(/tl-rv-year">(\d+)/g)].map((m) => m[1]);
  assert.deepEqual(order, ["1520", "1523", "1541"]);
  assert.match(html, /&lt;b&gt;Kung&lt;\/b&gt;/);
  assert.match(html, /Före svaret/);
  assert.match(html, /Efter svaret/);
  assert.equal(timelineReviewHtml([], null), "");
});

test("Skapa fler: lärarens antal nya händelser och spannet går in i prompten", () => {
  const a = vasa();
  const p = buildMorePrompt(a, "", undefined, { timelineCount: 10 });
  assert.match(p, /Skapa EXAKT 10 händelser/);
  assert.match(p, /Tidslinjen går från 1500 till 1580/);
  assert.match(p, /Stockholms blodbad/, "befintliga händelser skickas med så de inte upprepas");
  assert.doesNotMatch(buildMorePrompt(a, ""), /EXAKT \d+ händelser/);
});
