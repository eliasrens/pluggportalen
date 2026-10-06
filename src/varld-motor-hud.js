// ============================================================================
// Pluggporten – Pixi-rörelsens vakt + debug-HUD (#396, F4 #418, G1 #425)
// ----------------------------------------------------------------------------
// Laddas statiskt av varld-motor.js (som själv bara nås via import()).
//
// VAKTEN (alltid på när renderaren finns, vakta(r, yta) från motorn):
//   • budget efter verklig scenstorlek: maxPar = så många övergångar som ryms
//     i maxBytes (anpassaBudget) – annars förvärmer motorn mer än LRU:n rymmer.
//   • enhetsklass med workerns GPU-sträng (mjukvaru-GL → "svag").
//   • pp:pixi:maxtex=N: kör som om GPU:n hade MAX_TEXTURE_SIZE N (test).
//   • 30 s-städning (§6): pyramider som inte rörts sedan senaste landningen
//     (= inte grannövergångar till nivån man står på) och är äldre än 30 s släpps.
//   • context restore: förvärm igen när workern laddat upp texturerna.
//   • emoji: detektera färg-emoji i SVG-bild (varld-emoji.js); slår reserven
//     på byggs pyramiderna om (glyferna ska vara osynliga i SVG:n).
// HUD:en (bara med pp:pixi:debug): senaste övergången (väg, handoff, frame-dt-
// graf), fördelningen pixi/css:<orsak> över alla övergångar, handoff- och
// omspeglingstider (median/max), budget (LRU-summa ≤ maxBytes), workerns
// texturbokföring (texturer, bitmaps, bytes, GL-texturer), GPU, kontext, emoji.
// Test/mätning: window.__ppPixi.g1 = { stats(), matning(), nollstall(), stada(), rensaAllt(), emoji() }.
// ============================================================================

import { texturCache, konfiguration, stallIn } from "./varld-textur.js";
import { anpassaBudget, sattAnpassning, sattGpu } from "./varld-textur-budget.js";
import { rensaAllt, postLista } from "./varld-motor-textur.js";
import { upptack, emojiLage } from "./varld-emoji.js";
import { pixiFlaggor } from "./varld-render.js";

const MB = 1048576;
const TICK_MS = 2000;
const STADA_VAR = 5; // var 5:e tick = 10 s
export const STADA_MS = 30000;
/** Marginal före landningen: förvärmningens tak-väg (4 s) rör inte posten. */
const LANDNING_MARGINAL_MS = 5000;
const FLAGGOR = ["av", "tvinga", "debug", "frys", "klass", "maxtex", "emoji"];

const lasStr = (namn) => {
  try { return localStorage.getItem(`pp:pixi:${namn}`); } catch { return null; }
};
const skriv = (namn, v) => {
  try { v == null ? localStorage.removeItem(`pp:pixi:${namn}`) : localStorage.setItem(`pp:pixi:${namn}`, v); } catch { /* blockerad */ }
};

/**
 * ?pixi=… sätter flaggor (kommaseparerat, för preview utan konsol):
 * debug|frys|av|tvinga, klass-svag|klass-normal, maxtex-4096, emoji-text|emoji-svg|emoji-auto,
 * normal = ta bort alla.
 */
export function urlFlaggor() {
  const q = new URLSearchParams(location.search).get("pixi");
  if (!q) return;
  for (const d of q.split(",")) {
    let m;
    if (d === "normal") FLAGGOR.forEach((f) => skriv(f, null));
    else if (/^(av|tvinga|debug|frys)$/.test(d)) skriv(d, "1");
    else if ((m = /^klass-(svag|normal)$/.exec(d))) skriv("klass", m[1]);
    else if ((m = /^maxtex-(\d{3,5})$/.exec(d))) skriv("maxtex", m[1]);
    else if ((m = /^emoji-(text|svg|auto)$/.exec(d))) skriv("emoji", m[1] === "auto" ? null : m[1]);
  }
}

/** Workerns frame-dt → snitt/max/tappade (> 25 ms). */
export function statistik(frames = []) {
  const sum = frames.reduce((a, b) => a + b, 0);
  return frames.length ? { n: frames.length + 1, medelDt: +(sum / frames.length).toFixed(1), maxDt: Math.max(...frames), tappade: frames.filter((dt) => dt > 25).length, frames } : { n: 0 };
}

// ---- Vakten -----------------------------------------------------------------

let vakt = null;
const scen = () => document.querySelector(".varld-stage");
const motorInfo = () => window.__ppPixi?.motor;

/** Kör fn när ingen rörelse spelas/förbereds (pyramider kan vara utlånade). */
function narVilar(fn, forsok = 20) {
  if (!motorInfo()?.spelar) return fn();
  if (forsok > 0) setTimeout(() => narVilar(fn, forsok - 1), 500);
}

/** Bygg om alla pyramider (emoji-läge/klass ändrat) – bara i vila. */
const byggOm = () => narVilar(() => {
  rensaAllt();
  motorInfo()?.forvarm();
});

/**
 * Koppla vakten till renderaren och ytan (idempotent). Kastar aldrig.
 * @param {{maxTex:number, dod:boolean}} r
 * @param {{stats:Function}} yta
 */
export function vakta(r, yta) {
  try {
    if (vakt?.r === r && vakt.yta === yta) return;
    if (vakt) clearInterval(vakt.timer);
    const v = (vakt = { r, yta, dodForra: r.dod, tick: 0, landad: performance.now(), gpu: "", mo: null, moStage: null });
    const tvingad = parseInt(lasStr("maxtex"), 10);
    if (tvingad > 0 && tvingad < r.maxTex) r.maxTex = tvingad;
    sattAnpassning((b) => {
      const st = scen();
      return st?.isConnected ? anpassaBudget(b, { w: st.clientWidth, h: st.clientHeight, dpr: window.devicePixelRatio || 1 }) : b;
    });
    stallIn({ maxTex: r.maxTex });
    yta.stats().then((s) => {
      v.gpu = s.gpu || "";
      sattGpu(v.gpu);
      const fore = konfiguration().klass;
      if (stallIn({ maxTex: r.maxTex }).klass !== fore) byggOm();
    }, () => {});
    upptack().then((res) => { if (res.lage === "text" && !lasStr("emoji")) byggOm(); }, () => {});
    v.timer = setInterval(() => tick(v), TICK_MS);
    window.__ppPixi && (window.__ppPixi.g1 = g1);
  } catch (err) {
    console.warn("[pp:pixi] vakten:", err);
  }
}

function tick(v) {
  if (v !== vakt) return;
  const st = scen();
  if (st && v.moStage !== st) bevakaScen(v, st);
  // Context återställd (workern har laddat upp texturerna igen) → förvärm.
  if (v.dodForra && !v.r.dod) motorInfo()?.forvarm();
  v.dodForra = v.r.dod;
  if (++v.tick % STADA_VAR === 0) stada();
  if (pixiFlaggor().debug && st?.isConnected) visaHud(null, v.yta).catch(() => {});
}

/** Landningar (data-niva) och varje övergångs väg (data-pixi-spel) på scenen. */
function bevakaScen(v, st) {
  v.mo?.disconnect();
  v.moStage = st;
  v.mo = new MutationObserver((poster) => {
    for (const p of poster) {
      if (p.attributeName === "data-niva") v.landad = performance.now();
      else if (p.attributeName === "data-pixi-spel" && pixiFlaggor().debug) raknaVag(st.dataset.pixiSpel);
    }
  });
  v.mo.observe(st, { attributes: true, attributeFilter: ["data-niva", "data-pixi-spel"] });
}

/**
 * 30 s-städningen: släpp pyramider som inte rörts sedan (landning − 5 s) och
 * är äldre än STADA_MS. Förvärmningen rör grannövergångarnas pyramider vid
 * varje landning, så det som blir kvar är gamla resvägar. Aldrig under rörelse.
 * @returns {string[]} släppta pid:ar
 */
function stada(nu = performance.now()) {
  if (!vakt || motorInfo()?.spelar) return [];
  const lru = texturCache();
  const grans = vakt.landad - LANDNING_MARGINAL_MS;
  const ut = lru.gamla(STADA_MS, nu).filter((pid) => nu - lru.alder(pid, nu) < grans);
  for (const pid of ut) lru.slapp(pid);
  if (ut.length && pixiFlaggor().debug) console.info("[pp:pixi] 30 s-städning släppte", ut);
  return ut;
}

// ---- Mätning: väg per övergång + handoff/omspegling ----------------------------

let matt = null;
function nollstall() {
  matt = { n: 0, vag: {}, forberedMs: [], omspegling: [], frames: 0, tappade: 0, avbrutna: 0, skulleMissat: 0, missatVanta: [], missatVila: [], reserv: 0 };
}
nollstall();

function raknaVag(vag) {
  if (!vag) return;
  matt.n++;
  matt.vag[vag] = (matt.vag[vag] || 0) + 1;
}

/** Från motorns logg (pixi- och handoff-css-övergångar). */
function noteraPost(post) {
  if (post.forberedMs != null) matt.forberedMs.push(post.forberedMs);
  for (const p of post.pyramider || []) if (p?.minimum != null) matt.omspegling.push(Math.round(p.minimum));
  if (post.n) { matt.frames += post.n; matt.tappade += post.tappade || 0; }
  if (post.avbruten) matt.avbrutna++;
  if (post.skulleMissat) {
    matt.skulleMissat++;
    if (post.missatMs?.vanta) matt.missatVanta.push(post.missatMs.vanta);
    if (post.missatMs?.vila) matt.missatVila.push(post.missatMs.vila);
  }
  if (post.inaktuella?.length) matt.reserv++;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

function matning() {
  const pixi = matt.vag.pixi || 0;
  return {
    ...matt,
    andelPixi: matt.n ? +(pixi / matt.n).toFixed(3) : null,
    forberedMedian: median(matt.forberedMs), forberedMax: matt.forberedMs.length ? Math.max(...matt.forberedMs) : null,
    omspeglingMedian: median(matt.omspegling), omspeglingMax: matt.omspegling.length ? Math.max(...matt.omspegling) : null,
  };
}

/** Allt HUD:en visar, som data (för evaluate_script och mätprotokollet). */
async function stats() {
  let worker = null;
  try { worker = await vakt?.yta.stats(); } catch { /* död renderare */ }
  const k = konfiguration();
  const lru = texturCache();
  return {
    klass: k.klass, budget: k.budget, dpr: k.dpr, maxTex: vakt?.r.maxTex,
    lru: { summa: lru.summa(), poster: lru.storlek, over: lru.over() },
    worker, gpu: vakt?.gpu, dod: !!vakt?.r.dod, dodOrsak: vakt?.r.dodOrsak || null,
    emoji: emojiLage(), poster: postLista().length,
  };
}

const g1 = {
  stats, matning, nollstall, stada: () => stada(), rensaAllt: () => narVilar(rensaAllt),
  emoji: () => upptack(), stadaMs: STADA_MS,
};

// ---- HUD ---------------------------------------------------------------------

let hud = null;
let sistaPost = null;
const rad = (k, v) => `<div><b style="opacity:.7">${k}</b> ${v}</div>`;
const mb = (b) => (b / MB).toFixed(1);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Rita/uppdatera HUD:en. post = motorns logg (en övergång, ev. + malForvarm
 * från målförvärmningen – samma post igen, räknas bara en gång per t);
 * null = bara live-siffror (vaktens tick).
 */
export async function visaHud(post, yta) {
  if (post) {
    if (post.vag && post.t !== sistaPost?.t) noteraPost(post);
    sistaPost = post;
  }
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "pp-pixi-hud";
    hud.setAttribute("aria-hidden", "true");
    hud.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483000;pointer-events:none;" +
      "font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#fff;background:rgba(20,24,40,.82);" +
      "padding:8px 10px;border-radius:8px;max-width:360px;white-space:nowrap;overflow:hidden";
    document.body.appendChild(hud);
  }
  const s = await stats();
  const w = s.worker;
  const m = matning();
  const p = sistaPost;
  const frames = p?.frames || [];
  const max = Math.max(50, ...frames);
  const graf = frames.length
    ? `<svg width="320" height="40" style="display:block;margin-top:4px;background:rgba(255,255,255,.08)">` +
      `<line x1="0" x2="320" y1="${40 - (16.7 / max) * 40}" y2="${40 - (16.7 / max) * 40}" stroke="#7fd" stroke-dasharray="3 3"/>` +
      frames.map((dt, i) => {
        const x = (i / Math.max(1, frames.length - 1)) * 316 + 2;
        const h = (dt / max) * 40;
        return `<rect x="${x.toFixed(1)}" y="${(40 - h).toFixed(1)}" width="2" height="${h.toFixed(1)}" fill="${dt > 25 ? "#f77" : "#9e9"}"/>`;
      }).join("") + "</svg>"
    : "";
  const vag = p?.vag === "pixi" ? "🟢 pixi" : p?.vag ? `🟠 css:${p.orsak}` : "–";
  const mal = p?.malForvarm;
  const fordelning = Object.entries(m.vag).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
  const over = s.lru.summa > s.budget.maxBytes;
  hud.innerHTML =
    (p?.vag ? rad("övergång", `${esc(p.yttre)}${p.riktning === "in" ? " → " : " ← "}${esc(p.inre)}  ${vag}`) : "") +
    (p?.ateranvanda?.length ? rad("återanvänt", `${esc(p.ateranvanda.join(", "))} (${esc((p.kallor || []).join("/"))})`) : "") +
    (p?.skulleMissat ? rad("⚠ prod", `skulle missat: ${Object.entries(p.missatMs || {}).map(([k, v]) => `${k} ${v} ms`).join(", ")}`) : "") +
    (mal ? rad("mål", `#${mal.id} ${esc(mal.lager)}${mal.inre ? `→${esc(mal.inre)}` : ""} ${mal.status} · ${mal.ms} ms · ${mal.poster.map((x) => `${x.roll}${x.minKlar ? "✓" : "…"}`).join(" ")}`) : "") +
    (p?.vag ? rad("handoff", `${p.forberedMs ?? "–"} ms${p.omspeglade?.length ? ` (omspeglat: ${esc(p.omspeglade.join(", "))})` : ""}`) : "") +
    (p?.inaktuella?.length ? rad("reserv", `förvärmd pyramid för ${esc(p.inaktuella.join(", "))}`) : "") +
    (frames.length ? rad("frame-dt", `snitt ${p.medelDt} · max ${p.maxDt} · tappade ${p.tappade}/${p.n}${p.avbruten ? " · AVBRUTEN" : ""}`) : "") +
    graf +
    (m.n ? rad("vägar", `${m.n} st, pixi ${Math.round((m.andelPixi || 0) * 100)} %: ${esc(fordelning)}`) : "") +
    (m.skulleMissat ? rad("skulle missat", `${m.skulleMissat}/${m.n} (vänta ${m.missatVanta.length ? `median ${median(m.missatVanta)} ms` : "–"} · vila ${m.missatVila.length ? `median ${median(m.missatVila)} ms` : "–"})`) : "") +
    (m.forberedMs.length ? rad("handoff ms", `median ${m.forberedMedian} · max ${m.forberedMax}${m.omspegling.length ? ` · pyramid min ${m.omspeglingMedian}/${m.omspeglingMax}` : ""}`) : "") +
    rad("budget", `<span style="color:${over ? "#f77" : "#9e9"}">${mb(s.lru.summa)}/${mb(s.budget.maxBytes)} MB</span> · ${s.lru.poster} pyr · ${s.klass} · maxPar ${s.budget.maxPar} · dpr ${s.dpr}`) +
    (w ? rad("worker", `${w.texturer} tex · ${w.bitmaps} bmp · ${mb(w.bytes || 0)} MB · GL ${w.gl} · ${w.lager} lager`) : rad("worker", "–")) +
    rad("gpu", `${esc((s.gpu || "?").slice(0, 34))} · maxTex ${s.maxTex} · tegel ${s.budget.tegel}`) +
    rad("kontext", s.dod ? `<span style="color:#f77">${esc(s.dodOrsak)}</span>` : "ok") +
    rad("emoji", s.emoji);
}
