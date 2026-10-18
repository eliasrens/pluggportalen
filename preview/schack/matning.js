// Mätning av motorns tid per drag och nivå (#776, §3.1 "mät och redovisa").
// Samma ställningar körs i node (admin/qa-schack-matning.mjs) och i webbläsaren
// (preview/preview-schack-matning.html, i workern, gärna med CPU-strypning 4–6×
// i DevTools eller via CDP Emulation.setCPUThrottlingRate som Chromebook-uppskattning).

export const STALLNINGAR = [
  { id: "start", namn: "Utgångsställningen", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
  { id: "oppning", namn: "Öppning (italienskt)", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" },
  { id: "mitt", namn: "Medelspel, många pjäser", fen: "r2q1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PPQ1BPPP/R4RK1 w - - 0 11" },
  { id: "komplex", namn: "Medelspel, spänt centrum", fen: "r1bq1rk1/pp2nppp/2n1p3/3pP3/2pP4/P1P1BN2/2P1QPPP/R3KB1R w KQ - 0 12" },
  { id: "taktik", namn: "Taktik (matt i ett finns)", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4" },
  { id: "damer", namn: "Öppet, damer och torn", fen: "3r2k1/1pq2ppp/p1p5/4P3/2P5/1P3Q2/P4PPP/3R2K1 b - - 0 24" },
  { id: "slutspel", namn: "Slutspel, få pjäser", fen: "8/5pk1/6p1/8/3K4/8/5PPP/8 w - - 0 40" },
];

/** Sammanställ en körning: per nivå max/medel-ms och lägsta/högsta djup. */
export function sammanstall(rader) {
  const per = {};
  for (const r of rader) {
    const p = (per[r.niva] ??= { niva: r.niva, n: 0, summaMs: 0, maxMs: 0, minDjup: 99, maxDjup: 0, noder: 0 });
    p.n++;
    p.summaMs += r.ms;
    p.maxMs = Math.max(p.maxMs, r.ms);
    p.minDjup = Math.min(p.minDjup, r.djup);
    p.maxDjup = Math.max(p.maxDjup, r.djup);
    p.noder += r.noder;
  }
  return Object.values(per).map((p) => ({ ...p, medelMs: p.summaMs / p.n, noderPerS: (p.noder / p.summaMs) * 1000 }));
}

export function tabell(rader) {
  const s = sammanstall(rader);
  const rad = (c) => `| ${c.join(" | ")} |`;
  return [
    rad(["Nivå", "ms/drag (medel)", "ms/drag (max)", "djup (min–max)", "k noder/s"]),
    rad(["---", "---", "---", "---", "---"]),
    ...s.map((p) => rad([p.niva, p.medelMs.toFixed(0), p.maxMs.toFixed(0), `${p.minDjup}–${p.maxDjup}`, (p.noderPerS / 1000).toFixed(0)])),
  ].join("\n");
}
