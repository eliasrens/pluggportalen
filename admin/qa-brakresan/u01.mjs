// 01. Lika stora delar – egna kontroller · #710
// Exakt en figur har n lika stora delar; de andra har verifierbart olika area
// eller fel antal; rutnätsdelarna täcker hela rektangeln en gång; olika form
// med lika area finns; ja/nej stämmer med areorna.
import { OLIKFORM, areor } from "../../src/brakresan/utmaningar/u01.js";

const lika = (a) => a.every((x) => x === a[0]);

function rutnatOk(L, v) {
  const alla = L[v].flat();
  return new Set(alla).size === alla.length && alla.length === L.rows * L.cols && alla.every((c) => c >= 0 && c < L.rows * L.cols);
}

/** Bounding box för en region – olika mått = olika form. */
const box = (cells, cols) => {
  const r = cells.map((c) => Math.floor(c / cols));
  const k = cells.map((c) => c % cols);
  return `${Math.max(...r) - Math.min(...r) + 1}x${Math.max(...k) - Math.min(...k) + 1}`;
};

function figurFel(shape, n, f) {
  const a = areor(shape, f);
  const p = [];
  if (f.kind === "lika" || f.kind === "olikform") {
    if (a.length !== n || !lika(a)) p.push(`${f.kind}-figuren har areorna ${a}`);
  } else if (f.kind === "olika" || f.kind === "olikform-fel" || f.kind === "remsor") {
    if (a.length !== n) p.push(`${f.kind}-figuren har ${a.length} delar, inte ${n}`);
    if (lika(a)) p.push(`${f.kind}-figuren har lika stora delar`);
    if (Math.max(...a) / Math.min(...a) > 3) p.push(`${f.kind}-figuren är en karikatyr (${a})`);
  } else if (f.kind === "fler" || f.kind === "farre" || f.kind === "fel-antal") {
    if (a.length === n || !lika(a)) p.push(`${f.kind}-figuren ska ha lika delar men fel antal (${a})`);
  } else p.push(`okänd figur ${f.kind}`);
  if (f.lay && !rutnatOk(OLIKFORM[f.lay], f.v)) p.push(`rutnätet ${f.lay}/${f.v} täcker inte rektangeln`);
  return p;
}

export function audit(task, { grade }) {
  const p = [];
  const { typ, shape, n } = task.params;
  if (n < 2 || n > 6) p.push(`n = ${n} utanför 2–6`);
  if (typ === "janej") {
    p.push(...figurFel(shape, n, task.params.figur));
    const ja = lika(areor(shape, task.params.figur)) && areor(shape, task.params.figur).length === n;
    if (task.key.correct !== (ja ? "ja" : "nej")) p.push("ja/nej-facit stämmer inte med areorna");
  } else {
    const f = task.params.figurer;
    if (f.length !== 3) p.push("ska vara tre figurer");
    for (const x of f) p.push(...figurFel(shape, n, x));
    const ratta = f.filter((x) => { const a = areor(shape, x); return a.length === n && lika(a); });
    if (ratta.length !== 1) p.push(`${ratta.length} figurer har ${n} lika delar`);
    if (!f.some((x) => x.kind === "olika" || x.kind === "olikform-fel" || x.kind === "remsor")) p.push("ingen figur med olika stora delar");
    if (typ === "olikform") {
      const L = OLIKFORM[task.params.lay];
      if (new Set(L.lika.map((c) => box(c, L.cols))).size < 2) p.push(`lika-delarna i ${task.params.lay} har samma form`);
    }
  }
  for (const id of task.answer.options) {
    const r = grade(task, { id });
    if (r.status !== "graded" || r.correct !== (id === task.key.correct)) p.push(`${id} bedömdes fel`);
  }
  if (grade(task, { id: null }).status !== "invalid") p.push("tomt svar ska vara inmatningsfel");
  if (/lika stora/.test(JSON.stringify(task.view.cards || task.view.delar?.[0]?.view))) p.push("figurens data avslöjar svaret");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.params.typ === "janej").length < 2) p.push("färre än två ja/nej-rundor");
    if (!tasks.some((t) => t.params.typ === "olikform" || t.params.figur?.kind === "olikform")) p.push("ingen runda med lika area och olika form");
    if (new Set(tasks.map((t) => t.params.shape)).size < 2) p.push("bara en figursort i en omgång");
  }
  const lagen = new Set();
  for (const tasks of omgangar) for (const t of tasks) if (t.params.typ !== "janej") lagen.add(t.key.correct);
  if (lagen.size !== 3) p.push(`rätt figur bara på ${[...lagen]}`);
  return [...new Set(p)];
}
