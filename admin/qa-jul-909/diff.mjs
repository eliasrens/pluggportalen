import { startBrowser, pixDiff } from "./cdp.mjs";
const S = process.argv[2];
const H = "http://c-users-user-909-vinter-jul-c-julen-i-v-rlden-afb5.preview.localhost:37600/preview/preview-jul-909-app.html";
const B = "http://c-users-user-909-vinter-jul-c-julen-i-v-rlden-afb5--port-8919.preview.localhost:37600/preview/preview-jul-909-app.html";
const SC = [["by", "#/elev/by"], ["hus", "#/elev/hus"], ["gard", "#/elev/gard"], ["rum", "#/elev/rum"], ["port", "&ut#/"], ["gate", "&ut#/larare"]];
const b = await startBrowser();
await b.media([{ name: "prefers-reduced-motion", value: "reduce" }]);
await b.send("Animation.enable");
const sas = (process.argv[3] || "sommar,host,bort").split(",");
const halo = process.argv[4] || "";
const frys = `document.getAnimations().forEach(a=>{try{a.pause();a.currentTime=0}catch{}})`;
const ta = async (url) => { await b.goto(url, 4500); await b.eval(frys); await new Promise(r=>setTimeout(r,300)); return b.shot(); };
for (const s of sas) for (const [nm, r] of SC) {
  const [qs, h] = r.split("#");
  const q = `?sasong=${s}&jul=0${halo}${qs}#${h}`;
  const a = await ta(B + q), c = await ta(H + q);
  const a2 = await ta(B + q); // bas mot bas = brus
  const d = await pixDiff(b, a, c), n = await pixDiff(b, a, a2);
  console.log(s + halo, nm, "bas-vs-head", JSON.stringify(d), "bas-vs-bas", JSON.stringify(n),
    "julv:", await b.eval(`document.querySelectorAll('.julv-dekor').length + '/' + (document.documentElement.dataset.jul||'-') + '/jul-modul:' + performance.getEntriesByType('resource').filter(e=>/\\/jul\\//.test(e.name)).length`));
}
console.log(b.logs.join("\n")); b.close();
