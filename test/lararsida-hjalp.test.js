// #808 (epic #802 DEL 8) – hjälptexter och Hjälp och guide.
//   * varje länk i en hjälptext (Mina klasser-flikarna, Materialets underflikar) och i en
//     guide pekar DIREKT på en riktig route – inte på en gammal adress som omdirigeras – och
//     på en flik/underflik/verktyg som finns (?flik=, ?del=, ?verktyg=, ?vy=)
//   * de sju guiderna finns med 3–5 steg för både årskurslärare och admin; admin-länkar
//     och admin-guider syns bara för admin
//   * hjälptexterna är 1–2 meningar; valet att fälla ihop sparas utan att sidan kräver lagring
// Registry-modulerna importeras på riktigt med Firebase-SDK:t stubbat. Körs med: node --test
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installeraFirebaseStubbe, installeraWebbStubbe } from "./helpers/firebase-stub-loader.js";
import { GUIDER, guiderFor } from "../src/teacher-hjalp-guider.js";
import { MINA_FLIKAR, flikHjalp } from "../src/teacher-mina-val.js";

let shared, material, stats, admin, HJALP_PREFIX, arHopfalld, sparaHopfalld;
before(async () => {
  installeraFirebaseStubbe();
  installeraWebbStubbe();
  shared = await import("../src/teacher-shared.js");
  material = await import("../src/teacher-material-flikar.js");
  stats = (await import("../src/teacher-class.js")).STATS_TABS;
  admin = await import("../src/teacher-admin.js");
  ({ HJALP_PREFIX, arHopfalld, sparaHopfalld } = await import("../src/teacher-hjalptext.js"));
});

const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const routes = () => new Map([
  ...shared.TEACHER_TABS.map((t) => [t.hash.slice(1), t]),
  ...[...app.matchAll(/"(\/larare\/[a-z/-]+)":/g)].map((m) => [m[1], null]),
]);
const lankar = (html) => [...String(html).matchAll(/data-hash="([^"]+)"/g)].map((m) => m[1]);

/** Felen för EN länk; adminLank = länken syns bara för admin. */
function fel(hash, adminLank, var_) {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const q = new URLSearchParams(query);
  const ut = [];
  const r = routes();
  if (!r.has(path)) return [`${var_}: ${hash} är ingen route`];
  if (shared.teacherRedirect(path, query)) ut.push(`${var_}: ${hash} är en gammal adress som omdirigeras`);
  const tab = r.get(path);
  if (tab?.admin && !adminLank) ut.push(`${var_}: ${hash} är en admin-sida men länken syns för årskurslärare`);
  if (path === "/larare/mina-klasser") {
    const flik = q.get("flik");
    if (flik && !MINA_FLIKAR.some((f) => f.key === flik)) ut.push(`${var_}: ${hash} – ingen flik "${flik}"`);
    if (q.get("del") && (flik !== "hur" || !stats.some((t) => t.key === q.get("del")))) ut.push(`${var_}: ${hash} – ingen underflik "${q.get("del")}" i Hur går det?`);
  }
  if (path === "/larare/material") {
    const f = material.materialFlik(q.get("flik"));
    if (!f) ut.push(`${var_}: ${hash} – ingen Material-flik "${q.get("flik")}"`);
    else if (f.admin && !adminLank) ut.push(`${var_}: ${hash} – fliken är bara för admin`);
  }
  if (path === "/larare/admin" && q.get("verktyg") && !admin.ADMIN_KORT.some((k) => k.verktyg && k.key === q.get("verktyg"))) {
    ut.push(`${var_}: ${hash} – inget Admin-verktyg "${q.get("verktyg")}"`);
  }
  if (path === "/larare/prov" && q.get("vy") && q.get("vy") !== "ny") ut.push(`${var_}: ${hash} – okänd vy`);
  return ut;
}

describe("hjälptexter (Mina klasser och Material)", () => {
  it("varje flik har en kort hjälptext, 1–2 meningar (utom Plugga-områden, #814)", () => {
    const meningar = (html) => html.replace(/<[^>]+>/g, "").replace(/Hur går det\?/g, "Hur går det").replace(/Hitta rätt!/g, "Hitta rätt").split(/[.!?]\s+/).filter(Boolean).length;
    const alla = [
      ...MINA_FLIKAR.flatMap((f) => [[`mina ${f.key}`, f.hjalp], ...(f.hjalpAdmin ? [[`mina ${f.key} (admin)`, f.hjalpAdmin]] : [])]),
      ...material.MATERIAL_FLIKAR.filter((f) => f.key !== "plugga").map((f) => [`material ${f.key}`, f.hint]),
    ];
    assert.equal(alla.length, 4 + 1 + 5);
    for (const [namn, html] of alla) {
      assert.ok(html && html.length > 20, namn);
      const n = meningar(html);
      assert.ok(n >= 1 && n <= 2, `${namn}: ${n} meningar`);
    }
  });
  it("årskurs och admin får rätt text; Elever skiljer sig", () => {
    const elever = MINA_FLIKAR.find((f) => f.key === "elever");
    assert.notEqual(flikHjalp(elever, true), flikHjalp(elever, false));
    assert.equal(flikHjalp(MINA_FLIKAR[0], true), flikHjalp(MINA_FLIKAR[0], false));
    assert.doesNotMatch(flikHjalp(elever, false), /Ge mynt|tar bort konton/);
  });
  it("varje länk i en hjälptext pekar på en riktig route och flik", () => {
    const problem = [];
    for (const f of MINA_FLIKAR) for (const h of lankar(f.hjalp + (f.hjalpAdmin || ""))) problem.push(...fel(h, false, `mina ${f.key}`));
    for (const f of material.MATERIAL_FLIKAR) for (const h of lankar(f.hint || "")) problem.push(...fel(h, f.admin, `material ${f.key}`));
    assert.deepEqual(problem, []);
  });
  it("Mina klasser och Material ritar hjälprutan, och den sparar valet per ruta", () => {
    const mk = readFileSync(new URL("../src/teacher-mina-klasser.js", import.meta.url), "utf8");
    assert.match(mk, /hjalpRuta\(`mina-\$\{aktiv\.key\}`, flikHjalp\(aktiv, sida\.admin\), ctx\)/);
    const mat = readFileSync(new URL("../src/teacher-material.js", import.meta.url), "utf8");
    assert.match(mat, /if \(flik\.hint\) sida\.append\(hjalpRuta\(`material-\$\{flik\.key\}`, flik\.hint, ctx\)\)/);
  });
  it("Plugga-områden har ingen hjälptext, så fliken ritas helt utan ruta (#814)", () => {
    assert.equal(material.materialFlik("plugga").hint, undefined);
  });
});

describe("hopfällbart val i localStorage", () => {
  const lager = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
  it("standard öppen; hopfälld sparas per ruta och öppen tar bort nyckeln", () => {
    const l = lager();
    assert.equal(arHopfalld("mina-hur", l), false);
    sparaHopfalld("mina-hur", true, l);
    assert.equal(arHopfalld("mina-hur", l), true);
    assert.equal(arHopfalld("mina-ser", l), false);
    assert.ok(l.m.has(HJALP_PREFIX + "mina-hur"));
    sparaHopfalld("mina-hur", false, l);
    assert.equal(l.m.size, 0);
  });
  it("sidan fungerar utan lagring: saknad eller kastande lagring ger öppen ruta, inget fel", () => {
    const kastar = { getItem() { throw new Error("blockerad"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("x"); } };
    assert.equal(arHopfalld("x", kastar), false);
    assert.doesNotThrow(() => sparaHopfalld("x", true, kastar));
    assert.doesNotThrow(() => sparaHopfalld("x", false, kastar));
    assert.equal(arHopfalld("x", null), false);
    assert.doesNotThrow(() => sparaHopfalld("x", true, null));
  });
});

describe("Hjälp och guide", () => {
  it("de sju guiderna i specens ordning", () => {
    assert.deepEqual(GUIDER.map((g) => g.titel), [
      "Kom igång med en ny klass", "Välj vad eleverna ser", "Fokusläge", "Skapa ett område med AI",
      "Gör ett prov och rätta det", "Starta Live", "Ändra elevernas nivåer i Läsresan och Ekvationsresan",
    ]);
    assert.equal(new Set(GUIDER.map((g) => g.key)).size, 7);
  });
  it("varje guide har 3–5 steg för årskurslärare och för admin", () => {
    for (const adminRoll of [false, true]) {
      const guider = guiderFor(adminRoll);
      assert.equal(guider.length, 7);
      for (const g of guider) {
        assert.ok(g.steg.length >= 3 && g.steg.length <= 5, `${g.key} (${adminRoll ? "admin" : "årskurs"}): ${g.steg.length} steg`);
        for (const s of g.steg) assert.ok(s.text && s.hash && s.knapp, `${g.key}: steg utan text/länk`);
      }
    }
  });
  it("varje guide-länk pekar direkt på en riktig route och flik (för sin roll)", () => {
    const problem = [];
    for (const g of GUIDER) for (const s of g.steg) {
      if (!s.hash) continue;
      // Syns för årskurs om steget inte är admin-bara; annars kontrolleras det som admin.
      problem.push(...fel(s.hash, s.roll === "admin" || g.roll === "admin", `${g.key}: ${s.knapp}`));
    }
    assert.deepEqual(problem, []);
  });
  it("admin-steg syns bara för admin och årskurslärare ser aldrig länkar till admin-sidor", () => {
    const ark = guiderFor(false);
    assert.ok(!ark.flatMap((g) => g.steg).some((s) => s.roll === "admin"));
    for (const s of ark.flatMap((g) => g.steg)) {
      const tab = routes().get(s.hash.replace(/^#/, "").split("?")[0]);
      assert.ok(!tab?.admin, `${s.hash} är en admin-sida`);
    }
    const adm = guiderFor(true).flatMap((g) => g.steg);
    assert.ok(adm.some((s) => s.roll === "admin" && s.hash.includes("verktyg=skapa")));
    assert.ok(!adm.some((s) => s.roll === "arskurs"));
    assert.ok(guiderFor(false).find((g) => g.key === "ny-klass").steg.some((s) => s.roll === "arskurs"));
  });
  it("sidan laddas lat, har inga läsningar och inga nya statiska importer", () => {
    const hjalp = readFileSync(new URL("../src/teacher-hjalp.js", import.meta.url), "utf8");
    assert.doesNotMatch(hjalp, /firebase|data\.js|getDocs|getDoc\(/);
    assert.match(hjalp, /guiderFor\(isAdmin\(\)\)/);
    const delad = readFileSync(new URL("../src/teacher-shared.js", import.meta.url), "utf8");
    assert.doesNotMatch(delad, /^import .*teacher-hjalp/m);
    assert.match(delad, /import\("\.\/teacher-hjalp\.js"\)/);
  });
});
