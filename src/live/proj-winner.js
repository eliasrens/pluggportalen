// ============================================================================
// Live-projektorn: VINNARSKÄRMEN (#461) – vid 00:00 (status "finished").
// "🏆 VINNARE – 4B!" i klassens färg, poäng/elev per klass, totalsiffror,
// matchens stjärnor, pokal och konfetti. Oavgjort → "OAVGJORT!" och BÅDA
// (alla delade ledare) firas: krona på varje kort, konfetti i deras färger.
// Konfettin är en canvas med requestAnimationFrame som stannar av sig själv
// (~7 s) och hoppas över helt vid prefers-reduced-motion. Mynt-priset (#526)
// visas under rubriken: vem som får hur mycket till klasskassan.
//
// API: createWinner(host, { st, colors, onBack, celebrate }) → { update(st), destroy() }
//   celebrate: true = spela konfetti (inte vid omladdning av en gammal match)
//   onBack: null = ingen "Till Live"-knapp (elevskärmen, #533)
// ============================================================================

import { esc } from "../teacher-shared.js";
import { formatScore } from "./live-core.js";
import { prizeText } from "./formats/klassmatch/klassmatch-core.js";

const TROPHY = `<svg class="lpw-trophy" viewBox="0 0 120 130" aria-hidden="true">
  <path d="M30 14H10c0 26 10 38 26 40M90 14h20c0 26-10 38-26 40" fill="none" stroke="#f4b400" stroke-width="8" stroke-linecap="round"/>
  <path d="M28 6h64v26c0 26-14 42-32 42S28 58 28 32Z" fill="#ffcf33"/>
  <path d="M40 10h10v24c0 16 5 26 12 32-14-2-22-14-22-32Z" fill="#fff3b0" opacity=".7"/>
  <path d="M52 74h16v18H52Z" fill="#f4b400"/>
  <path d="M34 92h52l6 16H28Z" fill="#ffcf33"/><rect x="22" y="106" width="76" height="16" rx="4" fill="#c98a00"/>
  <path d="m60 22 5 10 11 1-8 7 3 11-11-6-11 6 3-11-8-7 11-1Z" fill="#fff" opacity=".9"/>
</svg>`;

const MEDALS = ["🥇", "🥈", "🥉"];

function confetti(canvas, palette) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};
  const g = canvas.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = 0;
  let h = 0;
  const size = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  const bits = [];
  const spawn = (n) => {
    for (let i = 0; i < n; i++) {
      bits.push({
        x: Math.random() * w, y: -20 - Math.random() * h * 0.3,
        vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random() * 2.5,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2,
        s: 7 + Math.random() * 8, c: palette[i % palette.length], ph: Math.random() * 6,
      });
    }
  };
  const t0 = performance.now();
  let raf = 0;
  let last = t0;
  function frame(t) {
    const dt = Math.min(3, (t - last) / 16.7);
    last = t;
    if (t - t0 < 2600 && bits.length < 260) spawn(6);
    g.clearRect(0, 0, w, h);
    for (let i = bits.length - 1; i >= 0; i--) {
      const p = bits[i];
      p.ph += 0.05 * dt;
      p.x += (p.vx + Math.sin(p.ph) * 0.8) * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      if (p.y > h + 20) { bits.splice(i, 1); continue; }
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.fillStyle = p.c;
      g.fillRect(-p.s / 2, -p.s / 4, p.s, (p.s / 2) * Math.abs(Math.cos(p.ph)));
      g.restore();
    }
    if (bits.length || t - t0 < 2600) raf = requestAnimationFrame(frame);
    else g.clearRect(0, 0, w, h);
  }
  raf = requestAnimationFrame(frame);
  // Mät om när ytan ändras – även när projektorns CSS laddas in efter starten.
  const ro = new ResizeObserver(size);
  ro.observe(canvas);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

export function createWinner(host, { st, colors, onBack, celebrate }) {
  const root = document.createElement("div");
  root.className = "lpw";
  root.innerHTML = `<canvas class="lpw-confetti" aria-hidden="true"></canvas><div class="lpw-inner"></div>`;
  host.replaceChildren(root);
  const inner = root.querySelector(".lpw-inner");
  let stop = () => {};
  let key = "";

  function update(next) {
    const k = JSON.stringify([next.classes, next.draw, next.winnerId, next.top.slice(0, 3), !!next.result]);
    if (k === key) return;
    key = k;
    const winners = next.draw ? next.leaderIds : [next.winnerId];
    const ranked = [...next.classes].sort((x, y) => y.score - x.score);
    const name = (id) => next.classes.find((c) => c.classId === id)?.name || "";
    const head = next.draw
      ? `<h1 class="lpw-title">🤝 OAVGJORT!</h1><p class="lpw-lead">${winners.map((id) => `<b style="color:${colors[id]}">${esc(name(id))}</b>`).join(" och ")} delar segern!</p>`
      : `<h1 class="lpw-title">VINNARE – <span style="color:${colors[next.winnerId]}">${esc(name(next.winnerId))}</span>!</h1>`;
    const players = next.classes.reduce((n, c) => n + c.joined, 0);
    // Före sparat result: samma utfall som buildResult kommer att spara.
    const utfall = next.result || { winnerClasses: next.classes.some((c) => c.score > 0) ? winners : [] };
    const pris = prizeText(next.session, utfall);
    inner.innerHTML = `
        ${TROPHY}
        ${head}
        ${pris ? `<p class="lp-prize lpw-prize">🪙 ${esc(pris)}</p>` : ""}
        <div class="lpw-cards">${ranked.map((c) => `
          <div class="lpw-card${winners.includes(c.classId) ? " vann" : ""}" style="--c:${colors[c.classId]}">
            ${winners.includes(c.classId) ? `<i class="lpw-crown">👑</i>` : ""}
            <div class="lpw-cname">${esc(c.name)}</div>
            <div class="lpw-score">${formatScore(c.score)}</div>
            <div class="lpw-unit">poäng/elev</div>
            <div class="lpw-sub">${c.correct} rätt ÷ ${c.divisor}</div>
          </div>`).join("")}
        </div>
        <div class="lpw-totals">
          <span>✅ <b>${next.totalCorrect}</b> rätt svar totalt</span>
          <span>👥 <b>${players}</b> elever spelade</span>
        </div>
        ${next.top.length ? `<div class="lpw-stars">⭐ Matchens stjärnor: ${next.top.slice(0, 3).map((p, i) =>
          `<span>${MEDALS[i]} ${esc(p.name || "Elev")} <small>${esc(next.session?.classNames?.[p.classId] || "")} · ${p.correct}</small></span>`).join("")}</div>` : ""}
        <div class="lpw-foot">
          ${onBack ? `<button class="lp-btn" data-back>← Till Live</button>` : ""}
          <span>${next.result ? "Resultatet är sparat i historiken." : "Sparar resultatet…"}</span>
        </div>`;
    inner.querySelector("[data-back]")?.addEventListener("click", onBack);
    if (celebrate) {
      celebrate = false; // en gång – omritningar (t.ex. "sparat") startar inte om den
      const palette = [...winners.map((id) => colors[id]), "#ffd23d", "#ffffff", ...winners.map((id) => colors[id])];
      stop = confetti(root.querySelector(".lpw-confetti"), palette);
    }
  }

  update(st);
  return { update, destroy: () => stop() };
}
