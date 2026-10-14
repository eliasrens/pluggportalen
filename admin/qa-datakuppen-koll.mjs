import admin from "firebase-admin";
import { readFileSync } from "node:fs";
const app = admin.initializeApp({ projectId: "pluggportalen-so-2026" });
const db = admin.firestore();
const KOD = JSON.parse(readFileSync("src/live/formats/datakuppen/delat/koder.json", "utf8"));
const lista = KOD.koder.map((k) => k.kod);
const s = db.doc("liveSessions/qa-dk-elev");
const sec = (await s.collection("dkSecret").get()).docs.map((d) => d.data());
const me = (await s.collection("dkSelf").doc("b01").get()).data();
const andras = sec.filter((x) => x.uid !== "b01").map((x) => x.code);
const pl = (await s.collection("dkPlayers").doc("b01").get()).data();
console.log(JSON.stringify({ status: (await s.get()).get("status"), b01: me, b01Spelare: pl && { gold: pl.gold, harKod: "code" in pl, protectedUntil: pl.protectedUntil?.toMillis?.() },
  offersIListan: (me?.offers || []).map((c) => lista.includes(c)), offersTagna: (me?.offers || []).filter((c) => andras.includes(c)),
  kodIListan: me?.code ? lista.includes(me.code) : null, kodUnik: me?.code ? !andras.includes(me.code) : null, spelare: sec.length }, null, 1));
await app.delete();
