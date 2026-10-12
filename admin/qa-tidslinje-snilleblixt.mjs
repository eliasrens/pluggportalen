// ============================================================================
// QA (#602, epic #595): eleven i Snilleblixten i den ÖPPNA fliken (#/elev/live).
// Läraren körs huvudlöst med admin/qa-snilleblixt-larare.mjs (appens moduler).
// Varje ny fråga: flerval → rätt alternativ (klick); tidslinje → plan per
// tidslinjefråga i ordning (argument), t.ex. "0,3,skip": exakt, 3 år fel, låt
// tiden gå ut. Facit ur Firestore-emulatorn (Vasatiden), aldrig ur sidan.
//   FS=8622 node admin/qa-tidslinje-snilleblixt.mjs <plan> <max-sekunder>
// ============================================================================
import { execFileSync } from "node:child_process";
const FS = process.env.FS || "8622";
const PLAN = (process.argv[2] || "0").split(",");
const MAX = Number(process.argv[3] || 300) * 1000;
const tabs = await (await fetch("http://127.0.0.1:9222/json")).json();
const tab = tabs.find((t) => t.type === "page" && t.url.includes("127.0.0.1:86"));
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const p = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); p.get(d.id)?.(d); };
const send = (method, params) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const input = (...a) => JSON.parse(execFileSync("node", ["admin/qa-tidslinje-input.mjs", ...a], { encoding: "utf8" }));

const area = await (await fetch(`http://127.0.0.1:${FS}/v1/projects/pluggportalen-so-2026/databases/(default)/documents/subjects/so/areas/vasatiden`, { headers: { Authorization: "Bearer owner" } })).json();
const facitQuiz = Object.fromEntries(area.fields.quiz.arrayValue.values.map((v) => v.mapValue.fields).map((q) => [q.question.stringValue, q.options.arrayValue.values[Number(q.answerIndex.integerValue)].stringValue]));
const facitTl = Object.fromEntries(area.fields.timeline.arrayValue.values.map((v) => v.mapValue.fields).map((e) => [e.question.stringValue, Number(e.year.integerValue)]));

const sedda = new Set();
let tlNr = 0;
const t0 = Date.now();
while (Date.now() - t0 < MAX) {
  await sleep(700);
  const s = await ev(`(() => { const m = document.querySelector('main'); if (!m) return null;
    const tl = [...m.querySelectorAll('.tl-root')].find(r => r.checkVisibility());
    const tlFraga = tl?.querySelector('.tl-fraga')?.textContent || '';
    const fraga = tlFraga || [...m.querySelectorAll('.ca-fraga, .sb-fraga, h2')].filter(e => e.checkVisibility()).map(e => e.textContent.trim()).find(Boolean) || '';
    return { tl: !!tl, last: !!tl?.classList.contains('tl-last'), aktiv: !!tl && !tl.querySelector('.tl-las')?.disabled || !!tl && tl.querySelector('.tl-valt-ar')?.textContent === '?',
      fraga, alt: [...m.querySelectorAll('button.ca-knapp')].filter(b => b.checkVisibility() && !b.disabled).length, text: m.innerText.replace(/\\s+/g, ' ').slice(0, 220) }; })()`);
  if (!s) continue;
  if (/Pallen|pallen|Slut|Tack för/.test(s.text) && !s.tl && s.alt === 0 && sedda.size > 0 && /plats|Pall|Slut/.test(s.text)) { console.log(JSON.stringify({ slut: s.text })); }
  const nyckel = s.fraga;
  if (!nyckel || sedda.has(nyckel)) continue;
  if (s.tl && !s.last && facitTl[s.fraga]) {
    sedda.add(nyckel);
    const plan = PLAN[tlNr++] ?? "0";
    const ratt = facitTl[s.fraga];
    if (plan === "skip") { console.log(JSON.stringify({ tidslinje: s.fraga, ratt, plan: "låter tiden gå ut" })); continue; }
    const d = input("drag", String(ratt + Number(plan)));
    input("knapp", ".tl-las");
    await sleep(500);
    console.log(JSON.stringify({ tidslinje: s.fraga, ratt, låst: d.valt, synligaFlerval: s.alt, efter: (await ev(`document.querySelector('main').innerText.replace(/\\s+/g,' ').slice(0,200)`)) }));
  } else if (s.alt > 0 && facitQuiz[s.fraga]) {
    sedda.add(nyckel);
    const xy = await ev(`(() => { const b = [...document.querySelectorAll('button.ca-knapp')].filter(b => b.checkVisibility()).find(b => b.textContent.includes(${JSON.stringify(facitQuiz[s.fraga])})); const r = b.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: xy.x, y: xy.y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
    console.log(JSON.stringify({ flerval: s.fraga, svar: facitQuiz[s.fraga] }));
  }
}
console.log(JSON.stringify({ slutläge: await ev(`document.querySelector('main').innerText.replace(/\\s+/g,' ').slice(0,300)`) }));
ws.close();
