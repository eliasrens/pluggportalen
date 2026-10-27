// node do.mjs <namn> <js>  |  node do.mjs ny <namn> <url> [w h mobil]  |  node do.mjs lista  |  node do.mjs bild <namn> <fil>
import { connect } from "./cdp.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const KF = new URL("./sidor.json", import.meta.url);
const karta = existsSync(KF) ? JSON.parse(readFileSync(KF, "utf8")) : {};
const DBG = readFileSync(new URL("./dbgport", import.meta.url), "utf8").trim();
const b = await connect(DBG);
const [cmd, ...a] = process.argv.slice(2);
async function hitta(namn) {
  if (karta[namn]) return b.attach(karta[namn]);
  throw new Error("ingen sida " + namn);
}
try {
  if (cmd === "lista") { const ids = Object.fromEntries(Object.entries(karta).map(([k, v]) => [v, k])); for (const t of await b.pages()) console.log(ids[t.targetId] || "-", t.url); }
  else if (cmd === "ny") {
    const [namn, url, w = 1600, h = 900, mob] = a;
    const p = await b.newPage("about:blank", { w: +w, h: +h, mobile: mob === "1" });
    karta[namn] = p.targetId; writeFileSync(KF, JSON.stringify(karta)); await p.goto(url); console.log("ok", namn);
  } else if (cmd === "bild") { const p = await hitta(a[0]); await p.shot(a[1]); console.log("ok"); }
  else { const p = await hitta(cmd); const v = await p.eval(a.join(" ")); console.log(typeof v === "string" ? v : JSON.stringify(v, null, 1)); }
} catch (e) { console.log("FEL", e.message); }
process.exit(0);
