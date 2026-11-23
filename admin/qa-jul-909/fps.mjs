import { startBrowser } from "./cdp.mjs";
const H = "http://c-users-user-909-vinter-jul-c-julen-i-v-rlden-afb5.preview.localhost:37600/preview/preview-jul-909-app.html";
const b = await startBrowser();
const mat = `new Promise(res=>{let n=0;const t0=performance.now();const f=()=>{n++; if(performance.now()-t0<6000) requestAnimationFrame(f); else res(+(n*1000/(performance.now()-t0)).toFixed(1));};requestAnimationFrame(f);})`;
const fall = [["host jul=0", "?sasong=host&jul=0"], ["vinter jul=0", "?sasong=vinter&jul=0"], ["vinter jul=1", "?sasong=vinter&jul=1"], ["sommar jul=1", "?sasong=sommar&jul=1"]];
const res = {};
for (let runda = 0; runda < 3; runda++) for (const [nm, q] of fall) for (const route of ["#/elev/by", "&ut#/"]) {
  await b.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const [qs, h] = route.split("#");
  await b.goto(H + q + qs + "#" + h, 5000);
  await b.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await new Promise(r => setTimeout(r, 1000));
  const fps = await b.eval(mat);
  (res[nm + " " + h] ||= []).push(fps);
}
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(22), v.join(" / "), " median", v.sort((a,b)=>a-b)[1]);
b.close();
