// Schack slut-QA Etapp 2 (#782), steget "lobby" – se qa.mjs: vänta/sluta vänta, utmana/nej,
// 2-/10-min-utgång, ett parti åt gången (även samtidigt), återkomst, annan klass.
import { db, vila, klass, anvandare, loggaInElev, tillLobby, vantaParti } from "./lib.mjs";
import { vantaMed, spelaMot, callFran, fsOp, nollaKlass } from "./spel.mjs";

export default async function lobby({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, , PC, PE] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB), C = await anvandare(br, PC), E = await anvandare(br, PE);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02"); await loggaInElev(C, "4a03"); await loggaInElev(E, "4b01");
  await nollaKlass();

  // vänta / sluta vänta
  await vantaMed(A, "");
  await tillLobby(B);
  await B.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${A.uid}"]')`);
  ok("väntan utan klocka: 'Alva väntar · ingen klocka'", /Alva\s*väntar · ingen klocka/.test(await B.text(".schack-lobby-vantar")), await B.text(".schack-lobby-vantar"));
  await A.bild(BILDER, "lobby-du-vantar");
  await A.klick('[data-act="sluta-vanta"]');
  await B.vanta(`!document.querySelector('.schack-vantar-kort [data-uid="${A.uid}"]')`).then(() => ok("Sluta vänta: kortet försvinner hos B", true), () => ok("Sluta vänta: kortet försvinner hos B", false));
  ok("A har 'Vänta på en motståndare' igen", await A.finns('[data-act="vanta"]'));

  // utmaningen går ut efter 2 min (lokalt, utan ny ändring i dokumentet)
  await tillLobby(A);
  await B.vanta(`!!document.querySelector('[data-act="utmana"][data-uid="${A.uid}"]:not([disabled])')`);
  await B.klick(`[data-act="utmana"][data-uid="${A.uid}"]`);
  await A.vanta(`!!document.querySelector('[data-act="svara-ja"]')`);
  let k = await klass();
  const [uid0] = Object.entries(k.utmaningar)[0];
  await db.doc("schackKlass/4a").update({ [`utmaningar.${uid0}.sedan`]: Date.now() - 2 * 60_000 + 5_000 });
  await vila(2000);
  ok("utmaningen syns 3 s före utgången", await A.finns('[data-act="svara-ja"]'));
  const t0 = Date.now();
  await A.vanta(`!document.querySelector('[data-act="svara-ja"]')`, 12000).then(() => ok("utmaningen försvinner efter 2 min (lokal timer)", true, `${Date.now() - t0} ms efter kontroll`), () => ok("utmaningen försvinner efter 2 min", false));
  await B.vanta(`!document.querySelector(".schack-lobby-utmanat")`, 5000).then(() => ok("…och hos utmanaren", true), () => ok("…och hos utmanaren", false));
  const sent = await callFran(A, "schackSvara", { utmaningId: uid0, ja: true, classId: "4a" });
  ok("servern: svar på utgången utmaning nekas", !sent.ok, `${sent.code}: ${sent.msg}`);

  // väntan går ut efter 10 min
  await vantaMed(A, "15");
  await B.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${A.uid}"]')`);
  await db.doc("schackKlass/4a").update({ [`vantar.${A.uid}.sedan`]: Date.now() - 10 * 60_000 + 4_000 });
  await B.vanta(`!document.querySelector('.schack-vantar-kort [data-uid="${A.uid}"]')`, 12000).then(() => ok("väntan försvinner efter 10 min hos B", true), () => ok("väntan försvinner efter 10 min", false));
  await A.vanta(`!!document.querySelector('[data-act="vanta"]')`, 5000).then(() => ok("…och A ser 'Vänta på en motståndare'", true), () => ok("…och A:s egen väntan", false));
  const gm = await callFran(B, "schackGaMed", { classId: "4a", motstandare: A.uid });
  ok("servern: gå med i utgången väntan nekas", !gm.ok, `${gm.code}: ${gm.msg}`);

  // ett parti åt gången
  await vantaMed(A, "10");
  const id = await spelaMot(B, A);
  await tillLobby(C);
  await C.vanta(`/spelar just nu/.test(document.querySelector(".schack-lobby-utmana").textContent)`);
  ok("C ser A och B som 'spelar just nu' med Utmana avstängd",
    await C.ev(`["${A.uid}","${B.uid}"].every((u) => document.querySelector('[data-act="utmana"][data-uid="' + u + '"]')?.disabled)`));
  ok("C ser 'Pågående partier': Alva – Bilal", /Alva.*Bilal|Bilal.*Alva/.test(await C.text(".schack-lobby-pagaende")), await C.text(".schack-lobby-pagaende"));
  await C.bild(BILDER, "lobby-pagaende");
  const ut = await callFran(C, "schackUtmana", { classId: "4a", till: A.uid, klocka: null });
  ok("C kan inte utmana A som spelar", !ut.ok, `${ut.code}: ${ut.msg}`);
  await vantaMed(C, "");
  const gm2 = await callFran(A, "schackGaMed", { classId: "4a", motstandare: C.uid });
  ok("A (i parti) kan inte gå med i C:s väntan", !gm2.ok, `${gm2.code}: ${gm2.msg}`);
  const va = await callFran(A, "schackVanta", { classId: "4a", klocka: null });
  ok("A (i parti) kan inte vänta", !va.ok, `${va.code}: ${va.msg}`);

  // återkomst till pågående parti
  await A.ev(`location.hash = "#/elev/hem"`);
  await vila(1500);
  await A.ev(`location.hash = "#/elev/schack"`);
  await A.vanta(`location.hash.includes("parti=${id}")`, 15000).then(() => ok("återkomst: #/elev/schack tar A tillbaka till partiet", true), () => ok("återkomst till partiet", false));
  await A.e.oppna(`#/elev/schack?vy=kompis&parti=${id}`);
  await vantaParti(A).then((x) => ok("omladdning stannar i partiet", x === id), () => ok("omladdning stannar i partiet", false));

  // A–B slut; C väntar; A och B trycker Spela! samtidigt → bara en får partiet
  await callFran(A, "schackGeUpp", { partiId: id });
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await B.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await tillLobby(A); await tillLobby(B);
  await A.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${C.uid}"]')`);
  await B.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${C.uid}"]')`);
  const [ra, rb] = await Promise.all([
    callFran(A, "schackGaMed", { classId: "4a", motstandare: C.uid }),
    callFran(B, "schackGaMed", { classId: "4a", motstandare: C.uid }),
  ]);
  k = await klass();
  ok("A och B går med i C:s väntan samtidigt → exakt en lyckas, ett parti", [ra, rb].filter((r) => r.ok).length === 1 && Object.keys(k.partier).length === 1,
    `A ${ra.ok ? "ok" : ra.code} · B ${rb.ok ? "ok" : rb.code} · ${Object.keys(k.partier).length} parti`);
  const vinnare = ra.ok ? A : B, forlorare = ra.ok ? B : A;
  const idC = ra.ok ? ra.data.partiId : rb.data.partiId;
  await vantaParti(C).then((x) => ok("C hamnar i partiet automatiskt", x === idC), () => ok("C hamnar i partiet", false));
  await vantaParti(vinnare).then((x) => ok("den som hann först hamnar i partiet (via lobbylyssnaren)", x === idC), () => ok("vinnaren hamnar i partiet", false));
  await callFran(C, "schackGeUpp", { partiId: idC });
  // samma elev försöker starta två partier samtidigt
  await vila(1500);
  await vinnare.e.oppna("#/elev/schack?vy=kompis");
  await C.e.oppna("#/elev/schack?vy=kompis");
  await callFran(C, "schackVanta", { classId: "4a", klocka: null });
  await callFran(forlorare, "schackVanta", { classId: "4a", klocka: null });
  const [r1, r2] = await Promise.all([
    callFran(vinnare, "schackGaMed", { classId: "4a", motstandare: C.uid }),
    callFran(vinnare, "schackGaMed", { classId: "4a", motstandare: forlorare.uid }),
  ]);
  k = await klass();
  ok("en elev går med i två väntan samtidigt → bara ett parti", [r1, r2].filter((r) => r.ok).length === 1 && Object.keys(k.partier).length === 1,
    `${r1.ok ? "ok" : r1.code} / ${r2.ok ? "ok" : r2.code}`);
  for (const pid of Object.keys(k.partier)) await callFran(vinnare, "schackGeUpp", { partiId: pid });
  for (const u of [A, B, C]) await callFran(u, "schackSlutaVanta", { classId: "4a" });

  // annan klass ser inget
  await vantaMed(A, "10");
  await tillLobby(E);
  await vila(1500);
  const eText = await E.text(".schack-lobby");
  ok("Ebba (4B) ser inte 4A:s väntan, partier eller elever", !/Alva|Bilal|Cleo/.test(eText), eText.slice(0, 160));
  const las = await fsOp(E, `return (await F.getDoc(F.doc(db, "schackKlass", "4a"))).exists();`);
  ok("Ebba kan inte läsa schackKlass/4a", !las.ok && las.code === "permission-denied", JSON.stringify(las));
  const gm3 = await callFran(E, "schackGaMed", { classId: "4a", motstandare: A.uid });
  ok("Ebba kan inte gå med i 4A:s väntan", !gm3.ok && gm3.code === "permission-denied", `${gm3.code}: ${gm3.msg}`);
  await callFran(A, "schackSlutaVanta", { classId: "4a" });
  ok("inga konsolfel", ![A, B, C, E].some((u) => u.p.konsol.some((x) => /^(error|EXCEPTION)/.test(x))),
    [A, B, C, E].flatMap((u) => u.p.konsol.filter((x) => /^(error|EXCEPTION)/.test(x))).slice(0, 5).join(" | "));
}
