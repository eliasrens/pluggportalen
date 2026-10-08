// ============================================================================
// Trollkarlsduellen (#536): ARENAN (ArenaRenderer, spec §6.1) – magisk duellsal
// i designrummet 1600 × 900: valv och pelare, facklor, stengolv i perspektiv,
// runcirklar på golvet, dimma, svävande ljuskulor och stjärnor.
// Allt byggs EN gång (SVG + några spann); levandet är ren CSS-animation
// (transform/opacity, trollkarl.css) och stängs av vid prefers-reduced-motion.
// Bakgrunden är medvetet mörk och lugn – den får aldrig ta över figurer,
// poäng eller klocka.
//
// API: createArena() → { el, setMood("" | "high" | "final" | "finale"), destroy() }
// ============================================================================

const W = 1600;
const H = 900;
const FLOOR = 640;

function arch(x, w) {
  const h = 430;
  return `<path d="M${x} ${FLOOR - 20} V${FLOOR - h + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${FLOOR - h + w / 2} V${FLOOR - 20}"
    fill="url(#tk-valv)" stroke="#3c3466" stroke-width="10"/>`;
}

function pillar(x) {
  return `<g><rect x="${x - 34}" y="120" width="68" height="${FLOOR - 120}" fill="url(#tk-pelare)"/>
    <rect x="${x - 48}" y="104" width="96" height="26" rx="6" fill="#4a3f7a"/>
    <rect x="${x - 48}" y="${FLOOR - 26}" width="96" height="26" rx="6" fill="#3a315f"/></g>`;
}

function torch(x, y) {
  return `<g transform="translate(${x} ${y})"><rect x="-6" y="0" width="12" height="46" rx="4" fill="#5b4632"/>
    <path d="M-16 0 H16 L10 10 H-10Z" fill="#7a6248"/>
    <g class="tka-flame"><path d="M0 -44 C14 -24 16 -10 0 0 C-16 -10 -14 -24 0 -44Z" fill="#ffb347"/>
      <path d="M0 -30 C7 -18 8 -8 0 -2 C-8 -8 -7 -18 0 -30Z" fill="#fff1a8"/></g>
    <circle class="tka-glow" r="90" cy="-20" fill="url(#tk-fackelsken)"/></g>`;
}

function runeCircle(cx, cy, rx, cls) {
  const ry = rx * 0.26;
  const runes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<text x="${(cx + Math.cos(a) * rx * 0.82).toFixed(1)}" y="${(cy + Math.sin(a) * ry * 0.82 + 6).toFixed(1)}" text-anchor="middle">${"ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ"[i]}</text>`;
  }).join("");
  return `<g class="tka-rune ${cls}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="currentColor" stroke-width="4"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.7}" ry="${ry * 0.7}" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="14 10"/>
    <g font-size="22" fill="currentColor">${runes}</g></g>`;
}

export function createArena() {
  const el = document.createElement("div");
  el.className = "tka";
  el.setAttribute("aria-hidden", "true");
  const stones = [];
  for (let row = 0; row < 6; row++) {
    const y0 = FLOOR + row * row * 7 + row * 22;
    stones.push(`<path d="M0 ${y0} H${W}" stroke="#2a2348" stroke-width="${2 + row}" />`);
  }
  for (let i = -10; i <= 10; i++) {
    stones.push(`<path d="M${W / 2 + i * 40} ${FLOOR} L${W / 2 + i * 190} ${H}" stroke="#2a2348" stroke-width="3"/>`);
  }
  el.innerHTML = `
    <svg class="tka-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="tk-vagg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140f33"/><stop offset="1" stop-color="#2a2160"/></linearGradient>
        <linearGradient id="tk-valv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0820"/><stop offset="1" stop-color="#231a52"/></linearGradient>
        <linearGradient id="tk-pelare" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2e2758"/><stop offset=".45" stop-color="#4b4188"/><stop offset="1" stop-color="#241e47"/></linearGradient>
        <linearGradient id="tk-golv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3170"/><stop offset="1" stop-color="#191437"/></linearGradient>
        <radialGradient id="tk-fackelsken"><stop offset="0" stop-color="#ffb347" stop-opacity=".45"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
        <radialGradient id="tk-mitt" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#b48cff" stop-opacity=".35"/><stop offset="1" stop-color="#b48cff" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${W}" height="${FLOOR}" fill="url(#tk-vagg)"/>
      ${arch(250, 260)}${arch(670, 260)}${arch(1090, 260)}
      <g class="tka-starsky">${Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 389) % 1500 + 50}" cy="${(i * 137) % 300 + 140}" r="${1.5 + (i % 3)}" fill="#fff" opacity="${0.25 + (i % 4) * 0.12}"/>`).join("")}</g>
      ${pillar(110)}${pillar(560)}${pillar(1040)}${pillar(1490)}
      ${torch(335, 300)}${torch(1265, 300)}
      <ellipse cx="${W / 2}" cy="330" rx="420" ry="260" fill="url(#tk-mitt)"/>
      <rect y="${FLOOR}" width="${W}" height="${H - FLOOR}" fill="url(#tk-golv)"/>
      ${stones.join("")}
      ${runeCircle(420, 790, 230, "tka-rune-a")}${runeCircle(1180, 790, 230, "tka-rune-b")}
      ${runeCircle(W / 2, 760, 120, "tka-rune-mitt")}
    </svg>
    <div class="tka-mist"><i></i><i></i></div>
    <div class="tka-orbs">${Array.from({ length: 7 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>
    <div class="tka-motes">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>
    <div class="tka-dim"></div>`;
  return {
    el,
    setMood(m) { el.dataset.mood = m || ""; },
    destroy() { el.remove(); },
  };
}
