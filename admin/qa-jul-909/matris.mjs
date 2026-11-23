import { startBrowser } from "./cdp.mjs";
const S = process.argv[2];
const H = "http://c-users-user-909-vinter-jul-c-julen-i-v-rlden-afb5.preview.localhost:37600/preview/preview-jul-909-app.html";
const SC0 = [["by", "#/elev/by"], ["hus", "#/elev/hus"], ["gard", "#/elev/gard"], ["rum", "#/elev/rum"], ["port", "&ut#/"], ["gate", "&ut#/larare"]];
const ONLY=(process.argv[5]||"").split(",").filter(Boolean); const SC = SC0.filter(([n])=>!ONLY.length||ONLY.includes(n));
const b = await startBrowser();
const sas = (process.argv[3] || "vinter,sommar,host").split(",");
const extra = process.argv[4] || "";
for (const s of sas) for (const [nm, r] of SC) {
  const [qs, h] = r.split("#");
  await b.goto(`${H}?sasong=${s}&jul=1${extra}${qs}#${h}`, 4500);
  await b.shot(`${S}/shots/${s}${extra.replace(/[&=]/g, "")}-${nm}.png`);
  console.log(s, nm, await b.eval(`JSON.stringify({jul:document.documentElement.dataset.jul, dekor:document.querySelectorAll('.julv-dekor').length, synliga:[...document.querySelectorAll('.julv-dekor')].filter(e=>e.getBoundingClientRect().width>0).length, cls:[...new Set([...document.querySelectorAll('.julv-dekor')].map(e=>[...e.classList].filter(c=>c!=='julv-dekor'&&c!=='by-dekor').join('.')))].join(','), hash:location.hash})`));
}
// skolan
await b.goto(`${H}?sasong=vinter&jul=1${extra}#/elev/by`, 3500);
console.log("andra byar:", await b.eval(`(()=>{const e=[...document.querySelectorAll('button,a,[role=button],div,g')].find(x=>/Andra byar/.test(x.textContent)&&x.children.length<6); if(!e) return 'saknas'; e.click(); return e.tagName+' '+e.className})()`));
await new Promise((r) => setTimeout(r, 3500));
await b.shot(`${S}/shots/vinter${extra.replace(/[&=]/g, "")}-skola.png`);
console.log("skola", await b.eval(`JSON.stringify({bock:document.querySelectorAll('.julv-skola-bock').length, mark:document.querySelectorAll('.omrade-mark').length, hash:location.hash})`));
console.log(b.logs.join("\n")); b.close();
