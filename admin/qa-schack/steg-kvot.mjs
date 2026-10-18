// Schack-QA (#777) steg "kvot": Firestore-läsningar/-skrivningar under ett parti mot datorn.
// Kräver att proxyn kör med QA_RAKNA=1 (admin/qa-emulator-proxy.mjs räknar per port –
// kör inget annat mot samma port under tiden). Etapp 1 ska ge 0/0: partiet ligger i localStorage.
const vila = (ms) => new Promise((r) => setTimeout(r, ms));
const rakna = (p, nolla = false) => p.ev(`fetch("/__qa/rakna${nolla ? "?nollstall" : ""}").then((r) => r.json())`);

export default async function kvot({ p, e, ok }) {
  await e.oppna("#/elev/schack");
  await p.vanta(`!!document.querySelector(".schack-kort")`, 20000);
  await vila(3000); // låt sidans egna lyssnare (klass, elevdata, Live) leverera klart
  const fore = await rakna(p, true);
  if (fore.summaLasningar === undefined) return ok("proxyn räknar (QA_RAKNA=1)", false, JSON.stringify(fore).slice(0, 80));
  await rakna(p, true);
  // Nivåval → parti → 6 elevdrag, Ångra, Tips, Ge upp → startsidan → nytt parti.
  await e.startaParti("springaren", "w");
  for (let i = 0; i < 6; i++) {
    const n = (await e.parti()).drag.length;
    await e.elevDrag();
    if ((await e.parti()).slut) break;
    await e.vantaDrag(n + 2);
  }
  await e.klick(`[data-act="angra"]`);
  await e.klick(`[data-act="tips"]`);
  await p.vanta(`/Tips:/.test(document.querySelector(".schack-tips-text").textContent)`, 8000);
  await e.klick(`[data-act="geupp"]`);
  await e.klick(`[data-act="geupp-ja"]`);
  await p.ev(`location.hash = "#/elev/schack"`);
  await p.vanta(`!!document.querySelector(".schack-kort")`);
  await e.startaParti("damen", "b");
  await e.vantaDrag(1);
  await vila(1500);
  const r = await rakna(p);
  ok(`ett parti mot datorn: ${r.summaLasningar} läsningar, ${r.summaSkrivningar} skrivningar i Firestore`,
    r.summaLasningar === 0 && r.summaSkrivningar === 0, JSON.stringify({ las: r.lasningar, skriv: r.skrivningar }));
}
