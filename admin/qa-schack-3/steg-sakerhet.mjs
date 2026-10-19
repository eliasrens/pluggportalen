// Schack slut-QA Etapp 3 (#792), steget "sakerhet" – schackOk för lektioner/pussel: klient-SDK:t i
// elevens riktiga sida skriver direkt mot Firestore-reglerna (som en elev med devtools skulle).
import { db, vila, anvandare, loggaInElev, loggaInLarare } from "../qa-schack-2/lib.mjs";
import { fsOp } from "../qa-schack-2/spel.mjs";

const sd = async (uid) => (await db.doc(`studentData/${uid}`).get()).data() || {};

export default async function sakerhet({ br, PORTAR, ok }) {
  const [PA, PB, PT] = PORTAR;
  const X = await anvandare(br, PA), Y = await anvandare(br, PB);
  await loggaInElev(X, "4a03"); await loggaInElev(Y, "4a04");
  const T = await anvandare(br, PT);
  await loggaInLarare(T);
  // utgångsläge: X har lektion 1 = 3, 2 = 2; pussel.ett = {losta 5, senast 7}; datorPartier 2; ett aktivt kompisparti-id
  await db.doc(`studentData/${X.uid}`).update({ schack: { aktivtParti: "x-parti", datorPartier: 2, lektioner: { "1": 3, "2": 2 }, pussel: { ett: { losta: 5, senast: 7 } } } });
  await db.doc(`studentData/${Y.uid}`).update({ schack: { aktivtParti: null, lektioner: { "1": 1 } } });
  const upd = (uid, data) => `await F.updateDoc(F.doc(db, "studentData", "${uid}"), ${JSON.stringify(data).replace(/"__INC(\d)__"/g, "F.increment($1)")});`;
  const neka = async (namn, kod) => {
    const r = await fsOp(X, kod);
    ok(`nekas: ${namn}`, !r.ok && r.code === "permission-denied", JSON.stringify(r));
  };
  const tillat = async (namn, kod) => {
    const r = await fsOp(X, kod);
    ok(`tillåts: ${namn}`, r.ok, JSON.stringify(r));
  };
  const f0 = JSON.stringify((await sd(X.uid)).schack);

  // lektioner
  await neka("sänka stjärnor i lektion 1 (3 → 1)", upd(X.uid, { "schack.lektioner.1": 1 }));
  await neka("sänka stjärnor i lektion 1 (3 → 2)", upd(X.uid, { "schack.lektioner.1": 2 }));
  await neka("lektion 3 med 4 stjärnor", upd(X.uid, { "schack.lektioner.3": 4 }));
  await neka("lektion 3 med 0 stjärnor", upd(X.uid, { "schack.lektioner.3": 0 }));
  await neka("lektion 3 med 2,5 stjärnor", upd(X.uid, { "schack.lektioner.3": 2.5 }));
  await neka("lektion 3 med strängen \"3\"", upd(X.uid, { "schack.lektioner.3": "3" }));
  await neka("lektion 13 (okänd nyckel)", upd(X.uid, { "schack.lektioner.13": 3 }));
  await neka("lektion 0", upd(X.uid, { "schack.lektioner.0": 3 }));
  await neka("lektion \"fusk\"", upd(X.uid, { "schack.lektioner.fusk": 3 }));
  await neka("ta bort lektion 1 (deleteField)", `await F.updateDoc(F.doc(db, "studentData", "${X.uid}"), { "schack.lektioner.1": F.deleteField() });`);
  await neka("lektioner som null", upd(X.uid, { "schack.lektioner": null }));
  await neka("lektioner som lista", upd(X.uid, { "schack.lektioner": [3, 3, 3] }));
  await neka("hela schack-fältet borttaget", `await F.updateDoc(F.doc(db, "studentData", "${X.uid}"), { schack: F.deleteField() });`);
  await neka("främmande nyckel i schack (schack.fusk)", upd(X.uid, { "schack.fusk": 1 }));
  await neka("främmande nyckel schack.coins", upd(X.uid, { "schack.coins": 100 }));
  // mynt: direkt i studentData (ska ha nekats redan av reglerna för coins? – kontrollera schack-skrivning med coins)
  await neka("schack + coins i SAMMA skrivning", upd(X.uid, { "schack.lektioner.4": 3, coins: 500 }).replace("});", "});"));
  // pussel
  await neka("pussel.ett.losta +2", upd(X.uid, { "schack.pussel.ett.losta": 7, "schack.pussel.ett.senast": 9 }));
  await neka("pussel.ett.senast sänkt (7 → 3)", upd(X.uid, { "schack.pussel.ett.senast": 3 }));
  await neka("pussel.ett.losta sänkt (5 → 1)", upd(X.uid, { "schack.pussel.ett.losta": 1 }));
  await neka("pussel.ett.losta > senast", upd(X.uid, { "schack.pussel.ett.losta": 6, "schack.pussel.ett.senast": 7 }).replace('"schack.pussel.ett.senast":7', '"schack.pussel.ett.senast":7') && `await F.updateDoc(F.doc(db, "studentData", "${X.uid}"), { "schack.pussel.ett.losta": 6, "schack.pussel.ett.senast": 5 });`);
  await neka("pussel.ett.senast 1001", upd(X.uid, { "schack.pussel.ett.senast": 1001 }));
  await neka("pussel.ett.losta med strängvärde", upd(X.uid, { "schack.pussel.ett.losta": "6" }));
  await neka("pussel.tre (okänd sort)", upd(X.uid, { "schack.pussel.tre": { losta: 1, senast: 1 } }));
  await neka("pussel.ett.fusk (okänd nyckel)", upd(X.uid, { "schack.pussel.ett.fusk": 1 }));
  await neka("pussel.ett borttaget", `await F.updateDoc(F.doc(db, "studentData", "${X.uid}"), { "schack.pussel.ett": F.deleteField() });`);
  // datorPartier / aktivtParti (Etapp 1–2) får inte ha brutits
  await neka("datorPartier +2", upd(X.uid, { "schack.datorPartier": 4 }));
  await neka("datorPartier sänkt", upd(X.uid, { "schack.datorPartier": 1 }));
  await neka("aktivtParti nollat", upd(X.uid, { "schack.aktivtParti": null }));
  await neka("aktivtParti bytt", upd(X.uid, { "schack.aktivtParti": "annat" }));
  // annan elevs doc
  const rY = await fsOp(X, upd(Y.uid, { "schack.lektioner.5": 3 }));
  ok("nekas: skriva framsteg i en ANNAN elevs studentData (4a04)", !rY.ok && rY.code === "permission-denied", JSON.stringify(rY));
  const rY2 = await fsOp(X, upd(Y.uid, { "schack.pussel.ett.losta": 1, "schack.pussel.ett.senast": 1 }));
  ok("nekas: skriva pussel i en annan elevs studentData", !rY2.ok && rY2.code === "permission-denied", JSON.stringify(rY2));
  // läraren (årskonto 4A) skriver elevens framsteg
  const rT = await fsOp(T, upd(X.uid, { "schack.lektioner.6": 3 }));
  ok("nekas: läraren sätter en elevs lektionsstjärnor", !rT.ok && rT.code === "permission-denied", JSON.stringify(rT));
  const rT2 = await fsOp(T, upd(X.uid, { "schack.pussel.ett.losta": 6, "schack.pussel.ett.senast": 8 }));
  ok("nekas: läraren sätter en elevs pusselframsteg", !rT2.ok && rT2.code === "permission-denied", JSON.stringify(rT2));
  ok("studentData.schack oförändrad efter alla försök", JSON.stringify((await sd(X.uid)).schack) === f0, JSON.stringify((await sd(X.uid)).schack));
  ok("Y:s framsteg orörda", JSON.stringify((await sd(Y.uid)).schack.lektioner) === JSON.stringify({ "1": 1 }));
  // det legitima
  await tillat("förbättra lektion 1 (3 → 3, lika) – samma värde", upd(X.uid, { "schack.lektioner.1": 3 }));
  await tillat("lektion 2: 2 → 3 (förbättring)", upd(X.uid, { "schack.lektioner.2": 3 }));
  await tillat("ny lektion 12 med 1 stjärna", upd(X.uid, { "schack.lektioner.12": 1 }));
  await tillat("pussel.ett: losta 6, senast 8 (+1, framåt)", upd(X.uid, { "schack.pussel.ett.losta": "__INC1__", "schack.pussel.ett.senast": 8 }));
  await tillat("pussel.tva från början: losta 1, senast 1", upd(X.uid, { "schack.pussel.tva.losta": "__INC1__", "schack.pussel.tva.senast": 1 }));
  await tillat("datorPartier +1 (Etapp 1)", upd(X.uid, { "schack.datorPartier": "__INC1__" }));
  const s = (await sd(X.uid)).schack;
  ok("facit efter de tillåtna: lektioner {1:3,2:3,12:1}, ett {6,8}, tva {1,1}, datorPartier 3, aktivtParti orört",
    JSON.stringify(s.lektioner) === JSON.stringify({ "1": 3, "2": 3, "12": 1 }) && s.pussel.ett.losta === 6 && s.pussel.ett.senast === 8 && s.pussel.tva.losta === 1 && s.datorPartier === 3 && s.aktivtParti === "x-parti", JSON.stringify(s));
  // ett enda skrivning som sätter ALLA tolv lektioner till 3 – släpps igenom (inget att verifiera mot, inga mynt)
  const alla = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => [`schack.lektioner.${n}`, 3]));
  const rAlla = await fsOp(X, upd(X.uid, alla));
  ok("info: en elev kan sätta alla 12 lektioner till 3 stjärnor direkt (klientens ord gäller; inga mynt hänger på det)", true, JSON.stringify(rAlla));
  // Ny elev utan schack-fält alls
  await db.doc(`studentData/${Y.uid}`).update({ schack: (await import("firebase-admin/firestore").catch(() => ({ FieldValue: null }))).FieldValue?.delete?.() });
  const rNy = await fsOp(Y, upd(Y.uid, { "schack.lektioner.1": 2 }));
  ok("tillåts: första lektionsframsteget för en elev utan schack-fält", rNy.ok, JSON.stringify(rNy));
  const rNyP = await fsOp(Y, upd(Y.uid, { "schack.pussel.ett.losta": "__INC1__", "schack.pussel.ett.senast": 1 }));
  ok("tillåts: första pusselframsteget (efter lektionen)", rNyP.ok, JSON.stringify(rNyP));
}
