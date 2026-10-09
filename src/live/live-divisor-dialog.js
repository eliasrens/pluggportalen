// ============================================================================
// Live: "Ändra nämnare"-dialogen (#543) – lärarens Live-modul (Aktiva Live-
// sessioner) och projektorns kontrollpanel under pågående match. Ett heltals-
// fält per klass; Spara skriver bara de ändrade (setClassDivisor per klass).
// Poängen (rätt ÷ nämnare) räknas om direkt i alla vyer via realtidslagret.
// Efter matchslut är nämnaren låst: dialogen visar bara en förklaring.
//
// API: openDivisorDialog(host, { session, save(classId, n) → Promise, lockedText? })
//        → close()
//   host: där dialogen hängs in (projektorn: sin rot, så den syns i fullskärm)
// Laddas bara från dynamiskt laddade Live-moduler (aldrig i bootgrafen).
// ============================================================================

import { esc } from "../teacher-shared.js";
import { DIVISOR_LOCKED_MSG } from "./live-core.js";

export function openDivisorDialog(host, { session, save, lockedText = DIVISOR_LOCKED_MSG }) {
  const s = session;
  const locked = s.status === "finished";
  const names = s.classNames || {};
  const wrap = document.createElement("div");
  wrap.className = "ldv-back";
  wrap.innerHTML = `
    <form class="ldv" role="dialog" aria-modal="true" aria-labelledby="ldv-h">
      <h2 id="ldv-h">Ändra nämnare</h2>
      ${locked ? `<p class="ldv-locked">🔒 ${esc(lockedText)}</p>` : `
      <p class="ldv-hint">Poängen = rätt svar ÷ nämnaren. Ändra t.ex. om en elev inte kan vara med – poängen räknas om direkt.</p>
      ${s.participatingClassIds.map((id) => `
        <label class="ldv-row"><span>${esc(names[id] || id)}</span>
          <input type="number" min="1" max="999" step="1" required inputmode="numeric"
            data-cid="${esc(id)}" value="${esc(s.classDivisors?.[id] ?? 1)}" /></label>`).join("")}`}
      <p class="ldv-err" role="alert" hidden></p>
      <div class="ldv-btns">
        <button type="button" class="ldv-btn" data-close>${locked ? "Stäng" : "Avbryt"}</button>
        ${locked ? "" : `<button type="submit" class="ldv-btn ldv-save">Spara</button>`}
      </div>
    </form>`;
  host.appendChild(wrap);
  const form = wrap.querySelector("form");
  const err = wrap.querySelector(".ldv-err");
  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    wrap.remove();
  };
  const onKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
  };
  document.addEventListener("keydown", onKey, true);
  wrap.querySelector("[data-close]").addEventListener("click", close);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  (wrap.querySelector("input") || wrap.querySelector("[data-close]")).focus();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const changes = [...form.querySelectorAll("[data-cid]")]
      .map((inp) => ({ cid: inp.dataset.cid, v: Number(inp.value) }))
      .filter(({ cid, v }) => v !== s.classDivisors?.[cid]);
    const bad = changes.find(({ v }) => !Number.isInteger(v) || v < 1 || v > 999);
    if (bad) return showErr(`Nämnaren för ${names[bad.cid] || bad.cid} måste vara ett heltal 1–999.`);
    const btn = form.querySelector(".ldv-save");
    btn.disabled = true;
    try {
      for (const { cid, v } of changes) await save(cid, v);
      close();
    } catch (ex) {
      showErr(ex?.message || String(ex));
      btn.disabled = false;
    }
  });

  function showErr(text) {
    err.textContent = text;
    err.hidden = false;
  }
  return close;
}
