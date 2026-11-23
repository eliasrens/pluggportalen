import { startBrowser } from "./cdp.mjs";
const H = "http://c-users-user-909-vinter-jul-c-julen-i-v-rlden-afb5.preview.localhost:37600/preview/preview-jul-909-app.html";
for (const [dpr, jul, rm] of [[1,1,0],[1,0,0],[2,1,0],[2,0,0],[1,1,1],[2,1,1]]) for (let k = 0; k < 2; k++) {
  const b = await startBrowser(); // ny webbläsare varje gång = kall cache
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__lt.push([Math.round(e.startTime),Math.round(e.duration)]);}).observe({type:'longtask',buffered:true});` });
  if (rm) await b.media([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: dpr, mobile: false });
  await b.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await b.goto(H + `?sasong=vinter&jul=${jul}#/elev/by`, 20000);
  console.log(`dpr${dpr} jul=${jul} rm=${rm}`, await b.eval(`(()=>{const L=__lt; const f=L.filter(x=>x[0]<8000), s=L.filter(x=>x[0]>=8000); return JSON.stringify({laddMax:Math.max(0,...f.map(x=>x[1])), laddSum:f.reduce((a,x)=>a+x[1],0), efterMax:Math.max(0,...s.map(x=>x[1])), efterN:s.length, efterSum:s.reduce((a,x)=>a+x[1],0)})})()`));
  b.close();
}
