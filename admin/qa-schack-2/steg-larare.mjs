// Schack slut-QA Etapp 2 (#782), steget "larare" – se qa.mjs: topplistan (live, dölj, nollställ),
// avsluta parti (avbrutet hos båda, tabellen orörd), statistik, modul av, fokusläge.
import { db, vila, parti, klass, anvandare, loggaInElev, loggaInLarare, drag } from "./lib.mjs";
import { farger, vantaMed, spelaMot, slutRubrik, slutSynlig, callFran, nollaKlass } from "./spel.mjs";

export default async function larare({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, PT] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB), T = await anvandare(br, PT);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await nollaKlass();
  await db.doc(`studentData/${A.uid}`).set({ schack: { datorPartier: 3 } }, { merge: true });
  await loggaInLarare(T);
  ok("lärarsektionen Schack öppnas (#/larare/klasser?klass=4a&sektion=schack)", await T.finns(".sl-modul"));
  ok("modulen visas som påslagen", /Stäng av schack/.test(await T.text(".sl-modul")), await T.text(".sl-modul"));
  // ett parti som avgörs (tabell) + ett som pågår
  await vantaMed(A, "10");
  let id = await spelaMot(B, A);
  await callFran(A, "schackGeUpp", { partiId: id });
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await B.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await T.vanta(`/Bilal/.test(document.querySelector(".sl-topp").textContent)`).then(() => ok("lärarens topplista uppdateras live", true), () => ok("lärarens topplista", false));
  await vantaMed(A, "");
  id = await spelaMot(B, A, id);
  const f = await farger(id, A, B);
  await drag(f.vit, id, "e2", "e4");
  await T.vanta(`!!document.querySelector('[data-avsluta="${id}"]')`).then(() => ok("pågående parti i lärarens lista", true), () => ok("pågående parti i lärarens lista", false));
  ok("listan: namnen + ingen klocka", /Alva/.test(await T.text(".sl-partier")) && /Bilal/.test(await T.text(".sl-partier")), await T.text(".sl-partier"));
  await T.bild(BILDER, "larare-sektion");
  // avsluta
  const tabellFore = JSON.stringify((await klass()).tabell);
  await T.klick(`[data-avsluta="${id}"]`);
  ok("Avsluta: bekräftelse på sidan (inte confirm())", await T.finns(".sl-bekrafta [data-ja]"));
  await T.klick(".sl-bekrafta [data-ja]");
  await slutSynlig(A); await slutSynlig(B);
  ok("avbrutet hos båda eleverna", /Partiet avbröts/.test(await slutRubrik(A)) && /Partiet avbröts/.test(await slutRubrik(B)), await slutRubrik(A));
  await A.bild(BILDER, "slutruta-avbrutet");
  const pa = await parti(id);
  ok("servern: avbrutet utan resultat", pa.status === "slut" && pa.orsak === "avbrutet" && pa.resultat === null);
  ok("tabellen orörd", JSON.stringify((await klass()).tabell) === tabellFore);
  await T.vanta(`!document.querySelector('[data-avsluta="${id}"]')`).then(() => ok("partiet försvinner ur lärarens lista", true), () => ok("partiet ur listan", false));
  // statistik
  await T.klick("[data-dator]");
  await T.vanta(`/Uppdatera partier mot datorn/.test(document.querySelector(".sl-stat").textContent)`, 15000);
  const stat = await T.ev(`[...document.querySelectorAll(".sl-stat-tbl tr")].map((r) => [...r.children].map((c) => c.textContent.trim()).join(" | "))`);
  ok("statistik: Alva 1 kompisparti (0–1–0) + 3 mot datorn = 4", stat.some((r) => /^Alva \| 1 \(0–1–0\) \| 3 \| 4$/.test(r)), stat.join(" ¦ "));
  // dölj / visa / nollställ
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await A.vanta(`!!document.querySelector(".schack-lobby-topplista:not([hidden]) .schack-topplista")`);
  await T.klick('[data-dold="dolj"]');
  await A.vanta(`document.querySelector(".schack-lobby-topplista").hidden`).then(() => ok("Dölj för eleverna → topplistan borta hos eleven", true), () => ok("Dölj → borta hos eleven", false));
  ok("klassdoc dold: true", (await klass()).dold === true);
  await T.vanta(`!!document.querySelector('[data-dold="visa"]')`);
  await T.klick('[data-dold="visa"]');
  await A.vanta(`!document.querySelector(".schack-lobby-topplista").hidden`).then(() => ok("Visa för eleverna → syns igen", true), () => ok("Visa → syns igen", false));
  await T.klick("[data-nollstall]");
  ok("Nollställ: bekräftelse på sidan", await T.finns(".sl-bekrafta [data-ja]"));
  await T.klick(".sl-bekrafta [data-ja]");
  await A.vanta(`!/Bilal/.test(document.querySelector(".schack-lobby-topplista").textContent)`).then(() => ok("nollställd topplista hos eleven", true), () => ok("nollställd hos eleven", false));
  ok("klassdoc tabell tom", !Object.keys((await klass()).tabell || {}).length);
  // modulen av
  await T.klick('[data-modul="av"]');
  await vila(1500);
  const cl = (await db.doc("classes/4a").get()).data();
  ok("Stäng av schack: borta ur enabledModules", !(cl.enabledModules || []).includes("schack"), JSON.stringify(cl.enabledModules));
  const av = await callFran(A, "schackVanta", { classId: "4a", klocka: null });
  ok("modul av: callable nekar", !av.ok && av.code === "failed-precondition", `${av.code}: ${av.msg}`);
  await A.e.oppna("#/elev/schack?vy=kompis");
  await vila(2500);
  ok("modul av: eleven kommer inte in i lobbyn", !(await A.finns(".schack-lobby")), await A.ev("location.hash"));
  await A.bild(BILDER, "elev-modul-av");
  await T.klick('[data-modul="pa"]');
  await vila(1500);
  ok("Slå på schack: tillbaka i enabledModules", ((await db.doc("classes/4a").get()).data().enabledModules || []).includes("schack"));
  // fokusläge
  await db.doc("classes/4a").update({ lock: { mal: { typ: "lasresan" }, till: Date.now() + 30 * 60_000 } });
  const fok = await callFran(A, "schackVanta", { classId: "4a", klocka: null });
  ok("fokusläge: callable nekar", !fok.ok && /fokusläge/.test(fok.msg), `${fok.code}: ${fok.msg}`);
  await A.e.oppna("#/elev/schack?vy=kompis");
  await vila(3000);
  ok("fokusläge: eleven kommer inte in i schacklobbyn", !(await A.finns(".schack-lobby")), await A.ev("location.hash"));
  await A.bild(BILDER, "elev-fokuslage");
  await db.doc("classes/4a").update({ lock: null });
  ok("inga konsolfel (eleverna)", ![A, B].some((u) => u.p.konsol.some((x) => /^(error|EXCEPTION)/.test(x))),
    [A, B].flatMap((u) => u.p.konsol.filter((x) => /^(error|EXCEPTION)/.test(x))).slice(0, 5).join(" | "));
}
