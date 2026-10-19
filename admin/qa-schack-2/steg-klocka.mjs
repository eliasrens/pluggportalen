// Schack slut-QA Etapp 2 (#782), steget "klocka" – se qa.mjs. Klockan på riktigt, utan fejkad
// emulatordata: ett 5-minutersparti där svart låter tiden gå ut (≈ 5 min väntan), "Kräv vinsten"
// ska dyka upp av den lokala nedräkningen utan någon ny ändring i partiet. Dessutom elevdatorer
// som går 3 min efter respektive 4 min före servern (serverNow).
import { vila, parti, anvandare, loggaInElev, drag, bradeHar } from "./lib.mjs";
import { farger, vantaMed, spelaMot, slutRubrik, slutSynlig, callFran, nollaKlass } from "./spel.mjs";

const klockor = (u) => u.ev(`[...document.querySelectorAll(".schack-kompis .schack-klocka")].map((e) => e.textContent)`);

export default async function klocka({ br, PORTAR, BILDER, ok }) {
  const [PA, PB] = PORTAR;
  // A:s dator går 3 min EFTER, B:s 4 min FÖRE – båda ska ändå visa serverns klocka
  const A = await anvandare(br, PA), B = await anvandare(br, PB);
  await A.p.s("Page.addScriptToEvaluateOnNewDocument", { source: `{ const d = Date.now; Date.now = () => d() - 180000; }` });
  await B.p.s("Page.addScriptToEvaluateOnNewDocument", { source: `{ const d = Date.now; Date.now = () => d() + 240000; }` });
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await nollaKlass();
  await vantaMed(A, "5");
  const id = await spelaMot(B, A);
  const { vit, svart } = await farger(id, A, B);
  await vila(1500);
  const k0 = [await klockor(A), await klockor(B)];
  ok("klockor vid start hos båda (−3 min och +4 min fel): 5:00 / 4:5x", k0.every((k) => k.length === 2 && k.every((t) => /^(5:00|4:5\d)$/.test(t))), JSON.stringify(k0));
  await drag(vit, id, "e2", "e4");
  await bradeHar(svart, 1);
  const start = Date.now();
  ok("ingen 'Kräv vinsten' direkt", !(await vit.finns('.schack-kompis [data-act="krava"]')));
  // vänta ut svarts 5 minuter – partidokumentet ändras inte under tiden
  const uppd = (await parti(id)).uppdaterad;
  await vila(4 * 60_000 + 52_000);
  const nara = await klockor(svart);
  ok("8 s kvar: tiondelar visas (0:0x,y) hos svart", nara.some((t) => /^0:0\d,\d$/.test(t)), JSON.stringify(nara));
  await svart.bild(BILDER, "klocka-tiondelar");
  await vit.vanta(`[...document.querySelectorAll('.schack-kompis [data-act="krava"]')].some((e) => e.getClientRects().length)`, 20_000)
    .then(() => ok(`'Kräv vinsten' dyker upp av sig själv efter ${Math.round((Date.now() - start) / 1000)} s (lokal nedräkning)`, true), () => ok("'Kräv vinsten' dyker upp", false));
  ok("partidokumentet orört under väntan (ingen skrivning per sekund)", (await parti(id)).uppdaterad === uppd);
  ok("svarts klocka 0:00 och 'Din tid är slut.'", (await klockor(svart)).includes("0:00") && /Din tid är slut/.test(await svart.text(".schack-kompis")), JSON.stringify(await klockor(svart)));
  await vit.bild(BILDER, "krav-vinsten-riktig-klocka");
  await vit.klick('.schack-kompis [data-act="krava"]');
  await slutSynlig(vit); await slutSynlig(svart);
  ok("vit vinner på tid ('Du vann! … tid tog slut.')", /tid tog slut/.test(await slutRubrik(vit)), await slutRubrik(vit));
  ok("svart: 'Din tid tog slut – … vann.'", /Din tid tog slut/.test(await slutRubrik(svart)), await slutRubrik(svart));
  const p = await parti(id);
  ok("servern: 1-0 tid, svart 0 ms kvar", p.resultat === "1-0" && p.orsak === "tid" && p.klocka.svartMs === 0, JSON.stringify(p.klocka));
  // ett drag efter att tiden gått ut görs inte – partiet slutar på tid i stället (andra partiet, utan krav)
  await vit.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await vantaMed(vit, "5");
  const id2 = await spelaMot(svart, vit, id);
  const f2 = await farger(id2, A, B);
  await drag(f2.vit, id2, "d2", "d4");
  const pt = await parti(id2);
  const { db } = await import("./lib.mjs");
  await db.doc(`schackPartier/${id2}`).update({ klocka: { ...pt.klocka, svartMs: 1000, senastDragAt: Date.now() } });
  await vila(2500);
  const sent = await callFran(f2.svart, "schackDrag", { partiId: id2, from: "d7", to: "d5" });
  const p2 = await parti(id2);
  ok("drag efter att egen tid gått ut: görs inte, partiet slutar på tid", sent.ok && sent.data?.gjort === false && p2.orsak === "tid" && p2.drag.length === 1, JSON.stringify({ sent, orsak: p2.orsak }));
}
