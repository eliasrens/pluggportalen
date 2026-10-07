// ============================================================================
// Live-projektorn: VY 3 DRAGKAMP (#461) – bara när exakt två klasser tävlar.
// Två lag drar i ett rep; repet (med mittmarkören) glider mot laget som leder.
// Förskjutningen är komprimerad (proj-scale tugShift, tanh) så matchen känns
// spännande längre – de exakta siffrorna står små under klassnamnen.
// Ny poäng → laget tar ett extra ryck.
//
// Allt ritas i EN SVG som byggs en gång; update() ändrar bara CSS-variabeln
// --s (transform-transition) och texterna.
//
// API: createTugView(host, { st, colors }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../teacher-shared.js";
import { formatScore } from "./live-core.js";
import { tugShift } from "./proj-scale.js";

const SKIN = ["#f5c9a5", "#c98e63", "#8d5a3b", "#f0d2b6", "#a8714c", "#e0ac80"];
const HAIR = ["#4a2c17", "#1f1a17", "#d9a441", "#7a3b1d", "#2b2b2b", "#b5651d"];

// En figur med fötterna i (0,0), vänd åt höger, lutad bakåt; händerna på repet (40,−95).
function kid(x, color, i, mirror) {
  const skin = SKIN[i % SKIN.length];
  const hair = HAIR[(i * 5) % HAIR.length];
  return `<g transform="translate(${x} 280)${mirror ? " scale(-1 1)" : ""}">
    <g class="lpt-kid" style="animation-delay:${(i % 3) * -0.45}s">
      <path d="M-30 0 -4 -56 10 0" fill="none" stroke="#33415c" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-4 -56-18-108" stroke="${color}" stroke-width="32" stroke-linecap="round"/>
      <path d="M-14-100 38-95" stroke="${color}" stroke-width="11" stroke-linecap="round"/>
      <circle cx="40" cy="-95" r="7" fill="${skin}"/>
      <circle cx="-24" cy="-136" r="21" fill="${skin}"/>
      <path d="M-45-138c0-16 10-24 21-24s20 6 21 18c-8-6-22-8-42 6Z" fill="${hair}"/>
      <circle cx="-15" cy="-138" r="2.6" fill="#1f2937"/><circle cx="-6" cy="-138" r="2.6" fill="#1f2937"/>
      <path d="M-17-127q7 6 13-1" fill="none" stroke="#1f2937" stroke-width="2.4" stroke-linecap="round"/>
    </g></g>`;
}

export function createTugView(host, { st, colors }) {
  const [a, b] = st.classes;
  const ca = colors[a.classId];
  const cb = colors[b.classId];
  const root = document.createElement("div");
  root.className = "lpt";
  root.style.setProperty("--ca", ca);
  root.style.setProperty("--cb", cb);
  root.style.setProperty("--s", "0");
  root.innerHTML = `
    <div class="lpt-sky" aria-hidden="true"><i class="lpt-sun"></i><i class="lpr-cloud c1"></i><i class="lpr-cloud c3"></i></div>
    <div class="lpt-heads">
      <div class="lpt-head" data-side="a"><b style="color:${ca}">${esc(a.name)}</b><i class="lpr-crown">👑</i>
        <span data-score>0,0 p/elev</span><small data-correct>0 rätt</small></div>
      <div class="lpt-head lpt-head-b" data-side="b"><b style="color:${cb}">${esc(b.name)}</b><i class="lpr-crown">👑</i>
        <span data-score>0,0 p/elev</span><small data-correct>0 rätt</small></div>
    </div>
    <div class="lpt-field" aria-hidden="true">
      <i class="lpt-half lpt-half-a"></i><i class="lpt-half lpt-half-b"></i><i class="lpt-mid"></i>
      <svg class="lpt-svg" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax meet">
        <g class="lpt-move">
          <path d="M90 200C110 188 125 185 150 185H850c25 0 40 3 60 15" fill="none" stroke="#b07a3c" stroke-width="10" stroke-linecap="round"/>
          <path d="M150 185H850" stroke="#8a5a26" stroke-width="10" stroke-dasharray="7 9"/>
          <g class="lpt-team" data-team="a">${[170, 270, 370].map((x, i) => kid(x, ca, i, false)).join("")}</g>
          <g class="lpt-team" data-team="b">${[830, 730, 630].map((x, i) => kid(x, cb, i + 3, true)).join("")}</g>
          <g class="lpt-flag"><path d="M500 185 484 232 500 222 516 232Z" fill="#ff3b5c"/><circle cx="500" cy="185" r="10" fill="#ff3b5c" stroke="#fff" stroke-width="3"/></g>
        </g>
      </svg>
    </div>`;
  host.replaceChildren(root);

  const sides = [a, b].map((c, i) => {
    const head = root.querySelector(`[data-side="${i ? "b" : "a"}"]`);
    return {
      id: c.classId,
      head,
      team: root.querySelector(`[data-team="${i ? "b" : "a"}"]`),
      score: head.querySelector("[data-score]"),
      correct: head.querySelector("[data-correct]"),
      last: null,
      t: 0,
    };
  });

  function update(next) {
    const byId = new Map(next.classes.map((c) => [c.classId, c]));
    const [ua, ub] = sides.map((s) => byId.get(s.id) || { score: 0, correct: 0 });
    root.style.setProperty("--s", tugShift(ua.score, ub.score).toFixed(4));
    const lead = next.leaderIds.length === 1 && (ua.correct > 0 || ub.correct > 0) ? next.leaderIds[0] : null;
    sides.forEach((ui, i) => {
      const c = i ? ub : ua;
      ui.head.classList.toggle("leder", ui.id === lead);
      if (ui.last !== null && c.correct > ui.last) {
        ui.team.classList.add("pull");
        clearTimeout(ui.t);
        ui.t = setTimeout(() => ui.team.classList.remove("pull"), 700);
      }
      ui.last = c.correct;
      ui.score.textContent = `${formatScore(c.score)} p/elev`;
      ui.correct.textContent = `${c.correct} rätt ÷ ${c.divisor ?? "–"}`;
    });
  }

  update(st);
  return { update, destroy() { sides.forEach((s) => clearTimeout(s.t)); } };
}
