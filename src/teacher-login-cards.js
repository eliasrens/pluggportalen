// ============================================================================
// Pluggportalen – lärarsidan: redigerbar kontoförhandsvisning + inloggningskort
// ----------------------------------------------------------------------------
// Utbruten hjälpmodul (håller teacher-class-accounts.js under fil-cap). Två delar:
//
//   1) renderAccountEditor – EN redigerbar tabell (namn/användarnamn/lösenord)
//      som visas EFTER att förslag genererats men FÖRE kontona skapas. Läraren
//      kan skriva egna värden ELLER klicka 🎲 (per rad / alla) för nya auto-
//      förslag. Validerar unika + lediga användarnamn (data.usernameTaken) och
//      lösenord ≥6 tecken innan kontona skapas.
//
//   2) printLoginCards – en utskriftsvänlig vy med ETT kort per elev (namn +
//      användarnamn + lösenord, INGEN avatar – eleverna har inte valt än). Ren
//      klient: overlay + @media print (se styles.css) + window.print().
//
// Lösenord i klartext går bara att visa JUST vid skapandet (Firebase lagrar bara
// hash), så både editorn och korten gäller den nyss skapade omgången.
// ============================================================================

import * as data from "./data.js";
import { el, esc } from "./teacher-shared.js";
import {
  buildAccountPlan,
  createAccountsFromEntries,
  nextUsername,
  generatePassword,
} from "./teacher-class-accounts.js";

// Giltigt användarnamn = e-postens lokala del (username@elev.pluggportalen.local).
const USERNAME_RE = /^[a-z0-9._-]{3,}$/;

/**
 * Rendera en redigerbar tabell för `count` nya elevkonton in i `host`. Fyller
 * raderna med auto-förslag (buildAccountPlan) som default. Läraren kan ändra
 * varje fält eller klicka 🎲 för nya förslag; vid "Skapa" valideras allt och
 * kontona skapas med de (ev. ändrade) värdena. Anropar sedan `onCreated(created)`.
 *
 * @param {HTMLElement} host  där tabellen renderas
 * @param {{count:number, prefix:string, className:string,
 *          taken:Set<string>, onCreated:Function, onCancel?:Function}} o
 *   taken = befintliga (upptagna) användarnamn i gemener.
 */
export function renderAccountEditor(host, { count, prefix, className, taken, onCreated, onCancel }) {
  // Baslinje av redan upptagna namn – förslag/validering utgår från denna.
  const baseTaken = new Set([...(taken || [])].map((u) => String(u).toLowerCase()));
  // Auto-förslag som default (mutar en kopia så baseTaken förblir "befintliga").
  const plan = buildAccountPlan({ count, prefix, taken: new Set(baseTaken) });

  const box = el(`<div class="acct-editor">
    <div class="acct-editor-head">
      <h3 class="subhead sm">📝 Kontrollera och ändra inloggningsuppgifter (${plan.length})</h3>
      <p class="hint">Uppgifterna är ifyllda med förslag – ändra fritt eller klicka
        🎲 för nya. När det ser bra ut skapar du kontona. Lösenorden går bara att
        se nu, så anteckna eller skriv ut dem efteråt.</p>
    </div>
    <div class="row-inline acct-editor-tools">
      <button type="button" class="btn ghost small ae-gen-all">🎲 Generera alla</button>
    </div>
    <div class="table-scroll"><table class="tbl acct-tbl">
      <thead><tr>
        <th>Namn</th><th>Användarnamn</th><th>Lösenord</th><th aria-label="Generera"></th>
      </tr></thead>
      <tbody></tbody>
    </table></div>
    <div class="row-inline acct-editor-actions">
      <button type="button" class="btn gron ae-create">✅ Skapa ${plan.length} konto${plan.length === 1 ? "" : "n"}</button>
      <button type="button" class="btn ghost ae-cancel">Avbryt</button>
      <span class="ae-flash" aria-live="polite"></span>
    </div>
  </div>`);

  const tbody = box.querySelector("tbody");
  const flash = box.querySelector(".ae-flash");
  const rows = [];

  function makeRow(entry) {
    const tr = el(`<tr class="ae-row">
      <td><input class="cell ae-namn" value="${esc(entry.namn)}" placeholder="Elevens namn" /></td>
      <td><input class="cell ae-user" value="${esc(entry.username)}" spellcheck="false" autocapitalize="off" /></td>
      <td><input class="cell ae-pass" value="${esc(entry.password)}" spellcheck="false" autocapitalize="off" /></td>
      <td><button type="button" class="btn ghost small ae-gen" title="Nytt förslag för raden">🎲</button></td>
    </tr>`);
    const errTr = el(`<tr class="ae-err-row" hidden><td colspan="4"><span class="ae-err"></span></td></tr>`);
    const r = {
      tr,
      errTr,
      namnInput: tr.querySelector(".ae-namn"),
      userInput: tr.querySelector(".ae-user"),
      passInput: tr.querySelector(".ae-pass"),
      errEl: errTr.querySelector(".ae-err"),
    };
    r.userInput.dataset.prev = entry.username;
    tr.querySelector(".ae-gen").addEventListener("click", () => regenRow(r));
    tbody.appendChild(tr);
    tbody.appendChild(errTr);
    rows.push(r);
  }

  // Upptagna namn just nu (baslinje + övriga raders värden), för kollisionsfria förslag.
  function takenExcept(exceptRow) {
    const t = new Set(baseTaken);
    rows.forEach((r) => {
      if (r === exceptRow) return;
      const u = r.userInput.value.trim().toLowerCase();
      if (u) t.add(u);
    });
    return t;
  }

  function regenRow(r) {
    const t = takenExcept(r);
    const u = nextUsername(prefix, t);
    // Har läraren inte rört namnet (= förra användarnamnet) följer namnet med.
    if (r.namnInput.value.trim() === (r.userInput.dataset.prev || "")) r.namnInput.value = u;
    r.userInput.value = u;
    r.userInput.dataset.prev = u;
    r.passInput.value = generatePassword();
    clearErr(r);
  }

  function clearErr(r) {
    r.errTr.hidden = true;
    r.errEl.textContent = "";
    r.tr.classList.remove("ae-invalid");
  }

  function setErr(r, msg) {
    r.errEl.textContent = msg;
    r.errTr.hidden = false;
    r.tr.classList.add("ae-invalid");
  }

  plan.forEach(makeRow);

  box.querySelector(".ae-gen-all").addEventListener("click", () => {
    const t = new Set(baseTaken);
    rows.forEach((r) => {
      const u = nextUsername(prefix, t);
      if (r.namnInput.value.trim() === (r.userInput.dataset.prev || "")) r.namnInput.value = u;
      r.userInput.value = u;
      r.userInput.dataset.prev = u;
      r.passInput.value = generatePassword();
      clearErr(r);
    });
  });

  const cancelBtn = box.querySelector(".ae-cancel");
  cancelBtn.addEventListener("click", () => {
    if (onCancel) onCancel();
    else host.replaceChildren();
  });

  // Validera alla rader: format, dubbletter i listan, lösenordslängd, samt
  // data.usernameTaken (asynkront) för de rader som passerar synk-kollen.
  async function validate() {
    let ok = true;
    const seen = new Map(); // username -> row (första förekomsten)
    rows.forEach((r) => {
      clearErr(r);
      const u = r.userInput.value.trim().toLowerCase();
      const p = r.passInput.value;
      if (!USERNAME_RE.test(u)) {
        setErr(r, "Användarnamn: minst 3 tecken, endast a–z, 0–9, . _ -");
        ok = false;
        return;
      }
      if (seen.has(u)) {
        setErr(r, `Användarnamnet "${u}" är en dubblett i listan.`);
        ok = false;
        return;
      }
      seen.set(u, r);
      if (String(p || "").length < 6) {
        setErr(r, "Lösenordet måste vara minst 6 tecken.");
        ok = false;
      }
    });
    if (!ok) return false;

    const checks = await Promise.all(
      [...seen.keys()].map((u) =>
        data.usernameTaken(u).then((t) => [u, t]).catch(() => [u, false])
      )
    );
    let free = true;
    checks.forEach(([u, t]) => {
      if (t) {
        setErr(seen.get(u), `Användarnamnet "${u}" är redan taget – välj ett annat.`);
        free = false;
      }
    });
    return free;
  }

  const createBtn = box.querySelector(".ae-create");
  createBtn.addEventListener("click", async () => {
    createBtn.disabled = true;
    cancelBtn.disabled = true;
    flash.innerHTML = `<span class="hint">Kontrollerar uppgifter…</span>`;
    let valid = false;
    try {
      valid = await validate();
    } catch (err) {
      flash.innerHTML = `<span class="gc-err">Kunde inte kontrollera: ${esc(err.message)}</span>`;
    }
    if (!valid) {
      if (!flash.querySelector(".gc-err"))
        flash.innerHTML = `<span class="gc-err">Åtgärda de markerade raderna först.</span>`;
      createBtn.disabled = false;
      cancelBtn.disabled = false;
      return;
    }

    const entries = rows.map((r) => {
      const username = r.userInput.value.trim().toLowerCase();
      return { username, password: r.passInput.value, namn: r.namnInput.value.trim() || username };
    });

    let created = [];
    try {
      created = await createAccountsFromEntries(entries, (done, total) => {
        flash.innerHTML = `<span class="hint">Skapar konton… ${done}/${total}</span>`;
      });
    } catch (err) {
      created = err.created || [];
      flash.innerHTML = `<span class="gc-err">Ett fel uppstod: ${esc(err.message)}${
        created.length ? ` (${created.length} konton hann skapas)` : ""
      }</span>`;
      if (created.length) await onCreated(created);
      return;
    }

    await onCreated(created);
  });

  host.replaceChildren(box);
  return box;
}

/**
 * Öppna en utskriftsvänlig overlay med ETT inloggningskort per elev (namn +
 * användarnamn + lösenord, ingen avatar). @media print döljer app-chrome och
 * ger page-break-inside: avoid per kort. Ren klient, ingen backend.
 */
export function printLoginCards(className, created) {
  const cards = created
    .map(
      (c) => `<div class="login-card">
        <div class="lc-app">📚 Pluggportalen</div>
        <div class="lc-name">${esc(c.namn || c.username)}</div>
        <div class="lc-field"><span class="lc-label">Användarnamn</span>
          <span class="lc-value">${esc(c.username)}</span></div>
        <div class="lc-field"><span class="lc-label">Lösenord</span>
          <span class="lc-value">${esc(c.password)}</span></div>
        <div class="lc-class">Klass: ${esc(className)}</div>
      </div>`
    )
    .join("");

  const overlay = el(`<div class="login-cards-overlay" role="dialog" aria-label="Inloggningskort">
    <div class="lc-toolbar">
      <h2 class="lc-title">🖨️ Inloggningskort – ${esc(className)} (${created.length})</h2>
      <div class="row-inline">
        <button type="button" class="btn gron small lc-print">🖨️ Skriv ut</button>
        <button type="button" class="btn ghost small lc-close">✖ Stäng</button>
      </div>
    </div>
    <p class="lc-hint">Ett kort per elev – skriv ut och klipp isär längs de streckade kanterna.
      Lösenorden visas bara här (går inte att se igen efteråt).</p>
    <div class="login-cards-grid">${cards}</div>
  </div>`);

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }

  overlay.querySelector(".lc-print").addEventListener("click", () => window.print());
  overlay.querySelector(".lc-close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  overlay.scrollTop = 0;
}
