// ============================================================================
// Pluggportalen – lärarsidan: delat (teacher-shared.js)
// ----------------------------------------------------------------------------
// Delade byggstenar för lärarsidans undersidor:
//   * Enkel lärarspärr (lösenord) så att elever inte råkar in. EJ säkerhets-
//     kritiskt – bara en tröskel. Sparas i sessionStorage.
//   * Små DOM-/text-hjälpare (el, esc, copyText, wireHashLinks).
//   * Gemensam lärar-toppnav (teacherNav) – sticky flikrad.
//   * Enhetligt sidhuvud (teacherHead) och vänliga tomtillstånd (emptyState)
//     så alla undersidor känns som en familj.
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
    { hash: "#/larare", key: "hem", label: "🏠 Översikt" },
    { hash: "#/larare/klass", key: "klass", label: "📊 Klass" },
    // Klasshantering (#/larare/klasser) – additivt tillägg (håll separat för enkel rebase).
    { hash: "#/larare/klasser", key: "klasser", label: "🏫 Klasser" },
    { hash: "#/larare/innehall", key: "innehall", label: "📚 Innehåll" },
    { hash: "#/larare/prompter", key: "prompter", label: "🤖 AI-prompter" },
    { hash: "#/larare/elever", key: "elever", label: "🧑‍🎓 Elevkonton" },
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
 * Enhetligt sidhuvud för en lärar-undersida: en brödsmula tillbaka till
 * översikten, en ikon, rubrik och en kort ingress. `lead` får innehålla enkel
 * markup (t.ex. <b> och `data-hash`-länkar) – dessa kopplas till routern.
 */
export function teacherHead(ctx, { emoji = "📋", title = "", lead = "" } = {}) {
  const head = el(`<header class="panel teacher-head">
    <a class="crumb" data-hash="#/larare">← Till översikten</a>
    <div class="teacher-head-row">
      <span class="teacher-head-icon">${esc(emoji)}</span>
      <div class="teacher-head-text">
        <h1>${esc(title)}</h1>
        ${lead ? `<p class="teacher-head-lead">${lead}</p>` : ""}
      </div>
    </div>
  </header>`);
  wireHashLinks(ctx, head);
  return head;
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
// Lärarspärr + översikt
// ============================================================================

export function pageLarare(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  // Genvägar (big-cards). Ordningen speglar en naturlig arbetsgång:
  // följ upp klassen → bygg upp klasser/elever → fyll på innehåll/prompter.
  const cards = [
    {
      hash: "#/larare/klass",
      color: "orange",
      emoji: "📊",
      title: "Klassöversikt",
      sub: "Se hur långt varje elev kommit",
    },
    {
      // Klasshantering (#/larare/klasser) – additivt tillägg (håll separat för enkel rebase).
      hash: "#/larare/klasser",
      color: "rosa",
      emoji: "🏫",
      title: "Klasser",
      sub: "Skapa klasser och lägg elever i dem",
    },
    {
      hash: "#/larare/elever",
      color: "gron",
      emoji: "🧑‍🎓",
      title: "Elevkonton",
      sub: "Lägg in en hel klass snabbt",
    },
    {
      hash: "#/larare/innehall",
      color: "bla",
      emoji: "📚",
      title: "Innehåll",
      sub: "Lägg in och hantera arbetsområden",
    },
    {
      hash: "#/larare/prompter",
      color: "lila",
      emoji: "🤖",
      title: "AI-prompter",
      sub: "Färdiga prompter som skapar innehåll åt dig",
    },
  ];

  const view = el(`<div class="teacher-page">
    <a class="back-link" id="back">← Till startsidan</a>
    <header class="panel teacher-hero">
      <span class="teacher-hero-icon">👩‍🏫</span>
      <div class="teacher-hero-text">
        <h1>Lärarsida</h1>
        <p class="teacher-hero-lead">Välkommen! Här bygger du upp klasser och innehåll,
          hämtar AI-prompter och följer hur eleverna kommer framåt.</p>
      </div>
    </header>
    <div class="card-grid teacher-cards">
      ${cards
        .map(
          (c) => `<button class="big-card ${c.color}" data-hash="${c.hash}">
            <span class="emoji">${c.emoji}</span>
            <span class="title">${esc(c.title)}</span>
            <span class="sub">${esc(c.sub)}</span>
          </button>`
        )
        .join("")}
    </div>
    <p class="hint teacher-seed-hint">
      💾 Vill du fylla databasen med färdig exempeldata? Använd
      <a href="./seed/seed.html">seed-sidan</a>.
    </p>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => ctx.go("#/"));
  wireHashLinks(ctx, view);
  ctx.app.replaceChildren(view);
}

export function renderGate(ctx) {
  const view = el(`<div class="teacher-page">
    <a class="back-link" id="back">← Tillbaka</a>
    <div class="panel gate-panel center">
      <span class="gate-icon">🔐</span>
      <h1 class="center">Lärarläge</h1>
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
