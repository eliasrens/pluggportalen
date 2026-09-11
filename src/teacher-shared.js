// ============================================================================
// Pluggportalen – lärarsidan: delat (teacher-shared.js)
// ----------------------------------------------------------------------------
// Delade byggstenar för lärarsidans undersidor:
//   * Lärarinloggning via Firebase Auth (custom claim teacher:true). Ersätter
//     det gamla hårdkodade lösenordet. Logiken bor i src/auth.js.
//   * Små DOM-/text-hjälpare (el, esc, copyText, wireHashLinks).
//   * Gemensam lärar-toppnav (teacherNav) – sticky flikrad.
//   * Diskret sidtitel (teacherHead) och vänliga tomtillstånd (emptyState)
//     så alla undersidor känns som en familj.
//   * Lärarinloggnings-vy (renderGate). Översikts-hubben (pageLarare) är
//     borttagen (issue #304) – toppnaven orienterar, hubben dubblerade den.
//
// Sidorna anropas från app.js router med ett `ctx` som innehåller de delade
// hjälparna { app, go, renderTopbar }.
// ============================================================================

import { isTeacher, signInTeacher, signOutCurrent } from "./auth.js";

// --- Lärarläge --------------------------------------------------------------
// isTeacher() läser custom claim (teacher:true) ur den inloggade Auth-användaren
// – re-exporteras här eftersom lärarsidans moduler importerar den härifrån.
export { isTeacher };

/** Lås lärarläget (logga ut lärar-Auth-användaren). */
export function setTeacher(on) {
  if (!on) signOutCurrent();
}

// --- Små hjälpare -----------------------------------------------------------

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Enkel HTML-escape för att lägga in text säkert i markup. */
export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Koppla interna navigeringslänkar/-knappar (`data-hash`) i ett element till
 * routern. Delas av alla lärarvyer så länkar mellan vyer beter sig likadant.
 */
export function wireHashLinks(ctx, root) {
  root.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      ctx.go(a.dataset.hash);
    })
  );
}

export async function copyText(text, btn) {
  const done = () => {
    const old = btn.textContent;
    btn.textContent = "✓ Kopierat!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = old;
      btn.classList.remove("copied");
    }, 1600);
  };
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch {
    // Fallback för äldre webbläsare / osäker kontext.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch {
      alert("Kunde inte kopiera automatiskt – markera texten och kopiera manuellt.");
    }
    ta.remove();
  }
}

// --- Gemensam navigation & sidhuvud ----------------------------------------

/** Gemensam lärar-toppnav (flikar) för lärarsidans undersidor. Sticky rad. */
export function teacherNav(ctx, active) {
  const tabs = [
    // Översikts-hubben (🏠 Översikt / pageLarare) är borttagen (issue #304):
    // toppnaven gör orienteringsjobbet, hubben dubblerade bara flikarna.
    // Klasser, elevkonton & statistik (#/larare/klasser) – den enade klass-fliken.
    // Klassöversikten/statistiken (gamla 📊 Klass) är sammanslagen hit som en
    // expander per klasskort (issue #299), så navet har EN klass-flik.
    { hash: "#/larare/klasser", key: "klasser", label: "🏫 Klasser & elever" },
    { hash: "#/larare/innehall", key: "innehall", label: "📚 Innehåll" },
  ];
  const nav = el(`<nav class="teacher-nav" aria-label="Lärarnavigation">
    <div class="teacher-nav-inner">
      ${tabs
        .map(
          (t) =>
            `<a class="tnav ${t.key === active ? "active" : ""}" data-hash="${t.hash}"${
              t.key === active ? ' aria-current="page"' : ""
            }>${t.label}</a>`
        )
        .join("")}
      <a class="tnav logout" data-logout="1">🔒 Lås lärarläge</a>
    </div>
  </nav>`);
  nav.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", () => ctx.go(a.dataset.hash))
  );
  nav.querySelector("[data-logout]").addEventListener("click", () => {
    setTeacher(false);
    ctx.go("#/");
  });
  return nav;
}

/**
 * Diskret sidtitel för en lärar-undersida – bara för orientering. Tidigare var
 * detta ett helt hjälte-block med brödsmula "← Till översikten", stor ikon och
 * en förklarande ingress; allt det är bortskalat (issue #304) eftersom
 * toppnaven (teacherNav) redan markerar var man är och översikts-hubben är
 * borta. `emoji`/`title` behålls; ev. `lead` ignoreras (bakåtkompatibel signatur).
 */
export function teacherHead(_ctx, { emoji = "📋", title = "" } = {}) {
  return el(`<header class="teacher-head-slim">
    <h1 class="teacher-page-title">${esc(emoji)} ${esc(title)}</h1>
  </header>`);
}

/**
 * Vänligt tomtillstånd: ikon + rubrik + kort text + (valfri) knapp till nästa
 * steg. Används när det inte finns klasser/elever/innehåll ännu, i stället för
 * en tom yta. `text` får innehålla enkel markup.
 */
export function emptyState(ctx, { emoji = "✨", title = "", text = "", actionLabel = "", actionHash = "" } = {}) {
  const box = el(`<div class="empty-state">
    <span class="empty-state-icon">${esc(emoji)}</span>
    <h3 class="empty-state-title">${esc(title)}</h3>
    ${text ? `<p class="empty-state-text">${text}</p>` : ""}
    ${
      actionHash
        ? `<button class="btn" data-hash="${esc(actionHash)}">${esc(actionLabel || "Nästa steg →")}</button>`
        : ""
    }
  </div>`);
  if (ctx) wireHashLinks(ctx, box);
  return box;
}

// ============================================================================
// Lärarspärr (gate)
// ----------------------------------------------------------------------------
// Översikts-hubben (pageLarare: välkomst-hero + stora genvägskort) är borttagen
// (issue #304) – den dubblerade toppnaven. Efter inloggning landar man direkt
// på "Klasser & elever" (#/larare/klasser); route #/larare omdirigerar dit
// (se app.js) så gamla länkar/bokmärken inte bryts.
// ============================================================================

export function renderGate(ctx) {
  const view = el(`<div class="teacher-page">
    <a class="back-link" id="back">← Tillbaka</a>
    <div class="panel gate-panel center">
      <span class="gate-icon">🔐</span>
      <h1 class="center">Lärarläge</h1>
      <p class="hint center">Logga in med ditt lärarkonto (användarnamn + lösenord) för att komma vidare.</p>
      <div id="msg"></div>
      <form id="form">
        <div class="field">
          <label for="username">Användarnamn</label>
          <input id="username" type="text" autocomplete="username" autocapitalize="none" placeholder="teacher26" />
        </div>
        <div class="field">
          <label for="p">Lösenord</label>
          <input id="p" type="password" autocomplete="current-password" placeholder="Lösenord" />
        </div>
        <button class="btn stor" type="submit" id="submit">Logga in</button>
      </form>
    </div>
  </div>`);

  const msg = view.querySelector("#msg");
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
        // Landa direkt på "Klasser & elever" (issue #304) i stället för den
        // borttagna översikts-hubben. Spärren visas ofta REDAN på
        // #/larare/klasser (#/larare → redirect → gate), så en bar go() skulle
        // sätta samma hash → ingen hashchange → routern kör inte → man fastnar
        // på inloggningsrutan. Tvinga därför en om-routning när hashen redan
        // matchar (routern lyssnar på window "hashchange", se app.js).
        const target = "#/larare/klasser";
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
}
