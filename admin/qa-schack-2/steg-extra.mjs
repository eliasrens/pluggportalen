// Schack slut-QA Etapp 2 (#782), steget "extra" – se qa.mjs. Det som inte stod i listan:
// dubbelklick/samtidiga drag, förvandling i UI:t mot servern, en elevdator som går fel,
// modulen av mitt i ett parti, utloggning i väntan, lärarens Avsluta inifrån åskådarläget,
// konstiga lobbyanrop och samma elev i två flikar.
import { db, vila, parti, klass, uidFor, anvandare, loggaInElev, loggaInLarare, tillLobby, vantaParti, drag, bradeHar } from "./lib.mjs";
import { farger, vantaMed, spelaMot, slutRubrik, slutSynlig, callFran, rawCall, nollaKlass } from "./spel.mjs";

export default async function extra({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, PT] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB), T = await anvandare(br, PT);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await loggaInLarare(T);
  await nollaKlass();

  // 1. två samtidiga drag från samma spelare → bara ett går igenom
  await vantaMed(A, "10");
  let id = await spelaMot(B, A);
  let f = await farger(id, A, B);
  const [d1, d2] = await Promise.all([
    callFran(f.vit, "schackDrag", { partiId: id, from: "e2", to: "e4" }),
    callFran(f.vit, "schackDrag", { partiId: id, from: "d2", to: "d4" }),
  ]);
  const pd = await parti(id);
  ok("två samtidiga drag av vit → exakt ett sparas, tur till svart", [d1, d2].filter((r) => r.ok).length === 1 && pd.drag.length === 1 && pd.tur === "b",
    `${d1.ok ? "ok" : d1.code} / ${d2.ok ? "ok" : d2.code} · ${JSON.stringify(pd.drag)}`);
  await bradeHar(f.vit, 1); await bradeHar(f.svart, 1);
  ok("båda brädena visar det drag servern sparade", true);

  // 2. förvandling i UI:t: parti där vit står med en bonde på b7 (draglistan skrivs med Admin-SDK)
  const forv = ["a4", "b5", "axb5", "a6", "bxa6", "Bb7", "axb7", "Nc6"];
  const { Chess } = await import("../../src/schack/vendor/chess.js");
  const ch = new Chess(); for (const s of forv) ch.move(s);
  await db.doc(`schackPartier/${id}`).update({ drag: forv, fen: ch.fen(), tur: "w", senastDragAt: Date.now(), klocka: { ...pd.klocka, senastDragAt: Date.now() } });
  await bradeHar(f.vit, 8);
  await vila(500);
  await f.vit.e.tryck("b7");
  await f.vit.e.tryck("a8");
  await f.vit.vanta(`!document.querySelector(".schack-kompis .schack-forvandling").hidden`, 5000)
    .then(() => ok("förvandlingsväljaren visas mot kompis", true), () => ok("förvandlingsväljaren visas mot kompis", false));
  await f.vit.bild(BILDER, "forvandling-kompis");
  await f.vit.klick('.schack-kompis .schack-forvandling [data-pjas="n"]');
  let t0 = Date.now();
  while (Date.now() - t0 < 8000 && (await parti(id)).drag.length < 9) await vila(50);
  const pf = await parti(id);
  ok("servern fick förvandlingen till springare (bxa8=N / bxa8=S)", pf.drag.length === 9 && /=N|=S/.test(pf.drag[8]), pf.drag[8]);
  await bradeHar(f.svart, 9);
  ok("motståndarens bräde visar en vit springare på a8", /vit springare/.test(await f.svart.e.etikett("a8")), await f.svart.e.etikett("a8"));

  // 3. modulen av mitt i partiet: draget nekas, pjäsen hoppar tillbaka, meddelande
  await db.doc("classes/4a").update({ enabledModules: [] });
  await vila(500);
  await f.svart.e.tryck("g8");
  await f.svart.e.tryck("f6");
  await f.svart.vanta(`/inte påslaget/.test(document.querySelector(".schack-kompis-meddelande").textContent)`, 8000)
    .then(() => ok("modul av mitt i partiet: draget nekas med 'Schack är inte påslaget …'", true), () => ok("modul av: meddelande", false, ""));
  await vila(400);
  ok("…och springaren står kvar på g8 (pjäsen hoppade tillbaka)", /svart springare/.test(await f.svart.e.etikett("g8")) && (await parti(id)).drag.length === 9, await f.svart.e.etikett("g8"));
  await db.doc("classes/4a").update({ enabledModules: ["schack"] });

  // 4. lärarens Avsluta inifrån åskådarläget
  await T.vanta(`!!document.querySelector('[data-titta="${id}"]')`, 15000);
  await T.klick(`[data-titta="${id}"]`);
  await T.vanta(`document.querySelectorAll(".sl-ask .schack-bradet [data-ruta]").length === 64`);
  await bradeHar(T, 9, ".sl-ask");
  ok("åskådaren laddar ett pågående parti mitt i (9 drag)", true);
  await T.klick("[data-ask-avsluta]");
  await T.klick(".sl-ask-bekrafta [data-ja]");
  await slutSynlig(A); await slutSynlig(B);
  ok("Avsluta från åskådarläget → avbrutet hos båda", /Partiet avbröts/.test(await slutRubrik(A)) && /Partiet avbröts/.test(await slutRubrik(B)));
  await T.vanta(`!!document.querySelector(".sl-ask .schack-slut:not([hidden])")`, 8000).then(() => ok("åskådaren ser slutrutan (avbrutet)", true), () => ok("åskådaren ser slutrutan (avbrutet)", false));

  // 5. konstiga lobbyanrop
  const ebba = await uidFor("4b01");
  const r1 = await rawCall(A, "schackUtmana", { classId: "4a", till: ebba, klocka: null });
  ok("utmana en elev i en annan klass nekas", !r1.ok, r1.code);
  const r2 = await rawCall(A, "schackUtmana", { classId: "4a", till: A.uid, klocka: null });
  ok("utmana sig själv nekas", !r2.ok, r2.code);
  const r3 = await rawCall(A, "schackVanta", { classId: "4a", klocka: 7 });
  ok("klocka 7 min nekas (invalid-argument)", !r3.ok && /invalid-argument/.test(r3.code), r3.code);
  const r4 = await rawCall(A, "schackGaMed", { classId: "4a", motstandare: A.uid });
  ok("gå med i sin egen väntan nekas", !r4.ok, r4.code);
  const r5 = await rawCall(A, "schackVanta", { classId: "4b", klocka: null });
  ok("vänta i en annan klass nekas", !r5.ok && /permission-denied/.test(r5.code), r5.code);
  const k5 = await klass();
  ok("lobbyn opåverkad av de nekade anropen", !Object.keys(k5.vantar || {}).length && !Object.keys(k5.utmaningar || {}).length, JSON.stringify({ v: k5.vantar, u: k5.utmaningar }));

  // 6. utloggning medan man väntar → väntan tas bort
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await B.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await vantaMed(A, "5");
  await B.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${A.uid}"]')`);
  await A.klickText("Logga ut");
  await B.vanta(`!document.querySelector('.schack-vantar-kort [data-uid="${A.uid}"]')`, 8000)
    .then(() => ok("Logga ut i väntan → väntan borta hos B", true), () => ok("Logga ut i väntan → väntan borta hos B", false));

  // 7. elevdator som går 3 min före: klockan visar ändå rätt (serverNow), ingen falsk 'verkar ha gått'
  const S = await anvandare(br, PA);
  await S.p.s("Page.addScriptToEvaluateOnNewDocument", { source: `{ const d = Date.now; Date.now = () => d() + 180000; }` });
  await loggaInElev(S, "4a01");
  await vantaMed(B, "");
  await S.ev(`location.hash = "#/elev/schack?vy=kompis"`);
  await S.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${B.uid}"]')`, 20000)
    .then(() => ok("elevdator +3 min: B:s väntan syns (inte felaktigt utgången)", true), () => ok("elevdator +3 min: B:s väntan syns", false));
  await S.klick(`.schack-vantar-kort [data-act="spela"][data-uid="${B.uid}"]`);
  id = await vantaParti(S);
  await vila(1500);
  f = await farger(id, S, B);
  const sTur = (await parti(id)).tur === (f.vit === S ? "w" : "b");
  ok("elevdator +3 min: ingen 4-/5-min-text direkt efter start", !/verkar ha gått|Om en minut/.test(await S.text(".schack-kompis")), await S.text(".schack-kompis-lage-panel"));
  await callFran(S, "schackGeUpp", { partiId: id });
  await vantaMed(B, "10");
  await S.ev(`location.hash = "#/elev/schack?vy=kompis"`);
  await S.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${B.uid}"]')`, 20000);
  await S.klick(`.schack-vantar-kort [data-act="spela"][data-uid="${B.uid}"]`);
  id = await vantaParti(S, id);
  await vila(1500);
  const kl = await S.ev(`[...document.querySelectorAll(".schack-kompis .schack-klocka")].map((e) => e.textContent)`);
  ok("elevdator +3 min: klockorna visar ~10:00 (inte 7:00)", kl.length === 2 && kl.every((t) => /^(10:00|9:5\d)$/.test(t)), JSON.stringify(kl) + (sTur ? "" : ""));
  await callFran(S, "schackGeUpp", { partiId: id });

  // 8. samma elev i två flikar: draget i den ena syns i den andra
  await vantaMed(B, "");
  // Alva är redan inloggad i den här origin (fliken S, Kom ihåg mig) – två nya flikar delar inloggningen.
  const A2 = await anvandare(br, PA);
  Object.assign(A2, { anv: "4a01", uid: A.uid });
  await A2.p.gaTill(`${A2.origin}/#/elev/schack?vy=kompis`);
  const A3 = await anvandare(br, PA);
  Object.assign(A3, { anv: "4a01", uid: A.uid });
  await A3.p.gaTill(`${A3.origin}/#/elev/schack?vy=kompis`);
  await A2.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${B.uid}"]')`, 20000);
  await A2.klick(`.schack-vantar-kort [data-act="spela"][data-uid="${B.uid}"]`);
  id = await vantaParti(A2);
  await vantaParti(A3).then((x) => ok("andra fliken (samma elev) går också till partiet", x === id), () => ok("andra fliken går till partiet", false));
  f = await farger(id, A2, B);
  const minFlik = f.vit === A2 ? A3 : null; // A3 drar som vit om A är vit
  if (minFlik) {
    await drag(A3, id, "e2", "e4");
    await bradeHar(A2, 1).then(() => ok("drag i ena fliken syns i den andra", true), () => ok("drag i ena fliken syns i den andra", false));
  } else {
    await drag(B, id, "e2", "e4");
    await bradeHar(A3, 1); await drag(A3, id, "e7", "e5");
    await bradeHar(A2, 2).then(() => ok("drag i ena fliken syns i den andra", true), () => ok("drag i ena fliken syns i den andra", false));
  }
  await callFran(B, "schackGeUpp", { partiId: id });
  const konsol = [A, B, S, A2, A3].flatMap((u) => u.p.konsol.filter((x) => /^(error|EXCEPTION)/.test(x)));
  ok("inga konsolfel hos eleverna", !konsol.length, konsol.slice(0, 4).join(" | "));
}
