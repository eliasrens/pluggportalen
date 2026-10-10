// ============================================================================
// Guldrushen – STATISTIKVYN på projektorn (#565, funktionsspec §6.8, design-
// spec §7). EXAKTA siffror utan visuella överdrifter, i grottans färger
// (stilla grotta). ANONYM (Elias 2026-10-10: projektorn får aldrig hänga ut
// elever) – klassen som helhet, aldrig guld eller rätt per elev:
//   • tid kvar · antal skattjägare (och hur många som svarat)
//   • tillsammans X guld · totalt antal rätt · andel rätt · svarsfrekvens
//     (svar per minut, senaste minuten) · öppnade kistor
//   • guldets fördelning: hur många elever har 0, 1–49, 50–99 … guld
//   • flera klasser: guld + rätt per klass
// Hela ställningen per elev finns i lärarens historik. finale: true – efter
// slutet står klassens siffror kvar (pallplatsen visas i Skattkammaren).
//
// API: createStatsView(host, { st, screen, deps }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { createGrKoppling } from "./gr-koppling.js";
import { ensureGrottaCss, grottaHtml, logoHtml } from "./gr-grotta.js";
import { matchClock, statSummary, goldBuckets, createRate, tal } from "./gr-proj-scen.js";

const kort = (ikon, label, value, sub = "") =>
  `<div class="grx-kort"><span class="grx-ikon" aria-hidden="true">${ikon}</span><span class="grx-label">${label}</span><b class="grx-varde">${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;

function bucketLabel(b) {
  if (b.to === 0) return "0";
  return b.to == null ? `${tal(b.from)}+` : `${tal(b.from)}–${tal(b.to)}`;
}

export function createStatsView(host, { st, screen = false, deps = null }) {
  ensureGrottaCss();
  const sid = st.sessionId || st.session?.id;
  const root = document.createElement("div");
  root.className = "gr grx";
  root.classList.toggle("gr-skarm", !!screen);
  root.innerHTML = `${grottaHtml({ variant: "stilla" })}
    <header class="grx-topp">${logoHtml({ size: "liten" })}<h1 class="grx-rubrik">📊 Statistik</h1><div class="grx-tid" role="timer"></div></header>
    <section class="grx-kort-rad" aria-label="Klassens siffror"></section>
    <div class="grx-grid">
      <section class="grx-ruta" aria-label="Guldets fördelning"><h2 class="grx-h">Så fördelas guldet <small>(antal elever)</small></h2><div class="grx-staplar"></div></section>
      <section class="grx-ruta grx-klasser" aria-label="Per klass" hidden><h2 class="grx-h">Per klass</h2><table class="grx-tabell"></table></section>
    </div>`;
  host.replaceChildren(root);
  const $ = (q) => root.querySelector(q);
  let cur = st;
  let dead = false;
  let lastKey = "";
  const rate = createRate();
  const koppling = createGrKoppling({ sid, deps, onChange: () => render(), say: (t) => console.warn("Guldrushen:", t) });

  function render() {
    if (dead) return;
    const s = cur.session;
    if (!s) return;
    const now = koppling.now();
    const clock = matchClock(s, now);
    const fin = cur.phase === "finished";
    const tid = fin ? "🏁 Slut" : `⏱ <b class="${clock.tension ? "grx-rod" : ""}">${clock.text}</b> kvar`;
    if ($(".grx-tid").innerHTML !== tid) $(".grx-tid").innerHTML = tid;
    if (!koppling.ready) return;

    const standing = koppling.standings(cur);
    const sum = statSummary(standing);
    rate.add(sum.answered, now);
    const perMin = fin ? null : rate.perMin(now);
    const buckets = goldBuckets(standing.players);
    const key = JSON.stringify([sum, perMin, buckets, fin]);
    if (key === lastKey) return;
    lastKey = key;

    $(".grx-kort-rad").innerHTML = [
      kort("💰", "Tillsammans", `${tal(sum.totalGold)} guld`),
      kort("✅", "Rätt svar", tal(sum.correct), `av ${tal(sum.answered)} svar`),
      kort("🎯", "Andel rätt", `${sum.share} %`),
      kort("⚡", "Svarsfrekvens", perMin == null ? "–" : `${tal(perMin)}/min`, "svar senaste minuten"),
      kort("🧰", "Kistor öppnade", tal(sum.chests)),
      kort("⛏️", "Skattjägare", tal(sum.joined), `${tal(sum.active)} har svarat`),
    ].join("");

    const max = Math.max(1, ...buckets.map((b) => b.count));
    $(".grx-staplar").style.setProperty("--n", buckets.length);
    $(".grx-staplar").innerHTML = buckets.map((b) => `
      <div class="grx-kol" title="${b.count} elever har ${bucketLabel(b)} guld">
        <b class="grx-antal">${b.count}</b><span class="grx-ror"><i style="transform:scaleY(${(b.count / max).toFixed(3)})"></i></span>
        <span class="grx-spann">${bucketLabel(b)}</span></div>`).join("");

    const klasser = sum.classes;
    $(".grx-klasser").hidden = klasser.length < 2;
    if (klasser.length > 1) {
      $(".grx-tabell").innerHTML = `<thead><tr><th>Klass</th><th class="num">Guld</th><th class="num">Rätt</th><th class="num">Elever</th></tr></thead>
        <tbody>${klasser.map((c) => `<tr><th scope="row">${esc(c.name)}</th><td class="num">${tal(c.gold)}</td><td class="num">${tal(c.correct)}</td><td class="num">${c.joined}</td></tr>`).join("")}</tbody>`;
    }
  }

  const iv = setInterval(render, 500);
  render();
  return {
    update(next) {
      cur = next;
      render();
    },
    destroy() {
      dead = true;
      clearInterval(iv);
      koppling.destroy();
      root.remove();
    },
  };
}
