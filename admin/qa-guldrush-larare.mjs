// ============================================================================
// Guldrushen slut-QA (#567): EN lärarprojektor utan skärm – APPENS EGNA moduler
// (live-feed subscribeLiveSession som lärare: markera slut vid 00:00, skriv
// result en gång och betala Pluggmynten via live-rewards-data). Test 20g: kör
// två samtidigt (elias + rasmus) när matchen tar slut, och en tredje efteråt
// med --omladdning (= projektorn laddas om + historikvyns omförsök). BARA
// emulatorn; reglerna gäller (klient-SDK, inloggad som QA_UID).
//
//   QA_UID=elias QA_ROLL=larare <emulator-env> node --import ./admin/qa-node-app-loader.mjs \
//     admin/qa-guldrush-larare.mjs <sid> [<sid> …] [--omladdning]
// Skriver en JSON-rad per händelse (result sett, utbetalning, kvitton) och
// avslutas när varje session har result + kvitton (eller efter 90 s).
// ============================================================================
globalThis.document ??= { hidden: false, addEventListener() {}, removeEventListener() {} };
const args = process.argv.slice(2);
const omladdning = args.includes("--omladdning");
const sids = args.filter((a) => !a.startsWith("--"));
const VEM = process.env.QA_UID;
const logg = (o) => console.log(JSON.stringify({ t: Date.now(), vem: VEM, ...o }));

await import("../src/live/modes/index.js");
const { subscribeLiveSession } = await import("../src/live/live-feed.js");
const { settleLiveRewards } = await import("../src/live/live-rewards-data.js");
const { db } = await import("../src/firebase-config.js");
const { collection, getDocs } = await import("firebase/firestore");
const warn = console.warn;
console.warn = (...a) => { logg({ warn: a.map(String).join(" ") }); warn(...a); };

const klara = new Set();
for (const sid of sids) {
  let sett = false;
  const unsub = subscribeLiveSession(sid, async (st) => {
    if (!st.result || sett) return;
    sett = true;
    logg({ sid, action: "result", totalGold: st.result.totalGold, rewards: Object.keys(st.result.rewards || {}).length });
    if (omladdning) {
      // Historikvyns omförsök efter en omladdning: ska bli "redan" för alla.
      const ut = await settleLiveRewards(sid, st.session);
      const per = ut.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {});
      logg({ sid, action: "omforsok", per });
    }
    setTimeout(async () => {
      const kv = await getDocs(collection(db, "liveSessions", sid, "coinReceipts"));
      const by = {};
      kv.forEach((d) => { by[d.data().by] = (by[d.data().by] || 0) + 1; });
      logg({ sid, action: "kvitton", n: kv.size, by });
      unsub();
      klara.add(sid);
      if (klara.size === sids.length) process.exit(0);
    }, 8000);
  }, { teacher: true, onError: (e) => logg({ sid, fel: String(e?.message || e) }) });
}
setTimeout(() => { logg({ action: "timeout" }); process.exit(2); }, 90_000);
