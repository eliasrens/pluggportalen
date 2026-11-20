// ============================================================================
// Matchdagen (#869): små delade hjälpare för elevens vyer – escape, rutan över
// sidan (halvtid, efter matchen, säsongen), val-knapparna med tangenterna 1–4,
// typsnitten och format för tid och procent. Ingen Firebase.
// ============================================================================

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const vanta = (ms) => new Promise((ok) => setTimeout(ok, ms));
export const procent = (ratt, alla) => (alla ? `${Math.round((100 * ratt) / alla)} %` : "–");

/** Speltid: "45 min", "2 h 10 min". */
export function tidText(minuter) {
  const m = Math.round(Number(minuter) || 0);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

/** En liten tröj-chip i lagets färg. */
export const chip = (farg, extra = "") => `<span class="md-chip${extra ? ` ${extra}` : ""}" style="background:${esc(farg)}" aria-hidden="true"></span>`;

/** Barlow Condensed + Nunito (skissen) – laddas en gång när Matchdagen öppnas. */
export function laddaTypsnitt() {
  if (document.getElementById("md-typsnitt")) return;
  const l = document.createElement("link");
  l.id = "md-typsnitt";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Nunito:wght@600;700;800&display=swap";
  document.head.appendChild(l);
}

/**
 * En ruta över sidan med rubrik, innehåll och knappar. Löser med knappens id.
 * Fokus hamnar på första knappen; Enter/klick väljer.
 * @param {HTMLElement} host  .md-sida (rutan läggs sist i den)
 */
export function ruta(host, { rubrik, html = "", knappar = [{ id: "ok", text: "OK" }], klass = "" }, signal) {
  return new Promise((ok) => {
    const el = document.createElement("div");
    el.className = `md-overlag${klass ? ` ${klass}` : ""}`;
    el.innerHTML = `<div class="md-ruta" role="dialog" aria-modal="true" aria-labelledby="md-ruta-rubrik">
      <h2 id="md-ruta-rubrik">${rubrik}</h2>${html}
      <div class="md-rad">${knappar.map((k, i) => `<button type="button" class="${i ? "md-ghost" : "md-stor"}" data-id="${esc(k.id)}">${esc(k.text)}</button>`).join("")}</div>
    </div>`;
    host.appendChild(el);
    const klar = (id) => { el.remove(); signal?.removeEventListener("abort", avbryt); ok(id); };
    const avbryt = () => klar(null);
    signal?.addEventListener("abort", avbryt);
    el.querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", () => klar(b.dataset.id)));
    el.querySelector("button")?.focus({ preventScroll: true });
  });
}

/** Ligger elementet i en dold flik (Tabell/Truppen/Statistik visas)? Då gäller inte tangenterna. */
const dold = (el) => !!el.closest?.("[hidden]");

/**
 * Valen när vi har bollen eller försvarar: stora knappar och tangenterna 1–4.
 * @returns {Promise<string|null>} valets id (null = avbrutet)
 */
export function valMeny(host, val, signal) {
  return new Promise((ok) => {
    host.innerHTML = `<div class="md-val" role="group" aria-label="Välj ditt drag">${val.map((v, i) =>
      `<button type="button" data-id="${esc(v.id)}"${v.av ? " disabled" : ""}><kbd aria-hidden="true">${i + 1}</kbd><b>${esc(v.namn)}</b><small>${esc(v.text || "")}${v.fragor > 1 ? " · två frågor" : ""}</small></button>`).join("")}</div>`;
    const knappar = [...host.querySelectorAll("button[data-id]")];
    const klar = (id) => { document.removeEventListener("keydown", tangent); signal?.removeEventListener("abort", avbryt); ok(id); };
    const avbryt = () => klar(null);
    function tangent(e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target?.matches?.("input, textarea") || dold(host)) return;
      const n = Number(e.key);
      const b = knappar[n - 1];
      if (b && !b.disabled) { e.preventDefault(); klar(b.dataset.id); }
    }
    if (signal?.aborted) return ok(null);
    signal?.addEventListener("abort", avbryt);
    document.addEventListener("keydown", tangent);
    knappar.forEach((b) => b.addEventListener("click", () => klar(b.dataset.id)));
    host.querySelector(".md-val")?.setAttribute("tabindex", "-1");
    host.querySelector(".md-val")?.focus({ preventScroll: true });
  });
}
