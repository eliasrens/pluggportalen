// QA #656: skriver serverns hemliga läge för b01:s hack (bara emulator):
// varje spelares aktuella kod + b01:s minne (lockkoder, strukna) per mål.
import admin from "firebase-admin";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("bara emulator");
const app = admin.initializeApp({ projectId: "pluggportalen-so-2026" });
const s = admin.firestore().doc(`liveSessions/${process.argv[2] || "qa-dk-elev"}`);
const namn = Object.fromEntries((await s.collection("players").get()).docs.map((d) => [d.id, d.get("name")]));
for (const d of (await s.collection("dkSecret").get()).docs) {
  const x = d.data();
  const minne = x.hacks ? Object.entries(x.hacks).map(([m, h]) => `mot ${namn[m] || m}: ${JSON.stringify(h)}`).join(" · ") : "";
  console.log(`${namn[d.id] || d.id} (${d.id}) kod=${x.code} v${x.codeVersion}${minne ? "  " + minne : ""}`);
}
// Test 12 i matchen: ingen lockkod är någon spelares AKTUELLA kod, och
// lockkoderna har ungefär samma längd som rätt kod.
const sec = (await s.collection("dkSecret").get()).docs.map((d) => d.data());
const koder = new Map(sec.map((x) => [x.uid, x.code]));
let par = 0, fel = 0, langd = [];
for (const x of sec) for (const [mal, h] of Object.entries(x.hacks || {})) {
  par++;
  for (const l of h.decoys || []) {
    if ([...koder.values()].includes(l)) { fel++; console.log(`✗ lockkod ${l} (${x.uid}→${mal}) är någons kod`); }
    langd.push(Math.abs(l.length - (koder.get(mal) || "").length));
  }
}
console.log(`lockkoder: ${par} par, ${fel} är någons aktuella kod, längdskillnad max ${Math.max(0, ...langd)}`);
await app.delete();
