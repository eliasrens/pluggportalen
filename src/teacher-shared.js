// ============================================================================
// Pluggporten – lärarsidan: delat (teacher-shared.js)
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

// --- Linje-ikoner (lärar-chrome) --------------------------------------------
// Tunna inline-SVG-stroke-ikoner (currentColor, ~1.7px) som ersätter emojis i
// lärarsidans chrome (nav, knappar, sektionsrubriker) – issue #363. Ärver färg
// från texten, så samma ikon fungerar i både mörkt och ljust läge. Rita med
// icon("namn", storlek). Håll setet litet och delat så designspråket är enhetligt.
const ICONS = {
  users:
    '<path d="M16 19v-1.4a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 17.6V19"/><circle cx="10" cy="8" r="3.1"/><path d="M16.8 6.8a3.3 3.3 0 0 1 0 6.4"/><path d="M20 19v-1.3a3.3 3.3 0 0 0-2.4-3.2"/>',
  book:
    '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H6a2 2 0 0 0-2 2z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5a2 2 0 0 1 2 2z"/>',
  lock:
    '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15" r="1.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pencil: '<path d="M4 16.4V20h3.6L18.2 9.4l-3.6-3.6L4 16.4z"/><path d="M12.8 7.2l3.6 3.6"/>',
  grad:
    '<path d="M12 4 2.5 9 12 14l9.5-5L12 4z"/><path d="M6 11.2v4c0 1 2.7 2.3 6 2.3s6-1.3 6-2.3v-4"/><path d="M21.5 9v4.5"/>',
  pin:
    '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="12" cy="11" r="2.3"/>',
  sliders:
    '<path d="M4 8h8M16 8h4M4 16h4M12 16h8"/><circle cx="14" cy="8" r="2.2"/><circle cx="10" cy="16" r="2.2"/>',
  chart:
    '<path d="M4 4v16h16"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/>',
  trash:
    '<path d="M4 7h16"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6.2 7l.8 12.6A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.4L17.8 7"/><path d="M10 11v6M14 11v6"/>',
  school:
    '<path d="M3 21h18"/><path d="M5 21V9.5L12 5l7 4.5V21"/><path d="M9.5 21v-4.5h5V21"/>',
  inbox:
    '<path d="M4 13l2.1-7A2 2 0 0 1 8 4.5h8a2 2 0 0 1 1.9 1.5L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 13h5l1.1 2h3.8l1.1-2h5"/>',
  logout:
    '<path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="M18 15l3-3-3-3"/><path d="M21 12H9"/>',
  eye:
    '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  save:
    '<path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 4v5h7V4"/><path d="M8 14h8v6H8z"/>',
  copy:
    '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  printer:
    '<path d="M6 9V4h12v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 16h10v4H7z"/><circle cx="17" cy="12" r="0.8"/>',
  link:
    '<path d="M9.5 14.5 14.5 9.5"/><path d="M8 12H6.5a3.5 3.5 0 0 1 0-7H10"/><path d="M16 12h1.5a3.5 3.5 0 0 1 0 7H14"/>',
  shuffle:
    '<path d="M4 7h3l10 10h3"/><path d="M4 17h3L17 7h3"/><path d="M18 4l3 3-3 3"/><path d="M18 14l3 3-3 3"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5 10 17.5 19 6.5"/>',
  sparkle:
    '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M18.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  upload:
    '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
};

/**
 * Inline-SVG linje-ikon för lärar-chromet. currentColor + rund stroke.
 * @param {string} name  Nyckel i ICONS.
 * @param {number} size  Kant i px (default 18).
 */
export function icon(name, size = 18) {
  const path = ICONS[name] || "";
  return `<svg class="t-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export async function copyText(text, btn) {
  const done = () => {
    const old = btn.innerHTML;
    btn.textContent = "✓ Kopierat!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = old;
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
    // Översikts-hubben (pageLarare) är borttagen (issue #304): toppnaven gör
    // orienteringsjobbet, hubben dubblerade bara flikarna. Klassöversikten/
    // statistiken (gamla Klass-fliken) är sammanslagen som en expander per
    // klasskort (issue #299), så navet har EN klass-flik.
    // Emojis är utbytta mot tunna linje-ikoner i lärar-chromet (issue #363).
    { hash: "#/larare/klasser", key: "klasser", label: "Klasser & elever", icon: "users" },
    { hash: "#/larare/innehall", key: "innehall", label: "Innehåll", icon: "book" },
  ];
  const nav = el(`<nav class="teacher-nav" aria-label="Lärarnavigation">
    <div class="teacher-nav-inner">
      <span class="teacher-nav-brand" aria-hidden="true">
        <span class="teacher-nav-logo">${icon("school", 20)}</span>
        <span class="teacher-nav-wordmark">Lärarsida</span>
      </span>
      <span class="teacher-nav-tabs">
      ${tabs
        .map(
          (t) =>
            `<a class="tnav ${t.key === active ? "active" : ""}" data-hash="${t.hash}"${
              t.key === active ? ' aria-current="page"' : ""
            }><span class="tnav-ic">${icon(t.icon)}</span><span class="tnav-txt">${esc(
              t.label
            )}</span></a>`
        )
        .join("")}
      </span>
      <a class="tnav logout" data-logout="1" title="Logga ut"><span class="tnav-ic">${icon(
        "logout"
      )}</span><span class="tnav-txt">Logga ut</span></a>
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
export function teacherHead(_ctx, { emoji = "", title = "", icon: iconName = "" } = {}) {
  // Chromet är emoji-fritt (issue #363): föredra en linje-ikon. `emoji` behålls
  // i signaturen för bakåtkompatibilitet men ritas bara om ingen ikon anges.
  const mark = iconName
    ? `<span class="teacher-page-ic" aria-hidden="true">${icon(iconName, 22)}</span>`
    : emoji
    ? `${esc(emoji)} `
    : "";
  return el(`<header class="teacher-head-slim">
    <h1 class="teacher-page-title">${mark}<span>${esc(title)}</span></h1>
  </header>`);
}

/**
 * Vänligt tomtillstånd: ikon + rubrik + kort text + (valfri) knapp till nästa
 * steg. Används när det inte finns klasser/elever/innehåll ännu, i stället för
 * en tom yta. `text` får innehålla enkel markup.
 */
export function emptyState(
  ctx,
  { emoji = "", title = "", text = "", actionLabel = "", actionHash = "", icon: iconName = "inbox" } = {}
) {
  // Linje-ikon i chromet (issue #363); `emoji` kvar för bakåtkompatibilitet.
  const mark = iconName ? icon(iconName, 34) : esc(emoji);
  const box = el(`<div class="empty-state">
    <span class="empty-state-icon">${mark}</span>
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
