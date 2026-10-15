// ============================================================================
// Datakuppen 💾 (#653, #719): KODVALET i lobbyn och den DOLDA egna koden.
// Eleven väljer sin kod bland 4 förslag (spec §1.2, §4.3) EN gång – koden
// gäller sedan hela matchen, även efter ett hack (#719). Eleven SKRIVER ALDRIG
// en egen kod: knapparna skickar bara ett index i förslagen (pickCode),
// servern skriver koden.
//   lobby   "Välj din hemliga kod" – fyra stora kort; sedan "Din kod: f0tb01l"
//           en kort stund (eleven hinner läsa den), därefter dold
//   dold    "Din kod: •••• [👁 Visa kod]" – knappen visar koden i några
//           sekunder (eller tills nästa tryck). Vanlig <button>: fungerar med
//           touch, mus och tangentbord (Tab + Enter/blanksteg).
// Koderna i monospace där 0/o och 1/l går att skilja åt: siffrorna har egen
// färg och nollan snedstreck (codeHtml, datakuppen-elev.css .dk-kod).
//
// API
//   codeHtml(kod)  → (escapad) HTML: <span class="dk-kod">f<b>0</b>tb<b>0</b><b>1</b>l</span>
//   createCodeReveal(host, { label?, showMs? }) → { set(kod), show(ms?), hide(), destroy() }
//   createCodePicker(host, { pick(index) → Promise, sound? })
//     → { set({ offers, code }), error(msg), destroy() }
// ============================================================================

import { codeChars } from "./dk-elev.js";
import { playDkSound } from "./dk-ljud.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const REVEAL_MS = 5000; // "Visa kod" → koden syns så här länge
const LOBBY_SHOW_MS = 6000; // direkt efter kodvalet i lobbyn

export function codeHtml(kod) {
  const inner = codeChars(kod).map((c) => (c.digit ? `<b>${esc(c.ch)}</b>` : esc(c.ch))).join("");
  // --n = antal tecken: kortens CSS skalar texten så att även 11 tecken ryms.
  return `<span class="dk-kod" style="--n:${Math.max(4, String(kod || "").length)}" aria-label="${esc(String(kod || "").split("").join(" "))}">${inner}</span>`;
}

const HIDDEN_HTML = '<span class="dk-kod dkr-dold" aria-label="dold">••••</span>';

export function createCodeReveal(host, { label = "Din kod:", showMs = REVEAL_MS } = {}) {
  host.innerHTML = `<span class="dkr">${esc(label)} <span class="dkr-kod" aria-live="polite"></span>
      <button type="button" class="dkr-knapp" aria-pressed="false"></button></span>`;
  const kodEl = host.querySelector(".dkr-kod");
  const btn = host.querySelector(".dkr-knapp");
  let code = null;
  let open = false;
  let t = 0;

  function draw() {
    const html = open && code ? codeHtml(code) : HIDDEN_HTML;
    if (kodEl.innerHTML !== html) kodEl.innerHTML = html;
    btn.textContent = open ? "🙈 Dölj" : "👁 Visa kod";
    btn.setAttribute("aria-pressed", String(open));
    btn.disabled = !code;
  }
  function hide() {
    clearTimeout(t);
    open = false;
    draw();
  }
  function show(ms = showMs) {
    if (!code) return;
    clearTimeout(t);
    open = true;
    draw();
    t = setTimeout(hide, ms);
  }
  btn.addEventListener("click", () => (open ? hide() : show()));
  draw();

  return {
    set(next) {
      const c = next || null;
      if (c === code) return;
      code = c;
      if (!code) open = false;
      draw();
    },
    show,
    hide,
    destroy() {
      clearTimeout(t);
      host.innerHTML = "";
    },
  };
}

export function createCodePicker(host, { pick, sound = null }) {
  let busy = false;
  let offersKey = "";
  let destroyed = false;
  let hadCode = null; // null = inget ritat än (omladdning med kod → dold direkt)
  host.innerHTML = `<div class="dkv dkv-lobby">
      <p class="dkv-rubrik">🔑 Välj din hemliga kod</p>
      <div class="dkv-rad" role="group" aria-label="Kodförslag"></div>
      <p class="dkv-min" hidden><span class="dkv-visa"></span> <span class="dkv-bock">✓</span><small>Den är hemlig – berätta den inte för någon. Den gäller hela matchen.</small></p>
      <p class="dkv-fel" role="alert" hidden></p>
    </div>`;
  const root = host.firstElementChild;
  const row = root.querySelector(".dkv-rad");
  const mine = root.querySelector(".dkv-min");
  const fel = root.querySelector(".dkv-fel");
  const reveal = createCodeReveal(root.querySelector(".dkv-visa"));

  async function choose(i, btn) {
    if (busy || destroyed) return;
    busy = true;
    fel.hidden = true;
    row.querySelectorAll("button").forEach((b) => { b.disabled = true; b.classList.toggle("vald", b === btn); });
    playDkSound(sound, "klick");
    try {
      await pick(i);
    } catch (err) {
      if (destroyed) return;
      fel.textContent = `😕 ${err?.message || "Det gick inte – försök igen."}`;
      fel.hidden = false;
      row.querySelectorAll("button").forEach((b) => { b.disabled = false; b.classList.remove("vald"); });
    } finally {
      busy = false;
    }
  }

  return {
    set({ offers = [], code = null } = {}) {
      if (destroyed) return;
      const picking = !code && offers.length > 0;
      row.hidden = !picking;
      root.querySelector(".dkv-rubrik").hidden = !picking;
      const key = offers.join("|");
      if (picking && key !== offersKey) {
        offersKey = key;
        row.innerHTML = offers.map((o, i) => `<button type="button" class="dkv-kort" data-i="${i}">${codeHtml(o)}</button>`).join("");
        row.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => choose(Number(b.dataset.i), b)));
      }
      mine.hidden = !code;
      reveal.set(code);
      // Nyss vald → syns en stund så att eleven hinner läsa den, sedan dold.
      if (code && hadCode === false) reveal.show(LOBBY_SHOW_MS);
      hadCode = !!code;
    },
    error(msg) {
      if (destroyed) return;
      fel.textContent = msg ? `😕 ${msg}` : "";
      fel.hidden = !msg;
    },
    destroy() {
      destroyed = true;
      reveal.destroy();
      host.innerHTML = "";
    },
  };
}
