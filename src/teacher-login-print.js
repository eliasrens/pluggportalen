// ============================================================================
// Pluggporten – lärarsidan: inloggningskort för utskrift (teacher-login-print.js)
// ----------------------------------------------------------------------------
//   openPrintPicker(className, members) – välj hela klassen eller vissa elever;
//       sparade lösenord hämtas ur studentCredentials (bara lärare läser).
//   printLoginCards(className, entries) – utskriftsvänlig A4-vy: 2 × 4 kort per
//       sida med streckade klipplinjer, Pluggporten-loggan, elevens namn,
//       användarnamn, lösenord (tom rad "____" om okänt) och pluggporten.se.
//       Ren klient: overlay + @media print (styles.css) + window.print().
// Laddas dynamiskt från medlemshanteraren; printLoginCards re-exporteras även
// från teacher-login-cards.js (lösenords-panelen efter kontoskapande).
// ============================================================================

import { el, esc, icon } from "./teacher-shared.js";
import { avatarEmoji } from "./avatars.js";

/** Adressen eleverna ska gå till (står stort på varje kort). */
export const LOGIN_SITE = "pluggporten.se";

// Loggan = mini av majestätiska porten (samma motiv som index.html/faviconen).
const PORT_LOGO = `<svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
  <path d="M1 24 Q32 -6 63 24 L53 24 Q32 6 11 24 Z" fill="#A9C2DE" stroke="#3B3350" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="32" cy="9" r="5" fill="#F7C948" stroke="#3B3350" stroke-width="2.5"/>
  <rect x="1" y="19" width="16" height="9" rx="3.5" fill="#DCE7F2" stroke="#3B3350" stroke-width="3"/>
  <rect x="47" y="19" width="16" height="9" rx="3.5" fill="#DCE7F2" stroke="#3B3350" stroke-width="3"/>
  <rect x="3" y="26" width="12" height="34" rx="4" fill="#A9C2DE" stroke="#3B3350" stroke-width="3"/>
  <rect x="49" y="26" width="12" height="34" rx="4" fill="#A9C2DE" stroke="#3B3350" stroke-width="3"/>
  <path d="M23 40 L23 58M32 34 L32 58M41 40 L41 58" stroke="#46557A" stroke-width="5" stroke-linecap="round"/>
  <path d="M23 31 L27.5 36 L23 41 L18.5 36 Z M32 25 L36.5 30 L32 35 L27.5 30 Z M41 31 L45.5 36 L41 41 L36.5 36 Z" fill="#F7C948" stroke="#3B3350" stroke-width="2"/>
  <rect x="16" y="46" width="32" height="6" rx="3" fill="#5A6C96" stroke="#3B3350" stroke-width="2.5"/>
</svg>`;

/** Ett kort. `password` null/tomt → tom skrivrad. */
function cardHtml(className, c) {
  const pass = c.password
    ? `<span class="lc-value">${esc(c.password)}</span>`
    : `<span class="lc-value lc-blank" aria-label="Lösenord okänt – fyll i">&nbsp;</span>`;
  return `<div class="login-card">
    <div class="lc-head"><span class="lc-logo">${PORT_LOGO}</span><span class="lc-app">Pluggporten</span>
      ${className ? `<span class="lc-class">${esc(className)}</span>` : ""}</div>
    <div class="lc-name">${esc(c.namn || c.username)}</div>
    <div class="lc-field"><span class="lc-label">Användarnamn</span><span class="lc-value">${esc(c.username)}</span></div>
    <div class="lc-field"><span class="lc-label">Lösenord</span>${pass}</div>
    <div class="lc-url">Logga in på <b>${LOGIN_SITE}</b></div>
  </div>`;
}

/**
 * Öppna utskriftsvyn med ETT inloggningskort per elev.
 * @param {string} className
 * @param {Array<{namn?:string, username:string, password?:string|null}>} entries
 */
export function printLoginCards(className, entries) {
  const unknown = entries.filter((c) => !c.password).length;
  const overlay = el(`<div class="login-cards-overlay teacher-dark" role="dialog" aria-label="Inloggningskort">
    <div class="lc-toolbar">
      <h2 class="lc-title">${icon("printer", 20)}<span>Inloggningskort – ${esc(className)} (${entries.length})</span></h2>
      <div class="row-inline">
        <button type="button" class="btn gron small lc-print">${icon("printer", 16)}<span>Skriv ut</span></button>
        <button type="button" class="btn ghost small lc-close">${icon("x", 16)}<span>Stäng</span></button>
      </div>
    </div>
    <p class="lc-hint">A4, åtta kort per sida – klipp längs de streckade linjerna.${
      unknown ? ` ${unknown} elev${unknown === 1 ? "" : "er"} saknar sparat lösenord: där blir lösenordsraden tom att fylla i för hand.` : ""
    }</p>
    <div class="login-cards-grid">${entries.map((c) => cardHtml(className, c)).join("")}</div>
  </div>`);

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  overlay.querySelector(".lc-print").addEventListener("click", () => window.print());
  overlay.querySelector(".lc-close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  overlay.scrollTop = 0;
  return { close };
}

/**
 * Välj vilka elever som ska få kort (alla förvalda) och skriv ut.
 * @param {string} className
 * @param {Array<{id, namn, username, avatarId}>} members
 * @param {{loadCredentials?: (ids:string[]) => Promise<Map>}} [opts] (test/preview)
 */
export function openPrintPicker(className, members, opts = {}) {
  const rows = members
    .map(
      (s) => `<label class="lp-row">
        <input type="checkbox" value="${esc(s.id)}" checked />
        <span class="lp-avatar">${avatarEmoji(s.avatarId)}</span>
        <span class="lp-name">${esc(s.namn || s.username || s.id)}</span>
        <span class="lp-user">${esc(s.username || "")}</span>
        <span class="lp-state" data-state="loading">…</span>
      </label>`
    )
    .join("");
  const overlay = el(`<div class="cx-modal-overlay teacher-dark lp-modal" role="dialog" aria-modal="true"
      aria-label="Skriv ut inloggningskort – ${esc(className)}">
    <div class="cx-modal">
      <button class="cx-modal-close" aria-label="Stäng">✕</button>
      <div class="cx-modal-head">
        <span class="cx-modal-avatar">${icon("printer", 34)}</span>
        <div>
          <h2 class="cx-modal-name">Skriv ut inloggningskort</h2>
          <p class="cx-modal-sub">${esc(className)} · ${LOGIN_SITE}</p>
        </div>
      </div>
      <p class="hint">Välj hela klassen eller bara vissa elever. Elever utan sparat lösenord får en tom
        rad att fylla i (sätt ett nytt lösenord under <b>Inloggning</b> så hamnar det på kortet).</p>
      <div class="row-inline lp-tools">
        <button type="button" class="btn ghost small lp-all">${icon("check", 16)}<span>Markera alla</span></button>
        <button type="button" class="btn ghost small lp-none">${icon("minus", 16)}<span>Avmarkera alla</span></button>
      </div>
      <div class="lp-list">${rows || `<p class="hint">Inga elever i klassen.</p>`}</div>
      <div class="row-inline lp-actions">
        <button type="button" class="btn gron lp-go" disabled>${icon("printer", 16)}<span>Hämtar lösenord…</span></button>
        <span class="lp-msg" aria-live="polite"></span>
      </div>
    </div>
  </div>`);

  const boxes = [...overlay.querySelectorAll('.lp-row input[type="checkbox"]')];
  const goBtn = overlay.querySelector(".lp-go");
  let creds = null;
  const refresh = () => {
    const n = boxes.filter((b) => b.checked).length;
    if (creds) goBtn.lastElementChild.textContent = `Skriv ut ${n} kort`;
    goBtn.disabled = !creds || n === 0;
  };
  boxes.forEach((b) => b.addEventListener("change", refresh));
  overlay.querySelector(".lp-all").addEventListener("click", () => (boxes.forEach((b) => (b.checked = true)), refresh()));
  overlay.querySelector(".lp-none").addEventListener("click", () => (boxes.forEach((b) => (b.checked = false)), refresh()));

  const load =
    opts.loadCredentials ||
    ((ids) => import("./data-student-login.js").then((m) => m.getStudentCredentials(ids)));
  load(members.map((s) => s.id))
    .catch(() => new Map())
    .then((map) => {
      creds = map;
      overlay.querySelectorAll(".lp-row").forEach((row) => {
        const known = !!creds.get(row.querySelector("input").value)?.password;
        const st = row.querySelector(".lp-state");
        st.dataset.state = known ? "known" : "unknown";
        st.textContent = known ? "🔑 lösenord sparat" : "lösenord okänt";
      });
      refresh();
    });

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  goBtn.addEventListener("click", () => {
    const picked = new Set(boxes.filter((b) => b.checked).map((b) => b.value));
    const entries = members
      .filter((s) => picked.has(s.id))
      .map((s) => ({ namn: s.namn, username: s.username, password: creds.get(s.id)?.password || null }));
    close();
    printLoginCards(className, entries);
  });
  overlay.querySelector(".cx-modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  return { close };
}
