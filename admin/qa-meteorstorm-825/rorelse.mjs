// prefers-reduced-motion + blinkning: förhandsvisningarna med/utan reducerad rörelse.
import { startChrome, connect, sleep } from "./cdp.mjs";
import { spawn } from "node:child_process";
const port = 20000 + Math.floor(Math.random() * 20000), dbg = port + 1;
const srv = spawn("node", ["server.mjs"], { cwd: process.env.REPO, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
const ch = await startChrome({ port: dbg, dir: `/tmp/rorelse-${dbg}` });
const b = await connect(dbg);
const SIDOR = [["projektor", "preview-meteorstorm-demo.html?fas=storm&sek=560&panel=av&ratt=0.45,0.3", 1600, 900], ["elev-live", "preview-meteorstorm-elev.html?fas=live", 375, 812, true], ["elev-lobby", "preview-meteorstorm-elev.html", 375, 812, true]];
const ut = [];
for (const [namn, url, w, h, mob] of SIDOR) for (const red of [false, true]) {
  const p = await b.newPage("about:blank", { w, h, mobile: !!mob });
  if (red) await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await p.goto(`http://127.0.0.1:${port}/preview/${url}`);
  await sleep(4500);
  const r = await p.eval(`(async () => {
    const anim = document.getAnimations().filter(a => a.playState === "running");
    // Blinkning: ljusaste pixelns andel vita (>245) pixlar i canvas över 1 s, 20 prov
    const c = document.querySelector("canvas"); let vitMax = null, hopp = 0;
    if (c) { const g = document.createElement("canvas"); g.width = 160; g.height = 90; const x = g.getContext("2d"); let forra = null; vitMax = 0;
      for (let i = 0; i < 20; i++) { x.drawImage(c, 0, 0, 160, 90); const d = x.getImageData(0, 0, 160, 90).data; let vit = 0, lum = 0;
        for (let j = 0; j < d.length; j += 4) { const l = (d[j] + d[j+1] + d[j+2]) / 3; lum += l; if (l > 245) vit++; }
        vitMax = Math.max(vitMax, vit / (d.length / 4)); lum /= d.length / 4; if (forra != null && Math.abs(lum - forra) > 20) hopp++; forra = lum;
        await new Promise(r => setTimeout(r, 50)); } }
    return { anim: anim.length, animNamn: [...new Set(anim.map(a => (a.animationName || a.transitionProperty || a.constructor.name) + "@" + (a.effect?.target?.className?.baseVal ?? a.effect?.target?.className ?? "") + " " + (a.effect?.getTiming?.().duration)))].slice(0, 6), vitAndelMax: vitMax == null ? null : +vitMax.toFixed(4), ljusHopp: hopp, sw: document.documentElement.scrollWidth };
  })()`);
  ut.push({ namn, reducerad: red, ...r, konsol: p.konsol.slice(0, 3) });
  await p.close();
}
console.log(JSON.stringify(ut, null, 1));
process.kill(-ch.pid); srv.kill(); process.exit(0);
