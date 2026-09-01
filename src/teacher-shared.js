// ============================================================================
// Pluggportalen – lärarsidan: delat (teacher-shared.js)
// ----------------------------------------------------------------------------
// Delade byggstenar för lärarsidans undersidor:
//   * Enkel lärarspärr (lösenord) så att elever inte råkar in. EJ säkerhets-
//     kritiskt – bara en tröskel. Sparas i sessionStorage.
//   * Små DOM-/text-hjälpare (el, esc, copyText).
//   * Gemensam lärar-toppnav (teacherNav).
//   * Lärarspärr-vy (renderGate) + översiktssidan (pageLarare).
//
// Sidorna anropas från app.js router med ett `ctx` som innehåller de delade
// hjälparna { app, go, renderTopbar }.
// ============================================================================

// --- Lärarspärr -------------------------------------------------------------
// Inte säkerhetskritiskt – bara så att elever inte klickar sig in av misstag.
export const TEACHER_PASSWORD = "larare2026";
export const TEACHER_KEY = "pluggportalen.teacher";

export function isTeacher() {
  try {
    return sessionStorage.getItem(TEACHER_KEY) === "1";
  } catch {
    return false;
  }
}
export function setTeacher(on) {
  try {
    if (on) sessionStorage.setItem(TEACHER_KEY, "1");
    else sessionStorage.removeItem(TEACHER_KEY);
  } catch {}
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
      <p class="hint center">Ange lärarlösenordet för att komma vidare. (Bara en spärr så att
        elever inte råkar in – inte säkerhetskritiskt.)</p>
      <div id="msg"></div>
      <form id="form">
        <div class="field">
          <label for="p">Lärarlösenord</label>
          <input id="p" type="password" autocomplete="off" placeholder="Lösenord" />
        </div>
        <button class="btn stor" type="submit">Lås upp</button>
      </form>
      <p class="hint center" style="margin-top:14px">Standardlösenord: <b>larare2026</b></p>
    </div>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => ctx.go("#/"));
  view.querySelector("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const pw = view.querySelector("#p").value;
    if (pw === TEACHER_PASSWORD) {
      setTeacher(true);
      pageLarare(ctx);
    } else {
      view.querySelector("#msg").innerHTML =
        `<div class="msg error">Fel lösenord. Försök igen.</div>`;
    }
  });
  ctx.app.replaceChildren(view);
}
