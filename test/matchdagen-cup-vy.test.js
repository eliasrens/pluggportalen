// ============================================================================
// Matchdagen 2c (#872): Silverpokalen och rekorden i vyerna – Match-fliken väljer
// cupmatchen före nästa ligamatch (md-vy-match.js nastaSpel), den pågående cupmatchen
// gäller bara sin runda (md-lokal.js), och elevens vyer och lärarens vy skriver bara
// tal och esc() ur cup, rekord, pokaler och senaste (eleven skriver dokumentet – #869 G1).
// Ren node: node --test test/matchdagen-cup-vy.test.js
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";
import { matchKlar, nastaMatch, nyKarriar } from "../src/matchdagen/delat/md-sasong.js";
import { cupKlar, cupLottning, cupMatch } from "../src/matchdagen/delat/md-cup.js";
import { nyMatch } from "../src/matchdagen/delat/md-motor.js";
import { lasPagaende, sparaPagaende } from "../src/matchdagen/md-lokal.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import { cupHtml, cupStatus, rekordLista } from "../src/matchdagen/vy/md-vy-cup.js";
import { cupEfter, rekordHtml } from "../src/matchdagen/vy/md-efter-match.js";

const XSS = "<img src=x onerror=alert(1)>";
const NU = Date.UTC(2026, 10, 20, 10);
const UID = "e1";
const rng = (f) => skapaPrng(f).tal;
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: {}, sekunder: 420 };
const res = (oss, dem, x = {}) => ({ oss, dem, utfall: "", mal: [], stat: STAT, ...x });
const K0 = nyKarriar({ namn: "Blixtarna", farg: "#2f6fe8", rng: rng("v") });
const K1 = matchKlar(K0, { res: res(2, 0), rng: rng("1"), nu: NU, matchId: "m1" }).K;

let vy;
let larare;
before(async () => {
  installeraFirebaseStubbe();
  vy = await import("../src/matchdagen/vy/md-vy-match.js");
  larare = await import("../src/matchdagen/larare/md-larare-stat.js");
});

describe("Match-fliken: cupmatchen före nästa ligamatch (md-vy-match.js)", () => {
  it("efter omgång 1: 'Silverpokalen · Sextondelsfinal · … från Division …'; efter cupmatchen ligan igen", () => {
    assert.equal(vy.nastaSpel(K0, UID).typ, "liga");
    const n = vy.nastaSpel(K1, UID);
    assert.equal(n.typ, "cup");
    assert.equal(n.runda, 0);
    assert.match(n.text, /^Silverpokalen · Sextondelsfinal · .+ från Division [65]$/);
    const K2 = cupKlar(K1, { res: res(1, 0), nu: NU, matchId: "c1", uid: UID }).K;
    assert.equal(vy.nastaSpel(K2, UID).typ, "liga");
    assert.equal(vy.nastaSpel(K2, UID).omg, 1);
  });
  it("rutan före cupmatchen: vad som står på spel, finalens prispengar och skrällen", () => {
    const n = vy.nastaSpel(K1, UID);
    assert.match(vy.cupFore(K1, n), /vidare till <b>kvartsfinalen<\/b>/);
    const final = { ...n, cup: { ...n.cup, runda: 3, mot: { ...n.mot, namn: XSS, div: 2 } } };
    const html = vy.cupFore(K1, final);
    assert.match(html, /Final i Silverpokalen!.*200 kr/s);
    assert.match(html, /spelar i Division 4 – högre upp än ni/);
    assert.doesNotMatch(html, /<img/);
  });
});

describe("den pågående cupmatchen gäller bara sin runda (md-lokal.js)", () => {
  it("samma säsong, omgång och runda → fortsätter; en annan runda → inte", () => {
    const lagring = new Map();
    const L = { getItem: (k) => lagring.get(k) ?? null, setItem: (k, v) => lagring.set(k, v), removeItem: (k) => lagring.delete(k) };
    const m = nyMatch({ mot: { namn: "X", styrka: 0.3 }, avgor: true });
    sparaPagaende(L, UID, { sasong: 1, omg: 1, typ: "cup", runda: 0, matchId: "c", m });
    assert.ok(lasPagaende(L, UID, K1, "cup", 0));
    assert.equal(lasPagaende(L, UID, K1, "cup", 1), null);
    assert.equal(lasPagaende(L, UID, K1, "liga"), null);
  });
});

describe("vyerna skriver bara tal och esc() ur cup, rekord, pokaler och senaste", () => {
  it("cupens rundor: resultaten och motståndarna ur senaste escapas, rundorna ur listan", () => {
    const K2 = cupKlar(K1, { res: res(2, 1), nu: NU, matchId: "c1", uid: UID }).K;
    const html = cupHtml(K2, UID);
    assert.match(html, /Sextondelsfinal.*2–1 · vidare/s);
    assert.match(html, new RegExp(cupLottning(K1, UID)[1].namn));
    const trasig = { ...K2, senaste: [{ typ: "cup", sasong: 1, omg: 1, mot: XSS, oss: XSS, dem: 1, straffar: [XSS, 2] }] };
    const t = cupHtml(trasig, UID);
    assert.doesNotMatch(t, /<img/);
    assert.match(t, /0–1 \(str\. 0–2\)/);
    assert.match(cupHtml({ ...K2, cup: XSS }, UID), /Sextondelsfinalen väntar/, "trasig cup → ingen runda spelad");
  });
  it("cupens läge i en mening: väntar, efter omgång, utslagna, vunnen", () => {
    assert.match(cupStatus(K0), /Sextondelsfinalen spelas efter omgång 1/);
    assert.match(cupStatus(K1), /Sextondelsfinalen väntar/);
    assert.match(cupStatus({ ...K1, cup: "1-2-u" }), /Utslagna i kvartsfinalen/);
    assert.match(cupStatus({ ...K1, cup: "1-4" }), /Ni vann Silverpokalen/);
  });
  it("rekorden i Statistik och i rutan efter matchen: bara tal och fasta texter", () => {
    const html = rekordLista(`mm${XSS}|ms5.1|ss3-0.${XSS}|sv|lt|os|ar|sm|nu1.0.0.0.0.0.0.0`);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /Flest mål på en säsong<\/dt><dd>5 mål/);
    assert.match(rekordHtml(["Nytt rekord: 5 mål i en match!"]), /Nytt rekord: 5 mål i en match!/);
    assert.equal(rekordHtml([]), "");
    assert.doesNotMatch(rekordHtml([XSS]), /<img/);
  });
  it("rutan efter cupmatchen: vidare, pokalen eller utslagna", () => {
    assert.match(cupEfter({ vann: true, runda: 0 }).rad, /kvartsfinalen/);
    assert.equal(cupEfter({ vann: true, vannCupen: true, runda: 3 }).rubrik, "Silverpokalen är er!");
    assert.match(cupEfter({ vann: false, runda: 1 }).rubrik, /Utslagna/);
  });
  it("lärarens vy: cupens rad ur läget (tal), rekorden ur rekordRader, '(cup)' bara som jämförelse", () => {
    assert.equal(larare.cupRad({ ...K1, cup: "1-2-u" }), "Silverpokalen: utslagen i kvartsfinalen");
    assert.equal(larare.cupRad({ ...K1, cup: XSS }), "Silverpokalen: sextondelsfinalen väntar");
    const src = readFileSync(new URL("../src/matchdagen/larare/md-larare-stat.js", import.meta.url), "utf8");
    assert.match(src, /esc\(cupRad\(K\)\)/);
    assert.match(src, /esc\(r\.namn\)\}: <b>\$\{esc\(r\.varde\)\}/);
    assert.doesNotMatch(src, /\$\{K\.(cup|rekord|pokaler)/);
    const stat = readFileSync(new URL("../src/matchdagen/vy/md-vy-stat.js", import.meta.url), "utf8");
    assert.match(stat, /esc\(p\?\.namn\)\} <span class="md-svag">\(säsong \$\{tal\(p\?\.sasong\)\}\)/, "pokalens säsong som tal");
    assert.match(stat, /tal\(v\.ratt\)\}\/\$\{tal\(v\.fragor\)\}/, "staplarna som tal");
  });
  it("en hel säsong i appens ordning: cupen efter omgång 1–4, sedan sista ligaomgången", () => {
    let K = K0;
    const typer = [];
    for (let i = 0; i < 12; i++) {
      const n = vy.nastaSpel(K, UID);
      if (!n) break;
      typer.push(n.typ);
      if (n.typ === "kval") break;
      K = n.typ === "cup" ? cupKlar(K, { res: res(1, 0), nu: NU, matchId: `c${i}`, uid: UID }).K
        : matchKlar(K, { res: res(1, 0), rng: rng(`${i}`), nu: NU, matchId: `m${i}` }).K;
    }
    assert.deepEqual(typer, ["liga", "cup", "liga", "cup", "liga", "cup", "liga", "cup", "liga", "kval"]);
    assert.equal(nastaMatch(K), null);
    assert.equal(cupMatch(K, UID), null);
  });
});
