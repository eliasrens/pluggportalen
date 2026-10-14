// ============================================================================
// Datakuppen 💾 (#653): DE TRE FILERNA på elevskärmen (spec §1.3, §4.3).
//   1. tre krypterade filer dyker upp (låst fil-ikon, 1–3)
//   2. eleven väljer – klick, tangent 1–3, eller pilar + ENTER
//   3. DEKRYPTERING (högst ~1,5 s): förloppsstapel + tecken som rullar fram
//      medan servern avgör (open(i) → openFile); de andra filerna tonar bort.
//      Svarar servern snabbt fylls stapeln ändå på ~0,9 s – svarar den
//      långsamt står stapeln strax före mål tills svaret kommer.
//   4. filtypens EGEN ikon (dk-ikoner.js), eget utseende (data-look →
//      datakuppen-filer.css) och eget ljud (dk-ljud.js) + bildtext; datan
//      räknas upp av vyn (onReveal)
//   5. klar → vyn visar nästa fråga (eller målväljaren efter ett Hack)
// Komponenten avgör ALDRIG innehållet – den visar det id servern svarade.
// Reducerad rörelse: inga rullande tecken eller hopp, bara toningar.
// Stilar: datakuppen-filer.css (dkf-*) – laddas av komponenten själv.
//
// API
//   playFiles(host, { open, onError?, onReveal?, sound?, reduced?, count? = 3 })
//     → { done, destroy() }
//     open(index) → Promise<openFile-svar>; kastar den → onError(err) och
//                   filerna kan väljas igen (vyn avgör om de ska bort)
//     onReveal(view)  när filen dekrypterats (vyn räknar upp datan, reagerar)
//     done → Promise<view> (fileView) när effekten är klar
//   DECRYPT_MS  dekrypteringens längd när servern svarar direkt
// ============================================================================

import { fileView } from "./dk-elev.js";
import { fileIcon, lockedFileIcon } from "./dk-ikoner.js";
import { playDkSound } from "./dk-ljud.js";

const CSS_HREF = new URL("./datakuppen-filer.css", import.meta.url).href;
export const DECRYPT_MS = 950;
const SETTLE_MS = 300; // stapeln fylls + tecknen låser sig
const FX_MS = 900; // effekten efter dekrypteringen
const ROLL = "0123456789abcdef#$%&*<>/";
const NAMES = ["data_7f.bin", "x0r_k3y.dat", "pk_3141.zip", "n0d_42.sys", "b1t_99.log", "c0re_5a.img"];

function ensureCss() {
  if (document.querySelector("link[data-dk-filer-css]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_HREF;
  link.dataset.dkFilerCss = "";
  document.head.appendChild(link);
}

const KEYS = { 1: 0, 2: 1, 3: 2 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rollText = (n) => Array.from({ length: n }, () => ROLL[Math.floor(Math.random() * ROLL.length)]).join("");

export function playFiles(host, { open, onError = () => {}, onReveal = () => {}, sound = null, reduced = false, count = 3 } = {}) {
  ensureCss();
  const start = Math.floor(Math.random() * NAMES.length);
  host.innerHTML = `<div class="dkf" role="group" aria-label="Välj en fil">
      <p class="dkf-rubrik">Rätt! Välj en fil</p>
      <div class="dkf-rad">${Array.from({ length: count }, (_, i) => `
        <button type="button" class="dkf-fil" data-i="${i}" aria-label="Fil ${i + 1}" style="--dkf-d:${i * 0.2}s">
          <span class="dkf-ikon">${lockedFileIcon("100%")}</span>
          <span class="dkf-namn">${NAMES[(start + i) % NAMES.length]}</span>
          <span class="dkf-dekr" aria-hidden="true"><span class="dkf-tecken"></span><span class="dkf-stapel"><i></i></span></span>
          <span class="dkf-fx" aria-hidden="true"></span>
          <span class="dkf-nr" aria-hidden="true">${i + 1}</span>
        </button>`).join("")}
      </div>
      <p class="dkf-text" role="status" aria-live="polite"></p>
    </div>`;
  const root = host.firstElementChild;
  const btns = [...root.querySelectorAll(".dkf-fil")];
  const text = root.querySelector(".dkf-text");
  const anims = [];
  let rollT = 0;
  let busy = false;
  let destroyed = false;
  let resolveDone;
  const done = new Promise((res) => { resolveDone = res; });

  if (!reduced && typeof root.animate === "function") {
    btns.forEach((b, i) => anims.push(b.animate([{ transform: "translateY(14%) scale(.8)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 220, delay: i * 60, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "backwards" })));
  }
  const focusAt = (i) => { try { btns[i]?.focus({ preventScroll: true }); } catch { btns[i]?.focus(); } };
  setTimeout(() => { if (!destroyed && !busy) focusAt(Math.floor(count / 2)); }, 0);

  function reset() {
    busy = false;
    clearInterval(rollT);
    root.classList.remove("dkf-valt");
    btns.forEach((b) => { b.disabled = false; b.classList.remove("vald", "bort", "dekrypterar"); });
    btns.forEach((b) => { b.querySelector(".dkf-tecken").textContent = ""; });
    focusAt(Math.floor(count / 2));
  }

  // Förloppsstapeln: 0 → 90 % på DECRYPT_MS, sista biten när svaret finns.
  function startDecrypt(btn) {
    btn.classList.add("dekrypterar");
    const bar = btn.querySelector(".dkf-stapel i");
    const chars = btn.querySelector(".dkf-tecken");
    playDkSound(sound, "dekryptera");
    if (bar?.animate) {
      anims.push(bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(.9)" }],
        { duration: DECRYPT_MS, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" }));
    }
    if (reduced) {
      chars.textContent = "Dekrypterar …";
      return;
    }
    rollT = setInterval(() => { chars.textContent = rollText(10); }, 55);
  }

  async function finishDecrypt(btn, label) {
    const bar = btn.querySelector(".dkf-stapel i");
    const chars = btn.querySelector(".dkf-tecken");
    clearInterval(rollT);
    if (bar?.animate) {
      anims.push(bar.animate([{ transform: "scaleX(.9)" }, { transform: "scaleX(1)" }], { duration: 160, fill: "forwards" }));
    }
    const word = String(label || "").toUpperCase();
    if (reduced) {
      chars.textContent = word;
      return wait(SETTLE_MS);
    }
    // Tecknen låser sig ett i taget, från vänster.
    const steps = 6;
    for (let s = 1; s <= steps && !destroyed; s++) {
      const fixed = Math.round((word.length * s) / steps);
      chars.textContent = word.slice(0, fixed) + rollText(Math.max(0, word.length - fixed));
      await wait(SETTLE_MS / steps);
    }
    chars.textContent = word;
  }

  async function reveal(btn, view) {
    btn.classList.remove("dekrypterar");
    btn.classList.add("oppen");
    btn.dataset.look = view.look || "";
    root.classList.add("dkf-oppnad");
    const icon = btn.querySelector(".dkf-ikon");
    icon.innerHTML = fileIcon(view.chest?.id, "100%");
    icon.animate?.(reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1.12)", opacity: 1, offset: 0.6 }, { transform: "none", opacity: 1 }],
    { duration: 320, easing: "ease-out" });
    btn.querySelector(".dkf-namn").textContent = view.label || "";
    playDkSound(sound, view.sound);
    text.textContent = view.caption;
    text.dataset.kind = view.chest?.effect?.kind || "";
    text.classList.remove("syns");
    void text.offsetWidth;
    text.classList.add("syns");
    const fx = btn.querySelector(".dkf-fx");
    fx.innerHTML = fxHtml(view);
    try { onReveal(view); } catch (e) { console.warn("Datakuppen: onReveal", e); }
    await wait(FX_MS);
  }

  async function pick(i) {
    if (busy || destroyed || !btns[i]) return;
    busy = true;
    const btn = btns[i];
    root.classList.add("dkf-valt");
    btns.forEach((b, j) => { b.disabled = true; b.classList.toggle("vald", j === i); b.classList.toggle("bort", j !== i); });
    startDecrypt(btn);
    const t0 = Date.now();
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
    const view = fileView(res);
    await wait(Math.max(0, DECRYPT_MS - (Date.now() - t0)));
    if (destroyed) return;
    await finishDecrypt(btn, view.label);
    if (destroyed) return;
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
      clearInterval(rollT);
      document.removeEventListener("keydown", onKey);
      anims.forEach((a) => a.cancel?.());
      host.innerHTML = "";
    },
  };
}

// Filtypens effekt: små tecken/former som CSS animerar (datakuppen-filer.css).
function fxHtml(view) {
  const k = view.chest?.effect?.kind;
  const many = view.chest?.id === "serverhall" ? 14 : view.chest?.id === "stor_fil" ? 10 : 7;
  if (k === "gold" || k === "double") {
    return Array.from({ length: many }, (_, i) => `<i style="--x:${((i * 37) % 90) + 5}%;--d:${(i % 5) * 0.06}s">${i % 2 ? "1" : "0"}</i>`).join("");
  }
  if (k === "lose") return Array.from({ length: 5 }, (_, i) => `<i style="--x:${12 + i * 18}%;--d:${i * 0.05}s">${["#", "%", "?", "!", "*"][i]}</i>`).join("");
  if (k === "shield") return `<b class="dkf-ring"></b>`;
  if (k === "steal") return `<b class="dkf-prompt">&gt; hack_</b>`;
  return `<b class="dkf-puff"></b>`;
}
