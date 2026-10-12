// ============================================================================
// QA-hjälpare för Hitta rätt! (#611, epic #603): skickar RIKTIGA mus-, hjul-
// och touchhändelser (CDP Input.dispatch*) till en redan öppen flik – samma
// flik som QA-webbläsaren visar, ingen ny webbläsare. Facit läses ur packfilen
// på disk (aldrig ur sidan); skärmpunkten räknas ur kartans egen kamera
// (g.hr-kamera getScreenCTM) och projektionen i geo-filen.
//
//   node admin/qa-hitta-ratt-input.mjs [--port 9222] [--url 127.0.0.1:86] [--touch] <kommando> …
//     läs                    fråga, pack, nål/val, knappar, tid
//     facit [km-öst]         klicka på rätt plats (punkt, +km österut) / rätt område
//     plats <lon> <lat>      klicka på en lon/lat (punkt)
//     omrade <nyckel>        klicka inne i området med packens nyckel (t.ex. NOR, uppland)
//     hjul <deltaY> [n]      n hjulsteg mitt på kartan (negativt = zooma in)
//     hjulvid <lon> <lat> <deltaY> [n]  hjulsteg över en lon/lat
//     drag <dx> <dy>         dra kartan dx,dy px från mitten
//     dragfran <x> <y> <dx> <dy>  dra från en skärmpunkt (t.ex. nålen)
//     nyp <faktor>           touch: tvåfingersnyp mitt på kartan
//     knapp <selektor>       klick mitt på ett element (t.ex. .hr-las)
//     oppna <packId>         starta ett pack direkt via hashen
//     kontroll               aktivt pack: etiketter, startvy (punkt), träffytor (område)
//     spela [fel-km] [n]     hela omgången: facit (+fel-km öst) → Lås → Nästa, n frågor (default alla);
//                            område: fel-km > 0 = var fel-km:e fråga väljs fel område
//   --touch: klick/drag/knapp skickas som touch i stället för mus.
//   --packfil <sökväg>: lärarens egna pack (e-…, #633) finns inte på disk –
//     peka ut en JSON-dump av hittaRattPacks/{id} i stället.
// ============================================================================
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flagga = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const PORT = opt("port", "9222");
const URL_PART = opt("url", "127.0.0.1:86");
const TOUCH = flagga("touch");
const PACKFIL = opt("packfil", null);
const [cmd, ...rest] = args;
const ROOT = new URL("..", import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, ROOT), "utf8"));

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const tab = tabs.find((t) => t.type === "page" && t.url.includes(URL_PART));
if (!tab) throw new Error(`Ingen flik med ${URL_PART}`);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.method === "Page.javascriptDialogOpening") send("Page.handleJavaScriptDialog", { accept: true }); // lämna-vakten
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
};
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Inmatning ----------------------------------------------------------------
async function mus(type, x, y, extra = {}) {
  await send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra });
}
async function klick(x, y) {
  if (TOUCH) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await sleep(40);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
    await mus("mousePressed", x, y);
    await sleep(30);
    await mus("mouseReleased", x, y);
  }
  await sleep(120);
}
async function drag(x0, y0, dx, dy, steg = 12) {
  if (TOUCH) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0, id: 1 }] });
    for (let i = 1; i <= steg; i++) {
      await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / steg, y: y0 + (dy * i) / steg, id: 1 }] });
      await sleep(16);
    }
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0, buttons: 0 });
    await mus("mousePressed", x0, y0);
    for (let i = 1; i <= steg; i++) {
      await mus("mouseMoved", x0 + (dx * i) / steg, y0 + (dy * i) / steg);
      await sleep(16);
    }
    await mus("mouseReleased", x0 + dx, y0 + dy);
  }
  await sleep(200);
}
async function nyp(cx, cy, faktor, steg = 12) {
  const d0 = 60, d1 = 60 * faktor;
  for (let i = 0; i <= steg; i++) {
    const d = d0 + ((d1 - d0) * i) / steg;
    await send("Input.dispatchTouchEvent", {
      type: i === 0 ? "touchStart" : "touchMove",
      touchPoints: [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }],
    });
    await sleep(16);
  }
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(300);
}
async function hjul(x, y, deltaY) {
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY });
  await sleep(120);
}

// --- Läsa sidan -----------------------------------------------------------------
const LAS = `(() => {
  const q = (s) => document.querySelector(s);
  const v = q('.hr-karta')?.getBoundingClientRect();
  const fb = q('.hr-spel-feedback');
  return {
    hash: location.hash,
    titel: q('.hr-spel-titel')?.textContent,
    nr: q('[data-v="nr"]')?.textContent,
    prompt: q('.hr-spel-prompt')?.textContent,
    namn: q('.hr-spel-namn')?.hidden === false ? q('.hr-spel-namn').textContent : null,
    las: q('.hr-las') ? { hidden: q('.hr-las').hidden, disabled: q('.hr-las').disabled } : null,
    nasta: q('.hr-nasta') ? { hidden: q('.hr-nasta').hidden } : null,
    tid: q('[data-v="tid"]')?.innerText, ratt: q('[data-v="ratt"]')?.innerText,
    poang: q('[data-v="poang"]')?.innerText, coins: q('[data-v="coins"]')?.innerText,
    feedback: fb?.innerText, fbKlass: fb?.className,
    nalar: [...document.querySelectorAll('.hr-karta .hr-nal')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.getAttribute('class')),
    vald: q('.hr-val-kontur')?.getAttribute('d')?.length || 0,
    karta: v ? { x: v.left, y: v.top, w: v.width, h: v.height } : null,
    kamera: q('.hr-kamera')?.getAttribute('transform'),
    resultat: q('.hr-res-stort')?.closest('main')?.innerText?.slice(0, 900) || null,
  };
})()`;
const las = () => evalJs(LAS);

function aktivtPack(s) {
  const id = decodeURIComponent((s.hash.match(/pack=([^&]+)/) || [])[1] || "");
  if (!id) throw new Error(`Inget pack i hashen (${s.hash})`);
  const pack = PACKFIL ? JSON.parse(readFileSync(PACKFIL, "utf8")) : json(`src/hitta-ratt/content/packs/${id}.json`);
  const geo = json(`src/hitta-ratt/content/geo/${pack.geo}.json`);
  return { pack, geo };
}
function aktuellFraga(s, pack) {
  const it = (s.namn && pack.items.find((i) => i.name === s.namn)) // sevärdheter: samma prompt, namnet under bilden
    || pack.items.find((i) => (i.prompt || "") === s.prompt)
    || pack.items.find((i) => s.prompt?.includes(i.name) || (s.namn && s.namn === i.name));
  if (!it) throw new Error(`Hittar inte frågan "${s.prompt}" i ${pack.id}`);
  return it;
}

// lon/lat → skärm via kamerans CTM (kartkoordinater = projektionen i geo.proj).
async function skarmpunkt(geo, lon, lat) {
  return evalJs(`(async () => {
    const { tillKarta } = await import('/src/hitta-ratt/karta/projektion.js');
    const [X, Y] = tillKarta(${JSON.stringify(geo.proj)}, ${lon}, ${lat});
    const g = document.querySelector('.hr-kamera');
    const m = g.getScreenCTM();
    const pt = new DOMPoint(X, Y).matrixTransform(m);
    const r = document.querySelector('.hr-karta').getBoundingClientRect();
    return { x: pt.x, y: pt.y, inne: pt.x > r.left + 4 && pt.x < r.right - 4 && pt.y > r.top + 4 && pt.y < r.bottom - 4 };
  })()`);
}
// Ett synligt område: rutnätssök i pathens ruta med elementFromPoint (mitten kan vara hav).
async function omradesPunkt(omradeId) {
  return evalJs(`(() => {
    const p = document.querySelector('.hr-omrade[data-id="${omradeId}"]');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const k = document.querySelector('.hr-karta').getBoundingClientRect();
    const kont = document.querySelector('.hr-kontroller')?.getBoundingClientRect();
    let bast = null;
    for (let i = 1; i < 24; i++) for (let j = 1; j < 24; j++) {
      const x = r.left + (r.width * i) / 24, y = r.top + (r.height * j) / 24;
      if (x < k.left + 2 || x > k.right - 2 || y < k.top + 2 || y > k.bottom - 2) continue;
      if (kont && x >= kont.left && x <= kont.right && y >= kont.top && y <= kont.bottom) continue;
      const t = document.elementFromPoint(x, y)?.closest?.('[data-id]');
      if (t?.getAttribute('data-id') === '${omradeId}') {
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (!bast || d < bast.d) bast = { x, y, d };
      }
    }
    return bast;
  })()`);
}
function omradeIdFor(pack, k) {
  const fil = `src/hitta-ratt/content/geo/${pack.geo}.nycklar.json`;
  return json(fil)[k] || pack.items.find((i) => i.id === k)?.omrade;
}
async function elementMitt(sel) {
  return evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
}
async function hem() {
  const p = await elementMitt('.hr-kontroller [data-k="hem"]');
  if (p) { await klick(p.x, p.y); await sleep(700); }
}
async function knapp(sel) {
  const p = await elementMitt(sel);
  if (!p) throw new Error(`Inget element ${sel}`);
  await klick(p.x, p.y);
}

async function svaraFacit(kmOst = 0, fel = false) {
  const s = await las();
  const { pack, geo } = aktivtPack(s);
  const it = aktuellFraga(s, pack);
  if (pack.type === "area") {
    let k = it.omrade;
    if (fel) k = pack.items.find((i) => i.omrade !== it.omrade).omrade;
    const id = k; // packens item.omrade är redan geo-id:t (o18 …)
    let p = await omradesPunkt(id);
    if (!p) { await hem(); p = await omradesPunkt(id); }
    if (!p) throw new Error(`Område ${k} (${id}) syns inte`);
    await klick(p.x, p.y);
    return { fraga: it.name, klickade: pack.items.find((i) => i.omrade === k)?.key, rattOmrade: it.key };
  }
  const lon = it.lon + kmOst / (111.32 * Math.cos((it.lat * Math.PI) / 180));
  let p = await skarmpunkt(geo, lon, it.lat);
  if (!p.inne) { await hem(); p = await skarmpunkt(geo, lon, it.lat); }
  if (!p.inne) throw new Error(`${it.name} hamnar utanför kartan`);
  await klick(p.x, p.y);
  return { fraga: it.name, lon: +lon.toFixed(4), lat: it.lat };
}

const mitt = async () => { const s = await las(); return { x: s.karta.x + s.karta.w / 2, y: s.karta.y + s.karta.h / 2 }; };

let ut;
switch (cmd) {
  case "läs": case "las": ut = await las(); break;
  case "facit": ut = await svaraFacit(+(rest[0] || 0)); break;
  case "plats": {
    const s = await las(); const { geo } = aktivtPack(s);
    const p = await skarmpunkt(geo, +rest[0], +rest[1]);
    await klick(p.x, p.y); ut = p; break;
  }
  case "omrade": {
    const s = await las(); const { pack } = aktivtPack(s);
    const p = await omradesPunkt(omradeIdFor(pack, rest[0]));
    if (!p) throw new Error("området syns inte");
    await klick(p.x, p.y); ut = p; break;
  }
  case "hjul": {
    const m = await mitt();
    for (let i = 0; i < +(rest[1] || 1); i++) await hjul(m.x, m.y, +rest[0]);
    await sleep(300); ut = (await las()).kamera; break;
  }
  case "hjulvid": {
    const s = await las(); const { geo } = aktivtPack(s);
    for (let i = 0; i < +(rest[3] || 1); i++) {
      const p = await skarmpunkt(geo, +rest[0], +rest[1]);
      await hjul(p.x, p.y, +rest[2]);
    }
    await sleep(300); ut = (await las()).kamera; break;
  }
  case "drag": { const m = await mitt(); await drag(m.x, m.y, +rest[0], +rest[1]); ut = (await las()).kamera; break; }
  case "dragfran": await drag(+rest[0], +rest[1], +rest[2], +rest[3]); ut = (await las()).kamera; break;
  case "nyp": { const m = await mitt(); await nyp(m.x, m.y, +rest[0]); ut = (await las()).kamera; break; }
  case "knapp": await knapp(rest[0]); ut = await las(); break;
  case "oppna": {
    // Öppna ett pack direkt (lämna-vaktens confirm godkänns automatiskt).
    await send("Page.enable");
    const bas = (await evalJs("location.origin"));
    await send("Page.navigate", { url: `${bas}/#/elev/hitta-ratt` });
    await sleep(1200);
    await send("Page.navigate", { url: `${bas}/#/elev/hitta-ratt?pack=${rest[0]}` });
    for (let i = 0; i < 30; i++) { await sleep(300); if ((await las()).prompt) break; }
    await sleep(800);
    ut = await las(); break;
  }
  case "bild": {
    const r = await send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(rest[0], Buffer.from(r.result.data, "base64"));
    ut = rest[0]; break;
  }
  case "kontroll": {
    // Startvy + etiketter + träffytor för aktivt pack (vid startvyn).
    const s = await las(); const { pack, geo } = aktivtPack(s);
    const text = await evalJs(`[...document.querySelectorAll('.hr-karta *')].filter(e => getComputedStyle(e).display !== 'none' && e.childElementCount === 0 && e.textContent.trim() && !e.closest('.hr-kontroller, .hr-attribution')).map(e => e.textContent.trim())`);
    const titlar = await evalJs(`document.querySelectorAll('.hr-karta title, .hr-omrade[title]').length`);
    const utanfor = [], osynliga = [], fel = [];
    for (const it of pack.items) {
      if (pack.type === "area") {
        const p = await omradesPunkt(it.omrade);
        if (!p) { osynliga.push(it.key); continue; }
        const traff = await evalJs(`document.elementFromPoint(${p.x}, ${p.y})?.closest('[data-id]')?.getAttribute('data-id')`);
        if (traff !== it.omrade) fel.push(`${it.key}→${traff}`);
      } else {
        const p = await skarmpunkt(geo, it.lon, it.lat);
        if (!p.inne) utanfor.push(it.name);
      }
    }
    const omraden = await evalJs(`document.querySelectorAll('.hr-omrade').length`);
    ut = { pack: pack.id, typ: pack.type, geo: pack.geo, fragor: pack.items.length, omraden, text, titlar, utanfor, osynliga, fel };
    break;
  }
  case "spela": {
    const felKm = +(rest[0] || 0);
    const max = +(rest[1] || 999);
    const logg = [];
    for (let n = 0; n < max; n++) {
      const s = await las();
      if (!s.las || s.las.hidden && s.nasta?.hidden) break;
      const { pack } = aktivtPack(s);
      const fel = pack.type === "area" && felKm > 0 && (n + 1) % felKm === 0;
      const r = await svaraFacit(pack.type === "area" ? 0 : felKm, fel);
      await sleep(150);
      await knapp(".hr-las");
      await sleep(250);
      const e = await las();
      logg.push(`${e.nr} ${r.fraga}: ${e.feedback?.replace(/\s+/g, " ").slice(0, 80)}`);
      if (e.nasta?.hidden) break;
      await sleep(500); // Nästa tar emot klick efter 450 ms
      await knapp(".hr-nasta");
      await sleep(900);
      const efter = await las();
      if (!efter.prompt || efter.resultat) break;
    }
    await sleep(1500);
    ut = { logg, slut: await las() };
    break;
  }
  default: throw new Error(`okänt kommando ${cmd}`);
}
console.log(JSON.stringify(ut, null, 1));
ws.close();
