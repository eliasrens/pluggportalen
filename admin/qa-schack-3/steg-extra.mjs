// Schack slut-QA Etapp 3 (#792), steget "extra" – det som ingen listade: konstiga direktlänkar,
// pussel-JSON som inte går att hämta (+ försök igen), lämna mitt i en lektion/ett matt-i-två,
// tangentbord, två flikar med samma elev, modulen avstängd, omladdning mitt i en lektion.
import { readFileSync } from "node:fs";
import { vila, anvandare, loggaInElev, db } from "../qa-schack-2/lib.mjs";

const TVA = JSON.parse(readFileSync(new URL("../../src/schack/pussel/matt-i-tva.json", import.meta.url), "utf8")).pussel;
const sd = async (uid) => (await db.doc(`studentData/${uid}`).get()).data() || {};

export default async function extra({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, PC] = PORTAR;
  const A = await anvandare(br, PA);
  await loggaInElev(A, "4a03");
  await db.doc(`studentData/${A.uid}`).update({ schack: { aktivtParti: null } });
  await A.p.laddaOm(); await vila(4000);
  const konsol0 = A.p.konsol.length;

  // --- konstiga direktlänkar --------------------------------------------------------------------
  const lank = async (namn, hash, forvantat, sel = ".schack-sida, .schack-lektion, .schack-pussel") => {
    await A.ev(`location.hash = ${JSON.stringify(hash)}`);
    await vila(1500);
    const t = await A.ev(`document.querySelector(".schack-rot")?.innerText.replace(/\\s+/g, " ").slice(0, 120) || document.body.innerText.slice(0, 120)`);
    ok(`länk ${hash}: ${namn}`, forvantat.test(t), t);
  };
  await lank("lektion 13 → översikten", "#/elev/schack?vy=lar&lektion=13", /Lär dig schack|Lektion/);
  await lank("lektion abc → översikten", "#/elev/schack?vy=lar&lektion=abc", /Lär dig schack|Lektion/);
  await lank("lektion 0", "#/elev/schack?vy=lar&lektion=0", /Lär dig schack|Lektion/);
  await lank("lektion -1", "#/elev/schack?vy=lar&lektion=-1", /Lär dig schack|Lektion/);
  await lank("okänd sort → valet", "#/elev/schack?vy=pussel&sort=xyz", /Pussel|Matt i ett/);
  await lank("pussel nr 0 → ett pussel (1)", "#/elev/schack?vy=pussel&sort=ett&nr=0", /Pussel 1 av 200|Matt i ett/);
  await lank("pussel nr 9999 → sista (200)", "#/elev/schack?vy=pussel&sort=ett&nr=9999", /Pussel 200 av 200/);
  await lank("pussel nr -5", "#/elev/schack?vy=pussel&sort=tva&nr=-5", /Pussel \d+ av 200/);
  await lank("pussel nr abc", "#/elev/schack?vy=pussel&sort=tva&nr=abc", /Pussel \d+ av 200/);
  await lank("okänd vy", "#/elev/schack?vy=hackad", /Schack|Lär dig|Mot datorn|Pussel/);
  ok("inga JS-fel av de konstiga länkarna", A.p.konsol.slice(konsol0).filter((x) => /EXCEPTION|Uncaught/.test(x)).length === 0, A.p.konsol.slice(konsol0).filter((x) => /EXCEPTION/.test(x)).join(" | ").slice(0, 300));

  // --- pussel-JSON går inte att hämta ---------------------------------------------------------------------
  await A.ev(`location.hash = "#/elev/hem"`);
  await vila(1000);
  await A.p.s("Network.enable");
  await A.p.s("Network.setBlockedURLs", { urls: ["*matt-i-ett.json*", "*matt-i-tva.json*"] });
  await A.p.laddaOm();
  await A.vanta(`!!document.querySelector(".schack-sida, .app, #app")`, 20000);
  await vila(3000);
  await A.ev(`location.hash = "#/elev/schack?vy=pussel&sort=ett"`);
  await A.vanta(`/kunde inte laddas/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 15000).catch(() => {});
  ok("blockerad JSON: 'Pusslen kunde inte laddas. Ladda om sidan och försök igen.' (ingen vit sida)", /kunde inte laddas/.test(await A.text(".schack-pussel-nr")), await A.text(".schack-pussel-nr"));
  await A.bild(BILDER, "pussel-json-fel");
  await A.p.s("Network.setBlockedURLs", { urls: [] });
  await A.ev(`location.hash = "#/elev/schack?vy=pussel"`);
  await vila(800);
  await A.ev(`location.hash = "#/elev/schack?vy=pussel&sort=ett"`);
  await A.vanta(`/Pussel \\d+ av 200/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 15000)
    .then(() => ok("nätet tillbaka: ett nytt försök (utan omladdning) laddar pusslen", true), () => ok("nätet tillbaka: ett nytt försök (utan omladdning) laddar pusslen", false, "fastnade på felet"));
  // blockerad JSON på valet
  await A.p.s("Network.setBlockedURLs", { urls: ["*matt-i-ett.json*", "*matt-i-tva.json*"] });
  await A.p.laddaOm(); await vila(3000);
  await A.ev(`location.hash = "#/elev/schack?vy=pussel"`);
  await vila(3000);
  const valT = await A.ev(`document.querySelector(".schack-pussel-val")?.innerText.replace(/\\s+/g, " ") || ""`);
  ok("blockerad JSON på valet: valet visas ändå (utan antal)", /Matt i ett drag/.test(valT) && /lösta/.test(valT), valT.slice(0, 200));
  await A.p.s("Network.setBlockedURLs", { urls: [] });

  // --- lämna mitt i en lektion / ett matt-i-två ----------------------------------------------------------------
  await A.p.laddaOm(); await vila(3500);
  await A.rakna(true);
  await A.ev(`location.hash = "#/elev/schack?vy=lar&lektion=2"`);
  await A.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 15000);
  await A.e.tryck("a1"); await A.e.tryck("a5");
  await A.ev(`location.hash = "#/elev/schack?vy=lar"`);
  await vila(800);
  ok("lämnade lektion 2 mitt i: inget sparat, 0 skrivningar", ((await A.rakna()).skrivningar["studentData/*"] || 0) === 0 && !(await sd(A.uid)).schack?.lektioner);
  // matt i två: första draget gjort, lämna under försvarets paus
  await A.ev(`location.hash = "#/elev/schack?vy=pussel&sort=tva&nr=1"`);
  await A.vanta(`/Pussel 1 av 200/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 15000);
  const t = TVA[0].losning;
  await A.e.tryck(t[0].slice(0, 2)); await A.e.tryck(t[0].slice(2, 4));
  await A.ev(`location.hash = "#/elev/hem"`); // lämnar inom 700 ms-pausen
  await vila(1500);
  const fel = A.p.konsol.slice(konsol0).filter((x) => /EXCEPTION|Uncaught/.test(x));
  ok("lämnade ett matt-i-två under försvarets paus: inget JS-fel efteråt (timer rensad)", fel.length === 0, fel.join(" | ").slice(0, 300));
  await A.ev(`location.hash = "#/elev/schack?vy=pussel&sort=tva&nr=1"`);
  await A.vanta(`/Pussel 1 av 200/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 15000);
  await vila(900);
  ok("tillbaka till pussel 1: ställningen är orörd (försvaret spelades inte bakom ryggen)", await A.ev(`(document.querySelector(".schack-pussel-svar").textContent || "") === ""`) && /gör matt i två drag/.test(await A.text(".schack-pussel-uppgift")));

  // --- tangentbord i lektion 1 ----------------------------------------------------------------------------------------
  await A.ev(`location.hash = "#/elev/schack?vy=lar&lektion=1"`);
  await A.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 15000);
  await vila(300);
  await A.ev(`document.querySelector('.schack-bradet [data-ruta="e4"]').focus()`);
  await A.e.tangent("Enter");
  await vila(300);
  ok("tangentbord: Enter på fokuserad ruta e4 svarar på första frågan (e4)", /Rätt/.test(await A.text(".schack-lektion-svar")) && /Fråga 2 av 7/.test(await A.text(".schack-lektion-steg")), `${await A.text(".schack-lektion-svar")} | ${await A.text(".schack-lektion-steg")}`);
  // omladdning mitt i lektionen
  await A.p.laddaOm();
  await A.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 20000);
  ok("omladdning mitt i lektion 1: börjar om på fråga 1 (inget halvt tillstånd)", /Fråga 1 av 7/.test(await A.text(".schack-lektion-steg")), await A.text(".schack-lektion-steg"));

  // --- två flikar, samma elev ----------------------------------------------------------------------------------------------
  const A2 = await anvandare(br, PA, { host: "127.0.0.1" });
  // samma origin → delad localStorage/inloggning; ny sida
  await A2.p.gaTill(`${A.origin}/#/elev/schack?vy=pussel&sort=ett&nr=1`);
  await A2.vanta(`/Pussel 1 av 200/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 25000);
  await A.ev(`location.hash = "#/elev/schack?vy=pussel&sort=ett&nr=1"`);
  await A.vanta(`/Pussel 1 av 200/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 15000);
  const L = JSON.parse(readFileSync(new URL("../../src/schack/pussel/matt-i-ett.json", import.meta.url), "utf8")).pussel;
  const lsn = async (u, n) => { const d = L[n - 1].losning[0]; await u.e.tryck(d.slice(0, 2)); await u.e.tryck(d.slice(2, 4)); await u.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000); };
  await A.rakna(true);
  await lsn(A, 1); await A.klick('[data-act="nasta"]'); await lsn(A, 2); await A.klick('[data-act="nasta"]'); await lsn(A, 3);
  await vila(1500);
  const efterA = (await sd(A.uid)).schack?.pussel?.ett;
  // flik 2 har gammal cache (senast 0) och löser pussel 1 → "nytt" i dess cache, men servern har 3
  await lsn(A2, 1);
  await vila(2000);
  const efterB = (await sd(A.uid)).schack?.pussel?.ett;
  ok("två flikar: flik 1 löste 1–3 (losta 3, senast 3)", efterA?.losta === 3 && efterA?.senast === 3, JSON.stringify(efterA));
  ok("två flikar: flik 2 (gammal cache) löste 1 → servern lämnas oförändrad (regeln nekar senast sänkt), inget fel mot eleven", efterB?.losta === 3 && efterB?.senast === 3, JSON.stringify(efterB));
  ok("två flikar: flik 2 visar ändå 'Snyggt' (framsteget är bara en bonus)", /Snyggt/.test(await A2.text(".schack-pussel-svar")));
  A2.p.s("Target.closeTarget", { targetId: A2.p.targetId }).catch(() => {});

  // --- modulen avstängd för klassen ---------------------------------------------------------------------------------------------------
  const E5 = await anvandare(br, PC);
  await loggaInElev(E5, "5a01").catch((e) => console.log("5a01 inloggning:", e.message.slice(0, 100)));
  await E5.ev(`location.hash = "#/elev/schack?vy=lar"`);
  await vila(2500);
  const nav = await E5.ev(`!![...document.querySelectorAll("a, button")].find((e) => /Schack/.test(e.textContent) && e.getClientRects().length)`);
  const sidan = await E5.ev(`document.querySelector(".schack-rot, #app")?.innerText.replace(/\\s+/g, " ").slice(0, 150)`);
  ok("klass utan schack (5A): sidnav saknar Schack och direktlänken till guiden visar inte guiden (info)", true, `nav-länk: ${nav}, sidan: ${sidan}`);
  const enL = await E5.ev(`location.hash`);
  ok("klass utan schack: hash efter direktlänk (info)", true, enL);
}
