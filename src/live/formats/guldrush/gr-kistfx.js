// ============================================================================
// Guldrushen (#564): KISTORNAS EFFEKTER – ett eget utseende per `look` i
// kistkonfigen (designspec §6.4). En ny kisttyp väljer ett befintligt look-id i
// delat/chests-config.js, eller lägger sin effekt i LOOKS här. Okänt look →
// kistans ikon hoppar upp (aldrig ett fel).
//
//   mynt-hopp      några mynt hoppar upp              (🪙 Lite guld)
//   mynt-fontan    en fontän av mynt                  (💰 Guld)
//   adelstenar     ädelstenar + mynt som glittrar     (💎 Mycket guld)
//   guldexplosion  kistan exploderar i guld, krona, stjärnor (👑 Skattkammare)
//   siffra-delas   guldsiffran blinkar och delar sig i två  (✖️2 Dubbla)
//   tvattbjorn     tvättbjörn med ögonmask tittar upp och blinkar (🦝 Stöld)
//   guldpilar      två guldpilar snurrar runt varandra (🔄 Byte)
//   mynt-rullar    mynt rullar iväg ur bild            (🕳️ Hål i fickan)
//   lov-dammpuff   ett löv singlar ner + liten dammpuff (🍃 Tom kista)
//   skold-glod     en lysande sköld flyger till avataren (🛡️ Sköld)
//
// Bara transform och opacitet (Web Animations API, §11); få partiklar (högst
// ~14). Varje effekt är klar inom ~0,95 s – hela kistförloppet ≤ ~1,5 s.
// Reducerad rörelse: effektens bild tonar in och ut på plats (ingen färd, ingen
// skakning) – informationen (bildtext + guld) visas ändå.
//
// API
//   LOOKS                       look-id:n som har en egen effekt
//   playLook(look, { fx, chest?, gold?, avatar?, icon?, reduced? }) → Promise
//     fx      partikelytan över kistan (.grk-fx, font-size ≈ kistbredd/6)
//     chest   kistans svg (skakas vid explosion), gold = guldsiffran (Dubbla),
//     avatar  elevens .lav (Sköld flyger dit)
//   svgOf(name) → inline-SVG (krona, tvättbjörn, pilar, löv, sköld, ädelsten)
// ============================================================================

const EASE = "cubic-bezier(.2,.8,.3,1)";
const GEM_COLORS = ["#e53950", "#2f7de1", "#22b573", "#9b51e0"];

const SVG = {
  krona: `<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M4 40 L8 12 L22 26 L32 6 L42 26 L56 12 L60 40 Z" fill="#ffd23f" stroke="#c98a00" stroke-width="3" stroke-linejoin="round"/><rect x="4" y="38" width="56" height="8" rx="3" fill="#f4b400" stroke="#c98a00" stroke-width="3"/><circle cx="32" cy="30" r="4" fill="#e53950"/><circle cx="18" cy="33" r="3" fill="#2f7de1"/><circle cx="46" cy="33" r="3" fill="#22b573"/></svg>`,
  tvattbjorn: `<svg viewBox="0 0 100 86" aria-hidden="true"><path d="M14 30 L20 4 L40 22 Z M86 30 L80 4 L60 22 Z" fill="#7d7f8a"/><path d="M20 24 L22 11 L32 21 Z M80 24 L78 11 L68 21 Z" fill="#3a3b42"/><ellipse cx="50" cy="50" rx="42" ry="34" fill="#a3a5b0"/><ellipse cx="50" cy="64" rx="24" ry="17" fill="#f1f1f4"/><path d="M8 44 Q22 30 40 40 Q50 46 60 40 Q78 30 92 44 Q80 58 62 52 Q50 48 38 52 Q20 58 8 44 Z" fill="#26272d"/><g class="grfx-oga"><ellipse cx="33" cy="45" rx="7" ry="7.5" fill="#fff"/><circle cx="34.5" cy="46" r="3.6" fill="#111"/></g><g class="grfx-oga grfx-blink"><ellipse cx="67" cy="45" rx="7" ry="7.5" fill="#fff"/><circle cx="65.5" cy="46" r="3.6" fill="#111"/></g><ellipse cx="50" cy="60" rx="6" ry="4.5" fill="#26272d"/><path d="M44 69 Q50 74 56 69" stroke="#26272d" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
  pilar: `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#ffc928" stroke-width="10" stroke-linecap="round"><path d="M22 42 A30 30 0 0 1 74 30"/><path d="M78 58 A30 30 0 0 1 26 70"/></g><path d="M66 14 L88 30 L62 40 Z M34 86 L12 70 L38 60 Z" fill="#ffc928" stroke="#c98a00" stroke-width="3" stroke-linejoin="round"/></svg>`,
  lov: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 34 C6 14 20 4 36 4 C36 22 26 34 6 34 Z" fill="#6cbf3a" stroke="#3f8a1e" stroke-width="2"/><path d="M8 32 C16 22 24 14 32 8" stroke="#3f8a1e" stroke-width="2" fill="none"/></svg>`,
  skold: `<svg viewBox="0 0 60 70" aria-hidden="true"><path d="M30 3 L56 13 L56 34 C56 52 44 62 30 67 C16 62 4 52 4 34 L4 13 Z" fill="#5fb4ff" stroke="#1d5fae" stroke-width="4" stroke-linejoin="round"/><path d="M30 12 L48 19 L48 34 C48 47 40 54 30 58 Z" fill="#fff" opacity=".45"/><path d="M20 34 L28 42 L42 26" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sten: (c) => `<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,1 18,7 10,19 2,7" fill="${c}"/><polygon points="10,1 18,7 2,7" fill="#fff" opacity=".4"/><polygon points="10,19 18,7 14,7" fill="#000" opacity=".15"/></svg>`,
};

export function svgOf(name, arg) {
  const s = SVG[name];
  return typeof s === "function" ? s(arg) : s || "";
}

function part(fx, cls, html = "") {
  const p = document.createElement("span");
  p.className = `grfx ${cls}`;
  p.innerHTML = html;
  fx.appendChild(p);
  return p;
}

function run(el, frames, opts) {
  const a = el.animate(frames, { easing: EASE, fill: "backwards", ...opts });
  return a.finished.catch(() => {}).then(() => el.remove());
}

// Förflyttning i em på partikelytan – partikeln själv har font-size 1em
// (större tecken ligger i ett inre <b>), annars skalas sträckan med tecknet.
const at = (x, y, extra = "") => `translate(calc(-50% + ${x}em), calc(-50% + ${y}em)) ${extra}`;

/** Mynt i en båge: från öppningen till (dx, dy) och lite tillbaka ned. */
function coinArc(fx, dx, dy, { delay = 0, dur = 650, fall = 1.2, spin = 0, cls = "grfx-mynt" } = {}) {
  const c = part(fx, cls);
  return run(c, [
    { transform: at(0, 0, "scale(.5)"), opacity: 0 },
    { offset: 0.12, opacity: 1 },
    { offset: 0.55, transform: at(dx * 0.8, dy, `rotate(${spin / 2}deg)`) },
    { transform: at(dx, dy + fall, `rotate(${spin}deg)`), opacity: 0 },
  ], { duration: dur, delay });
}

function sparkle(fx, x, y, delay) {
  const s = part(fx, "grfx-gnista", "✦");
  return run(s, [
    { transform: at(x, y, "scale(0) rotate(0)"), opacity: 0 },
    { offset: 0.5, transform: at(x, y, "scale(1.3) rotate(90deg)"), opacity: 1 },
    { transform: at(x, y, "scale(0) rotate(180deg)"), opacity: 0 },
  ], { duration: 420, delay, easing: "ease-in-out" });
}

function rise(fx, cls, html, { to = -3, scale = 1, dur = 850, hold = 0.6 } = {}) {
  const el = part(fx, cls, html);
  return run(el, [
    { transform: at(0, 0.6, "scale(.3)"), opacity: 0 },
    { offset: 0.3, transform: at(0, to, `scale(${scale * 1.1})`), opacity: 1 },
    { offset: hold, transform: at(0, to - 0.2, `scale(${scale})`), opacity: 1 },
    { transform: at(0, to - 0.6, `scale(${scale})`), opacity: 0 },
  ], { duration: dur });
}

const LOOK_FNS = {
  "mynt-hopp": ({ fx }) => Promise.all([-1.6, -0.8, 0, 0.8, 1.6].map((dx, i) =>
    coinArc(fx, dx, -2.2 - (i % 2) * 0.8, { delay: i * 45, spin: dx * 90 }))),

  "mynt-fontan": ({ fx }) => Promise.all(Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    return coinArc(fx, (t - 0.5) * 6, -3.6 - Math.sin(t * Math.PI) * 1.6, { delay: (i % 6) * 40, dur: 780, fall: 2.4, spin: (t - 0.5) * 540 });
  })),

  "adelstenar": ({ fx }) => Promise.all([
    ...GEM_COLORS.map((c, i) => {
      const g = part(fx, "grfx-sten", svgOf("sten", c));
      const x = (i - 1.5) * 1.5;
      const y = -2.4 - (i % 2) * 0.9;
      return run(g, [
        { transform: at(0, 0, "scale(.3)"), opacity: 0 },
        { offset: 0.35, transform: at(x, y, "scale(1.15) rotate(-8deg)"), opacity: 1 },
        { offset: 0.7, transform: at(x, y - 0.3, "scale(1) rotate(8deg)"), opacity: 1 },
        { transform: at(x, y - 0.6, "scale(.9)"), opacity: 0 },
      ], { duration: 880, delay: i * 50 });
    }),
    ...[[-2.4, -3.4], [2.2, -3.8], [0, -4.4], [-1, -1.6], [1.4, -1.8], [2.8, -2.2]].map(([x, y], i) => sparkle(fx, x, y, 180 + i * 80)),
    coinArc(fx, -1, -1.8, { delay: 60 }), coinArc(fx, 1.1, -2, { delay: 120 }),
  ]),

  "guldexplosion": ({ fx, chest }) => {
    chest?.animate([{ transform: "none" }, { transform: "translate(-3%, 0) rotate(-3deg)", offset: 0.25 },
      { transform: "translate(3%, 0) rotate(3deg)", offset: 0.5 }, { transform: "scale(1.06)", offset: 0.75 }, { transform: "none" }], { duration: 300 });
    const burst = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return coinArc(fx, Math.cos(a) * 4, Math.sin(a) * 3 - 1.5, { delay: 120 + (i % 3) * 30, dur: 760, fall: 0.8, spin: 360 });
    });
    const stars = [[-3, -3.6], [3.2, -3.2], [-1.8, -5], [2, -5.2]].map(([x, y], i) => {
      const s = part(fx, "grfx-stjarna", "<b>★</b>");
      return run(s, [{ transform: at(0, -1, "scale(.2)"), opacity: 0 }, { offset: 0.4, transform: at(x, y, "scale(1.3) rotate(72deg)"), opacity: 1 },
        { transform: at(x * 1.1, y - 0.4, "scale(.8) rotate(144deg)"), opacity: 0 }], { duration: 820, delay: 200 + i * 50 });
    });
    return Promise.all([...burst, ...stars, rise(fx, "grfx-krona", svgOf("krona"), { to: -3.4, scale: 1.25, dur: 950, hold: 0.75 })]);
  },

  "siffra-delas": ({ fx, gold }) => {
    const jobs = [rise(fx, "grfx-text", "<b>×2</b>", { to: -2.6, scale: 1.2, dur: 800 })];
    if (gold?.parentNode) {
      gold.animate([{ transform: "none", filter: "brightness(1)" }, { transform: "scale(1.25)", filter: "brightness(1.6)", offset: 0.25 },
        { transform: "scale(1)", filter: "brightness(1)", offset: 0.5 }, { transform: "scale(1.15)", filter: "brightness(1.5)", offset: 0.75 },
        { transform: "none", filter: "brightness(1)" }], { duration: 800 });
      for (const dir of [-1, 1]) {
        const ghost = gold.cloneNode(true);
        ghost.className = "gr-guld-skugga";
        ghost.setAttribute("aria-hidden", "true");
        gold.parentNode.appendChild(ghost);
        jobs.push(run(ghost, [{ transform: "translate(0, 0)", opacity: 0.9 }, { offset: 0.3, transform: "translate(0, 0) scale(1.05)", opacity: 0.9 },
          { transform: `translate(${dir * 70}%, -30%) scale(.8)`, opacity: 0 }], { duration: 760, delay: 120 }));
      }
    }
    return Promise.all(jobs);
  },

  "tvattbjorn": ({ fx }) => {
    const r = part(fx, "grfx-tvattbjorn", svgOf("tvattbjorn"));
    const eye = r.querySelector(".grfx-blink");
    eye?.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(.1)", offset: 0.5 }, { transform: "scaleY(1)" }], { duration: 180, delay: 470 });
    return run(r, [
      { transform: at(0, 0.8, "scale(.7)"), opacity: 0 },
      { offset: 0.25, transform: at(0, -1.8, "scale(1.05)"), opacity: 1 },
      { offset: 0.35, transform: at(0, -1.5, "scale(1) rotate(-6deg)"), opacity: 1 },
      { offset: 0.8, transform: at(0, -1.5, "rotate(6deg)"), opacity: 1 },
      { transform: at(0, -1.2), opacity: 0 },
    ], { duration: 900 });
  },

  "guldpilar": ({ fx }) => {
    const p = part(fx, "grfx-pilar", svgOf("pilar"));
    return run(p, [
      { transform: at(0, -1.8, "scale(.3) rotate(0deg)"), opacity: 0 },
      { offset: 0.2, transform: at(0, -2.2, "scale(1.1) rotate(120deg)"), opacity: 1 },
      { offset: 0.8, transform: at(0, -2.2, "scale(1) rotate(560deg)"), opacity: 1 },
      { transform: at(0, -2.2, "scale(.6) rotate(720deg)"), opacity: 0 },
    ], { duration: 880, easing: "cubic-bezier(.4,.1,.4,1)" });
  },

  "mynt-rullar": ({ fx }) => Promise.all([1, -1, 1, 1].map((dir, i) => {
    const c = part(fx, "grfx-mynt grfx-mynt-kant");
    return run(c, [
      { transform: at(0, 0.3), opacity: 0 },
      { offset: 0.15, transform: at(dir * 0.6, 1.2, "rotate(0deg)"), opacity: 1 },
      { offset: 0.8, opacity: 1 },
      { transform: at(dir * (9 + i), 1.9, `rotate(${dir * 720}deg)`), opacity: 0 },
    ], { duration: 820, delay: i * 90, easing: "cubic-bezier(.5,0,.8,.6)" });
  })),

  "lov-dammpuff": ({ fx }) => {
    const puffs = [-1, 0, 1].map((x, i) => {
      const d = part(fx, "grfx-damm");
      return run(d, [{ transform: at(x * 0.8, 0, "scale(.3)"), opacity: 0.9 }, { transform: at(x * 1.6, -0.9, "scale(1.6)"), opacity: 0 }],
        { duration: 600, delay: i * 50 });
    });
    const leaf = part(fx, "grfx-lov", svgOf("lov"));
    return Promise.all([...puffs, run(leaf, [
      { transform: at(0, -0.5, "rotate(0)"), opacity: 0 },
      { offset: 0.2, transform: at(0.4, -3.2, "rotate(-20deg)"), opacity: 1 },
      { offset: 0.45, transform: at(-0.9, -2.4, "rotate(25deg)") },
      { offset: 0.7, transform: at(0.8, -1.6, "rotate(-20deg)") },
      { transform: at(-0.4, -0.6, "rotate(15deg)"), opacity: 0 },
    ], { duration: 950, easing: "ease-in-out" })]);
  },

  "skold-glod": ({ fx, avatar }) => {
    const s = part(fx, "grfx-skold", svgOf("skold"));
    let to = "";
    const a = avatar?.getBoundingClientRect?.();
    const f = fx.getBoundingClientRect?.();
    const em = parseFloat(getComputedStyle(fx).fontSize) || 30;
    if (a && f && a.width) {
      const dx = (a.left + a.width / 2 - (f.left + f.width / 2)) / em;
      const dy = (a.top + a.height / 2 - (f.top + f.height * 0.42)) / em;
      to = at(dx, dy, "scale(.6)");
    }
    return run(s, [
      { transform: at(0, 0.4, "scale(.3)"), opacity: 0 },
      { offset: 0.3, transform: at(0, -2.4, "scale(1.15)"), opacity: 1 },
      { offset: 0.5, transform: at(0, -2.4, "scale(1)"), opacity: 1 },
      { transform: to || at(0, -3.4, "scale(.8)"), opacity: 0 },
    ], { duration: 850, easing: "cubic-bezier(.5,.1,.3,1)" });
  },
};

export const LOOKS = Object.freeze(Object.keys(LOOK_FNS));

// Reducerad rörelse: effektens bild tonar in/ut på plats.
const STILL = {
  "mynt-hopp": "🪙", "mynt-fontan": "💰", "adelstenar": svgOf("sten", GEM_COLORS[1]), "guldexplosion": svgOf("krona"),
  "siffra-delas": "×2", "tvattbjorn": svgOf("tvattbjorn"), "guldpilar": svgOf("pilar"), "mynt-rullar": "🕳️",
  "lov-dammpuff": svgOf("lov"), "skold-glod": svgOf("skold"),
};

export function playLook(look, { fx, chest = null, gold = null, avatar = null, icon = "🎁", reduced = false } = {}) {
  if (!fx || typeof fx.animate !== "function") return Promise.resolve();
  const fn = LOOK_FNS[look];
  if (reduced || !fn) {
    const el = part(fx, "grfx-still", `<b>${STILL[look] || icon}</b>`);
    return run(el, [{ transform: at(0, -2.2), opacity: 0 }, { offset: 0.3, opacity: 1 }, { offset: 0.75, opacity: 1 }, { transform: at(0, -2.2), opacity: 0 }],
      { duration: 850, easing: "ease-in-out" });
  }
  try {
    return Promise.resolve(fn({ fx, chest, gold, avatar })).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}
