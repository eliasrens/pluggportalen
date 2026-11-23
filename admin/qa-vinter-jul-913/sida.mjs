// ============================================================================
// QA #913: öppna en förhandsvisningssida, samla konsolfel och undantag, kör ett
// valfritt uttryck (räkna celler/platshållare) och ta en helsidesbild.
//   node admin/qa-vinter-jul-913/sida.mjs <url> <ut.png|ut.jpg> [uttryck] [vänta-ms=8000]
// ============================================================================
import { writeFileSync } from "node:fs";
import { startaChromium, sov } from "./cdp.mjs";

const [url, ut, uttryck = "null", vanta = "8000"] = process.argv.slice(2);
const b = await startaChromium({ w: 1366, h: 768 });
const fel = [];
b.on((m) => {
  if (m.method === "Runtime.exceptionThrown") fel.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") fel.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
});
try {
  await b.goto(url);
  await sov(Number(vanta));
  const info = await b.eval(uttryck);
  const h = Math.ceil(await b.eval("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)"));
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1366, height: Math.min(h, 12000), deviceScaleFactor: 1, mobile: false });
  await sov(2500);
  writeFileSync(ut, await b.bild({ jpg: ut.endsWith(".jpg") }));
  console.log(JSON.stringify({ url: url.replace(/^https?:\/\/[^/]+/, ""), info, konsolfel: fel }));
} finally {
  await b.stang();
}
