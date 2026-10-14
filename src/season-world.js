// ============================================================================
// Pluggporten – säsongen i världen och på inloggningen (#691, epic #689)
// ----------------------------------------------------------------------------
// Spec §1.3–1.5, §2.1. Kopplar säsongsläget (season.js, EN lyssnare på
// config/season) till utseendet:
//   • <html data-sasong data-halloween data-lov> – synligheten för
//     säsongsdekor i konsten (.sz-bara-host m.fl., styles/31-sasong.css)
//   • <style id="sz-palett"> – paletten (SEASONS[...].palette) som
//     --sz-*-variabler, BARA på världen (.varld-stage, rumsfönstret) och
//     inloggningen (.port-scen, lärarspärren). Sommar = tom = dagens färger.
//   • lövlager (≤16 löv, CSS transform/opacity) + fladdermöss (Halloween,
//     bara inloggningen); pausas i dold flik, av vid reducerad rörelse.
//
// Ingen blink: applyCachedTheme() läser localStorage SYNKRONT (samma cache som
// season.js skriver) innan scenen ritas; season.js laddas sedan i bakgrunden
// och slår om temat live om servern säger något annat.
// Laddas BARA med import() – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import {
  SEASON_CACHE_KEY,
  halloweenActive,
  normalizeSeason,
  themeFor,
} from "./season-config.js";
import { lovSvg, fladderSvg, gateDekorSvg, portDekor } from "./art-sasong.js";

export { portDekor };

/** Antal löv per lager (spec: högst ~15–20). */
export const LOV_ANTAL = 16;
const FLADDER_ANTAL = 4;

const lager = new Set(); // monterade lager: { root, sync(theme) }
let current = null;
let liveP = null;

/** Paletten → CSS-text (exporteras för test). Tom palett → "". */
export function paletteCss(theme) {
  const decl = (pal) =>
    Object.entries(pal)
      .map(([k, v]) => `--sz-${k}:${v};`)
      .join("");
  const w = decl(theme.world);
  const l = decl(theme.login);
  return (
    (w ? `.varld-stage,.room-window{${w}}` : "") +
    (l ? `.port-scen,body:has(.sz-gate){${l}}` : "")
  );
}

/** Sätt temat (attribut + palett) och synka alla monterade lager. */
export function applyTheme(state) {
  const theme = themeFor(state);
  current = theme;
  if (typeof document === "undefined") return theme;
  const root = document.documentElement;
  if (theme.season === "sommar") delete root.dataset.sasong;
  else root.dataset.sasong = theme.season;
  if (theme.halloween) root.dataset.halloween = "1";
  else delete root.dataset.halloween;
  if (theme.leaves) root.dataset.lov = "1";
  else delete root.dataset.lov;

  const css = paletteCss(theme);
  let style = document.getElementById("sz-palett");
  if (css && !style) {
    style = document.createElement("style");
    style.id = "sz-palett";
    document.head.appendChild(style);
  }
  if (style && style.textContent !== css) style.textContent = css;

  for (const l of [...lager]) {
    if (!l.root.isConnected) lager.delete(l);
    else l.sync(theme);
  }
  return theme;
}

/** Senast kända läge ur localStorage (rätt tema direkt, utan blink). */
export function applyCachedTheme() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(SEASON_CACHE_KEY) || "null");
  } catch {}
  const s = normalizeSeason(raw);
  // Klientklockan duger för FÖRSTA bilden; season.js räknar om mot servern.
  return applyTheme({ ...s, halloweenActive: halloweenActive(s, Date.now()) });
}

/** Starta live-uppdateringen (season.js, EN lyssnare). Idempotent. */
export function startLive() {
  if (!liveP) {
    liveP = import("./season.js")
      .then((m) => {
        m.onSeasonChange((next) => applyTheme(next));
        applyTheme(m.getSeason());
      })
      .catch((err) => console.warn("Säsongen kunde inte laddas:", err));
  }
  return liveP;
}

// Dold flik → pausa all säsongsrörelse (rendering stryps ändå, men paus är
// explicit så att inget räknas i bakgrunden).
if (typeof document !== "undefined") {
  const paus = () => document.documentElement.classList.toggle("sz-paus", document.hidden);
  document.addEventListener("visibilitychange", paus);
  paus();
}

// --- Lövlager + fladdermöss ---------------------------------------------------

/** Deterministiskt "slump" så samma löv alltid ser likadana ut (0–1). */
const r = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Lövens markup: LOV_ANTAL element, 4 varianter som återanvänds. */
export function lovMarkup(antal = LOV_ANTAL) {
  let s = "";
  for (let i = 0; i < antal; i++) {
    const d = 11 + r(i, 1) * 9; // fallets längd 11–20 s
    const style =
      `--x:${(2 + (96 * (i + r(i, 2))) / antal).toFixed(1)}%;` +
      `--w:${Math.round(16 + r(i, 3) * 12)}px;--d:${d.toFixed(1)}s;` +
      `--del:${(-r(i, 4) * d).toFixed(1)}s;--drift:${Math.round(-60 + r(i, 6) * 140)}px`;
    s += `<i class="sz-lov" style="${style}">${lovSvg(i)}</i>`;
  }
  return s;
}

function fladderMarkup() {
  let s = "";
  for (let i = 0; i < FLADDER_ANTAL; i++) {
    const d = 18 + r(i, 7) * 14;
    s +=
      `<i class="sz-fladder" style="--y:${(4 + r(i, 8) * 22).toFixed(1)}%;--w:${Math.round(40 + r(i, 9) * 26)}px;` +
      `--d:${d.toFixed(1)}s;--del:${(-r(i, 10) * d).toFixed(1)}s"><i>${fladderSvg()}</i></i>`;
  }
  return s;
}

/**
 * Montera säsongslager i `container` (före `before`, annars sist). Löven och
 * fladdermössen byggs först när temat behöver dem (sommar = tomma lager).
 */
function mountLager(container, { fladder = false, before = null } = {}) {
  const root = document.createElement("div");
  root.className = "sz-lager-wrap";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `<div class="sz-lager sz-lov-lager"></div>${fladder ? `<div class="sz-lager sz-fladder-lager"></div>` : ""}`;
  root.style.display = "contents";
  container.insertBefore(root, before);
  const lovEl = root.querySelector(".sz-lov-lager");
  const fladderEl = root.querySelector(".sz-fladder-lager");
  const l = {
    root,
    sync(theme) {
      if (theme.leaves && !lovEl.firstChild) lovEl.innerHTML = lovMarkup();
      if (fladderEl && theme.halloween && !fladderEl.firstChild) fladderEl.innerHTML = fladderMarkup();
    },
  };
  lager.add(l);
  l.sync(current || applyCachedTheme());
  return l;
}

/** Världen (pages-varld.js): löv i scenen, temat live. */
export function mountVarldSasong(stage) {
  const ui = stage.querySelector(".varld-ui");
  mountLager(stage, { before: ui });
  startLive();
}

/** Elevernas port-scen: löv + fladdermöss direkt efter port-SVG:n (under skylten). */
export function mountPortSasong(scen) {
  const svg = scen.querySelector(":scope > svg");
  mountLager(scen, { fladder: true, before: svg ? svg.nextSibling : scen.firstChild });
  startLive();
}

/** Lärarspärren (teacher-shared.js renderGate): dekor runt panelen + löv. */
export function mountGateSasong(view) {
  if (!current) applyCachedTheme();
  view.classList.add("sz-gate");
  const dekor = document.createElement("div");
  dekor.className = "sz-gate-dekor";
  dekor.setAttribute("aria-hidden", "true");
  dekor.innerHTML = gateDekorSvg();
  view.prepend(dekor);
  mountLager(dekor, { fladder: true });
  startLive();
}
