// 40. Bråk till decimal – egna kontroller · #712
// Förkortade nämnare 2, 4, 5, 10, 20, 25, 50, 100, värden 0–2, högst två decimaler
// (aldrig 1/3 eller 1/8); decimal och bråk ur SAMMA värde; slutnolla godtas;
// alla likvärdiga bråk godtas; valen har exakt ett lika värde och samma form.
import { q, gcd, eq, valueKey, decimalText, fitsDecimals, parseDecimal } from "../../src/brakresan/math/index.js";

const NAMNARE = [2, 4, 5, 10, 20, 25, 50, 100];
const okBrak = (a, d) => NAMNARE.includes(d) && gcd(a, d) === 1 && a > 0 && a < 2 * d && fitsDecimals(q(a, d), 2);
const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const s = task.params;
  if (s.typ === "matcha") {
    const brak = s.kort.filter((k) => k.form === "brak");
    if (brak.length !== 3 || s.kort.length !== 6) p.push("matchningen ska ha tre bråk och tre decimaltal");
    if (brak.some((b) => !okBrak(b.a, b.d))) p.push("otillåtet bråk");
    if (new Set(brak.map((b) => valueKey(q(b.a, b.d)))).size !== 3) p.push("två par har samma värde");
    for (const c of task.view.cards.filter((c) => c.face.kind === "decimal")) {
      if (!brak.some((b) => eq(q(b.a, b.d), c.face.value))) p.push("decimalkort utan bråk");
    }
    return p;
  }
  if (!okBrak(s.a, s.d)) p.push(`${s.a}/${s.d} är inte tillåtet`);
  const v = q(s.a, s.d);
  const t = decimalText(v);
  if (s.typ === "skriv-dec") {
    for (const x of [t, t.replace(",", "."), decimalText(v, 2) + (t.split(",")[1]?.length === 2 ? "" : "")]) if (!grade(task, { text: x }).correct) p.push(`${x} underkändes`);
    if (!t.includes(",") || t.split(",")[1].length <= 1) if (!grade(task, { text: `${t}0` }).correct && t.includes(",")) p.push("slutnolla underkändes");
  }
  if (s.typ === "skriv-brak") {
    const h = (v.n * 100) / v.d;
    for (const [n, d] of [[s.a, s.d], [h, 100], [2 * s.a, 2 * s.d]]) if (!grade(task, falt(n, d)).correct) p.push(`${n}/${d} underkändes`);
    if (grade(task, falt(h, 1000)).correct) p.push("fel tiotal godkändes");
  }
  if (s.typ === "valj") {
    const kort = task.view.delar.at(-1).view.cards;
    const lika = kort.filter((c) => (c.face.kind === "decimal" ? eq(c.face.value, v) : eq(q(c.face.n, c.face.d), v)));
    if (lika.length !== 1) p.push(`${lika.length} alternativ har rätt värde`);
    if (new Set(kort.map((c) => c.face.kind)).size !== 1) p.push("alternativen har olika form (avslöjar det rätta)");
    if (new Set(kort.map((c) => valueKey(c.face.kind === "decimal" ? c.face.value : q(c.face.n, c.face.d)))).size !== 4) p.push("två alternativ har samma värde");
  }
  if (parseDecimal(t).ok !== true) p.push("decimaltexten går inte att tolka");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const n = (re) => tasks.filter((t) => re.test(t.params.typ)).length;
    if (n(/matcha/) !== 4 || n(/skriv/) !== 4 || n(/valj/) !== 2) p.push("blandningen 4/4/2 stämmer inte");
  }
  return [...new Set(p)];
}
