// Schack slut-QA Etapp 3 (#792), steget "kvot" – klientens Firestore-läsningar/-skrivningar för guiden och
// pusslen (räknande proxy per origin, QA_RAKNA=1): en skrivning per avklarad lektion, en per nytt pussel,
// inga läsningar per drag/lektion/pussel, vad lyssnaren på klassdokumentet kostar, vad en omladdning kostar.
import { readFileSync } from "node:fs";
import { vila, anvandare, loggaInElev, db } from "../qa-schack-2/lib.mjs";
import { LEKTIONER } from "../../src/schack/schack-lektioner.js";
import { lös } from "./jakt.mjs";

const ETT = JSON.parse(readFileSync(new URL("../../src/schack/pussel/matt-i-ett.json", import.meta.url), "utf8")).pussel;
const kort = (r) => `läs ${r.summaLasningar} (${Object.entries(r.lasningar).map(([k, v]) => `${k}: ${v}`).join(", ") || "–"}), skriv ${r.summaSkrivningar} (${Object.entries(r.skrivningar).map(([k, v]) => `${k}: ${v}`).join(", ") || "–"})`;
const dr = (s) => ({ from: s.slice(0, 2), to: s.slice(2, 4), promotion: s[4] });

export default async function kvot({ br, PORTAR, ok }) {
  const A = await anvandare(br, PORTAR[0]);
  await loggaInElev(A, "4a04");
  await db.doc(`studentData/${A.uid}`).update({ schack: { aktivtParti: null } });
  await A.p.laddaOm(); await vila(4000);

  // ladda om precis på schacksidan: vad kostar sidladdningen?
  await A.rakna(true);
  await A.ev(`location.hash = "#/elev/schack"`);
  await A.vanta(`!!document.querySelector(".schack-sida")`, 20000);
  await vila(2500);
  const start = await A.rakna();
  ok("schacksidan öppnad (SPA): läsningar (info)", true, kort(start));

  // --- guiden: lektion 1 + 2 ----------------------------------------------------------------------
  await A.rakna(true);
  await A.ev(`location.hash = "#/elev/schack?vy=lar"`);
  await A.vanta(`document.querySelectorAll(".schack-lektion-kort").length === 12`, 15000);
  await A.ev(`location.hash = "#/elev/schack?vy=lar&lektion=1"`);
  await A.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 15000);
  for (const f of LEKTIONER[0].uppgifter) await A.e.tryck(f.svar[0]);
  await A.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 5000);
  await vila(1200);
  let r = await A.rakna();
  ok("guiden: översikt + lektion 1 klar → exakt 1 skrivning (studentData) och 0 läsningar", r.summaSkrivningar === 1 && r.summaLasningar === 0, kort(r));
  await A.rakna(true);
  await A.ev(`location.hash = "#/elev/schack?vy=lar&lektion=2"`);
  await A.vanta(`!!document.querySelector(".schack-lektion")`, 10000);
  await vila(300);
  const l2 = LEKTIONER[1];
  for (let i = 0; i < l2.uppgifter.length; i++) {
    const u = l2.uppgifter[i]; let pos = u.fran;
    for (const t of lös(u).vag) { await A.e.tryck(pos); await A.e.tryck(t); pos = t; }
    if (i < l2.uppgifter.length - 1) { await A.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000); await A.klick('[data-act="nasta"]'); await vila(150); }
  }
  await A.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 5000);
  await vila(1200);
  r = await A.rakna();
  ok("lektion 2 (8 drag, 2 uppgifter): 1 skrivning, 0 läsningar (inget per drag)", r.summaSkrivningar === 1 && r.summaLasningar === 0, kort(r));

  // --- pusslen: 10 st ---------------------------------------------------------------------------------
  await A.rakna(true);
  await A.ev(`location.hash = "#/elev/schack?vy=pussel&sort=ett&nr=1"`);
  await A.vanta(`/Pussel 1 av/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 15000);
  for (let n = 1; n <= 10; n++) {
    await vila(150);
    await A.e.tryck(dr(ETT[n - 1].losning[0]).from); await A.e.tryck(dr(ETT[n - 1].losning[0]).to);
    await A.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000);
    if (n < 10) await A.klick('[data-act="nasta"]');
  }
  await vila(1200);
  r = await A.rakna();
  ok("10 pussel lösta: 10 skrivningar (1 per pussel), 0 läsningar", r.summaSkrivningar === 10 && r.summaLasningar === 0, kort(r));

  // --- lyssnaren på klassdokumentet kostar läsningar medan eleven är på schacksidan ---------------------------
  await A.rakna(true);
  for (let i = 0; i < 3; i++) { await db.doc("schackKlass/4a").set({ qaPing: i }, { merge: true }); await vila(1200); }
  r = await A.rakna();
  ok("info: eleven i pusselvyn medan klassdokumentet ändras 3 ggr → läsningar (lobbylyssnaren är kvar i guide/pussel?)", true, kort(r));
  await A.ev(`location.hash = "#/elev/hem"`);
  await vila(3000);
  await A.rakna(true);
  for (let i = 3; i < 6; i++) { await db.doc("schackKlass/4a").set({ qaPing: i }, { merge: true }); await vila(1200); }
  r = await A.rakna();
  ok("eleven lämnat schacksidan: 3 ändringar → 0 läsningar (lyssnaren stängd)", r.summaLasningar === 0, kort(r));
  await db.doc("schackKlass/4a").set({ qaPing: null }, { merge: true });

  // --- full omladdning av pusselvyn ----------------------------------------------------------------------------------
  await A.ev(`location.hash = "#/elev/schack?vy=pussel&sort=ett"`);
  await vila(1500);
  await A.rakna(true);
  await A.p.laddaOm();
  await A.vanta(`/Pussel \\d+ av/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 20000);
  await vila(2500);
  r = await A.rakna();
  ok("full omladdning av pusselvyn (info): läsningar = appens vanliga uppstart + studentData", true, kort(r));
}
