// 04. Bråk med ord – egna kontroller · #710
// Målkorten är symbol + text + bild med samma a/n; distraktorerna har tre
// andra, olika värden; bara den rätta trippeln av 20 godtas; orden kommer ur words.js.
import { q, eq, valueKey, fractionWords } from "../../src/brakresan/math/index.js";

export const tripplar = function* (ids) {
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++) yield [ids[i], ids[j], ids[k]];
};

/** Värdet ett kort VISAR (läst ur kortets framsida, inte ur params). */
export function kortVarde(face) {
  if (face.kind === "fraction") return q(face.n, face.d);
  if (face.component) {
    const d = face.component === "rutnat" ? face.rows * face.cols : face.component === "mangd" ? face.count : face.parts * (face.wholes || 1);
    const m = Array.isArray(face.marked) ? face.marked.length : face.marked;
    return q(m, d);
  }
  return null;
}

export function audit(task, { grade }) {
  const p = [];
  const { a, n, kort } = task.params;
  if (![2, 3, 4, 5, 6, 8, 10].includes(n) || a < 1 || a >= n) p.push(`${a}/${n} utanför ramen`);
  const cards = task.view.cards;
  if (cards.length !== 6) p.push("ska vara sex kort");
  const ratt = kort.filter((c) => c.ratt);
  if (ratt.map((c) => c.sort).sort().join() !== "bild,symbol,text") p.push("målkorten är inte symbol + text + bild");
  cards.forEach((c, i) => {
    const k = kort[i];
    if (k.sort === "text" && c.face.text !== fractionWords(k.n, k.d)) p.push(`texten "${c.face.text}" ≠ ${k.n}/${k.d}`);
    if (k.sort !== "text" && !eq(kortVarde(c.face), q(k.n, k.d))) p.push(`kort ${c.id} visar inte ${k.n}/${k.d}`);
    if (k.sort === "bild" && c.face.component === "cirkel" && c.face.parts > 12) p.push("cirkel med fler än 12 delar");
  });
  const varden = kort.map((c) => valueKey(q(c.n, c.d)));
  if (varden.filter((v) => v === valueKey(q(a, n))).length !== 3) p.push("inte exakt tre kort med målvärdet");
  const andra = varden.filter((v) => v !== valueKey(q(a, n)));
  if (new Set(andra).size !== 3) p.push("två distraktorer har samma värde");
  let godkanda = 0;
  for (const t of tripplar(cards.map((c) => c.id))) {
    const r = grade(task, { ids: t });
    if (r.status !== "graded") p.push(`trippel ${t} blev ${r.status}`);
    else if (r.correct) godkanda++;
  }
  if (godkanda !== 1) p.push(`${godkanda} tripplar godkändes`);
  if (grade(task, { ids: [cards[0].id] }).status !== "invalid") p.push("ett kort ska vara ofullständigt");
  return p;
}

export function plan(omgangar) {
  const lagen = new Set();
  for (const tasks of omgangar) for (const t of tasks) t.key.groups[0].ids.forEach((id) => lagen.add(id));
  return lagen.size === 6 ? [] : [`målkort bara på ${[...lagen]}`];
}
