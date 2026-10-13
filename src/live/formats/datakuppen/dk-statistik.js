// ============================================================================
// Datakuppen – STATISTIKVYN på projektorn (#654, spec §4.2, §5): som
// Guldrushens, i Datakuppens färger (stilla nätverk, inget rör sig):
//   • tid kvar (rubrikraden)
//   • klassens siffror: tillsammans X MB · rätt svar · andel rätt ·
//     svarsfrekvens · HACKFÖRSÖK och ANDEL LYCKADE (hela klassen – aldrig
//     per elev på projektorn, hackStats) · spelare
//   • flera klasser: data + rätt per klass
//   • exakt ställning för alla elever (placering, namn, MB, rätt, andel
//     rätt; 🛡️ = skyddad just nu), 1–3 kolumner så att 30 elever ryms.
// finale: true – efter slutet står slutställningen kvar.
//
// API: createStatsView(host, { st, screen, deps }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { createDkKoppling } from "./dk-koppling.js";
import { ensureNatverkCss, natverkHtml, logoHtml } from "./dk-natverk.js";
import { hackStats } from "./datakuppen-core.js";
import { matchClock, statSummary, standingRows, createRate, hackShare, tal } from "./dk-proj-scen.js";

const PER_KOLUMN = 10;
const RAD_EM = 1.48;

const kort = (ikon, label, value, sub = "", extra = "") =>
  `<div class="dknx-kort${extra}"><span class="dknx-ikon" aria-hidden="true">${ikon}</span><span class="dknx-label">${label}</span><b class="dknx-varde">${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;

const rad = (r) => `<li class="dknx-rad${r.rank === 1 && r.gold > 0 ? " dknx-etta" : ""}">
  <span class="dknx-nr">${r.gold > 0 ? `${r.rank}.` : "–"}</span>
  <span class="dknx-namn">${esc(r.name)}${r.shield ? ' <i aria-label="skyddad">🛡️</i>' : ""}</span>
  <span class="num dknx-mb">${tal(r.gold)}</span>
  <span class="num">${tal(r.correct)}</span>
  <span class="num">${r.share == null ? "–" : `${r.share} %`}</span></li>`;

const HUVUD = `<li class="dknx-rad dknx-huvud" aria-hidden="true"><span></span><span>Namn</span><span class="num">MB</span><span class="num">Rätt</span><span class="num">Andel</span></li>`;

export function createStatsView(host, { st, screen = false, deps = null }) {
  ensureNatverkCss();
  const sid = st.sessionId || st.session?.id;
  const root = document.createElement("div");
  root.className = "dkn dknx";
  root.classList.toggle("dkn-skarm", !!screen);
  root.innerHTML = `${natverkHtml({ variant: "stilla" })}
    <header class="dknx-topp">${logoHtml({ size: "liten" })}<h1 class="dknx-rubrik">📊 Statistik</h1><div class="dknx-tid" role="timer"></div></header>
    <section class="dknx-kort-rad" aria-label="Klassens siffror"></section>
    <p class="dknx-klassrad" hidden></p>
    <section class="dknx-ruta dknx-stallning" aria-label="Ställning"><div class="dknx-kolumner"></div></section>`;
  host.replaceChildren(root);
  const $ = (q) => root.querySelector(q);
  let cur = st;
  let dead = false;
  let lastKey = "";
  const rate = createRate();
  let rader = 1;
  function fit() {
    const h = $(".dknx-kolumner").clientHeight;
    if (h > 0) $(".dknx-kolumner").style.fontSize = `${Math.max(16, Math.min(34, Math.floor(h / rader / RAD_EM)))}px`;
  }
  const ro = new ResizeObserver(fit);
  ro.observe($(".dknx-kolumner"));
  const koppling = createDkKoppling({ sid, deps, onChange: () => render(), say: (t) => console.warn("Datakuppen:", t) });

  function render() {
    if (dead) return;
    const s = cur.session;
    if (!s) return;
    const now = koppling.now();
    const clock = matchClock(s, now);
    const fin = cur.phase === "finished";
    const tid = fin ? "🏁 Slut" : `⏱ <b class="${clock.tension ? "dknx-varm" : ""}">${clock.text}</b> kvar`;
    if ($(".dknx-tid").innerHTML !== tid) $(".dknx-tid").innerHTML = tid;
    if (!koppling.ready) return;

    const standing = koppling.standings(cur);
    const sum = statSummary(standing);
    const hacks = hackStats(koppling.grPlayers);
    const share = hackShare(hacks);
    rate.add(sum.answered, now);
    const perMin = fin ? null : rate.perMin(now);
    const rows = standingRows(standing.players, now);
    const key = JSON.stringify([sum, hacks, perMin, rows, fin, s.hacking]);
    if (key === lastKey) return;
    lastKey = key;

    const hackOff = s.hacking === false;
    $(".dknx-kort-rad").innerHTML = [
      kort("💾", "Tillsammans", `${tal(sum.totalGold)} MB`),
      kort("✅", "Rätt svar", tal(sum.correct), `av ${tal(sum.answered)} svar`),
      kort("🎯", "Andel rätt", `${sum.share} %`),
      kort("⚡", "Svar/min", perMin == null ? "–" : tal(perMin), perMin == null && !fin ? "mäts …" : "senaste minuten"),
      kort("💻", "Hackförsök", hackOff ? "–" : tal(hacks.attempts), hackOff ? "hackning av" : "hela klassen", " dknx-hack"),
      kort("🔓", "Lyckade", hackOff || share == null ? "–" : `${share} %`, hackOff ? "hackning av" : `${tal(hacks.success)} av ${tal(hacks.attempts)} hack`, " dknx-hack"),
      kort("👥", "Spelare", tal(sum.joined), `${tal(sum.active)} har svarat`),
    ].join("");

    const klasser = sum.classes;
    $(".dknx-klassrad").hidden = klasser.length < 2;
    if (klasser.length > 1) {
      $(".dknx-klassrad").innerHTML = klasser.map((c) =>
        `<span class="dknx-klass"><b>${esc(c.name)}</b> ${tal(c.gold)} MB · ${tal(c.correct)} rätt · ${c.joined} elever</span>`).join("");
    }

    const cols = Math.max(1, Math.min(3, Math.ceil(rows.length / PER_KOLUMN)));
    const per = Math.max(1, Math.ceil(rows.length / cols));
    const lists = [];
    for (let c = 0; c < cols; c++) lists.push(`<ol class="dknx-lista">${HUVUD}${rows.slice(c * per, (c + 1) * per).map(rad).join("")}</ol>`);
    const box = $(".dknx-kolumner");
    box.style.setProperty("--kol", cols);
    rader = per + 1;
    fit();
    box.innerHTML = rows.length ? lists.join("") : `<p class="dknx-tom">&gt; Väntar på att eleverna loggar in …</p>`;
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
