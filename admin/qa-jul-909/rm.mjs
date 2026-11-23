import { startBrowser } from "./cdp.mjs";
const S = process.argv[2];
const H = "http://c-users-user-909-vinter-jul-c-julen-i-v-rlden-afb5.preview.localhost:37600/preview/preview-jul-909-app.html";
const b = await startBrowser();
const info = `JSON.stringify({rm: matchMedia('(prefers-reduced-motion: reduce)').matches, julAnim: document.getAnimations().filter(a=>a.effect?.target?.closest?.('.julv-dekor')).length, blinkAnimName: [...new Set([...document.querySelectorAll('.julv-blink,.julv-vinkarm')].map(e=>getComputedStyle(e).animationName))], dekor: document.querySelectorAll('.julv-dekor').length})`;
for (const rm of ["reduce", "no-preference"]) {
  await b.media([{ name: "prefers-reduced-motion", value: rm }]);
  for (const r of ["?sasong=vinter&jul=1#/elev/by", "?sasong=vinter&jul=1#/elev/gard", "?sasong=vinter&jul=1&ut#/", "?sasong=vinter&jul=1&ut#/larare"]) {
    await b.goto(H + r, 4500);
    console.log(rm, r, await b.eval(info));
  }
}
// live av/på via applyTheme (samma modulinstans som appen)
for (const r of ["?sasong=vinter&jul=1#/elev/by", "?sasong=sommar&jul=1&ut#/", "?sasong=sommar&jul=1&ut#/larare"]) {
  await b.goto(H + r, 4500);
  const vis = `[...document.querySelectorAll('.julv-dekor')].filter(e=>e.getBoundingClientRect().width>0).length + '/' + document.querySelectorAll('.julv-dekor').length + ' sol:' + [...document.querySelectorAll('.port-scen .sz-dolj-halloween')].filter(e=>e.getBoundingClientRect().width>0).length + ' bodybg:' + getComputedStyle(document.body).backgroundImage.slice(0,60)`;
  const s0 = await b.eval(vis);
  await b.eval(`import('/src/season-world.js').then(m=>{m.applyTheme({season:'${r.includes("vinter")?"vinter":"sommar"}', julActive:false}); return 1})`);
  await new Promise(r=>setTimeout(r,1500));
  const s1 = await b.eval(vis);
  await b.shot(`${S}/shots/liveav${r.replace(/\W+/g,"_")}.png`);
  await b.eval(`import('/src/season-world.js').then(m=>{m.applyTheme({season:'${r.includes("vinter")?"vinter":"sommar"}', julActive:true}); return 1})`);
  await new Promise(r=>setTimeout(r,2500));
  const s2 = await b.eval(vis);
  console.log("live", r, "på:", s0, "| av:", s1, "| på igen:", s2);
}
// mobil 375
await b.size(375, 740);
for (const r of ["?sasong=vinter&jul=1&ut#/", "?sasong=vinter&jul=1&ut#/larare", "?sasong=vinter&jul=1#/elev/by", "?sasong=vinter&jul=1#/elev/hus"]) {
  await b.goto(H + r, 4500);
  const nm = r.replace(/\W+/g, "_");
  await b.shot(`${S}/shots/m375${nm}.png`);
  console.log("375", r, await b.eval(`JSON.stringify({sw: document.documentElement.scrollWidth, iw: innerWidth})`));
}
console.log(b.logs.join("\n")); b.close();
