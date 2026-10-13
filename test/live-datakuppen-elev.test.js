// ============================================================================
// Enhetstester: Datakuppens ELEVVY (#653, epic Datakuppen) – den rena logiken
// (dk-elev.js) och de statiska skärmarna (dk-skarmar.js). Spec §1.2–1.7,
// §4.3, §6 test 19 (inga Emoji 13+ – test/mynt-ikon.test.js går igenom hela
// src/live) och elevvyns placeringsregel (aldrig placering som nummer).
// Vyn ritas i preview/preview-datakuppen-elev.html (låtsasserver).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  DK_ELEV, standingText, goldStanding, fileView, targetView, guessView, codeChars, codeSlots, createHackMemory,
  codePickState, hackState, tipAt, chestKey, createHitWatcher, myProtection,
} from "../src/live/formats/datakuppen/dk-elev.js";
import { lobbyHtml, endHtml, joinedText } from "../src/live/formats/datakuppen/dk-skarmar.js";
import { DK_FILES, DK_RULES, DK_TIPS } from "../src/live/formats/datakuppen/delat/files-config.js";

const DIR = new URL("../src/live/formats/datakuppen/", import.meta.url);

describe("Datakuppen elevvy: toppraden (§4.3)", () => {
  it("läget visas i MB mot närmaste framför – aldrig som placering", () => {
    const players = [{ uid: "a", name: "Alma 4B", gold: 300 }, { uid: "b", name: "Omar", gold: 200 }, { uid: "me", name: "Jag", gold: 180 }];
    const { gold, rel } = goldStanding(players, "me");
    assert.equal(gold, 180);
    assert.equal(standingText(rel), "20 MB bakom Omar");
    assert.equal(standingText(goldStanding(players, "a").rel), "Du leder! 💾");
    assert.doesNotMatch(standingText(rel), /plats|\d+:a|\d+:e/);
  });

  it("skyddet: \"🛡️ Skyddad 0:42\" bara medan det gäller", () => {
    assert.equal(myProtection({ protectedUntil: 1_042_000 }, 1_000_000), "🛡️ Skyddad 0:42");
    assert.equal(myProtection({ protectedUntil: 999_000 }, 1_000_000), "");
  });

  it("en oöppnad fil sparas under en egen nyckel per match och elev", () => {
    assert.equal(chestKey("s1", "u1"), "pp:dk:fil:s1:u1");
  });
});

describe("Datakuppen elevvy: filerna (§1.3)", () => {
  it("varje filtyp får sin egen bildtext ur serverns id (svaret heter file)", () => {
    const seen = new Set();
    for (const f of DK_FILES) {
      const v = fileView({ file: f.id, delta: f.effect.kind === "lose" ? -12 : 25, gold: 200 });
      assert.equal(v.chest.id, f.id);
      assert.ok(v.caption, f.id);
      assert.equal(v.look, f.look);
      seen.add(v.look);
    }
    assert.equal(seen.size, DK_FILES.length, "eget utseende per filtyp");
    assert.equal(fileView({ file: "virus", delta: -12, gold: 108 }).caption, "Virus! −12 MB");
    assert.equal(fileView({ file: "brandvagg", delta: 0, gold: 1 }).caption, `Brandvägg i ${DK_RULES.shieldMs / 1000} s!`);
    assert.equal(fileView({ file: "serverhall", delta: 100, gold: 1 }).mood, "jubel");
  });

  it("ett okänt id avslöjar ingenting och kraschar inte", () => {
    const v = fileView({ file: "påhitt", delta: 0, gold: 0 });
    assert.equal(v.chest, null);
  });
});

describe("Datakuppen elevvy: hacket (§1.4)", () => {
  it("steg 1 → kodkorten med kompisens förnamn; ingen att välja → Mapp", () => {
    const v = targetView({ result: "target", targetUid: "o", targetName: "Omar 4B", options: ["a1bc", "d2ef", "g3hi"], expiresAtMs: 5 });
    assert.deepEqual(v.hack, { targetUid: "o", targetName: "Omar", options: ["a1bc", "d2ef", "g3hi"], expiresAtMs: 5 });
    assert.equal(v.run, false);
    const fb = targetView({ result: "fallback", file: "mapp", delta: 25, gold: 125 });
    assert.equal(fb.hack, undefined);
    assert.match(fb.caption, /\+25 MB/);
  });

  it("steg 2: rätt, fel, tiden ute, ny kod och skyddad ger var sitt besked – lekfullt", () => {
    assert.deepEqual(
      [guessView({ result: "hacked", amount: 45 }, "Omar").text, guessView({ result: "wrong" }, "Omar").title],
      ["+45 MB från Omar", "Fel kod!"],
    );
    for (const result of ["timeout", "changed", "protected", "okänt"]) assert.equal(guessView({ result }, "Omar").tone, "tid");
    assert.equal(guessView({ result: "hacked", amount: 1 }).sound, "access");
    assert.equal(guessView({ result: "wrong" }).sound, "nekad");
  });

  it("målväljaren gråar skyddade (med nedräkning), nyss hackade och de med för lite data", () => {
    const me = { uid: "me", gold: 50, lastVictimUid: "c" };
    const rows = DK_ELEV.victimRows("steal", me, [
      me, { uid: "a", name: "Alma", gold: 300, protectedUntil: 4_000 }, { uid: "b", name: "Bo", gold: 0 }, { uid: "c", name: "Cleo", gold: 90 },
      { uid: "d", name: "Dani", gold: 80 },
    ], 1_000);
    assert.deepEqual(rows.map((r) => [r.uid, r.ok, r.why]), [
      ["a", false, "🛡️ 0:03"], ["c", false, "Nyss hackad"], ["d", true, ""], ["b", false, "För lite data"],
    ]);
  });

  it("kodkorten: alltid tre platser – de strukna som borta (minnesmomentet)", () => {
    assert.deepEqual(codeSlots(["a1bc", "d2ef", "g3hi"], []), [
      { code: "a1bc", gone: false }, { code: "d2ef", gone: false }, { code: "g3hi", gone: false },
    ]);
    assert.deepEqual(codeSlots(["g3hi", "a1bc"], ["d2ef"]), [
      { code: "g3hi", gone: false }, { code: "a1bc", gone: false }, { code: "d2ef", gone: true },
    ]);
    // Annan dator (inget minne) → platsen visas ändå som borta, utan kod.
    assert.deepEqual(codeSlots(["a1bc"], []), [{ code: "a1bc", gone: false }, { code: "", gone: true }, { code: "", gone: true }]);
  });

  it("minnet: strukna koder per mål, glöms när målet bytt kod (tre alternativ igen)", () => {
    let saved = null;
    const store = { get: () => saved, set: (v) => { saved = v; } };
    const m = createHackMemory(store);
    m.strike("o", "a1bc");
    m.strike("o", "a1bc");
    m.strike("o", "d2ef");
    assert.deepEqual(m.struck("o"), ["a1bc", "d2ef"]);
    assert.deepEqual(createHackMemory(store).struck("o"), ["a1bc", "d2ef"], "överlever en omladdning");
    m.seen("o", ["g3hi", "x4yz"]);
    assert.deepEqual(m.struck("o"), ["a1bc", "d2ef"]);
    m.seen("o", ["g3hi", "x4yz", "k5lm"]);
    assert.deepEqual(m.struck("o"), []);
    assert.deepEqual(createHackMemory({ get: () => "{trasig", set() {} }).struck("o"), []);
  });

  it("omladdning mitt i steg 2: koderna ur dkSelf.hack, bara om pending väntar på gissningen", () => {
    const self = { hack: { targetUid: "o", targetName: "Omar", options: ["a1bc", "d2ef"], expiresAt: 9_000 } };
    const me = { pending: { kind: "steal", chest: "hack", stage: "guess", targetUid: "o" } };
    assert.deepEqual(hackState(self, me, 4_000), { targetUid: "o", targetName: "Omar", options: ["a1bc", "d2ef"], expiresAtMs: 9_000, leftMs: 5_000 });
    assert.equal(hackState(self, { pending: { ...me.pending, stage: undefined } }, 0), null);
    assert.equal(hackState(self, { pending: null }, 0), null);
    assert.equal(hackState({ hack: null }, me, 0), null);
  });

  it("notisen till den hackade: \"💻 Omar knäckte din kod och tog 45 MB!\" – baslinjen visar inget gammalt", () => {
    const w = createHitWatcher();
    const hit = { kind: "steal", byUid: "o", byName: "Omar 4B", amount: 45, at: 1 };
    assert.equal(w.take({ lastHit: null }), null);
    assert.equal(w.take({ lastHit: hit }).text, "💻 Omar knäckte din kod och tog 45 MB!");
    assert.equal(w.take({ lastHit: hit }), null);
  });
});

describe("Datakuppen elevvy: koden (§1.2, §1.5)", () => {
  it("siffrorna märks så att 0/o och 1/l kan skiljas åt", () => {
    assert.deepEqual(codeChars("f0l1").map((c) => c.digit), [false, true, false, true]);
  });

  it("lobbyn: förslagen tills eleven valt, sedan bara koden", () => {
    assert.deepEqual(codePickState({ offers: ["a1bc", "d2ef", "g3hi", "j4kl"], code: null }, "lobby", 0),
      { show: true, offers: ["a1bc", "d2ef", "g3hi", "j4kl"], leftMs: null, code: null, lobby: true });
    assert.equal(codePickState({ offers: null, code: "a1bc" }, "lobby", 0).show, false);
    assert.equal(codePickState(null, "lobby", 0).show, false);
  });

  it("efter ett hack: \"Välj ny kod\" med nedräkning; ingen kod alls = servern väljer (visas inte)", () => {
    const s = codePickState({ code: "a1bc", offers: ["d2ef", "g3hi", "j4kl", "m5no"], offersExpiresAt: 10_000 }, "live", 4_000);
    assert.equal(s.show, true);
    assert.equal(s.leftMs, 6_000);
    assert.equal(codePickState({ code: "a1bc", offers: ["d2ef"], offersExpiresAt: 1 }, "live", 9).leftMs, 0);
    assert.equal(codePickState({ code: null, offers: ["d2ef"] }, "live", 0).show, false);
  });

  it("eleven kan aldrig skriva en egen kod: kodvalet har inga textfält och skickar bara index", () => {
    for (const f of ["dk-kodval.js", "dk-kod-vy.js", "dk-kodkort.js"]) {
      const src = readFileSync(new URL(f, DIR), "utf8");
      assert.doesNotMatch(src, /<input|<textarea|contenteditable/i, f);
    }
    const vy = readFileSync(new URL("dk-kod-vy.js", DIR), "utf8");
    for (const m of vy.matchAll(/pickCode\(\{([^}]*)\}\)/g)) assert.match(m[1], /^\s*sid(, index)?\s*$/, m[0]);
  });
});

describe("Datakuppen elevvy: lobby och slutskärm (§1.7, §4.4)", () => {
  it("lobbyn har avatar, kodval och ett säkerhetstips ur konfigurationen", () => {
    const html = lobbyHtml({ id: "s1" });
    assert.match(html, /data-dk-av/);
    assert.match(html, /data-dk-kod/);
    assert.ok(DK_TIPS.some((t) => html.includes(t)));
    assert.ok(joinedText);
    assert.equal(tipAt(DK_TIPS.length + 1), DK_TIPS[1]);
    assert.equal(tipAt(-1), DK_TIPS.at(-1));
  });

  it("slutskärmen: pallplats bara för topp 3, annars läget – aldrig placering som nummer", () => {
    const ranking = [
      { uid: "a", name: "Alma", gold: 400, correct: 20, rank: 1 }, { uid: "b", name: "Bo", gold: 300, correct: 18, rank: 2 },
      { uid: "c", name: "Cleo", gold: 200, correct: 12, rank: 3 }, { uid: "d", name: "Dani", gold: 150, correct: 10, rank: 4 },
    ];
    const st = (uid) => endHtml({ phase: "ended", session: { id: "s1" }, result: { ranking, totalGold: 1050 } }, { uid });
    assert.match(st("b"), /Du kom 2:a!/);
    const fyra = st("d");
    assert.doesNotMatch(fyra, /4:e|plats 4|Du kom/);
    assert.match(fyra, /50 MB bakom Cleo/);
    assert.match(fyra, /Tillsammans: <b>1 050<\/b> MB/);
    assert.match(fyra, /Säkerhetstips/);
    assert.match(endHtml({ phase: "cancelled" }, null), /avbröts/);
  });
});

describe("Datakuppen elevvy: laddas dynamiskt (inget nytt i bootgrafen)", () => {
  it("formatet pekar på elevvyn med en dynamisk import; ingen fil utanför formatet importerar den statiskt", () => {
    const idx = readFileSync(new URL("index.js", DIR), "utf8");
    assert.match(idx, /studentView: \(\) => import\("\.\/datakuppen-student\.js"\)/);
    const egna = readdirSync(DIR).filter((f) => f.endsWith(".js") && f !== "index.js");
    const statiska = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
        if (e.isDirectory()) { if (p.href !== DIR.href) walk(p); continue; }
        if (!e.name.endsWith(".js")) continue;
        const src = readFileSync(p, "utf8");
        for (const f of egna) if (new RegExp(`^import[^;]*datakuppen/${f.replace(".", "\\.")}`, "m").test(src)) statiska.push(`${e.name} → ${f}`);
      }
    };
    walk(new URL("../src/", import.meta.url));
    assert.deepEqual(statiska, []);
  });
});
