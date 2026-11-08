import { connect, sleep } from "./cdp.mjs";
import { readFileSync } from "node:fs";
const karta = JSON.parse(readFileSync(new URL("./sidor.json", import.meta.url), "utf8"));
const b = await connect(readFileSync(new URL("./dbgport", import.meta.url), "utf8").trim());
const [namn, sek, envFil, sid] = process.argv.slice(2);
const env = Object.fromEntries(readFileSync(envFil, "utf8").trim().split("\n").map((r) => r.split("=")));
const p = await b.attach(karta[namn]);
let n = 0;
await p.send("Fetch.enable", { patterns: [{ urlPattern: "*msAvsluta*", requestStage: "Request" }] });
p.on(async (d) => {
  if (d.method !== "Fetch.requestPaused") return;
  if (d.params.request.method === "OPTIONS") return p.send("Fetch.continueRequest", { requestId: d.params.requestId });
  n++; console.log(new Date().toISOString().slice(11, 19), "msAvsluta från", namn, "nr", n, n === 1 ? "→ FELAS" : "→ släpps");
  if (n === 1) await p.send("Fetch.failRequest", { requestId: d.params.requestId, errorReason: "ConnectionFailed" });
  else await p.send("Fetch.continueRequest", { requestId: d.params.requestId });
});
const t0 = Date.now();
while (Date.now() - t0 < Number(sek) * 1000) {
  await sleep(5000);
  const j = await (await fetch(`http://127.0.0.1:${env.FS}/v1/projects/pluggportalen-so-2026/databases/(default)/documents/liveSessions/${sid}`, { headers: { authorization: "Bearer owner" } })).json();
  const txt = await p.eval(`document.querySelector(".live-elev-end")?.innerText?.replace(/\\n+/g," | ").slice(0,200) || document.querySelector(".mse-klocka")?.textContent`);
  console.log(new Date().toISOString().slice(11, 19), "status", j.fields?.status?.stringValue, "result", !!j.fields?.result, "|", txt);
  if (j.fields?.result && n >= 1) { await sleep(6000); console.log("slut:", await p.eval(`document.querySelector(".live-elev-end")?.innerText?.replace(/\\n+/g," | ")`)); break; }
}
process.exit(0);
