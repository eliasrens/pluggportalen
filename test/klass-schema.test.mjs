// ============================================================================
// Veckoschema per klass (#900, docs/VECKOSCHEMA.md) – den rena logiken
// (src/klass-schema.js + klass-schema-tid.js). Spec F.1:
//   normalizeSchema (ogiltiga former), aktivLektion (start/slut, helg, pa:false,
//   sommar-/vintertid, annan tidszon), schemaForStudent (flera klasser, ämne
//   utan synliga områden, tom assignedAreas), grinden (B.5 rad för rad, låset
//   går före, lås upphör mitt i en lektion) och ögonblicksbilden för en klass
//   utan schema (grinden exakt som i dag). Plus speglingen mot firestore.rules,
//   kopplingsgissningen och bootgrafen.
// Ren Node: node --test test/klass-schema.test.mjs
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  SCHEMA_MAX_LEKTIONER, KOPPLING_NYCKLAR, MATCHDAGEN_TABELLER, normalizeSchema, normalizeLektion, aktivLektion,
  schemaForStudent, gateForSchema, kombineradGrind, lektionKrock, nyttLektionsId, gissaKoppling,
  effektivKoppling, okandaKopplingar, nastaSchemaAndring, svenskTid, nastaSvenskTid, sorteradeLektioner,
} from "../src/klass-schema.js";
import { gateFor, lockForStudent } from "../src/class-lock.js";

const MIN = 60_000;
/** Svensk väggtid → epoch-ms, uttryckt i UTC (vintertid +1 h, sommartid +2 h). */
const utc = (iso) => Date.parse(iso + "Z");
// 2026: sommartid börjar sön 29 mars 02:00, vintertid sön 25 okt 03:00.
const MAN_VINTER = utc("2026-11-23T08:00:00"); // måndag 23 nov 09:00 svensk tid (CET)
const L = (over = {}) => ({ id: "l1", dag: 1, start: "09:00", slut: "10:00", amne: "no", ...over });
const klass = (schema, over = {}) => ({ id: "4a", studentIds: ["e1"], assignedAreas: [], schema, ...over });
const pa = (lektioner, over = {}) => ({ pa: true, lektioner, koppling: {}, ...over });
const SUBJECTS = [{ id: "so", name: "SO" }, { id: "no", name: "NO" }, { id: "ma", name: "Matematik" }, { id: "sv", name: "Svenska" }];
const q = (s) => new URLSearchParams(s);

describe("normalizeSchema: säker form eller null", () => {
  it("okänd form → null (inget schema)", () => {
    for (const v of [null, undefined, 7, "schema", [], true]) assert.equal(normalizeSchema(v), null);
    assert.equal(normalizeSchema({ lektioner: "många" }), null);
    assert.equal(normalizeSchema({ lektioner: {} }), null);
  });
  it("för många lektioner → null", () => {
    const lista = Array.from({ length: SCHEMA_MAX_LEKTIONER + 1 }, (_, i) => L({ id: `x${i}` }));
    assert.equal(normalizeSchema({ pa: true, lektioner: lista }), null);
    assert.equal(normalizeSchema({ pa: true, lektioner: lista.slice(1) }).lektioner.length, SCHEMA_MAX_LEKTIONER);
  });
  it("pa saknas = av; lektioner saknas = inga", () => {
    assert.deepEqual(normalizeSchema({}), { pa: false, lektioner: [], koppling: {} });
    assert.equal(normalizeSchema({ pa: "true" }).pa, false);
  });
  it("fel tider, start ≥ slut, dag 0/6/7 och fel fält släpps", () => {
    const fel = [
      { start: "9:00" }, { slut: "24:00" }, { start: "09:60" }, { start: 900 }, { slut: "10:00:00" },
      { start: "10:00", slut: "10:00" }, { start: "10:00", slut: "09:00" },
      { dag: 0 }, { dag: 6 }, { dag: 7 }, { dag: "1" }, { dag: 1.5 },
      { amne: "" }, { amne: "x".repeat(101) }, { amne: 3 }, { id: "" }, { id: "x".repeat(21) }, { id: "a b" },
    ];
    for (const f of fel) {
      assert.equal(normalizeLektion(L(f)), null, JSON.stringify(f));
      assert.deepEqual(normalizeSchema(pa([L(f)])).lektioner, [], JSON.stringify(f));
    }
    assert.deepEqual(normalizeLektion({ ...L(), namn: "NO" }), L(), "okända fält tas bort");
    assert.deepEqual(normalizeLektion(L({ start: "00:00", slut: "23:59", amne: "x".repeat(100) })),
      L({ start: "00:00", slut: "23:59", amne: "x".repeat(100) }));
  });
  it("dubblerat lektions-id: den första gäller", () => {
    const s = normalizeSchema(pa([L(), L({ dag: 2 })]));
    assert.deepEqual(s.lektioner, [L()]);
  });
  it("okända modul-id i kopplingen släpps; Schack är alltid null", () => {
    const s = normalizeSchema(pa([], { koppling: { plugga: "so", matchdagen: "ma", okand: "x", lasresan: "sv",
      [MATCHDAGEN_TABELLER]: "ma", schack: "ma", brakresan: null, hittaratt: 4, ekvationsresan: "x".repeat(101) } }));
    assert.deepEqual(s.koppling, { lasresan: "sv", [MATCHDAGEN_TABELLER]: "ma", schack: null, brakresan: null });
    assert.deepEqual(normalizeSchema(pa([], { koppling: ["ma"] })).koppling, {});
  });
});

describe("hjälparna till lärarsidan (C)", () => {
  it("lektionKrock: överlapp samma dag krockar, slut = nästa start gör det inte", () => {
    const lista = [L(), L({ id: "l2", dag: 2 })];
    assert.equal(lektionKrock(lista, L({ id: "ny", start: "09:30", slut: "10:30" }))?.id, "l1");
    assert.equal(lektionKrock(lista, L({ id: "ny", start: "08:00", slut: "11:00" }))?.id, "l1");
    assert.equal(lektionKrock(lista, L({ id: "ny", start: "10:00", slut: "11:00" })), null);
    assert.equal(lektionKrock(lista, L({ id: "ny", start: "08:00", slut: "09:00" })), null);
    assert.equal(lektionKrock(lista, L({ id: "ny", dag: 3 })), null);
    assert.equal(lektionKrock(lista, L({ start: "09:30" })), null, "samma lektion (ändras) krockar inte med sig själv");
  });
  it("nyttLektionsId ger ett giltigt id; sorteradeLektioner sorterar på dag och tid", () => {
    assert.match(nyttLektionsId(), /^[a-z0-9]{8}$/);
    assert.ok(normalizeLektion(L({ id: nyttLektionsId() })));
    const s = sorteradeLektioner([L({ id: "c", dag: 2 }), L({ id: "b", start: "11:00", slut: "12:00" }), L({ id: "a", start: "08:20", slut: "09:00" })]);
    assert.deepEqual(s.map((l) => l.id), ["a", "b", "c"]);
  });
  it("gissaKoppling: Läsresan → Svenska, resorna/Mattematchen/tabellerna → matte, Hitta rätt! → SO, Schack → null", () => {
    assert.deepEqual(gissaKoppling(SUBJECTS), {
      lasresan: "sv", mattematchen: "ma", hittaratt: "so", ekvationsresan: "ma", brakresan: "ma", schack: null,
      [MATCHDAGEN_TABELLER]: "ma",
    });
    const andra = [{ id: "a1", name: "Matte åk 4" }, { id: "a2", name: "Geografi" }, { id: "a3", name: "Sv" }, { id: "a4", name: "Musik" }];
    assert.deepEqual(gissaKoppling(andra), { lasresan: "a3", mattematchen: "a1", hittaratt: "a2", ekvationsresan: "a1",
      brakresan: "a1", schack: null, [MATCHDAGEN_TABELLER]: "a1" });
    // "Ma" som helt ord – men inte inuti "Mat och hälsa" eller "Musik".
    assert.equal(gissaKoppling([{ id: "x", name: "Mat och hälsa" }, { id: "y", name: "Musik" }]).brakresan, null);
    assert.equal(gissaKoppling([{ id: "y", name: "Ma" }]).brakresan, "y");
  });
  it("effektivKoppling: lärarens val går före gissningen; borttaget ämne = null", () => {
    const s = pa([], { koppling: { lasresan: "no", brakresan: null, hittaratt: "borta" } });
    const k = effektivKoppling(s, SUBJECTS);
    assert.equal(k.lasresan, "no");
    assert.equal(k.brakresan, null, "läraren valde inget ämne");
    assert.equal(k.hittaratt, null, "ämnet finns inte längre");
    assert.equal(k.ekvationsresan, "ma", "gissad");
    assert.equal(effektivKoppling(s).ekvationsresan, null, "utan ämnen: bara det sparade");
    assert.deepEqual(okandaKopplingar(pa([]), [{ id: "no", name: "NO" }, { id: "sv", name: "Svenska" }]),
      ["mattematchen", "hittaratt", "ekvationsresan", "brakresan", MATCHDAGEN_TABELLER]);
    assert.deepEqual(okandaKopplingar(pa([]), SUBJECTS), []);
  });
});

describe("tiden: svensk tid, start räknas med, slut inte", () => {
  const k = klass(pa([L()]));
  it("exakt vid start aktiv, sista sekunden aktiv, exakt vid slut inte", () => {
    assert.equal(aktivLektion(k, MAN_VINTER)?.id, "l1");
    assert.equal(aktivLektion(k, MAN_VINTER - 1000), null, "08:59:59");
    assert.equal(aktivLektion(k, MAN_VINTER + 60 * MIN - 1000)?.id, "l1", "09:59:59");
    assert.equal(aktivLektion(k, MAN_VINTER + 60 * MIN), null, "10:00:00");
  });
  it("helg och andra dagar: ingen lektion", () => {
    assert.equal(aktivLektion(k, MAN_VINTER - 24 * 60 * MIN), null, "söndag");
    assert.equal(aktivLektion(k, MAN_VINTER - 2 * 24 * 60 * MIN), null, "lördag");
    assert.equal(aktivLektion(k, MAN_VINTER + 24 * 60 * MIN), null, "tisdag");
    const helg = klass(pa([L({ dag: 6 }), L({ id: "l7", dag: 7 })]));
    assert.equal(aktivLektion(helg, MAN_VINTER - 24 * 60 * MIN), null);
  });
  it("pa: false med lektioner kvar → inget filter, lektionerna oförändrade", () => {
    const av = klass({ pa: false, lektioner: [L()], koppling: {} });
    assert.equal(aktivLektion(av, MAN_VINTER), null);
    assert.equal(schemaForStudent([av], "e1", MAN_VINTER), null);
    assert.deepEqual(normalizeSchema(av.schema).lektioner, [L()]);
    assert.equal(aktivLektion(klass({ lektioner: [L()] }), MAN_VINTER), null, "pa saknas = av");
  });
  it("sommartidshelgen (29 mars 2026): fredag 09:00 = 08:00 UTC, måndag 09:00 = 07:00 UTC", () => {
    const fre = klass(pa([L({ dag: 5 })]));
    assert.equal(aktivLektion(fre, utc("2026-03-27T08:00:00"))?.id, "l1");
    assert.equal(aktivLektion(fre, utc("2026-03-27T07:59:59")), null);
    assert.equal(aktivLektion(k, utc("2026-03-30T07:00:00"))?.id, "l1");
    assert.equal(aktivLektion(k, utc("2026-03-30T06:59:59")), null);
    assert.equal(aktivLektion(k, utc("2026-03-30T08:00:00")), null, "10:00 sommartid");
    assert.deepEqual(svenskTid(utc("2026-03-29T01:00:00")), { dag: 7, minut: 3 * 60, sekund: 0 }, "02:00 → 03:00");
  });
  it("vintertidshelgen (25 okt 2026): fredag 09:00 = 07:00 UTC, måndag 09:00 = 08:00 UTC", () => {
    const fre = klass(pa([L({ dag: 5 })]));
    assert.equal(aktivLektion(fre, utc("2026-10-23T07:00:00"))?.id, "l1");
    assert.equal(aktivLektion(fre, utc("2026-10-23T08:00:00")), null);
    assert.equal(aktivLektion(k, utc("2026-10-26T08:00:00"))?.id, "l1");
    assert.equal(aktivLektion(k, utc("2026-10-26T07:59:59")), null);
    assert.deepEqual(svenskTid(utc("2026-10-25T01:00:00")), { dag: 7, minut: 2 * 60, sekund: 0 }, "03:00 → 02:00");
  });
  it("nästa ändring över omställningshelgen räknas i svensk tid", () => {
    // Fredag 27 mars 16:00 svensk tid → måndag 30 mars 09:00 sommartid = 07:00 UTC.
    assert.equal(nastaSchemaAndring([k], "e1", utc("2026-03-27T15:00:00")), utc("2026-03-30T07:00:00"));
    // Fredag 23 okt 16:00 sommartid → måndag 26 okt 09:00 vintertid = 08:00 UTC.
    assert.equal(nastaSchemaAndring([k], "e1", utc("2026-10-23T14:00:00")), utc("2026-10-26T08:00:00"));
    // Under lektionen: slutet. Exakt vid start: slutet (starten har redan hänt).
    assert.equal(nastaSchemaAndring([k], "e1", MAN_VINTER + 10 * MIN + 1234), MAN_VINTER + 60 * MIN);
    assert.equal(nastaSchemaAndring([k], "e1", MAN_VINTER), MAN_VINTER + 60 * MIN);
    // Exakt vid slut: nästa veckas start.
    assert.equal(nastaSchemaAndring([k], "e1", MAN_VINTER + 60 * MIN), MAN_VINTER + 7 * 24 * 60 * MIN);
    assert.equal(nastaSchemaAndring([klass(pa([L()], { pa: false }))], "e1", MAN_VINTER), null);
    assert.equal(nastaSchemaAndring([k], "annan", MAN_VINTER), null);
    assert.equal(nastaSvenskTid(MAN_VINTER + 1500, 1, 9 * 60), MAN_VINTER, "början av den pågående minuten");
  });
  it("en dator i en annan tidszon (TZ=America/New_York, Asia/Tokyo) räknar svensk tid", () => {
    const kod = `import("./src/klass-schema.js").then((m) => {
      const k = { id: "4a", studentIds: ["e1"], schema: { pa: true, lektioner: [{ id: "l1", dag: 1, start: "09:00", slut: "10:00", amne: "no" }] } };
      const t = Date.parse("2026-11-23T08:00:00Z");
      console.log(JSON.stringify([new Date(t).getHours(), m.aktivLektion(k, t)?.id ?? null, m.aktivLektion(k, t + 3600000), m.schemaForStudent([k], "e1", t)?.till]));
    });`;
    for (const [tz, timme] of [["America/New_York", 3], ["Asia/Tokyo", 17], ["UTC", 8]]) {
      const ut = execFileSync(process.execPath, ["--input-type=module", "-e", kod], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
      assert.deepEqual(JSON.parse(ut), [timme, "l1", null, MAN_VINTER + 60 * MIN], tz);
    }
  });
});

describe("schemaForStudent", () => {
  it("en aktiv lektion: ämnet, kopplade moduler, tabellerna, slutet och Plugga som hem", () => {
    const k = klass(pa([L({ amne: "ma" })], { koppling: gissaKoppling(SUBJECTS) }));
    const lage = schemaForStudent([k], "e1", MAN_VINTER, { subjects: SUBJECTS });
    assert.deepEqual(lage.amnen, ["ma"]);
    assert.deepEqual(lage.moduler.sort(), ["brakresan", "ekvationsresan", "mattematchen"], "även opt-in (modulgrinden prövar synligheten)");
    assert.equal(lage.tabeller, true);
    assert.equal(lage.label, "Matematik");
    assert.equal(lage.klockslag, "10:00");
    assert.equal(lage.till, MAN_VINTER + 60 * MIN);
    assert.equal(lage.home, "#/elev/plugga");
    assert.equal(lage.omraden, null, "tom assignedAreas = hela biblioteket");
    assert.equal(schemaForStudent([k], "e1", MAN_VINTER + 60 * MIN), null, "efter lektionen: inget filter");
    assert.equal(schemaForStudent([k], "annan", MAN_VINTER), null, "inte klassens elev");
  });
  it("flera klasser: unionen av de aktiva lektionernas ämnen, det tidigaste slutet", () => {
    const a = klass(pa([L({ amne: "no" })]));
    const b = klass(pa([L({ id: "b1", amne: "so", slut: "09:40" })]), { id: "4b" });
    const c = klass(pa([L({ id: "c1", amne: "sv", dag: 2 })]), { id: "4c" });
    const lage = schemaForStudent([a, b, c], "e1", MAN_VINTER, { subjects: SUBJECTS });
    assert.deepEqual(lage.amnen, ["no", "so"]);
    assert.equal(lage.label, "NO och SO");
    assert.equal(lage.klockslag, "09:40");
    assert.deepEqual(lage.lektioner.map((l) => l.classId), ["4a", "4b"]);
    const g = gateForSchema(lage);
    assert.ok(g.allowsArea("no", "x") && g.allowsArea("so", "y") && !g.allowsArea("sv", "z"));
  });
  it("ämne utan synliga områden och utan kopplad modul filtrerar inget", () => {
    // Klassen har valt områden – inget i NO.
    const k = klass(pa([L({ amne: "no" })]), { assignedAreas: [{ subjectId: "so", areaId: "vik" }] });
    assert.equal(schemaForStudent([k], "e1", MAN_VINTER), null);
    // Hela biblioteket, men NO har inga områden alls.
    const tom = klass(pa([L({ amne: "no" })]));
    assert.equal(schemaForStudent([tom], "e1", MAN_VINTER, { amnenMedOmraden: ["so", "ma"] }), null);
    assert.ok(schemaForStudent([tom], "e1", MAN_VINTER, { amnenMedOmraden: ["no"] }));
    // En filtrerande klass + en klass vars lektion inget har: unionen = allt.
    const no = klass(pa([L({ amne: "no" })]), { id: "4b" });
    assert.equal(schemaForStudent([no, k], "e1", MAN_VINTER), null);
  });
  it("matte utan synliga matteområden men med en kopplad modul filtrerar (bara modulerna)", () => {
    const k = klass(pa([L({ amne: "ma" })], { koppling: { brakresan: "ma" } }), { assignedAreas: [{ subjectId: "so", areaId: "vik" }] });
    const lage = schemaForStudent([k], "e1", MAN_VINTER);
    assert.deepEqual(lage.moduler, ["brakresan"]);
    assert.equal(gateForSchema(lage).allowsArea("so", "vik"), false);
    // Modulen är dold för klassen → den räknas inte → inget filter.
    const dold = { ...k, hiddenModules: ["brakresan"] };
    assert.equal(schemaForStudent([dold], "e1", MAN_VINTER), null);
  });
  it("assignedAreas: bara de valda områdena i lektionens ämne är öppna", () => {
    const k = klass(pa([L({ amne: "no" })]), { assignedAreas: [{ subjectId: "no", areaId: "kropp" }, { subjectId: "so", areaId: "vik" }] });
    const g = gateForSchema(schemaForStudent([k], "e1", MAN_VINTER));
    assert.equal(g.allowsArea("no", "kropp"), true);
    assert.equal(g.allowsArea("no", "rymden"), false, "NO-område som inte är valt för klassen");
    assert.equal(g.allowsArea("so", "vik"), false, "valt men inte lektionens ämne");
  });
  it("ett borttaget ämne (när ämnena ges) räknas inte som lektionens innehåll i kopplingen", () => {
    const k = klass(pa([L({ amne: "borta" })], { koppling: { brakresan: "borta" } }), { assignedAreas: [{ subjectId: "so", areaId: "v" }] });
    assert.equal(schemaForStudent([k], "e1", MAN_VINTER, { subjects: SUBJECTS }), null);
  });
  it("Plugga dold för klassen → hem är huset", () => {
    const k = klass(pa([L()]), { hiddenModules: ["plugga"] });
    assert.equal(schemaForStudent([k], "e1", MAN_VINTER).home, "#/elev/hus");
  });
});

describe("grinden under en lektion (B.5, rad för rad)", () => {
  const k = klass(pa([L({ amne: "ma" })], { koppling: gissaKoppling(SUBJECTS) }),
    { assignedAreas: [{ subjectId: "ma", areaId: "brak" }, { subjectId: "so", areaId: "vik" }] });
  const g = gateForSchema(schemaForStudent([k], "e1", MAN_VINTER, { subjects: SUBJECTS }));
  it("samma form som gateFor (routern och menyn ändras inte)", () => {
    const lockGate = gateFor({ mal: { typ: "lasresan" }, till: MAN_VINTER + MIN, doljOvrigt: false });
    for (const f of ["allows", "isTarget", "allowsArea", "home", "label", "klockslag", "fri", "lock"]) {
      assert.ok(f in g, f);
      assert.equal(typeof g[f], typeof lockGate[f] === "object" ? typeof g[f] : typeof lockGate[f], f);
    }
    assert.equal(g.fri, null);
    assert.equal(g.isTarget("/elev/plugga"), false, "schemat öppnar aldrig något dolt");
  });
  it("Plugga-områden i lektionens ämne som är synliga för klassen: öppna", () => {
    assert.equal(g.allows("/elev/plugga"), true);
    for (const p of ["/elev/omrade", "/elev/spela", "/elev/aventyr"]) assert.equal(g.allows(p, q("subj=ma&area=brak")), true, p);
  });
  it("andra Plugga-områden: spärrade (även via direktlänk)", () => {
    for (const p of ["/elev/omrade", "/elev/spela", "/elev/aventyr"]) {
      assert.equal(g.allows(p, q("subj=so&area=vik")), false, p);
      assert.equal(g.allows(p, q("subj=ma&area=annat")), false, p);
      assert.equal(g.allows(p), false, `${p} utan område`);
    }
  });
  it("inlärningsmoduler kopplade till lektionens ämne: öppna", () => {
    for (const p of ["/elev/brakresan", "/elev/ekvationsresan", "/elev/mattematchen"]) assert.equal(g.allows(p), true, p);
  });
  it("andra inlärningsmoduler och moduler utan koppling (Schack): spärrade", () => {
    for (const p of ["/elev/lasresan", "/elev/hitta-ratt", "/elev/schack"]) assert.equal(g.allows(p), false, p);
  });
  it("Matchdagen: öppen (frågorna filtreras i Del E)", () => {
    assert.equal(g.allows("/elev/matchdagen"), true);
    assert.equal(gateForSchema({ ...g.schema, matchdagen: false }).allows("/elev/matchdagen"), false);
  });
  it("hem/hus/värld, Shoppen, profil, Prov, Live och avatarvalet: öppna", () => {
    for (const p of ["/elev/hus", "/elev/hem", "/elev/rum", "/elev/by", "/elev/gard", "/elev/shop", "/elev/profil",
      "/elev/prov", "/elev/prov/skriv", "/elev/prov/resultat", "/elev/live", "/elev/avatar"]) assert.equal(g.allows(p), true, p);
  });
  it("klockslaget, etiketten och hemmet", () => {
    assert.equal(g.label, "Matematik");
    assert.equal(g.klockslag, "10:00");
    assert.equal(g.home, "#/elev/plugga");
  });
});

describe("fokuslåset går före schemat", () => {
  const lock = { mal: { typ: "lasresan" }, till: MAN_VINTER + 20 * MIN, doljOvrigt: false };
  const k = klass(pa([L({ amne: "no" })]), { lock });
  const grind = (now) => kombineradGrind(lockForStudent([k], "e1", now), schemaForStudent([k], "e1", now));
  it("aktivt lås: låset gäller och schemat ignoreras", () => {
    const g = grind(MAN_VINTER + 5 * MIN);
    assert.ok(g.lock);
    assert.equal(g.schema, undefined);
    assert.equal(g.allows("/elev/lasresan"), true, "låsets mål, fast inte lektionens ämne");
    assert.equal(g.allowsArea("no", "x"), false, "lektionens område – men låset gäller");
  });
  it("låset upphör mitt i lektionen: schemat tar över direkt", () => {
    const g = grind(MAN_VINTER + 20 * MIN);
    assert.equal(g.lock, null);
    assert.ok(g.schema);
    assert.equal(g.allows("/elev/lasresan"), false);
    assert.equal(g.allowsArea("no", "x"), true);
    assert.equal(grind(MAN_VINTER + 60 * MIN), null, "lektionen slut: inget");
  });
  it("ett inlämnat prov med klassens vanliga läge (gateFor null) räknas som lås: schemat gäller inte", () => {
    const fri = { mal: { typ: "prov", id: "t-123" }, till: MAN_VINTER + 30 * MIN, doljOvrigt: true, fri: "klass", moduler: [] };
    assert.equal(kombineradGrind(fri, schemaForStudent([k], "e1", MAN_VINTER)), null);
  });
});

describe("klass utan schema: grinden är exakt som i dag", () => {
  const RUTTER = [
    ["/elev/plugga"], ["/elev/omrade", "subj=so&area=vik"], ["/elev/omrade", "subj=no&area=x"], ["/elev/spela", "subj=so&area=vik"],
    ["/elev/lasresan"], ["/elev/brakresan"], ["/elev/schack"], ["/elev/matchdagen"], ["/elev/mattematchen"],
    ["/elev/hus"], ["/elev/shop"], ["/elev/profil"], ["/elev/prov"], ["/elev/live"], ["/elev/avatar"],
  ];
  const bild = (g) => g && {
    home: g.home, label: g.label, klockslag: g.klockslag, fri: g.fri, lock: g.lock,
    rutter: RUTTER.map(([p, s]) => [p, s || "", g.allows(p, q(s || "")), g.isTarget(p, q(s || ""))]),
    omraden: [["so", "vik"], ["no", "x"]].map(([s, a]) => g.allowsArea(s, a)),
  };
  const LAS = [
    null,
    { mal: { typ: "omrade", id: "so/vik", namn: "Vikingatiden" }, till: MAN_VINTER + 30 * MIN, doljOvrigt: false },
    { mal: { typ: "lasresan" }, till: MAN_VINTER + 30 * MIN, doljOvrigt: true },
  ];
  const UTAN = [undefined, null, {}, { pa: false, lektioner: [L()] }, { pa: true, lektioner: [] }, "trasigt",
    { pa: true, lektioner: [L({ dag: 2 })] }];
  it("schemaForStudent = null och kombineradGrind = gateFor(lås) för alla former utan aktiv lektion", () => {
    for (const lock of LAS) {
      for (const schema of UTAN) {
        const k = klass(schema, lock ? { lock } : {});
        const now = MAN_VINTER + 5 * MIN;
        assert.equal(schemaForStudent([k], "e1", now), null);
        const las = lockForStudent([k], "e1", now);
        assert.deepEqual(bild(kombineradGrind(las, schemaForStudent([k], "e1", now))), bild(gateFor(las)),
          `${JSON.stringify(schema)} / ${lock?.mal.typ ?? "inget lås"}`);
      }
    }
    assert.equal(kombineradGrind(null, null), null);
    assert.equal(gateForSchema(null), null);
  });
});

describe("speglingen mot firestore.rules och bootgrafen", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  it("validSchemaKoppling har exakt registrets kopplingsnycklar", () => {
    const fn = rules.slice(rules.indexOf("function validSchemaKoppling"));
    const lista = fn.match(/hasOnly\(\[([^\]]*)\]\)/)[1];
    const iRegler = [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(iRegler.sort(), [...KOPPLING_NYCKLAR].sort());
    for (const k of KOPPLING_NYCKLAR) assert.ok(fn.includes(`schemaAmneOk(k, '${k}')`), `värdet för ${k} prövas`);
  });
  it("taket på lektioner är detsamma, och schema är skrivbart för årskurskontot", () => {
    const fn = rules.slice(rules.indexOf("function validSchemaShape"), rules.indexOf("function validSchemaKoppling"));
    assert.match(fn, new RegExp(`s\\.lektioner\\.size\\(\\) <= ${SCHEMA_MAX_LEKTIONER}\\b`));
    assert.match(rules, /'lock',\s*'schema',/);
    assert.match(rules, /validLock\(\) && validSchema\(\)/);
  });
  it("klass-schema.js ligger inte i den statiska bootgrafen (#271)", () => {
    const graf = execFileSync(process.execPath, ["admin/qa-bootgraf-bfs.mjs"], { encoding: "utf8" }).split("\n").filter(Boolean);
    assert.ok(graf.length > 50, "bootgrafen hittades");
    assert.ok(!graf.some((f) => f.includes("klass-schema")), "klass-schema*.js nås bara med import()");
  });
});
