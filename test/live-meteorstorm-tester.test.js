// ============================================================================
// Meteorstormen (#820): TESTARENS sviter – cachen mot en färsk motor (fuzz),
// spegelvänd storm med 3–4 stationer, regelkanter och kanAgera mot motorn.
// Ren node, ingen emulator. Kända fel är markerade { todo } med F-nummer
// (se testarens rapport på issue #820) så att sviten är grön tills de rättas.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { simulera, skapaMotor } from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import { kanAgera, energiEffekt, stormPlan } from "../src/live/formats/meteorstorm/delat/ms-agera.js";
import { skapaPrng } from "../src/live/formats/meteorstorm/delat/ms-prng.js";
import { SKOLD_TAK, LADDNING_TAK, HJALP_SKILLNAD, STEG_MS, DRAG_STOPP_FORE_SLUT_MS } from "../src/live/formats/meteorstorm/delat/ms-balans.js";

const START = 2_000_000;
const M5 = 300_000;
const bas = (over = {}) => ({
  seed: "testare", startMs: START, varaktighetMs: M5,
  stationer: [{ classId: "A", aktiva: 25 }, { classId: "B", aktiva: 20 }],
  installningar: { lage: "klass-mot-klass", attacker: "vilda" },
  handlingar: [],
  ...over,
});
const farsk = (c, h, t) => {
  const m = skapaMotor(c);
  m.satHandlingar(h);
  return m.tillstand(t);
};
const kärna = (s) => JSON.stringify({ st: s.stationer, met: s.meteorer, b: s.bidrag, l: s.logg });

/** Slumpade handlingar runt t0 (id i stigande ordning). */
function skur(r, nasta, t0, n, varaktighetMs = M5) {
  return Array.from({ length: n }, () => ({
    id: `h${String(nasta.id++).padStart(6, "0")}`,
    t: START + Math.min(varaktighetMs - 1, t0 + r.heltal(0, 3000)),
    classId: r.tal() < 0.5 ? "A" : "B",
    typ: ["skold", "laser", "drag", "laser"][r.heltal(0, 3)],
    uid: `u${r.heltal(0, 5)}`,
  }));
}

describe("Meteorstormen (testare) – cachen ger samma svar som en färsk motor", () => {
  it("F1: sen handling efter en tillbakaspolning – gamla kontrollpunkter återanvänds inte", {
    todo: "F1: satHandlingar/laggTill rensar inte kontrollpunkter efter den nya handlingens tid när den inte spolar tillbaka",
  }, () => {
    const c = bas({ stationer: [{ classId: "A", aktiva: 25 }], installningar: { lage: "en-klass" } });
    const sköld = Array.from({ length: 200 }, (_, i) => ({ id: `s${String(i).padStart(4, "0")}`, t: START + 20_000, classId: "A", typ: "skold", uid: "u" }));
    simulera({ ...c, handlingar: [] }, START + 60_000); // kontrollpunkter 5 s … 60 s utan handlingar
    simulera({ ...c, handlingar: [] }, START + 10_000); // spolar tillbaka till 10 s
    simulera({ ...c, handlingar: sköld }, START + 30_000); // handling vid 20 s > 10 s → ingen tillbakaspolning
    const fel = simulera({ ...c, handlingar: sköld }, START + 25_000); // återställer kontrollpunkten 25 s (utan sköld)
    assert.equal(fel.stationer[0].skold, farsk(c, sköld, START + 25_000).stationer[0].skold);
  });

  it("F1: projektormönstret (nu och nu − 1,5 s varannan gång, handlingar ~1 s sena)", {
    todo: "F1",
  }, () => {
    const c = bas();
    const m = skapaMotor(c);
    let h = [];
    let fel = 0;
    for (let nu = START + 2000, k = 0; nu < START + M5; nu += 700, k++) {
      if (k % 9 === 0) h = [...h, { id: `x${k}`, t: nu - 1000, classId: "A", typ: "skold", uid: "u" }];
      m.satHandlingar(h);
      m.tillstand(nu);
      const b = m.tillstand(nu - 1500);
      if (kärna(b) !== kärna(farsk(c, h, nu - 1500))) fel++;
    }
    assert.equal(fel, 0);
  });

  it("F1: fuzz – slumpade loggändringar och tider fram och tillbaka (satHandlingar, simulera, laggTill)", {
    todo: "F1",
  }, () => {
    const fel = [];
    for (let run = 0; run < 45; run++) {
      const r = skapaPrng(`fuzz-${run}`, "test");
      const c = bas();
      const lage = run % 3; // 0 = simulera, 1 = satHandlingar, 2 = laggTill
      const m = skapaMotor(c);
      const nasta = { id: 0 };
      let h = [];
      for (let op = 0; op < 40; op++) {
        const x = r.tal();
        if (x < 0.4) {
          const ny = skur(r, nasta, r.heltal(0, M5), r.heltal(1, 20));
          h = [...h, ...ny];
          if (lage === 2) for (const n of ny) m.laggTill(n);
        } else if (x < 0.5 && lage !== 2) {
          h = h.filter(() => r.tal() < 0.9);
        }
        const t = START + r.heltal(0, M5);
        const s = lage === 0 ? simulera({ ...c, handlingar: h }, t) : (lage === 1 && m.satHandlingar(h), m.tillstand(t));
        if (kärna(s) !== kärna(farsk(c, h, t))) { fel.push({ run, op, t: t - START }); break; }
      }
    }
    assert.deepEqual(fel, []);
  });

  it("fuzz utan tillbakaspolning (tiden går bara framåt) är redan rätt", () => {
    for (let run = 0; run < 15; run++) {
      const r = skapaPrng(`fram-${run}`, "test");
      const c = bas();
      const m = skapaMotor(c);
      const nasta = { id: 0 };
      let h = [];
      let t = START;
      while (t < START + M5) {
        t += r.heltal(100, 9000);
        h = [...h, ...skur(r, nasta, t - START - 2500, r.heltal(0, 6))]; // sena handlingar, före t
        m.satHandlingar(h);
        assert.equal(kärna(m.tillstand(t)), kärna(farsk(c, h, t)), `run ${run}, t=${t - START}`);
      }
    }
  });
});

describe("Meteorstormen (testare) – indata", () => {
  it("F2: handlingar med samma t och samma (eller saknat) id – utfallet beror på indataordningen", {
    todo: "F2: jamforHandling har ingen sista nyckel (uid/typ) – servern måste alltid ge unika id",
  }, () => {
    const a = { t: START + 5000, classId: "A", typ: "laser", uid: "anna" };
    const b = { t: START + 5000, classId: "A", typ: "laser", uid: "bo" };
    const c = bas({ stationer: [{ classId: "A", aktiva: 25 }], installningar: { lage: "en-klass" } });
    const x = Array(20).fill(a);
    const y = Array(20).fill(b);
    assert.deepEqual(farsk(c, [...x, ...y], START + M5).bidrag, farsk(c, [...y, ...x], START + M5).bidrag);
  });

  it("F3: en handling som byts ut på plats i samma lista (samma längd) syns inte", {
    todo: "F3: satHandlingar hoppar över när lista === senasteLista och längden är densamma",
  }, () => {
    const c = bas();
    const h = [{ id: "a", t: START + 5000, classId: "A", typ: "skold", uid: "u" }];
    simulera({ ...c, handlingar: h }, START + 10_000);
    h[0] = { ...h[0], typ: "laser" };
    assert.equal(simulera({ ...c, handlingar: h }, START + 10_000).stationer[0].skold, 0);
  });

  it("handlingar före start tillämpas i första steget (kanAgera nekar dem – servern skriver aldrig sådana)", () => {
    const c = bas();
    const h = [{ id: "a", t: START - 60_000, classId: "A", typ: "skold", uid: "u" }];
    assert.equal(farsk(c, h, START + STEG_MS).stationer[0].skold, 0.64);
    assert.equal(kanAgera(c, START - 1, "A", "skold").orsak, "tid");
  });
});

describe("Meteorstormen (testare) – spegelvänd storm", () => {
  for (const n of [1, 2, 3, 4]) {
    it(`${n} stationer utan handlingar: samma skada, samma nedslagstider, olika aktiva spelar ingen roll`, () => {
      for (const seed of ["s1", 77, "jätte"]) {
        const stationer = Array.from({ length: n }, (_, i) => ({ classId: `K${i}`, aktiva: 10 + 7 * i }));
        const s = farsk(bas({ seed, stationer, installningar: { lage: n > 1 ? "klass-mot-klass" : "en-klass", attacker: "milda" } }), [], START + M5);
        const tr = (cid) => s.logg.filter((p) => p.classId === cid && (p.typ === "traff" || p.typ === "flyter")).map((p) => `${p.t}:${p.storlek}`);
        for (const st of s.stationer) {
          assert.equal(st.skrov, s.stationer[0].skrov);
          assert.deepEqual(tr(st.classId), tr("K0"));
        }
      }
    });
  }

  it("spegelvända handlingar (samma tryck i båda klasserna) → identiska stationer, även med dragstråle", () => {
    const r = skapaPrng("spegel", "test");
    const h = [];
    for (let i = 0; i < 400; i++) {
      const t = START + r.heltal(0, M5 - 1);
      const typ = ["skold", "laser", "drag"][r.heltal(0, 2)];
      for (const classId of ["A", "B"]) h.push({ id: `${String(i).padStart(4, "0")}${classId}`, t, classId, typ, uid: `${classId}${i % 7}` });
    }
    for (const attacker of ["milda", "vilda", "av"]) {
      const c = bas({ stationer: [{ classId: "A", aktiva: 22 }, { classId: "B", aktiva: 22 }], installningar: { lage: "klass-mot-klass", attacker } });
      const s = farsk(c, h, START + M5);
      const [a, b] = s.stationer;
      for (const k of ["skrov", "skold", "laddning", "nedskjutna", "traffar", "kastade"]) assert.equal(a[k], b[k], `${attacker}: ${k}`);
      assert.equal(s.resultat.oavgjort, true, `${attacker}: lika → oavgjort`);
    }
  });
});

describe("Meteorstormen (testare) – regelkanter", () => {
  const enKlass = (over) => bas({ stationer: [{ classId: "A", aktiva: 1 }], installningar: { lage: "en-klass" }, ...over });

  it("skölden stannar på 60 och laddningen på 10, hur mycket man än trycker (1 aktiv elev)", () => {
    const h = [];
    for (let i = 0; i < 500; i++) h.push({ id: `s${String(i).padStart(4, "0")}`, t: START + 100, classId: "A", typ: i % 2 ? "skold" : "laser", uid: "u" });
    const s = farsk(enKlass(), h, START + 300);
    assert.equal(s.stationer[0].skold, SKOLD_TAK);
    assert.ok(s.stationer[0].laddning <= LADDNING_TAK);
    assert.equal(s.stationer[0].laddning, LADDNING_TAK);
  });

  it("skrovet går aldrig under 0, flyter-stationen tar ingen mer skada och ger 0 stjärnor", () => {
    const s = farsk(enKlass(), [], START + M5);
    assert.equal(s.stationer[0].skrov, 0);
    assert.equal(s.stationer[0].flyter, true);
    const efterNoll = s.logg.filter((p) => p.typ === "traff" && p.t > s.stationer[0].nollVidMs);
    assert.equal(efterNoll.length, 0);
    assert.equal(s.resultat.stjarnor, 0);
    assert.equal(s.resultat.overlevde, false);
  });

  it("jättemeteorn: 6 skott räcker precis, 5 gör att den slår ner med 30", () => {
    const plan = stormPlan({ seed: "jatte-sok", varaktighetMs: 600_000 });
    let hittad = null;
    for (let i = 0; i < 300 && !hittad; i++) {
      const p = stormPlan({ seed: `j${i}`, varaktighetMs: 600_000 });
      const j = p.meteorer.find((m) => m.jatte);
      if (!j) continue;
      // inga andra meteorer i luften under jättens färd
      const krock = p.meteorer.some((m) => !m.jatte && m.ankomstMs > j.spawnMs - 9000 && m.spawnMs < j.ankomstMs + 100);
      if (!krock) hittad = { seed: `j${i}`, j };
    }
    if (!hittad) return; // ingen ensam jätte i de här fröna – testas redan i regler-sviten
    void plan;
    const { seed, j } = hittad;
    const c = enKlass({ seed, varaktighetMs: 600_000 });
    const laser = (n) => Array.from({ length: n * 1 }, (_, i) => ({ id: `l${String(i).padStart(3, "0")}`, t: START + j.spawnMs, classId: "A", typ: "laser", uid: "u" }));
    const efter = START + j.ankomstMs + 100;
    const sex = farsk(c, laser(6), efter);
    const fem = farsk(c, laser(5), efter);
    assert.ok(sex.logg.some((p) => p.typ === "nedskjuten" && p.jatte));
    const slag = fem.logg.find((p) => p.jatte && (p.typ === "traff" || p.typ === "skold"));
    assert.ok(slag);
    assert.equal(slag.skold + slag.skrov, 30);
  });

  it("hjälpen: på vid exakt 20 i skillnad, av under 20 (bara Klass mot klass)", () => {
    const s = farsk(bas({ seed: "hjalp" }), [], START + M5);
    // spegelvänt utan handlingar → aldrig skillnad → aldrig hjälp
    assert.ok(!s.logg.some((p) => p.typ === "hjalp"));
    // A har full sköld tidigt, B ingenting → B ska få hjälp när skillnaden når 20
    const h = Array.from({ length: 200 }, (_, i) => ({ id: `a${String(i).padStart(4, "0")}`, t: START + 100, classId: "A", typ: "skold", uid: "u" }));
    const t = farsk(bas({ seed: "hjalp", installningar: { lage: "klass-mot-klass", attacker: "av" } }), h, START + M5);
    const pa = t.logg.find((p) => p.typ === "hjalp");
    assert.ok(pa, "hjälpen slogs på");
    assert.equal(pa.classId, "B");
    // vid tiden då hjälpen slogs på är skillnaden ≥ 20, steget innan < 20
    const fore = farsk(bas({ seed: "hjalp", installningar: { lage: "klass-mot-klass", attacker: "av" } }), h, pa.t - 1);
    const vid = farsk(bas({ seed: "hjalp", installningar: { lage: "klass-mot-klass", attacker: "av" } }), h, pa.t);
    assert.ok(fore.stationer[0].skrov - fore.stationer[1].skrov < HJALP_SKILLNAD);
    assert.ok(vid.stationer[0].skrov - vid.stationer[1].skrov >= HJALP_SKILLNAD);
  });

  it("kanAgera och motorn är överens om varje dragstråle (fuzz, alla attacker-lägen)", () => {
    for (const attacker of ["milda", "vilda", "av"]) {
      const c = bas({ seed: `drag-${attacker}`, installningar: { lage: "klass-mot-klass", attacker } });
      const r = skapaPrng(`drag-${attacker}`, "test");
      const h = [];
      let t = START;
      let id = 0;
      while (t < START + M5 + 2000) {
        t += r.heltal(1, 2500);
        const classId = r.tal() < 0.5 ? "A" : "B";
        const svar = kanAgera({ ...c, handlingar: h }, t, classId, "drag");
        if (svar.ok) h.push({ id: `d${String(id++).padStart(5, "0")}`, t, classId, typ: "drag", uid: classId });
        if (svar.orsak === "tid") assert.ok(t - START >= M5 - DRAG_STOPP_FORE_SLUT_MS - STEG_MS || t >= START + M5 || t < START);
      }
      const s = farsk(c, h, START + M5);
      const tillampade = s.stationer.reduce((n, st) => n + st.handlingar.drag, 0);
      assert.equal(tillampade, h.length, `${attacker}: varje godkänd drag tillämpas`);
      if (attacker === "av") assert.equal(h.length, 0);
    }
  });

  it("energiEffekt: Solstorm ×2 och Kometsvans +1 exakt inom händelsen, 1 utanför och efter slut", () => {
    const c = bas({ varaktighetMs: 600_000 });
    const { handelser } = stormPlan(c);
    for (const h of handelser) {
      const vid = energiEffekt(c, START + h.startMs).energi;
      const fore = energiEffekt(c, START + h.startMs - 1).energi;
      const sist = energiEffekt(c, START + h.slutMs - 1).energi;
      const efter = energiEffekt(c, START + h.slutMs).energi;
      const vant = h.typ === "solstorm" ? 2 : h.typ === "kometsvans" ? 2 : 1;
      assert.equal(vid, vant, h.typ);
      assert.equal(sist, vant, h.typ);
      assert.equal(fore, 1);
      assert.equal(efter, 1);
    }
    assert.equal(energiEffekt(c, START + 600_000).energi, 1);
  });

  it("händelser: aldrig två samtidigt, ~1 per 90 s, ingen efter 78 % – många frön och speltider", () => {
    for (const varaktighetMs of [300_000, 600_000, 1_200_000]) {
      for (let i = 0; i < 60; i++) {
        const { handelser, meteorer } = stormPlan({ seed: `h${i}`, varaktighetMs });
        for (let k = 1; k < handelser.length; k++) assert.ok(handelser[k].startMs >= handelser[k - 1].slutMs);
        for (const h of handelser) assert.ok(h.slutMs <= varaktighetMs * 0.78);
        for (const m of meteorer) assert.ok(m.ankomstMs <= varaktighetMs, "varje meteor landar före slutet");
        const lugn = handelser.filter((h) => h.typ === "lugnet");
        for (const l of lugn) assert.ok(!meteorer.some((m) => !m.jatte && m.spawnMs >= l.startMs && m.spawnMs < l.slutMs));
      }
    }
  });
});
