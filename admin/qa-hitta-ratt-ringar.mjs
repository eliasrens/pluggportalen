// ============================================================================
// QA för klickringarna (#639): riktiga CDP-klick (mus eller touch) mot
// preview/preview-hitta-ratt-ringar.html i den redan öppna QA-fliken.
//   PORT=8639 node server.mjs   (sidan: /preview/preview-hitta-ratt-ringar.html)
//   node admin/qa-hitta-ratt-ringar.mjs [--touch] <pack> NYCKEL[:ring|:yta] … [hjul:<deltaY>:<n>:<NYCKEL>]
//   t.ex. … europa-lander-alla MLT LUX BEL:yta hjul:-100:4:LUX LUX:yta
// :ring klickar mitt i ringen, :yta en punkt inne i landet som inte ligger
// under en ring. Skriver vad som valdes och OK/FEL. CDP på 127.0.0.1:9222.
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
await ev(`location.search = "?pack=${pack}&t=" + Date.now()`); await vila(2000);
for (const arg of keys) {
  const [k, satt = "ring", lon, lat] = arg.split(":");
  if (k === "hjul") { // hjul:<deltaY>:<n>:<nyckel> → zooma mot områdets mitt
    const p = await ev(`(() => { const r = document.querySelector('.hr-omrade[data-id="' + hrQa.nycklar["${lat}"] + '"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    for (let i = 0; i < +lon; i++) { await cdp("Input.dispatchMouseEvent", { type: "mouseWheel", x: p[0], y: p[1], deltaX: 0, deltaY: +satt }); await vila(120); }
    await vila(600); console.log("zoom:", await ev(`document.getElementById("info").textContent`)); continue;
  }
  const pos = await ev(`(() => { const q = hrQa; if ("${satt}" === "ring") return q.ringPos("${k}");
    const id = q.nycklar["${k}"]; const p = document.querySelector('.hr-omrade[data-id="' + id + '"]');
    const L = p.getTotalLength(); const m = document.querySelector("g.hr-kamera").getScreenCTM(); const pt = p.ownerSVGElement.createSVGPoint();
    // första punkten inne i ytan (och inte under en ring) längs en spiral runt rutans mitt
    const b = p.getBBox(); for (let i = 0; i < 2000; i++) { const a = i * 0.37, r = i / 2000 * Math.min(b.width, b.height) / 2;
      pt.x = b.x + b.width / 2 + r * Math.cos(a); pt.y = b.y + b.height / 2 + r * Math.sin(a);
      if (!p.isPointInFill(pt)) continue; const s = pt.matrixTransform(m); const e = document.elementFromPoint(s.x, s.y);
      if (e !== p) continue;
      // en bit in från kanten (touch-justeringen tar annars grannen)
      if ([[3,0],[-3,0],[0,3],[0,-3]].every(([dx, dy]) => document.elementFromPoint(s.x + dx, s.y + dy) === p)) return [s.x, s.y]; }
    return null; })()`);
  if (!pos) { console.log(`${k} (${satt}): INGEN träffpunkt/ring`); continue; }
  const [x, y] = pos;
  if (touch) {
    const tp = [{ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 }];
    await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp });
    await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
  await vila(800);
  const valt = await ev(`document.getElementById("valt").textContent`);
  console.log(`${k} via ${satt}${touch ? " (touch)" : ""} @${x.toFixed(0)},${y.toFixed(0)} → ${valt} ${valt.endsWith(k) ? "OK" : "FEL"}`);
}
ws.close();
