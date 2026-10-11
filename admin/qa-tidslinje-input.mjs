// ============================================================================
// QA-hjälpare för tidslinjen (#602, epic #595): skickar RIKTIGA mus- och
// touchhändelser (CDP Input.dispatch*) till en redan öppen flik – samma flik
// som QA-webbläsaren visar, ingen ny webbläsare. Koordinaterna räknas fram i
// sidan ur tidslinjens egen geometri (.tl-yta + aria-valuemin/max), så
// "drag 1540" drar markören dit som en elev skulle göra med musen/fingret.
//
//   node admin/qa-tidslinje-input.mjs [--port 9222] <kommando> …
//     drag <år>          mus: tryck på markören, dra i 12 steg till <år>, släpp
//     touch <år>         samma med touch (Input.dispatchTouchEvent)
//     klick <år>         mus: klick direkt på linjen vid <år>
//     tryck <år>         touch: tryck direkt på linjen vid <år>
//     knapp <selektor>   mus: klick mitt på elementet (t.ex. .tl-steg-p1)
//     nyp <faktor>       touch: tvåfingersnyp kring linjens mitt (>1 = isär)
//     läs                skriv ut valt år, låst år, zoomvy
//   Väljer första fliken vars url innehåller --url (default 127.0.0.1:86).
// ============================================================================
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const PORT = opt("port", "9222");
const URL_PART = opt("url", "127.0.0.1:86");
const [cmd, arg] = args;

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const tab = tabs.find((t) => t.type === "page" && t.url.includes(URL_PART));
if (!tab) throw new Error(`Ingen flik med ${URL_PART}`);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
};
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Geometri: x för ett år i den AKTUELLA vyn. Vyn läses ur skalans etiketter
// (synliga år) – samma linjära mappning som yearToFrac i timeline-logic.js.
const GEO = `(() => {
  const r = document.querySelector('.tl-root');
  const yta = r.querySelector('.tl-yta').getBoundingClientRect();
  const g = r.querySelector('.tl-gissning');
  const gb = g.getBoundingClientRect();
  const lab = [...r.querySelectorAll('.tl-streck-stor')].map(s => ({ x: s.getBoundingClientRect().left, y: parseInt(s.textContent.replace('−','-').replace(/[^0-9-]/g,''), 10) })).filter(o => Number.isFinite(o.y));
  return { left: yta.left, width: yta.width, top: yta.top, h: yta.height, gx: gb.left + gb.width / 2, gy: gb.top + gb.height / 2, lab,
    valt: r.querySelector('.tl-valt-ar').textContent, now: g.getAttribute('aria-valuenow') };
})()`;
function xFor(geo, year) {
  const [a, b] = [geo.lab[0], geo.lab[geo.lab.length - 1]];
  return a.x + ((year - a.y) / (b.y - a.y)) * (b.x - a.x);
}
async function geo() { return evalJs(GEO); }

async function mouse(type, x, y, buttons = 1) {
  await send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1, pointerType: "mouse" });
}
async function touch(type, points) {
  await send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
}

const g = await geo();
const y0 = g.top + g.h / 2;
if (cmd === "drag" || cmd === "touch") {
  const tx = xFor(g, Number(arg));
  const sx = g.gx;
  if (cmd === "drag") {
    await mouse("mouseMoved", sx, y0, 0);
    await mouse("mousePressed", sx, y0);
    for (let i = 1; i <= 12; i++) { await mouse("mouseMoved", sx + ((tx - sx) * i) / 12, y0); await sleep(16); }
    await mouse("mouseReleased", tx, y0, 0);
  } else {
    await touch("touchStart", [[sx, y0]]);
    for (let i = 1; i <= 12; i++) { await touch("touchMove", [[sx + ((tx - sx) * i) / 12, y0]]); await sleep(16); }
    await touch("touchEnd", []);
  }
} else if (cmd === "klick" || cmd === "tryck") {
  const tx = xFor(g, Number(arg));
  if (cmd === "klick") { await mouse("mouseMoved", tx, y0, 0); await mouse("mousePressed", tx, y0); await mouse("mouseReleased", tx, y0, 0); }
  else { await touch("touchStart", [[tx, y0]]); await touch("touchEnd", []); }
} else if (cmd === "knapp") {
  const b = await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(arg)}); e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
  await mouse("mouseMoved", b.x, b.y, 0); await mouse("mousePressed", b.x, b.y); await mouse("mouseReleased", b.x, b.y, 0);
} else if (cmd === "nyp") {
  const f = Number(arg);
  const cx = g.left + g.width / 2;
  const d0 = 60;
  await touch("touchStart", [[cx - d0, y0], [cx + d0, y0]]);
  for (let i = 1; i <= 10; i++) { const d = d0 * (1 + ((f - 1) * i) / 10); await touch("touchMove", [[cx - d, y0], [cx + d, y0]]); await sleep(16); }
  await touch("touchEnd", []);
}
await sleep(250);
const after = await geo();
const extra = await evalJs(`(() => { const r = document.querySelector('.tl-root'); return { las: !r.querySelector('.tl-las').disabled, last: r.classList.contains('tl-last'), vy: [...r.querySelectorAll('.tl-streck-stor')].map(s => s.textContent).join(' ') }; })()`);
console.log(JSON.stringify({ cmd, arg, valt: after.valt, aria: after.now, lasAktiv: extra.las, last: extra.last, skala: extra.vy }));
ws.close();
