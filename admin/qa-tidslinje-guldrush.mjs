// ============================================================================
// QA (#602, epic #595): spelar Guldrushen som eleven i den ÖPPNA fliken
// (#/elev/live) i N steg. Flervalsfrågor besvaras rätt med klick, tidslinje-
// frågor PÅ TIDSLINJEN med riktig musdragning (qa-tidslinje-input.mjs), kistor
// väljs med klick. Facit hämtas ur Firestore-emulatorn (Vasatiden), aldrig ur
// sidan. Varje steg loggas med guldet före/efter.
//   FS=8622 node admin/qa-tidslinje-guldrush.mjs <steg> [tl-fel=<år>]
//   tl-fel=7 → tidslinjefrågorna besvaras 7 år fel (annars exakt).
// ============================================================================
import { execFileSync } from "node:child_process";
const FS = process.env.FS || "8622";
const STEG = Number(process.argv[2] || 10);
const FEL = Number((process.argv.find((a) => a.startsWith("tl-fel=")) || "tl-fel=0").split("=")[1]);
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
const klick = async (sel, text) => {
  const xy = await ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(b => b.checkVisibility()).find(b => ${text ? `b.textContent.trim().includes(${JSON.stringify(text)})` : "true"}); if (!b) return null; if (/^[🔇🔊]$/u.test(b.textContent.trim())) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
  if (!xy) return false;
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: xy.x, y: xy.y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
  return true;
};

const area = await (await fetch(`http://127.0.0.1:${FS}/v1/projects/pluggportalen-so-2026/databases/(default)/documents/subjects/so/areas/vasatiden`, { headers: { Authorization: "Bearer owner" } })).json();
const facitQuiz = Object.fromEntries(area.fields.quiz.arrayValue.values.map((v) => v.mapValue.fields).map((q) => [q.question.stringValue, q.options.arrayValue.values[Number(q.answerIndex.integerValue)].stringValue]));
const facitTl = Object.fromEntries(area.fields.timeline.arrayValue.values.map((v) => v.mapValue.fields).map((e) => [e.question.stringValue, Number(e.year.integerValue)]));

const guld = () => ev(`(() => { const t = document.querySelector('main').innerText.match(/\\n(\\d+)\\nguld/); return t ? Number(t[1]) : null; })()`);
const logg = [];
for (let n = 0; n < STEG; n++) {
  await sleep(900);
  const s = await ev(`(() => { const m = document.querySelector('main'); const tl = [...m.querySelectorAll('.tl-root')].find(r => r.checkVisibility());
    const fraga = tl ? tl.querySelector('.tl-fraga')?.textContent : [...m.querySelectorAll('.ca-fraga')].filter(e => e.checkVisibility()).map(e => e.textContent.trim())[0];
    return { tl: !!tl, last: !!tl?.classList.contains('tl-last'), fraga, alt: [...m.querySelectorAll('button.ca-knapp')].filter(b => b.checkVisibility()).length,
      text: m.innerText.replace(/\\s+/g, ' ').slice(0, 160) }; })()`);
  const fore = await guld();
  let gjort;
  if (s.tl && !s.last && facitTl[s.fraga]) {
    const ratt = facitTl[s.fraga];
    const d = input("drag", String(ratt + FEL));
    input("knapp", ".tl-las");
    gjort = `tidslinje ${s.fraga} → låst ${d.valt} (rätt ${ratt}), synliga flervalsknappar ${s.alt}`;
  } else if (s.alt > 0 && facitQuiz[s.fraga]) {
    await klick("button.ca-knapp", facitQuiz[s.fraga]);
    gjort = `flerval ${s.fraga} → ${facitQuiz[s.fraga]}`;
  } else if (/Välj en kista|Välj vem|Välj/.test(s.text)) {
    const ok = await klick("main button:not(.tl-steg):not(.tl-zoom):not(.ca-knapp)", /Välj en kista/.test(s.text) ? "1" : null);
    gjort = `val (kista/offer) klick=${ok}: ${s.text.slice(0, 90)}`;
  } else {
    gjort = `väntar: ${s.text.slice(0, 120)}`;
  }
  await sleep(1500);
  logg.push({ n, fore, efter: await guld(), gjort });
  console.log(JSON.stringify(logg.at(-1)));
}
ws.close();
