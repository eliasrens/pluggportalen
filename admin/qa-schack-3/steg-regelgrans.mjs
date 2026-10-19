// Schack slut-QA Etapp 3 (#792), steget "regelgrans" – F1: schackOk() körs på VARJE skrivning till
// studentData när dokumentet har ett schack-fält, och reglerna får utvärdera högst 1000 uttryck per
// begäran. Med många lektioner + pusselframsteg överskrids det och ALLA skrivningar till studentData
// nekas (mynt, stjärnor, avatar …), inte bara schackens. Matris: [tillstånd] × [skrivning].
import { db, anvandare, loggaInElev } from "../qa-schack-2/lib.mjs";
import { fsOp } from "../qa-schack-2/spel.mjs";

export default async function regelgrans({ br, PORTAR, ok }) {
  const X = await anvandare(br, PORTAR[0]);
  await loggaInElev(X, "4a03");
  const upd = (data) => `await F.updateDoc(F.doc(db, "studentData", "${X.uid}"), ${JSON.stringify(data).replace(/"__INC__"/g, "F.increment(1)")});`;
  const lek = (k) => Object.fromEntries(Array.from({ length: k }, (_, i) => [String(i + 1), 3]));
  const P = { ett: { losta: 6, senast: 8 }, tva: { losta: 2, senast: 2 } };
  const tillstand = [
    ["11 lektioner", 11, null], ["12 lektioner", 12, null], ["8 lektioner + pussel ett", 8, { ett: P.ett }], ["9 lektioner + pussel ett", 9, { ett: P.ett }],
    ["5 lektioner + pussel ett+tva", 5, P], ["6 lektioner + pussel ett+tva", 6, P], ["12 lektioner + pussel ett+tva", 12, P],
  ];
  const skrivningar = {
    "coins +1 (opåverkat av schack)": { coins: "__INC__" },
    "stars +1 (opåverkat av schack)": { stars: "__INC__" },
    "datorPartier +1 (Etapp 1)": { "schack.datorPartier": "__INC__" },
    "pussel ett +1": null,
  };
  for (const [namn, k, pussel] of tillstand) {
    const rad = [];
    for (const [sk, data] of Object.entries(skrivningar)) {
      await db.doc(`studentData/${X.uid}`).update({ schack: { aktivtParti: null, datorPartier: 1, lektioner: lek(k), ...(pussel ? { pussel } : {}) } });
      const d = data || { "schack.pussel.ett.losta": "__INC__", "schack.pussel.ett.senast": (pussel?.ett?.senast || 0) + 1 };
      const r = await fsOp(X, upd(d));
      rad.push([sk, r.ok]);
    }
    ok(`${namn}: alla fyra skrivningarna tillåts`, rad.every(([, o]) => o), rad.map(([a, o]) => `${a}: ${o ? "ok" : "NEKAD"}`).join(" | "));
  }
}
