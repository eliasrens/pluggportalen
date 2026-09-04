// ============================================================================
// Pluggportalen – lärarsidan: delat (teacher-shared.js)
// ----------------------------------------------------------------------------
// Delade byggstenar för lärarsidans undersidor:
//   * Lärarinloggning via Firebase Auth (custom claim teacher:true). Ersätter
//     det gamla hårdkodade lösenordet. Logiken bor i src/auth.js.
//   * Små DOM-/text-hjälpare (el, esc, copyText).
//   * Gemensam lärar-toppnav (teacherNav).
//   * Lärarinloggnings-vy (renderGate) + översiktssidan (pageLarare).
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

/** Gemensam lärar-toppnav (flikar) för lärarsidans undersidor. */
export function teacherNav(ctx, active) {
  const tabs = [
    { hash: "#/larare", key: "hem", label: "🏠 Översikt" },
    { hash: "#/larare/klass", key: "klass", label: "📊 Klass" },
    // Klasshantering (#/larare/klasser) – additivt tillägg (håll separat för enkel rebase).
    { hash: "#/larare/klasser", key: "klasser", label: "🏫 Klasser" },
    { hash: "#/larare/innehall", key: "innehall", label: "📚 Innehåll" },
    { hash: "#/larare/prompter", key: "prompter", label: "🤖 AI-prompter" },
    { hash: "#/larare/elever", key: "elever", label: "🧑‍🎓 Elevkonton" },
  ];
  const nav = el(`<div class="teacher-nav">
    ${tabs
      .map(
        (t) =>
          `<a class="tnav ${t.key === active ? "active" : ""}" data-hash="${t.hash}">${t.label}</a>`
      )
      .join("")}
    <a class="tnav logout" data-logout="1">Lås lärarläge 🔒</a>
  </div>`);
  nav.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", () => ctx.go(a.dataset.hash))
  );
  nav.querySelector("[data-logout]").addEventListener("click", () => {
    setTeacher(false);
    ctx.go("#/");
  });
  return nav;
}

// ============================================================================
// Lärarspärr + översikt
// ============================================================================

export function pageLarare(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel">
      <h1>Lärarsida 👩‍🏫</h1>
      <p class="hint">Hantera kunskapsinnehåll, hämta AI-prompter och lägg in elevkonton.</p>
    </div>
    <div class="card-grid">
      <button class="big-card orange" data-hash="#/larare/klass">
        <span class="emoji">📊</span>
        <span class="title">Klassöversikt</span>
        <span class="sub">Se hur långt varje elev kommit</span>
      </button>
      <!-- Klasshantering (#/larare/klasser) – additivt tillägg (håll separat för enkel rebase). -->
      <button class="big-card rosa" data-hash="#/larare/klasser">
        <span class="emoji">🏫</span>
        <span class="title">Klasser</span>
        <span class="sub">Skapa klasser och lägg elever i dem</span>
      </button>
      <button class="big-card bla" data-hash="#/larare/innehall">
        <span class="emoji">📚</span>
        <span class="title">Innehåll</span>
        <span class="sub">Lägg in och hantera arbetsområden</span>
      </button>
      <button class="big-card lila" data-hash="#/larare/prompter">
        <span class="emoji">🤖</span>
        <span class="title">AI-prompter</span>
        <span class="sub">Färdiga prompter som skapar innehåll åt dig</span>
      </button>
      <button class="big-card gron" data-hash="#/larare/elever">
        <span class="emoji">🧑‍🎓</span>
        <span class="title">Elevkonton</span>
        <span class="sub">Lägg in en hel klass snabbt</span>
      </button>
    </div>
    <p class="hint" style="margin-top:18px">
      Vill du fylla databasen med färdig exempeldata? Använd
      <a href="./seed/seed.html">seed-sidan</a>.
    </p>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => ctx.go("#/"));
  view.querySelectorAll("[data-hash]").forEach((b) =>
    b.addEventListener("click", () => ctx.go(b.dataset.hash))
  );
  ctx.app.replaceChildren(view);
}

export function renderGate(ctx) {
  const view = el(`<div>
    <a class="back-link" id="back">← Tillbaka</a>
    <div class="panel">
      <h1 class="center">Lärarläge 🔐</h1>
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
        pageLarare(ctx);
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
