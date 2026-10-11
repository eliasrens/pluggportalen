// QA (#602): skriver ut aktuell fråga i fliken + rätt år ur Firestore-emulatorn
// (facit hämtas UTANFÖR sidan – sidan själv får inte känna till svaret).
//   FS=8622 node admin/qa-tidslinje-fraga.mjs [--knapp "Nästa händelse →"]
const PORT = 9222, FS = process.env.FS || "8622";
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const tab = tabs.find((t) => t.type === "page" && t.url.includes("127.0.0.1:86"));
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const p = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); p.get(d.id)?.(d); };
const ev = (expression) => new Promise((r) => { const i = ++id; p.set(i, (d) => r(d.result?.result?.value)); ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } })); });
const knapp = process.argv.indexOf("--knapp");
if (knapp > 0) {
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(process.argv[knapp + 1])}); b && b.click(); return !!b;})()`);
  await new Promise((r) => setTimeout(r, 600));
}
const q = await ev(`(()=>{const r=document.querySelector('.tl-root'); return r ? r.querySelector('.tl-fraga').textContent : null})()`);
const area = await (await fetch(`http://127.0.0.1:${FS}/v1/projects/pluggportalen-so-2026/databases/(default)/documents/subjects/so/areas/vasatiden`, { headers: { Authorization: "Bearer owner" } })).json();
const tl = area.fields.timeline.arrayValue.values.map((v) => v.mapValue.fields);
const hit = tl.find((e) => e.question.stringValue === q);
const count = await ev(`(document.querySelector('.quiz-count')||{}).textContent`);
console.log(JSON.stringify({ count, q, ratt: hit ? Number(hit.year.integerValue) : null }));
ws.close();
