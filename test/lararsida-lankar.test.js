// #803 tester: varje intern lärarlänk i src/ (#/larare/…) ska landa på en riktig
// route (flik i TEACHER_TABS, prov-routes i app.js) eller en gammal adress i
// TEACHER_REDIRECTS – annars blir den en "Hoppsan"-sida efter en omgörning.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { installeraFirebaseStubbe, installeraWebbStubbe } from "./helpers/firebase-stub-loader.js";

const rot = new URL("../src/", import.meta.url).pathname;
const filer = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? filer(p) : p.endsWith(".js") ? [p] : [];
});

let shared;
before(async () => {
  installeraFirebaseStubbe();
  installeraWebbStubbe();
  shared = await import("../src/teacher-shared.js");
});

describe("interna lärarlänkar", () => {
  it("varje #/larare/…-adress i koden är en route eller omdirigeras till en", () => {
    const app = readFileSync(join(rot, "app.js"), "utf8");
    const extra = [...app.matchAll(/"(\/larare\/[a-z/-]+)":/g)].map((m) => m[1]);
    const routes = new Set([...shared.TEACHER_TABS.map((t) => t.hash.slice(1)), ...extra]);
    const fel = [];
    for (const f of filer(rot)) {
      const txt = readFileSync(f, "utf8");
      for (const m of txt.matchAll(/#(\/larare(?:\/[a-z][a-z-]*)*)/g)) {
        const path = m[1];
        if (path === "/larare") continue; // rot → Hem
        const dit = shared.teacherRedirect(path, "");
        const mal = dit ? dit.split("?")[0].slice(1) : path;
        if (!routes.has(mal)) fel.push(`${f.replace(rot, "src/")}: #${path}`);
      }
    }
    assert.deepEqual([...new Set(fel)], []);
  });
});
