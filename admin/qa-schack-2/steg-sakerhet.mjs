// Schack slut-QA Etapp 2 (#782), steget "sakerhet" – se qa.mjs: direktskrivning, läsa annans
// parti, fel tur/olagligt drag/falsk klocka, elev mot lärarcallables, lärare mot elevcallables.
import { parti, anvandare, loggaInElev, loggaInLarare } from "./lib.mjs";
import { farger, vantaMed, spelaMot, callFran, rawCall, fsOp, nollaKlass } from "./spel.mjs";

export default async function sakerhet({ br, PORTAR, ok }) {
  const [PA, PB, PT, PC, PE, P5] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB), T = await anvandare(br, PT), C = await anvandare(br, PC), E = await anvandare(br, PE);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02"); await loggaInElev(C, "4a03"); await loggaInElev(E, "4b01");
  await loggaInLarare(T);
  await nollaKlass();
  await vantaMed(A, "5");
  const id = await spelaMot(B, A);
  const f = await farger(id, A, B);
  const nej = (r) => !r.ok && r.code === "permission-denied";
  // direktskrivning
  const skriv = {
    "set schackKlass/4a": `await F.setDoc(F.doc(db, "schackKlass", "4a"), { tabell: { x: { poang: 5000 } } }, { merge: true })`,
    "update schackPartier (eget parti, fen)": `await F.updateDoc(F.doc(db, "schackPartier", "${id}"), { fen: "8/8/8/8/8/8/8/K6k w - - 0 1" })`,
    "update schackPartier (egen klocka)": `await F.updateDoc(F.doc(db, "schackPartier", "${id}"), { "klocka.vitMs": 9999999 })`,
    "create schackPartier/nytt": `await F.setDoc(F.doc(db, "schackPartier", "fusk"), { vit: "${f.vit.uid}", svart: "${f.svart.uid}", classId: "4a", status: "pagar" })`,
    "delete schackPartier": `await F.deleteDoc(F.doc(db, "schackPartier", "${id}"))`,
    "studentData.schack.aktivtParti = null": `await F.updateDoc(F.doc(db, "studentData", "${f.vit.uid}"), { "schack.aktivtParti": null })`,
    "studentData.schack.datorPartier + 5": `await F.updateDoc(F.doc(db, "studentData", "${f.vit.uid}"), { "schack.datorPartier": F.increment(5) })`,
  };
  for (const [namn, kod] of Object.entries(skriv)) {
    const r = await fsOp(f.vit, kod);
    ok(`klienten kan inte: ${namn}`, nej(r), JSON.stringify(r));
  }
  ok("partiet orört efter försöken", (await parti(id)).drag.length === 0 && (await parti(id)).status === "pagar");
  // läsa
  const lasC = await fsOp(C, `return (await F.getDoc(F.doc(db, "schackPartier", "${id}"))).data();`);
  ok("klasskompis C kan inte läsa A–B:s parti", nej(lasC), JSON.stringify(lasC));
  const lasE = await fsOp(E, `return (await F.getDoc(F.doc(db, "schackPartier", "${id}"))).data();`);
  ok("elev i annan klass kan inte läsa partiet", nej(lasE), JSON.stringify(lasE));
  const lasQ = await fsOp(C, `return (await F.getDocs(F.query(F.collection(db, "schackPartier"), F.where("classId", "==", "4a")))).size;`);
  ok("klasskompis kan inte lista klassens partier", nej(lasQ), JSON.stringify(lasQ));
  const lasT = await fsOp(T, `return (await F.getDoc(F.doc(db, "schackPartier", "${id}"))).data()?.status;`);
  ok("läraren (hasClass) kan läsa partiet", lasT.ok && lasT.r === "pagar", JSON.stringify(lasT));
  const lasC2 = await fsOp(C, `return (await F.getDoc(F.doc(db, "schackKlass", "4a"))).exists();`);
  ok("klasskompis kan läsa klassdokumentet (lobbyn)", lasC2.ok, JSON.stringify(lasC2));
  // callables: fel tur, olagligt drag, fel spelare, falsk klocka
  const felTur = await callFran(f.svart, "schackDrag", { partiId: id, from: "e7", to: "e5" });
  ok("drag när det inte är ens tur nekas", !felTur.ok && felTur.code === "failed-precondition", felTur.msg);
  const olagligt = await callFran(f.vit, "schackDrag", { partiId: id, from: "e2", to: "e5" });
  ok("olagligt drag nekas", !olagligt.ok && olagligt.code === "invalid-argument", olagligt.msg);
  const motstPjas = await callFran(f.vit, "schackDrag", { partiId: id, from: "e7", to: "e5" });
  ok("flytta motståndarens pjäs nekas", !motstPjas.ok, motstPjas.msg);
  const utomstaende = await callFran(C, "schackDrag", { partiId: id, from: "e2", to: "e4" });
  ok("klasskompis som inte spelar kan inte dra", !utomstaende.ok && utomstaende.code === "permission-denied", utomstaende.msg);
  const fejk = await rawCall(f.vit, "schackDrag", { partiId: id, from: "e2", to: "e4", klocka: { vitMs: 9e9, svartMs: 1 }, nu: 0, senastDragAt: 0, tur: "w", fen: "x", drag: ["e4", "e5", "Qh5"] });
  const ef = await parti(id);
  ok("falsk klocka/fält i anropet ignoreras (servertid)", fejk.ok && ef.drag.length === 1 && ef.klocka.vitMs <= 5 * 60_000 && ef.klocka.svartMs === 5 * 60_000,
    JSON.stringify(ef.klocka));
  const skrap = await rawCall(f.svart, "schackDrag", { partiId: "../schackKlass/4a", from: "e7", to: "e5" });
  ok("konstigt parti-id nekas (invalid-argument)", !skrap.ok && skrap.code === "functions/invalid-argument", skrap.code);
  const proto = await rawCall(f.svart, "schackSvara", { utmaningId: "__proto__", ja: true, classId: "4a" });
  ok("prototypnyckel som utmaningId nekas utan internal", !proto.ok && proto.code !== "functions/internal", `${proto.code}`);
  const remiSjalv = await callFran(f.vit, "schackRemi", { partiId: id, handling: "acceptera" });
  ok("acceptera remi som ingen erbjudit nekas", !remiSjalv.ok, remiSjalv.msg);
  const gu = await callFran(C, "schackGeUpp", { partiId: id });
  ok("utomstående kan inte ge upp åt någon", !gu.ok && gu.code === "permission-denied", gu.msg);
  // elev mot lärarcallables
  const la = await callFran(A, "schackLarareAvsluta", { partiId: id });
  ok("elev kan inte anropa schackLarareAvsluta", nej(la), `${la.code}: ${la.msg}`);
  const lt = await callFran(C, "schackLarareTopplista", { classId: "4a", nollstall: true });
  ok("elev kan inte nollställa topplistan", nej(lt), `${lt.code}: ${lt.msg}`);
  const ld = await callFran(C, "schackLarareTopplista", { classId: "4a", dold: true });
  ok("elev kan inte dölja topplistan", nej(ld), `${ld.code}: ${ld.msg}`);
  // lärare mot elevcallables + lärare utan klassen
  const tv = await callFran(T, "schackVanta", { classId: "4a", klocka: null });
  ok("läraren kan inte vänta i lobbyn (inte elev i klassen)", nej(tv), `${tv.code}: ${tv.msg}`);
  const td = await callFran(T, "schackDrag", { partiId: id, from: "e7", to: "e5" });
  ok("läraren kan inte dra i elevernas parti", !td.ok, `${td.code}: ${td.msg}`);
  if (P5) {
    const T5 = await anvandare(br, P5);
    await loggaInLarare(T5, "qaarskurs5", "#/larare/klasser?klass=5a&sektion=schack");
    const t5 = await callFran(T5, "schackLarareAvsluta", { partiId: id });
    ok("lärare utan klassen (qaarskurs5) kan inte avsluta 4A:s parti", nej(t5), `${t5.code}: ${t5.msg}`);
    const t5l = await fsOp(T5, `return (await F.getDoc(F.doc(db, "schackPartier", "${id}"))).exists();`);
    ok("lärare utan klassen kan inte läsa partiet", nej(t5l), JSON.stringify(t5l));
    const t5k = await fsOp(T5, `return (await F.getDoc(F.doc(db, "schackKlass", "4a"))).exists();`);
    ok("lärare utan klassen kan inte läsa 4A:s klassdokument", nej(t5k), JSON.stringify(t5k));
  }
  ok("partiet fortfarande pågår, 1 drag", (await parti(id)).status === "pagar" && (await parti(id)).drag.length === 1);
  await callFran(f.vit, "schackGeUpp", { partiId: id });
}
