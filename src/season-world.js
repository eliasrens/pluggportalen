// ============================================================================
// Pluggporten – säsongen i världen och på inloggningen (#691, epic #689;
// tillägg + snö #907, epic #906)
// ----------------------------------------------------------------------------
// Spec §1.3–1.5, §2.1 (Höst/Halloween), A.2/A.4 (Vinter/Jul). Kopplar
// säsongsläget (season.js, EN lyssnare på config/season) till utseendet:
//   • <html data-sasong data-lov data-sno> + data-{tillägg} (data-halloween,
//     data-jul – ur TILLAGG) – synligheten för säsongsdekor i konsten
//     (.sz-bara-host m.fl., styles/32-sasong.css)
//   • <style id="sz-palett"> – paletten (SEASONS[...].palette) som
//     --sz-*-variabler, BARA på världen (.varld-stage, rumsfönstret) och
//     inloggningen (.port-scen, port-övergångens overlay .port-overgang,
//     lärarspärren). Sommar = tom = dagens färger.
//   • partikellager (PARTIKLAR: löv på hösten ≤16, snö på vintern ≤20 – CSS
//     transform/opacity) + fladdermöss (Halloween, bara inloggningen); pausas
//     i dold flik, av vid reducerad rörelse, aldrig klickbara.
//   • julen (#909): src/jul/jul-varld.js laddas lazy när Jul är på.
//
// Ingen blink: applyCachedTheme() läser localStorage SYNKRONT (samma cache som
// season.js skriver) innan scenen ritas; season.js laddas sedan i bakgrunden
// och slår om temat live om servern säger något annat.
// Laddas BARA med import() – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import {
  SEASON_CACHE_KEY,
  TILLAGG,
  aktivaTillagg,
  normalizeSeason,
  themeFor,
} from "./season-config.js";
import { lovSvg, snoSvg, fladderSvg, gateDekorSvg, portDekor } from "./art-sasong.js";

export { portDekor };

/** Antal löv per lager (spec: högst ~15–20). */
export const LOV_ANTAL = 16;
/** Antal snöflingor per lager (A.4: högst 20). */
export const SNO_ANTAL = 18;
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
    // .port-overgang: port-overgang.js flyttar scenens SVG dit (utanför
    // .port-scen) – utan den här blev zoomen sommargrön (#727).
    (l ? `.port-scen,.port-overgang,body:has(.sz-gate){${l}}` : "")
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
  // data-halloween, data-jul, … ur registret.
  for (const t of TILLAGG) {
    if (theme[t.id]) root.dataset[t.id] = "1";
    else delete root.dataset[t.id];
  }
  if (theme.leaves) root.dataset.lov = "1";
  else delete root.dataset.lov;
  if (theme.sno) root.dataset.sno = "1";
  else delete root.dataset.sno;

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
  const aktiva = aktivaTillagg(s, Date.now());
  const st = { ...s };
  for (const t of TILLAGG) st[`${t.id}Active`] = aktiva.includes(t.id);
  return applyTheme(st);
}

/**
 * Temat för sidor som inte monterar egen säsongsdekor men ritar säsongsberoende
 * saker – kostymerna på avatarer (#693, avatars.js) i t.ex. sidomenyn, byn och
 * Live. Första bilden ur cachen om inget tema satts än, sedan live. Idempotent.
 */
export function ensureTheme() {
  if (!current) applyCachedTheme();
  return startLive();
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

// --- Partikellager (löv, snö) + fladdermöss -----------------------------------

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

/**
 * Snöns markup (A.4): SNO_ANTAL flingor, 4–10 px, rund eller enkel sexuddig
 * stjärna, genomskinlighet 0,7–0,9. Mjukt fall med svaj, ingen snurr.
 */
export function snoMarkup(antal = SNO_ANTAL) {
  let s = "";
  for (let i = 0; i < antal; i++) {
    const d = 9 + r(i, 11) * 8; // fallets längd 9–17 s
    const style =
      `--x:${(1 + (98 * (i + r(i, 12))) / antal).toFixed(1)}%;` +
      `--w:${Math.round(4 + r(i, 13) * 6)}px;--d:${d.toFixed(1)}s;` +
      `--del:${(-r(i, 14) * d).toFixed(1)}s;--drift:${Math.round(-30 + r(i, 15) * 60)}px;` +
      `--o:${(0.7 + r(i, 16) * 0.2).toFixed(2)}`;
    s += `<i class="sz-sno" style="${style}">${snoSvg(i)}</i>`;
  }
  return s;
}

/**
 * Partikeltyperna: samma lager, montering, paus, reducerad rörelse och
 * pointer-events:none för alla. `pa(theme)` = ska typen visas; lagret byggs
 * först när det behövs (sommar = tomma lager). CSS: html[data-{attr}]
 * .sz-{typ}-lager visas.
 */
export const PARTIKLAR = {
  lov: { pa: (theme) => !!theme.leaves, markup: () => lovMarkup() },
  sno: { pa: (theme) => !!theme.sno, markup: () => snoMarkup() },
};

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
 * Montera säsongslager i `container` (före `before`, annars sist). Partiklarna
 * och fladdermössen byggs först när temat behöver dem (sommar = tomma lager).
 */
function mountLager(container, { fladder = false, before = null } = {}) {
  const root = document.createElement("div");
  root.className = "sz-lager-wrap";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML =
    Object.keys(PARTIKLAR).map((typ) => `<div class="sz-lager sz-${typ}-lager"></div>`).join("") +
    (fladder ? `<div class="sz-lager sz-fladder-lager"></div>` : "");
  root.style.display = "contents";
  container.insertBefore(root, before);
  const partikelEl = Object.entries(PARTIKLAR).map(([typ, p]) => [root.querySelector(`.sz-${typ}-lager`), p]);
  const fladderEl = root.querySelector(".sz-fladder-lager");
  const l = {
    root,
    sync(theme) {
      for (const [el, p] of partikelEl) if (p.pa(theme) && !el.firstChild) el.innerHTML = p.markup();
      if (fladderEl && theme.halloween && !fladderEl.firstChild) fladderEl.innerHTML = fladderMarkup();
      if (theme.halloween) fyllVinkdjur(container);
      if (theme.jul) fyllJul(container);
    },
  };
  lager.add(l);
  l.sync(current || applyCachedTheme());
  return l;
}

/**
 * Halloween-djuret som vinkar på inloggningen (Spökis, steg 2, glad – #695).
 * Konsten laddas FÖRST när Halloween är på (src/halloween/, lazy) och ritas i
 * dekorens tomma .sz-vinkdjur-platser; vinkningen = armens CSS-animation.
 */
export function fyllVinkdjur(root) {
  const platser = [...root.querySelectorAll(".sz-vinkdjur:empty")];
  if (!platser.length) return;
  import("./halloween/hw-djur-a.js")
    .then((m) => {
      for (const g of platser) if (!g.firstChild) g.innerHTML = m.HW_DJUR_A.spokis(2, "glad");
    })
    .catch(() => {}); // ren dekor – inloggningen påverkas aldrig
}

/**
 * Julen (#909): ljusslingor, granar, tomtar m.m. läggs in i scenerna av
 * src/jul/jul-varld.js – laddas FÖRST när Jul är på (lazy, som Halloween-djuret
 * ovan), så inget i sommarens/höstens konst ändras.
 */
let julP = null;
function fyllJul(container) {
  julP ||= import("./jul/jul-varld.js");
  julP.then((m) => m.julMontera(container)).catch(() => {}); // ren dekor
}

/**
 * Världen (pages-varld.js): löv/snö i scenen, temat live. Byarna (egen + grannby)
 * får egna löv/snö INNE i by-lagret, mellan husen och namnskyltarna (#732) – scenens
 * löv ligger över hela lagret och döljs där (32-sasong.css).
 */
export function mountVarldSasong(stage) {
  const ui = stage.querySelector(".varld-ui");
  mountLager(stage, { before: ui });
  for (const by of stage.querySelectorAll(".varld-lager.varld-by, .varld-lager.varld-grannby")) mountLager(by);
  startLive();
}

/** Elevernas port-scen: löv/snö + fladdermöss direkt efter port-SVG:n (under skylten). */
export function mountPortSasong(scen) {
  const svg = scen.querySelector(":scope > svg");
  mountLager(scen, { fladder: true, before: svg ? svg.nextSibling : scen.firstChild });
  startLive();
}

/** Lärarspärren (teacher-shared.js renderGate): dekor runt panelen + löv/snö. */
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
