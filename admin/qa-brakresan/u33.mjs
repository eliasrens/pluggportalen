// 33. Hitta räknefelet – egna kontroller · #711
// Den felaktiga raden är verkligen fel (före ≠ efter), de andra raderna stämmer,
// exakt en kombination (rad + förklaring) godtas, två helt rätta lösningar per omgång.
import { q, eq } from "../../src/brakresan/math/index.js";
import { losning } from "../../src/brakresan/utmaningar/u33.js";

/** Stämmer en rad? Före/efter-stavarna har samma värde (jämför-mallens slutsats kontrolleras separat). */
const radStammer = (rad) => eq(q(rad.stavar[0].marked, rad.stavar[0].parts), q(rad.stavar[1].marked, rad.stavar[1].parts));

export function audit(task, { grade }) {
  const p = [];
  const { mall, t, felRad } = task.params;
  const rader = losning(mall, t, felRad);
  rader.forEach((r, i) => {
    const ska = felRad !== i + 1;
    if (mall === "jamfor") {
      if (i === 1) {
        const sant = t.n < t.m ? r.text.startsWith(`${t.a}/${t.n} > `) : r.text.startsWith(`${t.a}/${t.n} < `);
        if (sant !== ska) p.push("jämförelsens slutsats stämmer inte med felraden");
      }
    } else if (radStammer(r) !== ska) p.push(`rad ${i + 1} ${ska ? "ska stämma" : "ska vara fel"}: ${r.text}`);
  });
  const steg = task.answer.parts.steg.options;
  const varfor = task.answer.parts.varfor.options;
  let godkanda = 0;
  for (const s of steg) for (const v of varfor) if (grade(task, { parts: { steg: { id: s }, varfor: { id: v } } }).correct) godkanda++;
  if (godkanda !== 1) p.push(`${godkanda} kombinationer godkändes`);
  if (grade(task, { parts: { steg: { id: steg[0] } } }).status !== "invalid") p.push("saknad förklaring ska vara inmatningsfel");
  if (new Set(task.view.fragor[1].options.map((o) => o.text)).size !== 4) p.push("förklaringarna ska vara fyra olika");
  if (/\d\/\d+ \+ \d\/\d+/.test(rader.map((r) => r.text).join(" ")) && mall !== "add") p.push("addition utanför addmallen");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.params.felRad === 0).length !== 2) p.push("inte två helt rätta lösningar");
    for (const m of ["add", "sub", "lik", "jamfor"]) if (!tasks.some((t) => t.params.mall === m)) p.push(`mallen ${m} saknas`);
  }
  return [...new Set(p)];
}
