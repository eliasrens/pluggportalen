// ============================================================================
// Guldrushen – STATISTIKVYN på projektorn (#565/#578, funktionsspec §6.8,
// designspec §7). EXAKTA siffror utan visuella överdrifter, i grottans färger
// (stilla grotta):
//   • tid kvar (rubrikraden)
//   • klassens siffror: tillsammans X guld · totalt antal rätt · andel rätt ·
//     svarsfrekvens (svar per minut, senaste minuten) · skattjägare
//   • flera klasser: guld + rätt per klass
//   • EXAKT STÄLLNING FÖR ALLA ELEVER (enligt specen, Elias 2026-10-10 #578):
//     placering (delad vid lika guld), namn, guld, antal rätt, andel rätt;
//     🛡️ vid namnet = sköld/stöldskydd (§6.5). 1–3 kolumner beroende på
//     antal elever och textstorlek efter rutans höjd, så att 30 elever ryms
//     utan att scrolla (30 elever i 1280×720 ≈ 26–30 px).
// finale: true – efter slutet står slutställningen kvar (pallplatsen visas i
// Skattkammaren).
//
// API: createStatsView(host, { st, screen, deps }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { createGrKoppling } from "./gr-koppling.js";
import { ensureGrottaCss, grottaHtml, logoHtml } from "./gr-grotta.js";
import { matchClock, statSummary, standingRows, createRate, tal } from "./gr-proj-scen.js";

const PER_KOLUMN = 10;
const RAD_EM = 1.48; // en rads höjd i em (radhöjd 1.3 + utfyllnad 0.12 + linje)

const kort = (ikon, label, value, sub = "") =>
  `<div class="grx-kort"><span class="grx-ikon" aria-hidden="true">${ikon}</span><span class="grx-label">${label}</span><b class="grx-varde">${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;

const rad = (r) => `<li class="grx-rad${r.rank === 1 && r.gold > 0 ? " grx-etta" : ""}">
  <span class="grx-nr">${r.gold > 0 ? `${r.rank}.` : "–"}</span>
  <span class="grx-namn">${esc(r.name)}${r.shield ? ' <i aria-label="skyddad">🛡️</i>' : ""}</span>
  <span class="num grx-guld">${tal(r.gold)}</span>
  <span class="num">${tal(r.correct)}</span>
  <span class="num">${r.share == null ? "–" : `${r.share} %`}</span></li>`;

const HUVUD = `<li class="grx-rad grx-huvud" aria-hidden="true"><span></span><span>Namn</span><span class="num">Guld</span><span class="num">Rätt</span><span class="num">Andel</span></li>`;

export function createStatsView(host, { st, screen = false, deps = null }) {
  ensureGrottaCss();
  const sid = st.sessionId || st.session?.id;
  const root = document.createElement("div");
  root.className = "gr grx";
  root.classList.toggle("gr-skarm", !!screen);
  root.innerHTML = `${grottaHtml({ variant: "stilla" })}
    <header class="grx-topp">${logoHtml({ size: "liten" })}<h1 class="grx-rubrik">📊 Statistik</h1><div class="grx-tid" role="timer"></div></header>
    <section class="grx-kort-rad" aria-label="Klassens siffror"></section>
    <p class="grx-klassrad" hidden></p>
    <section class="grx-ruta grx-stallning" aria-label="Ställning"><div class="grx-kolumner"></div></section>`;
  host.replaceChildren(root);
  const $ = (q) => root.querySelector(q);
  let cur = st;
  let dead = false;
  let lastKey = "";
  const rate = createRate();
  let rader = 1;
  // Raderna delar på rutans höjd: texten så stor som får plats (högst 40 px).
  function fit() {
    const h = $(".grx-kolumner").clientHeight;
    if (h > 0) $(".grx-kolumner").style.fontSize = `${Math.max(16, Math.min(40, Math.floor(h / rader / RAD_EM)))}px`;
  }
  const ro = new ResizeObserver(fit);
  ro.observe($(".grx-kolumner"));
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
    const rows = standingRows(standing.players, now);
    const key = JSON.stringify([sum, perMin, rows, fin]);
    if (key === lastKey) return;
    lastKey = key;

    $(".grx-kort-rad").innerHTML = [
      kort("💰", "Tillsammans", `${tal(sum.totalGold)} guld`),
      kort("✅", "Rätt svar", tal(sum.correct), `av ${tal(sum.answered)} svar`),
      kort("🎯", "Andel rätt", `${sum.share} %`),
      kort("⚡", "Svarsfrekvens", perMin == null ? "–" : `${tal(perMin)}/min`, perMin == null && !fin ? "mäts …" : "senaste minuten"),
      kort("⛏️", "Skattjägare", tal(sum.joined), `${tal(sum.active)} har svarat`),
    ].join("");

    const klasser = sum.classes;
    $(".grx-klassrad").hidden = klasser.length < 2;
    if (klasser.length > 1) {
      $(".grx-klassrad").innerHTML = klasser.map((c) =>
        `<span class="grx-klass"><b>${esc(c.name)}</b> ${tal(c.gold)} guld · ${tal(c.correct)} rätt · ${c.joined} elever</span>`).join("");
    }

    // Ställningen: jämnt fördelad på 1–3 kolumner (högst ~10 rader per kolumn).
    const cols = Math.max(1, Math.min(3, Math.ceil(rows.length / PER_KOLUMN)));
    const per = Math.max(1, Math.ceil(rows.length / cols));
    const lists = [];
    for (let c = 0; c < cols; c++) lists.push(`<ol class="grx-lista">${HUVUD}${rows.slice(c * per, (c + 1) * per).map(rad).join("")}</ol>`);
    const box = $(".grx-kolumner");
    box.style.setProperty("--kol", cols);
    rader = per + 1;
    fit();
    box.innerHTML = rows.length ? lists.join("") : `<p class="grx-tom">Skattjägarna är på väg in i grottan …</p>`;
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
      ro.disconnect();
      koppling.destroy();
      root.remove();
    },
  };
}
