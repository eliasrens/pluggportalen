// ============================================================================
// Guiden "Lär dig schack" – stjärnjakten (#790, lektion 2–8): den egna
// draggenereringen (utan kungar) jämförd med chess.js på varje ruta, minsta
// antal drag (BFS, kontrollerat med en oberoende djupsökning) och kontrollen
// som brädet ritar (lösningen spelad med tryck, nekade drag, Börja om, "fast").
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "../src/schack/vendor/chess.js";
import { jaktDrag, minstaDrag, malFor, skapaJaktKontroll } from "../src/schack/schack-stjarnjakt.js";
import { LEKTIONER, lektionFor } from "../src/schack/schack-lektioner.js";
import { spela } from "./helpers/schack-guide-hjalp.js";

const FILER = "abcdefgh";
const ALLA = [...FILER].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => f + r));
const JAKTER = LEKTIONER.filter((l) => l.typ === "jakt").flatMap((l) => l.uppgifter.map((u, i) => ({ l, u, namn: `lektion ${l.nr}.${i + 1}` })));
const avstand = (a, b) => Math.max(Math.abs(FILER.indexOf(a[0]) - FILER.indexOf(b[0])), Math.abs(a[1] - b[1]));

/**
 * chess.js som facit: pjäsen + hindren + kungarna på rutor där de varken står i vägen
 * (utanför pjäsens mål) eller ger schack. Är pjäsen själv kungen får den svarta kungen
 * inte stå bredvid någon av målrutorna. → målrutorna enligt chess.js, eller null.
 */
function chessMal(typ, fran, hinder, mal) {
  const upptagna = new Set([fran, ...hinder.keys(), ...mal]);
  const fria = ALLA.filter((r) => !upptagna.has(r));
  for (const wk of typ === "k" ? [fran] : fria) {
    for (const bk of fria) {
      if (bk === wk || avstand(bk, wk) < 2) continue;
      if (typ === "k" && mal.some((t) => avstand(bk, t) < 2)) continue;
      const c = new Chess();
      c.clear();
      c.put({ type: typ, color: "w" }, fran);
      for (const [r, h] of hinder) c.put({ type: "p", color: h === "egen" ? "w" : "b" }, r);
      if (typ !== "k") c.put({ type: "k", color: "w" }, wk);
      c.put({ type: "k", color: "b" }, bk);
      if (c.isAttacked(bk, "w") || c.isAttacked(wk, "b")) continue;
      return new Set(c.moves({ square: fran, verbose: true }).map((m) => m.to));
    }
  }
  return null;
}

describe("stjärnjaktens draggenerering (utan kungar) mot chess.js", () => {
  it("varje pjäs på varje ruta på ett tomt bräde", () => {
    let n = 0;
    for (const typ of ["r", "b", "q", "k", "n", "p"]) {
      for (const fran of ALLA) {
        if (typ === "p" && (fran[1] === "1" || fran[1] === "8")) continue;
        const mitt = jaktDrag(typ, fran).map((d) => d.to);
        assert.equal(new Set(mitt).size, mitt.length, `${typ}${fran}: inga dubbletter`);
        const facit = chessMal(typ, fran, new Map(), mitt);
        assert.ok(facit, `${typ}${fran}: kungarna fick plats`);
        assert.deepEqual(new Set(mitt), facit, `${typ}${fran}`);
        n++;
      }
    }
    assert.equal(n, 5 * 64 + 48);
  });
  it("med egna bönder i vägen och svarta pjäser att ta – i varje läge längs lösningen av varje uppgift", () => {
    for (const { u, namn } of JAKTER) {
      const { vag } = minstaDrag(u);
      let pos = u.fran;
      const kvar = new Set(malFor(u));
      for (const steg of [null, ...vag]) {
        if (steg) { pos = steg; kvar.delete(steg); }
        const hinder = new Map([...(u.egna || []).map((r) => [r, "egen"]), ...(u.fiender || []).filter((f) => kvar.has(f.ruta)).map((f) => [f.ruta, "fiende"])]);
        const mitt = jaktDrag(u.pjas, pos, hinder);
        const facit = chessMal(u.pjas, pos, hinder, mitt.map((d) => d.to));
        if (!facit) continue; // för trångt för två kungar – täcks av tomt-bräde-testet
        assert.deepEqual(new Set(mitt.map((d) => d.to)), facit, `${namn} från ${pos}`);
        for (const d of mitt) assert.equal(d.tar, hinder.get(d.to) === "fiende", `${namn}: ${d.to} tar`);
      }
    }
  });
  it("bonden: två steg bara från rad 2 och bara över en tom ruta; tar bara snett; aldrig bakåt", () => {
    assert.deepEqual(jaktDrag("p", "e2").map((d) => d.to), ["e3", "e4"]);
    assert.deepEqual(jaktDrag("p", "e3").map((d) => d.to), ["e4"]);
    assert.deepEqual(jaktDrag("p", "e2", new Map([["e3", "fiende"]])).map((d) => d.to), []);
    assert.deepEqual(jaktDrag("p", "e2", new Map([["e4", "fiende"]])).map((d) => d.to), ["e3"]);
    assert.deepEqual(jaktDrag("p", "e2", new Map([["d3", "fiende"], ["f3", "egen"]])), [{ to: "e3", tar: false }, { to: "e4", tar: false }, { to: "d3", tar: true }]);
    assert.deepEqual(jaktDrag("p", "e8"), []);
  });
});

/** Oberoende kontroll av BFS: djupsökning med minne – finns en lösning på högst `djup` drag? */
function finnsLosning(u, djup) {
  const mal = malFor(u);
  const fiendeVid = new Set((u.fiender || []).map((f) => f.ruta));
  const sett = new Map();
  const dfs = (pos, kvar, kvarDjup) => {
    if (!kvar.size) return true;
    if (kvarDjup === 0) return false;
    const k = `${pos}|${[...kvar].sort()}`;
    if ((sett.get(k) ?? -1) >= kvarDjup) return false;
    sett.set(k, kvarDjup);
    const hinder = new Map([...(u.egna || []).map((r) => [r, "egen"]), ...[...kvar].filter((r) => fiendeVid.has(r)).map((r) => [r, "fiende"])]);
    return jaktDrag(u.pjas, pos, hinder).some((d) => {
      const ny = new Set(kvar);
      ny.delete(d.to);
      return dfs(d.to, ny, kvarDjup - 1);
    });
  };
  return dfs(u.fran, new Set(mal), djup);
}

describe("minsta antal drag (BFS) och stjärnjakten", () => {
  it("varje uppgifts `min` är BFS-svaret, och ingen lösning finns på ett drag mindre", () => {
    for (const { u, namn } of JAKTER) {
      const { drag, vag } = minstaDrag(u);
      assert.equal(drag, u.min, namn);
      assert.equal(vag.length, u.min, namn);
      assert.ok(finnsLosning(u, u.min), `${namn}: lösning på ${u.min}`);
      assert.ok(!finnsLosning(u, u.min - 1), `${namn}: ingen lösning på ${u.min - 1}`);
    }
  });
  it("BFS-lösningen spelad genom kontrollen tar alla stjärnor och pjäser på exakt `min` drag", () => {
    for (const { u, namn } of JAKTER) {
      let klarState = null;
      const k = skapaJaktKontroll(u, { onKlar: (s) => { klarState = s; } });
      assert.equal(k.getState().stjarnor.length, u.stjarnor.length);
      spela(k, minstaDrag(u).vag);
      assert.ok(klarState, `${namn}: klar`);
      assert.deepEqual(klarState.jakt, { antal: u.min, kvar: 0, klar: true, fast: false }, namn);
      assert.equal(k.getState().pjaser.filter((p) => p.color === "b").length, 0, `${namn}: alla svarta tagna`);
      assert.equal(k.tryck(k.getState().pjaser[0].ruta).typ, "ingen", "klar = låst");
    }
  });
  it("olagligt drag nekas, markeringen står kvar vid släpp; Börja om nollar dragen", () => {
    const u = lektionFor(2).uppgifter[1];
    const k = skapaJaktKontroll(u);
    assert.equal(k.slapp("c2", "c6").typ, "nekad", "över den egna bonden");
    assert.equal(k.getState().vald, "c2");
    assert.equal(k.tryck("c3").typ, "drag");
    assert.equal(k.getState().jakt.antal, 1);
    assert.equal(k.tryck("d5").typ, "ingen", "en egen bonde går inte att välja");
    k.borjaOm();
    assert.equal(k.getState().jakt.antal, 0);
    assert.equal(k.getState().pjaser[0].ruta, "c2");
  });
  it("fast: bonden som gått förbi en stjärna kan inte klara uppgiften – statusen säger Börja om", () => {
    const k = skapaJaktKontroll(lektionFor(7).uppgifter[0]);
    k.tryck("e2");
    k.tryck("e3");
    k.tryck("e3");
    k.tryck("e4");
    k.tryck("e4");
    k.tryck("e5");
    assert.equal(k.getState().jakt.fast, false);
    const k2 = skapaJaktKontroll({ pjas: "p", fran: "e2", stjarnor: ["e3", "e6"], min: 4 });
    k2.tryck("e2");
    k2.tryck("e4");
    assert.equal(k2.getState().jakt.fast, true);
    assert.match(k2.getState().status.text, /Börja om/);
  });
});
