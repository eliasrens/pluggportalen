// ============================================================================
// Guldrushen (#564): DE TRE KISTORNA på elevskärmen (designspec §6.4).
//   1. tre kistor dyker upp och skakar lockande
//   2. eleven väljer – klick, tangent 1–3, eller pilar + ENTER (tydlig fokus)
//   3. den valda kistan skramlar medan servern avgör (open(i) → openChest);
//      de andra tonar bort
//   4. locket öppnas, varmt ljus strömmar ut, kisttypens EGEN effekt
//      (gr-kistfx.js) + eget ljud (gr-ljud.js) + bildtext; guldet räknas upp
//      av vyn (onReveal)
//   5. klar → vyn visar nästa fråga
// Från svar till klar ≈ 1,0 s + serverns svarstid (≤ ~1,5 s totalt).
// Komponenten avgör ALDRIG innehållet – den visar det id servern svarade.
// Stilar: guldrush-kistor.css (grk-*, grfx-*) – laddas av komponenten själv.
//
// API
//   playChests(host, { open, onError?, onReveal?, sound?, avatar?, gold?,
//                      reduced?, count? = 3 }) → { done, destroy() }
//     open(index) → Promise<openChest-svar>; kastar den → onError(err) och
//                   kistorna kan väljas igen (vyn avgör om de ska bort)
//     onReveal(view)  anropas när locket öppnas (vyn räknar upp guldet, reagerar)
//     done → Promise<view> (chestView) när effekten är klar
//   chestSvg() → kistans SVG (lock + kropp), används även av förhandsvisningen
// ============================================================================

import { chestView } from "./gr-elev.js";
import { playLook } from "./gr-kistfx.js";
import { playChestSound } from "./gr-ljud.js";

const CSS_HREF = new URL("./guldrush-kistor.css", import.meta.url).href;

function ensureCss() {
  if (document.querySelector("link[data-gr-kistor-css]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_HREF;
  link.dataset.grKistorCss = "";
  document.head.appendChild(link);
}

export function chestSvg() {
  return `<svg class="grk-svg" viewBox="0 0 120 100" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="grk-tra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5602a"/><stop offset="1" stop-color="#6b3714"/></linearGradient>
      <linearGradient id="grk-lock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c47a3a"/><stop offset="1" stop-color="#8a4b1f"/></linearGradient>
      <linearGradient id="grk-guld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#d99a00"/></linearGradient>
    </defs>
    <ellipse class="grk-skugga" cx="60" cy="94" rx="50" ry="5" fill="#000" opacity=".18"/>
    <rect class="grk-inre" x="14" y="38" width="92" height="12" rx="3" fill="#2a1406"/>
    <g class="grk-kropp">
      <rect x="10" y="46" width="100" height="44" rx="6" fill="url(#grk-tra)" stroke="#4a2409" stroke-width="3"/>
      <path d="M12 60 H108 M12 75 H108" stroke="#5a2d0e" stroke-width="2" opacity=".55"/>
      <rect x="20" y="46" width="9" height="44" fill="url(#grk-guld)" stroke="#a86f00" stroke-width="1.5"/>
      <rect x="91" y="46" width="9" height="44" fill="url(#grk-guld)" stroke="#a86f00" stroke-width="1.5"/>
      <rect x="50" y="50" width="20" height="22" rx="4" fill="url(#grk-guld)" stroke="#a86f00" stroke-width="2"/>
      <circle cx="60" cy="59" r="3.2" fill="#3a1d05"/><rect x="58.6" y="60" width="2.8" height="7" rx="1" fill="#3a1d05"/>
    </g>
    <g class="grk-lock">
      <path d="M8 48 L8 34 Q8 16 60 16 Q112 16 112 34 L112 48 Z" fill="url(#grk-lock)" stroke="#4a2409" stroke-width="3" stroke-linejoin="round"/>
      <path d="M16 30 Q60 18 104 30" stroke="#e8a25a" stroke-width="3" fill="none" opacity=".55"/>
      <rect x="20" y="20" width="9" height="28" fill="url(#grk-guld)" stroke="#a86f00" stroke-width="1.5"/>
      <rect x="91" y="20" width="9" height="28" fill="url(#grk-guld)" stroke="#a86f00" stroke-width="1.5"/>
      <rect x="8" y="42" width="104" height="7" rx="2" fill="url(#grk-guld)" stroke="#a86f00" stroke-width="1.5"/>
    </g>
  </svg>`;
}

const KEYS = { 1: 0, 2: 1, 3: 2 };

export function playChests(host, { open, onError = () => {}, onReveal = () => {}, sound = null, avatar = null, gold = null, reduced = false, count = 3 } = {}) {
  ensureCss();
  host.innerHTML = `<div class="grk" role="group" aria-label="Välj en skattkista">
      <p class="grk-rubrik">✨ Rätt! Välj en kista</p>
      <div class="grk-rad">${Array.from({ length: count }, (_, i) => `
        <button type="button" class="grk-kista" data-i="${i}" aria-label="Kista ${i + 1}" style="--grk-d:${i * 0.23}s">
          <span class="grk-ljus" aria-hidden="true"></span>${chestSvg()}<span class="grk-fx" aria-hidden="true"></span>
          <span class="grk-nr" aria-hidden="true">${i + 1}</span>
        </button>`).join("")}
      </div>
      <p class="grk-text" role="status" aria-live="polite"></p>
    </div>`;
  const root = host.firstElementChild;
  const btns = [...root.querySelectorAll(".grk-kista")];
  const text = root.querySelector(".grk-text");
  const anims = [];
  let busy = false;
  let destroyed = false;
  let resolveDone;
  const done = new Promise((res) => { resolveDone = res; });

  // In: kistorna poppar upp en i taget.
  if (!reduced && typeof root.animate === "function") {
    btns.forEach((b, i) => anims.push(b.animate([{ transform: "translateY(18%) scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 240, delay: i * 70, easing: "cubic-bezier(.3,1.5,.5,1)", fill: "backwards" })));
  }
  root.classList.add("grk-lockar");
  const focusAt = (i) => { try { btns[i]?.focus({ preventScroll: true }); } catch { btns[i]?.focus(); } };
  setTimeout(() => { if (!destroyed && !busy) focusAt(Math.floor(count / 2)); }, 0);

  function reset() {
    busy = false;
    root.classList.remove("grk-valt");
    root.classList.add("grk-lockar");
    btns.forEach((b) => { b.disabled = false; b.classList.remove("vald", "bort"); });
    focusAt(Math.floor(count / 2));
  }

  async function reveal(btn, view) {
    btn.classList.add("oppen");
    root.classList.add("grk-oppnad");
    const lid = btn.querySelector(".grk-lock");
    const light = btn.querySelector(".grk-ljus");
    const svg = btn.querySelector(".grk-svg");
    if (lid?.animate) {
      anims.push(lid.animate(reduced
        ? [{ opacity: 1 }, { opacity: 0.25 }]
        : [{ transform: "none" }, { transform: "translateY(-24px) rotate(-10deg) scaleY(.62)", offset: 0.7 }, { transform: "translateY(-20px) rotate(-8deg) scaleY(.66)" }],
      { duration: 220, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "forwards" }));
    }
    light?.animate?.([{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1.1)", offset: 0.4 }, { opacity: 0.85, transform: "scale(1)" }],
      { duration: 420, delay: 60, fill: "forwards", easing: "ease-out" });
    playChestSound(sound, view.sound);
    text.innerHTML = `<span class="grk-ikon" aria-hidden="true">${view.icon}</span> ${view.caption}`;
    text.dataset.kind = view.chest?.effect?.kind || "";
    text.classList.remove("syns");
    void text.offsetWidth;
    text.classList.add("syns");
    try { onReveal(view); } catch (e) { console.warn("Guldrushen: onReveal", e); }
    const fxDone = new Promise((r) => setTimeout(r, 120)).then(() => playLook(view.look, {
      fx: btn.querySelector(".grk-fx"), chest: svg, gold, avatar, icon: view.icon, reduced,
    }));
    // Effekten får aldrig hålla kvar spelet: högst ~1 s.
    await Promise.race([Promise.all([fxDone, new Promise((r) => setTimeout(r, 900))]), new Promise((r) => setTimeout(r, 1100))]);
  }

  async function pick(i) {
    if (busy || destroyed || !btns[i]) return;
    busy = true;
    const btn = btns[i];
    root.classList.remove("grk-lockar");
    root.classList.add("grk-valt");
    btns.forEach((b, j) => { b.disabled = true; b.classList.toggle("vald", j === i); b.classList.toggle("bort", j !== i); });
    let res;
    try {
      res = await open(i);
    } catch (err) {
      if (!destroyed) {
        reset();
        onError(err);
      }
      return;
    }
    if (destroyed) return;
    const view = chestView(res);
    await reveal(btn, view);
    if (!destroyed) resolveDone(view);
  }

  function onKey(e) {
    if (busy || destroyed || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key in KEYS && KEYS[e.key] < count) {
      e.preventDefault();
      pick(KEYS[e.key]);
      return;
    }
    const cur = btns.indexOf(document.activeElement);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      focusAt(((cur < 0 ? 1 : cur) + step + count) % count);
    }
  }
  btns.forEach((b, i) => b.addEventListener("click", () => pick(i)));
  document.addEventListener("keydown", onKey);

  return {
    done,
    destroy() {
      destroyed = true;
      document.removeEventListener("keydown", onKey);
      anims.forEach((a) => a.cancel?.());
      host.innerHTML = "";
    },
  };
}
