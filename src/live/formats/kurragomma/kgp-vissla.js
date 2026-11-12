// ============================================================================
// Kurragömma 🙈 – lärarens VISSLA-PANEL (#840, Elias 2026-11-11). Liten, diskret
// panel i LÄRARENS fönster (projektorskalet utan screen – aldrig i elevskärms-
// fönstret som klassen ser): under letfasen en knapp "🔔 Vissla" nere till höger
// som fäller ut listan över de gömda eleverna, en Vissla-knapp var. Läraren
// visslar på en elev som bryter mot reglerna (ropar, tittar på andras skärm …):
// kgLarareVissla på servern utlöser SAMMA vissling som ett fel svar – projektor,
// sökare och eleven själv ser en vanlig vissling, aldrig att det var läraren.
//
// Kvoten (§10.8): INGEN lyssnare. Listan läses när panelen öppnas och vid ↻ –
// en läsning per gömd elev (kgPlayers where roll == gomd, bara namn och uid,
// aldrig gömställen). Panelen håller räkningen (lasningar) för slut-QA:s mätning.
// Fungerar på ~380 px (px-mått, inte --kgp-u).
//
//   createVisslaPanel(host, { sid, koppling: { getGomda(sid), larareVissla(sid, uid) } })
//     → { visa(bool), lasningar(), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { LARARE_VISSLA_SPARR_MS } from "./delat/kg-config.js";
import { visslaFelText, visslaLista } from "./kgp-logik.js";

export function createVisslaPanel(host, { sid, koppling }) {
  const root = document.createElement("div");
  root.className = "kgp-vissla";
  root.hidden = true;
  root.innerHTML = `
    <button type="button" class="kgp-vissla-knapp" aria-expanded="false" title="Vissla på en gömd elev som bryter mot reglerna">🔔 Vissla</button>
    <div class="kgp-vissla-panel" hidden>
      <div class="kgp-vissla-topp"><b>Vissla på en gömd elev</b>
        <button type="button" class="kgp-vissla-ladda" title="Läs listan igen">↻</button>
        <button type="button" class="kgp-vissla-stang" aria-label="Stäng">✕</button></div>
      <p class="kgp-vissla-hint">Samma vissling som vid fel svar – ingen ser att det var du.</p>
      <ul class="kgp-vissla-lista"></ul>
      <p class="kgp-vissla-msg" hidden></p>
    </div>`;
  host.appendChild(root);
  const $ = (q) => root.querySelector(q);
  const knapp = $(".kgp-vissla-knapp");
  const panel = $(".kgp-vissla-panel");
  const lista = $(".kgp-vissla-lista");
  let lasningar = 0;
  let laddar = false;
  let destroyed = false;
  const timers = new Set();

  function msg(text) {
    const m = $(".kgp-vissla-msg");
    m.textContent = text || "";
    m.hidden = !text;
  }

  async function ladda() {
    if (laddar || destroyed) return;
    laddar = true;
    msg("");
    lista.innerHTML = `<li class="kgp-vissla-tom">Läser …</li>`;
    try {
      const gomda = visslaLista(await koppling.getGomda(sid));
      lasningar += gomda.length;
      if (destroyed) return;
      lista.innerHTML = gomda.length
        ? gomda.map((g) => `<li data-uid="${esc(g.uid)}"><span class="kgp-vissla-namn">${esc(g.namn || "Någon")}</span>
            <small class="kgp-vissla-rad-msg"></small><button type="button" class="kgp-vissla-en" data-vissla="${esc(g.uid)}">🔔 Vissla</button></li>`).join("")
        : `<li class="kgp-vissla-tom">Ingen är gömd just nu.</li>`;
      lista.querySelectorAll("[data-vissla]").forEach((b) => b.addEventListener("click", () => vissla(b.dataset.vissla, b)));
    } catch (err) {
      lista.innerHTML = "";
      msg(`Listan kunde inte läsas (${err?.message || err}).`);
    } finally {
      laddar = false;
    }
  }

  async function vissla(uid, b) {
    const li = b.closest("li");
    const radMsg = li.querySelector(".kgp-vissla-rad-msg");
    b.disabled = true;
    radMsg.textContent = "…";
    try {
      await koppling.larareVissla(sid, uid);
      b.textContent = "Visslade ✓";
      radMsg.textContent = "";
      const t = setTimeout(() => { timers.delete(t); if (!destroyed) { b.disabled = false; b.textContent = "🔔 Vissla"; } }, LARARE_VISSLA_SPARR_MS);
      timers.add(t);
    } catch (err) {
      const f = visslaFelText(err);
      radMsg.textContent = f.text;
      if (f.bort) { const t = setTimeout(() => { timers.delete(t); li.remove(); }, 1500); timers.add(t); }
      else b.disabled = false;
    }
  }

  function oppna(v) {
    panel.hidden = !v;
    knapp.setAttribute("aria-expanded", String(v));
    root.classList.toggle("kgp-vissla-oppen", v);
    if (v) ladda();
  }
  knapp.addEventListener("click", () => oppna(panel.hidden));
  $(".kgp-vissla-stang").addEventListener("click", () => oppna(false));
  $(".kgp-vissla-ladda").addEventListener("click", ladda);

  return {
    visa(v) {
      if (root.hidden === !v) return;
      root.hidden = !v;
      if (!v) oppna(false);
    },
    lasningar: () => lasningar,
    destroy() {
      destroyed = true;
      timers.forEach(clearTimeout);
      root.remove();
    },
  };
}
