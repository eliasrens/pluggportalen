// 15. Sortera bråkfamiljer – egna kontroller · #710
// Tre olika förkortade värden, två kort per familj med samma värde som ankaret,
// nämnare ≤ 24, sex olika kort; korrekt sortering i valfri ordning godtas, byten avvisas.
import { q, eq, valueKey } from "../../src/brakresan/math/index.js";
import { kortVarde } from "./u04.mjs";

export function audit(task, { grade }) {
  const p = [];
  const bins = task.view.bins;
  const cards = task.view.cards;
  if (bins.length !== 3 || cards.length !== 6) p.push("ska vara tre familjer och sex kort");
  const ankare = bins.map((b) => kortVarde(b.face));
  if (new Set(ankare.map(valueKey)).size !== 3) p.push("två familjer har samma värde");
  for (const a of ankare) if (q(a.n, a.d).d !== a.d && bins.some((b) => b.face.kind)) p.push("ankaret är inte förkortat");
  if (new Set(cards.map((c) => `${c.face.n}/${c.face.d}`)).size !== 6) p.push("två kort är identiska");
  for (const c of cards) {
    if (c.face.d > 24) p.push(`${c.face.n}/${c.face.d} över 24`);
    const hem = bins.filter((_, i) => eq(q(c.face.n, c.face.d), ankare[i]));
    if (hem.length !== 1) p.push(`kort ${c.id} passar i ${hem.length} familjer`);
    else if (task.key.bins[c.id] !== hem[0].id) p.push(`kort ${c.id} har fel facit`);
    if (bins.some((b, i) => b.face.kind && b.face.n === c.face.n && b.face.d === c.face.d)) p.push("ett kort är likadant som ankaret");
  }
  for (const b of bins) if (Object.values(task.key.bins).filter((x) => x === b.id).length !== 2) p.push("inte två kort per familj");
  if (/färg|color/i.test(JSON.stringify(bins))) p.push("facken värdekodas");
  // Alla 90 sätt att lägga sex kort två och två i tre fack: exakt ett (oavsett ordning) godtas.
  const ids = cards.map((c) => c.id);
  let ok = 0;
  const perm = (l) => (l.length <= 1 ? [l] : l.flatMap((x, i) => perm([...l.slice(0, i), ...l.slice(i + 1)]).map((r) => [x, ...r])));
  const sett = new Set();
  for (const pm of perm(ids)) {
    const fack = { f1: pm.slice(0, 2).sort(), f2: pm.slice(2, 4).sort(), f3: pm.slice(4, 6).sort() };
    const k = JSON.stringify(fack);
    if (sett.has(k)) continue;
    sett.add(k);
    if (grade(task, { bins: fack }).correct) ok++;
  }
  if (ok !== 1) p.push(`${ok} sorteringar godkändes`);
  if (grade(task, { bins: { f1: [ids[0]] } }).status !== "invalid") p.push("ofullständig sortering ska vara inmatningsfel");
  return p;
}
