import admin from "firebase-admin";
const db = admin.firestore(admin.initializeApp({ projectId: "pluggportalen-so-2026" }));
const [s, b, l] = await Promise.all([db.doc(`studentData/${process.argv[2]}`).get(), db.doc(`hittaRattBest/${process.argv[2]}`).get(), db.doc("hittaRattMeta/ledare").get()]);
const p = b.data()?.packs || {};
console.log(JSON.stringify({ coins: s.data()?.coins, best: Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith("e-")).map(([k, v]) => [k, v.s ?? `${v.r}/${v.n} ${v.t}`])), ledare: Object.fromEntries(Object.entries(l.data()?.packs || {}).map(([k, v]) => [k, v.uids.join(",")])) }));
process.exit(0);
