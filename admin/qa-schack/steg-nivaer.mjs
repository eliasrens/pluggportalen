// Schack-QA (#777) steg "nivaer": alla fyra nivåer × vit/svart/slumpa i appen.
// Tiderna mäts i sidan (när partiet sparas efter elevens drag → efter datorns drag),
// och statusraden loggas av en MutationObserver – så en långsam CDP-tur under last
// varken förkortar tiden eller missar "Datorn tänker…".
const KROK = `(() => {
  if (window.__spar) return;
  window.__spar = []; window.__status = [];
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (/^pp:schack:dator:[^:]+$/.test(k)) { try { window.__spar.push([performance.now(), JSON.parse(v).drag.length]); } catch {} }
    return orig.call(this, k, v);
  };
  new MutationObserver(() => {
    const t = document.querySelector(".schack-status-text")?.textContent;
    if (t && t !== window.__status.at(-1)) window.__status.push(t);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})()`;

/** ms mellan sparningen med `n` drag och sparningen med `n + 1` drag (senaste förekomsten). */
const tidMellan = (p, n) => p.ev(`(() => { const s = window.__spar; let a = null, b = null;
  for (const [t, d] of s) { if (d === ${n}) { a = t; b = null; } else if (d === ${n} + 1 && a !== null && b === null) b = t; }
  return a !== null && b !== null ? Math.round(b - a) : null; })()`);

export default async function nivaer({ p, e, ok }) {
  await p.ev(KROK);
  const tider = [];
  const slumpFarger = [];
  for (const niva of ["bonden", "springaren", "tornet", "damen"]) {
    for (const farg of ["w", "b", "slump"]) {
      await p.ev(`window.__status.length = 0`);
      await e.startaParti(niva, farg);
      const egen = (await e.parti()).egenFarg;
      if (farg === "slump") slumpFarger.push(egen);
      const namn = `${niva}/${farg}`;
      const horn = await e.hornRuta();
      ok(`${namn}: brädet vänt efter egen färg (${egen})`, horn === (egen === "w" ? "a1" : "h8"), `nere till vänster ${horn}`);
      ok(`${namn}: egen spelarrad nederst`, (await p.ev(`document.querySelector('.schack-spelare[data-plats="botten"]').dataset.farg`)) === egen);
      const varna = await p.ev(`document.querySelector('[data-act="varna"]').checked`);
      ok(`${namn}: Varna mig ${varna ? "på" : "av"} som standard`, varna === (niva === "bonden" || niva === "springaren"));
      if (egen === "b") {
        await e.vantaDrag(1);
        ok(`${namn}: "Datorn tänker…" medan datorn öppnar`, (await p.ev(`window.__status`)).includes("Datorn tänker…"), (await p.ev(`window.__status`)).join(" → "));
        tider.push({ niva, ms: await tidMellan(p, 0) });
      }
      for (let i = 0; i < 4; i++) {
        const fore = (await e.parti()).drag.length;
        await p.ev(`window.__status.length = 0`);
        await e.elevDrag();
        await e.vantaDrag(fore + 1);
        if ((await e.parti()).slut) break;
        await e.vantaDrag(fore + 2);
        const st = await p.ev(`window.__status`);
        ok(`${namn}: drag ${i + 1}: status ${st.join(" → ")}`, st.includes("Datorn tänker…") && /^(Schack! )?Din tur/.test(st.at(-1) || ""));
        tider.push({ niva, ms: await tidMellan(p, fore + 1) });
        if ((await e.parti()).slut) break;
        const l = await e.lage();
        ok(`${namn}: datorns drag markerat (2 rutor)`, l.senast.length === 2, l.senast.join(","));
        ok(`${namn}: brädet interaktivt igen`, l.interaktiv);
      }
    }
  }
  ok("slumpad färg ger ett giltigt val", slumpFarger.every((f) => f === "w" || f === "b"), slumpFarger.join(","));
  const per = {};
  for (const t of tider) if (t.ms !== null) (per[t.niva] ??= []).push(t.ms);
  for (const [n, a] of Object.entries(per)) {
    const max = Math.max(...a);
    ok(`UI-tid ${n}: medel ${Math.round(a.reduce((x, y) => x + y, 0) / a.length)} ms, max ${max} ms (elevens drag sparat → datorns drag sparat, inkl. 350 ms tänkpaus, n=${a.length})`, max < 1500);
  }
}
