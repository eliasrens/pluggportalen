#!/usr/bin/env node
// ============================================================================
// Schack slut-QA (#777): motorns tid per drag i headless Chromium med CPU-strypning
// (CDP Emulation.setCPUThrottlingRate) som Chromebook-uppskattning, spec §3.1 (≤ 1 s).
//
//   node admin/qa-schack-strypt.mjs <origin>          (origin = en statisk server för repot,
//                                                      t.ex. node server.mjs eller qa-emulator-proxy)
// 1. Kalibrering: samma räkneloop i huvudtråden och i en Web Worker, ostrypt och strypt –
//    visar om strypningen biter och om den når workern.
// 2. Motorn (samma kod som workern kör) i huvudtråden, strypt 1×/4×/6×, alla fyra nivåer ×
//    preview/schack/matning.js:s sju ställningar + sju egna (öppning, mittspel, slutspel).
// 3. Motorn i den riktiga workern via schack-dator.js (det eleven får), strypt 6×.
// ============================================================================
import { startaChromium } from "./qa-schack/cdp.mjs";

const ORIGIN = process.argv[2];
if (!ORIGIN) { console.error("Användning: node admin/qa-schack-strypt.mjs <origin>"); process.exit(2); }

const EGNA = [
  { id: "italienskt7", typ: "mittspel", fen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7" },
  { id: "najdorf6", typ: "öppning", fen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6" },
  { id: "damgambit9", typ: "mittspel", fen: "r2qk2r/pp1n1ppp/2pbpn2/3p4/2PP4/2NBPN2/PP3PPP/R2QK2R w KQkq - 0 9" },
  { id: "scheveningen15", typ: "mittspel", fen: "r4rk1/1bq1bppp/p2ppn2/1p6/3BPP2/2NB1Q2/PPP3PP/R4R1K w - - 0 15" },
  { id: "bondeslut", typ: "slutspel", fen: "8/5k2/3p4/1p1Pp2p/pP2Pp1P/P4P1K/8/8 b - - 0 50" },
  { id: "tornslut", typ: "slutspel", fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 30" }, // Td8# finns
  { id: "dam-mot-kung", typ: "slutspel", fen: "8/8/4k3/8/2KQ4/8/8/8 w - - 0 60" },
];

// Matt i ett finns: motorn ser det på djup 1 och slutar söka (inte en tidsgräns).
const MATT_I_ETT = new Set(["taktik", "tornslut"]);

const br = await startaChromium();
const p = await br.nySida();
await p.gaTill(`${ORIGIN}/preview/preview-schack-matning.html`);
await p.vanta(`typeof window.korMatning === "function"`, 20000);

const KALIB = `(async () => {
  const loop = "let s = 0; for (let i = 0; i < 3e7; i++) s += i % 7;";
  const t = performance.now(); eval(loop); const huvud = performance.now() - t;
  const w = new Worker(URL.createObjectURL(new Blob(["onmessage = () => { const t = performance.now(); " + loop + " postMessage(performance.now() - t); };"])));
  const worker = await new Promise((r) => { w.onmessage = (e) => r(e.data); w.postMessage(0); });
  w.terminate();
  return { huvud: Math.round(huvud), worker: Math.round(worker) };
})()`;

const kor = (niva, rate) => p.ev(`(async () => {
  const [m, mat] = await Promise.all([import("../src/schack/schack-motor.js"), import("./schack/matning.js")]);
  const st = [...mat.STALLNINGAR.map((s) => ({ ...s, typ: s.id === "slutspel" ? "slutspel" : s.id === "start" || s.id === "oppning" ? "öppning" : "mittspel" })), ...${JSON.stringify(EGNA)}];
  return st.map((s) => { const r = m.valjDrag(s.fen, { niva: ${JSON.stringify(niva)}, seed: 1 }); return { id: s.id, typ: s.typ, ms: Math.round(r.ms), djup: r.djup }; });
})()`, { timeout: 140000 });

const rad = (namn, a) => {
  const ms = a.map((r) => r.ms);
  const djup = a.map((r) => r.djup);
  const perTyp = ["öppning", "mittspel", "slutspel"].map((t) => {
    const x = a.filter((r) => r.typ === t).map((r) => r.ms);
    return `${t} max ${Math.max(...x)}`;
  }).join(", ");
  return `${namn.padEnd(11)} medel ${String(Math.round(ms.reduce((s, v) => s + v, 0) / ms.length)).padStart(4)} ms  max ${String(Math.max(...ms)).padStart(4)} ms  djup ${Math.min(...djup)}–${Math.max(...djup)}  (${perTyp})`;
};

let fel = 0;
for (const rate of [1, 4, 6]) {
  await p.s("Emulation.setCPUThrottlingRate", { rate });
  const k = await p.ev(KALIB);
  console.log(`\n== Strypning ${rate}×  (kalibrering: huvudtråd ${k.huvud} ms, worker ${k.worker} ms)`);
  for (const niva of ["bonden", "springaren", "tornet", "damen"]) {
    const a = await kor(niva, rate);
    console.log(rad(niva, a));
    const nominellt = { bonden: 1, springaren: 2, tornet: 3, damen: 4 }[niva];
    const grunda = a.filter((r) => r.djup < nominellt && !MATT_I_ETT.has(r.id));
    if (grunda.length) console.log(`   grundare än djup ${nominellt} (tidsgränsen): ${grunda.map((r) => `${r.id} djup ${r.djup} (${r.ms} ms)`).join(", ")}`);
    if (Math.max(...a.map((r) => r.ms)) > 1000) { fel++; console.log("   ✗ över 1 s:", a.filter((r) => r.ms > 1000).map((r) => `${r.id} ${r.ms} ms`).join(", ")); }
  }
}

// Den riktiga workern (strypt 6×): tid inkl. meddelanden fram och tillbaka.
await p.s("Emulation.setCPUThrottlingRate", { rate: 6 });
const w = await p.ev(`(async () => {
  const [{ skapaDator }, mat] = await Promise.all([import("../src/schack/schack-dator.js"), import("./schack/matning.js")]);
  const d = skapaDator(); const ut = [];
  const st = [...mat.STALLNINGAR, ...${JSON.stringify(EGNA)}];
  for (const niva of ["bonden", "springaren", "tornet", "damen"]) for (const s of st) {
    const t = performance.now(); const r = await d.valjDrag(s.fen, { niva, seed: 1 }); ut.push({ niva, ms: Math.round(performance.now() - t), motor: Math.round(r.ms), djup: r.djup });
  }
  d.destroy(); return ut;
})()`, { timeout: 140000 });
console.log("\n== Workern (schack-dator.js), sidan strypt 6×, tid inkl. worker-meddelanden");
for (const niva of ["bonden", "springaren", "tornet", "damen"]) {
  const a = w.filter((r) => r.niva === niva);
  const max = Math.max(...a.map((r) => r.ms));
  console.log(`${niva.padEnd(11)} medel ${Math.round(a.reduce((s, r) => s + r.ms, 0) / a.length)} ms  max ${max} ms  djup ${Math.min(...a.map((r) => r.djup))}–${Math.max(...a.map((r) => r.djup))}`);
  if (max > 1000) fel++;
}
await p.s("Emulation.setCPUThrottlingRate", { rate: 1 });
console.log(fel ? `\n✗ ${fel} nivå(er) över 1 s` : "\n✓ alla drag under 1 s");
br.stang();
process.exit(fel ? 1 : 0);
