import { startBrowser } from "./cdp.mjs";
const S = process.argv[2];
const H = "http://c-users-user-909-vinter-jul-c-julen-i-v-rlden-afb5.preview.localhost:37600/preview/preview-jul-909-app.html";
const b = await startBrowser();
const lum = `const lum=(c)=>{const m=c.match(/[\\d.]+/g).map(Number);const [r,g,bb]=m.slice(0,3).map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*r+0.7152*g+0.0722*bb};const cr=(a,c)=>{const x=lum(a),y=lum(c);return +((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2)};`;
// faslogg: räkna attributändringar data-julv-fas under 7 s
const fasLogg = `new Promise(res=>{let n=0;const mo=new MutationObserver(l=>{n+=l.length});mo.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-julv-fas']});setTimeout(()=>{mo.disconnect();res(n)},7000)})`;
const stat = `JSON.stringify({rm:matchMedia('(prefers-reduced-motion: reduce)').matches, jul:document.documentElement.dataset.jul||'-', cssAnim:document.getAnimations().filter(a=>a.effect?.target?.closest?.('.julv-blink')).length, hus:document.querySelectorAll('.julv-hus').length, fasRot:[...document.querySelectorAll('[data-julv-fas]')].length, blinkOp:[...new Set([...document.querySelectorAll('.julv-blink')].map(e=>getComputedStyle(e).opacity))]})`;
for (const rm of ["no-preference", "reduce"]) {
  await b.media([{ name: "prefers-reduced-motion", value: rm }]);
  for (const r of ["?sasong=vinter&jul=1#/elev/by", "?sasong=vinter&jul=1&ut#/", "?sasong=sommar&jul=1#/elev/rum"]) {
    await b.goto(H + r, 5000);
    console.log(rm, r, await b.eval(stat), "fasbyten/7s:", await b.eval(fasLogg));
  }
}
await b.media([{ name: "prefers-reduced-motion", value: "no-preference" }]);
// Jul av live → fasbyten stoppar; på igen → igång
await b.goto(H + "?sasong=vinter&jul=1#/elev/by", 5000);
await b.eval(`import('/src/season-world.js').then(m=>{m.applyTheme({season:'vinter',julActive:false});return 1})`);
console.log("jul av live:", await b.eval(stat), "synliga:", await b.eval(`[...document.querySelectorAll('.julv-dekor')].filter(e=>e.getBoundingClientRect().width>0).length`), "fasbyten/7s:", await b.eval(fasLogg));
await b.eval(`import('/src/season-world.js').then(m=>{m.applyTheme({season:'vinter',julActive:true});return 1})`);
await new Promise(r=>setTimeout(r,3000));
console.log("jul på igen:", await b.eval(stat), "synliga:", await b.eval(`[...document.querySelectorAll('.julv-dekor')].filter(e=>e.getBoundingClientRect().width>0).length`), "fasbyten/7s:", await b.eval(fasLogg));
// lämna världen (till Plugga) → inga fasbyten på något i DOM, inga kvarhängande noder
location: {
  await b.eval(`location.hash='#/elev/plugga'`); await new Promise(r=>setTimeout(r,3000));
  console.log("plugga:", await b.eval(`JSON.stringify({julvIDom:document.querySelectorAll('.julv-dekor').length, fasRot:document.querySelectorAll('[data-julv-fas]').length})`), "fasbyten/7s:", await b.eval(fasLogg));
  // fram och tillbaka 5 ggr → inga dubbletter
  for (let i=0;i<5;i++){ await b.eval(`location.hash='#/elev/by'`); await new Promise(r=>setTimeout(r,2500)); await b.eval(`location.hash='#/elev/plugga'`); await new Promise(r=>setTimeout(r,1000)); }
  await b.eval(`location.hash='#/elev/by'`); await new Promise(r=>setTimeout(r,4000));
  console.log("efter 5 varv:", await b.eval(`JSON.stringify({hus:document.querySelectorAll('.julv-hus').length, dublett:[...document.querySelectorAll('.by-tomt > svg, #husgrupp')].filter(s=>s.querySelectorAll(':scope > .julv-hus').length>1).length})`));
}
// F1 kontrast Tillbaka
await b.goto(H + "?sasong=vinter&jul=1&ut#/larare", 4000);
console.log("F1", await b.eval(`(()=>{${lum} const t=[...document.querySelectorAll('a,button')].find(e=>/Tillbaka/.test(e.textContent)); const c=getComputedStyle(t).color; return JSON.stringify({c, vsTopp:cr(c,'rgb(44, 59, 116)'), vsBotten:cr(c,'rgb(24, 35, 76)')})})()`));
// F4 Halloween+Jul: tomten dold på port och spärr
for (const r of ["?sasong=host&jul=1&halloween=1&ut#/", "?sasong=host&jul=1&halloween=1&ut#/larare", "?sasong=vinter&jul=1&ut#/"]) {
  await b.goto(H + r, 5000);
  await b.shot(`${S}/shots/r1${r.replace(/\W+/g,"_")}.png`);
  console.log("F4", r, await b.eval(`JSON.stringify({tomteSynlig:[...document.querySelectorAll('.julv-tomte')].filter(e=>e.getBoundingClientRect().width>0).length, tomteTotal:document.querySelectorAll('.julv-tomte').length})`));
}
console.log("konsolfel:", JSON.stringify(b.logs)); b.close();
