// ============================================================================
// Live-projektorn: VY 1 RAKETRACE (#461) – huvudvyn. En raket per klass stiger
// från startplattan genom molnen ut i rymden. Höjden är VISUELLT komprimerad
// (proj-scale rocketHeights: ledaren följer matchtiden, övriga √-skala mot
// ledaren) – de exakta poängen står i den lilla etiketten bredvid raketen.
// Ny poäng → boost (större flamma + liten knuff + "+N").
//
// Prestanda: DOM:en byggs EN gång; update() sätter bara CSS-variabler/text.
// Rörelsen är CSS-transitions på transform (kompositeras, ingen layout).
//
// API: createRocketView(host, { st, colors }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../teacher-shared.js";
import { formatScore } from "./live-core.js";
import { rocketHeights } from "./proj-scale.js";

const ROCKET_SVG = `<svg class="lpr-ship" viewBox="0 0 64 112" aria-hidden="true">
  <path d="M32 2C48 18 52 52 48 92H16C12 52 16 18 32 2Z" fill="currentColor"/>
  <path d="M32 2C41 11 45 20 47 30H17C19 20 23 11 32 2Z" fill="#fff" opacity=".92"/>
  <path d="M16 62 3 94l13-4Z M48 62l13 32-13-4Z" fill="currentColor"/>
  <path d="M16 62 3 94l13-4Z M48 62l13 32-13-4Z" fill="#000" opacity=".22"/>
  <path d="M44 34C47 52 47 74 46 92h2c2-30-1-50-4-58Z" fill="#000" opacity=".12"/>
  <circle cx="32" cy="50" r="10" fill="#bfeaff" stroke="#fff" stroke-width="4"/>
  <circle cx="29" cy="47" r="3" fill="#fff" opacity=".8"/>
  <rect x="21" y="90" width="22" height="9" rx="3" fill="#4a5568"/>
</svg>`;

const FLAME_SVG = `<svg class="lpr-flame" viewBox="0 0 40 60" aria-hidden="true">
  <path d="M20 60C8 44 4 30 8 14 11 6 15 2 20 0c5 2 9 6 12 14 4 16 0 30-12 46Z" fill="#ff8a1f"/>
  <path d="M20 50C12 38 11 26 13 16c2-6 4-9 7-11 3 2 5 5 7 11 2 10 1 22-7 34Z" fill="#ffd23d"/>
  <path d="M20 38c-4-7-4-14-3-19 1-3 2-5 3-6 1 1 2 3 3 6 1 5 1 12-3 19Z" fill="#fff6c8"/>
</svg>`;

// Stjärnhimmel som EN box-shadow (en DOM-nod, inga hundratals element).
function starShadow(n, seed) {
  let x = seed;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => `${(rnd() * 100).toFixed(2)}vw ${(rnd() * 52).toFixed(2)}vh 0 ${rnd() < 0.15 ? 1 : 0}px rgba(255,255,255,${(0.4 + rnd() * 0.6).toFixed(2)})`).join(",");
}

const ALTITUDES = [
  [0.22, "☁️ Molnen"],
  [0.5, "🛰️ Rymden"],
  [0.78, "🌙 Månen"],
];

function progress(st) {
  if (st.phase === "ended" || st.phase === "finished") return 1;
  if (st.phase !== "live") return 0;
  const dur = (Number(st.session?.durationSeconds) || 0) * 1000;
  return dur > 0 ? 1 - st.msLeft / dur : 0;
}

export function createRocketView(host, { st, colors }) {
  const root = document.createElement("div");
  root.className = st.classes.length > 4 ? "lpr many" : "lpr";
  root.style.setProperty("--n", st.classes.length);
  root.innerHTML = `
    <div class="lpr-sky" aria-hidden="true">
      <i class="lpr-stars" style="box-shadow:${starShadow(110, 7)}"></i>
      <i class="lpr-stars lpr-stars2" style="box-shadow:${starShadow(50, 99)}"></i>
      <i class="lpr-planet"></i><i class="lpr-moon"></i>
      <i class="lpr-cloud c1"></i><i class="lpr-cloud c2"></i><i class="lpr-cloud c3"></i><i class="lpr-cloud c4"></i>
    </div>
    <div class="lpr-field">
      <div class="lpr-alts" aria-hidden="true">${ALTITUDES.map(([h, t]) => `<span style="bottom:${h * 100}%">${t}</span>`).join("")}</div>
      ${st.classes.map((c) => `
      <div class="lpr-lane" style="--c:${colors[c.classId]};--p:0" data-cid="${esc(c.classId)}">
        <i class="lpr-trail"></i>
        <div class="lpr-fly">
          <div class="lpr-rocket" style="color:${colors[c.classId]}">
            ${ROCKET_SVG}${FLAME_SVG}
            <div class="lpr-tag"><b>${esc(c.name)}</b><span data-score>0,0</span><i class="lpr-crown">👑</i></div>
            <div class="lpr-plus" data-plus></div>
          </div>
        </div>
      </div>`).join("")}
    </div>
    <div class="lpr-ground" aria-hidden="true"></div>
    <div class="lpr-pads" aria-hidden="true">
      ${st.classes.map((c) => `<div class="lpr-pad"><span style="background:${colors[c.classId]}">${esc(c.name)}</span></div>`).join("")}
    </div>`;
  host.replaceChildren(root);

  const lanes = st.classes.map((c) => {
    const lane = root.querySelector(`[data-cid="${CSS.escape(c.classId)}"]`);
    return {
      id: c.classId,
      lane,
      score: lane.querySelector("[data-score]"),
      plus: lane.querySelector("[data-plus]"),
      last: null,
      boostT: 0,
    };
  });

  function boost(ui, gained) {
    ui.lane.classList.add("boost");
    clearTimeout(ui.boostT);
    ui.boostT = setTimeout(() => ui.lane.classList.remove("boost"), 900);
    const pop = document.createElement("span");
    pop.textContent = `+${gained}`;
    pop.addEventListener("animationend", () => pop.remove());
    ui.plus.appendChild(pop);
  }

  function update(next) {
    const byId = new Map(next.classes.map((c) => [c.classId, c]));
    const heights = rocketHeights(lanes.map((ui) => byId.get(ui.id)?.score || 0), progress(next));
    const soleLeader = next.leaderIds.length === 1 && next.classes.some((c) => c.correct > 0) ? next.leaderIds[0] : null;
    lanes.forEach((ui, i) => {
      const c = byId.get(ui.id);
      if (!c) return;
      ui.lane.style.setProperty("--p", heights[i].toFixed(4));
      ui.lane.classList.toggle("leder", ui.id === soleLeader);
      ui.lane.classList.toggle("flyger", next.phase !== "lobby" && next.phase !== "countdown");
      if (ui.last !== null && c.correct > ui.last) boost(ui, c.correct - ui.last);
      if (c.correct !== ui.last) ui.score.textContent = `${formatScore(c.score)} p/elev`;
      ui.last = c.correct;
    });
  }

  update(st);
  return {
    update,
    destroy() { lanes.forEach((ui) => clearTimeout(ui.boostT)); },
  };
}
