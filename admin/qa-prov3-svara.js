// QA #766: fyller i elevens provsida (Etapp 3-rutorna) som en användare – laddas i webbläsaren med
// await import("/admin/qa-prov3-svara.js?v=" + Date.now()) och anropas
//   window.__svara3({ f2: 0, f3: [0, 1], f5: "Birka", f7: ["A", "B", "C"], f8: { Tor: "åska" } })
// Flerval/sant-falskt = index, flera rätt = lista med index, kortsvar/fritext = text,
// lucktext = lista med texter, ordna = sakerna i den ordning eleven trycker dem (ett tryck
// per sak i "Kvar"), para = { begrepp: förklaring } (två tryck per par).
// Returnerar { tryck: { frågeId: antal }, status } – antalet riktiga klick per ordna/para-fråga.
window.__svara3 = async function (spec) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sek = (id) => document.querySelector(`[data-fraga="${id}"]`);
  const setText = (el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); el.blur(); el.dispatchEvent(new Event("focusout", { bubbles: true })); };
  const tryck = {};
  for (const [id, v] of Object.entries(spec)) {
    const s = sek(id); if (!s) continue;
    tryck[id] = 0;
    const klick = async (el) => { el.click(); tryck[id]++; await sleep(30); };
    if (s.querySelector(".provv-ordna")) {
      for (const sak of v) {
        const b = [...s.querySelectorAll(".provv-ordna-kvar .provv-ordna-sak")].find((x) => x.textContent === sak);
        if (b) await klick(b);
      }
      continue;
    }
    if (s.querySelector(".provv-para")) {
      const [vKol, hKol] = s.querySelectorAll(".provv-para-kol");
      for (const [begrepp, forkl] of Object.entries(v)) {
        const bv = [...vKol.children].find((x) => x.querySelector(".provv-para-text")?.textContent === begrepp);
        if (bv) await klick(bv);
        const bh = [...hKol.children].find((x) => x.querySelector(".provv-para-text")?.textContent === forkl);
        if (bh) await klick(bh);
      }
      continue;
    }
    const radios = [...s.querySelectorAll("input[type=radio]")], checks = [...s.querySelectorAll("input[type=checkbox]")];
    const texts = [...s.querySelectorAll("input[type=text], textarea")];
    if (radios.length) radios[v].click();
    else if (checks.length) checks.forEach((c, i) => { if (c.checked !== v.includes(i)) c.click(); });
    else if (texts.length) (Array.isArray(v) ? v : [v]).forEach((x, i) => texts[i] && setText(texts[i], x));
    delete tryck[id];
    await sleep(40);
  }
  return { tryck, status: document.querySelector(".provv-sparstatus, [class*=spar]")?.textContent };
};
