// ============================================================================
// Testarens kontrolltest för guiden "Lär dig schack" (#790): ett OBEROENDE
// facit (egen enkel draggenerering + egen BFS, inte koderns jaktDrag/minstaDrag)
// för varje stjärnjakt, geometrin i uppgifterna, att ställningarna i lektion 9–11
// har rätt antal lösningar och patt-fällor, stjärnrutorna för minsta lösning,
// och bootgrafen (107, inga guide-filer i den).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "../src/schack/vendor/chess.js";
import { LEKTIONER, bedomDrag, minFor, stjarnorEfterDrag, skapaLopp, ANTAL_LEKTIONER } from "../src/schack/schack-lektioner.js";
import { skapaJaktKontroll } from "../src/schack/schack-stjarnjakt.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

// --- Oberoende facit: en vit pjäs, hinder, mål ------------------------------
const f2n = (s) => [s.charCodeAt(0) - 97, Number(s[1]) - 1];
const n2s = (x, y) => String.fromCharCode(97 + x) + (y + 1);
const inom = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;

function drag(typ, pos, egna, fiender) {
  const [x, y] = f2n(pos);
  const ut = [];
  const slide = (dirs) => {
    for (const [dx, dy] of dirs) {
      let cx = x + dx, cy = y + dy;
      while (inom(cx, cy)) {
        const s = n2s(cx, cy);
        if (egna.has(s)) break;
        ut.push(s);
        if (fiender.has(s)) break;
        cx += dx; cy += dy;
      }
    }
  };
  const step = (dirs) => {
    for (const [dx, dy] of dirs) {
      const cx = x + dx, cy = y + dy;
      if (inom(cx, cy) && !egna.has(n2s(cx, cy))) ut.push(n2s(cx, cy));
    }
  };
  const ORT = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIA = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  if (typ === "r") slide(ORT);
  if (typ === "b") slide(DIA);
  if (typ === "q") slide([...ORT, ...DIA]);
  if (typ === "k") step([...ORT, ...DIA]);
  if (typ === "n") step([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]);
  if (typ === "p") {
    const ett = n2s(x, y + 1);
    if (inom(x, y + 1) && !egna.has(ett) && !fiender.has(ett)) {
      ut.push(ett);
      const tva = n2s(x, y + 2);
      if (y === 1 && !egna.has(tva) && !fiender.has(tva)) ut.push(tva);
    }
    for (const dx of [-1, 1]) if (inom(x + dx, y + 1) && fiender.has(n2s(x + dx, y + 1))) ut.push(n2s(x + dx, y + 1));
  }
  return ut;
}

/** Minsta antal drag (naiv BFS över (ruta, mängd kvarvarande mål) med Set av strängar). */
function bfs(u) {
  const egna = new Set(u.egna || []);
  const fi = new Set((u.fiender || []).map((f) => f.ruta));
  const mal = [...u.stjarnor, ...fi];
  const start = { pos: u.fran, kvar: new Set(mal) };
  const key = (s) => s.pos + "|" + [...s.kvar].sort().join(",");
  const seen = new Set([key(start)]);
  let front = [start];
  for (let d = 1; front.length && d < 40; d++) {
    const nxt = [];
    for (const s of front) {
      const levande = new Set([...fi].filter((r) => s.kvar.has(r)));
      for (const t of drag(u.pjas, s.pos, egna, levande)) {
        const kvar = new Set(s.kvar); kvar.delete(t);
        const n = { pos: t, kvar };
        if (!kvar.size) return d;
        const k = key(n);
        if (!seen.has(k)) { seen.add(k); nxt.push(n); }
      }
    }
    front = nxt;
  }
  return Infinity;
}

describe("stjärnjakter: oberoende BFS ger samma minimum som lektionsdata", () => {
  for (const L of LEKTIONER.filter((l) => l.typ === "jakt")) {
    L.uppgifter.forEach((u, i) => {
      it(`lektion ${L.nr} uppgift ${i + 1}: min ${u.min}`, () => assert.equal(bfs(u), u.min));
    });
  }
});

describe("stjärnjakter: geometrin är hel", () => {
  for (const L of LEKTIONER.filter((l) => l.typ === "jakt")) {
    L.uppgifter.forEach((u, i) => {
      it(`lektion ${L.nr} uppgift ${i + 1}: inga rutor krockar, allt på brädet, minst ett mål`, () => {
        const alla = [u.fran, ...u.stjarnor, ...(u.egna || []), ...(u.fiender || []).map((f) => f.ruta)];
        for (const r of alla) assert.match(r, /^[a-h][1-8]$/);
        assert.equal(new Set(alla).size, alla.length, "samma ruta används två gånger");
        assert.ok(u.stjarnor.length + (u.fiender || []).length >= 1);
        assert.ok(u.min >= u.stjarnor.length + (u.fiender || []).length, "min kan inte vara färre än antal mål");
        if (u.pjas === "b") {
          // löparen stannar på startfärgen: alla mål på samma färg
          const farg = (r) => (f2n(r)[0] + f2n(r)[1]) % 2;
          for (const s of u.stjarnor) assert.equal(farg(s), farg(u.fran), `${s} har fel färg för löparen`);
        }
      });
    });
  }
});

describe("stjärnjakt genom kontrollen: första tryck väljer, andra flyttar; stjärnorna räknas rätt", () => {
  it("alla jakter går att klara via kontrollens tryck() på BFS-vägen och drag-räknaren stämmer", () => {
    for (const L of LEKTIONER.filter((l) => l.typ === "jakt")) {
      for (const u of L.uppgifter) {
        let klar = null;
        const k = skapaJaktKontroll(u, { onKlar: (s) => { klar = s.jakt.antal; } });
        // egen lösning: följ BFS-prediket – hämta väg via hjälp av brute force (iterativ djupökning)
        const vag = losning(u);
        assert.ok(vag, `lektion ${L.nr}: ingen lösning`);
        let pos = u.fran;
        for (const t of vag) {
          assert.equal(k.tryck(pos).typ, "vald");
          assert.equal(k.tryck(t).typ, "drag", `${pos}->${t}`);
          pos = t;
        }
        assert.equal(klar, u.min, `lektion ${L.nr}`);
      }
    }
  });
});

/** Iterativ djupökning (separat från BFS-funktionen ovan) → väg som tar allt. */
function losning(u) {
  const egna = new Set(u.egna || []);
  const fi = new Set((u.fiender || []).map((f) => f.ruta));
  const mal = [...u.stjarnor, ...fi];
  for (let djup = 1; djup <= u.min; djup++) {
    const v = dfs(u, egna, fi, u.fran, new Set(mal), djup, []);
    if (v) return v;
  }
  return null;
}
function dfs(u, egna, fi, pos, kvar, kvarDrag, vag) {
  if (!kvar.size) return vag;
  if (!kvarDrag) return null;
  const lev = new Set([...fi].filter((r) => kvar.has(r)));
  for (const t of drag(u.pjas, pos, egna, lev)) {
    const nk = new Set(kvar); nk.delete(t);
    const r = dfs(u, egna, fi, t, nk, kvarDrag - 1, [...vag, t]);
    if (r) return r;
  }
  return null;
}

describe("stjärnor efter drag: gränserna för varje lektions min", () => {
  it("3 vid min, 2 upp till min+tolerans, 1 därefter – aldrig 0 eller >3, monotont", () => {
    for (const L of LEKTIONER.filter((l) => l.typ !== "parti")) {
      const min = minFor(L);
      let prev = 3;
      for (let d = 0; d <= min + 40; d++) {
        const s = stjarnorEfterDrag(d, min);
        assert.ok(s >= 1 && s <= 3);
        assert.ok(s <= prev, `lektion ${L.nr}: ${d} drag gav fler stjärnor än färre`);
        prev = s;
      }
      assert.equal(stjarnorEfterDrag(min, min), 3);
      assert.equal(stjarnorEfterDrag(min - 1, min), 3);
      assert.equal(stjarnorEfterDrag(min + 1, min), 2);
      assert.equal(stjarnorEfterDrag(min + 1000, min), 1);
    }
  });
  it("skapaLopp för fråge-/ställningslektion: fel svar räknas och ger färre stjärnor", () => {
    const L = LEKTIONER[0];
    const lopp = skapaLopp(L);
    for (const u of L.uppgifter) { lopp.tryck("a1"); lopp.tryck("a1"); lopp.tryck("a1"); lopp.tryck(u.svar[0]); }
    assert.equal(lopp.klar, true);
    assert.equal(lopp.resultat().stjarnor, 1);
    assert.equal(lopp.resultat().drag, 7 * 4);
  });
  it("loppet ignorerar tryck efter att lektionen är klar (dubbelklick ändrar inget)", () => {
    const L = LEKTIONER[0];
    const lopp = skapaLopp(L);
    for (const u of L.uppgifter) lopp.tryck(u.svar[0]);
    const r0 = JSON.stringify(lopp.resultat());
    lopp.tryck("a1"); lopp.tryck("e4");
    assert.equal(JSON.stringify(lopp.resultat()), r0);
  });
});

describe("lektion 9–11: ställningarna är rätt konstruerade", () => {
  const verbose = (fen) => new Chess(fen).moves({ verbose: true });
  const dragInfo = (m) => ({ piece: m.piece, captured: m.captured || null, flags: m.flags, san: m.san, efter: m.after, from: m.from, to: m.to });

  for (const nr of [9, 10, 11]) {
    const L = LEKTIONER.find((l) => l.nr === nr);
    L.uppgifter.forEach((u, i) => {
      it(`lektion ${nr} uppgift ${i + 1} (${u.krav}): giltig FEN, vit vid draget, minst en rätt lösning`, () => {
        const c = new Chess(u.fen);
        assert.equal(c.turn(), "w");
        const ok = verbose(u.fen).filter((m) => bedomDrag(u, dragInfo(m)).ok);
        assert.ok(ok.length >= 1, "ingen rätt lösning");
        if (nr === 9) assert.equal(c.isCheck(), true, "lektion 9 ska börja i schack");
        if (nr === 10) assert.equal(c.isCheck(), false);
      });
    });
  }

  it("lektion 10 uppgift 2 har minst ett pattdrag och det avvisas med patt-texten", () => {
    const u = LEKTIONER.find((l) => l.nr === 10).uppgifter[1];
    const patt = verbose(u.fen).filter((m) => new Chess(m.after).isStalemate());
    assert.ok(patt.length >= 1, "pattfällan saknas");
    for (const m of patt) {
      const r = bedomDrag(u, dragInfo(m));
      assert.equal(r.ok, false);
      assert.match(r.text, /patt/i);
    }
  });

  it("'matt' accepteras bara när motståndaren faktiskt är matt", () => {
    for (const u of LEKTIONER.find((l) => l.nr === 10).uppgifter) {
      for (const m of verbose(u.fen)) {
        assert.equal(bedomDrag(u, dragInfo(m)).ok, new Chess(m.after).isCheckmate(), m.san);
      }
    }
  });

  it("rockad: både kort och lång accepteras, ett vanligt kungsdrag gör det inte", () => {
    const u = LEKTIONER.find((l) => l.nr === 11).uppgifter[0];
    const sanOk = verbose(u.fen).filter((m) => bedomDrag(u, dragInfo(m)).ok).map((m) => m.san).sort();
    assert.deepEqual(sanOk, ["O-O", "O-O-O"]);
  });

  it("en passant: exakt ett drag; bondeförvandling: alla fyra pjäsval räknas", () => {
    const L = LEKTIONER.find((l) => l.nr === 11);
    assert.deepEqual(verbose(L.uppgifter[1].fen).filter((m) => bedomDrag(L.uppgifter[1], dragInfo(m)).ok).map((m) => m.san), ["exd6"]);
    assert.equal(verbose(L.uppgifter[2].fen).filter((m) => bedomDrag(L.uppgifter[2], dragInfo(m)).ok).length, 4);
  });
});

describe("lektionsdata i stort", () => {
  it("12 lektioner i ordning, unika titlar, alla har intro, jakt/ställning har uppgifter", () => {
    assert.equal(LEKTIONER.length, ANTAL_LEKTIONER);
    LEKTIONER.forEach((l, i) => assert.equal(l.nr, i + 1));
    assert.equal(new Set(LEKTIONER.map((l) => l.titel)).size, 12);
    for (const l of LEKTIONER) {
      assert.ok(l.intro.length > 20);
      if (l.typ !== "parti") assert.ok(l.uppgifter.length >= 1);
    }
  });
  it("texterna har inga emoji eller unicode-schacktecken (visas olika på olika datorer)", () => {
    const json = JSON.stringify(LEKTIONER);
    assert.equal(/[♔-♟\u{1F300}-\u{1FAFF}]/u.test(json), false);
  });
});

describe("bootgrafen (#271)", () => {
  function bootgraf() {
    const start = join(SRC, "app.js");
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const file = queue.shift();
      let src;
      try { src = readFileSync(file, "utf8"); } catch { continue; }
      src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
      let m;
      while ((m = re.exec(src))) {
        const next = resolve(dirname(file), m[1]);
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    return seen;
  }
  it("107 filer och ingen fil i src/schack/ i den statiska grafen", () => {
    const g = bootgraf();
    assert.equal(g.size, 107);
    assert.deepEqual([...g].filter((f) => f.includes("/src/schack/")), []);
  });
  it("alla nya guide-filer ligger i src/schack/ och ingen annan src-fil nämner dem", () => {
    const guide = ["schack-lektioner.js", "schack-lektion-vy.js", "schack-guide-vy.js", "schack-guide-delar.js", "schack-stjarnjakt.js"];
    for (const f of guide) assert.ok(readdirSync(join(SRC, "schack")).includes(f));
    for (const f of readdirSync(SRC).filter((x) => x.endsWith(".js"))) {
      const s = readFileSync(join(SRC, f), "utf8");
      for (const g of guide) assert.ok(!s.includes(g), `${f} nämner ${g}`);
    }
  });
});
