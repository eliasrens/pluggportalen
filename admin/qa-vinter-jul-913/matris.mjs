// ============================================================================
// QA 24 (#913): snö på ALLA husskal, även Halloween- och julhusen (de senare
// registreras lazy, så preview-vinter-908.html?vy=matris visar dem inte själv).
// Laddar matrisen, registrerar julkonsten, ritar om matrisen med samma kod och
// tar en helsidesbild.
//   node admin/qa-vinter-jul-913/matris.mjs <origin> <ut.png|ut.jpg> [vinter|sommar]
// ============================================================================
import { writeFileSync } from "node:fs";
import { startaChromium, sov } from "./cdp.mjs";

const [origin, ut, sasong = "vinter"] = process.argv.slice(2);
const b = await startaChromium({ w: 1366, h: 768 });
try {
  await b.goto(`${origin}/preview/preview-vinter-908.html?vy=matris&ren=1&sasong=${sasong}`);
  await b.vanta("document.querySelectorAll('.pv-ruta').length > 10");
  const n = await b.eval(`(async () => {
    const { registreraJulKonst } = await import("/src/jul/jul-konst.js");
    await registreraJulKonst();
    const { listHusSkal, husMini } = await import("/src/art-hus-ute.js");
    const { getPalette, ROOM_PALETTES } = await import("/src/room-palettes.js");
    const pal = Object.keys(ROOM_PALETTES);
    const lista = listHusSkal();
    document.querySelector(".pv-matris").innerHTML = lista.map((s, i) => {
      const p = getPalette(pal[i % pal.length]);
      return '<div class="pv-ruta" style="--hus-house:' + p.house + ';--hus-roof:' + p.roof + ';--hus-wall:' + p.wall +
        ';--hus-wall2:' + p.wall2 + '">' + husMini({ skalId: s.id }) + '<div>' + s.id + '</div></div>';
    }).join("");
    return lista.map((s) => s.id);
  })()`);
  await sov(12000); // snön rastreras i rutor (#908)
  const info = await b.eval(`({ rutor: document.querySelectorAll('.pv-ruta').length,
    snoBilder: document.querySelectorAll('.pv-ruta image').length,
    utanSno: [...document.querySelectorAll('.pv-ruta')].filter((r) => !r.querySelector('image, .sz-bara-vinter')).map((r) => r.textContent.trim()) })`);
  // Hela matrisen i en bild: gör fönstret så högt som matrisen.
  const h = Math.ceil(await b.eval("(() => { const m = document.querySelector('.pv-matris'); m.style.height = 'auto'; m.style.overflow = 'visible'; return m.getBoundingClientRect().top + m.scrollHeight + 10; })()"));
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1366, height: h, deviceScaleFactor: 1, mobile: false });
  await sov(3000);
  writeFileSync(ut, await b.bild({ jpg: ut.endsWith(".jpg") }));
  console.log(JSON.stringify({ hus: n.length, jul: n.filter((x) => x.startsWith("jul-")), hw: n.filter((x) => x.startsWith("hw-")), ...info }));
} finally {
  await b.stang();
}
