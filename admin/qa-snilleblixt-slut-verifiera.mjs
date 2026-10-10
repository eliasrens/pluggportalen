// ============================================================================
// Snilleblixten slut-QA (#561) – VERIFIERINGEN efter en körning med
// admin/qa-snilleblixt-slut-kontroll.mjs (elever …) och lärarens avslut.
// Räknar OBEROENDE av appens kod (egen formel ur spec §5.5 och §7.2) och
// jämför med det appen sparat: sbScores, result.rewards, kvitton och saldon.
// BARA emulatorn (admin-läsning).
//
//   <emulator-env> node admin/qa-snilleblixt-slut-verifiera.mjs <sid> <A|B|C>
//
//   alla   frågorna i följd utan hopp (test 10), poängen ur serverstämplarna
//          (test 5), placering/pris/trappa per elev (20b–20e, 20h), ett kvitto
//          per belönad elev och saldo = före + total (20g; kräver `saldo` före)
//   A      delad 2:a (12/20d), N utan svar (20h), dubbelsvar (7), spion (8, 3d),
//          svar efter stängning, sen anslutning (§5.7), 900 poäng (5)
//   B      vanligaste felsvar "54 (5), 64 (3)" (7b)
// ============================================================================
import admin from "firebase-admin";
import { readFileSync, existsSync } from "node:fs";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const adb = admin.firestore(admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" }));
const ms = (t) => (t?.toMillis ? t.toMillis() : t?.seconds != null ? t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6) : null);
const [sid, scen] = process.argv.slice(2);
const sess = adb.doc(`liveSessions/${sid}`);
const LOG = `/tmp/sb561-${sid}-elever.jsonl`;
let fel = 0;
const ok = (cond, text) => { console.log(`${cond ? "  ✓" : "  ✗"} ${text}`); if (!cond) fel++; };

const s = (await sess.get()).data();
const roller = existsSync(`/tmp/sb561-${sid}-roller.json`) ? JSON.parse(readFileSync(`/tmp/sb561-${sid}-roller.json`, "utf8")) : {};
const logs = existsSync(LOG) ? readFileSync(LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
const scoresDocs = (await adb.collection(`liveSessions/${sid}/sbScores`).get()).docs.map((d) => d.data()).sort((a, b) => a.index - b.index);
const answers = (await adb.collection(`liveSessions/${sid}/sbAnswers`).get()).docs.map((d) => d.data());
const players = (await adb.collection(`liveSessions/${sid}/players`).get()).docs.map((d) => d.data());
const receipts = (await adb.collection(`liveSessions/${sid}/coinReceipts`).get()).docs.map((d) => d.data());
const snap = (await adb.doc(`liveSessions/${sid}/sbPrivate/snapshot`).get()).data();
console.log(`session ${sid}: status ${s.status}, ${s.questionCount} frågor, ${players.length} spelare, ${answers.length} svar, ${scoresDocs.length} sbScores, ${receipts.length} kvitton`);

// Frågorna: varje index exakt en gång, ingen överhoppad (test 10: inget dubbelsteg).
ok(scoresDocs.map((d) => d.index).join() === [...Array(s.questionCount).keys()].join(), `sbScores 0..${s.questionCount - 1} i följd, inga hopp (test 10)`);
ok(scoresDocs.every((d) => !d.skipped), "ingen fråga överhoppad");

// Poängen räknas om OBEROENDE ur serverstämplarna (spec §5.5 – egen formel här).
const opened = {};
const closed = {};
for (const l of logs) if (l.oppnad != null) opened[l.q] = l.oppnad;
let poangFel = 0;
const tot = {};
const rattAntal = {};
for (const d of scoresDocs) {
  const f = snap.facit[d.index];
  for (const a of answers.filter((x) => x.q === d.index)) {
    const at = ms(a.at);
    const o = opened[d.index];
    const right = a.answerKind === "choice" ? a.choiceIndex === f.answerIndex
      : String(Number(String(a.answer).replace(/\s+/g, ""))) === String(Number(f.correctAnswer));
    const t = o == null ? null : (at - o) / 1000;
    const expect = !right || t == null || t >= s.questionSeconds ? 0 : Math.round(1000 - 500 * Math.max(0, t) / s.questionSeconds);
    const got = d.points?.[a.uid] || 0;
    if (o != null && Math.abs(got - expect) > 1) { poangFel++; if (poangFel < 4) console.log(`    poäng ${a.uid} q${d.index}: fick ${got}, väntat ${expect} (t=${t}s)`); }
  }
  for (const [u, p] of Object.entries(d.points || {})) tot[u] = (tot[u] || 0) + p;
  for (const [u, c] of Object.entries(d.correct || {})) if (c) rattAntal[u] = (rattAntal[u] || 0) + 1;
}
ok(poangFel === 0, `alla poäng = round(1000 − 500 × t/${s.questionSeconds}) ur serverstämplarna (±1 för ms-avrundning av openedAt)`);

// Placering (delad), pris och trappa – EGEN beräkning enligt spec §7.2.
const deltog = new Set(answers.map((a) => a.uid));
const lista = players.map((p) => ({ uid: p.uid, poang: tot[p.uid] || 0, ratt: rattAntal[p.uid] || 0 }))
  .sort((a, b) => b.poang - a.poang);
let plats = 0;
lista.forEach((p, i) => { if (i === 0 || p.poang !== lista[i - 1].poang) plats = i + 1; p.plats = plats; });
const rw = s.rewards || {};
const forsta = Number(rw.firstPrize) || 0;
const perRatt = Number(rw.perCorrect ?? rw.coinsPerCorrect) || 0;
const tak = Number(rw.cap ?? rw.maxPerStudent) || 300;
const trappa = (n) => {
  let sum = 0;
  for (let k = 0; k < n; k++) sum += perRatt * [1, 0.8, 0.6, 0.4, 0.2][Math.min(4, Math.floor(k / 20))];
  return Math.min(tak, Math.ceil(sum - 1e-9));
};
const pris = (pl) => Math.max(1, Math.round(forsta * 0.85 ** (pl - 1)));
console.log(`  rewards-inställning: ${JSON.stringify(rw)}`);
const res = s.result?.rewards || {};
const resRad = (u) => res[u] || res.byUid?.[u] || (Array.isArray(res) ? res.find((r) => r.uid === u) : null) || null;
let prisFel = 0;
for (const p of lista) {
  const r = resRad(p.uid);
  const deltagit = deltog.has(p.uid);
  const vPris = deltagit && forsta > 0 ? pris(p.plats) : 0;
  const vRatt = deltagit ? trappa(p.ratt) : 0;
  const g = { prize: r?.prize || 0, correctCoins: r?.correctCoins || 0, total: r?.total || 0 };
  if (g.prize !== vPris || g.correctCoins !== vRatt || g.total !== vPris + vRatt) {
    prisFel++;
    console.log(`    ${p.uid} plats ${p.plats} (${p.poang} p, ${p.ratt} rätt, deltog ${deltagit}): fick ${JSON.stringify(g)}, väntat ${vPris}+${vRatt}`);
  }
}
ok(prisFel === 0, `result.rewards = pris(plats) + trappa(rätt) för alla ${lista.length} (egen beräkning, delad placering)`);
console.log("  topp:", lista.slice(0, 5).map((p) => `${p.plats}. ${p.uid} ${p.poang}p ${p.ratt}r → ${resRad(p.uid)?.total ?? 0}`).join(" | "));

// Kvitton + saldo: exakt en gång.
const kvittoPer = {};
for (const r of receipts) kvittoPer[r.uid] = (kvittoPer[r.uid] || 0) + 1;
const skaFa = lista.filter((p) => (resRad(p.uid)?.total || 0) > 0);
ok(skaFa.every((p) => kvittoPer[p.uid] === 1) && receipts.length === skaFa.length, `ett kvitto per belönad elev (${receipts.length}/${skaFa.length})`);
ok(receipts.every((r) => r.total === resRad(r.uid)?.total), "kvittots total = result.rewards");
const saldoFil = `/tmp/sb561-${sid}-saldo.json`;
if (existsSync(saldoFil)) {
  const fore = JSON.parse(readFileSync(saldoFil, "utf8"));
  let saldoFel = 0;
  for (const [u, f] of Object.entries(fore)) {
    const nu = Number((await adb.doc(`studentData/${u}`).get()).data()?.coins) || 0;
    const vantat = f + (resRad(u)?.total || 0);
    if (nu !== vantat) { saldoFel++; console.log(`    saldo ${u}: före ${f}, nu ${nu}, väntat ${vantat}`); }
  }
  ok(saldoFel === 0, `saldo efter = före + total för alla ${Object.keys(fore).length} (exakt en gång, 20g)`);
}

if (scen === "A") {
  const R = roller;
  const p1 = lista.find((p) => p.uid === R.P1);
  const p2 = lista.find((p) => p.uid === R.P2);
  console.log(`  P1 ${R.P1} ${p1?.poang}p plats ${p1?.plats} · P2 ${R.P2} ${p2?.poang}p plats ${p2?.plats}`);
  ok(p1 && p2 && p1.poang === p2.poang && p1.plats === 2 && p2.plats === 2, "delad 2:a plats (test 12/20d)");
  if (p1?.plats === 2 && p1.poang === p2?.poang) {
    ok(resRad(R.P1)?.prize === 255 && resRad(R.P2)?.prize === 255, "båda delade 2:or får 255");
    const fjarde = lista.find((p) => p.plats === 4);
    ok(fjarde && resRad(fjarde.uid)?.prize === 184, `nästa elev räknas som 4:a och får 184 (${fjarde?.uid})`);
  }
  ok(!resRad(R.N)?.total && !kvittoPer[R.N], `${R.N} anslöt men svarade aldrig → inget pris, inga mynt, inget kvitto (20h)`);
  const d = logs.find((l) => l.dubbel);
  const dSvar = answers.filter((a) => a.uid === R.D && a.q === 2);
  ok(d && d.dubbel.filter((x) => x === "ok").length === 1 && dSvar.length === 1, `dubbelsvar: ${JSON.stringify(d?.dubbel)} → exakt ett svarsdokument (test 7)`);
  const spioner = logs.filter((l) => l.spion);
  const lackor = spioner.filter((l) => Object.entries(l.spion).some(([k, v]) => v === "LÄSTE" || v === "SKREV" || (k === "facitISession" && v) || (k === "frågorISession" && v)));
  ok(spioner.length > 0 && lackor.length === 0, `spion: ${spioner.length} försök (facit, alla svar, annans svar, skriva poäng/fas, fel svarsform) – alla nekade, inget facit i sessionen före avslöjandet (test 8, 3d)`);
  if (spioner[0]) console.log(`    ${JSON.stringify(spioner[0].spion)}`);
  const efterSt = logs.find((l) => l.efterStangning);
  ok(efterSt && efterSt.efterStangning !== "ok", `svar efter stängning nekas (${efterSt?.efterStangning})`);
  const senS = logs.find((l) => l.senAnslutningSvar);
  ok(senS && senS.senAnslutningSvar !== "ok", `sen anslutning: svar på pågående fråga nekas (${senS?.senAnslutningSvar}), från nästa fråga (§5.7)`);
  const v = answers.find((a) => a.uid === R.V && a.q === 5);
  const vp = scoresDocs[5]?.points?.[R.V];
  console.log(`    test 5: ${R.V} svarade ${((ms(v?.at) - opened[5]) / 1000).toFixed(3)} s efter öppning → ${vp} poäng`);
  ok(vp >= 899 && vp <= 901, "test 5: rätt efter ≈4 s av 20 s ≈ 900 poäng");
}
if (scen === "B") {
  const d0 = scoresDocs[0];
  console.log(`  fråga 1: ${JSON.stringify({ answered: d0.answered, correctCount: d0.correctCount, topWrong: d0.topWrong })}`);
  const tw = (d0.topWrong || []).map((x) => `${x.answer} (${x.n})`).join(", ");
  ok(/54 \(5\)/.test(tw) && /64 \(3\)/.test(tw), `vanligaste felsvar: ${tw} (test 7b)`);
}
// Prestanda: skurar.
const perQ = {};
for (const l of logs.filter((x) => x.status === "ok" && x.klar)) (perQ[l.q] ||= []).push(l);
const lat = logs.filter((x) => x.status === "ok" && x.klar).map((x) => x.klar - x.skickat).sort((a, b) => a - b);
if (lat.length) console.log(`  svarsskrivning: median ${lat[lat.length >> 1]} ms, p95 ${lat[Math.floor(lat.length * 0.95)]} ms, max ${lat[lat.length - 1]} ms (${lat.length} svar)`);
console.log(fel ? `✗ ${fel} fel` : "✓ allt grönt");
process.exit(fel ? 1 : 0);
