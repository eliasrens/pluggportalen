// ============================================================================
// Meteorstormen (#820): reglerna runt motorn – per elev, hjälpen, händelserna,
// attacker av/milda/vilda, slutet, renheten (delat/ delas med servern) och
// synken till functions/meteorstorm/. Ren node, ingen emulator (spec §10).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { simulera } from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import { buildResultat } from "../src/live/formats/meteorstorm/delat/ms-resultat.js";
import { kanAgera, effektPerTryck, energiEffekt, stormPlan } from "../src/live/formats/meteorstorm/delat/ms-agera.js";
import {
  SKOLD_TAK, HJALP_SKILLNAD, HJALP_SKOLD_FAKTOR, HJALP_DRAG_KOSTNAD, ATTACKER, STORRE, STEG_MS, MILLI,
  RENDER_FORDROJNING_MS, DRAG_STOPP_FORE_SLUT_MS, perElevMilli, SKOLD_KLASSVARV,
} from "../src/live/formats/meteorstorm/delat/ms-balans.js";
import { driftedFiles, meteorstormFiles } from "../admin/sync-guldrush-functions.mjs";
import { spelaMatch } from "../admin/ms-balans-sim.mjs";
import { START, MIN10, cfg, enKlass, tryck, ensamMeteor, sista } from "./meteorstorm-hjalp.mjs";

/** Varje elev trycker 🛡️ och 🔫 om vartannat var 8:e s, eleverna jämnt utspridda över de 8 s. */
function klassLogg(classId, elever) {
  const ut = [];
  for (let e = 0; e < elever; e++) {
    for (let t = 2000 + Math.round((e * 8000) / elever / STEG_MS) * STEG_MS, i = 0; t < MIN10; t += 8000, i++) {
      ut.push({ id: `${classId}-${e}-${i}`, t: START + t, classId, uid: `${classId}${e}`, typ: i % 2 ? "laser" : "skold" });
    }
  }
  return ut;
}

describe("Meteorstormen – per elev", () => {
  it("formeln: effekt per tryck = KLASSVARV / aktiva (en 'klassrunda' ger lika mycket)", () => {
    for (const n of [12, 19, 23, 25, 31]) {
      const e = effektPerTryck(cfg({ stationer: [{ classId: "x", aktiva: n }] }), "x");
      assert.ok(Math.abs(e.skold * n - SKOLD_KLASSVARV) < n / MILLI, `${n} elever`);
    }
    assert.equal(perElevMilli(10, 0), 10 * MILLI, "minst 1 aktiv");
  });

  it("två klasser med olika storlek och samma andel rätt får samma utfall", () => {
    const c = cfg({
      stationer: [{ classId: "4B", aktiva: 19 }, { classId: "4D", aktiva: 23 }],
      installningar: { lage: "klass-mot-klass", attacker: "av" },
      handlingar: [...klassLogg("4B", 19), ...klassLogg("4D", 23)],
    });
    const s = simulera(c, START + MIN10);
    const [a, b] = s.stationer;
    assert.ok(Math.abs(a.skrov - b.skrov) <= 1, `skrov ${a.skrov} / ${b.skrov}`);
    assert.ok(Math.abs(a.nedskjutna - b.nedskjutna) <= 1, `nedskjutna ${a.nedskjutna} / ${b.nedskjutna}`);
  });

  it("balanssimuleringen: 19 och 25 elever med 60 % rätt hamnar lika (medel över frön)", () => {
    const k = (elever) => [{ classId: "A", elever, andelRatt: 0.6, takt: 8, strategi: "blandar" }];
    let a = 0;
    let b = 0;
    for (let i = 0; i < 6; i++) {
      a += spelaMatch({ seed: `pe-${i}`, klasser: k(19) }).tillstand.stationer[0].skrov;
      b += spelaMatch({ seed: `pe-${i}`, klasser: k(25) }).tillstand.stationer[0].skrov;
    }
    assert.ok(Math.abs(a - b) / 6 < 10, `${a / 6} / ${b / 6}`);
  });
});

describe("Meteorstormen – hjälp till den som ligger efter", () => {
  it("slår på vid 20 i skillnad (drag 2, sköld +25 %) och av igen när skillnaden är mindre", () => {
    const fyll = Math.ceil(SKOLD_TAK / effektPerTryck(cfg(), "4B").skold);
    const c = cfg({ seed: "hjalp", handlingar: tryck(fyll, 1000, "4B", "skold") });
    let t = 0;
    let s;
    do { t += 1000; s = simulera(c, START + t); } while (!s.stationer[1].hjalp && t < MIN10);
    assert.ok(s.stationer[1].hjalp, "4D får hjälp");
    assert.ok(s.stationer[0].skrov - s.stationer[1].skrov >= HJALP_SKILLNAD);
    assert.equal(s.stationer[0].hjalp, false);
    assert.equal(s.stationer[1].drag.kostnad, HJALP_DRAG_KOSTNAD);
    assert.equal(s.stationer[0].drag.kostnad, ATTACKER.milda.kostnad);
    // Steget innan: skillnaden < 20 och ingen hjälp.
    const fore = simulera(c, START + t - 1000);
    assert.ok(fore.stationer[0].skrov - fore.stationer[1].skrov < HJALP_SKILLNAD);
    // Ett sköldtryck ger +25 %.
    const t1 = t;
    const tryck1 = { id: "zz", t: START + t1, classId: "4D", typ: "skold" };
    const med = simulera({ ...c, handlingar: [...c.handlingar, tryck1] }, START + t1 + STEG_MS).stationer[1].skold;
    const utan = simulera(c, START + t1 + STEG_MS).stationer[1].skold;
    assert.equal(Math.round((med - utan) * MILLI), Math.round(effektPerTryck(c, "4D").skold * MILLI * HJALP_SKOLD_FAKTOR));
    // 4D bygger sköld, 4B gör ingenting mer → skillnaden krymper och hjälpen slås av.
    const c2 = { ...c, handlingar: [...c.handlingar, ...tryck(fyll * 3, t1, "4D", "skold", "4D-fyll")] };
    let t2 = t1;
    do { t2 += 1000; s = simulera(c2, START + t2); } while (s.stationer[1].hjalp && t2 < MIN10);
    assert.equal(s.stationer[1].hjalp, false, "hjälpen slogs av");
    assert.ok(s.stationer[0].skrov - s.stationer[1].skrov < HJALP_SKILLNAD);
    assert.ok(s.logg.some((l) => l.typ === "hjalp" && l.classId === "4D"));
    assert.ok(s.logg.some((l) => l.typ === "hjalp-slut" && l.classId === "4D"));
  });

  it("ingen hjälp i läget En klass", () => {
    const s = simulera(enKlass({ seed: "hjalp" }), START + MIN10);
    assert.ok(!s.logg.some((l) => l.typ === "hjalp"));
  });
});

describe("Meteorstormen – händelser", () => {
  const plan = stormPlan(cfg());
  const forsta = (typ) => plan.handelser.find((h) => h.typ === typ);

  it("alla fyra händelser kommer, högst en i taget, ungefär en per 90 s", () => {
    assert.deepEqual([...new Set(plan.handelser.map((h) => h.typ))].sort(), ["jattemeteor", "kometsvans", "lugnet", "solstorm"]);
    for (let i = 1; i < plan.handelser.length; i++) assert.ok(plan.handelser[i].startMs >= plan.handelser[i - 1].slutMs, "ingen överlappning");
    for (let s = 0; s < 30; s++) {
      const n = stormPlan(cfg({ seed: `h-${s}` })).handelser.length;
      assert.ok(n >= 4 && n <= 7, `${n} händelser på 10 min`);
    }
  });

  it("Solstorm: dubbel energi i 20 s; Kometsvans: +1 i 10 s; annars 1", () => {
    const sol = forsta("solstorm");
    const kom = forsta("kometsvans");
    assert.equal(sol.slutMs - sol.startMs, 20_000);
    assert.equal(kom.slutMs - kom.startMs, 10_000);
    assert.deepEqual(energiEffekt(cfg(), START + sol.startMs + 5000), { faktor: 2, bonus: 0, energi: 2, handelse: "solstorm" });
    assert.deepEqual(energiEffekt(cfg(), START + kom.startMs), { faktor: 1, bonus: 1, energi: 2, handelse: "kometsvans" });
    assert.equal(energiEffekt(cfg(), START + sol.slutMs).energi, 1, "slutet är exklusivt");
    assert.equal(energiEffekt(cfg(), START - 1).energi, 1);
  });

  it("Lugnet: inga nya meteorer i 15 s", () => {
    const l = forsta("lugnet");
    assert.equal(l.slutMs - l.startMs, 15_000);
    assert.ok(!plan.meteorer.some((m) => !m.jatte && m.spawnMs >= l.startMs && m.spawnMs < l.slutMs));
  });

  it("Jättemeteor: mot alla stationer, 30 skada – eller nedskjuten med 6 skott", () => {
    const j = forsta("jattemeteor");
    const m = plan.meteorer.find((x) => x.jatte);
    assert.deepEqual([m.spawnMs, m.ankomstMs, m.storlek], [j.startMs, j.slutMs, "jatte"]);
    const utan = simulera(cfg(), START + j.slutMs);
    const nedslag = utan.logg.filter((l) => l.jatte && l.t === START + j.slutMs);
    assert.deepEqual(nedslag.map((l) => l.classId).sort(), ["4B", "4D"]);
    for (const l of nedslag) {
      const kvar = utan.stationer.find((x) => x.classId === l.classId).skrov;
      assert.ok(l.typ === "flyter" || l.skold + l.skrov === 30 || kvar === 0, "30 skada (eller allt som fanns kvar)");
    }
    const full = Math.ceil(10 / effektPerTryck(cfg(), "4B").laser);
    const med = simulera(cfg({ handlingar: [...tryck(full, j.startMs - 100, "4B", "laser"), ...tryck(full, j.startMs + 4000, "4B", "laser", "b")] }), START + j.slutMs);
    assert.ok(med.logg.some((l) => l.typ === "nedskjuten" && l.jatte && l.classId === "4B"));
    assert.ok(!med.logg.some((l) => l.jatte && l.classId === "4B" && l.typ !== "nedskjuten"));
  });

  it("ingen jättemeteor de första 2,5 minuterna och inga händelser i finalen", () => {
    for (let s = 0; s < 40; s++) {
      const p = stormPlan(cfg({ seed: `j-${s}` }));
      for (const h of p.handelser) {
        if (h.typ === "jattemeteor") assert.ok(h.startMs >= 150_000);
        assert.ok(h.slutMs <= MIN10 * 0.78);
      }
    }
  });
});

describe("Meteorstormen – attacker och läge", () => {
  const { seed, m } = ensamMeteor((x) => x.storlek === "liten");
  const t0 = m.spawnMs + 1000;

  it("Attacker av och läget En klass: ingen dragstråle", () => {
    for (const c of [cfg({ seed, installningar: { lage: "klass-mot-klass", attacker: "av" } }), enKlass({ seed })]) {
      const s = simulera({ ...c, handlingar: tryck(1, t0, "4B", "drag") }, START + t0 + 1000);
      assert.equal(s.stationer[0].kastade, 0);
      assert.equal(s.stationer[0].drag.tillaten, false);
      assert.equal(kanAgera(c, START + t0, "4B", "drag").orsak, "av");
    }
  });

  it("Vilda: kostar 2, väntetid 6 s och slungade meteorer blir en storlek större", () => {
    const c = cfg({ seed, installningar: { lage: "klass-mot-klass", attacker: "vilda" }, handlingar: tryck(1, t0, "4B", "drag") });
    const s = simulera(c, START + t0 + 1000);
    assert.equal(s.stationer[0].drag.kostnad, 2);
    assert.equal(s.stationer[0].drag.redoMs - sista(s.logg, (l) => l.typ === "kast").t, ATTACKER.vilda.vantetidMs);
    assert.equal(s.meteorer.find((x) => x.kastadAv).storlek, STORRE.liten);
    assert.equal(kanAgera(c, START + t0 + 5900, "4B", "drag").orsak, "vantetid");
    assert.equal(kanAgera(c, START + t0 + 6100, "4B", "drag").ok, true);
    const milda = simulera(cfg({ seed, handlingar: tryck(1, t0, "4B", "drag") }), START + t0 + 1000);
    assert.equal(milda.meteorer.find((x) => x.kastadAv).storlek, "liten");
    assert.equal(milda.stationer[0].drag.kostnad, 3);
  });

  it("ingen dragstråle de sista sekunderna (en slungad meteor ska hinna fram)", () => {
    const sent = MIN10 - DRAG_STOPP_FORE_SLUT_MS;
    assert.equal(kanAgera(cfg(), START + sent, "4B", "drag").orsak, "tid");
    assert.equal(kanAgera(cfg(), START + sent - 50, "4B", "drag").ok, true, "tillämpas precis vid gränsen");
    assert.equal(kanAgera(cfg(), START + MIN10, "4B", "skold").orsak, "tid");
    assert.deepEqual(kanAgera(cfg(), START + 1000, "4B", "laser"), { ok: true, kostnad: 1 });
    assert.equal(kanAgera(cfg(), START + 1000, "5C", "laser").orsak, "klass");
  });
});

describe("Meteorstormen – slutet", () => {
  const st = (classId, skrov, nedskjutna) => ({ classId, skrov, nedskjutna });

  it("Klass mot klass: mest skrov vinner, lika → flest nedskjutna, lika → oavgjort", () => {
    assert.equal(buildResultat([st("4B", 40, 3), st("4D", 55, 1)], "klass-mot-klass").vinnare, "4D");
    assert.equal(buildResultat([st("4B", 40, 3), st("4D", 40, 1)], "klass-mot-klass").vinnare, "4B");
    const lika = buildResultat([st("4B", 40, 3), st("4D", 40, 3)], "klass-mot-klass");
    assert.deepEqual([lika.vinnare, lika.oavgjort, lika.placering.map((p) => p.plats)], [null, true, [1, 1]]);
    const tre = buildResultat([st("A", 10, 0), st("B", 50, 0), st("C", 10, 0)], "klass-mot-klass");
    assert.deepEqual(tre.placering.map((p) => [p.classId, p.plats]), [["B", 1], ["A", 2], ["C", 2]]);
  });

  it("En klass: ⭐ med skrovet kvar, ⭐⭐ ≥ 50, ⭐⭐⭐ ≥ 80", () => {
    const stj = (skrov) => buildResultat([st("4B", skrov, 0)], "en-klass").stjarnor;
    assert.deepEqual([0, 0.4, 1, 49.9, 50, 79.9, 80, 100].map(stj), [0, 1, 1, 1, 2, 2, 3, 3]);
    assert.equal(buildResultat([st("4B", 0, 0)], "en-klass").overlevde, false);
  });

  it("resultat först när tiden är ute; vid 0 i skrov flyter stationen och kan inte ta mer skada men skjuter", () => {
    const c = enKlass({ seed: "flyt" });
    assert.equal(simulera(c, START + MIN10 - STEG_MS).resultat, undefined);
    const s = simulera(c, START + MIN10);
    assert.ok(s.klart);
    const noll = s.stationer[0].nollVidMs;
    assert.ok(noll !== null && noll < START + MIN10, "utan försvar går skrovet till 0");
    assert.equal(s.resultat.stjarnor, 0);
    assert.ok(s.logg.some((l) => l.typ === "flyter" && l.t > noll));
    assert.ok(!s.logg.some((l) => l.typ === "traff" && l.t > noll));
    const efter = noll - START + 1000;
    const lp = effektPerTryck(c, "4B").laser;
    const skjut = simulera({ ...c, handlingar: tryck(Math.ceil(10 / lp), efter, "4B", "laser") }, START + MIN10);
    assert.ok(skjut.stationer[0].nedskjutna > s.stationer[0].nedskjutna, "flytande station skjuter fortfarande");
    assert.equal(skjut.stationer[0].skrov, 0);
    // Klass mot klass, samma storm utan försvar → oavgjort.
    const kmk = simulera(cfg({ seed: "flyt" }), START + MIN10 + 5000);
    assert.equal(kmk.resultat.oavgjort, true);
  });
});

describe("Meteorstormen – delat/ är ren och synkad till functions/", () => {
  const DIR = new URL("../src/live/formats/meteorstorm/delat/", import.meta.url);
  const filer = readdirSync(DIR).filter((f) => f.endsWith(".js"));

  it("ingen DOM, ingen Firebase, ingen Math.random/Date.now – bara importer inom delat/", () => {
    for (const f of filer) {
      const src = readFileSync(new URL(f, DIR), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      assert.doesNotMatch(src, /Math\.random|Date\.now|new Date|performance\.|document\.|window\.|firebase|setTimeout|localStorage/, f);
      for (const [, imp] of src.matchAll(/from\s+"([^"]+)"/g)) assert.match(imp, /^\.\/ms-[a-z-]+\.js$/, `${f}: ${imp}`);
    }
  });

  it("functions/meteorstorm/ är en exakt kopia (npm run sync:meteorstorm)", () => {
    assert.deepEqual(meteorstormFiles(), filer.sort());
    assert.deepEqual(driftedFiles().filter((f) => f.startsWith("meteorstorm/")), []);
  });

  it("projektorns renderingsfördröjning finns i balansen (C)", () => {
    assert.ok(RENDER_FORDROJNING_MS >= 1000 && RENDER_FORDROJNING_MS <= 3000);
  });
});
