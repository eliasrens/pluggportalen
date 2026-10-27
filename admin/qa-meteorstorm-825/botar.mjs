// Botelever för slut-QA #825: riktiga inloggningar i auth-emulatorn och riktiga
// callables (functions-emulatorn) via elevklienten ms-klient.js – samma som
// elevskärmen, bara utan DOM. Spelar en hel match i realtid.
//   node botar.mjs <env-fil> <sid> <uid,uid,...> [--ratt 0.7] [--takt 8] [--val skold,laser,drag] [--drag 0.15]
import { readFileSync, appendFileSync } from "node:fs";
const REPO = process.env.REPO;
const { createMsKlient } = await import(`${REPO}/src/live/formats/meteorstorm/ms-klient.js`);
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const env = Object.fromEntries(readFileSync(args[0], "utf8").trim().split("\n").map((r) => r.split("=")));
const sid = args[1];
const uids = args[2].split(",");
const RATT = Number(opt("--ratt", "0.7"));
const TAKT = Number(opt("--takt", "8")) * 1000;
const DRAG = Number(opt("--drag", "0.15"));
const LOGG = opt("--logg", "/dev/null");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logg = (s) => appendFileSync(LOGG, `${new Date().toISOString()} ${s}\n`);

async function login(uid) {
  const r = await fetch(`http://127.0.0.1:${env.AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `${uid}@elev.pluggportalen.local`, password: "lilla123", returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error(`login ${uid}: ${JSON.stringify(j)}`);
  return j.idToken;
}
const raknare = { anrop: {}, fel: {} };
async function call(token, namn, data) {
  raknare.anrop[namn] = (raknare.anrop[namn] || 0) + 1;
  const r = await fetch(`http://127.0.0.1:${env.FN}/pluggportalen-so-2026/europe-west1/${namn}`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ data }),
  });
  const j = await r.json();
  if (j.error) {
    const code = String(j.error.status || "internal").toLowerCase().replace(/_/g, "-");
    raknare.fel[`${namn}:${code}`] = (raknare.fel[`${namn}:${code}`] || 0) + 1;
    throw Object.assign(new Error(j.error.message), { code, details: j.error.details });
  }
  return j.result;
}
// Firestore REST (som eleven, med regler): sessionen.
async function session(token) {
  const r = await fetch(`http://127.0.0.1:${env.FS}/v1/projects/pluggportalen-so-2026/databases/(default)/documents/liveSessions/${sid}`, { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json();
  const f = j.fields || {};
  const v = (x) => x?.stringValue ?? x?.integerValue ?? x?.timestampValue ?? x?.doubleValue;
  return { status: v(f.status), dur: Number(v(f.durationSeconds)), cd: Number(v(f.countdownSeconds) || 0), seed: Number(v(f.msSeed)), gameMode: v(f.gameMode), endsAt: v(f.endsAt), startedAt: v(f.startedAt), lage: f.msInstallningar?.mapValue?.fields?.lage?.stringValue, attacker: f.msInstallningar?.mapValue?.fields?.attacker?.stringValue };
}

const KLASS = opt("--klass", "");
async function join(uid, token) {
  const st = await (await fetch(`http://127.0.0.1:${env.FS}/v1/projects/pluggportalen-so-2026/databases/(default)/documents/students/${uid}`, { headers: { authorization: `Bearer ${token}` } })).json();
  const namn = st.fields?.namn?.stringValue || "";
  const name = `projects/pluggportalen-so-2026/databases/(default)/documents/liveSessions/${sid}/players/${uid}`;
  const r = await fetch(`http://127.0.0.1:${env.FS}/v1/projects/pluggportalen-so-2026/databases/(default)/documents:commit`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ writes: [{ update: { name, fields: { uid: { stringValue: uid }, classId: { stringValue: KLASS }, name: { stringValue: namn }, correct: { integerValue: "0" }, incorrect: { integerValue: "0" } } },
      updateTransforms: [{ fieldPath: "joinedAt", setToServerValue: "REQUEST_TIME" }, { fieldPath: "lastSeenAt", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } }] }),
  });
  if (!r.ok) logg(`${uid} join ${r.status} ${(await r.text()).slice(0, 200)}`);
}
async function spela(uid, i) {
  await sleep(i * 700);
  const token = await login(uid);
  if (KLASS) await join(uid, token);
  let s;
  for (;;) { s = await session(token); if (s.status === "live") break; if (s.status === "finished") return; await sleep(1000); }
  const end = Date.parse(s.startedAt) + (s.cd + s.dur) * 1000;
  logg(`${uid} live: endsAt=${s.endsAt} startedAt=${s.startedAt} end=${new Date(end).toISOString()} nu=${new Date().toISOString()}`);
  await sleep(i * 1500); // varm upp functions-emulatorn utan en storm av kalla arbetare
  const k = createMsKlient({ sid, uid, seed: s.seed, gameMode: s.gameMode, call: (n, d) => call(token, n, d) });
  await k.lage().catch((e) => logg(`${uid} lage ${e.code}`));
  const kalla = k.kalla();
  let rng = (i * 9301 + 49297) % 233280;
  const slump = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };
  await sleep(slump() * TAKT);
  let stat = { ratt: 0, fel: 0, handl: {}, nekad: 0 };
  while (!end || Date.now() < end - 500) {
    const q = kalla.next();
    const ratt = slump() < RATT;
    try {
      const r = await k.svara({ factorA: q.a, factorB: q.b, answer: String(ratt ? q.answer : q.answer + 1), attemptId: `${uid}-${Date.now()}-${Math.floor(slump() * 1e9)}` });
      if (r.correct) {
        stat.ratt++;
        const kanDrag = s.lage === "klass-mot-klass" && s.attacker !== "av";
        const typ = kanDrag && slump() < DRAG && k.energi >= 3 ? "drag" : (slump() < 0.5 ? "skold" : "laser");
        const svar = await k.agera(typ);
        stat.handl[typ] = (stat.handl[typ] || 0) + 1;
        if (svar?.nekad) stat.nekad++;
      } else stat.fel++;
    } catch (e) { logg(`${uid} ${e.code} ${e.message}`); await sleep(1500); }
    await sleep(TAKT * (0.75 + 0.5 * slump()));
    if (end && Date.now() >= end) break;
  }
  await k.skickaFel().catch((e) => logg(`${uid} skickaFel ${e.code}`));
  return stat;
}
const res = await Promise.all(uids.map((u, i) => spela(u, i + 1).catch((e) => ({ err: String(e) }))));
console.log(JSON.stringify({ uids: uids.length, raknare, res: res.slice(0, 3), summaRatt: res.reduce((a, r) => a + (r?.ratt || 0), 0), summaFel: res.reduce((a, r) => a + (r?.fel || 0), 0) }));
