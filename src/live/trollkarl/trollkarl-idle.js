// ============================================================================
// Trollkarlsduellen (#537): idle-liv + slumpade småhändelser (§10).
// Andning/mantel/stavglöd är oändliga WAAPI-loopar på composite:"add" så de
// kan ligga kvar under poser utan att krocka med posens "replace"-transform…
// nej – de PAUSAS av figuren när en pos spelar (§11-prioritering) och återupptas
// efteråt. Småhändelserna (nysning, glasögonputs, stav-fummel, klock-koll)
// körs av en enkel scheduler som bara triggar när ingen pos har företräde.
// ============================================================================

const IDLE_LOOPS = [
  // [del, keyframes, duration, easing]
  ["body", [
    { transform: "scale(1,1)" }, { transform: "scale(1.012,0.988)" }, { transform: "scale(1,1)" },
  ], 3200, "ease-in-out"],
  ["head", [
    { transform: "translate(0px,0px) rotate(0deg)" },
    { transform: "translate(0px,2.5px) rotate(-1.2deg)" },
    { transform: "translate(0px,0px) rotate(0deg)" },
    { transform: "translate(0px,2px) rotate(1deg)" },
    { transform: "translate(0px,0px) rotate(0deg)" },
  ], 6400, "ease-in-out"],
  ["cape", [
    { transform: "rotate(0deg)" }, { transform: "rotate(1.6deg)" }, { transform: "rotate(-1.2deg)" }, { transform: "rotate(0deg)" },
  ], 4800, "ease-in-out"],
  ["armR", [
    { transform: "rotate(0deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(0deg)" },
  ], 3600, "ease-in-out"],
  ["hat", [
    { transform: "translate(0px,0px)" }, { transform: "translate(0px,1.5px)" }, { transform: "translate(0px,0px)" },
  ], 3200, "ease-in-out"],
];

// Tillfällig SVG-rekvisita i figurens egen svg (rökpuff, fjäril …). animFn(g)
// startar animationen; elementet tas alltid bort efter ttl ms (#539).
function tempSvg(parts, inner, animFn, ttl = 3000) {
  const svg = parts.fig?.ownerSVGElement;
  if (!svg) return null;
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.innerHTML = inner;
  svg.appendChild(g);
  try { animFn?.(g); } catch { /* en missad animation är ofarlig */ }
  setTimeout(() => g.remove(), ttl);
  return g;
}

// Småhändelser: körs som vanliga pos-steg via figurens play-mekanik vore för
// tungt – de är korta mikro-animationer direkt här. Varje händelse
// returnerar sin längd i ms.
export const IDLE_EVENTS = [
  function blink({ parts }) { // "blinkning": snabb squint av hela ansiktslagret
    parts.face?.animate(
      [{ transform: "scale(1,1)" }, { transform: "scale(1,0.86)" }, { transform: "scale(1,1)" }],
      { duration: 160, easing: "ease-in-out" });
    return 200;
  },
  function glance({ parts }) { // blick/nick mot motståndaren
    parts.head?.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(0deg)" }],
      { duration: 1200, easing: "ease-in-out" });
    return 1300;
  },
  function footsie({ parts }) { // otålig liten fotvippning (hela figuren gungar)
    parts.fig?.animate(
      [{ transform: "translate(0px,0px)" }, { transform: "translate(2px,-2px)" }, { transform: "translate(0px,0px)" },
       { transform: "translate(2px,-2px)" }, { transform: "translate(0px,0px)" }],
      { duration: 900, easing: "ease-in-out" });
    return 1000;
  },
  function wandFumble({ parts }) { // tappar nästan staven och fångar den
    parts.forearmR?.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(34deg)" }, { transform: "rotate(-14deg)" }, { transform: "rotate(0deg)" }],
      { duration: 800, easing: "cubic-bezier(.34,1.56,.64,1)" });
    parts.wand?.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(30deg)" }, { transform: "rotate(-10deg)" }, { transform: "rotate(0deg)" }],
      { duration: 800, easing: "cubic-bezier(.34,1.56,.64,1)" });
    return 900;
  },
  function polish({ parts, api }) { // Elias putsar glasögonen / Rasmus gnuggar näsan
    api.setExpression("happy");
    parts.armL?.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(-96deg)" }, { transform: "rotate(-90deg)" },
       { transform: "rotate(-96deg)" }, { transform: "rotate(0deg)" }],
      { duration: 1500, easing: "ease-in-out" });
    parts.head?.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(7deg)" }, { transform: "rotate(7deg)" }, { transform: "rotate(0deg)" }],
      { duration: 1500, easing: "ease-in-out" });
    setTimeout(() => api.setExpression(api.baseExpression()), 1600);
    return 1700;
  },
  function sparks({ api }) { // stavgnistor
    api.setGlow(1);
    setTimeout(() => api.setGlow(0), 700);
    return 800;
  },
  function hatBounce({ parts }) { // hatten hoppar till
    parts.hat?.animate(
      [{ transform: "translate(0px,0px) rotate(0deg)" }, { transform: "translate(0px,-10px) rotate(-6deg)" },
       { transform: "translate(0px,2px) rotate(2deg)" }, { transform: "translate(0px,0px) rotate(0deg)" }],
      { duration: 700, easing: "cubic-bezier(.34,1.56,.64,1)" });
    return 800;
  },
  function hatTrick({ parts, api }) { // (#539 §10) försöker trolla ur hatten – bara en rökpuff
    parts.armL?.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(-148deg)" }, { transform: "rotate(-140deg)" },
       { transform: "rotate(-148deg)" }, { transform: "rotate(0deg)" }],
      { duration: 1900, easing: "ease-in-out" });
    parts.hat?.animate(
      [{ transform: "translate(0px,0px) rotate(0deg)" }, { transform: "translate(-6px,-14px) rotate(-10deg)" },
       { transform: "translate(-6px,-14px) rotate(-10deg)" }, { transform: "translate(0px,0px) rotate(0deg)" }],
      { duration: 1900, easing: "ease-in-out" });
    tempSvg(parts, `<circle cx="200" cy="30" r="14" fill="rgba(180,180,195,.85)"/>
      <circle cx="214" cy="14" r="9" fill="rgba(200,200,215,.7)"/>`, (g) =>
      g.animate([{ transform: "translate(0,0) scale(.3)", opacity: 0 },
        { transform: "translate(0,-20px) scale(1)", opacity: .9, offset: .45 },
        { transform: "translate(6px,-70px) scale(1.4)", opacity: 0 }],
        { duration: 1200, delay: 650, easing: "ease-out", fill: "both" }), 1900);
    setTimeout(() => api.setExpression("sad"), 900);
    setTimeout(() => api.setExpression(api.baseExpression()), 2000);
    return 2100;
  },
  function capeAdjust({ parts, api }) { // (#539 §10) rättar till manteln, extra självsäker
    api.setExpression("happy");
    parts.cape?.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(3deg)" }, { transform: "rotate(0deg)" }],
      { duration: 1300, easing: "ease-in-out" });
    parts.body?.animate(
      [{ transform: "scale(1,1)" }, { transform: "scale(1.04,1.015)" }, { transform: "scale(1.04,1.015)" }, { transform: "scale(1,1)" }],
      { duration: 1300, easing: "ease-in-out" });
    parts.head?.animate(
      [{ transform: "translate(0px,0px)" }, { transform: "translate(0px,-4px)" }, { transform: "translate(0px,-4px)" }, { transform: "translate(0px,0px)" }],
      { duration: 1300, easing: "ease-in-out" });
    setTimeout(() => api.setExpression(api.baseExpression()), 1400);
    return 1500;
  },
  function butterfly({ parts }) { // (#539 §10) en liten magisk fjäril flyger förbi
    const g = tempSvg(parts, `<g data-vinge><ellipse cx="-7" cy="0" rx="8" ry="11" fill="#d98fff"/>
      <ellipse cx="7" cy="0" rx="8" ry="11" fill="#b36bff"/></g>
      <rect x="-2" y="-8" width="4" height="16" rx="2" fill="#5b2fa0"/>`, (el) =>
      el.animate([{ transform: "translate(-80px,300px)", opacity: 1 },
        { transform: "translate(120px,210px)", opacity: 1, offset: .3 },
        { transform: "translate(260px,260px)", opacity: 1, offset: .6 },
        { transform: "translate(480px,160px)", opacity: 0 }],
        { duration: 2600, easing: "ease-in-out", fill: "both" }), 2650);
    g?.querySelector("[data-vinge]")?.animate(
      [{ transform: "scale(1,1)" }, { transform: "scale(.4,1)" }, { transform: "scale(1,1)" }],
      { duration: 240, iterations: 11 });
    parts.head?.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(4deg)" }, { transform: "rotate(0deg)" }],
      { duration: 2600, easing: "ease-in-out" });
    return 2700;
  },
  function challenge({ parts, api }) { // (#539 §10) utmanande gest mot motståndaren
    api.setExpression("angry");
    parts.armR?.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(-58deg)" }, { transform: "rotate(-52deg)" },
       { transform: "rotate(-58deg)" }, { transform: "rotate(0deg)" }],
      { duration: 1400, easing: "ease-in-out" });
    parts.head?.animate(
      [{ transform: "translate(0px,0px)" }, { transform: "translate(4px,-3px)" }, { transform: "translate(4px,-3px)" }, { transform: "translate(0px,0px)" }],
      { duration: 1400, easing: "ease-in-out" });
    setTimeout(() => api.setExpression(api.baseExpression()), 1500);
    return 1600;
  },
  function sneeze({ parts, api }) { // stjärna på näsan → nysning
    api.setExpression("surprised");
    parts.head?.animate(
      [{ transform: "translate(0px,0px) rotate(0deg)" }, { transform: "translate(0px,-4px) rotate(-8deg)" },
       { transform: "translate(6px,6px) rotate(14deg)" }, { transform: "translate(0px,0px) rotate(0deg)" }],
      { duration: 900, easing: "ease-out" });
    parts.hat?.animate(
      [{ transform: "translate(0px,0px)" }, { transform: "translate(0px,-16px)" }, { transform: "translate(0px,2px)" }, { transform: "translate(0px,0px)" }],
      { duration: 900, easing: "ease-out" });
    setTimeout(() => api.setExpression(api.baseExpression()), 1000);
    return 1100;
  },
];

// Startar idle-looparna. Returnerar {pause, resume, stop}.
export function startIdleLoops(parts, reducedMotion) {
  const anims = [];
  if (!reducedMotion) {
    for (const [part, kf, duration, easing] of IDLE_LOOPS) {
      const el = parts[part];
      if (el) anims.push(el.animate(kf, { duration, easing, iterations: Infinity }));
    }
  }
  return {
    pause() { for (const a of anims) a.pause(); },
    resume() { for (const a of anims) a.play(); },
    stop() { for (const a of anims) a.cancel(); },
  };
}

// Scheduler för småhändelser: slumpad paus 6–16 s, hoppar över när figuren
// är upptagen (busy() sant) och stör alltså aldrig en aktiv pos (§11).
export function createEventScheduler(parts, api, { reducedMotion, busy }) {
  let on = false;
  let timer = 0;
  const schedule = () => {
    timer = setTimeout(() => {
      if (!on) return;
      if (!busy() && !document.hidden) {
        const ev = IDLE_EVENTS[(Math.random() * IDLE_EVENTS.length) | 0];
        try { ev({ parts, api }); } catch { /* en missad småhändelse är ofarlig */ }
      }
      schedule();
    }, 6000 + Math.random() * 10000);
  };
  return {
    set(v) {
      v = !!v && !reducedMotion;
      if (v === on) return;
      on = v;
      clearTimeout(timer);
      if (on) schedule();
    },
    stop() { on = false; clearTimeout(timer); },
  };
}
