// Schack slut-QA Etapp 2 (#782), steget "latens" – se qa.mjs. Hur lång tid ett drag tar mot
// emulatorn: tryck → servern har draget (callable) → motståndarens bräde visar det (lyssnaren),
// och hur länge "Skickar…" syns. Bara mätning (emulatorn ≠ produktion), inga krav.
import { vila, parti, anvandare, loggaInElev, bradeHar } from "./lib.mjs";
import { farger, vantaMed, spelaMot, callFran, nollaKlass } from "./spel.mjs";

const DRAG = [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"], ["d2", "d3"], ["f8", "c5"], ["c2", "c3"], ["d7", "d6"]];

export default async function latens({ br, PORTAR, ok }) {
  const [PA, PB] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await nollaKlass();
  await vantaMed(A, "10");
  const id = await spelaMot(B, A);
  const { vit, svart } = await farger(id, A, B);
  await vila(2500);
  const rader = [];
  for (const [i, [f, t]] of DRAG.entries()) {
    const u = i % 2 ? svart : vit, m = i % 2 ? vit : svart;
    await bradeHar(u, i);
    await vila(300);
    const t0 = Date.now();
    await u.e.tryck(f);
    await u.e.tryck(t);
    const t1 = Date.now();
    let server = null;
    while (Date.now() - t0 < 20000) {
      if ((await parti(id)).drag.length > i) { server = Date.now() - t1; break; }
      await vila(20);
    }
    await bradeHar(m, i + 1, ".schack-kompis", 20000);
    rader.push({ drag: `${f}-${t}`, klick: t1 - t0, server, motstandare: Date.now() - t1 });
  }
  const med = (k) => rader.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(rader.length / 2)];
  ok(`10 drag i UI:t: median tryck–tryck ${med("klick")} ms, servern har draget efter ${med("server")} ms, motståndarens bräde efter ${med("motstandare")} ms`,
    rader.every((r) => r.server != null), JSON.stringify(rader));
  const t0 = Date.now();
  const r = await callFran(vit, "schackDrag", { partiId: id, from: "a2", to: "a5" });
  ok(`ett nekat anrop (olagligt drag) tar ${Date.now() - t0} ms`, !r.ok);
  await callFran(vit, "schackGeUpp", { partiId: id });
}
