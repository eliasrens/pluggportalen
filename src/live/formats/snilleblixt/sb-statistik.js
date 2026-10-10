// ============================================================================
// Snilleblixten – STATISTIKVYN på projektorn (#559, designspec §7): exakt,
// utan visuella överdrifter – alla elever i en tabell med poängstapel,
// antal rätt och andel rätt (av avslöjade frågor), plus frågans tid kvar och
// "17 av 24 har svarat". Siffrorna är ALLTID nuläget (alla sbScores, ingen
// fördröjning som i studions topplista). Samma studiofärger och miljö (stilla).
// Lärarkontrollerna och automatiken finns här också (sb-koppling), så
// spelet går vidare även när läraren visar statistiken. finale: true –
// efter slutet står slutställningen kvar (pallplatsen visas i Studion).
// Längst ned: andel rätt per fråga (vilka frågor klassen hade svårast för).
//
// API: createStatsView(host, { st, actions, screen, deps }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { createSbKoppling } from "./sb-koppling.js";
import { ensureStudioCss, miljoHtml, logoHtml } from "./sb-miljo.js";
import { questionClock } from "./sb-scen.js";
import { createKontroller } from "./sb-kontroller.js";

const tal = (n) => (Number(n) || 0).toLocaleString("sv-SE");
const pct = (a, b) => (b > 0 ? `${Math.round((100 * a) / b)} %` : "–");

export function createStatsView(host, { st, actions = {}, screen = false, deps = null }) {
  ensureStudioCss();
  const sid = st.sessionId || st.session?.id;
  const root = document.createElement("div");
  root.className = "sb sb-stat";
  root.dataset.scene = "statistik";
  root.innerHTML = `${miljoHtml()}
    <header class="sbx-topp">${logoHtml({ size: "liten" })}<div class="sbx-status" aria-live="polite"></div></header>
    <div class="sbx-tabell"></div>
    <div class="sbx-fragor" aria-label="Andel rätt per fråga"></div>`;
  host.replaceChildren(root);
  root.classList.add("sb-stilla");
  root.classList.toggle("sb-skarm", !!screen);
  let cur = st;
  let dead = false;
  let lastKey = "";
  const koppling = createSbKoppling({ sid, st, deps, actions, screen, onChange: () => render(), say: (t) => console.warn("Snilleblixten:", t) });
  const kontroll = screen ? null : createKontroller(root, { koppling });

  function render() {
    if (dead) return;
    const s = cur.session;
    if (!s) return;
    const now = koppling.now();
    const q = s.q || null;
    const scores = koppling.scores;
    const played = scores.filter((sc) => !sc.skipped).length;
    const standing = koppling.standings(scores);
    const clock = q?.phase === "open" ? questionClock(s, now) : null;
    const prog = q?.phase === "open" ? koppling.progress() : null;
    const status = cur.phase === "finished" ? "🏁 Slutställning"
      : q ? `Fråga ${q.index + 1} av ${s.questionCount}${clock ? ` · ⏱ <b class="${clock.tension ? "sbx-rod" : ""}">${clock.secs} s</b> kvar` : q.phase === "open" ? "" : " · ✔ klar"}${
        prog ? ` · <b>${prog.answered}</b> av <b>${prog.eligible}</b> har svarat` : ""}`
        : "Väntar på första frågan";
    const statusEl = root.querySelector(".sbx-status");
    if (statusEl.innerHTML !== status) statusEl.innerHTML = status;

    const key = JSON.stringify([standing.players.map((p) => [p.uid, p.points, p.correct, p.rank, p.name]), played,
      scores.map((sc) => [sc.index, sc.correctCount, sc.answered, sc.skipped])]);
    if (key !== lastKey) {
      lastKey = key;
      const max = Math.max(1, ...standing.players.map((p) => p.points));
      const rows = standing.players;
      const cols = rows.length > 24 ? 3 : rows.length > 12 ? 2 : 1;
      const per = Math.ceil(rows.length / cols) || 1;
      const head = `<thead><tr><th class="num">#</th><th>Elev</th><th class="sbx-pcol">Poäng</th><th class="num">Rätt</th><th class="num">Andel</th></tr></thead>`;
      const table = (part) => `<table>${head}<tbody>${part.map((p) => `
        <tr><td class="num">${p.rank}</td><th scope="row">${esc(p.name || "?")}</th>
          <td class="sbx-pcol"><i class="sbx-stapel" style="transform:scaleX(${(p.points / max).toFixed(3)})"></i><b>${tal(p.points)}</b></td>
          <td class="num">${p.correct}</td><td class="num">${pct(p.correct, played)}</td></tr>`).join("")}</tbody></table>`;
      const parts = [];
      for (let i = 0; i < cols; i++) parts.push(rows.slice(i * per, (i + 1) * per));
      const tabell = root.querySelector(".sbx-tabell");
      tabell.style.setProperty("--kol", cols);
      tabell.style.setProperty("--rader", per);
      tabell.innerHTML = rows.length ? parts.map(table).join("") : `<p class="sbx-tom">Inga elever har anslutit än.</p>`;
      root.querySelector(".sbx-fragor").innerHTML = scores.length
        ? `<span class="sbx-fl">Andel rätt per fråga</span>${scores.map((sc) => `<span class="sbx-fq${sc.skipped ? " sbx-hoppad" : ""}" title="Fråga ${sc.index + 1}: ${sc.correctCount} av ${sc.answered} rätt">
            <b>${sc.index + 1}</b>${sc.skipped ? "⏭" : pct(sc.correctCount, sc.answered)}</span>`).join("")}`
        : "";
    }
    kontroll?.update();
  }

  const iv = setInterval(render, 250);
  render();
  return {
    update(next) {
      cur = next;
      koppling.update(next);
      render();
    },
    destroy() {
      dead = true;
      clearInterval(iv);
      koppling.destroy();
      kontroll?.destroy();
      root.remove();
    },
  };
}
