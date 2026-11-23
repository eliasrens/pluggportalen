// QA #913: köp en vara genom butikens UI (inloggad, #/elev/shop). Klistras in
// som steg-kropp i mat.mjs (`steg … "$(cat kop.js) return kop('jul-julgran', 'jul')"`).
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
async function kop(id, flik) {
  const tab = document.querySelector(`.shop-tab[data-cat="${flik}"]`);
  if (!tab) return { id, fel: `ingen flik ${flik}`, flikar: [...document.querySelectorAll(".shop-tab")].map((t) => t.dataset.cat) };
  tab.click();
  await vanta(600);
  // Sub-flikarna ritas om vid varje klick: slå upp dem på nytt via data-sub.
  const subIds = [...document.querySelectorAll(".shop-subtab")].map((x) => x.dataset.sub);
  for (const sid of subIds.length ? subIds : [null]) {
    const s = sid && document.querySelector(`.shop-subtab[data-sub="${sid}"]`);
    if (s) { s.click(); await vanta(500); }
    const kort = document.querySelector(`.buy-btn[data-id="${id}"]`);
    if (kort) {
      kort.click();
      await vanta(4000);
      const flash = [...document.querySelectorAll(".flash, .toast, .msg, [role=status]")].map((e) => e.textContent.trim()).filter(Boolean).slice(-2);
      return { id, sub: sid, flash };
    }
    const kopt = [...document.querySelectorAll(".shop-card, .shop-item, article")].find((k) => k.innerHTML.includes(id));
    if (kopt) return { id, sub: sid, knapp: kopt.querySelector(".buy-btn")?.textContent.trim() };
  }
  return { id, fel: "hittades inte i fliken" };
}
