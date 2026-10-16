// QA #743: fyller i elevens provsida som en användare (klick/inmatning) – laddas i webbläsaren med
// await import("/admin/qa-prov-svara.js") och anropas window.__svara({ f2: 0, f3: [0, 1], f5: "Birka", … }).
window.__svara = async function (spec) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sek = (id) => document.querySelector(`[data-fraga="${id}"]`);
  const setText = (el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); el.blur(); el.dispatchEvent(new Event("focusout", { bubbles: true })); };
  for (const [id, v] of Object.entries(spec)) {
    const s = sek(id); if (!s) continue;
    const radios = [...s.querySelectorAll('input[type=radio]')], checks = [...s.querySelectorAll('input[type=checkbox]')];
    const texts = [...s.querySelectorAll('input[type=text], textarea')], sels = [...s.querySelectorAll('select')];
    if (radios.length) radios[v].click();
    else if (checks.length) { checks.forEach((c, i) => { if (c.checked !== v.includes(i)) c.click(); }); }
    else if (sels.length) sels.forEach((el, i) => { el.value = v[i] ?? ""; el.dispatchEvent(new Event("change", { bubbles: true })); });
    else if (s.querySelector('.provv-ordna')) {
      for (let guard = 0; guard < 30; guard++) {
        const now = [...s.querySelectorAll('.provv-ordna-text')].map((x) => x.textContent);
        const i = now.findIndex((t, k) => t !== v[k]); if (i < 0) break;
        const j = now.indexOf(v[i]); s.querySelector(`[data-pil="upp-${j}"]`).click(); await sleep(30);
      }
      const behall = [...s.querySelectorAll('button')].find((b) => /Behåll/.test(b.textContent)); if (behall && !behall.disabled && behall.offsetParent) behall.click();
    } else if (texts.length) { (Array.isArray(v) ? v : [v]).forEach((x, i) => texts[i] && setText(texts[i], x)); }
    await sleep(40);
  }
  return document.querySelector('.provv-sparstatus, [class*=spar]')?.textContent;
};
