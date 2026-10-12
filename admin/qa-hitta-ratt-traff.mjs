// ============================================================================
// QA för träffregeln (#640): rutnät av riktiga CDP-klick (mus eller touch)
// mot preview/preview-hitta-ratt-ringar.html i den redan öppna QA-fliken.
//   PORT=8639 node server.mjs   (sidan: /preview/preview-hitta-ratt-ringar.html)
//   node admin/qa-hitta-ratt-traff.mjs [--touch] <pack> [zoom:<gånger>] NYCKEL[:yta|:ring|:karna] …
//   t.ex. … varlden-lander-30 ISR:yta PSX:ring zoom:2 ISR:yta
// :yta = rutnät över landets INRE yta (punkter en bit in från kanten),
// :ring = rutnät över ringens skiva (r ≤ 11 px av 12, steg 2), :karna = ringens
// inre del (r ≤ 6 px, steg 1, ett barns normala sikte). zoom:<g> hjulzoomar mot
// senast nämnda landets mitt (eller ISR) tills zoomen är minst g × helvyn.
// Skriver träffar/antal och vad klicken valde i stället. CDP på 127.0.0.1:9222.
// ============================================================================
const args = process.argv.slice(2); const touch = args.includes("--touch");
const [pack, ...keys] = args.filter((a) => a !== "--touch");
const lista = await (await fetch("http://127.0.0.1:9222/json")).json();
const sida = lista.find((p) => p.type === "page" && p.url.includes("127.0.0.1:8639"));
const ws = new WebSocket(sida.webSocketDebuggerUrl); let nr = 0; const vant = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (vant.has(d.id)) { vant.get(d.id)(d.result); vant.delete(d.id); } };
await new Promise((r) => (ws.onopen = r));
const cdp = (method, params = {}) => new Promise((r) => { const id = ++nr; vant.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
const vila = (ms) => new Promise((r) => setTimeout(r, ms));
await ev(`location.search = "?pack=${pack}&t=" + Date.now()`); await vila(2500);

const mitt = (k) => ev(`(() => { const r = document.querySelector('.hr-omrade[data-id="' + hrQa.nycklar["${k}"] + '"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
const zoom = async () => +(await ev(`document.getElementById("info").textContent`)).match(/zoom ([\d.]+)/)[1];

async function klicka(x, y) {
  await ev(`document.getElementById("valt").textContent = ""`);
  if (touch) {
    await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 }] });
    await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
  await vila(touch ? 380 : 60); // touch: undvik att två tryck blir dubbeltryck
  return (await ev(`document.getElementById("valt").textContent`)).replace("Valt: ", "") || "–";
}

// Provpunkter i skärm-px för ett land (:yta) eller dess ring (:ring).
const punkter = (k, satt) => ev(`(() => { const q = hrQa;
  if ("${satt}" !== "yta") { const c = q.ringPos("${k}"); if (!c) return [];
    const [R, s] = "${satt}" === "karna" ? [6, 1] : [11, 2], ut = [];
    for (let dy = -R; dy <= R; dy += s) for (let dx = -R; dx <= R; dx += s)
      if (Math.hypot(dx, dy) <= R) ut.push([c[0] + dx, c[1] + dy]); return ut; }
  const p = document.querySelector('.hr-omrade[data-id="' + q.nycklar["${k}"] + '"]');
  const m = document.querySelector("g.hr-kamera").getScreenCTM(), mi = m.inverse();
  const pt = p.ownerSVGElement.createSVGPoint();
  const inne = (x, y) => { pt.x = x; pt.y = y; return p.isPointInFill(pt.matrixTransform(mi)); };
  const b = p.getBoundingClientRect(), kant = Math.min(1, Math.min(b.width, b.height) * 0.15);
  const steg = Math.max(0.5, Math.sqrt(b.width * b.height / 250)), ut = [];
  for (let y = b.top + steg / 2; y < b.bottom; y += steg) for (let x = b.left + steg / 2; x < b.right; x += steg)
    if ([[0, 0], [kant, 0], [-kant, 0], [0, kant], [0, -kant]].every(([dx, dy]) => inne(x + dx, y + dy))) ut.push([x, y]);
  return ut; })()`);

let senast = "ISR";
for (const arg of keys) {
  const [k, satt = "yta"] = arg.split(":");
  if (k === "zoom") {
    const p = await mitt(senast);
    while (await zoom() < +satt) { await cdp("Input.dispatchMouseEvent", { type: "mouseWheel", x: p[0], y: p[1], deltaX: 0, deltaY: -60 }); await vila(150); }
    await vila(700); console.log(`zoom ${(await zoom()).toFixed(2)}`); continue;
  }
  senast = k;
  const pts = await punkter(k, satt);
  if (!pts.length) { console.log(`${k}:${satt} – inga provpunkter (ingen ring?)`); continue; }
  const val = {};
  for (const [x, y] of pts) { const v = await klicka(x, y); val[v] = (val[v] || 0) + 1; }
  const traff = val[k] || 0; delete val[k];
  console.log(`${k}:${satt}${touch ? " (touch)" : ""}: ${traff}/${pts.length} träff` + (Object.keys(val).length ? ` · annars ${JSON.stringify(val)}` : ""));
}
ws.close();
