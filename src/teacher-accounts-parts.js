// ============================================================================
// Pluggporten – Lärarkonton: delade delar (teacher-accounts-parts.js, #677)
// ----------------------------------------------------------------------------
// Används av adminsidan (teacher-accounts.js) och hantera-panelen
// (teacher-accounts-manage.js). Bara dynamiskt laddad (#271).
//   classPicker(classes, valda, { hint })  kryssrutor + "Välj klasser som börjar på N"
//   passwordField(id)                       lösenord + "Skapa ett lösenord åt mig"
//   generatePassword()                      t.ex. "tiger-panda-482"
//   suggestUsername("Årskurs 4")            "arskurs4"
//   ensureAccountsCss()                     teacher-accounts.css (en gång)
// ============================================================================

import { el, esc, icon } from "./teacher-shared.js";

export const ROLE_LABEL = { admin: "Admin", arskurs: "Årskurskonto" };
export const MIN_PASSWORD_LEN = 6;

export function ensureAccountsCss() {
  if (document.querySelector('link[data-ta-css="1"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./teacher-accounts.css", import.meta.url).href;
  link.dataset.taCss = "1";
  document.head.appendChild(link);
}

// Lätta att läsa upp och skriva (ren ASCII). Två ord + tre siffror ≈ 2^20 varianter
// – kontot skyddas dessutom av Firebase Auths spärr mot många felförsök.
const WORDS = [
  "tiger", "panda", "delfin", "raket", "pingvin", "ekorre", "kanin", "zebra", "elefant",
  "skoter", "banan", "apelsin", "kompass", "fyrtorn", "vulkan", "komet", "segel", "lykta",
  "papegoja", "kameleont", "bastu", "galax", "mammut", "pirat", "glaciar", "drake",
];
const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

/** Ett lösenord åt läraren, t.ex. "tiger-panda-482" (alltid ≥ 12 tecken). */
export function generatePassword() {
  return `${WORDS[rnd(WORDS.length)]}-${WORDS[rnd(WORDS.length)]}-${100 + rnd(900)}`;
}

/** Förslag på användarnamn ur visningsnamnet: "Årskurs 4" → "arskurs4". */
export function suggestUsername(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/é/g, "e")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}

/** Första siffran i en text ("Årskurs 4" → "4"), annars "". */
export const gradeDigit = (s) => (String(s || "").match(/\d/) || [""])[0];

/** Sortering på klassnamn med siffror i rätt ordning (4A, 4B, 5A, 10A). */
export const byClassName = (a, b) =>
  String(a.name || a.id).localeCompare(String(b.name || b.id), "sv", { numeric: true });

/** Klassnamn för id:n ("4A, 4B"), okända id:n som de är. */
export function classNames(ids, classes) {
  const names = new Map(classes.map((k) => [k.id, k.name || k.id]));
  return (ids || []).map((id) => names.get(id) || id).sort((a, b) => a.localeCompare(b, "sv", { numeric: true }));
}

/**
 * Kryssrutor för alla klasser + snabbknappar. `digitFrom()` ger texten som
 * avgör siffran i "Välj klasser som börjar på N" (visningsnamnet i formuläret).
 * @returns {{ node: HTMLElement, selected: () => string[], refresh: () => void }}
 */
export function classPicker(classes, valda = [], { digitFrom = () => "" } = {}) {
  const set = new Set(valda);
  const sorted = [...classes].sort(byClassName);
  const node = el(`<fieldset class="ta-klasser">
    <legend>Klasser kontot får arbeta med</legend>
    ${sorted.length ? `<div class="ta-klass-lista">${sorted.map((k) => `
      <label class="ta-klass">
        <input type="checkbox" value="${esc(k.id)}"${set.has(k.id) ? " checked" : ""} />
        <span>${esc(k.name || k.id)}</span>
      </label>`).join("")}</div>
      <div class="row-inline ta-klass-snabb">
        <button type="button" class="btn ghost small" data-siffra="1"></button>
        <button type="button" class="btn ghost small" data-inga="1">Avmarkera alla</button>
      </div>` : `<p class="hint">Det finns inga klasser än – skapa dem under Klasser &amp; elever.</p>`}
  </fieldset>`);
  const boxes = () => [...node.querySelectorAll(".ta-klass input")];
  const siffraBtn = node.querySelector("[data-siffra]");
  const digits = [...new Set(sorted.map((k) => gradeDigit(k.name || k.id)).filter(Boolean))];
  const currentDigit = () => {
    const d = gradeDigit(digitFrom());
    return digits.includes(d) ? d : digits[0] || "";
  };
  const refresh = () => {
    if (!siffraBtn) return;
    const d = currentDigit();
    siffraBtn.hidden = !d;
    siffraBtn.innerHTML = `${icon("check", 15)}<span>Välj klasser som börjar på ${esc(d)}</span>`;
  };
  siffraBtn?.addEventListener("click", () => {
    const d = currentDigit();
    // Lägger till klasserna (tar inte bort redan valda andra klasser).
    sorted.forEach((k, i) => {
      if (String(k.name || k.id).trim().startsWith(d)) boxes()[i].checked = true;
    });
  });
  node.querySelector("[data-inga]")?.addEventListener("click", () => boxes().forEach((b) => (b.checked = false)));
  refresh();
  return { node, selected: () => boxes().filter((b) => b.checked).map((b) => b.value), refresh };
}

/** Lösenordsfält (synligt, så admin kan skriva upp det) + "Skapa ett lösenord åt mig". */
export function passwordField(id, label = "Lösenord") {
  const node = el(`<div class="field ta-losen">
    <label for="${id}">${esc(label)} <small>(minst ${MIN_PASSWORD_LEN} tecken)</small></label>
    <div class="row-inline ta-losen-rad">
      <input id="${id}" type="text" autocomplete="new-password" spellcheck="false" maxlength="64" />
      <button type="button" class="btn ghost small" data-skapa="1">${icon("sparkle", 15)}<span>Skapa ett lösenord åt mig</span></button>
    </div>
  </div>`);
  const input = node.querySelector("input");
  node.querySelector("[data-skapa]").addEventListener("click", () => {
    input.value = generatePassword();
    input.focus();
    input.select();
  });
  return { node, value: () => input.value, input };
}

/** Status-/rollbricka. */
export const chip = (kind, text) => `<span class="ta-chip ta-chip-${kind}">${esc(text)}</span>`;
export const roleChip = (role) => chip(role === "admin" ? "admin" : "arskurs", ROLE_LABEL[role] || role);
export const activeChip = (a) => (a === false ? chip("av", "Avstängt") : chip("aktiv", "Aktivt"));
