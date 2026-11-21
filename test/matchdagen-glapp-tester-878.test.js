// Testern #878: versionsglappet mot den RIKTIGA gamla md-inst.js (före #876, eee92c3e^),
// inte en stubbe. Det som produktionen hade cachat i 10 min efter deployen.
//  - md-app.js och md-fragor.js (elevsidans statiska kedja) får bara importera namn som
//    finns i den gamla – annars faller hela sidan till "kunde inte laddas" igen.
//  - md-inst-data.js importerar nya namn: länkningen ger SyntaxError, som sidan fångar.
//  - page-matchdagen.js använder bara harMatchdagen + effektivInst ur modulen (glappvakt).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rot = new URL("..", import.meta.url);
const las = (p) => readFileSync(new URL(p, rot), "utf8");
const exporter = (src) => new Set([...src.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
const importerFranMdInst = (src) => {
  const m = src.match(/import \{([^}]*)\} from "\.\/md-inst\.js"/);
  return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
};

let gammal;
try {
  gammal = execFileSync("git", ["show", "eee92c3e^:src/matchdagen/md-inst.js"], { cwd: rot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch { gammal = null; }

describe("Versionsglapp mot den riktiga gamla md-inst.js (#878, testern)", { skip: gammal ? false : "git-historiken saknas" }, () => {
  it("md-app.js och md-fragor.js klarar den gamla md-inst.js", () => {
    const gamla = exporter(gammal);
    for (const fil of ["src/matchdagen/md-app.js", "src/matchdagen/md-fragor.js"]) {
      const namn = importerFranMdInst(las(fil));
      assert.ok(namn.length > 0, fil);
      for (const n of namn) assert.ok(gamla.has(n), `${fil} importerar ${n} som en gammal cachad md-inst.js saknar`);
    }
  });
  it("md-inst-data.js mot den gamla ger ett länkfel (SyntaxError-vägen i sidan)", () => {
    const gamla = exporter(gammal);
    const saknas = importerFranMdInst(las("src/matchdagen/md-inst-data.js")).filter((n) => !gamla.has(n));
    assert.ok(saknas.length > 0);
  });
  it("sidan använder harMatchdagen (finns i den gamla) och vaktar effektivInst", () => {
    assert.ok(exporter(gammal).has("harMatchdagen"));
    assert.ok(!exporter(gammal).has("effektivInst"));
    assert.match(las("src/matchdagen/page-matchdagen.js"), /typeof effektivInst !== "function"/);
  });
});
