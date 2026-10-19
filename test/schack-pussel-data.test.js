// ============================================================================
// Pusselbanken (#791, spec §13–§14, docs/SCHACK.md §16): datan i
// src/schack/pussel/ och kontrollen i admin/schack-pussel.mjs.
// ----------------------------------------------------------------------------
//   antal (~200 + ~200), sortering lätt → svårt, vit vid draget, källa/licens –
//   och varje lösning kontrollerad med chess.js av en EGEN implementation här
//   (inte skriptets): matt i ett är matt, matt i två håller hela linjen och har
//   bara ett första drag som tvingar fram matt.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "../src/schack/vendor/chess.js";
import { SORTER, uciDrag } from "../src/schack/schack-pussel.js";
import { kontrollera, normalisera } from "../admin/schack-pussel.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRCDIR = join(ROOT, "src");
const las = (f) => readFileSync(join(ROOT, f), "utf8");
const bank = (sort) => JSON.parse(las(`src/schack/pussel/${SORTER[sort].fil}`));

// --- En egen, enkel kontroll (oberoende av admin/schack-pussel.mjs) ------------

const drag = (c, s) => {
  try { return c.move(uciDrag(s)); } catch { return null; }
};
function mattIEtt(fen) {
  const c = new Chess(fen);
  return c.moves({ verbose: true }).filter((m) => {
    const k = new Chess(fen);
    k.move(m);
    return k.isCheckmate();
  });
}
/** Alla vita drag efter vilka VARJE svart svar kan mötas med matt. */
function forstaDragMattITva(fen) {
  return new Chess(fen).moves({ verbose: true }).filter((m) => {
    const k = new Chess(fen);
    k.move(m);
    if (k.isGameOver()) return false;
    return k.moves({ verbose: true }).every((svar) => {
      const k2 = new Chess(k.fen());
      k2.move(svar);
      return mattIEtt(k2.fen()).length > 0;
    });
  }).map((m) => m.from + m.to + (m.promotion || ""));
}

describe("pusselbanken (§13: ~200 + ~200, lätt → svårt, chess.js)", () => {
  for (const sort of ["ett", "tva"]) {
    const d = bank(sort);
    it(`${SORTER[sort].fil}: källan, licensen, ~200 pussel, unika, lätt → svårt, vit vid draget`, () => {
      assert.equal(d.sort, sort);
      assert.equal(d.tema, sort === "ett" ? "mateIn1" : "mateIn2");
      assert.equal(d.licens, "CC0-1.0");
      assert.match(d.kalla, /^https:\/\/database\.lichess\.org\/lichess_db_puzzle\.csv\.zst$/);
      assert.equal(d.antal, d.pussel.length);
      assert.ok(d.pussel.length >= 180 && d.pussel.length <= 220, `antal ${d.pussel.length}`);
      assert.equal(new Set(d.pussel.map((p) => p.id)).size, d.pussel.length, "unika id");
      assert.equal(new Set(d.pussel.map((p) => p.fen)).size, d.pussel.length, "unika ställningar");
      for (let i = 1; i < d.pussel.length; i++) assert.ok(d.pussel[i].rating >= d.pussel[i - 1].rating, `sorterat vid ${i}`);
      assert.ok(d.pussel[0].rating < 500, "börjar lätt");
      assert.ok(d.pussel.at(-1).rating <= d.filter.maxRating && d.filter.maxRating <= 1200, "låg svårighet hela vägen");
      assert.ok(d.pussel.at(-1).rating - d.pussel[0].rating >= 300, "en riktig stegring, inte platt");
      for (const p of d.pussel) {
        assert.deepEqual(Object.keys(p).sort(), ["fen", "id", "losning", "rating", "senast"]);
        assert.match(p.id, /^[A-Za-z0-9]{5,}$/);
        const c = new Chess(p.fen);
        assert.equal(c.turn(), "w", `${p.id} vit vid draget`);
        assert.match(p.senast, /^[a-h][1-8][a-h][1-8][qrbn]?$/);
        const pjas = c.get(p.senast.slice(2, 4));
        assert.equal(pjas?.color, "b", `${p.id}: motståndarens senaste drag landade på ${p.senast.slice(2, 4)}`);
      }
    });
  }

  it("matt i ett: lösningsdraget är lagligt och ger matt (varje pussel)", () => {
    for (const p of bank("ett").pussel) {
      assert.equal(p.losning.length, 1, p.id);
      const c = new Chess(p.fen);
      assert.ok(drag(c, p.losning[0]), `${p.id}: lagligt`);
      assert.ok(c.isCheckmate(), `${p.id}: matt`);
    }
  });

  it("matt i två: ingen matt i ett, hela linjen laglig, matt efter andra draget, ETT första drag tvingar fram matt", () => {
    for (const p of bank("tva").pussel) {
      assert.equal(p.losning.length, 3, p.id);
      assert.equal(mattIEtt(p.fen).length, 0, `${p.id}: ingen matt i ett`);
      const c = new Chess(p.fen);
      assert.ok(drag(c, p.losning[0]), `${p.id}: första`);
      assert.ok(!c.isGameOver(), `${p.id}: inte slut efter första`);
      assert.ok(drag(c, p.losning[1]), `${p.id}: försvaret`);
      assert.ok(drag(c, p.losning[2]), `${p.id}: andra`);
      assert.ok(c.isCheckmate(), `${p.id}: matt`);
      assert.deepEqual(forstaDragMattITva(p.fen), [p.losning[0]], `${p.id}: bara lösningens första drag`);
    }
  });

  it("README och CC0-licensen ligger bredvid, ingen rådata incheckad", () => {
    const filer = readdirSync(join(SRCDIR, "schack/pussel")).sort();
    assert.deepEqual(filer, ["LICENSE", "README.md", "matt-i-ett.json", "matt-i-tva.json"]);
    assert.match(las("src/schack/pussel/LICENSE"), /CC0 1\.0 Universal/);
    const readme = las("src/schack/pussel/README.md");
    for (const t of ["database.lichess.org", "CC0", "mateIn1", "mateIn2", "RatingDeviation", "Popularity", "NbPlays", "2026-10-19", "200"]) {
      assert.ok(readme.includes(t), t);
    }
  });
});

describe("skriptets kontroll (admin/schack-pussel.mjs)", () => {
  it("normaliserar: motståndarens första drag görs, svart vid draget sorteras bort", () => {
    // Lichess-raden 0000H (mateIn1): svart drar d1h5? nej – FEN:en har vit vid draget, d1h5 är vits drag, så eleven vore svart.
    assert.equal(normalisera("r4rk1/pp3ppp/8/2bqp2b/3N4/P2Bn2P/1PPN1P2/R1BQ1RK1 w - - 1 15", ["d1h5", "d5g2"]), null);
    const n = normalisera("6k1/5ppp/8/4n3/8/8/r4PPP/2R3K1 b - - 0 1", ["a2a8", "c1c8"]);
    assert.ok(n);
    assert.equal(new Chess(n.fen).turn(), "w");
    assert.equal(n.senast, "a2a8");
    assert.deepEqual(n.losning, ["c1c8"]);
    assert.equal(normalisera("ogiltig", ["a2a3"]), null);
  });
  it("nekar ett pussel som inte är matt, olagligt drag, och matt i två med flera första drag", () => {
    const p = bank("ett").pussel[0];
    assert.equal(kontrollera(p, "ett"), null);
    assert.equal(kontrollera({ ...p, losning: ["a1a1"] }, "ett"), "olagligt drag");
    const ickeMatt = new Chess(p.fen).moves({ verbose: true }).find((m) => !mattIEtt(p.fen).some((x) => x.lan === m.lan));
    assert.equal(kontrollera({ ...p, losning: [ickeMatt.lan] }, "ett"), "inte matt");
    const t = bank("tva").pussel[0];
    assert.equal(kontrollera(t, "tva"), null);
    // Dam + torn mot ensam kung: massor av vägar till matt i två.
    const manga = { fen: "7k/8/8/8/8/8/1Q6/R5K1 w - - 0 1", losning: ["a1a7", "h8g8", "b2g7"] };
    assert.match(kontrollera(manga, "tva") || "", /första drag ger matt i två|matt i ett finns/);
  });
});

