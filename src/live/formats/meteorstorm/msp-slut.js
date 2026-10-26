// ============================================================================
// Meteorstormen – projektorns SLUTRUTA (#822, spec §4.1.1 + §4.3). Bygger på
// SERVERNS result (msAvsluta – docs/METEORSTORMEN.md §8.4), aldrig på
// projektorns egen räkning:
//   Klass mot klass  "4B vann Meteorstormen!" (eller oavgjort), skrov kvar i
//                    procent och nedskjutna meteorer per klass, klassens tre
//                    bästa ögonblick, och en snäll avslutning för den andra
//                    stationen ("4D:s station klarade sig igenom stormen!").
//   En klass         stjärnorna och "Stationen överlevde!".
// Ingen lista över alla elever med placering. Ren modell (slutModell, testad i
// node) + html (slutHtml).
//
// API
//   slutModell(result, s)  → { lage, rubrik, under, stjarnor?, klasser: [{ classId,
//                            namn, skrov, nedskjutna, vann, snall, ogonblick: [text] }] }
//   slutHtml(modell, farger) → html (betrodd – texterna escapas här)
// ============================================================================

import { klassGenitiv } from "./msp-scen.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const OGONBLICK = {
  nedskjutna: (o, n) => (n ? `🔫 Flest nedskjutna: ${n} (${o.antal})` : `🔫 En elev sköt ner ${o.antal} meteorer`),
  sista: (o, n) => (n ? `⏱️ Räddade stationen i sista sekunden: ${n}` : "⏱️ Någon räddade stationen i sista sekunden"),
  skold: (o, n) => (n ? `🛡️ Flest sköldtryck: ${n} (${o.antal})` : `🛡️ En elev laddade skölden ${o.antal} gånger`),
  kast: (o, n) => (n ? `🌀 Flest dragstrålar: ${n} (${o.antal})` : `🌀 En elev slungade ${o.antal} meteorer`),
};

/** "4D:s station klarade sig igenom stormen!" – snäll text för den som inte vann. */
export function snallText(klassnamn, skrov) {
  return skrov > 0
    ? `${klassGenitiv(klassnamn)} station klarade sig igenom stormen!`
    : `${klassnamn} kämpade ända till slutet – besättningen vinkar från rymden! 👋`;
}

export function slutModell(result, s) {
  const visaNamn = s?.showNames !== false;
  const namn = (id) => result?.perClass?.[id]?.name || s?.classNames?.[id] || id;
  const placering = Array.isArray(result?.placering) ? result.placering : [];
  const enKlass = result?.lage === "en-klass";
  const klasser = placering.map((p) => {
    const pc = result.perClass?.[p.classId] || {};
    const ogonblick = (pc.ogonblick || [])
      .filter((o) => OGONBLICK[o.typ])
      .slice(0, 3)
      .map((o) => OGONBLICK[o.typ](o, visaNamn ? o.namn : ""));
    const vann = !enKlass && !result.draw && result.winner === p.classId;
    return {
      classId: p.classId, namn: namn(p.classId), skrov: Math.round(Number(p.skrov) || 0),
      nedskjutna: Number(p.nedskjutna) || 0, vann,
      snall: !enKlass && !vann && !result.draw ? snallText(namn(p.classId), Number(p.skrov) || 0) : "",
      ogonblick,
    };
  });
  if (enKlass) {
    const k = klasser[0];
    const stjarnor = Number(result.stjarnor) || 0;
    return {
      lage: "en-klass", stjarnor, klasser,
      rubrik: result.overlevde ? "Stationen överlevde!" : "Stormen är över!",
      under: result.overlevde
        ? stjarnor >= 3 ? "Fantastiskt försvar – nästan utan en skråma!" : stjarnor === 2 ? "Bra jobbat – stationen höll ihop!" : "Det var nära – men ni klarade det!"
        : `${k ? k.namn : "Klassen"} kämpade ända till slutet – nästa storm tar ni! 🚀`,
    };
  }
  // Serverns ordning (ms-resultat.js buildResultat): mest skrov, sedan flest nedskjutna, annars oavgjort.
  const vinnare = klasser.find((k) => k.vann);
  const [a, b] = placering;
  const likaSkrov = !!a && !!b && Number(a.skrov) === Number(b.skrov);
  const under = vinnare
    ? likaSkrov ? "Lika mycket skrov – flest nedskjutna meteorer avgjorde." : "Mest skrov kvar när stormen var över."
    : Number(a?.skrov) > 0
      ? "Lika mycket skrov och lika många nedskjutna – båda stationerna klarade stormen!"
      : "Lika mycket skrov och lika många nedskjutna – båda klasserna kämpade ända till slutet!";
  return {
    lage: "klass-mot-klass", klasser,
    rubrik: vinnare ? `${vinnare.namn} vann Meteorstormen!` : "Oavgjort!",
    under,
  };
}

export function slutHtml(m, farger) {
  const kort = m.klasser.map((k) => `
    <div class="msp-slutkort${k.vann ? " msp-vann" : ""}" style="--msp-k:${esc(farger[k.classId] || "#ffd166")}">
      <h3>${k.vann ? "🏆 " : ""}${esc(k.namn)}</h3>
      <div class="msp-slut-tal"><b>${k.skrov} %</b><span>skrov kvar</span></div>
      <div class="msp-slut-tal"><b>${k.nedskjutna}</b><span>nedskjutna meteorer</span></div>
      ${k.snall ? `<p class="msp-snall">${esc(k.snall)}</p>` : ""}
      ${k.ogonblick.length ? `<ul class="msp-ogon">${k.ogonblick.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
    </div>`).join("");
  const stj = m.lage === "en-klass"
    ? `<div class="msp-stjarnor" aria-label="${m.stjarnor} av 3 stjärnor">${[1, 2, 3].map((n) => `<span class="${n <= m.stjarnor ? "msp-pa" : ""}">★</span>`).join("")}</div>`
    : "";
  return `<div class="msp-slutruta">
    ${stj}
    <h2>${m.lage === "en-klass" ? "" : "☄️ "}${esc(m.rubrik)}</h2>
    <p class="msp-slut-under">${esc(m.under)}</p>
    <div class="msp-slutkorten">${kort}</div>
  </div>`;
}
