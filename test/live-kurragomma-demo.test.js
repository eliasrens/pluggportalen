// Kurragömma D (#839, spec §11.4, LIVE-FORMAT §8): det isolerade demot – en HEL match
// i node mot låtsasservern (kg-demo-server.js) med de riktiga reglerna och den lokala
// rörelsekanalen: 30 ansluter, KÖR!, startsökare, låsning, gömfasen → letfasen,
// fel svar → vissling-händelse UTAN namn/uid, leta → hittad → sökare, tystnadsregeln,
// "det finns alltid en sökare", alla hittade → result med rewards – och ingenting
// av det rör Firebase (modulen importerar inget sådant).
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createKgDemo } from "../src/live/formats/kurragomma/kg-demo.js";
import { skapaKgServer } from "../src/live/formats/kurragomma/kg-demo-server.js";
import { byggDemoResultat } from "../src/live/formats/kurragomma/kg-demo-resultat.js";
import { skapaLokalBuss } from "../src/live/formats/kurragomma/kg-kanal.js";
import { skapaPrng } from "../src/live/formats/kurragomma/delat/kg-prng.js";
import { TYSTNAD_MS, LADDNING_START, POANG } from "../src/live/formats/kurragomma/delat/kg-config.js";

const T0 = 1_800_000_000_000;
/** Placeringen bland dem som svarat (live-rewards rankByScore: lika poäng → samma plats). */
const placeringBland = (rader, uid) => { const sort = [...rader].sort((a, b) => b.poang - a.poang); const i = sort.findIndex((r) => r.uid === uid); return sort.findIndex((r) => r.poang === sort[i].poang) + 1; };
const demos = [];
after(() => demos.forEach((d) => d.destroy()));
function nyttDemo(opts = {}) {
  let t = T0;
  const d = createKgDemo({ now: () => t, minuter: 3, gomtid: 20, ...opts });
  d.klocka = (ms) => { t += ms; };
  demos.push(d);
  return d;
}

describe("demot: en hel match i minnet", () => {
  it("30 ansluter, KÖR! → gömfasen med startsökare, bussen får roll/status, projektorns st() ser fasen", async () => {
    const demo = nyttDemo();
    demo.join(30, 0);
    assert.equal(demo.st().players.length, 30);
    assert.equal(demo.st().phase, "lobby");
    await demo.gaTill(2);
    const s = demo.state();
    assert.equal(s.fas, "gom");
    assert.equal(s.status.fas, "gom");
    assert.equal(s.status.sokare, 3); // auto: 1 per påbörjat 10-tal
    assert.equal(s.status.gomda, 27);
    assert.equal(s.spelare.filter((p) => p.roll === "sokare").length, 3);
    assert.equal(demo.st().phase, "live");
    assert.equal(demo.st().session.kgFas, "gom");
    assert.ok(demo.st().session.kgGomSlut > T0);
  });

  it("gömfasen: robotarna låser nära föremål (status.lasta växer) – gömmare skriver aldrig pos", async () => {
    const demo = nyttDemo();
    demo.join(30, 0);
    await demo.gaTill(18);
    const s = demo.state();
    assert.ok(s.status.lasta >= 15, `låsta ${s.status.lasta}`);
    const pos = demo.buss.server.tillstand.pos;
    for (const p of s.spelare) if (p.roll === "gomd") assert.equal(pos[p.uid], undefined, `${p.uid} gömd med pos`);
    for (const [uid, sec] of Object.entries(s.secrets)) if (sec.gomd) assert.ok(sec.skydd >= 0 && sec.gomstalle?.namn, uid);
  });

  it("letfasen: olåsta placeras, startsökarna får laddningar, fel svar → vissling utan namn/uid, jag får raden", async () => {
    const demo = nyttDemo();
    demo.join(30, 0);
    await demo.gaTill(24); // gömtid 20 + LAS_MARGINAL
    const s = demo.state();
    assert.equal(s.fas, "leta");
    assert.equal(s.status.fas, "leta");
    assert.equal(s.status.lasta, 27, "alla gömda har ett gömställe (jag placerades)");
    const jag = s.spelare.find((p) => p.uid === "jag");
    assert.equal(jag.roll, "gomd");
    assert.equal(jag.harLast, true);
    for (const p of s.spelare) if (p.roll === "sokare") assert.ok(p.laddningar >= LADDNING_START);
    // jag svarar fel → vissling-händelse i bussen, aldrig namn/uid
    const sedda = [];
    demo.api.kanal({ sid: demo.session.id, uid: "projektor" }).paHandelse((h) => sedda.push(h));
    const svar = await demo.api.svara(demo.session.id, { attemptId: "jag_1", factorA: 3, factorB: 4, answer: "13" });
    assert.equal(svar.correct, false);
    assert.equal(svar.vissling, true);
    assert.ok(svar.plats);
    const v = sedda.filter((h) => h.typ === "vissling").pop();
    assert.ok(v, "visslingen nådde bussen");
    assert.equal(v.namn, undefined);
    assert.equal(v.uid, undefined);
    assert.ok(Number.isFinite(v.x) && Number.isFinite(v.z));
    // rätt svar → poäng, ingen vissling; samma attemptId igen → igen
    const r2 = await demo.api.svara(demo.session.id, { attemptId: "jag_2", factorA: 3, factorB: 4, answer: "12" });
    assert.equal(r2.correct, true);
    assert.equal(r2.poang, POANG.ratt);
    assert.equal(r2.vissling, false);
    assert.equal((await demo.api.svara(demo.session.id, { attemptId: "jag_2", factorA: 3, factorB: 4, answer: "12" })).igen, true);
  });

  it("leta: hittad blir sökare (watchMe ser rollbytet med hittadAvNamn), händelsen bär sökarens namn, poäng till sökaren", async () => {
    const demo = nyttDemo({ jagSokare: true });
    demo.join(30, 0);
    await demo.gaTill(25);
    const sid = demo.session.id;
    const jag = demo.state().spelare.find((p) => p.uid === "jag");
    assert.equal(jag.roll, "sokare");
    const gomd = Object.entries(demo.state().secrets).find(([u, s]) => s.gomd && u !== "jag");
    const [offer, sec] = gomd;
    const sedd = [];
    demo.api.watchMe(sid, offer, (d) => sedd.push(d));
    const hand = [];
    demo.api.kanal({ sid, uid: "projektor" }).paHandelse((h) => hand.push(h));
    // rimlighetskontrollen: sökaren teleporterar inte dit – vi flyttar klockan så den kan ha gått
    demo.klocka(60_000);
    const r = await demo.api.leta(sid, { x: sec.x, z: sec.z });
    assert.ok(r.hittade.some((h) => h.uid === offer), "hittade");
    assert.equal(r.laddningar, jag.laddningar - 1);
    assert.equal(r.poang, jag.poang + POANG.hittade * r.hittade.length);
    await new Promise((res) => setTimeout(res, 5));
    const efter = demo.state().spelare.find((p) => p.uid === offer);
    assert.equal(efter.roll, "sokare");
    assert.equal(efter.hittadAvNamn, "Jag");
    assert.equal(efter.laddningar, LADDNING_START);
    assert.ok(sedd.some((d) => d?.roll === "sokare"), "watchMe såg rollbytet");
    const h = hand.find((x) => x.typ === "hittad" && x.x === sec.x);
    assert.ok(h);
    assert.equal(h.namn, "Jag");
    assert.ok(demo.buss.server.tillstand.pos[offer], "den nya sökaren fick en pos");
    assert.equal(demo.buss.server.tillstand.roll[offer], "sokare");
    // rätt svar laddar lampan (+1); 2 s spärren mellan två sökningar
    assert.equal((await demo.api.svara(sid, { attemptId: "jag_s1", factorA: 2, factorB: 5, answer: "10" })).laddningar, r.laddningar + 1);
    await assert.rejects(demo.api.leta(sid, { x: sec.x, z: sec.z }), (e) => e.details?.skal === "sparr");
  });

  it("tystnadsregeln (demoknappen) visslar i nästa tick, 'sökarna borta' drar en ny sökare", async () => {
    const demo = nyttDemo();
    demo.join(30, 0);
    await demo.gaTill(25);
    const hand = [];
    demo.api.kanal({ sid: demo.session.id, uid: "projektor" }).paHandelse((h) => hand.push(h));
    const n0 = hand.filter((h) => h.typ === "vissling").length;
    const uid = await demo.tystnad();
    assert.ok(uid);
    const v = hand.filter((h) => h.typ === "vissling");
    assert.equal(v.length, n0 + 1);
    assert.equal(v.at(-1).namn, undefined);
    assert.ok(demo.state().events.some((e) => e.typ === "vissling" && e.tyst));
    // N3: den egna kgPlayers-referensen (tystRef = visslingens t) når watchMe så elevskärmen känner igen sin vissling
    const sedda = [];
    demo.api.watchMe(demo.session.id, uid, (d) => sedda.push(d));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(sedda.at(-1)?.tystRef, v.at(-1).t, "kgPlayers.tystRef = hand-visslingens t");
    const sokareFore = demo.state().spelare.filter((p) => p.roll === "sokare").length;
    await demo.sokareBorta(true);
    const ny = hand.find((h) => h.typ === "nySokare");
    assert.ok(ny, "nySokare-händelse");
    assert.equal(demo.state().spelare.filter((p) => p.roll === "sokare").length, sokareFore + 1);
    demo.robotar.borta(false);
  });

  it("alla hittade → matchen slut: result som servern (ranking, gomstallen, rewards), 'Sökarna hittade alla!'", async () => {
    const demo = nyttDemo({ jagSokare: true });
    demo.join(30, 0);
    await demo.gaTill(25);
    const h = await demo.allaHittade();
    assert.ok(h.length >= 25);
    const st = demo.st();
    assert.equal(st.phase, "finished");
    const r = st.result;
    assert.equal(r.format, "kurragomma");
    assert.equal(r.klaradeSig, 0);
    assert.equal(r.demo, true);
    assert.equal(r.ranking.length, 30);
    assert.equal(r.ranking[0].rank, 1);
    assert.equal(r.gomstallen.length, 27, "alla gömmare (3 startsökare har inget gömställe)");
    assert.ok(r.gomstallen.every((g) => g.hittad === true));
    assert.ok(r.rewards, "rewards räknas (demot betalar ändå aldrig – session.demo)");
    assert.equal(r.rewards.jag, undefined, "jag svarade aldrig – ingen belöning (live-rewards: bara den som svarat)");
    const svarat = r.ranking.find((p) => p.besvarade > 0);
    assert.ok(r.rewards[svarat.uid]?.total > 0);
    assert.equal(r.rewards[svarat.uid].rank, placeringBland(r.ranking.filter((p) => p.besvarade > 0), svarat.uid));
    assert.ok(r.flestHittade && r.flestHittade.uid !== "jag" && r.flestHittade.antal >= 25, "en robot-sökare hittar alla (F10), inte Jag");
    assert.equal(st.session.status, "finished");
    assert.equal(demo.session.demo, true);
  });

  it("tiden ute → kgTick avslutar: gömda får överlevnad + 50, 'N av 30 klarade sig', jumpToFinal idempotent", async () => {
    const demo = nyttDemo();
    demo.join(30, 0);
    await demo.jumpToFinal();
    const r = demo.st().result;
    assert.ok(r);
    assert.ok(r.klaradeSig > 0 && r.klaradeSig < 30, `klarade sig ${r.klaradeSig}`);
    const gomd = r.ranking.find((p) => p.klaradeSig);
    assert.ok(gomd.poang >= POANG.gomdVidSlut);
    const igen = await demo.deps.finish();
    assert.equal(igen.redan, true);
    assert.equal(igen.result, r);
  });

  it("projektorns deps: subscribe ger live-feed-form, starta/tick är idempotenta, remove rör inget", async () => {
    const demo = nyttDemo();
    demo.join(5, 0);
    const sedda = [];
    const av = demo.deps.subscribe(demo.session.id, (s) => sedda.push(s));
    assert.equal(sedda.length, 1);
    assert.deepEqual(Object.keys(sedda[0]).sort(), ["classes", "clock", "countdown", "draw", "leaderIds", "msLeft", "now", "phase", "players", "result", "session", "sessionId", "status", "top", "totalCorrect", "winnerId"].sort());
    await demo.deps.start();
    assert.equal(demo.session.status, "live");
    demo.klocka(5000);
    await demo.deps.kurragomma.starta(demo.session.id);
    await demo.deps.kurragomma.starta(demo.session.id);
    assert.equal(demo.state().fas, "gom");
    const t1 = await demo.deps.kurragomma.tick(demo.session.id);
    assert.equal(t1.klart, false);
    await demo.deps.remove();
    av();
  });
});

describe("låtsasservern och resultatet (rena delar)", () => {
  it("svara under gömfasen nekas för gömmare, anslut utan att vara med nekas, leta kräver letfasen", async () => {
    let t = T0;
    const session = { id: "s", status: "live", startedAt: T0, countdownSeconds: 0, durationSeconds: 200, showNames: true, kgInstallningar: { gomtid: 20 } };
    const buss = skapaLokalBuss({ nu: () => t });
    const server = skapaKgServer({ session, buss, now: () => t, rng: skapaPrng(1).tal, tvingaSokare: ["s1"] });
    for (const uid of ["s1", "g1", "g2"]) server.laggTill({ uid, name: uid.toUpperCase(), classId: "4b" });
    await server.starta();
    assert.equal((await server.anslut("g1")).roll, "gomd");
    assert.equal((await server.anslut("s1")).roll, "sokare");
    await assert.rejects(server.anslut("okand"), (e) => e.code === "permission-denied");
    await assert.rejects(server.svara("g1", { attemptId: "a", factorA: 2, factorB: 2, answer: "4" }), (e) => /gömfasen/i.test(e.message));
    await assert.rejects(server.leta("s1", { x: 1, z: 1 }), (e) => /blundar/i.test(e.message));
    const las = await server.las("g1", { x: 0, z: 0 });
    assert.ok(las.gomstalle.namn);
    assert.equal((await server.las("g1", { x: 5, z: 5 })).redan, true);
    t += 25_000;
    await assert.rejects(server.las("g2", { x: 0, z: 0 }), (e) => /slut/i.test(e.message));
    await server.tick();
    assert.equal(server.state().fas, "leta");
    assert.equal(server.state().spelare.find((p) => p.uid === "g2").harLast, true, "placerad automatiskt");
    assert.equal(buss.server.tillstand.status.lasta, 2);
    // namn av → händelserna bär inga namn
    session.showNames = false;
    const hand = [];
    buss.kanalFor("p").paHandelse((h) => hand.push(h));
    server.hittaNu(["g1"], "s1");
    assert.equal(hand.at(-1).typ, "hittad");
    assert.equal(hand.at(-1).namn, null);
    assert.equal(hand.at(-1).hittad, null);
  });

  it("byggDemoResultat: placering delad, gömställen avslöjas först nu, rewards bara när sessionen har belöningar", () => {
    const spelare = [
      { uid: "a", name: "A", classId: "4b", roll: "gomd", poang: 20, ratt: 2, besvarade: 3, hittade: 0 },
      { uid: "b", name: "B", classId: "4b", roll: "sokare", poang: 70, ratt: 3, besvarade: 3, hittade: 1 },
      { uid: "c", name: "C", classId: "4b", roll: "sokare", poang: 70, ratt: 1, besvarade: 1, hittade: 0 },
    ];
    const secrets = new Map([["a", { x: 1, z: 2, skydd: 2, gomd: true }], ["c", { x: -3, z: 4, skydd: 1, gomd: false }]]);
    const t0 = 0, letStart = 20_000, slut = 80_000;
    const { result } = byggDemoResultat({ session: { rewards: { firstPrize: 100, perCorrect: 2, cap: 300 } }, spelare, secrets, events: [{ typ: "vissling" }], t0, letStart, slut });
    assert.equal(result.ranking.find((r) => r.uid === "a").poang, 20 + 6 * POANG.overlevnad + POANG.gomdVidSlut);
    assert.deepEqual(result.ranking.map((r) => [r.uid, r.rank]), [["a", 1], ["b", 2], ["c", 2]]);
    assert.deepEqual(result.gomstallen.map((g) => [g.uid, g.hittad]), [["a", false], ["c", true]]);
    assert.equal(result.klaradeSig, 1);
    assert.equal(result.hittade, 1);
    assert.equal(result.visslingar, 1);
    assert.equal(result.rewards.a.rank, 1);
    assert.equal(result.rewards.a.prize, 100);
    const utan = byggDemoResultat({ session: {}, spelare, secrets, t0, letStart, slut }).result;
    assert.equal(utan.rewards, undefined);
  });

  it("demot importerar inget Firebase och ingen DOM statiskt (isoleringen, LIVE-FORMAT §8)", () => {
    for (const f of ["kg-demo.js", "kg-demo-server.js", "kg-demo-robotar.js", "kg-demo-resultat.js"]) {
      const src = readFileSync(`src/live/formats/kurragomma/${f}`, "utf8");
      assert.ok(!/firebase|kurragomma-data\.js|document\.|window\./.test(src), f);
      assert.ok(src.split("\n").length <= 401, `${f} ≤ 400 rader`);
    }
  });
});
