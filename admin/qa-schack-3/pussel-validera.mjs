// Slut-QA Etapp 3 (#792): OBEROENDE validering av alla pussel i src/schack/pussel/*.json med
// chess.js (skriver inte om #791:s kontroll – egen implementation, strängare).
//   node admin/qa-schack-3/pussel-validera.mjs
import { readFileSync } from "node:fs";
import { Chess } from "../../src/schack/vendor/chess.js";
const dir = new URL("../../src/schack/pussel/", import.meta.url);
const las = (f) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
const dr = (s) => ({ from: s.slice(0, 2), to: s.slice(2, 4), promotion: s[4] });
const fel = []; const ok = { ett: 0, tva: 0 };
const F = (id, t) => fel.push(`${id}: ${t}`);
const ids = new Set(); const fens = new Set();
for (const [fil, sort, antalDrag] of [["matt-i-ett.json", "ett", 1], ["matt-i-tva.json", "tva", 3]]) {
  const d = las(fil);
  if (d.sort !== sort) F(fil, "fel sort-fält " + d.sort);
  if (d.licens !== "CC0-1.0") F(fil, "licens " + d.licens);
  if (d.antal !== d.pussel.length) F(fil, `antal ${d.antal} != ${d.pussel.length}`);
  if (d.pussel.length < 200) F(fil, "färre än 200: " + d.pussel.length);
  let prev = -1;
  for (const p of d.pussel) {
    const id = p.id;
    if (ids.has(id)) F(id, "dubblett-id");
    ids.add(id);
    const nyckel = p.fen.split(" ").slice(0, 4).join(" ");
    if (fens.has(nyckel)) F(id, "dubblett-ställning");
    fens.add(nyckel);
    if (p.rating < prev) F(id, `ej sorterad lätt→svårt (${p.rating} < ${prev})`);
    prev = p.rating;
    if (p.losning.length !== antalDrag) { F(id, `${p.losning.length} lösningsdrag, väntade ${antalDrag}`); continue; }
    let c;
    try { c = new Chess(p.fen); } catch (e) { F(id, "ogiltig FEN " + e.message); continue; }
    if (c.turn() !== "w") F(id, "inte vit vid draget");
    if (c.isGameOver()) F(id, "ställningen är redan slut");
    if (c.inCheck()) F(id, "vit står i schack i utgångsläget");
    // senast: måste vara ett draget som slutar på en ruta med en svart pjäs
    const s = dr(p.senast);
    const pj = c.get(s.to);
    if (!pj || pj.color !== "b") F(id, `senast ${p.senast} slutar inte på svart pjäs`);
    // matt i ett: lösningen ska vara laglig och ge matt. Alla vita drag som ger matt räknas.
    const matter = c.moves({ verbose: true }).filter((m) => { const t = new Chess(p.fen); t.move(m); return t.isCheckmate(); });
    if (antalDrag === 1) {
      const t = new Chess(p.fen);
      try { t.move(dr(p.losning[0])); } catch { F(id, "olagligt lösningsdrag " + p.losning[0]); continue; }
      if (!t.isCheckmate()) { F(id, "lösningsdraget ger inte matt"); continue; }
      if (t.isStalemate()) F(id, "patt?");
      ok.ett++;
    } else {
      if (matter.length) F(id, "matt i ETT finns i matt-i-två-pusslet: " + matter.map((m) => m.lan).join(","));
      const t = new Chess(p.fen);
      try {
        t.move(dr(p.losning[0])); if (t.isGameOver()) { F(id, "första draget avslutar partiet"); continue; }
        t.move(dr(p.losning[1])); t.move(dr(p.losning[2]));
      } catch (e) { F(id, "olagligt drag i lösningen: " + e.message); continue; }
      if (!t.isCheckmate()) { F(id, "tredje draget ger inte matt"); continue; }
      // forcerad: varje svart svar efter första draget ger ett mattdrag
      const forcerat = (fen0, drag) => {
        const a = new Chess(fen0); a.move(dr(drag));
        const svar = a.moves({ verbose: true });
        return svar.length > 0 && svar.every((sv) => {
          const b = new Chess(fen0); b.move(dr(drag)); b.move(sv);
          return b.moves({ verbose: true }).some((m) => { const e = new Chess(b.fen()); e.move(m); return e.isCheckmate(); });
        });
      };
      if (!forcerat(p.fen, p.losning[0])) { F(id, "första draget tvingar INTE fram matt i två"); continue; }
      // entydighet: räkna alla vita första drag som tvingar matt i två
      const alla = c.moves({ verbose: true }).filter((m) => forcerat(p.fen, m.lan)).map((m) => m.lan);
      if (alla.length !== 1) F(id, `${alla.length} första drag tvingar matt i två: ${alla.join(",")}`);
      ok.tva++;
    }
  }
  console.log(fil, "antal", d.pussel.length, "rating", d.pussel[0].rating, "→", d.pussel.at(-1).rating);
}
console.log("OK:", ok, "FEL:", fel.length);
for (const f of fel) console.log(" -", f);
process.exit(fel.length ? 1 : 0);
