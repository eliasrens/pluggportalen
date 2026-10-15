// 06. Hitta tre som hör ihop – egna kontroller · #710
// Målkorten visar samma a/n med samma indelning; varje korttyp syns lika ofta
// bland mål och distraktorer; bara en trippel av 20 godtas.
import { q, eq, valueKey, fractionWords } from "../../src/brakresan/math/index.js";
import { tripplar, kortVarde } from "./u04.mjs";

export function audit(task, { grade }) {
  const p = [];
  const { a, n, kort, typer } = task.params;
  if (![2, 3, 4, 5, 6, 8].includes(n) || a < 1 || a >= n) p.push(`${a}/${n} utanför ramen`);
  const cards = task.view.cards;
  if (cards.length !== 6) p.push("ska vara sex kort");
  const typ = (c) => (c.face.kind ? "symbol" : c.face.text !== undefined ? "text" : c.face.component);
  const rattTyper = cards.filter((_, i) => kort[i].ratt).map(typ).sort();
  const felTyper = cards.filter((_, i) => !kort[i].ratt).map(typ).sort();
  if (rattTyper.join() !== felTyper.join()) p.push(`korttyperna avslöjar trippeln (${rattTyper} / ${felTyper})`);
  if (new Set(rattTyper).size !== 3) p.push("målkorten ska vara tre olika representationer");
  cards.forEach((c, i) => {
    const k = kort[i];
    if (typ(c) === "text" ? c.face.text !== fractionWords(k.n, k.d) : !eq(kortVarde(c.face), q(k.n, k.d))) p.push(`kort ${c.id} visar inte ${k.n}/${k.d}`);
    if (k.ratt && typ(c) !== "symbol" && typ(c) !== "text" && kortVarde(c.face) && (c.face.parts ?? c.face.rows * c.face.cols) !== n) p.push("målbilden har annan indelning än n");
  });
  const varden = kort.map((c) => valueKey(q(c.n, c.d)));
  if (varden.filter((v) => v === valueKey(q(a, n))).length !== 3) p.push("inte exakt tre med målvärdet");
  if (new Set(varden.filter((v) => v !== valueKey(q(a, n)))).size !== 3) p.push("två distraktorer har samma värde");
  let ok = 0;
  for (const t of tripplar(cards.map((c) => c.id))) {
    const r = grade(task, { ids: t });
    if (r.status === "graded" && r.correct) ok++;
  }
  if (ok !== 1) p.push(`${ok} tripplar godkändes`);
  if (typer.length !== 3) p.push("typer ska vara tre");
  return p;
}

export function plan(omgangar) {
  const lagen = new Set();
  for (const tasks of omgangar) for (const t of tasks) t.key.groups[0].ids.forEach((id) => lagen.add(id));
  return lagen.size === 6 ? [] : [`målkort bara på ${[...lagen]}`];
}
