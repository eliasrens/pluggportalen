// Schack slut-QA Etapp 2 (#782), steget "gammalt" – se qa.mjs. 24 h-städningen (valet: när
// klassdokumentet skrivs + i varje partianrop, ingen schemalagd funktion) och en utmaning som
// kommer medan eleven spelar mot datorn.
import { db, vila, parti, klass, anvandare, loggaInElev, tillLobby, vantaParti } from "./lib.mjs";
import { farger, vantaMed, spelaMot, slutRubrik, slutSynlig, callFran, nollaKlass } from "./spel.mjs";

const DYGN = 24 * 60 * 60_000;

export default async function gammalt({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, , PC] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB), C = await anvandare(br, PC);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02"); await loggaInElev(C, "4a03");
  await nollaKlass();

  // ett parti utan drag på 25 h: står kvar i listan tills nästa lobbyanrop i klassen
  await vantaMed(A, "");
  const id = await spelaMot(B, A);
  const gammal = Date.now() - DYGN - 60 * 60_000;
  await db.doc(`schackPartier/${id}`).update({ senastDragAt: gammal, skapad: gammal });
  await db.doc("schackKlass/4a").update({ [`partier.${id}.start`]: gammal });
  await tillLobby(C);
  ok("före städningen: partiet syns i 'Pågående partier'", /Alva.*Bilal|Bilal.*Alva/.test(await C.text(".schack-lobby-pagaende")), await C.text(".schack-lobby-pagaende"));
  await C.klick('[data-act="vanta"]'); // ett lobbyanrop i klassen
  await slutSynlig(A); await slutSynlig(B);
  ok("lobbyanrop → 25 h-partiet avbryts hos båda spelarna", /Partiet avbröts/.test(await slutRubrik(A)) && /Partiet avbröts/.test(await slutRubrik(B)), await slutRubrik(A));
  const p = await parti(id), k = await klass();
  ok("servern: avbrutet, bort ur partier, ingen tabellrad", p.orsak === "avbrutet" && !k.partier?.[id] && !Object.keys(k.tabell || {}).length, JSON.stringify({ orsak: p.orsak, tabell: k.tabell }));
  const fri = await callFran(A, "schackGaMed", { classId: "4a", motstandare: C.uid });
  ok("spelarna är fria igen (A kan gå med i C:s väntan)", fri.ok, fri.msg);
  const id2 = fri.data?.partiId;
  await vantaParti(C, "").catch(() => {});

  // ett partianrop på ett 25 h-parti avbryter det i stället
  await db.doc(`schackPartier/${id2}`).update({ senastDragAt: gammal });
  const f2 = await farger(id2, A, C);
  const dr = await callFran(f2.vit, "schackDrag", { partiId: id2, from: "e2", to: "e4" });
  ok("drag i ett 25 h-parti nekas och partiet avbryts", !dr.ok && /24 timmar/.test(dr.msg) && (await parti(id2)).orsak === "avbrutet", dr.msg);

  // en utmaning medan eleven spelar mot datorn
  await A.e.startaParti("bonden", "w");
  await A.e.elevDrag();
  await vila(1500);
  await B.e.oppna("#/elev/schack?vy=kompis");
  await B.vanta(`!!document.querySelector('[data-act="utmana"][data-uid="${A.uid}"]:not([disabled])')`, 20000);
  await B.klick(`[data-act="utmana"][data-uid="${A.uid}"]`);
  await A.vanta(`!!document.querySelector('[data-act="svara-ja"]')`, 10000)
    .then(() => ok("utmaningsrutan visas mitt i partiet mot datorn", true), () => ok("utmaningsrutan visas mitt i partiet mot datorn", false));
  await A.bild(BILDER, "utmaning-mot-datorn");
  await A.klick('[data-act="svara-ja"]');
  const id3 = await vantaParti(A);
  ok("Spela! → kompispartiet öppnas", !!id3);
  await callFran(B, "schackGeUpp", { partiId: id3 });
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await A.ev(`location.hash = "#/elev/schack"`);
  await A.vanta(`!!document.querySelector('[data-act="fortsatt"]')`, 10000)
    .then(() => ok("datorpartiet finns kvar efteråt (Fortsätt partiet)", true), () => ok("datorpartiet finns kvar efteråt", false));

  // golvet 800 i topplistan (§8): Alva på 805 förlorar mot Bilal på 1000 → 800, inte 796
  await db.doc("schackKlass/4a").set({ tabell: { [A.uid]: { poang: 805, vinster: 0, forluster: 9, remier: 0, partier: 9 } } }, { merge: true });
  await vantaMed(B, "");
  await spelaMot(A, B);
  await A.klick('[data-act="geupp"]');
  await A.klick('[data-act="geupp-ja"]');
  await slutSynlig(A);
  const t4 = (await klass()).tabell;
  ok("golvet: 805 − round(5 + 15·E) stannar på 800", t4[A.uid].poang === 800 && t4[A.uid].forluster === 10, JSON.stringify(t4[A.uid]));
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await A.vanta(`/800/.test(document.querySelector(".schack-topplista .egen")?.textContent || "")`, 8000)
    .then(() => ok("elevens topplista visar 800 på egen rad", true), () => ok("elevens topplista visar 800", false));
}
