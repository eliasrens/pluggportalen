// Schack-QA (#777) steg "layout": mobil 320/360 px, surfplatta och Chromebook-bredd.
// Brädet ≥ 320 px, alla 64 rutor på egen plats inne i brädet, ingen sidledsskroll (mobil-
// emulering breddar layouten i stället för att skrolla, så den jämförs med skärmbredden),
// varningsrutan synlig utan att skrolla och brädet orört medan den visas.
const vila = (ms) => new Promise((r) => setTimeout(r, ms));
const SKARMAR = [
  { namn: "mobil-320", w: 320, h: 640, mobil: true },
  { namn: "mobil-360", w: 360, h: 740, mobil: true },
  { namn: "surfplatta-768", w: 768, h: 1024, mobil: true },
  { namn: "surfplatta-1024", w: 1024, h: 768, mobil: true },
  { namn: "chromebook-1366", w: 1366, h: 768, mobil: false },
];

const matt = (p, w) => p.ev(`(() => {
  const ram = document.querySelector(".schack-ram").getBoundingClientRect();
  const rutor = [...document.querySelectorAll(".schack-bradet [data-ruta]")].map(e => e.getBoundingClientRect());
  const inne = rutor.every(r => r.left >= ram.left - 1 && r.right <= ram.right + 1 && r.top >= ram.top - 1 && r.bottom <= ram.bottom + 1);
  const platser = new Set(rutor.map(r => Math.round(r.left) + "," + Math.round(r.top))).size;
  const fixerade = [...document.querySelectorAll(".schack-bradet [data-ruta]")].filter(e => getComputedStyle(e).position === "fixed").length;
  return { bredd: Math.round(ram.width), inne, platser, fixerade, sidled: Math.max(document.documentElement.scrollWidth, innerWidth) - ${w} };
})()`);

export default async function layout({ p, e, ok, skarm }) {
  await e.startaParti("bonden", "w");
  for (const s of SKARMAR) {
    await p.s("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: 2, mobile: s.mobil });
    await p.s("Emulation.setTouchEmulationEnabled", { enabled: s.mobil, maxTouchPoints: s.mobil ? 5 : 1 });
    e.anvandFinger(s.mobil);
    await e.oppna("#/elev/schack");
    await p.vanta(`!!document.querySelector(".schack-kort")`, 20000);
    await vila(300);
    ok(`${s.namn}: startsidan utan sidledsskroll`, (await p.ev(`Math.max(document.documentElement.scrollWidth, innerWidth) - ${s.w}`)) <= 0);
    if (s.w <= 360) await skarm(`layout-${s.namn}-start`);
    await e.injicera(["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6"], { niva: "bonden" }); // vit: Dxf7# finns, Varna mig på
    const m = await matt(p, s.w);
    ok(`${s.namn}: brädet ≥ 320 px`, m.bredd >= 320, `${m.bredd} px`);
    ok(`${s.namn}: alla 64 rutor på egen plats inne i brädet`, m.inne && m.platser === 64 && m.fixerade === 0, JSON.stringify(m));
    ok(`${s.namn}: ingen sidledsskroll`, m.sidled <= 0, `${m.sidled} px`);
    await skarm(`layout-${s.namn}-parti`);
    // Varningsrutan: damen till f7?? nej – Dxf7# är matt; ställ damen där den kan tas: Dh5–h6 (g7xh6).
    await e.tryck("h5");
    await e.tryck("h6");
    await p.vanta(`!document.querySelector(".schack-varna-ruta").hidden`, 3000).catch(() => {});
    const v = await p.ev(`(() => { const r = document.querySelector(".schack-varna-ruta"); const b = r.getBoundingClientRect();
      return { synlig: !r.hidden, inom: b.top >= 0 && b.bottom <= innerHeight + 1 && b.left >= 0 && b.right <= innerWidth + 1 }; })()`);
    const m2 = await matt(p, s.w);
    ok(`${s.namn}: varningsrutan syns utan att skrolla`, v.synlig && v.inom, JSON.stringify(v));
    ok(`${s.namn}: brädet orört medan varningen visas`, m2.inne && m2.platser === 64 && m2.fixerade === 0, JSON.stringify(m2));
    await skarm(`layout-${s.namn}-varning`);
    await e.klick(`[data-act="varna-angra"]`);
  }
  await p.s("Emulation.setTouchEmulationEnabled", { enabled: false });
  e.anvandFinger(false);
}
