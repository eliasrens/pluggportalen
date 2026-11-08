// Säkerhetsprov #825 mot e2e-emulatorerna (riktiga regler + Cloud Functions) med
// RIKTIGA elevinloggningar: node sak.mjs <env> <sid-kmk-live|avslutad> [sid-enklass]
import { readFileSync } from "node:fs";
const [envFil, SID, SID1] = process.argv.slice(2);
const env = Object.fromEntries(readFileSync(envFil, "utf8").trim().split("\n").map((r) => r.split("=")));
const FS = `http://127.0.0.1:${env.FS}/v1/projects/pluggportalen-so-2026/databases/(default)/documents`;
const ut = [];
const prov = (namn, ok, info = "") => { ut.push({ namn, ok, info: String(info).slice(0, 160) }); };
async function login(uid, dom = "elev") {
  const r = await fetch(`http://127.0.0.1:${env.AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `${uid}@${dom}.pluggportalen.local`, password: "lilla123", returnSecureToken: true }) });
  return (await r.json()).idToken;
}
const H = (t) => ({ "content-type": "application/json", authorization: `Bearer ${t}` });
const las = async (t, p) => (await fetch(`${FS}/${p}`, { headers: H(t) })).status;
const lista = async (t, p) => (await fetch(`${FS}/${p}`, { headers: H(t) })).status;
const skriv = async (t, p, fields) => (await fetch(`${FS}/${p}`, { method: "PATCH", headers: H(t), body: JSON.stringify({ fields }) })).status;
async function call(t, namn, data) {
  const r = await fetch(`http://127.0.0.1:${env.FN}/pluggportalen-so-2026/europe-west1/${namn}`, { method: "POST", headers: H(t), body: JSON.stringify({ data }) });
  const j = await r.json();
  return j.error ? { fel: j.error.status, msg: j.error.message } : { ok: j.result };
}
const b01 = await login("b01"), b02 = await login("b02"), e01 = await login("e01"), f01 = await login("f01");
const s = `liveSessions/${SID}`;
const x = { stringValue: "x" };
// --- Regler: klienten skriver aldrig i ms-samlingarna ---
for (const [p, namn] of [[`${s}/msEvents/b01_999`, "msEvents"], [`${s}/msPlayers/b01`, "msPlayers (eget)"], [`${s}/msPublic/status`, "msPublic/status"], [`${s}/msLas/4b`, "msLas"], [`${s}/msPrivate/snapshot`, "msPrivate"]]) {
  const st = await skriv(b01, p, { uid: { stringValue: "b01" }, x });
  prov(`elev skriver ${namn}`, st === 403, st);
}
const stL = await skriv(await login("elias", "larare"), `${s}/msEvents/elias_1`, { x });
prov("lärare skriver msEvents", stL === 403, stL);
// --- Regler: elev läser inte andras ---
prov("elev läser eget msPlayers (200 eller 404 = tillåtet)", [200, 404].includes(await las(b01, `${s}/msPlayers/b01`)), await las(b01, `${s}/msPlayers/b01`));
prov("elev läser annans msPlayers (b02)", (await las(b01, `${s}/msPlayers/b02`)) === 403, await las(b01, `${s}/msPlayers/b02`));
prov("elev läser annan klass msPlayers (e01)", (await las(b01, `${s}/msPlayers/e01`)) === 403, await las(b01, `${s}/msPlayers/e01`));
prov("elev listar msEvents", (await lista(b01, `${s}/msEvents`)) === 403, await lista(b01, `${s}/msEvents`));
prov("elev läser annans msEvents-dok", (await las(b01, `${s}/msEvents/b02_1`)) === 403, await las(b01, `${s}/msEvents/b02_1`));
prov("elev läser msPrivate", (await las(b01, `${s}/msPrivate/snapshot`)) === 403, await las(b01, `${s}/msPrivate/snapshot`));
prov("elev läser msPublic/status (egen match)", (await las(b01, `${s}/msPublic/status`)) === 200, await las(b01, `${s}/msPublic/status`));
prov("elev utanför matchen (f01, 6A) läser status", (await las(f01, `${s}/msPublic/status`)) === 403, await las(f01, `${s}/msPublic/status`));
// --- Callables: fusk ---
let r = await call(b01, "msAgera", { sid: "finnsinte", attemptId: "q1", svar: { k: 0, factorA: 2, factorB: 3, answer: "6" }, typ: "skold" });
prov("msAgera fel sessions-id", !!r.fel, r.fel + " " + r.msg);
r = await call(f01, "msAgera", { sid: SID, attemptId: "q2", svar: { k: 0, factorA: 2, factorB: 3, answer: "6" }, typ: "skold" });
prov("msAgera elev utanför klasserna", !!r.fel, r.fel + " " + r.msg);
r = await call(null, "msAgera", { sid: SID, attemptId: "q3", typ: "skold" });
prov("msAgera utan inloggning", r.fel === "UNAUTHENTICATED", r.fel + " " + r.msg);
r = await call(b01, "msAvsluta", { sid: "finnsinte" });
prov("msAvsluta fel sessions-id", !!r.fel, r.fel + " " + r.msg);
r = await call(f01, "msLage", { sid: SID });
prov("msLage elev utanför klasserna", !!r.fel, r.fel + " " + r.msg);
// --- Under en PÅGÅENDE match (LIVE=<sid> UID=<elev>): energi, fel svar, fusk-faktorer ---
if (process.env.LIVE) {
  const { multFor } = await import(`${process.env.REPO}/src/live/formats/meteorstorm/delat/ms-anrop.js`);
  const uid = process.env.ELEV || "b03";
  const t = await login(uid);
  const sess = await (await fetch(`${FS}/liveSessions/${process.env.LIVE}`, { headers: H(t) })).json();
  const seed = Number(sess.fields.msSeed.integerValue ?? sess.fields.msSeed.doubleValue);
  const L = await call(t, "msLage", { sid: process.env.LIVE });
  prov(`msLage (${uid})`, !!L.ok, JSON.stringify(L).slice(0, 120));
  let { nr, energi, k } = L.ok;
  let nasta = (Number.isInteger(k) ? k : -1) + 1;
  if (process.env.BARA_DRAG) {
    const g0 = multFor(seed, uid, nasta);
    const r0 = await call(t, "msAgera", { sid: process.env.LIVE, attemptId: `drag0-${Date.now()}`, svar: { k: nasta, factorA: g0.a, factorB: g0.b, answer: String(g0.a * g0.b) }, typ: "drag", fel: [], ...(nr ? { nr: nr + 1 } : {}) });
    prov(`msAgera dragstråle med energi ${energi} (+1) – kostnad 3 i Milda → nekas, energin sparas`, !!r0.ok?.nekad, JSON.stringify(r0.ok ? { correct: r0.ok.correct, energi: r0.ok.energi, nekad: r0.ok.nekad, onskad: r0.ok.onskad } : r0).slice(0, 200));
    console.log(JSON.stringify(ut, null, 1)); process.exit(0);
  }
  const f = multFor(seed, uid, nasta);
  // Fusk: rätt svar på en fråga eleven inte fått (fel faktorer)
  let r = await call(t, "msAgera", { sid: process.env.LIVE, attemptId: `fusk-${Date.now()}`, svar: { k: nasta, factorA: f.a === 7 ? 8 : 7, factorB: 9, answer: String((f.a === 7 ? 8 : 7) * 9) }, typ: "skold", fel: [], ...(nr ? { nr: nr + 1 } : {}) });
  prov("msAgera påhittade faktorer nekas", !!r.fel || r.ok?.correct === false, JSON.stringify(r).slice(0, 160));
  // Fel svar + handling → ingen handling
  r = await call(t, "msAgera", { sid: process.env.LIVE, attemptId: `fel-${Date.now()}`, svar: { k: nasta, factorA: f.a, factorB: f.b, answer: String(f.a * f.b + 1) }, typ: "skold", fel: [], ...(nr ? { nr: nr + 1 } : {}) });
  prov("msAgera fel svar ger ingen handling", !!r.fel || r.ok?.correct === false, JSON.stringify(r).slice(0, 160));
  const L2 = await call(t, "msLage", { sid: process.env.LIVE });
  ({ nr, energi, k } = L2.ok); nasta = (Number.isInteger(k) ? k : -1) + 1;
  const g = multFor(seed, uid, nasta);
  // Dragstråle utan energi / i En klass / Attacker av → nekad (energin sparas)
  r = await call(t, "msAgera", { sid: process.env.LIVE, attemptId: `drag-${Date.now()}`, svar: { k: nasta, factorA: g.a, factorB: g.b, answer: String(g.a * g.b) }, typ: "drag", fel: [], ...(nr ? { nr: nr + 1 } : {}) });
  prov(`msAgera dragstråle (energi före ${energi}) nekas`, !!r.ok?.nekad || !!r.fel, JSON.stringify(r.ok ? { correct: r.ok.correct, energi: r.ok.energi, nekad: r.ok.nekad, onskad: r.ok.onskad } : r).slice(0, 160));
  // Samma attemptId igen → inget nytt (idempotent)
}
console.log(JSON.stringify(ut, null, 1));
console.log(`${ut.filter((x) => x.ok).length}/${ut.length} ok`);
