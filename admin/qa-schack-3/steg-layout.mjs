// Schack slut-QA Etapp 3 (#792), steget "layout" – 320/360 px, surfplatta, Chromebook (1366×768):
// guidens översikt, en jaktlektion, en ställningslektion, lektion 12, pusselvalet, ett matt-i-ett- och
// ett matt-i-två-pussel. Ingen sidledsskroll, inget utanför skärmen, brädet stort nog – och med
// riktigt touch (mobil/surfplatta) och mus (Chromebook) går det att flytta pjäser.
import { readFileSync } from "node:fs";
import { vila, anvandare, loggaInElev, db } from "../qa-schack-2/lib.mjs";

const bank = (f) => JSON.parse(readFileSync(new URL(`../../src/schack/pussel/${f}`, import.meta.url), "utf8")).pussel;
const ETT = bank("matt-i-ett.json"), TVA = bank("matt-i-tva.json");
const STORLEKAR = [["320", 320, 640, true], ["360", 360, 740, true], ["surfplatta", 820, 1180, true], ["chromebook", 1366, 768, false]];
const MATT = (bradeSel) => `(() => {
  const vw = innerWidth; const sidled = document.documentElement.scrollWidth > vw + 1;
  const b = document.querySelector(${JSON.stringify(bradeSel)})?.getBoundingClientRect();
  const utanfor = [...document.querySelectorAll("button, .schack-stjarnrad, .schack-lektion-kort, .schack-pussel-sort, .schack-bradet, p")].filter((e) => e.getClientRects().length && !e.closest("[hidden]"))
    .map((e) => [e, e.getBoundingClientRect()]).filter(([e, r]) => r.width && (r.left < -1 || r.right > vw + 1))
    .filter(([e, r]) => r.right > 0 && r.left < vw && !(() => { for (let a = e.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === "auto" || o === "scroll") && a.scrollWidth > a.clientWidth) return true; } return false; })())
    .map(([e]) => (e.className || e.tagName) + ":" + e.textContent.trim().slice(0, 20));
  const knappar = [...document.querySelectorAll(".schack-rot button")].filter((e) => e.getClientRects().length && !e.closest("[hidden]")).map((e) => e.getBoundingClientRect()).filter((r) => r.height < 30 || r.width < 30).length;
  return { vw, sidled, brade: b ? Math.round(b.width) : null, utanfor: utanfor.slice(0, 4), smaKnappar: knappar };
})()`;

export default async function layout({ br, PORTAR, BILDER, ok }) {
  const A = await anvandare(br, PORTAR[0]);
  await loggaInElev(A, "4a01");
  await db.doc(`studentData/${A.uid}`).update({ schack: { aktivtParti: null, lektioner: { "1": 3, "2": 2, "9": 1 }, pussel: { ett: { losta: 3, senast: 3 } } } });
  await A.p.laddaOm(); await vila(4000);
  const sidor = [
    ["guide-översikt", "#/elev/schack?vy=lar", ".schack-lektion-lista", null],
    ["lektion 1 (frågor)", "#/elev/schack?vy=lar&lektion=1", ".schack-lektion-brade .schack-bradet", null],
    ["lektion 2 (jakt)", "#/elev/schack?vy=lar&lektion=2", ".schack-lektion-brade .schack-bradet", "jakt"],
    ["lektion 9 (ställning)", "#/elev/schack?vy=lar&lektion=9", ".schack-lektion-brade .schack-bradet", "stallning"],
    ["lektion 12 (parti)", "#/elev/schack?vy=lar&lektion=12", ".schack-bradet", null],
    ["pusselval", "#/elev/schack?vy=pussel", ".schack-pussel-sorter", null],
    ["matt i ett", "#/elev/schack?vy=pussel&sort=ett&nr=1", ".schack-pussel-brade .schack-bradet", "pussel"],
    ["matt i två", "#/elev/schack?vy=pussel&sort=tva&nr=1", ".schack-pussel-brade .schack-bradet", "pussel-tva"],
  ];
  for (const [namn, b, h, mobil] of STORLEKAR) {
    await A.storlek(b, h, mobil);
    await A.p.s("Emulation.setTouchEmulationEnabled", mobil ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    A.e.anvandFinger(mobil);
    for (const [sida, hash, bradeSel, rorelse] of sidor) {
      await A.ev(`location.hash = ${JSON.stringify(hash)}`);
      await A.vanta(`!!document.querySelector(${JSON.stringify(bradeSel)}) && (!document.querySelector(".schack-pussel-nr") || /Pussel \\d+ av/.test(document.querySelector(".schack-pussel-nr").textContent))`, 20000);
      await vila(600);
      const m = await A.ev(MATT(bradeSel));
      const bradeKrav = /bräde|lektion|matt i|parti/.test(sida) && !/översikt/.test(sida);
      const minBrade = Math.min(280, b - 24);
      ok(`${sida} ${namn} (${b}×${h}): ingen sidledsskroll, inget utanför${bradeKrav ? `, brädet ${m.brade} px` : ""}`, !m.sidled && !m.utanfor.length && (!bradeKrav || m.brade >= minBrade), JSON.stringify(m));
      if (m.smaKnappar) ok(`${sida} ${namn}: knappar mindre än 30 px (info)`, true, `${m.smaKnappar} st`);
      if (["320", "chromebook", "surfplatta"].includes(namn) && /översikt|lektion 2|lektion 9|pusselval|matt i ett|matt i två/.test(sida)) await A.bild(BILDER, `layout-${sida.replace(/[ ()åäö]/g, "_")}-${namn}`);
      // rörelse med finger/mus
      if (rorelse === "jakt") {
        await A.e.tryck("a1"); await A.e.tryck("a5");
        await vila(200);
        ok(`lektion 2 ${namn}: ${mobil ? "fingret" : "musen"} flyttar tornet a1 → a5 (tryck–tryck)`, /Drag: 1/.test(await A.text(".schack-lektion-raknare")), await A.text(".schack-lektion-raknare"));
        await A.e.dra("a5", "e5", { touch: mobil });
        await vila(300);
        ok(`lektion 2 ${namn}: dra och släpp (${mobil ? "touch" : "mus"}) a5 → e5`, /Drag: 2/.test(await A.text(".schack-lektion-raknare")), await A.text(".schack-lektion-raknare"));
      } else if (rorelse === "stallning") {
        await A.e.tryck("e1"); await A.e.tryck("d2");
        await vila(300);
        ok(`lektion 9 ${namn}: ${mobil ? "fingret" : "musen"} flyttar kungen (rätt drag, tryck–tryck)`, /Rätt/.test(await A.text(".schack-lektion-svar")), await A.text(".schack-lektion-svar"));
      } else if (rorelse === "pussel") {
        const p = ETT[0];
        await A.e.dra(p.losning[0].slice(0, 2), p.losning[0].slice(2, 4), { touch: mobil });
        await vila(500);
        ok(`pussel 1 ${namn}: dra och släpp (${mobil ? "touch" : "mus"}) rätt drag → matt`, /Snyggt/.test(await A.text(".schack-pussel-svar")), await A.text(".schack-pussel-svar"));
      } else if (rorelse === "pussel-tva") {
        const p = TVA[0];
        await A.e.tryck(p.losning[0].slice(0, 2)); await A.e.tryck(p.losning[0].slice(2, 4));
        await A.vanta(`/Svart spelade/.test(document.querySelector(".schack-pussel-svar").textContent)`, 6000);
        await A.e.tryck(p.losning[2].slice(0, 2)); await A.e.tryck(p.losning[2].slice(2, 4));
        await vila(400);
        ok(`pussel (två) 1 ${namn}: ${mobil ? "fingret" : "musen"} (tryck–tryck) båda dragen → matt`, /Snyggt/.test(await A.text(".schack-pussel-svar")), await A.text(".schack-pussel-svar"));
        if (namn === "320") await A.bild(BILDER, "layout-pussel-tva-ratt-320");
      }
    }
  }
  await A.p.s("Emulation.setTouchEmulationEnabled", { enabled: false });
  // nollställ: pusselframstegen ändrades av drag-testerna (lösta pussel 1)
}
