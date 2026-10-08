// ============================================================================
// #528: fler pokaler – Mattematchen silver/brons, Läsresan-milstolpar,
// lärarens pokal, Läsresan-räknaren i EXP-skrivningen och lärarsidans
// rena HTML-delar. Körs med: node --test test/kc-pokal-528.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  pokalerUrKalla, planPokal, planLararPokal, normaliseraPokal, pokalTooltip, lasresanMilstolpar,
  LASRESAN_MILSTOLPAR, LARAR_MOTIV, MM_PLATS_MIN_KLASSER, verifieraPokal,
} from "../src/klasscenter/kc-pokal-typer.js";
import { buildResult } from "../src/tavling/mm-teacher-core.js";
import { planKlassExpWrites, sumLasresan } from "../src/klasscenter/kc-exp-skriv.js";
import { KC_POKALER } from "../src/art-klasscenter-pokaler.js";
import { lasresanRad, pokalListaHtml, formularHtml } from "../src/klasscenter/kc-larare-pokal.js";
import { kcShopItem } from "../src/klasscenter/kc-shop-items.js";
import { kortHtml } from "../src/klasscenter/kc-shop-kort.js";

const fv = { serverTimestamp: () => "TS", increment: (n) => ({ inc: n }) };

// Fyra klasser: 6a bäst, 6b tvåa, 6c trea, 6d sist (score = rätt/elev).
function mm4(extra = {}) {
  const ids = ["6a", "6b", "6c", "6d"];
  const counters = [
    { classId: "6a", correct: 40 }, { classId: "6b", correct: 30 }, { classId: "6c", correct: 20 }, { classId: "6d", correct: 10 },
  ];
  const classes = ids.map((id) => ({ id, name: id.toUpperCase(), studentIds: ["x", "y"] }));
  const result = buildResult({ scores: [], stats: [], counters, classes, participatingIds: ids, now: 1 });
  return { name: "MM okt", status: "finished", participatingClassIds: ids, result, ...extra };
}

describe("Mattematchen guld/silver/brons", () => {
  it("buildResult ger silverClasses/bronzeClasses ur placeringen", () => {
    const k = mm4();
    assert.deepEqual(k.result.winnerClasses, ["6a"]);
    assert.deepEqual(k.result.silverClasses, ["6b"]);
    assert.deepEqual(k.result.bronzeClasses, ["6c"]);
  });

  it("4 klasser → guld till 1:an, silver till 2:an, brons till 3:an, inget till 4:an", () => {
    const k = { name: "MM okt", status: "finished", participatingClassIds: ["6a", "6b", "6c", "6d"],
      result: { winnerClass: "6a", winnerClasses: ["6a"], silverClasses: ["6b"], bronzeClasses: ["6c"] } };
    const per = Object.fromEntries(pokalerUrKalla("mattematchen", "mm1", k).map((p) => [p.typ, p.classId]));
    assert.deepEqual(per, { "mm-klasskamp": "6a", "mm-silver": "6b", "mm-brons": "6c" });
    assert.equal(verifieraPokal("mm-silver", k, "6d"), false);
  });

  it(`färre än ${MM_PLATS_MIN_KLASSER} deltagande klasser → ingen silver/brons`, () => {
    const k = { status: "finished", participatingClassIds: ["6a", "6b"],
      result: { winnerClass: "6a", winnerClasses: ["6a"], silverClasses: ["6b"], bronzeClasses: [] } };
    assert.deepEqual(pokalerUrKalla("mattematchen", "mm1", k).map((p) => p.typ), ["mm-klasskamp"]);
  });

  it("pågående tävling eller klass utanför tävlingen → inget", () => {
    const k = { status: "active", participatingClassIds: ["6a", "6b", "6c"], result: { silverClasses: ["6b"] } };
    assert.equal(verifieraPokal("mm-silver", k, "6b"), false);
    const k2 = { ...k, status: "finished", result: { silverClasses: ["6x"] } };
    assert.deepEqual(pokalerUrKalla("mattematchen", "mm1", k2), []);
  });
});

describe("Läsresan-milstolpar", () => {
  it("trösklar och nådda milstolpar", () => {
    assert.deepEqual([...LASRESAN_MILSTOLPAR], [100, 250, 500, 1000]);
    assert.deepEqual(lasresanMilstolpar(99), []);
    assert.deepEqual(lasresanMilstolpar(100), [100]);
    assert.deepEqual(lasresanMilstolpar(612), [100, 250, 500]);
  });

  it("pokalen: id = milstolpen (en gång per klass), titel och konst per nivå", () => {
    const p = planPokal({ typ: "lasresan-milstolpe", kallaId: "250", uid: "l1", fv });
    assert.equal(p.ok, true);
    assert.equal(p.id, "lasresan-milstolpe-250");
    assert.equal(p.data.titel, "Läsresan: 250 texter");
    const n = normaliseraPokal(p.id, { ...p.data, wonAt: 5 });
    assert.equal(n.art, "pokal-lasresan-250");
    assert.ok(KC_POKALER[n.art]);
    assert.ok(normaliseraPokal("x", { typ: "lasresan-milstolpe", kallaId: "1000" }).varde >
      normaliseraPokal("y", { typ: "lasresan-milstolpe", kallaId: "100" }).varde);
  });

  it("EXP-skrivningen från Läsresan räknar +1 i shardens lasresan, andra källor inte", () => {
    const [shard] = planKlassExpWrites({ classId: "6a", uid: "e1", antal: 1, kalla: "lasresan", shard: 2, fv });
    assert.deepEqual(shard.data.lasresan, { inc: 1 });
    const [quiz] = planKlassExpWrites({ classId: "6a", uid: "e1", antal: 1, kalla: "quiz", shard: 2, fv });
    assert.equal("lasresan" in quiz.data, false);
    assert.equal(sumLasresan([{ lasresan: 60 }, { exp: 3 }, { lasresan: 41 }, { lasresan: "x" }]), 101);
  });

  it("lärarsidans rad: antal + nästa milstolpe", () => {
    assert.equal(lasresanRad(230).nasta, 250);
    assert.match(lasresanRad(230).text, /20 kvar/);
    assert.equal(lasresanRad(1200).nasta, null);
  });
});

describe("Lärarens pokal", () => {
  it("plan: motiv + titel + text, id larare-<slump>", () => {
    const p = planLararPokal({ motiv: "hjarta", titel: " Bästa samarbetet i oktober! ", text: "Ni hjälpte varandra.", uid: "l1", fv });
    assert.equal(p.ok, true);
    assert.match(p.id, /^larare-[a-z0-9]+$/);
    assert.deepEqual({ ...p.data, kallaId: "-" }, {
      typ: "larare", kallaId: "-", titel: "Bästa samarbetet i oktober!", motiv: "hjarta",
      detalj: "Ni hjälpte varandra.", wonAt: "TS", awardedBy: "l1",
    });
  });

  it("nej utan motiv/titel/lärare", () => {
    assert.equal(planLararPokal({ motiv: "drake", titel: "x", uid: "l", fv }).kod, "okant-motiv");
    assert.equal(planLararPokal({ motiv: "guld", titel: "  ", uid: "l", fv }).kod, "saknar-titel");
    assert.equal(planLararPokal({ motiv: "guld", titel: "x", fv }).kod, "saknar-uid");
  });

  it("tooltip visar lärarens egen text; konsten följer motivet", () => {
    const n = normaliseraPokal("larare-abc", { typ: "larare", kallaId: "abc", titel: "Bäst i oktober", detalj: "Vilket lag!", motiv: "medalj", wonAt: 1 });
    assert.equal(n.art, "pokal-larare-medalj");
    const tt = pokalTooltip(n);
    assert.equal(tt.rubrik, "Bäst i oktober");
    assert.equal(tt.text, "Vilket lag!");
    assert.equal(tt.detalj, "");
    for (const m of LARAR_MOTIV) assert.ok(KC_POKALER[m.art], m.art);
  });

  it("lärarsidans lista: egen text syns, Ta bort bara på lärarens pokaler", () => {
    const html = pokalListaHtml([
      normaliseraPokal("larare-a", { typ: "larare", kallaId: "a", titel: "Bäst <3", detalj: "Text", motiv: "guld" }),
      normaliseraPokal("mm-klasskamp-m", { typ: "mm-klasskamp", kallaId: "m", titel: "Mattematchens mästare" }),
    ]);
    assert.match(html, /Bäst &lt;3/);
    assert.equal((html.match(/data-kc-ta-bort/g) || []).length, 1);
    assert.match(formularHtml(), /maxlength="80"/);
  });
});

describe("Troféhyllan i shoppen", () => {
  it("shopkortet förklarar vad den gör", () => {
    const it = kcShopItem("trofehylla");
    assert.match(it.beskrivning, /6 finaste pokaler/);
    assert.match(kortHtml(it, null), /kcs-beskrivning/);
    assert.doesNotMatch(kortHtml(kcShopItem("lounge"), null), /kcs-beskrivning/);
  });
});
