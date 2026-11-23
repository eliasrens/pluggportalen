import { startBrowser } from "./cdp.mjs";
const H = "http://c-users-user-909-vinter-jul-c-julen-i-v-rlden-afb5.preview.localhost:37600/preview/preview-jul-909-app.html";
const b = await startBrowser();
for (const r of ["#/elev/plugga", "#/elev/lasresan", "#/elev/profil", "#/elev/shop", "#/elev/by", "#/elev/hus", "#/elev/gard", "#/elev/rum"]) {
  b.logs.length = 0;
  await b.goto(H + "?sasong=vinter&jul=1" + r, 4500);
  console.log(r, await b.eval(`JSON.stringify({hash:location.hash, synligaJul:[...document.querySelectorAll('.julv-dekor')].filter(e=>{const x=e.getBoundingClientRect();return x.width>0&&x.bottom>0&&x.top<innerHeight&&x.right>0&&x.left<innerWidth}).length})`), "fel:", JSON.stringify(b.logs));
}
// klick genom dekoren: by-husets tak med slinga → klick når tomten?
await b.goto(H + "?sasong=vinter&jul=1#/elev/by", 5000);
console.log("klick", await b.eval(`(()=>{const out=[];for(const s of [...document.querySelectorAll('.julv-slinga circle, .julv-advent *, .julv-by-gran svg *')].slice(0,400).filter((_,i)=>i%7==0)){const r=s.getBoundingClientRect(); if(!r.width) continue; const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); if(e&&e.closest('.julv-dekor')) out.push(e.tagName+'.'+(e.getAttribute('class')||''));} return JSON.stringify({traffJul: out.length, ex: out.slice(0,3)});})()`));
// första bilden: julklass på html innan konsten
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__t=[];new MutationObserver(()=>{const d=document.documentElement; if(d.dataset.jul&&!window.__t.jul) window.__t.jul=performance.now(); if(document.querySelector('.julv-port-bak')&&!window.__t.art) window.__t.art=performance.now(); if(document.querySelector('svg[aria-label="Porten till Pluggporten"]')&&!window.__t.port) window.__t.port=performance.now();}).observe(document,{subtree:true,childList:true,attributes:true});` });
await b.goto(H + "?sasong=sommar&jul=1&ut#/", 4000);
console.log("port-tider ms", await b.eval(`JSON.stringify(window.__t)`));
b.close();
