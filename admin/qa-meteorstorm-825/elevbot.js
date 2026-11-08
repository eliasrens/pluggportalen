// Injiceras i en RIKTIG elevsida (#/elev/live?id=…): går med, svarar i UI:t
// (skriv själv: skriver produkten i .fa-input och skickar formuläret; flerval:
// klickar alternativet) och väljer handling med knapparna. Loggar allt i
// window.__qa. Parametrar i window.__qaOpt = { p, takt, drag, laser }.
(() => {
  if (window.__qa) return;
  const o = Object.assign({ p: 0.7, takt: 6000, drag: 0.2, laser: 0.5 }, window.__qaOpt || {});
  const qa = window.__qa = { ratt: 0, fel: 0, val: {}, kvitton: [], felrader: [], banderoller: new Set(), fast: 0, sistaSvar: Date.now(), joined: false, placeringar: [], vantaMax: 0, vantaFran: 0, logg: [] };
  const $ = (s) => document.querySelector(s);
  const synlig = (e) => e && !e.hidden && e.offsetParent !== null;
  let nasta = Date.now() + Math.random() * o.takt;
  let rng = Math.random;
  setInterval(() => {
    try {
      const join = $(".live-elev-join");
      if (synlig(join) && !qa.joined) { join.click(); qa.joined = true; qa.logg.push("join " + new Date().toISOString()); }
      const fr = $(".mse-felrad"); if (synlig(fr) && fr.textContent && qa.felrader.at(-1) !== fr.textContent) qa.felrader.push(fr.textContent);
      const ba = $(".mse-banderoll"); if (synlig(ba) && ba.textContent) qa.banderoller.add(ba.textContent.trim().slice(0, 80));
      const kv = $(".mse-kvitto"); if (synlig(kv) && kv.textContent && qa.kvitton.at(-1) !== kv.textContent) { qa.kvitton.push(kv.textContent.trim()); if (qa.kvitton.length > 60) qa.kvitton.shift(); }
      const va = $(".mse-vanta");
      if (synlig(va)) { qa.vantaFran ||= Date.now(); qa.vantaMax = Math.max(qa.vantaMax, Date.now() - qa.vantaFran); } else qa.vantaFran = 0;
      const val = $(".mse-val");
      if (synlig(val)) {
        const kn = [...document.querySelectorAll(".mse-knapp:not([disabled])")];
        if (!kn.length) return;
        const finns = (t) => kn.find((k) => k.dataset.typ === t);
        let typ = finns("drag") && rng() < o.drag ? "drag" : rng() < o.laser ? "laser" : "skold";
        const k = finns(typ) || kn[0];
        k.click(); qa.val[k.dataset.typ] = (qa.val[k.dataset.typ] || 0) + 1;
        return;
      }
      if (Date.now() < nasta) return;
      const inp = $(".mse-svar .fa-input");
      const q = $(".mse-svar .fa-question");
      if (synlig(inp) && !inp.disabled && q && /\d+\s*[×x·]\s*\d+/.test(q.textContent)) {
        const [, a, b] = q.textContent.match(/(\d+)\s*[×x·]\s*(\d+)/);
        const ratt = rng() < o.p;
        inp.value = String(ratt ? a * b : a * b + 1);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.form.requestSubmit();
        ratt ? qa.ratt++ : qa.fel++;
        qa.sistaSvar = Date.now(); nasta = Date.now() + o.takt * (0.75 + 0.5 * rng());
        return;
      }
      const alt = [...document.querySelectorAll(".mse-svar .ca-knapp:not([disabled]), .mse-svar button.ca-alt:not([disabled])")];
      if (alt.length) {
        // Flerval: multiplikationen räknas ut (rätt med sannolikhet p); quiz: slumpa.
        const fr = $(".mse-svar .ca-fraga")?.textContent || "";
        const m = fr.match(/(\d+)\s*[×x·]\s*(\d+)/);
        let k = alt[Math.floor(rng() * alt.length)];
        if (m) {
          const facit = String(m[1] * m[2]);
          const ratt = alt.find((x) => x.querySelector(".ca-text")?.textContent.trim() === facit);
          const fel = alt.filter((x) => x !== ratt);
          k = ratt && rng() < o.p ? ratt : fel[Math.floor(rng() * fel.length)] || k;
          k === ratt ? qa.ratt++ : qa.fel++;
        } else qa.quiz = (qa.quiz || 0) + 1;
        k.click();
        qa.sistaSvar = Date.now(); nasta = Date.now() + o.takt * (0.75 + 0.5 * rng());
      }
    } catch (e) { qa.logg.push("fel " + e.message); }
  }, 250);
})();
