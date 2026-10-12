// ============================================================================
// Hitta rätt! (#637, arkitektur §11.8): bilder i lärarens egna pack – ren logik.
//   commons.js     licensvitlistan, Artist-rensning, sökning/P18 (fetch-stub)
//   lhr-skala.js   skalstegen 800 → 640 → 480 px × kvalitet, WebP → JPEG (stubbar)
//   delat/egna.js  normBild + normaliseraPack behåller bilden, facit påverkas inte
//   hr-bild.js     Bytes → objectURL, cache, saknad bild, revoke, repofil
//   lhr-modell.js  duplicera eget pack → kopieraFran, tillIndata skickar bara bilden
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CommonsFel, fotografUr, licens, rensaHtml, skapaCommons, traffUr } from "../src/hitta-ratt/larare/commons.js";
import { KVALITETER, MAX_BYTES, SkalaFel, matt, skalaBild } from "../src/hitta-ratt/larare/lhr-skala.js";
import { normBild, normaliseraPack } from "../src/hitta-ratt/delat/egna.js";
import { facitNyckel } from "../src/hitta-ratt/delat/facit.js";
import { attributionHtml, repoUrl, skapaBildCache } from "../src/hitta-ratt/hr-bild.js";
import { dupliceraPack, formularFranPack, tillIndata } from "../src/hitta-ratt/larare/lhr-modell.js";

const ID = "e-k3f9q0z1m2xa";
const BILD_ID = `${ID}--a8d0c2kq`;
const m = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));

describe("commons.js: licensvitlistan", () => {
  it("godkänner PD, CC0, CC BY och CC BY-SA med rätt namn och länk", () => {
    assert.deepEqual(licens(m({ License: "pd", LicenseShortName: "Public domain" })), { licens: "Public domain", licensUrl: "https://creativecommons.org/publicdomain/mark/1.0/" });
    assert.equal(licens(m({ License: "", LicenseShortName: "Public domain" })).licens, "Public domain");
    assert.equal(licens(m({ License: "cc0" })).licens, "CC0 1.0");
    assert.deepEqual(licens(m({ License: "cc-by-4.0", LicenseUrl: "http://creativecommons.org/licenses/by/4.0" })), { licens: "CC BY 4.0", licensUrl: "https://creativecommons.org/licenses/by/4.0" });
    assert.deepEqual(licens(m({ License: "cc-by-sa-3.0" })), { licens: "CC BY-SA 3.0", licensUrl: "https://creativecommons.org/licenses/by-sa/3.0/" });
  });
  it("nekar allt annat (NC, ND, GFDL, okänd, saknad)", () => {
    for (const kod of ["cc-by-nc-4.0", "cc-by-nd-4.0", "cc-by-nc-sa-2.0", "gfdl", "fal", "attribution", ""]) {
      assert.equal(licens(m({ License: kod, LicenseShortName: kod })), null, kod);
    }
    assert.equal(licens(), null);
  });
});

describe("commons.js: Artist rensas från HTML", () => {
  it("länkar, entiteter och blanksteg bort", () => {
    assert.equal(rensaHtml('<a href="//commons.wikimedia.org/wiki/User:X" title="User:X">Jane &amp; Doe</a>\n<span>(talk)</span>'), "Jane & Doe (talk)");
    assert.equal(rensaHtml("<bdi>Ann&nbsp;O&#39;Neil</bdi>&#8203;"), "Ann O'Neil");
    assert.equal(rensaHtml(null), "");
  });
  it("fotograf: Artist, annars Credit, annars 'okänd', högst 160 tecken", () => {
    assert.equal(fotografUr(m({ Artist: "<a>I99pema</a>" })), "I99pema");
    assert.equal(fotografUr(m({ Artist: "<span></span>", Credit: "Eget verk" })), "Eget verk");
    assert.equal(fotografUr({}), "okänd");
    assert.equal(fotografUr(m({ Artist: "x".repeat(400) })).length, 160);
  });
});

const sida = (titel, lic, extra = {}) => ({
  title: titel, index: extra.index ?? 1,
  imageinfo: [{ thumburl: `https://upload.wikimedia.org/thumb/${titel}/330px.jpg`, thumbwidth: 330, thumbheight: 220,
    descriptionurl: `https://commons.wikimedia.org/wiki/${titel}`, extmetadata: m({ License: lic, Artist: "<a>Foto</a>" }) }],
});
function fetchStub(svar) {
  const urls = [];
  const f = async (url) => {
    urls.push(url);
    const s = typeof svar === "function" ? svar(url) : svar;
    if (s instanceof Error) throw s;
    return { ok: (s.status ?? 200) < 400, status: s.status ?? 200, json: async () => s.body };
  };
  f.urls = urls;
  return f;
}

describe("commons.js: sökning och P18", () => {
  it("sok: bara bilder med godkänd licens, i sökordningen, 330-miniatyrer", async () => {
    const f = fetchStub({ body: { query: { pages: {
      1: sida("File:B.jpg", "cc-by-sa-4.0", { index: 2 }), 2: sida("File:A.jpg", "cc0", { index: 1 }), 3: sida("File:NC.jpg", "cc-by-nc-4.0", { index: 3 }),
    } } } });
    const t = await skapaCommons({ fetch: f }).sok("Gävle rådhus");
    assert.deepEqual(t.map((x) => x.fil), ["File:A.jpg", "File:B.jpg"]);
    assert.equal(t[1].licens, "CC BY-SA 4.0");
    assert.equal(t[1].fotograf, "Foto");
    assert.match(f.urls[0], /generator=search/);
    assert.match(f.urls[0], /gsrnamespace=6/);
    assert.match(f.urls[0], /filetype%3Abitmap/);
    assert.match(f.urls[0], /iiurlwidth=330/);
    assert.match(f.urls[0], /origin=\*/);
  });
  it("info: 960-miniatyren för vald fil, licens utanför vitlistan → null", async () => {
    const f = fetchStub((url) => ({ body: { query: { pages: { 1: sida("File:X.jpg", url.includes("NC") ? "cc-by-nc-4.0" : "pd") } } } }));
    const c = skapaCommons({ fetch: f });
    assert.equal((await c.info("X.jpg")).fil, "File:X.jpg");
    assert.match(f.urls[0], /titles=File%3AX\.jpg/);
    assert.match(f.urls[0], /iiurlwidth=960/);
    assert.equal(await c.info("File:NC.jpg"), null);
    assert.equal(traffUr({}), null);
  });
  it("p18: Wikidatas bild för Q-id, ogiltigt id → inget anrop", async () => {
    const f = fetchStub({ body: { entities: { Q25748: { claims: { P18: [{ rank: "normal", mainsnak: { datavalue: { value: "Gävle rådhus.jpg" } } }] } } } } });
    const c = skapaCommons({ fetch: f });
    assert.equal(await c.p18("Q25748"), "Gävle rådhus.jpg");
    assert.match(f.urls[0], /wbgetentities/);
    assert.equal(await c.p18("gävle"), null);
    assert.equal(f.urls.length, 1);
  });
  it("fel: 429, 5xx och nätfel → CommonsFel med svensk text", async () => {
    for (const [svar, code] of [[{ status: 429 }, "429"], [{ status: 503 }, "server"], [new Error("offline"), "nat"]]) {
      await assert.rejects(skapaCommons({ fetch: fetchStub(svar) }).sok("x"), (e) => e instanceof CommonsFel && e.code === code && /[a-zåäö]/.test(e.message));
    }
  });
});

/** Canvas-stub: storleken = pixlar × kvalitet × faktor; webp = false → webbläsaren saknar WebP-kodning. */
function stubbar({ w, h, faktor, webp = true }) {
  const logg = [];
  const canvas = (bredd, hojd) => ({
    rita: () => {},
    tillBlob: async (typ, q) => {
      const ut = typ === "image/webp" && !webp ? "image/png" : typ;
      logg.push({ bredd, hojd, typ: ut, q });
      return { type: ut, size: Math.round(bredd * hojd * q * faktor) };
    },
  });
  let stangd = false;
  return { logg, avkoda: async () => ({ width: w, height: h, close: () => { stangd = true; } }), canvas, stangd: () => stangd };
}

describe("lhr-skala.js: skalstegen ned till ≤ 120 kB", () => {
  it("liten nog direkt: 800 px, kvalitet 0,82, WebP", async () => {
    const s = stubbar({ w: 960, h: 640, faktor: 0.2 });
    const r = await skalaBild({}, s);
    assert.deepEqual([r.bredd, r.hojd, r.mime, r.kvalitet], [800, 533, "image/webp", 0.82]);
    assert.ok(r.blob.size <= MAX_BYTES);
    assert.equal(s.stangd(), true, "ImageBitmap stängs");
  });
  it("sänker kvaliteten först, sedan 640 och 480 px", async () => {
    const s = stubbar({ w: 4000, h: 3000, faktor: 1 });
    const r = await skalaBild({}, s);
    assert.deepEqual(s.logg.slice(0, 4).map((x) => [x.bredd, x.q]), KVALITETER.map((q) => [800, q]));
    assert.equal(r.bredd, 480);
    assert.ok(r.blob.size <= MAX_BYTES);
    assert.ok(s.logg.some((x) => x.bredd === 640));
  });
  it("utan WebP-kodning → JPEG", async () => {
    const s = stubbar({ w: 800, h: 600, faktor: 0.2, webp: false });
    const r = await skalaBild({}, s);
    assert.equal(r.mime, "image/jpeg");
  });
  it("skalar aldrig upp; för stor även på 480 px → SkalaFel; oläslig → SkalaFel", async () => {
    assert.deepEqual(matt(300, 200, 800), { bredd: 300, hojd: 200 });
    assert.deepEqual(matt(600, 1200, 800), { bredd: 400, hojd: 800 });
    await assert.rejects(skalaBild({}, stubbar({ w: 4000, h: 4000, faktor: 50 })), SkalaFel);
    await assert.rejects(skalaBild({}, { avkoda: async () => { throw new Error("x"); } }), /gick inte att läsa/);
  });
});

describe("delat/egna.js: bilden i packet", () => {
  const commonsBild = { id: BILD_ID, kalla: "commons", fil: "Gävle rådhus 01.jpg", fotograf: "I99pema", licens: "CC BY-SA 4.0",
    licensUrl: "https://creativecommons.org/licenses/by-sa/4.0/", kallaUrl: "https://commons.wikimedia.org/wiki/File:X.jpg", bredd: 800, hojd: 533 };
  it("normBild: Commons-bild kvar, okända fält bort, http-länkar bort", () => {
    assert.deepEqual(normBild({ ...commonsBild, data: "x", ownerUid: "y" }), commonsBild);
    const b = normBild({ ...commonsBild, licensUrl: "javascript:alert(1)", kallaUrl: "http://x" });
    assert.equal("licensUrl" in b, false);
    assert.equal("kallaUrl" in b, false);
  });
  it("normBild: egen bild utan attribution, repofil från officiellt pack, skräp → null", () => {
    assert.deepEqual(normBild({ id: BILD_ID, kalla: "egen", fotograf: "x", licens: "y", bredd: 640, hojd: 480 }), { id: BILD_ID, kalla: "egen", bredd: 640, hojd: 480 });
    assert.equal(normBild({ fil: "eiffeltornet.webp", kalla: "Tour Eiffel.jpg", licens: "Public domain" }).fil, "eiffeltornet.webp");
    for (const fel of [null, "x", {}, { id: "e-annat--a" }, { id: `${ID}--A8D0C2KQ` }, { fil: "../hemlig.webp" }, { fil: "x.jpg" }]) {
      assert.equal(normBild(fel), null, JSON.stringify(fel));
    }
  });
  it("normaliseraPack behåller bilden i båda frågetyperna, facitnyckeln påverkas inte", () => {
    const pack = { id: ID, title: "T", type: "point", geo: "sverige-landskap", items: [{ id: "gavle", name: "Gävle", lat: 60.67, lon: 17.14, bild: commonsBild }] };
    const p = normaliseraPack(pack);
    assert.deepEqual(p.items[0].bild, commonsBild);
    assert.equal(facitNyckel(p), facitNyckel(normaliseraPack({ ...pack, items: [{ ...pack.items[0], bild: undefined }] })));
    const omr = normaliseraPack({ id: ID, title: "T", type: "area", geo: "sverige-landskap", items: [{ name: "Uppland", omrade: "o5", bild: { id: BILD_ID, kalla: "egen" } }] }, { geoOmraden: { "sverige-landskap": ["o5"] } });
    assert.equal(omr.items[0].bild.kalla, "egen");
  });
});

describe("hr-bild.js: spelets bilder", () => {
  const ark = () => {
    const skapade = [];
    const frigjorda = [];
    let lasningar = 0;
    const c = skapaBildCache({
      las: async (id) => {
        lasningar += 1;
        if (id === BILD_ID) return { mime: "image/webp", data: { toUint8Array: () => new Uint8Array([1, 2, 3]) } };
        if (id.endsWith("trasigtt")) throw new Error("nät");
        return null;
      },
      skapaUrl: (blob) => { skapade.push(blob); return `blob:${skapade.length}`; },
      frigor: (u) => frigjorda.push(u),
    });
    return { c, skapade, frigjorda, lasningar: () => lasningar };
  };
  it("Bytes → Blob → objectURL, en läsning per bild (förhämtning delar cachen)", async () => {
    const a = ark();
    a.c.forhamta({ id: BILD_ID });
    assert.equal(await a.c.url({ id: BILD_ID }), "blob:1");
    assert.equal(a.lasningar(), 1);
    assert.equal(a.skapade[0].type, "image/webp");
    assert.equal(a.skapade[0].size, 3);
  });
  it("saknad eller oläslig bild → null (frågan visas utan bild), fel läses om nästa gång", async () => {
    const a = ark();
    assert.equal(await a.c.url({ id: `${ID}--saknas00` }), null);
    assert.equal(await a.c.url({ id: `${ID}--trasigtt` }), null);
    await a.c.url({ id: `${ID}--trasigtt` });
    assert.equal(a.lasningar(), 3);
    assert.equal(await a.c.url(null), null);
  });
  it("officiell bild → repofilen; rensa() frigör alla objectURL", async () => {
    const a = ark();
    assert.equal(await a.c.url({ fil: "eiffeltornet.webp" }), repoUrl("eiffeltornet.webp"));
    assert.match(repoUrl("x.webp"), /hitta-ratt\/content\/bilder\/x\.webp$/);
    await a.c.url({ id: BILD_ID });
    await a.c.rensa();
    assert.deepEqual(a.frigjorda, ["blob:1"]);
  });
  it("attribution: Commons och officiella får raden, egna bilder inte", () => {
    const e = (s) => String(s).replace(/</g, "&lt;");
    assert.match(attributionHtml({ id: BILD_ID, kalla: "commons", fotograf: "<b>X</b>", licens: "CC BY 4.0", licensUrl: "https://l", kallaUrl: "https://k" }, e), /^Foto: &lt;b>X&lt;\/b>, <a href="https:\/\/l".*Wikimedia Commons<\/a>$/);
    assert.equal(attributionHtml({ id: BILD_ID, kalla: "egen" }, e), "");
    assert.equal(attributionHtml(null, e), "");
  });
});

describe("lhr-modell.js: bilder i formuläret", () => {
  const bild = { id: BILD_ID, kalla: "egen", bredd: 640, hojd: 480 };
  const eget = { id: ID, title: "Gästrikland", type: "point", geo: "sverige-landskap", ownerUid: "u",
    items: [{ id: "gavle", name: "Gävle", lat: 60.67, lon: 17.14, bild }, { id: "hofors", name: "Hofors", lat: 60.55, lon: 16.28 }] };
  it("duplicera eget pack med bilder → kopieraFran = källan, bilderna följer med", () => {
    const f = dupliceraPack(eget, "e-nyttid000001");
    assert.equal(f.kopieraFran, ID);
    assert.deepEqual(f.items[0].bild, bild);
    assert.equal(dupliceraPack({ ...eget, items: [eget.items[1]] }, "e-nyttid000001").kopieraFran, null);
  });
  it("tillIndata skickar bara den städade bilden (inte bildInfo/p18), utan bild = inget fält", () => {
    const f = formularFranPack(eget);
    f.items[0].bildInfo = "640×480 · 50 kB";
    f.items[1].p18 = "Hofors.jpg";
    const ind = tillIndata(f);
    assert.deepEqual(ind.items[0].bild, bild);
    assert.equal("bildInfo" in ind.items[0], false);
    assert.equal("bild" in ind.items[1] || "p18" in ind.items[1], false);
    assert.equal("kopieraFran" in ind, false, "kopieraFran skickas vid sidan av packet");
  });
});
