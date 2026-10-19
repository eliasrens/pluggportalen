// ============================================================================
// Pluggporten – lärarsidan: lärarspärren (teacher-gate.js)
// ----------------------------------------------------------------------------
// Inloggningsvyn för lärare. Efter inloggning landar man på Hem (#803) – eller på
// den lärarsida man försökte öppna. Laddas med import() via renderGate i
// teacher-shared.js (som alla lärarsidor själva laddas lat, #271).
// ============================================================================

import { signInTeacher, takeSessionLostNotice } from "./auth.js";
import { el, esc, icon } from "./teacher-shared.js";


export function renderGate(ctx) {
  const view = el(`<div class="teacher-page teacher-dark">
    <a class="back-link" id="back">← Tillbaka</a>
    <div class="panel gate-panel center">
      <span class="gate-icon" aria-hidden="true">${icon("lock", 30)}</span>
      <h1 class="center">Lärarläge</h1>
      <p class="hint center">Logga in med ditt lärarkonto (användarnamn + lösenord) för att komma vidare.</p>
      <div id="msg"></div>
      <form id="form">
        <div class="field">
          <label for="username">Användarnamn</label>
          <input id="username" type="text" autocomplete="username" autocapitalize="none" placeholder="Användarnamn" />
        </div>
        <div class="field">
          <label for="p">Lösenord</label>
          <input id="p" type="password" autocomplete="current-password" placeholder="Lösenord" />
        </div>
        <button class="btn stor gron" type="submit" id="submit">Logga in</button>
      </form>
    </div>
  </div>`);

  const msg = view.querySelector("#msg");
  if (takeSessionLostNotice()) msg.innerHTML = `<div class="msg error">Du har loggats ut. Logga in igen.</div>`;
  view.querySelector("#back").addEventListener("click", () => ctx.go("#/"));
  view.querySelector("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.innerHTML = "";
    const btn = view.querySelector("#submit");
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Loggar in…";
    try {
      const res = await signInTeacher(
        view.querySelector("#username").value,
        view.querySelector("#p").value
      );
      if (res.ok) {
        // Spärren visas ofta REDAN på målet (#/larare → redirect → gate); en
        // bar go() till samma hash ger ingen hashchange → tvinga om-routning.
        const h = window.location.hash;
        const target = h.startsWith("#/larare/") ? h : "#/larare/hem";
        if (window.location.hash === target) {
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        } else {
          ctx.go(target);
        }
      } else {
        msg.innerHTML = `<div class="msg error">${esc(res.error)}</div>`;
      }
    } catch (err) {
      msg.innerHTML = `<div class="msg error">Något gick fel: ${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });
  ctx.app.replaceChildren(view);
  // Säsongstemat (#691): dekor runt panelen, panelen själv oförändrad.
  import("./season-world.js").then((m) => view.isConnected && m.mountGateSasong(view)).catch(() => {});
}
