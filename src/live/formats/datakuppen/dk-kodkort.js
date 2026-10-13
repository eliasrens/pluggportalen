// ============================================================================
// Datakuppen 💾 (#653): HACKET STEG 2 – knäck koden (spec §1.4, §4.3).
//   • kompisens namn + TRE stora kodkort i monospace (codeHtml), 1–3/klick
//   • ~10 s (serverns expiresAt, synlig nedräkning) – tiden ute → guess(null)
//     och hacket misslyckas utan annan påföljd
//   • rätt kod → kortet lyser grönt ("Rätt kod! 🔓 +45 MB från Omar")
//   • fel kod → kortet STRYKS med en tydlig animation (ett streck dras över,
//     kortet skakar lätt och bleknar) – "Fel kod!"
//   • MINNESMOMENTET: andra försöket mot samma mål får färre koder av servern;
//     de strukna visas som BORTA (genomstrukna, tomma platser) så att eleven
//     ser att listan krympt. Vilka koder som är borta minns klienten själv
//     (createHackMemory) – servern avgör ändå alltid vad som är rätt.
// Komponenten vet aldrig vilken kod som är rätt; den skickar bara index.
// Reducerad rörelse: strecket och skakningen ersätts av toningar.
// Stilar: datakuppen-hack.css (dkk-*).
//
// API
//   playCodeCards(host, { target, struck?, now, guess, onResult?, sound?, reduced? })
//     target = { targetUid, targetName, options[], expiresAtMs }
//     guess(index | null) → Promise<guessCode-svar>
//     onResult(view, res)  när servern svarat (vyn räknar upp datan, reagerar)
//     → { done, destroy() }   done → Promise<{ res, view }>
// ============================================================================

import { codeSlots, guessView, firstName } from "./dk-elev.js";
import { codeHtml } from "./dk-kodval.js";
import { playDkSound } from "./dk-ljud.js";
import { DK_RULES } from "./delat/files-config.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const genitiv = (n) => (/[sxz]$/i.test(n) ? n : `${n}s`);
const KEYS = { 1: 0, 2: 1, 3: 2 };
const SHOW_MS = { ratt: 1400, fel: 1700, tid: 1500 };

export function playCodeCards(host, { target, struck = [], now, guess, onResult = () => {}, sound = null, reduced = false }) {
  const name = firstName(target.targetName) || "kompisen";
  const slots = codeSlots(target.options, struck);
  const fewer = slots.some((s) => s.gone);
  host.innerHTML = `<div class="dkk">
      <div class="dkk-topp"><h2 class="dkk-rubrik">🔒 Knäck <b>${esc(genitiv(name))}</b> kod!</h2>
        <div class="dkk-klocka" aria-live="off"><span class="dkk-sek">10</span><small>s</small></div></div>
      <div class="dkk-tid" aria-hidden="true"><i></i></div>
      <p class="dkk-hint">${fewer ? "Den strukna koden är borta – en av de här är rätt!" : "En av koderna är rätt. Välj en!"}</p>
      <div class="dkk-rad" role="group" aria-label="Koder">${slots.map((s, i) => (s.gone
        ? `<div class="dkk-kort dkk-borta" aria-label="Struken kod">${s.code ? codeHtml(s.code) : '<span class="dk-kod">· · ·</span>'}<span class="dkk-stampel">struken</span></div>`
        : `<button type="button" class="dkk-kort" data-i="${i}">${codeHtml(s.code)}<span class="dkk-nr" aria-hidden="true">${i + 1}</span><span class="dkk-streck" aria-hidden="true"></span></button>`)).join("")}</div>
      <p class="dkk-svar" role="status" aria-live="polite"><b></b><span></span></p>
    </div>`;
  const root = host.firstElementChild;
  const btns = [...root.querySelectorAll("button.dkk-kort")];
  const sek = root.querySelector(".dkk-sek");
  const bar = root.querySelector(".dkk-tid i");
  const svar = root.querySelector(".dkk-svar");
  let busy = false;
  let destroyed = false;
  let autoSent = false;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  const leftMs = () => (target.expiresAtMs == null ? DK_RULES.codeGuessMs : Math.max(0, target.expiresAtMs - now()));
  const total = DK_RULES.codeGuessMs;

  function tell(view) {
    svar.dataset.tone = view.tone;
    svar.querySelector("b").textContent = view.title;
    svar.querySelector("span").textContent = view.text ? ` ${view.text}` : "";
    svar.classList.remove("syns");
    void svar.offsetWidth;
    svar.classList.add("syns");
  }

  async function pick(i) {
    if (busy || destroyed) return;
    const btn = i == null ? null : btns.find((b) => Number(b.dataset.i) === i);
    if (i != null && !btn) return;
    busy = true;
    clearInterval(iv);
    btns.forEach((b) => { b.disabled = true; b.classList.toggle("vald", b === btn); });
    root.classList.add("dkk-valt");
    playDkSound(sound, "klick");
    let res;
    try {
      res = await guess(i);
    } catch (err) {
      if (destroyed) return;
      busy = false;
      btns.forEach((b) => { b.disabled = false; b.classList.remove("vald"); });
      root.classList.remove("dkk-valt");
      tell({ tone: "tid", title: "😕", text: err?.message || "Det gick inte – försök igen." });
      if (leftMs() <= 0) {
        // Ingen tid kvar → hacket är över.
        return resolveDone({ res: { result: "timeout" }, view: guessView({ result: "timeout" }, name) });
      }
      iv = setInterval(tick, 200);
      return;
    }
    if (destroyed) return;
    const view = guessView(res, name);
    if (btn && res?.result === "hacked") btn.classList.add("ratt");
    if (btn && res?.result === "wrong") btn.classList.add("struken");
    root.dataset.utfall = res?.result || "";
    playDkSound(sound, view.sound);
    tell(view);
    try { onResult(view, res); } catch (e) { console.warn("Datakuppen: onResult", e); }
    await new Promise((r) => setTimeout(r, SHOW_MS[view.tone] || 1500));
    if (!destroyed) resolveDone({ res, view });
  }

  let iv = 0;
  function tick() {
    if (destroyed || busy) return;
    const left = leftMs();
    sek.textContent = String(Math.ceil(left / 1000));
    bar.style.transform = `scaleX(${Math.min(1, left / total).toFixed(3)})`;
    root.classList.toggle("dkk-brattom", left <= 3000);
    if (left <= 0 && !autoSent) {
      autoSent = true;
      pick(null);
    }
  }
  tick();
  iv = setInterval(tick, 200);

  function onKey(e) {
    if (busy || destroyed || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key in KEYS) {
      const b = btns[KEYS[e.key]];
      if (!b) return;
      e.preventDefault();
      pick(Number(b.dataset.i));
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const cur = btns.indexOf(document.activeElement);
      const n = btns.length;
      const next = btns[((cur < 0 ? 0 : cur) + (e.key === "ArrowRight" ? 1 : -1) + n) % n];
      try { next?.focus({ preventScroll: true }); } catch { next?.focus(); }
    }
  }
  btns.forEach((b) => b.addEventListener("click", () => pick(Number(b.dataset.i))));
  document.addEventListener("keydown", onKey);
  setTimeout(() => { if (!destroyed && !busy) try { btns[0]?.focus({ preventScroll: true }); } catch {} }, 0);
  if (!reduced) root.classList.add("dkk-in");

  return {
    done,
    destroy() {
      destroyed = true;
      clearInterval(iv);
      document.removeEventListener("keydown", onKey);
      host.innerHTML = "";
    },
  };
}
