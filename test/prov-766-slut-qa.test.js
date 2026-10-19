// ============================================================================
// Prov 3E (#766): slut-QA Etapp 3 – fynd som rättades under QA:n.
//   F1: klassens snittpoäng per avsnitt avrundades fel av flyttalsbrus.
//       Webbläsaren visade "Del 3 – Skriv: 3,7 av 11" för (9 + 3,5 + 2,5 + 0) / 4
//       = 3,75 (15 / 44 × 11 = 3.7499999…) – ska vara 3,8 (som 8,25 → 8,3).
//       Samma brus i procenten (0,285 → "28 %" i stället för 29) och i CSV:n.
//   F2: resultatvyn på mobil (≤ 560 px): etiketten "½ Delvis rätt · 3,5 av 4 p"
//       klämde frågetexten till ~25 px och låg över den. Nu får texten minst
//       12em och etiketten radbryts under (verifierat i webbläsaren 320/390/540 px).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import { bedom, godkannAlla, nyRattning, sparDok } from "../src/prov/prov-rattning-logik.js";
import { avsnittText, klassOversikt, procent, procentTal, snittTal } from "../src/prov/prov-statistik.js";
import { resultatCsv } from "../src/prov/prov-statistik-fordjupad.js";

// Som provet i QA:n: Del 3 – Skriv = två fritextfrågor à 4 p och 7 p (11 p).
const PROV = validateProv({
  namn: "Vikingaprovet E3",
  fragor: [
    { id: "a3", typ: "avsnitt", titel: "Del 3 – Skriv" },
    { id: "f10", typ: "fritext", fraga: "Varför åkte vikingarna på resor?", poang: 4 },
    { id: "f11", typ: "fritext", fraga: "Berätta om en vikingaresa.", poang: 7 },
  ],
}).value;
const { fragor, facit } = delaUppProv(PROV);
const F = (id) => fragor.find((f) => f.id === id);

function elev(uid, poang) {
  let r = godkannAlla(nyRattning({ elevId: uid, classId: "4a", provNamn: "x", fragor, svar: { f10: "a", f11: "b" }, facit }), fragor);
  for (const [id, p] of Object.entries(poang)) r = bedom(r, F(id), { poang: p }, fragor);
  return sparDok(r, fragor);
}
// Alva 3,5 + 5,5 = 9 · Bilal 1,5 + 2 = 3,5 · Cleo 0 + 2,5 = 2,5 · Dante 0 + 0 = 0 → snitt 15 / 4 = 3,75.
const RATTNINGAR = {
  alva: elev("alva", { f10: 3.5, f11: 5.5 }),
  bilal: elev("bilal", { f10: 1.5, f11: 2 }),
  cleo: elev("cleo", { f10: 0, f11: 2.5 }),
  dante: elev("dante", { f10: 0, f11: 0 }),
};
const MED = Object.keys(RATTNINGAR);

describe("F1: snitt och procent utan flyttalsbrus (#766)", () => {
  it("klassens snitt per avsnitt 3,75 av 11 visas \"3,8 av 11\" (inte 3,7)", () => {
    const m = klassOversikt({ fragor, med: MED, svarAv: () => undefined, rattningar: RATTNINGAR, installningar: {} });
    assert.equal(15 / 44 * 11 < 3.75, true, "förutsättningen: andel × max ger 3.7499999…");
    assert.deepEqual(m.avsnitt.map((a) => avsnittText(a, true)), ["Del 3 – Skriv: 3,8 av 11"]);
  });

  it("snittTal avrundar halvor uppåt även när flyttalet hamnar strax under", () => {
    assert.equal(snittTal(15 / 44 * 11), "3,8");
    assert.equal(snittTal(11.5 / 10), "1,2", "1,15");
    assert.equal(snittTal(8.25), "8,3");
    assert.equal(snittTal(7.333), "7,3");
    assert.equal(snittTal(0), "0");
    for (let n = 1; n <= 30; n++) {
      for (let h = 0; h <= 2 * 20 * n; h++) {
        const exakt = h / 2 / n; // en klass med n elever, summan h halva poäng
        const tiondelar = Math.round((h * 10) / (2 * n) + 1e-9); // heltalsräkning
        assert.equal(snittTal(exakt), String(tiondelar / 10).replace(".", ","), `${h}/2/${n}`);
      }
    }
  });

  it("procent: 0,285 → 29 %, 0,7 → 70 %, gränsfallen i halvpoäng", () => {
    assert.equal(procent(0.285), "29 %");
    assert.equal(procent(57 / 200), "29 %");
    assert.equal(procent(0.7), "70 %");
    assert.equal(procent(null), "");
    for (let m = 1; m <= 120; m++) {
      for (let p = 0; p <= m; p++) {
        assert.equal(procentTal(p / m), Math.round((p * 100) / m + 1e-9), `${p}/${m}`);
      }
    }
  });

  it("CSV:n använder samma procent som Översikten", () => {
    const csv = resultatCsv({ fragor, med: MED, namn: { alva: "Alva", bilal: "Bilal", cleo: "Cleo", dante: "Dante" }, rattningar: RATTNINGAR, installningar: {} });
    const rad = (namn) => csv.split(/\r?\n/).find((r) => r.startsWith(namn)).split(";");
    const huvud = csv.split(/\r?\n/)[0].replace(/^﻿/, "").split(";");
    const i = huvud.indexOf("Procent");
    assert.equal(rad("Alva")[i], "82", "9 / 11 = 81,8 %");
    assert.equal(rad("Bilal")[i], "32", "3,5 / 11 = 31,8 %");
  });
});

describe("F2: resultatets etikett på mobil (#766)", () => {
  it("frågetexten har en minsta bredd i mobil-mediafrågan så att etiketten radbryts", () => {
    const css = readFileSync(new URL("../src/prov/prov-resultat.css", import.meta.url), "utf8");
    const mobil = css.slice(css.indexOf("@media (max-width: 560px)"));
    assert.match(mobil, /\.provv-res-fraga \.provv-fraga-huvud > \.provv-fragetext \{ flex: 1 1 12em;/);
  });
});
