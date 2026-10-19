// Schack slut-QA Etapp 2 (#782), steget "klocka" – se qa.mjs. Klockan på riktigt, utan fejkad
// emulatordata: ett 5-minutersparti där svart låter tiden gå ut (≈ 5 min väntan), "Kräv vinsten"
// ska dyka upp av den lokala nedräkningen utan någon ny ändring i partiet. Dessutom elevdatorer
// som går 3 min efter respektive 4 min före servern (serverNow).
import { db, vila, parti, anvandare, loggaInElev, drag, bradeHar, vantaParti } from "./lib.mjs";
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
  // serverNow skattas ur HTTP Date (sekundupplösning) – de två skärmarna kan skilja en bråkdel av en sekund
  const skillnad = JSON.stringify(await klockor(svart));
  await svart.vanta(`[...document.querySelectorAll(".schack-kompis .schack-klocka")].some((e) => e.textContent === "0:00") && /Din tid är slut/.test(document.querySelector(".schack-kompis").textContent)`, 5000)
    .then(() => ok("svarts klocka 0:00 och 'Din tid är slut.'", true, `när vit fick knappen visade svart ${skillnad}`), () => ok("svarts klocka 0:00 och 'Din tid är slut.'", false, skillnad));
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
  await db.doc(`schackPartier/${id2}`).update({ klocka: { ...pt.klocka, svartMs: 1000, senastDragAt: Date.now() } });
  await vila(2500);
  const sent = await callFran(f2.svart, "schackDrag", { partiId: id2, from: "d7", to: "d5" });
  const p2 = await parti(id2);
  ok("drag efter att egen tid gått ut: görs inte, partiet slutar på tid", sent.ok && sent.data?.gjort === false && p2.orsak === "tid" && p2.drag.length === 1, JSON.stringify({ sent, orsak: p2.orsak }));

  // en elevdator som går 4 s FÖRE (under 5 s-gränsen i syncServerClock → okorrigerad): knappen kommer
  // för tidigt, servern nekar, knappen går att trycka igen och vinner när tiden verkligen är slut
  const F = await anvandare(br, PA);
  await F.p.s("Page.addScriptToEvaluateOnNewDocument", { source: `{ const d = Date.now; Date.now = () => d() + 4000; }` });
  await F.p.gaTill(`${F.origin}/#/elev/schack?vy=kompis`);
  Object.assign(F, { anv: "4a01", uid: A.uid });
  await vantaMed(B, "5");
  await F.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${B.uid}"]')`, 20000);
  await F.klick(`.schack-vantar-kort [data-act="spela"][data-uid="${B.uid}"]`);
  const id3 = await vantaParti(F);
  const f3 = await farger(id3, F, B);
  if (f3.vit === F) { await drag(F, id3, "e2", "e4"); await bradeHar(B, 1); }
  const p3 = await parti(id3); // nu är B på tur
  const kvar = 6000;
  await db.doc(`schackPartier/${id3}`).update({ klocka: { ...p3.klocka, [p3.tur === "w" ? "vitMs" : "svartMs"]: kvar, senastDragAt: Date.now() } });
  const t3 = Date.now();
  await F.vanta(`[...document.querySelectorAll('.schack-kompis [data-act="krava"]')].some((e) => e.getClientRects().length)`, 15000);
  const tidig = Date.now() - t3;
  ok(`klientklocka +4 s: 'Kräv vinsten' visas efter ${(tidig / 1000).toFixed(1)} s av ${kvar / 1000} s (för tidigt)`, tidig < kvar, String(tidig));
  await F.klick('.schack-kompis [data-act="krava"]');
  await F.vanta(`/inte slut/.test(document.querySelector(".schack-kompis-meddelande").textContent)`, 5000)
    .then(() => ok("för tidigt krav: servern nekar, eleven ser 'Motståndarens tid är inte slut.'", true), () => ok("för tidigt krav nekas med text", false));
  ok("partiet pågår fortfarande", (await parti(id3)).status === "pagar");
  await vila(Math.max(0, kvar + 800 - (Date.now() - t3)));
  await F.vanta(`[...document.querySelectorAll('.schack-kompis [data-act="krava"]')].some((e) => e.getClientRects().length && !e.disabled)`, 5000);
  await F.klick('.schack-kompis [data-act="krava"]');
  await slutSynlig(F);
  ok("knappen igen när tiden verkligen är slut → vinst på tid", /tid tog slut/.test(await slutRubrik(F)), await slutRubrik(F));
}
