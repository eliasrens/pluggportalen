// ============================================================================
// Snilleblixten slut-QA (#561): EN "lärarprojektor" utan skärm – APPENS EGNA
// moduler (live-feed subscribeLiveSession som lärare + sb-koppling, dvs. samma
// automatik som projektorn: stäng vid tid/alla svarat, avslöja efter
// trumvirveln, och live-feed:s result-skrivning + Pluggmynt). BARA emulatorn;
// reglerna gäller (klient-SDK, inloggad som QA_UID).
//
//   QA_UID=rasmus QA_ROLL=larare <emulator-env> node --import ./admin/qa-node-app-loader.mjs \
//     admin/qa-snilleblixt-larare.mjs <sid> [--start] [--nasta MS] [--pall] [--logg FIL]
//
//   --start     STARTA om sessionen är i lobbyn (startLiveSession)
//   --nasta MS  tryck NÄSTA FRÅGA MS ms efter varje avslöjande (som läraren)
//   --pall      efter sista avslöjandet: "Till pallen" (finishLiveSession)
//   --logg FIL  JSONL med varje steg { t, vem, action, index, done, reason }
// Avslutas när sessionen har result och Pluggmynten är utbetalda (eller 30 s efter).
// ============================================================================
import { appendFileSync } from "node:fs";

globalThis.document ??= { hidden: false, addEventListener() {}, removeEventListener() {} };
const [sid, ...flags] = process.argv.slice(2);
const flag = (n) => flags.includes(n);
const val = (n) => { const i = flags.indexOf(n); return i >= 0 ? flags[i + 1] : null; };
const VEM = process.env.QA_UID;
const LOGG = val("--logg");
const NASTA = val("--nasta") == null ? null : Number(val("--nasta"));

const data = await import("../src/live/formats/snilleblixt/snilleblixt-data.js");
const live = await import("../src/live/live-data.js");
const { subscribeLiveSession } = await import("../src/live/live-feed.js");
const { createSbKoppling } = await import("../src/live/formats/snilleblixt/sb-koppling.js");

const logg = (o) => {
  const rad = { t: Date.now(), vem: VEM, ...o };
  console.log(JSON.stringify(rad));
  if (LOGG) appendFileSync(LOGG, JSON.stringify(rad) + "\n");
};
// Samma modul som appen – bara inslagen så varje steg loggas.
const wrap = (name, action) => async (s, ix) => {
  const r = await data[name](s, ix);
  logg({ action, index: ix, done: r.done, reason: r.reason || null });
  return r;
};
const api = {
  ...data,
  openQuestion: wrap("openQuestion", "open"), closeQuestion: wrap("closeQuestion", "close"),
  revealQuestion: wrap("revealQuestion", "reveal"), skipQuestion: wrap("skipQuestion", "skip"),
};

if (flag("--start")) logg({ action: "start", done: await live.startLiveSession(sid) });

let koppling = null;
let nastaFor = null;
let pallTried = false;
let slut = null;
const unsub = subscribeLiveSession(sid, (st) => {
  if (!koppling) {
    koppling = createSbKoppling({
      sid, st, deps: { snilleblixt: api }, actions: { finish: () => live.finishLiveSession(sid) },
      say: (m) => logg({ say: m }),
    });
  }
  koppling.update(st);
  const s = st.session;
  const q = s?.q;
  if (NASTA != null && s?.status === "live" && q?.phase === "revealed" && nastaFor !== q.index && q.index + 1 < s.questionCount) {
    nastaFor = q.index;
    setTimeout(() => koppling.next(), NASTA);
  }
  if (flag("--pall") && !pallTried && s?.status === "live" && q?.phase === "revealed" && q.index + 1 >= s.questionCount) {
    pallTried = true;
    setTimeout(async () => { await live.finishLiveSession(sid); logg({ action: "pall" }); }, NASTA ?? 3000);
  }
  if (s?.result && !slut) {
    slut = setTimeout(() => { logg({ action: "klar", result: true }); unsub(); koppling.destroy(); process.exit(0); }, 8000);
  }
}, { teacher: true, onError: (e) => logg({ fel: String(e?.message || e) }) });

setTimeout(() => { logg({ action: "timeout" }); process.exit(2); }, Number(process.env.QA_MAX_MS || 30 * 60_000));
