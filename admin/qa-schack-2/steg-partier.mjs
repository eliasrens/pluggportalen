// Schack slut-QA Etapp 2 (#782), steget "partier" – se qa.mjs: matt (+ lärarens åskådarläge
// live), remi (neka + acceptera), ge upp, tiden slut + Kräv vinsten, 5-min-regeln utan klocka.
import { db, vila, parti, klass, anvandare, loggaInElev, loggaInLarare, tillLobby, vantaParti, drag, bradeHar } from "./lib.mjs";
import { farger, vantaMed, spelaMot, slutRubrik, slutSynlig, callFran, nollaKlass } from "./spel.mjs";

export default async function partier({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, PT] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB), T = await anvandare(br, PT);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await loggaInLarare(T);
  await nollaKlass();

  // --- 1. matt med klocka 10 min, läraren tittar live -------------------------------
  await vantaMed(A, "10");
  await tillLobby(B);
  await B.vanta(`!!document.querySelector(".schack-vantar-kort")`);
  ok("B ser Alva i väntar-listan", /Alva\s*väntar · 10 min/.test(await B.text(".schack-lobby-vantar")), await B.text(".schack-lobby-vantar"));
  await B.bild(BILDER, "lobby-vantar");
  const id = await spelaMot(B, A, "");
  ok("Spela! startar partiet hos båda (samma partiId)", !!id, id);
  const { vit, svart } = await farger(id, A, B);
  await vila(800);
  ok("båda klockorna visas (10:00)", /10:00|9:5\d/.test(await vit.text(".schack-kompis .schack-spelare-extra")), await vit.text(".schack-kompis"));
  // läraren
  await T.vanta(`!!document.querySelector("[data-titta]")`, 15000);
  await T.klick("[data-titta]");
  await T.vanta(`document.querySelectorAll(".sl-ask .schack-bradet [data-ruta]").length === 64`);
  ok("åskådarbrädet: vit nederst (a1 nere till vänster)", (await T.e.hornRuta()) === "a1");
  ok("åskådarbrädet: ingen inmatning (ej .interaktiv)", !(await T.ev(`!!document.querySelector(".sl-ask .schack-bradet.interaktiv")`)));
  const mattDrag = [[vit, "f2", "f3"], [svart, "e7", "e5"], [vit, "g2", "g4"], [svart, "d8", "h4"]];
  let n = 0;
  for (const [u, f, t] of mattDrag) {
    await drag(u, id, f, t);
    n++;
    const motst = u === vit ? svart : vit;
    await bradeHar(motst, n);
    await bradeHar(T, n, ".sl-ask");
    if (n === 1) {
      await vit.bild(BILDER, "parti-klocka");
      await T.bild(BILDER, "larare-askadare");
    }
  }
  ok("motståndarens och åskådarens bräden följde alla 4 drag live", true);
  // tryck i åskådarbrädet ändrar inget
  await T.e.tryck("e2");
  ok("åskådarläget: tryck på pjäs ger inga mål", !(await T.ev(`document.querySelectorAll(".sl-ask .schack-bradet .mal, .sl-ask .schack-bradet .vald").length`)));
  await slutSynlig(vit); await slutSynlig(svart);
  ok("slutrutan hos vinnaren (svart): Schack matt – du vann!", /Schack matt – du vann/.test(await slutRubrik(svart)), await slutRubrik(svart));
  ok("slutrutan hos förloraren: Schack matt – X vann.", new RegExp(`Schack matt – ${svart === A ? "Alva" : "Bilal"} vann`).test(await slutRubrik(vit)), await slutRubrik(vit));
  ok("slutrutan har Spela igen + Till lobbyn", /Spela igen.*Till lobbyn/.test(await vit.text(".schack-kompis .schack-slut-knappar")));
  await svart.bild(BILDER, "slutruta-matt");
  const p1 = await parti(id);
  ok("servern: status slut 0-1 matt", p1.status === "slut" && p1.resultat === "0-1" && p1.orsak === "matt", `${p1.status} ${p1.resultat} ${p1.orsak}`);
  await T.vanta(`!!document.querySelector(".sl-ask .schack-slut:not([hidden])")`, 8000).then(() => ok("åskådaren ser slutrutan", true), () => ok("åskådaren ser slutrutan", false));
  await T.bild(BILDER, "larare-askadare-slut");
  let k = await klass();
  ok("tabellen: vinnaren 1020 (+10+20·0,5), förloraren 987 (−round(5+15·0,5)) – start 1000",
    k.tabell?.[svart.uid]?.poang === 1020 && k.tabell?.[vit.uid]?.poang === 987, JSON.stringify(k.tabell));
  ok("partiet bort ur klassens partier", !Object.keys(k.partier || {}).length);

  // --- 2. remi: Spela igen (utmanar samma kompis) → ja → neka → acceptera --------------
  await A.klickText("Spela igen", ".schack-kompis .schack-slut-knappar");
  await B.vanta(`!!document.querySelector('[data-act="svara-ja"]')`, 15000).then(() => ok("Spela igen: B får en utmaningsruta", true), () => ok("Spela igen: B får en utmaningsruta", false));
  ok("utmaningsrutans text", /Alva vill spela schack med dig/.test(await B.text(".schack-utmaning")), await B.text(".schack-utmaning"));
  await B.bild(BILDER, "utmaning");
  await B.klick('[data-act="svara-ja"]');
  const id2 = await vantaParti(B, id);
  const id2a = await vantaParti(A, id);
  ok("svara ja → nytt parti hos båda", id2 && id2 === id2a && id2 !== id, id2);
  const f2 = await farger(id2, A, B);
  await drag(f2.vit, id2, "e2", "e4");
  await bradeHar(f2.svart, 1);
  await A.klick('[data-act="remi"]');
  ok("Föreslå remi visar bekräftelse på sidan", await A.finns(".schack-erbjud-ruta"));
  await A.klick('[data-act="erbjud-ja"]');
  await B.vanta(`(() => { const e = document.querySelector(".schack-remi-ruta"); return e && !e.hidden; })()`).then(() => ok("B ser remierbjudandet", true), () => ok("B ser remierbjudandet", false));
  ok("A ser 'väntar på svar'", /väntar på svar från Bilal/.test(await A.text(".schack-kompis-remi-vantar")));
  await B.klick('[data-act="remi-nej"]');
  await A.vanta(`/sa nej tack till remi/.test(document.querySelector(".schack-kompis-meddelande").textContent)`).then(() => ok("A får 'sa nej tack till remi'", true), () => ok("A får 'sa nej tack till remi'", false));
  ok("servern: remiErbjudenAv nollad, pågår", (await parti(id2)).remiErbjudenAv === null && (await parti(id2)).status === "pagar");
  await B.klick('[data-act="remi"]');
  await B.klick('[data-act="erbjud-ja"]');
  await A.vanta(`(() => { const e = document.querySelector(".schack-remi-ruta"); return e && !e.hidden; })()`);
  await A.klick('[data-act="remi-ja"]');
  await slutSynlig(A); await slutSynlig(B);
  ok("remi: slutrutan 'Remi – ingen vann' hos båda", /Remi – ingen vann/.test(await slutRubrik(A)) && /Remi – ingen vann/.test(await slutRubrik(B)), await slutRubrik(A));
  const p2 = await parti(id2);
  ok("servern: ½-½ remi", p2.resultat === "½-½" && p2.orsak === "remi");

  // --- 3. ge upp: Till lobbyn → Utmana (5 min) → nej → igen → ja → ge upp ------------
  await B.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await B.vanta(`!!document.querySelector(".schack-lobby")`);
  ok("Till lobbyn tar B till lobbyn", /vy=kompis$/.test(await B.ev("location.hash")), await B.ev("location.hash"));
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await tillLobby(A);
  await B.klick(`[data-klocka="5"]`);
  await B.vanta(`!!document.querySelector('[data-act="utmana"][data-uid="${A.uid}"]:not([disabled])')`);
  await B.klick(`[data-act="utmana"][data-uid="${A.uid}"]`);
  await A.vanta(`!!document.querySelector('[data-act="svara-nej"]')`).then(() => ok("A får utmaningen i lobbyn", true), () => ok("A får utmaningen i lobbyn", false));
  ok("utmaningen visar klockan (5 min)", /Bilal vill spela schack med dig \(5 min\)/.test(await A.text(".schack-utmaning")), await A.text(".schack-utmaning"));
  await A.klick('[data-act="svara-nej"]');
  await B.vanta(`!document.querySelector(".schack-lobby-utmanat")`).then(() => ok("Nej tack: B:s utmaning försvinner", true), () => ok("Nej tack: B:s utmaning försvinner", false));
  await B.vanta(`!!document.querySelector('[data-act="utmana"][data-uid="${A.uid}"]:not([disabled])')`);
  await B.klick(`[data-act="utmana"][data-uid="${A.uid}"]`);
  await A.vanta(`!!document.querySelector('[data-act="svara-ja"]')`);
  await A.klick('[data-act="svara-ja"]');
  const id3 = await vantaParti(A, id2); await vantaParti(B, id2);
  await A.klick('[data-act="geupp"]');
  ok("Ge upp visar bekräftelse på sidan", await A.finns(".schack-geupp-ruta"));
  await A.klick('[data-act="geupp-ja"]');
  await slutSynlig(B);
  ok("B: 'Du vann! Alva gav upp.'", /Du vann! Alva gav upp/.test(await slutRubrik(B)), await slutRubrik(B));
  ok("A: 'Du gav upp – Bilal vann.'", /Du gav upp – Bilal vann/.test(await slutRubrik(A)), await slutRubrik(A));
  await B.bild(BILDER, "slutruta-gav-upp");

  // --- 4. tiden slut (5 min) → Kräv vinsten -----------------------------------------
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await vantaMed(A, "5");
  const id4 = await spelaMot(B, A, id3);
  const f4 = await farger(id4, A, B);
  await drag(f4.vit, id4, "d2", "d4");
  const tidigt = await callFran(f4.vit, "schackKravaVinst", { partiId: id4 });
  ok("Kräv vinst innan tiden är slut nekas", !tidigt.ok && tidigt.code === "failed-precondition", tidigt.msg);
  // fejka: svart (på tur) har 2 s kvar
  const pt4 = await parti(id4);
  await db.doc(`schackPartier/${id4}`).update({ klocka: { ...pt4.klocka, svartMs: 2000, senastDragAt: Date.now() } });
  await f4.vit.vanta(`!!document.querySelector('.schack-kompis [data-act="krava"]')`, 10000)
    .then(() => ok("tiden slut: vit får 'Kräv vinsten'", true), () => ok("tiden slut: vit får 'Kräv vinsten'", false));
  ok("svart ser 'Din tid är slut.'", /Din tid är slut/.test(await f4.svart.text(".schack-kompis")));
  await f4.vit.bild(BILDER, "krav-vinsten");
  await f4.vit.klick('.schack-kompis [data-act="krava"]');
  await slutSynlig(f4.vit);
  ok("vit: 'Du vann! Xs tid tog slut.'", /Du vann! .* tid tog slut/.test(await slutRubrik(f4.vit)), await slutRubrik(f4.vit));
  ok("servern: 1-0 tid", (await parti(id4)).orsak === "tid" && (await parti(id4)).resultat === "1-0");

  // --- 5. utan klocka: 4-min-varning, 5-min-krav ------------------------------------
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await B.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await vantaMed(B, "");
  const id5 = await spelaMot(A, B, id4);
  const f5 = await farger(id5, A, B);
  await drag(f5.vit, id5, "e2", "e4");
  await vila(500);
  ok("utan klocka: ingen varning direkt", !/Din tur! Om en minut/.test(await f5.svart.text(".schack-kompis")));
  await db.doc(`schackPartier/${id5}`).update({ senastDragAt: Date.now() - 4 * 60_000 - 5_000 });
  await f5.svart.vanta(`/Din tur! Om en minut kan din motståndare avsluta partiet/.test(document.querySelector(".schack-kompis").textContent)`)
    .then(() => ok("efter 4 min: varning hos den på tur", true), () => ok("efter 4 min: varning hos den på tur", false));
  ok("efter 4 min: motståndaren har ingen avsluta-knapp än", !(await f5.vit.finns('.schack-kompis [data-act="krava"]')));
  const tidigt5 = await callFran(f5.vit, "schackKravaVinst", { partiId: id5 });
  ok("krav efter 4 min nekas av servern", !tidigt5.ok && tidigt5.code === "failed-precondition", tidigt5.msg);
  await f5.svart.bild(BILDER, "varning-4min");
  await db.doc(`schackPartier/${id5}`).update({ senastDragAt: Date.now() - 5 * 60_000 - 2_000 });
  await f5.vit.vanta(`!!document.querySelector('.schack-kompis [data-act="krava"]')`)
    .then(() => ok("efter 5 min: 'X verkar ha gått. Avsluta partiet och ta vinsten?'", true), () => ok("efter 5 min: knappen", false));
  ok("texten", /verkar ha gått\. Avsluta partiet och ta vinsten\?/.test(await f5.vit.text(".schack-kompis-krav")), await f5.vit.text(".schack-kompis-krav"));
  await f5.vit.bild(BILDER, "verkar-ha-gatt");
  await f5.vit.klick('.schack-kompis [data-act="krava"]');
  await slutSynlig(f5.vit); await slutSynlig(f5.svart);
  ok("vinnaren: 'Du vann! X verkar ha gått.'", /verkar ha gått/.test(await slutRubrik(f5.vit)), await slutRubrik(f5.vit));
  ok("den som gick: 'X avslutade partiet och vann.'", /avslutade partiet och vann/.test(await slutRubrik(f5.svart)), await slutRubrik(f5.svart));
  ok("servern: lamnade", (await parti(id5)).orsak === "lamnade");
  k = await klass();
  ok("tabellen efter 5 partier: partier räknas, ingen under 800", Object.values(k.tabell).every((r) => r.poang >= 800) && k.tabell[A.uid].partier === 5 && k.tabell[B.uid].partier === 5, JSON.stringify(k.tabell));
  // Topplistan i elevens lobby
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await A.vanta(`!!document.querySelector(".schack-topplista tr.egen, .schack-topplista .egen")`).then(() => ok("topplistan: egen rad markerad", true), () => ok("topplistan: egen rad markerad", false));
  ok("topplistan visar båda med poäng", /Alva/.test(await A.text(".schack-topplista")) && /Bilal/.test(await A.text(".schack-topplista")), await A.text(".schack-topplista"));
  ok("förklaringen 'Du får mer poäng …'", /Du får mer poäng om du vinner mot någon som har många poäng/.test(await A.text(".schack-lobby-topplista")));
  await A.bild(BILDER, "lobby-topplista");
  const konsol = [A, B, T].flatMap((u) => u.p.konsol.filter((x) => /^(error|EXCEPTION)/.test(x)));
  // pages-varld.js:76 (new URL(e.oldURL)) kastar när lärarinloggningen skickar en egen HashChangeEvent – finns på main (rapportens F-lista)
  const egna = konsol.filter((x) => !/Failed to construct 'URL'/.test(x));
  ok("inga konsolfel i schackkoden (A, B, T)", !egna.length, egna.slice(0, 5).join(" | "));
}
