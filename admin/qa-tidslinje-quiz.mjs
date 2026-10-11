// ============================================================================
// QA (#602, epic #595): spelar ett VANLIGT Quiz i den öppna fliken (eleven är
// redan inne på #/elev/spela?…&mode=quiz) och loggar varje kort. Flervalsfrågor
// besvaras rätt med ett riktigt klick; tidslinjefrågor besvaras PÅ TIDSLINJEN
// med riktig musdragning (admin/qa-tidslinje-input.mjs). Facit läses ur
// Firestore-emulatorn, aldrig ur sidan.
//   FS=8622 node admin/qa-tidslinje-quiz.mjs [fel-första-tidslinje]
//   → med argumentet svaras den första tidslinjefrågan 7 år fel (repetition).
//   [stopp-vid-tidslinje] → stannar obesvarad vid första tidslinjefrågan (skärmdump).
// ============================================================================
import { execFileSync } from "node:child_process";
const FS = process.env.FS || "8622";
const FEL_FORSTA = process.argv.includes("fel-första-tidslinje");
const STOPP = process.argv.includes("stopp-vid-tidslinje"); // stanna (obesvarad) vid första tidslinjefrågan
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
const quiz = area.fields.quiz.arrayValue.values.map((v) => v.mapValue.fields);
const tl = area.fields.timeline.arrayValue.values.map((v) => v.mapValue.fields);
const facitQuiz = Object.fromEntries(quiz.map((q) => [q.question.stringValue, q.options.arrayValue.values[Number(q.answerIndex.integerValue)].stringValue]));
const facitTl = Object.fromEntries(tl.map((e) => [e.question.stringValue, Number(e.year.integerValue)]));

const logg = [];
let felGjort = false;
for (let n = 0; n < 40; n++) {
  const kort = await ev(`(() => { const w = document.querySelector('#game-body .quiz-wrap'); if (!w) return null;
    const tlRoot = w.querySelector('.tl-root');
    return { tidslinje: !!tlRoot, fraga: w.querySelector('.quiz-question')?.textContent.trim(), count: w.querySelector('.quiz-count')?.textContent,
      alternativ: w.querySelectorAll('.quiz-opt').length, knappar: [...w.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean) }; })()`);
  if (!kort) break;
  if (kort.tidslinje && STOPP) { logg.push(kort); break; }
  if (kort.tidslinje) {
    const ratt = facitTl[kort.fraga];
    const sikte = !felGjort && FEL_FORSTA ? ratt - 7 : ratt;
    const d = input("drag", String(sikte));
    // Fånga det år komponenten SKICKAR (onLock) via det synliga resultatet efter lås.
    input("knapp", ".tl-las");
    await sleep(300);
    const fb = await ev(`document.querySelector('#game-body #fb').innerText`);
    const visat = await ev(`(document.querySelector('#game-body .tl-gissning .tl-markor-text')||{}).textContent`);
    logg.push({ ...kort, ratt, draget: d.valt, visatEfterLas: visat, feedback: fb.slice(0, 40) });
    if (sikte !== ratt) felGjort = true;
  } else {
    const svar = facitQuiz[kort.fraga];
    const xy = await ev(`(() => { const b = [...document.querySelectorAll('#game-body .quiz-opt')].find(b => b.textContent.trim() === ${JSON.stringify(svar)}); b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: xy.x, y: xy.y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
    await sleep(300);
    logg.push({ ...kort, knappar: undefined, svar, feedback: (await ev(`document.querySelector('#game-body #fb').innerText`)).slice(0, 20) });
  }
  const next = await ev(`(() => { const b = document.querySelector('#game-body #nextwrap button'); const t = b?.textContent; b?.click(); return t; })()`);
  await sleep(700);
  if (next === "Se resultat") { await sleep(1800); break; }
}
const resultat = await ev(`document.querySelector('#game-body').innerText.slice(0, 400)`);
console.log(JSON.stringify({ logg, resultat }, null, 1));
ws.close();
