// ============================================================================
// Schack 2B (#780): lobbyn, partiet mot en kompis, klockan och topplistan på
// elevsidan – den rena logiken (klockvisning, lobbyfiltrering, topplistesortering,
// §7.3, slutrutan, brädets synk) och markupen. Lyssnarna, förhandsvisningens
// server och källkoden: test/schack-kompis-lyssnare.test.js.
// Körs med: node --test test/schack-kompis.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  formatTid, klockor, lobbyVy, utmanaLista, topplistaRader, lamnatLage, slutText, dragDiff, klockaEtikett, fargFor, motstandare,
} from "../src/schack/schack-kompis-data.js";
import {
  minDelHtml, vantarHtml, utmanaHtml, pagaendeHtml, topplistaHtml, inkommandeHtml, klockvalHtml,
} from "../src/schack/schack-kompis-delar.js";
import { startHtml } from "../src/schack/schack-sida-delar.js";


const NU = Date.parse("2026-10-19T10:00:00Z");
const MIN = 60_000;

describe("klockvisningen (§7.2)", () => {
  it("formatTid: m:ss uppåt till hel sekund, tiondelar under 10 s, 0:00 först när tiden är slut", () => {
    assert.equal(formatTid(10 * MIN), "10:00");
    assert.equal(formatTid(5 * MIN - 1), "5:00");
    assert.equal(formatTid(59_001), "1:00");
    assert.equal(formatTid(61_000), "1:01");
    assert.equal(formatTid(10_000), "0:10");
    assert.equal(formatTid(9_999), "0:09,9");
    assert.equal(formatTid(7_340), "0:07,3");
    assert.equal(formatTid(40), "0:00,0");
    assert.equal(formatTid(0), "0:00");
    assert.equal(formatTid(-500), "0:00");
    assert.equal(formatTid(Infinity), "");
    assert.equal(formatTid(null), "");
  });
  const parti = (o = {}) => ({
    status: "pagar", tur: "w", vit: "a", svart: "b",
    klocka: { minuter: 5, vitMs: 5 * MIN, svartMs: 4 * MIN, senastDragAt: NU }, ...o,
  });
  it("räknas lokalt ur senastDragAt + serverns tid: bara den på tur tickar", () => {
    const k = klockor(parti(), NU + 12_000);
    assert.equal(k.w.text, "4:48");
    assert.equal(k.b.text, "4:00");
    assert.equal(k.w.aktiv, true);
    assert.equal(k.b.aktiv, false);
    assert.equal(k.slutFor, null);
    const k2 = klockor(parti({ tur: "b" }), NU + 61_000);
    assert.equal(k2.b.text, "2:59");
    assert.equal(k2.w.text, "5:00");
  });
  it("tiden slut: 0:00, slutFor = den på tur, 'lite' under 30 s", () => {
    const k = klockor(parti(), NU + 6 * MIN);
    assert.equal(k.w.ms, 0);
    assert.equal(k.w.text, "0:00");
    assert.equal(k.slutFor, "w");
    assert.equal(klockor(parti(), NU + 5 * MIN - 20_000).w.lite, true);
  });
  it("ett slutat parti visar den frysta klockan; utan klocka = null", () => {
    const k = klockor(parti({ status: "slut", klocka: { minuter: 5, vitMs: 0, svartMs: 90_000, senastDragAt: NU } }), NU + 99 * MIN);
    assert.deepEqual([k.w.text, k.b.text, k.w.aktiv, k.slutFor], ["0:00", "1:30", false, null]);
    assert.equal(klockor(parti({ klocka: null }), NU), null);
  });
  it("klockaEtikett", () => {
    assert.equal(klockaEtikett(10), "10 min");
    assert.equal(klockaEtikett(null), "ingen klocka");
  });
});

describe("lobbyn: filtreringen (§7.1)", () => {
  const klass = {
    vantar: {
      a: { namn: "Alva", klocka: 10, sedan: NU - 9 * MIN },
      b: { namn: "Bilal", klocka: null, sedan: NU - 11 * MIN }, // gammal: borta efter 10 min
      c: { namn: "Cleo", klocka: 5, sedan: NU - MIN },
      d: { namn: "Dante", klocka: 5, sedan: NU - MIN }, // spelar redan – visas inte som väntande
    },
    utmaningar: {
      u1: { fran: "a", franNamn: "Alva", till: "c", klocka: 10, sedan: NU - 119_000 },
      u2: { fran: "b", franNamn: "Bilal", till: "c", klocka: null, sedan: NU - 121_000 }, // utgången (2 min)
      u3: { fran: "c", franNamn: "Cleo", till: "e", klocka: 5, sedan: NU - 30_000 },
    },
    partier: { p1: { vit: "d", svart: "e", vitNamn: "Dante", svartNamn: "Eli", klocka: 15, start: NU - 5 * MIN } },
    tabell: {},
  };
  it("utgångna väntan (10 min) och utmaningar (2 min från sedan) syns inte – utan någon skrivning", () => {
    const v = lobbyVy(klass, "c", NU);
    assert.deepEqual(v.vantar.map((x) => x.uid), ["a"], "Bilal har gått ut, Cleo är jag själv, Dante spelar");
    assert.deepEqual(v.minVantan, { uid: "c", namn: "Cleo", klocka: 5, sedan: NU - MIN });
    assert.deepEqual(v.inkommande.map((u) => u.id), ["u1"], "u2 är äldre än 2 min");
    assert.equal(v.inkommande[0].kvarMs, 1_000);
    assert.equal(v.utgaende.id, "u3");
    assert.deepEqual(v.pagaende.map((p) => p.text), ["Dante – Eli"]);
    assert.equal(v.mittParti, null);
    assert.equal(lobbyVy(klass, "e", NU).mittParti, "p1");
  });
  it("utmaningen försvinner exakt 2 min efter sedan; nastaUtgang säger när vyn ska rita om", () => {
    assert.equal(lobbyVy(klass, "c", NU + 999).inkommande.length, 1);
    assert.equal(lobbyVy(klass, "c", NU + 1_000).inkommande.length, 0);
    assert.equal(lobbyVy(klass, "c", NU).nastaUtgang, 1_000);
    assert.equal(lobbyVy({ vantar: {}, utmaningar: {}, partier: {} }, "c", NU).nastaUtgang, null);
  });
  it("trasiga poster (utan sedan) filtreras bort; saknat dokument = tom lobby", () => {
    const v = lobbyVy({ vantar: { x: { namn: "X" } }, utmaningar: { y: { fran: "a", till: "c" } } }, "c", NU);
    assert.deepEqual([v.vantar.length, v.inkommande.length], [0, 0]);
    const tom = lobbyVy(null, "c", NU);
    assert.deepEqual([tom.vantar, tom.inkommande, tom.pagaende, tom.utgaende, tom.mittParti], [[], [], [], null, null]);
  });
  it("utmanaLista: alla utom jag, på namn, med läget per kompis", () => {
    const v = lobbyVy(klass, "c", NU);
    const lista = utmanaLista([{ uid: "e", namn: "Eli" }, { uid: "c", namn: "Cleo" }, { uid: "a", namn: "Alva" }, { uid: "d", namn: "Dante" }], "c", v);
    assert.deepEqual(lista.map((k) => [k.namn, k.spelar, k.vantar, k.utmanad]), [
      ["Alva", false, true, false], ["Dante", true, false, false], ["Eli", true, false, true],
    ]);
  });
});

describe("topplistan (§8)", () => {
  const tabell = {
    a: { poang: 1020, vinster: 2, forluster: 1, remier: 0, partier: 3 },
    b: { poang: 1040, vinster: 3, forluster: 0, remier: 1, partier: 4 },
    c: { poang: 1020, vinster: 3, forluster: 2, remier: 0, partier: 5 },
    d: { poang: 1000, vinster: 0, forluster: 0, remier: 0, partier: 0 }, // nollställd rad: inte med
    e: { poang: 990, vinster: 1, forluster: 1, remier: 0, partier: 2 },
  };
  const namn = { a: "Alva", b: "Bilal", c: "Cleo", e: "Eli" };
  it("sorteras på poäng, sedan vinster, sedan namn; placering 1…n; egen rad markerad", () => {
    const r = topplistaRader(tabell, "c", (u) => namn[u]);
    assert.deepEqual(r.map((x) => [x.plats, x.namn, x.poang, x.egen]), [
      [1, "Bilal", 1040, false], [2, "Cleo", 1020, true], [3, "Alva", 1020, false], [4, "Eli", 990, false],
    ]);
  });
  it("lika poäng och vinster → namnordning (svensk); okänt namn → 'Okänd'", () => {
    const r = topplistaRader({ x: { poang: 1000, vinster: 1, partier: 1 }, y: { poang: 1000, vinster: 1, partier: 1 } }, "z",
      (u) => ({ x: "Örjan", y: "Åsa" })[u]);
    assert.deepEqual(r.map((x) => x.namn), ["Åsa", "Örjan"]);
    assert.equal(topplistaRader({ q: { poang: 1000, partier: 1 } }, "z")[0].namn, "Okänd");
  });
  it("markupen: V/F/R, (du), förklaringen; dold = ingenting; tom lista = uppmuntran", () => {
    const html = topplistaHtml(topplistaRader(tabell, "c", (u) => namn[u]));
    assert.match(html, /Du får mer poäng om du vinner mot någon som har många poäng\./);
    assert.match(html, /<tr class="egen" aria-current="true"><td>2<\/td><td class="schack-topplista-namn">Cleo <small>\(du\)<\/small>/);
    assert.match(html, /<td>3\/0\/1<\/td>/);
    assert.equal(topplistaHtml(topplistaRader(tabell, "c"), { dold: true }), "");
    assert.match(topplistaHtml([]), /Ingen har spelat än/);
  });
});

describe("§7.3 och tiden: lamnatLage", () => {
  const utan = (o = {}) => ({ status: "pagar", vit: "a", svart: "b", tur: "w", klocka: null, senastDragAt: NU, ...o });
  it("utan klocka: den på tur varnas efter 4 min, motståndaren får avsluta efter 5 min", () => {
    assert.deepEqual(lamnatLage(utan(), "a", NU + 3 * MIN), { varning: false, kanKrava: false, minTidSlut: false, kravOm: MIN });
    assert.equal(lamnatLage(utan(), "a", NU + 4 * MIN).varning, true);
    assert.equal(lamnatLage(utan(), "b", NU + 4 * MIN + 59_000).kanKrava, false);
    assert.equal(lamnatLage(utan(), "b", NU + 5 * MIN).kanKrava, true);
    assert.equal(lamnatLage(utan(), "a", NU + 10 * MIN).kanKrava, false, "den på tur kan aldrig kräva vinst");
  });
  it("med klocka: kräv vinsten bara när motståndarens tid är slut; ingen 4/5-minutersregel", () => {
    const p = utan({ klocka: { minuter: 5, vitMs: 60_000, svartMs: 5 * MIN, senastDragAt: NU } });
    assert.equal(lamnatLage(p, "b", NU + 59_000).kanKrava, false);
    assert.equal(lamnatLage(p, "b", NU + 59_000).kravOm, 1_000);
    assert.equal(lamnatLage(p, "b", NU + 60_000).kanKrava, true);
    assert.equal(lamnatLage(p, "a", NU + 60_000).minTidSlut, true);
    assert.equal(lamnatLage(p, "a", NU + 4 * MIN).varning, false);
  });
  it("slutat parti eller åskådare: inget", () => {
    assert.equal(lamnatLage(utan({ status: "slut" }), "b", NU + 9 * MIN).kanKrava, false);
    assert.equal(lamnatLage(utan(), "x", NU + 9 * MIN).kanKrava, false);
  });
});

describe("slutrutan (§7.2)", () => {
  const p = (resultat, orsak) => ({ vit: "a", svart: "b", vitNamn: "Elias", svartNamn: "Sara", resultat, orsak, status: "slut" });
  it("texterna från båda sidor", () => {
    assert.equal(slutText(p("1-0", "gav-upp"), "a").titel, "Du vann! Sara gav upp. 🎉");
    assert.equal(slutText(p("1-0", "gav-upp"), "b").titel, "Du gav upp – Elias vann.");
    assert.equal(slutText(p("1-0", "matt"), "b").titel, "Schack matt – Elias vann.");
    assert.equal(slutText(p("0-1", "matt"), "b").titel, "Schack matt – du vann! 🎉");
    assert.equal(slutText(p("0-1", "tid"), "b").titel, "Du vann! Elias tid tog slut. 🎉");
    assert.equal(slutText(p("1-0", "tid"), "a").titel, "Du vann! Saras tid tog slut. 🎉");
    assert.equal(slutText(p("0-1", "tid"), "a").titel, "Din tid tog slut – Sara vann.");
    assert.equal(slutText(p("0-1", "lamnade"), "a").titel, "Sara avslutade partiet och vann.");
    assert.equal(slutText(p("½-½", "remi"), "a").text, "Ni kom överens om remi.");
    assert.equal(slutText(p("½-½", "remi"), "a", "upprepning").text, "Samma ställning har kommit tre gånger.");
    assert.equal(slutText(p("½-½", "patt"), "a").titel, "Patt – remi!");
    const avb = slutText(p(null, "avbrutet"), "a");
    assert.deepEqual([avb.titel, avb.vinnare, avb.resultat], ["Partiet avbröts", null, "½-½"]);
    assert.equal(slutText(p("1-0", "matt"), "a").vinnare, "w");
  });
  it("fargFor / motstandare", () => {
    assert.deepEqual([fargFor(p(), "a"), fargFor(p(), "b"), fargFor(p(), "x")], ["w", "b", null]);
    assert.deepEqual(motstandare(p(), "a"), { uid: "b", namn: "Sara" });
  });
});

describe("brädet följer serverns draglista: dragDiff", () => {
  it("lika / ett nytt drag / ladda om", () => {
    assert.deepEqual(dragDiff(["e4"], ["e4"]), { typ: "lika" });
    assert.deepEqual(dragDiff(["e4"], ["e4", "e5"]), { typ: "ett", san: "e5" });
    assert.deepEqual(dragDiff([], ["e4"]), { typ: "ett", san: "e4" });
    assert.deepEqual(dragDiff(["e4", "e5"], ["e4"]), { typ: "ladda" });
    assert.deepEqual(dragDiff(["d4"], ["e4", "e5"]), { typ: "ladda" });
    assert.deepEqual(dragDiff([], ["e4", "e5", "Nf3"]), { typ: "ladda" });
  });
});

describe("markupen", () => {
  const vy = lobbyVy({
    vantar: { a: { namn: "Alva <b>", klocka: 10, sedan: NU } },
    utmaningar: { u1: { fran: "a", franNamn: "Alva", till: "c", klocka: null, sedan: NU } },
    partier: {},
  }, "c", NU);
  it("väntar-kort: 'Alva väntar · 10 min' + Spela!, namnet escapas", () => {
    const html = vantarHtml(vy, { avatarFor: () => "<i>A</i>" });
    assert.match(html, /<b>Alva &lt;b&gt;<\/b> väntar · 10 min/);
    assert.match(html, /data-act="spela" data-uid="a"/);
    assert.match(html, /<i>A<\/i>/);
    assert.match(vantarHtml(lobbyVy({}, "c", NU)), /Ingen väntar just nu/);
  });
  it("klockvalet: ingen/5/10/15 som radioknappar, valet markerat", () => {
    const html = klockvalHtml(5);
    assert.equal((html.match(/role="radio"/g) || []).length, 4);
    assert.match(html, /data-klocka="" aria-checked="false">Ingen klocka/);
    assert.match(html, /data-klocka="5" aria-checked="true">5 min/);
  });
  it("min del: Vänta-knappen, eller 'Du väntar' + Sluta vänta; utmanad kompis + Ta tillbaka", () => {
    assert.match(minDelHtml(vy, { klocka: 10 }), /data-act="vanta"/);
    const vantar = lobbyVy({ vantar: { c: { namn: "Cleo", klocka: 15, sedan: NU } } }, "c", NU);
    const html = minDelHtml(vantar, { klocka: 10 });
    assert.match(html, /Du väntar på en motståndare · 15 min/);
    assert.match(html, /data-act="sluta-vanta"/);
    assert.doesNotMatch(html, /data-act="vanta"/);
    const utm = lobbyVy({ utmaningar: { u: { fran: "c", till: "a", klocka: null, sedan: NU } } }, "c", NU);
    assert.match(minDelHtml(utm, { klocka: null, utmanadNamn: "Alva" }), /Du har utmanat Alva \(ingen klocka\)[\s\S]*data-act="ta-tillbaka"/);
    assert.match(minDelHtml(vy, { klocka: 10, upptagen: true }), /data-act="vanta" disabled/);
  });
  it("utmana-listan: spelar/utmanad = knappen avstängd", () => {
    const html = utmanaHtml([{ uid: "x", namn: "X", spelar: true }, { uid: "y", namn: "Y" }], { klocka: 5 });
    assert.match(html, /data-uid="x" disabled/);
    assert.match(html, /data-uid="y">Utmana/);
    assert.match(html, /gäller 5 min/);
  });
  it("pågående partier och den inkommande utmaningen ('Alva vill spela schack med dig (ingen klocka)')", () => {
    assert.match(pagaendeHtml(lobbyVy({ partier: { p: { vit: "a", svart: "b", vitNamn: "Elias", svartNamn: "Sara", klocka: 10, start: NU } } }, "c", NU)), /Elias – Sara/);
    const html = inkommandeHtml(vy.inkommande);
    assert.match(html, /Alva vill spela schack med dig \(ingen klocka\)/);
    assert.match(html, /data-act="svara-ja" data-id="u1"[^>]*>Spela!/);
    assert.match(html, /data-act="svara-nej" data-id="u1"[^>]*>Nej tack/);
  });
  it("startsidan: kortet 'Spela mot en kompis' är öppet bara när kompisläget finns", () => {
    assert.match(startHtml(null), /data-act="kompis" aria-disabled="true"/);
    const html = startHtml(null, { kompis: true });
    assert.doesNotMatch(html, /data-act="kompis" aria-disabled/);
    assert.match(html, /Utmana någon i klassen/);
    assert.equal((html.match(/Kommer snart/g) || []).length, 2);
  });
});
