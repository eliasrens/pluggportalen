// ============================================================================
// Tester: Matchdagen-sidan öppnas (#878) – pageMatchdagen (src/matchdagen/page-matchdagen.js)
// väljer inställningarna och startar appen för varje sätt eleven kan ha Matchdagen på:
// hela klassen (enabledModules) med och utan klassens inställningar, bara per elev
// (elevModuler), med egna inställningar, och när de egna inte gick att läsa.
// Regressionen: i produktion visade sidan "Matchdagen kunde inte laddas" minuter efter
// deployen av #876 – en GAMMAL cachad md-inst.js (utan effektivInst) bredvid den nya
// sidan. Sidan ska då starta ändå. app.js versionsGlapp/dynSida känner igen felen.
// ui.js, data.js, md-inst-data.js, md-data.js och md-app.js byts mot stubbar (Firebase
// och DOM finns inte i node); md-inst.js är den riktiga (eller en "gammal" utan effektivInst).
// Ren node: node --test test/matchdagen-sida-878.test.js
// ============================================================================

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

const MD_INST = new URL("../src/matchdagen/md-inst.js", import.meta.url).href;
const T = "globalThis.__md878";
const STUBBAR = {
  "../ui.js": `export const app = { replaceChildren() {} }; export async function renderTopbar() {}`,
  "../data.js": `export const currentStudentId = () => ${T}.uid;
    export const getClasses = () => ${T}.getClasses();
    export const getStudentData = async () => null;
    export const getArea = async (s, a) => ${T}.area?.(s, a) ?? null;
    export const getAreas = async () => [];
    export const getSubjects = async () => [];
    export const ensureClassProjection = async () => ({ members: {} });`,
  "./md-inst-data.js": `export const lasInst = (uid) => ${T}.lasInst(uid);`,
  "./md-data.js": `export const lasKarriar = async () => null;`,
  "./md-app.js": `export async function startaMatchdagen(host, deps) { ${T}.deps = deps; }`,
};
// Före #876 hade md-inst.js ingen effektivInst/klassInst (den cachade versionen i produktion).
const GAMMAL = `export { MODUL, normalizeInst, harKallor, harMatchdagen } from ${JSON.stringify(MD_INST)};`;
const HOOK = `const S = ${JSON.stringify(STUBBAR)};
export async function resolve(spec, ctx, next) {
  const p = ctx.parentURL || "";
  if (p.includes("/src/matchdagen/page-matchdagen.js")) {
    if (spec === "./md-inst.js" && p.includes("gammal")) return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(${JSON.stringify(GAMMAL)}) };
    if (S[spec]) return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(S[spec]) };
  }
  return next(spec, ctx);
}`;

const UID = "alva";
const TABELLER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const KLASS_INST = { omraden: ["so/sverige"], tabeller: [9], rakna: [], svarssatt: "skriv", klocka: 0, lugnt: false, paus: 60 };
const EGEN = { omraden: [], tabeller: [3, 7], rakna: [], svarssatt: "flerval", klocka: 30, lugnt: false, paus: 60 };

let ny;
let gammal;
before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  globalThis.location = { hash: "#/elev/matchdagen", search: "" };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = { createElement: () => ({ setAttribute() {} }) };
  ny = (await import("../src/matchdagen/page-matchdagen.js")).pageMatchdagen;
  gammal = (await import("../src/matchdagen/page-matchdagen.js?gammal=1")).pageMatchdagen;
});

/** Sätt elevens klasser och egna inställningar, öppna sidan, ge det startaMatchdagen fick. */
async function oppna(sida, { klasser, egen = null, instFel = false, klassFel = false, lankFel = false }) {
  globalThis.__md878 = {
    uid: UID,
    deps: null,
    getClasses: async () => { if (klassFel) throw new Error("offline"); return klasser; },
    lasInst: async () => {
      if (lankFel) throw new SyntaxError("The requested module './md-inst.js' does not provide an export named 'nyaEnabledModules'");
      if (instFel) throw Object.assign(new Error("nekad"), { code: "permission-denied" });
      return egen;
    },
  };
  await sida();
  const { deps } = globalThis.__md878;
  assert.ok(deps, "appen startade (inget 'kunde inte laddas')");
  return deps;
}

const klassPa = (o = {}) => ({ id: "4a", studentIds: [UID, "bo"], enabledModules: ["matchdagen"], ...o });
const elevPa = (o = {}) => ({ id: "4a", studentIds: [UID, "bo"], elevModuler: { [UID]: ["matchdagen"] }, ...o });

describe("Matchdagen-sidan öppnas för varje sätt att ha Matchdagen (#878)", () => {
  beforeEach(() => { globalThis.__md878 = null; });

  it("hela klassen utan inställningar → tabellerna 0–10", async () => {
    const d = await oppna(ny, { klasser: [klassPa()] });
    assert.deepEqual(d.inst.tabeller, TABELLER);
    assert.equal(d.uid, UID);
    assert.equal(d.meddelande, undefined);
    assert.equal(d.vanskap?.classId, "4a");
  });
  it("hela klassen med klassens inställningar → klassens", async () => {
    const d = await oppna(ny, { klasser: [klassPa({ matchdagenInst: KLASS_INST })] });
    assert.deepEqual(d.inst.tabeller, [9]);
    assert.deepEqual(d.inst.omraden, ["so/sverige"]);
    assert.equal(d.inst.svarssatt, "skriv");
  });
  it("bara per elev (elevModuler), inga inställningar → tabellerna 0–10", async () => {
    const d = await oppna(ny, { klasser: [elevPa()] });
    assert.deepEqual(d.inst.tabeller, TABELLER);
  });
  it("bara per elev med klassens inställningar → klassens", async () => {
    const d = await oppna(ny, { klasser: [elevPa({ matchdagenInst: KLASS_INST })] });
    assert.deepEqual(d.inst.tabeller, [9]);
  });
  it("egna inställningar går före klassens", async () => {
    const d = await oppna(ny, { klasser: [klassPa({ matchdagenInst: KLASS_INST })], egen: EGEN });
    assert.deepEqual(d.inst.tabeller, [3, 7]);
    assert.equal(d.inst.klocka, 30);
  });
  it("de egna gick inte att läsa → inga frågor och ett meddelande (som förr)", async () => {
    const d = await oppna(ny, { klasser: [klassPa({ matchdagenInst: KLASS_INST })], instFel: true });
    assert.equal(d.inst, null);
    assert.match(d.meddelande, /kunde inte läsas/);
  });
  it("klasslistan gick inte att läsa → tabellerna 0–10, ingen vänskapsflik", async () => {
    const d = await oppna(ny, { klasser: [], klassFel: true });
    assert.deepEqual(d.inst.tabeller, TABELLER);
    assert.equal(d.vanskap, null);
  });
});

describe("Versionsglapp efter en deploy (#878-regressionen)", () => {
  it("en gammal cachad md-inst.js utan effektivInst: sidan startar med de egna", async () => {
    const d = await oppna(gammal, { klasser: [elevPa()], egen: EGEN });
    assert.deepEqual(d.inst.tabeller, [3, 7]);
  });
  it("ny md-inst-data.js mot gammal md-inst.js (SyntaxError vid länkningen): 'ladda om', inte 'kunde inte läsas'", async () => {
    const d = await oppna(gammal, { klasser: [klassPa({ matchdagenInst: KLASS_INST })], lankFel: true });
    assert.equal(d.inst, null);
    assert.match(d.meddelande, /uppdaterades nyss/);
  });
  it("…och utan egna: inga frågor och 'ladda om' i stället för att krascha", async () => {
    const d = await oppna(gammal, { klasser: [klassPa({ matchdagenInst: KLASS_INST })] });
    assert.equal(d.inst, null);
    assert.match(d.meddelande, /uppdaterades nyss/);
  });

  // app.js drar in ui.js (Firebase) – funktionen klipps ut ur källan och prövas här.
  const src = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const start = src.indexOf("function versionsGlapp(");
  const kropp = src.slice(start, src.indexOf("\n}\n", start) + 3);
  const versionsGlapp = new Function(`${kropp}; return versionsGlapp;`)();
  it("versionsGlapp känner igen felen en blandning av gammalt och nytt ger", () => {
    assert.equal(versionsGlapp(new TypeError("effektivInst is not a function")), true);
    assert.equal(versionsGlapp(new SyntaxError("The requested module './md-inst.js' does not provide an export named 'klassInst'")), true);
    assert.equal(versionsGlapp(new TypeError("Failed to fetch dynamically imported module: https://www.pluggporten.se/src/x.js")), true);
    assert.equal(versionsGlapp(new TypeError("Importing a module script failed.")), true);
    assert.equal(versionsGlapp(Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" })), false);
    assert.equal(versionsGlapp(null), false);
  });
  it("dynSida visar Ladda om vid versionsglapp, Matchdagen går genom dynSida", () => {
    assert.match(src, /const nyss = versionsGlapp\(err\)/);
    assert.match(src, /data-ladda-om/);
    assert.match(src, /"\/elev\/matchdagen": dynSida\(/);
  });
});

describe("Lärarens frågeval för hela klassen i Vad eleverna ser (#878)", () => {
  const mod = readFileSync(new URL("../src/teacher-class-modules.js", import.meta.url), "utf8");
  const sek = readFileSync(new URL("../src/teacher-classes-sections.js", import.meta.url), "utf8");
  it("knappen under modullistan öppnar klassens panel (elev = null) med biblioteket", () => {
    assert.match(mod, /data-act="md-klass"/);
    assert.match(mod, /import\("\.\/matchdagen\/larare\/md-anpassningar-panel\.js"\)/);
    assert.match(mod, /cls, elev: null, host: panel/);
    assert.match(sek, /renderClassModules\(ctx, cls, modulesEl, \{\s*loadLibrary: \(\) => store\.loadLibrary\(\)/);
  });
});
