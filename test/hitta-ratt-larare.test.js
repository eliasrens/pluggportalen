// ============================================================================
// Hitta rätt! (#634): lärarvyns rena logik (src/hitta-ratt/larare/lhr-modell.js).
//   formulär → indata (och genom serverns normaliseraPack), facit-varningen,
//   duplicera (officiellt + eget), byte av karta/typ, namnlistan, katalogen
//   per ägare, raderingstexten, provspelets klienträttning, fliken i
//   TEACHER_TABS och bootgrafen (107).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  nyttFormular, formularFranPack, dupliceraPack, tillIndata, kontrollera, facitAndras, bytKarta,
  omradeslista, sokOmraden, laggTillOmrade, delaKatalog, klassText, raderaText, provData, tal, FACIT_VARNING,
  topplistaAndras, topplistaKvitto, TOPPLISTA_TEXT,
} from "../src/hitta-ratt/larare/lhr-modell.js";
import { normaliseraPack, EGEN_ID_RE } from "../src/hitta-ratt/delat/egna.js";

const ROT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROT, "src");
const lasJson = (rel) => JSON.parse(readFileSync(join(SRC, "hitta-ratt/content", rel), "utf8"));
const ID = "e-k3f9q0z1m2xa";
const ID2 = "e-0000000000ab";

const nycklarEu = lasJson("geo/europa.nycklar.json");
const nycklarVa = lasJson("geo/varlden.nycklar.json");
const geoOmr = (geo) => ({ [geo]: Object.fromEntries(Object.entries(lasJson(`geo/${geo}.nycklar.json`)).map(([k, id]) => [id, k])) });

const punktForm = () => ({
  ...nyttFormular(ID), title: " Gästrikland runt ", classIds: ["5A"],
  items: [
    { name: "Gävle", prompt: "", lat: "60,6749", lon: " 17.1413", kalla: "wikidata:Q25748" },
    { name: "Sandviken", prompt: "Var ligger Sandviken?", lat: 60.6167, lon: 16.7667 },
  ],
});
/** Servern sparar det normaliserade packet – så ser originalet ut vid redigering. */
const sparat = (f, geoOmraden) => ({ ...normaliseraPack(tillIndata(f), { geoOmraden }), ownerUid: "u1", version: 1 });

describe("formulär → indata", () => {
  it("nytt formulär har ett giltigt e-id och är osparat", () => {
    const f = nyttFormular(ID);
    assert.match(f.id, EGEN_ID_RE);
    assert.equal(f.sparad, false);
    assert.equal(f.type, "point");
    assert.deepEqual(f.items, []);
  });

  it("text-koordinater med komma blir tal, tomma blir undefined", () => {
    assert.equal(tal("60,6749"), 60.6749);
    assert.equal(tal(" 17.14 "), 17.14);
    assert.equal(tal(""), undefined);
    assert.equal(tal("abc"), undefined);
    const ind = tillIndata(punktForm());
    assert.deepEqual(ind.items[0], { name: "Gävle", prompt: "", lat: 60.6749, lon: 17.1413, kalla: "wikidata:Q25748" });
    assert.equal(ind.title, "Gästrikland runt");
    assert.equal(ind.startvy, "auto");
    assert.equal("sparad" in ind || "kopiaAv" in ind, false, "formulärets egna fält skickas inte");
  });

  it("indata går igenom serverns normaliseraPack", () => {
    const k = kontrollera(punktForm());
    assert.equal(k.ok, true, k.fel);
    assert.equal(k.pack.items[0].id, "gavle");
    assert.equal(k.pack.scoringConfig.fullKm, 5);
  });

  it("fel visas med serverns svenska text", () => {
    const f = punktForm();
    f.items[1].lat = "";
    assert.deepEqual(kontrollera(f), { ok: false, fel: 'Platsen för "Sandviken" saknas.' });
    f.items[1] = { name: "Paris", lat: 48.85, lon: 2.35 };
    assert.match(kontrollera(f).fel, /utanför kartan/);
    assert.match(kontrollera({ ...punktForm(), title: "" }).fel, /Namnet saknas/);
    assert.match(kontrollera({ ...punktForm(), items: [] }).fel, /minst en fråga/);
  });

  it("områdesfrågor skickar omrade + key och kontrolleras mot geofilen", () => {
    const { lista } = { lista: omradeslista(lasJson("geo/europa.namn.json"), nycklarEu) };
    let f = { ...nyttFormular(ID), title: "Norden", type: "area", geo: "europa" };
    const sv = lista.find((o) => o.key === "SWE");
    f = laggTillOmrade(f, sv);
    assert.deepEqual(tillIndata(f).items, [{ name: "Sverige", prompt: "", omrade: sv.id, key: "SWE" }]);
    assert.equal(kontrollera(f, geoOmr("europa")).ok, true);
    f.items[0].omrade = "o9999";
    assert.match(kontrollera(f, geoOmr("europa")).fel, /finns inte på kartan/);
  });

  it("ett sparat pack blir ett låst formulär och tillbaka utan förlust", () => {
    const pack = sparat(punktForm());
    const f = formularFranPack(pack);
    assert.equal(f.sparad, true);
    const igen = normaliseraPack(tillIndata(f), {});
    assert.deepEqual(igen.items, pack.items);
    assert.equal(bytKarta(f, { geo: "europa" }).form, f, "sparat: geo går inte att byta");
  });
});

describe("facit-varningen", () => {
  const original = sparat(punktForm());
  it("texter, beskrivning, ikon och klasser ändrar inte facit", () => {
    const f = formularFranPack(original);
    f.items[0].name = "Gävle stad";
    f.items[0].prompt = "Var ligger residensstaden?";
    f.description = "Ny text";
    f.classIds = ["5A", "5E"];
    f.title = "Nytt namn";
    assert.equal(facitAndras(original, f), false);
  });
  it("flyttad plats, ny eller borttagen fråga ändrar facit", () => {
    const flytt = formularFranPack(original);
    flytt.items[0].lat = "60.70";
    assert.equal(facitAndras(original, flytt), true);
    const ny = formularFranPack(original);
    ny.items.push({ name: "Hofors", lat: 60.55, lon: 16.28 });
    assert.equal(facitAndras(original, ny), true);
    const bort = formularFranPack(original);
    bort.items.pop();
    assert.equal(facitAndras(original, bort), true);
  });
  it("avrundning till 5 decimaler är ingen ändring; osparade och ogiltiga varnar inte", () => {
    const f = formularFranPack(original);
    f.items[0].lat = "60.674900001";
    assert.equal(facitAndras(original, f), false);
    assert.equal(facitAndras(null, punktForm()), false);
    const trasig = formularFranPack(original);
    trasig.items[0].lat = "";
    assert.equal(facitAndras(original, trasig), false);
    assert.match(FACIT_VARNING, /börjar om från noll/);
  });
  it("områdespack: annat område = ändrat facit", () => {
    const lista = omradeslista(lasJson("geo/europa.namn.json"), nycklarEu);
    let f = { ...nyttFormular(ID), title: "Norden", type: "area", geo: "europa" };
    for (const k of ["SWE", "NOR"]) f = laggTillOmrade(f, lista.find((o) => o.key === k));
    const orig = sparat(f, geoOmr("europa"));
    const g = formularFranPack(orig);
    g.items[1].name = "Konungariket Norge";
    assert.equal(facitAndras(orig, g, geoOmr("europa")), false);
    g.items[1].omrade = nycklarEu.FIN;
    assert.equal(facitAndras(orig, g, geoOmr("europa")), true);
  });
});

describe("duplicera", () => {
  it("officiellt punktpack: nytt id, (kopia), inga klasser, bilderna pekar på repofilen, wikidata → kalla", () => {
    const off = lasJson("packs/europa-kanda-platser.json");
    const f = dupliceraPack(off, ID2);
    assert.equal(f.id, ID2);
    assert.equal(f.sparad, false);
    assert.equal(f.kopiaAv, off.title);
    assert.equal(f.title, `${off.title} (kopia)`);
    assert.deepEqual(f.classIds, []);
    assert.equal(f.items.length, off.items.length);
    assert.equal(f.items.some((it) => "bildKalla" in it || "inom" in it), false);
    // #637: officiella bilder följer med som repofil (inget dokument, ingen kopiering)
    assert.deepEqual(f.items[0].bild, off.items[0].bild);
    assert.equal(f.kopieraFran, null);
    assert.deepEqual(tillIndata(f).items[0].bild, off.items[0].bild);
    assert.equal(f.items[0].kalla, `wikidata:${off.items[0].wikidata}`);
    assert.equal(kontrollera(f).ok, true, kontrollera(f).fel);
  });
  it("officiellt områdespack går att spara som eget", () => {
    const off = lasJson("packs/europa-lander-alla.json");
    const f = dupliceraPack(off, ID2);
    assert.equal(f.type, "area");
    assert.equal(kontrollera(f, geoOmr("europa")).ok, true);
  });
  it("eget pack: klasser och topplista följer inte med, titeln ryms i 60 tecken", () => {
    const eget = { ...sparat(punktForm()), title: "x".repeat(60), leaderboard: true, classIds: ["5A"] };
    const f = dupliceraPack(eget, ID2);
    assert.equal(f.title.length, 60);
    assert.ok(f.title.endsWith(" (kopia)"));
    assert.deepEqual(f.classIds, []);
    assert.equal("leaderboard" in tillIndata(f), false);
    assert.equal(f.leaderboard, false, "kopian startar med topplistan AV");
    assert.equal(facitAndras(eget, f), false, "en kopia är ny – ingen facit-varning");
  });
  it("kopian kan byta karta/typ: områden flyttas via källnyckeln, typbyte tömmer", () => {
    const f = dupliceraPack(lasJson("packs/europa-lander-20.json"), ID2);
    const { form, borttagna } = bytKarta(f, { geo: "varlden" }, nycklarVa);
    assert.equal(borttagna, f.items.filter((it) => !nycklarVa[it.key]).length);
    assert.ok(form.items.every((it) => it.omrade === nycklarVa[it.key]));
    assert.equal(kontrollera(form, geoOmr("varlden")).ok, true, kontrollera(form, geoOmr("varlden")).fel);
    const typ = bytKarta(f, { type: "point" });
    assert.equal(typ.form.items.length, 0);
    assert.equal(typ.borttagna, f.items.length);
  });
});

describe("namnlistan och katalogen", () => {
  it("söker på namn (början av ord först), utan accenter, och döljer valda", () => {
    const lista = omradeslista(lasJson("geo/varlden.namn.json"), nycklarVa);
    const r = sokOmraden(lista, "kongo");
    assert.deepEqual(r.map((o) => o.key).sort(), ["COD", "COG"]);
    assert.equal(sokOmraden(lista, "osterrike")[0].key, "AUT");
    const guinea = sokOmraden(lista, "guinea").map((o) => o.key);
    assert.equal(guinea.at(-1), "GNQ", "Ekvatorialguinea (inte början av ett ord) sist");
    assert.ok(guinea.includes("PNG") && guinea.includes("GNB"));
    assert.equal(sokOmraden(lista, "sverige", [nycklarVa.SWE]).length, 0);
    const f = laggTillOmrade(laggTillOmrade({ ...nyttFormular(ID), type: "area", items: [] }, lista[0]), lista[0]);
    assert.equal(f.items.length, 1, "samma område två gånger läggs inte till");
  });
  it("delaKatalog: mina och kollegors, sorterade; klass- och raderingstexter", () => {
    const katalog = { packs: {
      "e-bbbbbbbbbbbb": { title: "Öar", ownerUid: "u1", antal: 3 },
      "e-aaaaaaaaaaaa": { title: "Berg", ownerUid: "u1", antal: "4", classIds: ["5A"] },
      "e-cccccccccccc": { title: "Floder", ownerUid: "u2", ownerNamn: "Anna" },
      "sverige-stader": { title: "Fel", ownerUid: "u1" },
    } };
    const { mina, kollegor } = delaKatalog(katalog, "u1");
    assert.deepEqual(mina.map((p) => p.title), ["Berg", "Öar"]);
    assert.equal(mina[0].antal, 4);
    assert.deepEqual(mina[1].classIds, []);
    assert.deepEqual(kollegor.map((p) => p.id), ["e-cccccccccccc"]);
    assert.deepEqual(delaKatalog(null, "u1"), { mina: [], kollegor: [] });
    assert.equal(klassText(["k2", "k1", "x"], [{ id: "k1", name: "5E" }, { id: "k2", name: "5A" }]), "5A, 5E, x");
    assert.doesNotMatch(raderaText({ title: "Berg" }), /topplista/);
    assert.match(raderaText({ title: "Berg", leaderboard: true }), /topplista.*pokalen/);
  });
});

describe("provspel (rättning i klienten)", () => {
  it("punkt: samma poäng som servern, inget försök, prov-flagga", async () => {
    const pack = sparat(punktForm());
    const d = provData(pack);
    assert.equal(await d.startaForsok(), "prov");
    const svar = pack.items.map((it) => ({ itemId: it.id, lat: it.lat, lon: it.lon }));
    const res = await d.skickaOmgang("prov", svar);
    assert.equal(res.prov, true);
    assert.equal(res.leaderboard, false);
    assert.equal(res.result.s, 200);
    assert.equal(res.result.godkanda, 2);
  });
  it("område: snabba klick godtas, fel område räknas fel", async () => {
    const off = lasJson("packs/sverige-landskap.json");
    const ids = Object.values(lasJson("geo/sverige-landskap.nycklar.json"));
    const d = provData(off, ids);
    const svar = off.items.map((it, i) => ({ itemId: it.id, omrade: i === 0 ? off.items[1].omrade : it.omrade, ms: 50 }));
    const res = await d.skickaOmgang("prov", svar);
    assert.equal(res.result.r, off.items.length - 1);
  });
});

describe("lärarfliken och bootgrafen", () => {
  it("Hitta rätt! är en underflik i Material (#806) med lazy import av lärarsidan", () => {
    const src = readFileSync(join(SRC, "teacher-material-flikar.js"), "utf8");
    assert.match(src, /key: "hitta-ratt"[^\n]*admin: true/);
    assert.match(src, /import\("\.\/hitta-ratt\/larare\/page-larare-hitta-ratt\.js"\)\)\.pageLarareHittaRatt/);
    for (const f of ["teacher-shared.js", "teacher-material-flikar.js", "teacher-material.js"]) {
      assert.doesNotMatch(readFileSync(join(SRC, f), "utf8"), /^import .*hitta-ratt/m, `${f}: ingen statisk import`);
    }
  });
  it("lärarmodulerna är max 400 rader", () => {
    for (const f of ["page-larare-hitta-ratt", "lhr-fardiga", "lhr-mina", "lhr-redigera", "lhr-fragor", "lhr-data", "lhr-provspel", "lhr-modell"]) {
      const n = readFileSync(join(SRC, "hitta-ratt/larare", `${f}.js`), "utf8").split("\n").length;
      assert.ok(n <= 400, `${f}: ${n}`);
    }
  });
});

describe("bootgrafen (#271)", () => {
  it("lärarvyns filer laddas bara dynamiskt, grafen är kvar på 107", async () => {
    const { resolve } = await import("node:path");
    const start = join(SRC, "app.js");
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const file = queue.shift();
      let src;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
      let m;
      while ((m = re.exec(src))) {
        const next = resolve(dirname(file), m[1]);
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    assert.equal([...seen].some((f) => f.includes("/hitta-ratt/larare/")), false);
    assert.equal(seen.size, 107);
  });
});

describe("kryssrutan Skoltopplista (#635)", () => {
  it("standard AV; följer packen vid redigering; skickas aldrig med sparningen", () => {
    assert.equal(nyttFormular(ID).leaderboard, false);
    const pa = formularFranPack({ ...sparat(punktForm()), leaderboard: true });
    assert.equal(pa.leaderboard, true);
    assert.equal(formularFranPack(sparat(punktForm())).leaderboard, false);
    assert.equal("leaderboard" in tillIndata(pa), false);
  });
  it("hittaRattSattTopplista anropas bara när kryssrutan ändrats", () => {
    const orig = { ...sparat(punktForm()), leaderboard: true };
    const f = formularFranPack(orig);
    assert.equal(topplistaAndras(orig, f), false);
    assert.equal(topplistaAndras(orig, { ...f, leaderboard: false }), true);
    assert.equal(topplistaAndras(null, nyttFormular(ID)), false, "nytt område, AV = inget anrop");
    assert.equal(topplistaAndras(null, { ...nyttFormular(ID), leaderboard: true }), true);
  });
  it("förklaringen säger vad PÅ och AV innebär; kvittot pekar på 🏆", () => {
    assert.match(TOPPLISTA_TEXT.pa, /Top 15/);
    assert.match(TOPPLISTA_TEXT.pa, /pokal/);
    assert.match(TOPPLISTA_TEXT.av, /ingen topplista/);
    assert.match(topplistaKvitto(true, "5A, 5E"), /Topplistor/);
    assert.match(topplistaKvitto(true, ""), /ingen klass/);
    assert.match(topplistaKvitto(false, "5A"), /avstängd/);
  });
});
