// ============================================================================
// Guldrushen slut-QA (#567) – PRESTANDA och PLUGGMYNT, bara emulatorn.
//
//   svarm [sek] [sid] [alla]  28 elever (4B + 8 i 5E; "alla" = 42) svarar och
//                     öppnar kistor flera gånger/min i en PÅGÅENDE match (sid,
//                     annars skapas qa-gr-567-svarm); svarstider, fel,
//                     pluggmynt orörda (20f). Logg /tmp/gr567/svarm.jsonl
//   pris              20b/20e/20h/20i (+ 20c/20d): två matcher med känt guld och
//                     antal rätt, klockan flyttas till 2 s före slut → lärarnas
//                     projektorer (qa-guldrush-larare.mjs / webbläsaren) skriver
//                     result och betalar ut
//   prisKolla         result.rewards, kvitton och saldon mot specen (20g)
//
//   <emulator-env som qa-guldrush-slut-kontroll.mjs> node admin/qa-guldrush-slut-pris.mjs pris
// ============================================================================
import { appendFileSync, writeFileSync, readFileSync } from "node:fs";
import { placementPrize, perCorrectCoins } from "../src/live/live-rewards.js";
import {
  adb, Timestamp, sleep, client, code, fel, check, spara, klassElever, nySession, gaMed, svara, setGp, saldon,
} from "./qa-guldrush-slut-rigg.mjs";

// ============================================================================
// SVÄRM – prestanda + 20f
// ============================================================================
async function svarm(sek = 120, sidArg = null, alla = false) {
  const SID = sidArg || "qa-gr-567-svarm";
  if (!sidArg) await nySession(SID, { classIds: ["4b", "5e"], sek: 600, rewards: { firstPrize: 300, perCorrect: 5, cap: 300 } });
  const elever = [...(await klassElever("4b")), ...(await klassElever("5e")).slice(0, alla ? 99 : 8)];
  const fore = await saldon(elever.map((e) => e.uid));
  const cs = [];
  for (const e of elever) {
    const have = (await adb.doc(`liveSessions/${SID}/players/${e.uid}`).get()).exists;
    cs.push(have ? await client(e.uid) : await gaMed(SID, e.uid, e.classId));
  }
  const LOG = "/tmp/gr567/svarm.jsonl";
  writeFileSync(LOG, "");
  const lat = { answer: [], openChest: [], chooseVictim: [] };
  const fel_ = {};
  let chests = 0, svar = 0;
  const slut = Date.now() + sek * 1000;
  const tid = async (namn, p) => {
    const t0 = Date.now();
    try {
      const v = await p;
      lat[namn].push(Date.now() - t0);
      return v;
    } catch (err) {
      fel_[`${namn}:${code(err)}`] = (fel_[`${namn}:${code(err)}`] || 0) + 1;
      return null;
    }
  };
  await Promise.all(cs.map(async (c, i) => {
    await sleep(i * 120);
    while (Date.now() < slut) {
      const ratt = Math.random() < 0.8;
      const r = await tid("answer", svara(c, SID, ratt).catch((e) => { throw e; }));
      svar++;
      if (r?.correct) {
        await sleep(400 + Math.random() * 600); // väljer kista
        const k = await tid("openChest", c.openChest({ sid: SID, attemptId: r.attemptId, chestIndex: Math.floor(Math.random() * 3) }));
        if (k) {
          chests++;
          appendFileSync(LOG, JSON.stringify({ t: Date.now(), uid: c.uid, gold: k.gold, chest: k.chest }) + "\n");
          if (k.pending) {
            await sleep(1000 + Math.random() * 3000);
            const v = await tid("chooseVictim", c.chooseVictim({ sid: SID, victimUid: null }));
            if (v) appendFileSync(LOG, JSON.stringify({ t: Date.now(), uid: c.uid, gold: v.gold, victimUid: v.victimUid, victimGold: v.victimGold, result: v.result }) + "\n");
          }
        }
      }
      await sleep(2500 + Math.random() * 4000); // tänker/räknar
    }
  }));
  const pct = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : null);
  const per = Object.fromEntries(Object.entries(lat).map(([k, a]) => [k, { n: a.length, p50: pct(a, 0.5), p95: pct(a, 0.95), max: pct(a, 1) }]));
  console.log(JSON.stringify({ elever: cs.length, sek, svar, chests, kistorPerElevOchMin: +(chests / cs.length / (sek / 60)).toFixed(1), per, fel: fel_ }, null, 1));
  const efter = await saldon(elever.map((e) => e.uid));
  const andrade = Object.keys(fore).filter((u) => fore[u] !== efter[u]);
  check("20f", `pluggmynt orörda under matchen trots ${chests} kistor/stölder (${cs.length} elever)`, andrade.length === 0, andrade.join(","));
  check("P1", `${cs.length} elever × ${(chests / cs.length / (sek / 60)).toFixed(1)} kistor/min – inga serverfel`, !Object.keys(fel_).some((k) => /internal|deadline|unavailable/.test(k)), JSON.stringify(fel_));
  check("P2", "kistanropet p95 < 1,5 s (emulatorn)", per.openChest.p95 != null && per.openChest.p95 < 1500, `p50 ${per.openChest.p50} ms, p95 ${per.openChest.p95} ms`);
  const gps = (await adb.collection(`liveSessions/${SID}/grPlayers`).get()).docs.map((d) => d.data());
  check("P3", "ingen elev har negativt guld / över taket", gps.every((g) => g.gold >= 0 && g.gold <= 1_000_000));
  spara(`svarm-${sek}`);
}

// ============================================================================
// PRIS – 20b–20e, 20h, 20i (utbetalningen görs av lärarklienterna)
// ============================================================================
async function pris() {
  const elever4b = await klassElever("4b");
  const elever5e = await klassElever("5e");
  // Match 1: förstapris 300, 5/rätt, tak 300. 25 svarat med olika guld + 1 bara ansluten.
  const S1 = "qa-gr-567-pris300";
  const r1 = await nySession(S1, { classIds: ["4b", "5e"], rewards: { firstPrize: 300, perCorrect: 5, cap: 300 } });
  const alla = [...elever4b, ...elever5e];
  const deltagare = alla.slice(0, 25);
  const tyst = alla[25]; // ansluten, svarar aldrig (20h)
  const RATT = { 1: 42, 4: 15, 5: 50, 6: 100, 7: 400 }; // index i deltagare (0 = etta)
  for (const [i, e] of deltagare.entries()) {
    await gaMed(S1, e.uid, e.classId);
    const c = await client(e.uid);
    await svara(c, S1, true); // ett riktigt svar via servern (deltagit)
    const correct = RATT[i] ?? 10;
    await setGp(S1, e.uid, { gold: 1000 - i * 10, correct, incorrect: 1 });
  }
  await gaMed(S1, tyst.uid, tyst.classId);
  // Match 2: förstapris 100 och delad 2:a plats.
  const S2 = "qa-gr-567-pris100";
  const r2 = await nySession(S2, { classIds: ["4b"], rewards: { firstPrize: 100, perCorrect: 0, cap: 300 } });
  const guld2 = [500, 400, 400, 300, 200, 100];
  for (const [i, e] of elever4b.slice(0, 6).entries()) {
    await gaMed(S2, e.uid, "4b");
    await svara(await client(e.uid), S2, true);
    await setGp(S2, e.uid, { gold: guld2[i], correct: 1, incorrect: 0 });
  }
  const forvantat = {
    [S1]: Object.fromEntries([...deltagare.map((e, i) => [e.uid, placementPrize(300, i + 1) + perCorrectCoins(RATT[i] ?? 10, 5, 300)]), [tyst.uid, 0]]),
    [S2]: Object.fromEntries(elever4b.slice(0, 6).map((e, i) => [e.uid, placementPrize(100, [1, 2, 2, 4, 5, 6][i])])),
  };
  const saldo = await saldon([...alla.slice(0, 26).map((e) => e.uid)]);
  writeFileSync("/tmp/gr567/pris-fore.json", JSON.stringify({ saldo, forvantat, tyst: tyst.uid, tvaa: deltagare[1].uid }, null, 1));
  // Klockan till 2 s före slut → lärarnas projektorer avslutar själva.
  for (const ref of [r1, r2]) {
    const t = Date.now();
    await ref.update({ startedAt: Timestamp.fromMillis(t - 604_000 + 2000), endsAt: Timestamp.fromMillis(t + 2000) });
  }
  console.log(`Matcherna ${S1} och ${S2} tar slut om 2 s. 2:an (20i) = ${deltagare[1].uid} ${deltagare[1].name}; tyst (20h) = ${tyst.uid}`);
}

async function prisKolla() {
  const { saldo, forvantat, tyst, tvaa } = JSON.parse(readFileSync("/tmp/gr567/pris-fore.json", "utf8"));
  const nu = await saldon(Object.keys(saldo));
  for (const sid of Object.keys(forvantat)) {
    const s = (await adb.doc(`liveSessions/${sid}`).get()).data();
    const rw = s.result?.rewards || {};
    const kv = (await adb.collection(`liveSessions/${sid}/coinReceipts`).get()).docs.map((d) => d.data());
    check(`${sid}:res`, "result sparat (status finished, totalGold, ranking)", s.status === "finished" && s.result?.totalGold > 0 && s.result?.ranking?.length > 0, `totalGold ${s.result?.totalGold}`);
    const fel_ = Object.entries(forvantat[sid]).filter(([u, v]) => (rw[u]?.total || 0) !== v);
    check(`${sid}:belopp`, "result.rewards = specens belopp för varje elev", fel_.length === 0, fel_.map(([u, v]) => `${u}: ${rw[u]?.total} ≠ ${v}`).join(", "));
    const dubbel = kv.length !== Object.values(forvantat[sid]).filter((v) => v > 0).length;
    check(`${sid}:kvitto`, "exakt ett kvitto per elev som ska ha mynt", !dubbel, `${kv.length} kvitton`);
    const by = new Set(kv.map((k) => k.by));
    check(`${sid}:by`, "vilka lärarklienter som betalade", true, [...by].join(", "));
  }
  // Saldot: summan av båda matcherna, exakt en gång.
  const fel_ = Object.keys(saldo).filter((u) => nu[u] - saldo[u] !== (forvantat["qa-gr-567-pris300"][u] || 0) + (forvantat["qa-gr-567-pris100"][u] || 0));
  check("20g", "varje elevs saldo ökade EXAKT en gång med rätt belopp (två lärare + omladdning)", fel_.length === 0,
    fel_.map((u) => `${u}: +${nu[u] - saldo[u]}`).join(", "));
  const r300 = (await adb.doc("liveSessions/qa-gr-567-pris300").get()).data().result.rewards;
  const prizes = Object.values(r300).filter((e) => e.prize).map((e) => e.prize).sort((a, b) => b - a);
  check("20b", "placeringspris 300, 255, 217, 184, 157 … 6 (plats 25), alla ≥ 1", prizes.slice(0, 5).join(",") === "300,255,217,184,157" && prizes[24] === 6 && prizes.every((p) => p >= 1), prizes.join(","));
  const r100 = (await adb.doc("liveSessions/qa-gr-567-pris100").get()).data().result.rewards;
  const p100 = Object.values(r100).map((e) => e.prize).sort((a, b) => b - a);
  check("20c/20d", "förstapris 100 + delad 2:a: 100, 85, 85, 61, 52, 44", p100.join(",") === "100,85,85,61,52,44", p100.join(","));
  const cc = Object.values(r300).map((e) => e.correctCoins);
  check("20e", "5/rätt, tak 300: 15 → 75, 50 → 210, 100 → 300, 400 → 300", [75, 210, 300].every((v) => cc.includes(v)) && cc.filter((v) => v === 300).length >= 2, cc.join(","));
  check("20h", "ansluten men aldrig svarat → inget pris, inga mynt", !r300[tyst] && nu[tyst] === saldo[tyst], JSON.stringify(r300[tyst] || null));
  check("20i", "2:an med 42 rätt → 255 + 186 = 441, saldot +441", r300[tvaa]?.prize === 255 && r300[tvaa]?.correctCoins === 186 && r300[tvaa]?.total === 441 && nu[tvaa] - saldo[tvaa] === 441 + (forvantat["qa-gr-567-pris100"][tvaa] || 0),
    `${JSON.stringify(r300[tvaa])}, saldo +${nu[tvaa] - saldo[tvaa]}`);
  spara("pris");
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
if (cmd === "svarm") await svarm(Number(a1) || 120, a2 && a2 !== "-" ? a2 : null, a3 === "alla");
else if (cmd === "pris") await pris();
else if (cmd === "prisKolla") await prisKolla();
else console.log("svarm [sek] [sid|-] [alla] | pris | prisKolla");
process.exit(0);
