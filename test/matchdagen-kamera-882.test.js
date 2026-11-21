// ============================================================================
// Matchdagen (#882): bollen och spelarna nära den närmaste långsidan försvann
// under bildkanten – och ljudeffekterna tas bort helt. Kameran (md-tre-kamera.js)
// projiceras med three ur src/vendor/ i planytans proportioner för 375 × 667,
// 390 × 844 (stående och liggande), 820 × 1180, 1366 × 768 och 1920 × 1080 (+ helskärm):
//   • följ-kameran i vila: bollen och spelarna inom 15 m (fötter och huvud) i bild
//   • under en boll över planen (kameran lerpar som ritaren): bollen i bild
//   • lugnt läge: hela planen (hörnen, också figurhöjd) ryms
//   • 2D: alla spelare och bollen inom SVG:ns viewBox (0–105 × 0–68)
//   • inget ljud: ingen Audio/AudioContext/ljudknapp kvar i src/matchdagen
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as T from "../src/vendor/three/three.module.min.js";
import { formation, PLAN_B, PLAN_L } from "../src/matchdagen/plan/md-formation.js";
import { foljVy, lugnVy } from "../src/matchdagen/plan/md-tre-kamera.js";

// Planytans bredd/höjd i de storlekarna (md-match-spel.js passaPlanen: 220–420 px hög), och kantfall.
const ASPEKTER = [0.9, 1.2, 1.39, 1.4, 1.49, 1.5, 1.59, 1.6, 1.61, 1.68, 1.88, 2.3, 2.73, 2.9, 3.6, 3.7, 4.2];
const HUVUD = 2.8; // figurens höjd i scenen (skala 1,5) med marginal

function kamera(v, aspekt) {
  const k = new T.PerspectiveCamera(v.fov, aspekt, 0.5, 400);
  k.position.set(...v.pos);
  k.lookAt(new T.Vector3(...v.mal));
  k.updateMatrixWorld();
  return k;
}
const ndc = (k, x, h, y) => new T.Vector3(x - PLAN_L / 2, h, y - PLAN_B / 2).project(k);
const iBild = (n, grans) => Math.abs(n.x) <= grans && Math.abs(n.y) <= grans && n.z < 1;

describe("#882 kameran: bollen och spelarna syns överallt på planen", () => {
  it("följ-kameran i vila: bollen och spelarna runt den, också längst ner", () => {
    for (const a of ASPEKTER) {
      for (let x = 0; x <= 100; x += 5) for (let y = 0; y <= 68; y += 2) for (const innehav of ["oss", "dem"]) {
        const f = formation({ x, y, innehav });
        const [bx, by] = f.boll;
        const k = kamera(foljVy(bx - PLAN_L / 2, by - PLAN_B / 2, a), a);
        const b = ndc(k, bx, 0.3, by);
        assert.ok(iBild(b, 0.6), `aspekt ${a}, boll (${x}, ${y}): ${b.x.toFixed(2)}, ${b.y.toFixed(2)}`);
        for (const [px, py] of [...f.vi, ...f.dem]) {
          if (Math.hypot(px - bx, py - by) > 15) continue;
          for (const h of [0, HUVUD]) {
            const n = ndc(k, px, h, py);
            assert.ok(iBild(n, 0.95), `aspekt ${a}, boll (${x}, ${y}), spelare (${px.toFixed(1)}, ${py.toFixed(1)}, ${h}): ${n.x.toFixed(2)}, ${n.y.toFixed(2)}`);
          }
        }
      }
    }
  });

  it("under en boll över planen (upp till 60 m) hänger kameran med", () => {
    const steg = 1 - Math.pow(0.12, 1 / 60); // ritarens lerp vid 60 bilder/s
    const r = (() => { let s = 882; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (const a of ASPEKTER) {
      for (let i = 0; i < 300; i++) {
        const fran = [r() * 101 - 50.5, r() * 64 - 32], till = [r() * 101 - 50.5, r() * 64 - 32];
        if (Math.hypot(till[0] - fran[0], till[1] - fran[1]) > 60) { i--; continue; }
        const v0 = foljVy(...fran, a);
        const pos = new T.Vector3(...v0.pos), mal = new T.Vector3(...v0.mal);
        const vm = foljVy(...till, a); // ritaren följer dit bollen är på väg
        const k = new T.PerspectiveCamera(vm.fov, a, 0.5, 400);
        for (let b = 0; b <= 90; b++) {
          const t = Math.min(1, (b * 1000) / 60 / 750), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          pos.lerp(new T.Vector3(...vm.pos), steg);
          mal.lerp(new T.Vector3(...vm.mal), steg);
          k.position.copy(pos); k.lookAt(mal); k.updateMatrixWorld();
          const n = new T.Vector3(fran[0] + (till[0] - fran[0]) * e, 0.3, fran[1] + (till[1] - fran[1]) * e).project(k);
          assert.ok(iBild(n, 0.9), `aspekt ${a}, ${fran.map(Math.round)} → ${till.map(Math.round)}, bild ${b}: ${n.x.toFixed(2)}, ${n.y.toFixed(2)}`);
        }
      }
    }
  });

  it("lugnt läge: hela planen ryms i den fasta vyn", () => {
    for (const a of ASPEKTER) {
      const k = kamera(lugnVy(a), a);
      for (const x of [0, PLAN_L]) for (const y of [0, PLAN_B]) for (const h of [0, HUVUD]) {
        const n = ndc(k, x, h, y);
        assert.ok(iBild(n, 0.97), `aspekt ${a}, hörn (${x}, ${y}, ${h}): ${n.x.toFixed(2)}, ${n.y.toFixed(2)}`);
      }
    }
  });

  it("3D-ritaren använder kamerans mål och följer bollens destination", () => {
    const src = readFileSync("src/matchdagen/plan/md-tre-ritare.js", "utf8");
    assert.match(src, /from "\.\/md-tre-kamera\.js"/);
    assert.match(src, /foljVy\(fx, fz, kamera\.aspect\)/);
    assert.match(src, /bana \? bana\.till\.z : bz/);
    assert.match(src, /lugnVy\(kamera\.aspect\)/);
  });

  it("2D: spelarna (r 2,1) och bollen ryms i viewBoxen också vid långsidorna", () => {
    for (let x = 0; x <= 100; x += 2) for (let y = 0; y <= 68; y += 1) for (const innehav of ["oss", "dem"]) {
      const f = formation({ x, y, innehav });
      for (const [px, py] of [...f.vi, ...f.dem]) {
        assert.ok(px - 2.1 >= 0 && px + 2.1 <= PLAN_L && py - 2.1 >= 0 && py + 2.1 <= PLAN_B, `(${x}, ${y}) spelare (${px}, ${py})`);
      }
      const [bx, by] = f.boll;
      assert.ok(by - 1.1 >= 0 && by + 1.1 <= PLAN_B && bx - 1.1 >= 0 && bx + 1.1 <= PLAN_L, `(${x}, ${y}) boll (${bx}, ${by})`);
    }
  });
});

describe("#882 inget ljud i Matchdagen", () => {
  const filer = [];
  const ga = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) ga(p); else filer.push(p); } };
  ga("src/matchdagen");
  it("ingen ljudmodul, ingen Audio/AudioContext, ingen ljudknapp", () => {
    assert.ok(!existsSync("src/matchdagen/plan/md-ljud.js"));
    for (const f of filer) {
      const src = readFileSync(f, "utf8");
      assert.ok(!/AudioContext|new Audio\b|<audio|md-ljud|skapaLjud|ljudKnapp|data-ljud|hooks\.ljud/.test(src), `${f}: ljud kvar`);
      assert.ok(!/\.(mp3|ogg|wav|m4a)\b/.test(src), `${f}: ljudfil`);
    }
    for (const f of ["src/styles/49-matchdagen-match.css", "src/styles/51-matchdagen-vanskap.css"]) {
      assert.ok(!/ljudknapp/.test(readFileSync(f, "utf8")), `${f}: ljudknappens stil kvar`);
    }
  });
  it("lärarens text om lugnt läge lovar inte längre dämpade ljud", () => {
    assert.ok(!/ljud/.test(readFileSync("src/matchdagen/larare/md-anpassningar-panel.js", "utf8")));
  });
});
