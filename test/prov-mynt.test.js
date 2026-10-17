// ============================================================================
// Prov – Pluggmynt per prov (#746, spec §11): den rena logiken
// (src/prov/prov-mynt.js), valideringen i validateProv, att sparningen
// behåller myntUtbetalt och att resultatvyn får beloppet. Utbetalningen mot
// reglerna: test/firestore-rules-prov-mynt.test.js. Ren Node.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MYNT_TAK, harMynt, myntRegelText, myntText, provMyntBelopp, tolkaMynt, valideraMynt,
} from "../src/prov/prov-mynt.js";
import { STANDARD_INSTALLNINGAR, validateProv } from "../src/prov/prov-validera.js";
import { angratDok, aterlamnadDok, resultatModell, sparDok } from "../src/prov/prov-rattning-logik.js";
import { nyttProv, provFranDok } from "../src/prov/prov-redigera-ops.js";

const INL = { inlamnad: true };
const TILLBAKA = (totalPoang, over = {}) => ({ aterlamnad: true, totalPoang, ...over });
const ins = (mynt, poang = true) => ({ ...STANDARD_INSTALLNINGAR, poang, mynt });

test("standard: inga mynt – i nya prov, i gamla prov utan fältet och i tillfällen", () => {
  assert.deepEqual(STANDARD_INSTALLNINGAR.mynt, { typ: "inga" });
  assert.deepEqual(nyttProv().installningar.mynt, { typ: "inga" });
  assert.deepEqual(provFranDok({ namn: "x", installningar: { poang: true } }).installningar.mynt, { typ: "inga" });
  assert.equal(harMynt({ poang: true }), false, "tillfälle från före #746");
  assert.equal(provMyntBelopp({ poang: true }, TILLBAKA(10), INL), 0);
});

test("tolkaMynt: bara giltiga val, annars inga", () => {
  assert.deepEqual(tolkaMynt({ typ: "fast", antal: 20 }), { typ: "fast", antal: 20 });
  assert.deepEqual(tolkaMynt({ typ: "poang", antal: "2" }), { typ: "poang", antal: 2 });
  for (const raw of [null, {}, { typ: "fast" }, { typ: "fast", antal: 0 }, { typ: "fast", antal: 201 },
    { typ: "poang", antal: 21 }, { typ: "poang", antal: 1.5 }, { typ: "x", antal: 5 }]) {
    assert.deepEqual(tolkaMynt(raw), { typ: "inga" }, JSON.stringify(raw));
  }
});

test("valideraMynt / validateProv: felen säger vad som är fel", () => {
  assert.deepEqual(valideraMynt(undefined), { value: { typ: "inga" }, fel: [] });
  assert.deepEqual(valideraMynt({ typ: "fast", antal: 20 }), { value: { typ: "fast", antal: 20 }, fel: [] });
  assert.match(valideraMynt({ typ: "fast", antal: 0 }).fel[0], /fasta summan.*1–200/);
  assert.match(valideraMynt({ typ: "poang", antal: 50 }).fel[0], /per poäng.*1–20/);
  assert.match(valideraMynt({ typ: "poang", antal: 2 }, false).fel[0], /kräver att provet poängsätts/);
  assert.match(valideraMynt("20").fel[0], /"mynt" måste vara/);

  const fragor = [{ typ: "flerval", fraga: "Vad?", alternativ: ["a", "b"], ratt: 0, poang: 1 }];
  const ok = validateProv({ namn: "P", fragor, installningar: { mynt: { typ: "poang", antal: "3" } } });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value.installningar.mynt, { typ: "poang", antal: 3 });
  const fel = validateProv({ namn: "P", fragor, installningar: { poang: false, mynt: { typ: "poang", antal: 3 } } });
  assert.equal(fel.ok, false);
  assert.ok(fel.errors.some((e) => /kräver att provet poängsätts/.test(e)), fel.errors.join("\n"));
});

test("provMyntBelopp: fast summa, per poäng (nedåt), taket 200, bara tillbakalämnat och inlämnat", () => {
  assert.equal(provMyntBelopp(ins({ typ: "fast", antal: 20 }), TILLBAKA(0), INL), 20, "fast oavsett poäng");
  assert.equal(provMyntBelopp(ins({ typ: "poang", antal: 2 }), TILLBAKA(18), INL), 36);
  assert.equal(provMyntBelopp(ins({ typ: "poang", antal: 3 }), TILLBAKA(12.5), INL), 37, "avrundas nedåt");
  assert.equal(provMyntBelopp(ins({ typ: "poang", antal: 20 }), TILLBAKA(18), INL), MYNT_TAK);
  assert.equal(provMyntBelopp(ins({ typ: "fast", antal: 500 }), TILLBAKA(0), INL), 0, "ogiltig inställning = inga mynt");
  assert.equal(provMyntBelopp(ins({ typ: "poang", antal: 2 }, false), TILLBAKA(18), INL), 0, "utan poängsättning");
  assert.equal(provMyntBelopp(ins({ typ: "fast", antal: 20 }), { aterlamnad: false, totalPoang: 5 }, INL), 0, "inte tillbakalämnat");
  assert.equal(provMyntBelopp(ins({ typ: "fast", antal: 20 }), TILLBAKA(5), { inlamnad: false }), 0, "inte inlämnat");
  assert.equal(provMyntBelopp(ins({ typ: "fast", antal: 20 }), TILLBAKA(5), null), 0, "inget svar");
  assert.equal(provMyntBelopp(ins({ typ: "inga" }), TILLBAKA(18), INL), 0);
});

test("texterna: lärarens regel och elevens +36 mynt", () => {
  assert.equal(myntRegelText({ typ: "fast", antal: 20 }), "20 pluggmynt för inlämnat prov");
  assert.equal(myntRegelText({ typ: "poang", antal: 2 }), "2 pluggmynt per poäng (högst 200)");
  assert.equal(myntRegelText({ typ: "inga" }), "");
  assert.equal(myntText(36), "+36 mynt");
  assert.equal(myntText(0), "");
  assert.equal(myntText(undefined), "");
});

test("myntUtbetalt följer med sparningen, tillbakalämningen och ångra – och syns i resultatet", () => {
  const fragor = [{ id: "f1", typ: "flerval", fraga: "Vad?", alternativ: ["a", "b"], ratt: 0, poang: 2 }];
  const r = { elevId: "e", classId: "4a", fragor: { f1: { poang: 2, ratt: true, auto: false } }, aterlamnad: true, myntUtbetalt: 36 };
  assert.equal(sparDok(r, fragor).myntUtbetalt, 36);
  assert.equal(aterlamnadDok(sparDok(r, fragor), { visaFacit: false }).myntUtbetalt, 36);
  assert.equal(angratDok(r).myntUtbetalt, 36, "ångra drar inte tillbaka");
  assert.ok(!("myntUtbetalt" in sparDok({ ...r, myntUtbetalt: 0 }, fragor)), "0 sparas inte");
  const m = resultatModell({ fragor, installningar: { poang: true } }, { svar: { f1: 0 } }, r);
  assert.equal(m.mynt, 36);
  assert.equal(resultatModell({ fragor }, null, { ...r, myntUtbetalt: undefined }).mynt, 0);
  // Omprovet (#749 F2): namnet "(omprov)" och flaggan för "Totalt N mynt för provet".
  const om = resultatModell({ provNamn: "Vikingaprovet", fragor, elevIds: ["e"] }, null, r);
  assert.equal(om.namn, "Vikingaprovet (omprov)");
  assert.equal(om.omprov, true);
  assert.equal(m.omprov, false);
});
