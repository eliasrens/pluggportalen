// ============================================================================
// Schack 2B (#780): lyssnaren på klassdokumentet (EN onSnapshot, stängs när
// eleven lämnar), förhandsvisningens låtsas-server (den riktiga serverkärnan –
// ett helt parti spelas igenom) och källkoden (ingen ångra/tips/varna mot
// kompisar, allt lat, unsubscribe vid lämna, datorräknaren).
// Logiken och markupen: test/schack-kompis.test.js.
// Körs med: node --test test/schack-kompis-lyssnare.test.js
// ============================================================================

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { topplistaRader, lamnatLage } from "../src/schack/schack-kompis-data.js";
import { bevakaKlass, stangKompis, lyssnarPaKlass, senasteKlass, LAT_STANG_MS, markeraLamnat, arLamnat } from "../src/schack/schack-kompis.js";
import { skapaFalskDb } from "../preview/schack-kompis/falsk-db.js";
import { skapaFalskMoln } from "../preview/schack-kompis/falsk-moln.js";
import { seedKlass, KLASS_ID } from "../preview/schack-kompis/klassen.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const las = (p) => readFileSync(join(ROOT, p), "utf8");
/** Källkoden utan kommentarer. */
const kod = (p) => las(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60_000;

describe("lyssnaren på klassdokumentet (§9): EN, stängs när eleven lämnar", () => {
  const minne = new Map();
  const lagring = { getItem: (k) => minne.get(k) ?? null, setItem: (k, v) => minne.set(k, String(v)), removeItem: (k) => minne.delete(k) };
  const db = skapaFalskDb({ lagring });
  seedKlass(db);
  const alva = skapaFalskMoln({ db, uid: "pv-alva", fordrojningMs: 0 });
  const k = { moln: async () => alva, classId: KLASS_ID, uid: "pv-alva" };
  after(() => { stangKompis({ slutaVanta: false }); db.stang(); });

  it("tre vyer delar EN onSnapshot; när sista släpper stängs den efter en kort stund", async () => {
    const fick = [];
    const s1 = bevakaKlass(k, (kl) => fick.push(["1", kl.finns]));
    const s2 = bevakaKlass(k, () => fick.push(["2"]));
    await vanta(20);
    const s3 = bevakaKlass(k, () => fick.push(["3"]));
    await vanta(20);
    assert.equal(alva.oppna.klass, 1, "en lyssnare");
    assert.ok(fick.some(([v]) => v === "3"), "en sen vy får senaste klassdokumentet direkt");
    s1(); s2(); s3();
    assert.equal(alva.oppna.klass, 1, "inte direkt (en vy som byts mot en annan återanvänder lyssnaren)");
    const s4 = bevakaKlass(k, () => {});
    await vanta(LAT_STANG_MS + 100);
    assert.equal(alva.oppna.klass, 1, "en ny vy hann ta över");
    s4();
    await vanta(LAT_STANG_MS + 100);
    assert.equal(alva.oppna.klass, 0, "stängd när ingen vy använder den");
    assert.equal(lyssnarPaKlass(), false);
  });

  it("stangKompis (route-byte, utloggning, pagehide): stänger direkt och tar bort elevens väntan", async () => {
    bevakaKlass(k, () => {});
    await alva.lobby.vanta(KLASS_ID, 5);
    await vanta(20);
    assert.ok(senasteKlass().vantar["pv-alva"], "väntar");
    stangKompis();
    assert.equal(alva.oppna.klass, 0);
    await vanta(20);
    assert.deepEqual(Object.keys(db.las(`schackKlass/${KLASS_ID}`).vantar), [], "schackSlutaVanta anropades");
    assert.equal(alva.logg.at(-1).namn, "schackSlutaVanta");
    const antal = alva.logg.length;
    bevakaKlass(k, () => {});
    await vanta(20);
    stangKompis();
    await vanta(20);
    assert.equal(alva.logg.length, antal, "ingen väntan = inget anrop");
  });

  it("markeraLamnat: flödet hoppar inte tillbaka in i ett parti eleven lämnat", () => {
    assert.equal(arLamnat("p-x"), false);
    markeraLamnat("p-x");
    assert.equal(arLamnat("p-x"), true);
  });
});

describe("förhandsvisningens låtsas-server kör den riktiga serverkärnan", () => {
  const minne = new Map();
  const lagring = { getItem: (k) => minne.get(k) ?? null, setItem: (k, v) => minne.set(k, String(v)), removeItem: (k) => minne.delete(k) };
  const db = skapaFalskDb({ lagring });
  seedKlass(db);
  let spola = 0;
  const a = skapaFalskMoln({ db, uid: "pv-alva", fordrojningMs: 0, spola: () => spola });
  const b = skapaFalskMoln({ db, uid: "pv-bilal", fordrojningMs: 0, spola: () => spola });
  after(() => db.stang());

  it("utmana → svara → narrmatt; tabellen uppdateras, partiet försvinner ur lobbyn, fel som SchackMolnFel", async () => {
    const { utmaningId } = await a.lobby.utmana(KLASS_ID, "pv-bilal", 5);
    const { partiId } = await b.lobby.svara(utmaningId, true, KLASS_ID);
    const sett = [];
    const stopp = a.lyssnaParti(partiId, (p) => sett.push(p?.drag?.length));
    const p0 = db.las(`schackPartier/${partiId}`);
    const vit = p0.vit === "pv-alva" ? a : b;
    const svart = vit === a ? b : a;
    await assert.rejects(svart.parti.drag(partiId, { from: "e7", to: "e5" }), (e) => e.code === "failed-precondition");
    for (const [m, d] of [[vit, ["f2", "f3"]], [svart, ["e7", "e5"]], [vit, ["g2", "g4"]], [svart, ["d8", "h4"]]]) {
      await m.parti.drag(partiId, { from: d[0], to: d[1] });
    }
    await vanta(20);
    stopp();
    assert.equal(a.oppna.parti, 0);
    const slut = db.las(`schackPartier/${partiId}`);
    assert.deepEqual([slut.status, slut.resultat, slut.orsak], ["slut", "0-1", "matt"]);
    assert.ok(sett.includes(4), "lyssnaren såg sista draget");
    const klass = db.las(`schackKlass/${KLASS_ID}`);
    assert.deepEqual(klass.partier, {});
    const uSvart = svart === a ? "pv-alva" : "pv-bilal";
    assert.equal(klass.tabell[uSvart].vinster, 1);
    assert.equal(topplistaRader(klass.tabell, uSvart)[0].uid, uSvart);
  });

  it("tiden (spolad) – kräv vinst nekas före 5 min utan klocka, går efter", async () => {
    await a.lobby.vanta(KLASS_ID, null);
    const { partiId } = await b.lobby.gaMed(KLASS_ID, "pv-alva");
    const p = db.las(`schackPartier/${partiId}`);
    const motst = p.vit === "pv-alva" ? b : a; // den som INTE är på tur (vit drar först)
    await assert.rejects(motst.parti.kravaVinst(partiId), (e) => e.code === "failed-precondition");
    spola = 5 * MIN;
    assert.equal(lamnatLage(db.las(`schackPartier/${partiId}`), p.svart, a.serverNow()).kanKrava, true);
    await motst.parti.kravaVinst(partiId);
    assert.equal(db.las(`schackPartier/${partiId}`).orsak, "lamnade");
  });
});

describe("källkoden: kompisläget (§7.2, §9, #271)", () => {
  const KOMPIS = ["schack-kompis-vy.js", "schack-lobby-vy.js", "schack-kompis.js", "schack-kompis-data.js", "schack-kompis-delar.js"];
  it("ingen ångra, inga tips och ingen 'Varna mig' mot klasskompisar", () => {
    for (const f of KOMPIS) {
      const k = kod(`src/schack/${f}`);
      assert.doesNotMatch(k, /\.undo\(|showArrow|analyseraVarning|schack-varning|schack-dator|\.tips\(/, f);
      assert.doesNotMatch(k, /data-act="(angra|tips|varna)/, f);
      assert.doesNotMatch(k, /Ångra|Tips|Varna mig/, f);
    }
  });
  it("partiet: EN lyssnare (lyssnaParti) som stängs i destroy; lobbyn och rutan släpper bevakaKlass i destroy", () => {
    const vy = kod("src/schack/schack-kompis-vy.js");
    assert.equal((vy.match(/lyssnaParti\(/g) || []).length, 1);
    assert.match(vy, /stoppParti = m\.lyssnaParti\(/);
    assert.match(vy, /function stoppa\(\) \{[\s\S]*?stoppParti\?\.\(\)[\s\S]*?\}/);
    assert.match(vy, /destroy\(\) \{[\s\S]*?stoppa\(\);/);
    assert.doesNotMatch(vy, /lyssnaKlass|onSnapshot/);
    const lobby = kod("src/schack/schack-lobby-vy.js");
    assert.equal((lobby.match(/const sluta = bevakaKlass\(/g) || []).length, 2, "lobbyn och utmaningsrutan");
    assert.equal((lobby.match(/destroy\(\) \{[\s\S]*?sluta\(\);/g) || []).length, 2);
    assert.doesNotMatch(lobby, /lyssnaKlass|lyssnaParti|onSnapshot/, "bara via den delade lyssnaren");
    assert.equal((kod("src/schack/schack-kompis.js").match(/lyssnaKlass\(/g) || []).length, 1, "EN onSnapshot på klassdokumentet");
  });
  it("sidan stänger allt när eleven lämnar: route-byte, pagehide (och utloggning = route-byte till #/)", () => {
    const sida = kod("src/schack/page-schack.js");
    assert.match(sida, /addEventListener\("hashchange", stada\)/);
    assert.match(sida, /addEventListener\("pagehide", gomd\)/);
    assert.match(sida, /stangSchack\(\)/);
    assert.match(kod("src/schack/schack-flode.js"), /export function stangSchack\(\) \{[\s\S]*?kompisModul\?\.stangKompis\(\);/);
    assert.match(kod("src/schack/schack-flode.js"), /destroy\(\) \{[\s\S]*?lobbyAv\(\);/);
  });
  it("allt nytt ligger i src/schack/ och laddas lat (import()); bara schack-moln.js talar med Firebase", () => {
    const flode = kod("src/schack/schack-flode.js");
    for (const f of ["schack-kompis.js", "schack-lobby-vy.js", "schack-kompis-vy.js"]) {
      assert.match(flode, new RegExp(`import\\("\\./${f.replace(".", "\\.")}"\\)`), f);
      assert.doesNotMatch(flode, new RegExp(`^import [^;]*"\\./${f.replace(".", "\\.")}"`, "m"), `${f} statiskt`);
    }
    const sida = kod("src/schack/page-schack.js");
    assert.match(sida, /import\("\.\/schack-moln\.js"\)/);
    assert.doesNotMatch(sida, /^import [^;]*schack-moln/m);
    for (const f of KOMPIS) assert.doesNotMatch(kod(`src/schack/${f}`), /firebase|firestore|setDoc|updateDoc|confirm\(|awardCoins|coins\b/i, f);
  });
  it("kroken för helskärmsknappen (#783): verktygsraden och hela vyn finns i vyns API", () => {
    const vy = kod("src/schack/schack-kompis-vy.js");
    assert.match(vy, /<div class="schack-parti-verktyg" data-krok="verktyg"><\/div>/);
    assert.match(vy, /element: host,/);
    assert.match(vy, /verktyg: host\.querySelector\("\.schack-parti-verktyg"\)/);
  });
  it("datorpartiet räknas EN gång (raknad) via datorPartiKlart", () => {
    const vy = kod("src/schack/schack-dator-vy.js");
    assert.match(vy, /const nyttSlut = !parti\.raknad;\s*parti\.raknad = true;/);
    assert.match(vy, /if \(nyttSlut && o\.onSlut\)/);
    assert.match(kod("src/schack/page-schack.js"), /onDatorSlut: \(\) => \{ moln\(\)\.then\(\(m\) => m\.datorPartiKlart\(\)\)/);
  });
});
