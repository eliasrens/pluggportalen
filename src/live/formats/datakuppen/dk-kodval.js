// ============================================================================
// Datakuppen 💾 (#653): KODVALET – eleven väljer sin kod bland 4 förslag
// (spec §1.2, §1.5, §4.3). Eleven SKRIVER ALDRIG en egen kod: knapparna
// skickar bara ett index i förslagen (pickCode), servern skriver koden.
//   lobby   "Välj din hemliga kod" – fyra stora kort; sedan "Din kod: f0tb01l"
//   live    "Välj ny kod" efter ett hack – en smal rad med fyra koder och
//           nedräkning (~10 s, serverns offersExpiresAt). Spelet stoppas inte:
//           frågan ligger kvar under, och inget tar tangentbordsfokus.
// Koderna i monospace där 0/o och 1/l går att skilja åt: siffrorna har egen
// färg och nollan snedstreck (codeHtml, datakuppen-elev.css .dk-kod).
//
// API
//   codeHtml(kod)  → (escapad) HTML: <span class="dk-kod">f<b>0</b>tb<b>0</b><b>1</b>l</span>
//   createCodePicker(host, { lobby, pick(index) → Promise, sound? })
//     → { set({ offers, code, leftMs, show }), error(msg), destroy() }
// ============================================================================

import { codeChars, protectionText } from "./dk-elev.js";
import { playDkSound } from "./dk-ljud.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function codeHtml(kod) {
  const inner = codeChars(kod).map((c) => (c.digit ? `<b>${esc(c.ch)}</b>` : esc(c.ch))).join("");
  // --n = antal tecken: kortens CSS skalar texten så att även 11 tecken ryms.
  return `<span class="dk-kod" style="--n:${Math.max(4, String(kod || "").length)}" aria-label="${esc(String(kod || "").split("").join(" "))}">${inner}</span>`;
}

export function createCodePicker(host, { lobby = false, pick, sound = null }) {
  let busy = false;
  let offersKey = "";
  let destroyed = false;
  const cls = lobby ? "dkv dkv-lobby" : "dkv dkv-ny";
  host.innerHTML = `<div class="${cls}">
      <p class="dkv-rubrik">${lobby ? "🔑 Välj din hemliga kod" : "🔑 Din kod läckte – välj en ny!"}<span class="dkv-tid" hidden></span></p>
      <div class="dkv-rad" role="group" aria-label="Kodförslag"></div>
      <p class="dkv-min" hidden></p>
      <p class="dkv-fel" role="alert" hidden></p>
    </div>`;
  const root = host.firstElementChild;
  const row = root.querySelector(".dkv-rad");
  const mine = root.querySelector(".dkv-min");
  const tid = root.querySelector(".dkv-tid");
  const fel = root.querySelector(".dkv-fel");

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
    set({ offers = [], code = null, leftMs = null, show = true } = {}) {
      if (destroyed) return;
      root.hidden = !show && !(lobby && code) && fel.hidden;
      const picking = show && offers.length > 0;
      row.hidden = !picking;
      root.querySelector(".dkv-rubrik").hidden = !picking;
      const key = offers.join("|");
      if (picking && key !== offersKey) {
        offersKey = key;
        row.innerHTML = offers.map((o, i) => `<button type="button" class="dkv-kort" data-i="${i}">${codeHtml(o)}</button>`).join("");
        row.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => choose(Number(b.dataset.i), b)));
      }
      tid.hidden = leftMs == null || !picking;
      if (leftMs != null) tid.textContent = protectionText(leftMs);
      mine.hidden = !(code && (lobby ? !picking : false));
      if (!mine.hidden) mine.innerHTML = `Din kod: ${codeHtml(code)} <span class="dkv-bock">✓</span><small>Den är hemlig – berätta den inte för någon.</small>`;
    },
    error(msg) {
      if (destroyed) return;
      fel.textContent = msg ? `😕 ${msg}` : "";
      fel.hidden = !msg;
      if (msg) root.hidden = false;
    },
    destroy() {
      destroyed = true;
      host.innerHTML = "";
    },
  };
}
