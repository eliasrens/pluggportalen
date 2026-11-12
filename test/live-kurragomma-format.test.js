// Kurragömma D (#839, spec §13.4): format-objektet och de RENA delarna av projektorn
// och elevskärmen – registreringen, sessionsdokumentet (durationSeconds = gömtid +
// speltid), avslutet (kgAvsluta + utbetalning bara med rewards, demo betalar aldrig),
// toppraden, händelseflödet (namn av → "Någon", visslingen aldrig med namn), finalen
// (exakt rubrik, pall utan tomma platser), lobbyns platser, elevens texter och lägen,
// sessionStorage för platsen, tangenterna, det riktade ljudet, och filkraven
// (≤ 400 rader, inga Emoji 13+, bootgrafen når inte scen/, kanalen eller DOM statiskt).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import KURRAGOMMA from "../src/live/formats/kurragomma/index.js";
import { getFormat, registerFormat, validateFormat, listFormats } from "../src/live/live-formats.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { buildSessionFields, validateSetup, computeStandings, sessionTitle, defaultSessionName, durationField } from "../src/live/formats/kurragomma/kg-setup.js";
import { avslutaOchBetala, buildResult, avslutaMedForsok, medPerClass } from "../src/live/formats/kurragomma/kg-avslut.js";
import {
  toppText, flodesRad, finalModell, lugnRad, lobbyPlatser, lobbyrutaSida, minutKvar, fasAv, gomKlocka, FINAL_TITLE, NAGON,
} from "../src/live/formats/kurragomma/kgp-logik.js";
import { visslingPan } from "../src/live/formats/kurragomma/kgp-ljud.js";
import {
  TEXT, elevLage, scenLage, gomdText, hittadText, blundText, nedrakning, laddningarHtml, skyddPrickSvg, startplats,
  sparaPos, lasPos, glomPos, posNyckel, letaTangent, panelLage, letaFel, mittenText, skapaEgenVisslingar,
} from "../src/live/formats/kurragomma/kge-logik.js";
import { slutRad, endHtml } from "../src/live/formats/kurragomma/kge-skarmar.js";
import { innanforOn } from "../src/live/formats/kurragomma/delat/kg-geometri.js";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { GOMTID_STANDARD_S, SPELTID_REKOMMENDERAD_MIN } from "../src/live/formats/kurragomma/delat/kg-config.js";

const MAPP = "src/live/formats/kurragomma";
const INPUT = { name: "Kurragömma 4B", gameMode: "multiplication_0_10", answerKind: "free", durationMin: 8, classIds: ["4b"], classNames: { "4b": "4B" }, format: "kurragomma", rewards: { firstPrize: 100, perCorrect: 2, cap: 300 } };

describe("format-objektet (spec §0.1)", () => {
  it("registrerat sist i BUILTIN_FORMATS, giltigt, inom-klass 1–1, free+choice, tidslinje, tid, musik, lata delar", async () => {
    await import("../src/live/formats/index.js");
    assert.equal(listFormats().at(-1).id, "kurragomma", "sist i BUILTIN_FORMATS");
    assert.equal(getFormat("kurragomma").displayName, "Kurragömma");
    assert.deepEqual(validateFormat(KURRAGOMMA), []);
    assert.equal(KURRAGOMMA.icon, "🙈");
    assert.equal(KURRAGOMMA.scope, "inom-klass");
    assert.deepEqual([KURRAGOMMA.minClasses, KURRAGOMMA.maxClasses], [1, 1]);
    assert.deepEqual(KURRAGOMMA.answerKinds, ["free", "choice"]);
    assert.equal(KURRAGOMMA.timelineQuestions, true);
    assert.equal(KURRAGOMMA.pacing, "tid");
    assert.equal(KURRAGOMMA.emitOnPlayers, true);
    assert.ok(KURRAGOMMA.music.src.endsWith("/assets/kurragomma-loop.ogg"));
    assert.equal(KURRAGOMMA.music.lobby, 0);
    for (const k of ["projectorViews", "studentView", "historyRenderer"]) assert.equal(typeof KURRAGOMMA[k], "function");
    assert.ok(KURRAGOMMA.compatibleGameModes({ id: "multiplication_0_10" }));
    assert.ok(KURRAGOMMA.compatibleGameModes({ id: "plugga_quiz", answerKinds: ["choice"] }));
    assert.ok(!KURRAGOMMA.compatibleGameModes({ id: "addition_0_20" }));
  });

  it("sessionen: durationSeconds = gömtid + speltid, kgInstallningar med standardvärden, 2 klasser nekas", () => {
    if (!getFormat("kurragomma")) registerFormat(KURRAGOMMA);
    const f = buildSessionFields(INPUT);
    assert.equal(f.durationSeconds, GOMTID_STANDARD_S + 8 * 60);
    assert.deepEqual(f.kgInstallningar, { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" });
    assert.equal(f.showNames, true);
    assert.equal(buildSessionFields({ ...INPUT, kgInstallningar: { gomtid: 60 }, showNames: false, durationMin: 61 }).durationSeconds, 60 + 60 * 60);
    const d = buildSessionDoc(INPUT, { uid: "larare1" });
    assert.equal(d.format, "kurragomma");
    assert.equal(d.durationSeconds, 30 + 480);
    assert.deepEqual(d.rewards, { firstPrize: 100, perCorrect: 2, cap: 300 });
    assert.deepEqual(validateSetup(INPUT), []);
    assert.ok(validateSetup({ ...INPUT, classIds: ["4b", "4d"] })[0].includes("en klass"));
    assert.ok(validateSetup({ ...INPUT, gameMode: "addition_0_20" }).length);
    assert.equal(durationField().default, 10);
    assert.ok(durationField().hint.includes(`${SPELTID_REKOMMENDERAD_MIN} min`));
    assert.equal(sessionTitle({ participatingClassIds: ["4b"], classNames: { "4b": "4b" } }), "4B");
    assert.equal(defaultSessionName(["4B"]), "Kurragömma 4B");
    const st = computeStandings({ participatingClassIds: ["4b"], classNames: { "4b": "4B" } }, { players: [{ classId: "4b" }, { classId: "4b" }, { classId: "4d" }] });
    assert.deepEqual(st.classes, [{ classId: "4b", name: "4B", joined: 2 }]);
  });

  it("avslutet: kgAvsluta → settle bara med rewards, demo betalar aldrig, nya försök vid tillfälliga fel, buildResult = serverns", async () => {
    const logg = [];
    const deps = (result, fel = []) => ({
      avsluta: async (sid) => { logg.push(`avsluta ${sid}`); if (fel.length) throw Object.assign(new Error("x"), { code: fel.shift() }); return { result, redan: false }; },
      settle: async (sid) => { logg.push(`settle ${sid}`); }, admin: () => false, vanta: async () => { logg.push("vanta"); },
    });
    const s = { id: "s1", status: "live" };
    const r1 = await avslutaOchBetala(s, deps({ format: "kurragomma", rewards: { a: { total: 5 } } }));
    assert.deepEqual(logg, ["avsluta s1", "settle s1"]);
    assert.equal(r1.format, "kurragomma");
    logg.length = 0;
    await avslutaOchBetala(s, deps({ format: "kurragomma" }));
    assert.deepEqual(logg, ["avsluta s1"], "utan rewards ingen utbetalning");
    logg.length = 0;
    await avslutaOchBetala({ ...s, demo: true }, deps({ format: "kurragomma", rewards: { a: { total: 5 } } }));
    assert.deepEqual(logg, ["avsluta s1"], "demo betalar aldrig");
    logg.length = 0;
    await avslutaOchBetala(s, deps({ format: "kurragomma" }, ["unavailable", "internal"]));
    assert.deepEqual(logg, ["avsluta s1", "vanta", "avsluta s1", "vanta", "avsluta s1"]);
    await assert.rejects(avslutaMedForsok(async () => { throw Object.assign(new Error("nej"), { code: "permission-denied" }); }, "s1", async () => {}), /nej/);
    assert.equal(buildResult(s, [], [], null, { result: { format: "kurragomma", klaradeSig: 3 } }).klaradeSig, 3);
    assert.equal(buildResult(s, [], [{ uid: "a" }]).players, 1);
    assert.equal(buildResult(s, [], []).rewards, undefined);
  });
  it("klassbonusen: bara den som avslutade (redan false eller projektorns tick: avslutadeNu), med perClass ur sessionen; pokaler och pris varje gång", async () => {
    const logg = [];
    const klass = async () => ({
      liveKlassBonus: async (r) => { logg.push(`bonus ${Object.keys(r.perClass || {}).join(",")}:${r.perClass?.["4b"]?.players}`); return 1; },
      pokalerEfterAvslut: async () => { logg.push("pokaler"); }, livePrisEfterAvslut: async () => { logg.push("pris"); },
    });
    const deps = (redan) => ({ avsluta: async () => ({ result: { format: "kurragomma", players: 24, rewards: { a: { total: 5 } } }, redan }), settle: async () => { logg.push("settle"); }, admin: () => true, klass });
    const s = { id: "s1", status: "finished", participatingClassIds: ["4b"], classNames: { "4b": "4B" } };
    await avslutaOchBetala(s, deps(false));
    assert.deepEqual(logg, ["settle", "bonus 4b:24", "pokaler", "pris"], "Avsluta-knappen: avslutade → bonus");
    logg.length = 0;
    await avslutaOchBetala(s, deps(true));
    assert.deepEqual(logg, ["settle", "pokaler", "pris"], "servern avslutade, någon annans tick → ingen bonus (inte idempotent)");
    logg.length = 0;
    await avslutaOchBetala(s, deps(true), { avslutadeNu: true });
    assert.deepEqual(logg, ["settle", "bonus 4b:24", "pokaler", "pris"], "projektorns egen tick avslutade → bonus");
    logg.length = 0;
    await avslutaOchBetala(s, { ...deps(false), admin: () => false });
    assert.deepEqual(logg, ["settle"], "årskurskonto: inget klasscenter");
    assert.deepEqual(medPerClass(s, { players: 3 }).perClass, { "4b": { name: "4B", players: 3 } });
    assert.deepEqual(medPerClass(s, { perClass: { x: 1 } }).perClass, { x: 1 }, "befintligt perClass rörs inte");
    assert.equal(medPerClass(s, null), null);
  });
});

describe("projektorn – rena delar (spec §7, §11, §0.2)", () => {
  it("toppraden: 'Göm: 0:24' + 'Låsta 12/21' i gömfasen, klockan + 'Gömda 14 · Sökare 6' i letfasen", () => {
    assert.deepEqual(toppText({ fas: "gom", status: { lasta: 12, gomda: 21 }, gomSlutMs: 24_000, now: 0 }), { timer: "Göm: 0:24", rad: "Låsta 12/21" });
    assert.deepEqual(toppText({ fas: "leta", status: { gomda: 14, sokare: 6 }, clock: "07:59" }), { timer: "07:59", rad: "Gömda 14 · Sökare 6" });
    assert.deepEqual(toppText({ fas: null, clock: "08:30", antal: 25 }), { timer: "08:30", rad: "25 elever" });
    assert.equal(gomKlocka(1000, 5000), "0:00");
    assert.equal(fasAv({ kgFas: "leta" }, { fas: "gom" }), "leta");
    assert.equal(fasAv({}, { fas: "gom" }), "gom");
    assert.equal(fasAv({}, null), null);
    assert.ok(minutKvar(61_000, 59_000));
    assert.ok(!minutKvar(59_000, 58_000));
    assert.ok(!minutKvar(61_000, 0));
  });

  it("händelseflödet: visslingen nämner aldrig vem; namn av → 'Någon'/ingen sökare; okänd typ → null", () => {
    const v = flodesRad({ typ: "vissling", plats: "vid ladan", namn: "Leo", uid: "e1" });
    assert.equal(v.text, "Det visslar vid ladan!");
    assert.ok(!v.text.includes("Leo") && !v.text.includes("e1"));
    assert.equal(flodesRad({ typ: "hittad", namn: "Leo", hittad: "Alma", plats: "vid ladan" }).text, "Leo hittade Alma vid ladan! Alma blir sökare.");
    assert.equal(flodesRad({ typ: "hittad", namn: "Leo", hittad: "Alma", plats: "vid ladan" }, { showNames: false }).text, `${NAGON} hittade någon vid ladan!`);
    assert.equal(flodesRad({ typ: "hittad", plats: "vid ladan" }).text, "Någon hittade någon vid ladan!");
    assert.equal(flodesRad({ typ: "miss", namn: "Leo", plats: "ute på ängen" }).text, "Leo letade ute på ängen men hittade ingen");
    assert.equal(flodesRad({ typ: "miss", plats: "ute på ängen" }, { showNames: false }).text, "En sökare letade ute på ängen men hittade ingen");
    assert.equal(flodesRad({ typ: "nySokare", namn: "Leo" }).text, "Ny sökare! Leo letar nu.");
    assert.equal(flodesRad({ typ: "nySokare", namn: "Leo" }, { showNames: false }).text, "Ny sökare!");
    assert.equal(flodesRad({ typ: "x" }), null);
    assert.equal(flodesRad(null), null);
  });

  it("finalen: rubriken exakt, lugn rad, pall utan tomma platser (delad plats = flera rader), mynt ur rewards, gömställen ur result", () => {
    assert.equal(FINAL_TITLE, "🏆 Kurragömma – Prispall");
    const result = {
      klaradeSig: 8, ranking: [
        { uid: "a", name: "Alma", poang: 120, rank: 1, klaradeSig: true }, { uid: "b", name: "Bo", poang: 120, rank: 1 },
        { uid: "c", name: "Cleo", poang: 90, rank: 3 }, { uid: "d", name: "Dan", poang: 10, rank: 4 },
      ],
      rewards: { a: { total: 188 }, b: { total: 188 }, c: { total: 161 } },
      gomstallen: [{ uid: "a", x: 1, z: 2, hittad: false }, { uid: "x", x: "nej", z: 2 }],
    };
    const m = finalModell({ ...result, ranking: result.ranking.concat(Array.from({ length: 20 }, (_, i) => ({ uid: `e${i}`, name: "E", poang: 0, rank: 5 }))) }, { showNames: true });
    assert.equal(m.rad, "8 av 24 klarade sig gömda hela matchen");
    assert.deepEqual(m.pall.map((s) => [s.plats, s.rader.map((r) => r.namn)]), [[1, ["Alma", "Bo"]], [3, ["Cleo"]]]);
    assert.equal(m.pall[0].rader[0].mynt, 188);
    assert.deepEqual(m.gomstallen, [{ uid: "a", x: 1, z: 2, hittad: false, namn: "" }]);
    assert.equal(lugnRad({ klaradeSig: 0, ranking: [{}, {}] }), "Sökarna hittade alla!");
    assert.equal(lugnRad({ ranking: [] }), "Matchen är slut!");
    assert.deepEqual(finalModell({ ranking: [{ uid: "a", name: "A", poang: 5, rank: 1 }] }).pall.map((s) => s.plats), [1], "en elev = ett steg");
    // kgp-final.js (DOM) ritar rubriken ur samma konstant – ingen egen text.
    const final = readFileSync(`${MAPP}/kgp-final.js`, "utf8");
    assert.ok(final.includes("esc(FINAL_TITLE)"), "rubriken ur konstanten");
    assert.equal(finalModell({ ranking: [{ uid: "a", name: "A", poang: 5, rank: 1 }] }).pall[0].rader[0].mynt, null, "inga rewards → inga mynt");
  });

  it("lobbyn: figurplatserna ligger inom ön, deterministiska, vända mot ön", () => {
    const uids = Array.from({ length: 30 }, (_, i) => `e${i}`);
    const p = lobbyPlatser(uids);
    assert.equal(p.length, 30);
    for (const q of p) {
      assert.ok(innanforOn(q.x, q.z, ON), `${q.uid} inom ön`);
      assert.ok(Math.hypot(q.x, q.z) > ON.radie - 9, "nära stranden (fyra rader)");
      assert.ok(Math.abs(q.yaw - Math.atan2(-q.x, -q.z)) < 1e-9);
    }
    assert.deepEqual(lobbyPlatser(uids), p);
    assert.equal(new Set(p.map((q) => `${q.x.toFixed(2)},${q.z.toFixed(2)}`)).size, 30, "inga två på samma plats");
  });

  it("lobbyn: rutan ligger på motsatt sida om bron, med dödband runt mitten och förra sidan utan bild", () => {
    assert.equal(lobbyrutaSida({ sx: 300, w: 1920 }), "hoger", "bron till vänster → rutan till höger");
    assert.equal(lobbyrutaSida({ sx: 1600, w: 1920 }), "vanster");
    assert.equal(lobbyrutaSida({ sx: 960, w: 1920 }, "vanster"), "vanster", "mitt i bilden → förra sidan");
    assert.equal(lobbyrutaSida({ sx: 960, w: 1920 }, "hoger"), "hoger");
    assert.equal(lobbyrutaSida(null, "vanster"), "vanster", "ingen bild (scenen inte klar) → förra");
    assert.equal(lobbyrutaSida(undefined), "hoger", "standard höger");
  });

  it("det riktade ljudet: vänster/höger ur bildens x, svagare mot kanten och utanför bilden, bakom kameran speglas", () => {
    assert.deepEqual(visslingPan({ sx: 960, w: 1920, inne: true }), { pan: 0, vol: 1 });
    const v = visslingPan({ sx: 0, w: 1920, inne: true });
    assert.equal(v.pan, -1);
    assert.ok(Math.abs(v.vol - 0.55) < 1e-9);
    assert.equal(visslingPan({ sx: 1920, w: 1920, inne: true }).pan, 1);
    assert.ok(visslingPan({ sx: 2500, w: 1920, inne: false }).vol < visslingPan({ sx: 1800, w: 1920, inne: true }).vol);
    assert.equal(visslingPan({ sx: 1800, w: 1920, inne: false, framfor: false }).pan < 0, true);
    assert.deepEqual(visslingPan(null), { pan: 0, vol: 0.7 });
    assert.ok(visslingPan({ sx: 99_999, w: 1920, inne: false }).vol >= 0.35);
  });
});

describe("elevskärmen – rena delar (spec §6)", () => {
  it("tystnadsregelns egna vissling: referensen ensam visar inget (kgLas/tick flyttar tystRef utan vissling), bara hand-visslingen med samma t, en gång, i valfri ordning", () => {
    const e = skapaEgenVisslingar();
    assert.equal(e.referens(1000), null, "letStart ur kgLas – ingen vissling");
    assert.equal(e.vissling({ typ: "vissling", t: 2000, x: 1, z: 2 }), null, "någon annans vissling");
    assert.equal(e.arEgen(2000), false);
    // referensen först, sedan händelsen
    assert.equal(e.referens(3000), null);
    const h3 = { typ: "vissling", t: 3000, x: 1, z: 2 };
    assert.equal(e.vissling(h3), h3);
    assert.equal(e.vissling(h3), null, "visas en gång");
    assert.equal(e.referens(3000), null, "samma referens igen visar inget");
    assert.ok(e.arEgen(3000));
    // händelsen först (RTDB före Firestore), sedan referensen
    const h4 = { typ: "vissling", t: 4000, x: 3, z: 4 };
    assert.equal(e.vissling(h4), null);
    assert.equal(e.referens(4000), h4);
    assert.equal(e.referens(4000), null);
    assert.equal(e.referens(0), null);
    assert.equal(e.vissling({ typ: "vissling" }), null);
  });

  it("texterna exakt som specen, lägena och scenens läge", () => {
    assert.equal(TEXT.gom, "Göm dig! Ingen annan ser var du går.");
    assert.equal(blundText(30), "🙈 Du blundar – räkna till 30!");
    assert.equal(gomdText("i buskaget"), "Du är gömd i buskaget");
    assert.equal(hittadText("Leo"), "Leo hittade dig! Nu letar du också.");
    assert.equal(hittadText(null), "Någon hittade dig! Nu letar du också.");
    assert.equal(TEXT.egenVissling, "Fel svar – det visslade där du gömmer dig!");
    assert.equal(TEXT.tystVissling, "Du var tyst länge – det visslade där du gömmer dig!");
    assert.equal(TEXT.ladda, "Svara rätt för att ladda ficklampan");
    assert.equal(TEXT.leta, "🔦 Leta");
    assert.deepEqual(["gomd", "sokare"].flatMap((roll) => ["gom", "leta"].map((fas) => elevLage({ roll, fas }))), ["gom-gomd", "leta-gomd", "gom-sokare", "leta-sokare"]);
    assert.equal(elevLage({ roll: null, fas: null }), "gom-gomd");
    assert.equal(scenLage("gom-gomd", false), "elev-gom");
    assert.equal(scenLage("gom-gomd", true), "elev-gomd");
    assert.equal(scenLage("leta-gomd"), "elev-gomd");
    assert.equal(scenLage("leta-sokare"), "elev-sokare");
    assert.equal(nedrakning(24_000, 0), "0:24");
    assert.equal(nedrakning(24_400, 0), "0:25", "påbörjad sekund räknas");
    assert.equal(nedrakning(0, 5000), "0:00");
    assert.equal(mittenText({ lage: "leta-sokare", laddningar: 0 }), TEXT.ladda);
    assert.equal(mittenText({ lage: "leta-sokare", laddningar: 2 }), TEXT.sokareLeta);
    assert.equal(letaFel({ details: { skal: "ingen-laddning" } }), TEXT.ladda);
    assert.equal(letaFel({ message: "Egen" }), "Egen");
  });

  it("ficklamporna och skyddspricken är SVG (inga emojier), 3 lampor varav n tända", () => {
    const h = laddningarHtml(2);
    assert.equal((h.match(/<svg/g) || []).length, 3);
    assert.equal((h.match(/kge-lampa-pa/g) || []).length, 2);
    assert.equal((laddningarHtml(7).match(/kge-lampa-pa/g) || []).length, 3);
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(h + skyddPrickSvg(2)));
    assert.ok(skyddPrickSvg(3).includes("<circle"));
  });

  it("startplatsen ur uid i kanten, sessionStorage-platsen sparas/läses/glöms per session, tåligt mot trasigt lager", () => {
    const a = startplats("elev-a");
    assert.deepEqual(a, startplats("elev-a"));
    assert.ok(ON.gomStart.some((g) => g.x === a.x && g.z === a.z));
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    sparaPos(storage, "s1", { x: 1.5, z: -2, yaw: 0.3 });
    assert.equal(posNyckel("s1"), "pp:kg:pos:s1");
    assert.deepEqual(lasPos(storage, "s1"), { x: 1.5, z: -2, yaw: 0.3 });
    assert.equal(lasPos(storage, "s2"), null);
    glomPos(storage, "s1");
    assert.equal(lasPos(storage, "s1"), null);
    store.set("pp:kg:pos:s3", "{trasigt");
    assert.equal(lasPos(storage, "s3"), null);
    const trasigt = { getItem: () => { throw new Error("privat"); }, setItem: () => { throw new Error("privat"); }, removeItem: () => { throw new Error("privat"); } };
    sparaPos(trasigt, "s", { x: 0, z: 0 });
    assert.equal(lasPos(trasigt, "s"), null);
    assert.equal(lasPos(null, "s"), null);
  });

  it("mellanslag/E letar (inte med Ctrl/Alt/Meta, inte repeat), panelen till höger över 1100 px", () => {
    assert.ok(letaTangent({ key: " " }));
    assert.ok(letaTangent({ key: "e" }) && letaTangent({ key: "E" }));
    assert.ok(!letaTangent({ key: "e", ctrlKey: true }) && !letaTangent({ key: " ", repeat: true }) && !letaTangent({ key: "1" }));
    assert.equal(panelLage(1366), "sida");
    assert.equal(panelLage(1100), "kort");
    assert.equal(panelLage(380), "kort");
  });

  it("slutskärmen: pallplats eller gömd/hittad utan placering som nummer, mynt ur result", () => {
    const st = { result: { ranking: [{ uid: "a", name: "A", poang: 90, rank: 1, klaradeSig: true, hittade: 0 }, { uid: "b", name: "B", poang: 10, rank: 7, klaradeSig: false, hittade: 0 }], rewards: { a: { total: 20, rank: 1, prize: 10, correctCoins: 10 } }, gomstallen: [{ uid: "a", namn: "A", x: 0, z: 0, hittad: false, skydd: 2 }] } };
    const ha = endHtml(st, { uid: "a", name: "A" }, "4b");
    assert.ok(ha.includes("90") && ha.includes("20"));
    const hb = endHtml(st, { uid: "b", name: "B" }, "4b");
    assert.ok(!/\b7\b|plats 7|7:e/.test(slutRad(st.result.ranking[1])), "ingen placering som nummer utanför pallen");
    assert.ok(hb.length > 0);
  });
});

describe("filkraven (spec §13.4, §0.2)", () => {
  it("ingen fil i formatmappen över 400 rader, inga Emoji 13+, index.js når inte scen/, kanalen, demot eller DOM statiskt", () => {
    const ny = (cp) => cp >= 0x1fa70 && cp <= 0x1faff;
    const filer = [];
    for (const d of ["", "/delat", "/scen"]) for (const f of readdirSync(`${MAPP}${d}`)) if (/\.(js|css)$/.test(f)) filer.push(`${MAPP}${d}/${f}`);
    for (const f of ["preview/preview-kurragomma-demo.html", "preview/preview-kurragomma-elev.html", "preview/preview-kurragomma-demolage.html"]) filer.push(f);
    for (const f of filer) {
      const src = readFileSync(f, "utf8");
      if (f.startsWith(MAPP)) assert.ok(src.split("\n").length <= 401, `${f} ≤ 400 rader`);
      assert.ok(![...src].some((c) => ny(c.codePointAt(0))), `${f}: Emoji 13+`);
    }
    const statiska = (src) => [...src.matchAll(/^import\s[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[1]);
    const index = statiska(readFileSync(`${MAPP}/index.js`, "utf8"));
    assert.ok(index.every((i) => !/scen\/|kg-kanal|kg-demo|kurragomma-data|kgp-|kge-|-projector|-student|-history|firebase/.test(i)), index.join(", "));
    for (const f of ["kg-setup.js", "kg-avslut.js", "kgp-logik.js", "kge-logik.js"]) {
      assert.ok(statiska(readFileSync(`${MAPP}/${f}`, "utf8")).every((i) => !/firebase|kurragomma-data/.test(i)), f);
    }
    // Elevens spelyta och projektorvyn känner inte till Firebase – bara de tunna kopplingarna gör det.
    for (const f of ["kge-elev-vy.js", "kge-spel.js", "kgp-on.js", "kgp-lobby.js", "kgp-final.js", "kgp-ljud.js"]) {
      assert.ok(statiska(readFileSync(`${MAPP}/${f}`, "utf8")).every((i) => !/firebase|kurragomma-data/.test(i)), f);
    }
  });
});
