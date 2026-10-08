// ============================================================================
// Trollkarlsduellen (#536): PLATSHÅLLARFIGUR med samma API som del B:s riktiga
// trollkarl (trollkarl-figur.js, #537). Enkla former – bara så att arenan,
// kön och attackflödet går att bygga och testa innan B landar. Byts på EN rad
// i trollkarl-figurval.js.
//
// API (= B:s kontrakt)
//   createWizard(host, { who: "rasmus"|"elias", facing: "right"|"left", reducedMotion }) → {
//     el, setExpression("neutral"|"happy"|"angry"|"sad"|"surprised"),
//     play(pose, { duration? }) → Promise, setIdle(on), idleEvents(on),
//     anchor("wandTip"|"head"|"hat"|"body"|"feet") → { x, y } i VIEWPORT-px,
//     layer("hat"|"head"|"body"|"armL"|"armR"|"wand"|"cape") → Element,
//     transform(kind | null), reset(), destroy()
//   }
//   Poser: idle charge cast hit stagger dizzy fall getUp jump spin laugh cheer
//          worried victory defeat
// ============================================================================

const LOOK = {
  rasmus: { robe: "#d9481f", trim: "#ffcf4d", hat: "#2f8f4e", band: "#ffcf4d", skin: "#f2c39b", hair: "#7a3b1d", star: "#ffe066" },
  elias: { robe: "#3557c9", trim: "#9fe3ff", hat: "#5b2fa0", band: "#9fe3ff", skin: "#efc6a4", hair: "#3b2a1e", star: "#c7f0ff" },
};

const MOUTH = {
  neutral: "M-10 6 Q0 10 10 6",
  happy: "M-13 3 Q0 18 13 3",
  angry: "M-11 10 Q0 3 11 10",
  sad: "M-11 12 Q0 3 11 12",
  surprised: "M-5 8 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0",
};

// Poser: [lager, keyframes, ms]. "fig" = hela figuren.
const POSES = {
  idle: [["fig", [{ transform: "none" }, { transform: "translateY(-4px)" }, { transform: "none" }], 900]],
  charge: [["armR", [{ transform: "rotate(0deg)" }, { transform: "rotate(-70deg)" }, { transform: "rotate(-62deg)" }], 800],
    ["fig", [{ transform: "none" }, { transform: "scale(1.04,.96)" }, { transform: "translateY(-6px)" }], 800]],
  cast: [["armR", [{ transform: "rotate(-60deg)" }, { transform: "rotate(25deg)" }, { transform: "rotate(10deg)" }], 600],
    ["fig", [{ transform: "none" }, { transform: "translateX(14px) rotate(4deg)" }, { transform: "none" }], 600]],
  hit: [["fig", [{ transform: "none" }, { transform: "translateX(-34px) rotate(-12deg)" }, { transform: "translateX(-10px) rotate(-3deg)" }, { transform: "none" }], 700]],
  stagger: [["fig", [{ transform: "none" }, { transform: "rotate(-9deg)" }, { transform: "rotate(8deg)" }, { transform: "rotate(-5deg)" }, { transform: "none" }], 1100]],
  dizzy: [["fig", [{ transform: "none" }, { transform: "rotate(-7deg)" }, { transform: "rotate(7deg)" }, { transform: "rotate(-7deg)" }, { transform: "rotate(7deg)" }, { transform: "none" }], 1600]],
  fall: [["fig", [{ transform: "none" }, { transform: "translateY(40px) rotate(-80deg)" }], 600, "forwards"]],
  getUp: [["fig", [{ transform: "translateY(40px) rotate(-80deg)" }, { transform: "translateY(-10px) rotate(5deg)" }, { transform: "none" }], 800]],
  jump: [["fig", [{ transform: "none" }, { transform: "scale(1.08,.9)" }, { transform: "translateY(-120px)" }, { transform: "none" }], 900]],
  spin: [["fig", [{ transform: "rotateY(0deg)" }, { transform: "rotateY(720deg)" }], 1000]],
  laugh: [["fig", [{ transform: "none" }, { transform: "translateY(-6px) rotate(-3deg)" }, { transform: "rotate(3deg)" }, { transform: "translateY(-6px) rotate(-3deg)" }, { transform: "none" }], 1100]],
  cheer: [["armR", [{ transform: "none" }, { transform: "rotate(-150deg)" }, { transform: "rotate(-130deg)" }, { transform: "rotate(-150deg)" }], 900],
    ["fig", [{ transform: "none" }, { transform: "translateY(-30px)" }, { transform: "none" }], 900]],
  worried: [["fig", [{ transform: "none" }, { transform: "scale(.96) translateX(-8px)" }, { transform: "scale(.97) translateX(-4px)" }], 800, "forwards"]],
  victory: [["armR", [{ transform: "none" }, { transform: "rotate(-160deg)" }], 700, "forwards"],
    ["fig", [{ transform: "none" }, { transform: "translateY(-40px)" }, { transform: "scale(1.06)" }], 900, "forwards"]],
  defeat: [["fig", [{ transform: "none" }, { transform: "translateY(36px) scale(.9,.8) rotate(-6deg)" }], 900, "forwards"]],
};

const TRANSFORMS = { frog: "🐸", chicken: "🐔", potato: "🥔", bubble: "🫧", banana: "🍌", default: "✨" };

function svg(who, L) {
  return `<svg class="tkw-svg" viewBox="-150 -400 300 410" aria-hidden="true">
  <g class="tkw-fig" data-layer="fig">
    <path data-layer="cape" d="M-62 -230 Q-95 -80 -78 0 H78 Q95 -80 62 -230 Z" fill="${L.robe}" opacity=".55"/>
    <g data-layer="armL"><path d="M-48 -205 Q-92 -150 -80 -95" stroke="${L.robe}" stroke-width="26" fill="none" stroke-linecap="round"/>
      <circle cx="-80" cy="-92" r="13" fill="${L.skin}"/></g>
    <g data-layer="body"><path d="M-52 -230 Q-70 -90 -72 0 H72 Q70 -90 52 -230 Q0 -250 -52 -230 Z" fill="${L.robe}"/>
      <path d="M-72 0 H72" stroke="${L.trim}" stroke-width="10"/><path d="M0 -236 V0" stroke="${L.trim}" stroke-width="5" opacity=".7"/>
      <circle data-anchor="body" cx="0" cy="-140" r="2" fill="none"/>
      <circle data-anchor="feet" cx="0" cy="0" r="2" fill="none"/></g>
    <g data-layer="head"><circle cx="0" cy="-272" r="44" fill="${L.skin}"/>
      <path d="M-44 -270 Q-48 -315 0 -318 Q48 -315 44 -270 Q30 -296 0 -298 Q-30 -296 -44 -270Z" fill="${L.hair}"/>
      ${who === "elias" ? `<g fill="none" stroke="#1f2937" stroke-width="3.5"><circle cx="-16" cy="-276" r="11"/><circle cx="16" cy="-276" r="11"/><path d="M-5 -276 H5"/></g>` : `<path d="M-30 -240 Q0 -215 30 -240 Q22 -228 0 -226 Q-22 -228 -30 -240Z" fill="${L.hair}"/>`}
      <circle class="tkw-eye" cx="-16" cy="-276" r="4.5" fill="#1f2937"/><circle class="tkw-eye" cx="16" cy="-276" r="4.5" fill="#1f2937"/>
      <path class="tkw-brow" d="M-26 -292 L-8 -290 M8 -290 L26 -292" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>
      <g transform="translate(0 -250)"><path class="tkw-mouth" d="${MOUTH.neutral}" stroke="#7a2e1d" stroke-width="4" fill="#7a2e1d" fill-opacity=".25" stroke-linecap="round"/></g>
      <circle data-anchor="head" cx="0" cy="-272" r="2" fill="none"/></g>
    <g data-layer="hat"><path d="M-62 -300 Q0 -322 62 -300 L40 -312 Q8 -400 -20 -380 Q-6 -350 -40 -312Z" fill="${L.hat}"/>
      <path d="M-58 -302 Q0 -320 58 -302" stroke="${L.band}" stroke-width="8" fill="none"/>
      <path d="M-4 -350 l4 -9 4 9 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6Z" fill="${L.star}"/>
      <circle data-anchor="hat" cx="-18" cy="-378" r="2" fill="none"/></g>
    <g data-layer="armR" style="transform-origin:46px -205px"><path d="M46 -205 Q92 -160 86 -110" stroke="${L.robe}" stroke-width="26" fill="none" stroke-linecap="round"/>
      <circle cx="86" cy="-106" r="13" fill="${L.skin}"/>
      <g data-layer="wand"><path d="M82 -100 L128 -190" stroke="#5a3a1a" stroke-width="8" stroke-linecap="round"/>
        <circle class="tkw-tip" cx="128" cy="-192" r="8" fill="${L.star}"/><circle data-anchor="wandTip" cx="128" cy="-192" r="2" fill="none"/></g></g>
  </g></svg>`;
}

export function createWizard(host, { who = "rasmus", facing = "right", reducedMotion = false } = {}) {
  const L = LOOK[who] || LOOK.rasmus;
  const el = document.createElement("div");
  el.className = `tkw tkw-${who}${facing === "left" ? " tkw-left" : ""}`;
  el.dataset.who = who;
  el.innerHTML = `${svg(who, L)}<div class="tkw-morph" hidden></div>`;
  host.appendChild(el);
  const q = (s) => el.querySelector(s);
  const layers = Object.fromEntries([...el.querySelectorAll("[data-layer]")].map((n) => [n.dataset.layer, n]));
  const anims = new Set();
  let idleT = 0;

  function setExpression(e) {
    el.dataset.expr = MOUTH[e] ? e : "neutral";
    q(".tkw-mouth").setAttribute("d", MOUTH[el.dataset.expr]);
  }

  function play(pose, { duration } = {}) {
    const spec = POSES[pose] || POSES.idle;
    const runs = spec.map(([layer, frames, ms, fill]) => {
      const node = layers[layer];
      if (!node?.animate) return Promise.resolve();
      const a = node.animate(frames, { duration: reducedMotion ? Math.min(250, ms) : duration || ms, easing: "ease-in-out", fill: fill || "none" });
      anims.add(a);
      return a.finished.catch(() => {}).finally(() => { if (!fill) anims.delete(a); });
    });
    return Promise.all(runs).then(() => {});
  }

  function idleEvents(on) {
    clearTimeout(idleT);
    if (!on || reducedMotion) return;
    const next = () => {
      idleT = setTimeout(() => {
        // Platshållarens enda småhändelse: staven blänker till.
        q(".tkw-tip")?.animate?.([{ r: 8, opacity: 1 }, { r: 16, opacity: 0.6 }, { r: 8, opacity: 1 }], { duration: 700 });
        next();
      }, 7000 + Math.random() * 8000);
    };
    next();
  }

  function transform(kind) {
    const m = q(".tkw-morph");
    if (!kind) {
      m.hidden = true;
      q(".tkw-svg").style.opacity = "";
      return Promise.resolve();
    }
    m.textContent = TRANSFORMS[kind] || TRANSFORMS.default;
    m.hidden = false;
    q(".tkw-svg").style.opacity = "0";
    return Promise.resolve();
  }

  function reset() {
    for (const a of anims) a.cancel();
    anims.clear();
    setExpression("neutral");
    transform(null);
  }

  setExpression("neutral");
  return {
    el,
    setExpression,
    play,
    setIdle(on) { el.classList.toggle("tkw-idle", !!on && !reducedMotion); },
    idleEvents,
    anchor(name) {
      const n = el.querySelector(`[data-anchor="${name}"]`) || el.querySelector('[data-anchor="body"]');
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    layer: (name) => layers[name] || null,
    transform,
    reset,
    destroy() {
      clearTimeout(idleT);
      reset();
      el.remove();
    },
  };
}
