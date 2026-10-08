// ============================================================================
// Pluggporten – lärarsidan: "Redigera inloggning" för EN elev (teacher-login-edit.js)
// ----------------------------------------------------------------------------
// Dialog (samma .cx-modal-skal + .teacher-dark som elevdetaljerna) där läraren
// ser elevens användarnamn + sparade lösenord och kan byta båda. Bytet går via
// Cloud Functionen updateStudentLogin (data-student-login.js) – klienten kan
// inte ändra en annan användares Auth-konto. Gamla konton har inget sparat
// lösenord: då visas "Lösenord okänt – sätt nytt" med en knapp.
// Laddas dynamiskt från medlemshanteraren (teacher-class-accounts.js).
// ============================================================================

import { el, esc, icon } from "./teacher-shared.js";
import { avatarEmoji } from "./avatars.js";
import { generatePassword } from "./teacher-class-accounts.js";
import { USERNAME_RE } from "./teacher-login-cards.js";
import { MIN_PASSWORD_LEN } from "./auth.js";

const defaultApi = () => import("./data-student-login.js");

/**
 * Öppna dialogen.
 * @param {{id, namn, username, avatarId}} student  muteras (username) vid lyckat byte
 * @param {{onSaved?: Function, api?: object}} [opts] api = { updateStudentLogin,
 *   getStudentCredentials } (preview/test; default = data-student-login.js)
 */
export function openLoginEditor(student, { onSaved, api } = {}) {
  const name = student.namn || student.username || student.id;
  const overlay = el(`<div class="cx-modal-overlay teacher-dark le-modal" role="dialog" aria-modal="true"
      aria-label="Redigera inloggning – ${esc(name)}">
    <div class="cx-modal">
      <button class="cx-modal-close" aria-label="Stäng">✕</button>
      <div class="cx-modal-head">
        <span class="cx-modal-avatar">${avatarEmoji(student.avatarId)}</span>
        <div>
          <h2 class="cx-modal-name">Redigera inloggning</h2>
          <p class="cx-modal-sub">${esc(name)}</p>
        </div>
      </div>
      <div class="le-current">
        <div class="le-cur"><span class="le-lbl">Användarnamn</span><span class="le-val le-cur-user"></span></div>
        <div class="le-cur"><span class="le-lbl">Lösenord</span><span class="le-cur-pass"></span></div>
      </div>
      <form class="le-form" autocomplete="off">
        <label class="le-field"><span>Användarnamn</span>
          <input class="cell le-user" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="40" />
        </label>
        <label class="le-field"><span>Nytt lösenord</span>
          <span class="le-pass-row">
            <input class="cell le-pass" spellcheck="false" autocapitalize="off" autocomplete="new-password"
              maxlength="64" placeholder="Lämna tomt = behåll nuvarande" />
            <button type="button" class="btn ghost small le-gen">${icon("shuffle", 16)}<span>Generera enkelt lösenord</span></button>
          </span>
        </label>
        <p class="hint le-note">Byter du användarnamn loggar eleven in med det nya direkt – det gamla slutar fungera.</p>
        <div class="row-inline le-actions">
          <button type="submit" class="btn gron le-save">${icon("save", 16)}<span>Spara</span></button>
          <button type="button" class="btn ghost le-cancel">Stäng</button>
        </div>
        <div class="le-msg" aria-live="polite"></div>
      </form>
    </div>
  </div>`);

  const $ = (sel) => overlay.querySelector(sel);
  const userIn = $(".le-user");
  const passIn = $(".le-pass");
  const msg = $(".le-msg");
  const saveBtn = $(".le-save");
  let savedPassword = null;
  const apiP = api ? Promise.resolve(api) : defaultApi();

  function showCurrent(loading = false) {
    $(".le-cur-user").textContent = student.username || "–";
    userIn.value = student.username || "";
    const cur = $(".le-cur-pass");
    if (loading) {
      cur.innerHTML = `<span class="hint">Hämtar…</span>`;
      return;
    }
    if (savedPassword) {
      cur.innerHTML = `<span class="le-val">${esc(savedPassword)}</span>`;
      return;
    }
    cur.innerHTML = `<span class="le-unknown">Lösenord okänt – sätt nytt</span>
      <button type="button" class="btn small le-set-new">${icon("key", 16)}<span>Sätt nytt lösenord</span></button>`;
    cur.querySelector(".le-set-new").addEventListener("click", () => {
      passIn.value = generatePassword();
      passIn.focus();
      passIn.select();
    });
  }

  function setMsg(kind, html) {
    msg.innerHTML = kind ? `<div class="msg ${kind}">${html}</div>` : html;
  }

  apiP
    .then((m) => m.getStudentCredentials([student.id]))
    .then((map) => (savedPassword = map.get(student.id)?.password || null))
    .catch(() => (savedPassword = null))
    .finally(() => showCurrent());
  showCurrent(true);

  $(".le-gen").addEventListener("click", () => {
    passIn.value = generatePassword();
    passIn.focus();
  });

  $(".le-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = userIn.value.trim().toLowerCase();
    const password = passIn.value;
    const nameChanged = username !== String(student.username || "").toLowerCase();
    if (!nameChanged && !password) return setMsg("warn", "Inget att spara – ändra användarnamnet eller skriv ett nytt lösenord.");
    if (nameChanged && !USERNAME_RE.test(username))
      return setMsg("error", "Användarnamnet ska vara 3–40 tecken: a–z, 0–9, . _ -");
    if (password && password.length < MIN_PASSWORD_LEN)
      return setMsg("error", `Lösenordet måste vara minst ${MIN_PASSWORD_LEN} tecken.`);

    saveBtn.disabled = true;
    setMsg("", `<span class="hint">Sparar…</span>`);
    try {
      const m = await apiP;
      const res = await m.updateStudentLogin({
        uid: student.id,
        username: nameChanged ? username : undefined,
        password: password || undefined,
      });
      student.username = res.username;
      if (res.passwordChanged) savedPassword = password;
      passIn.value = "";
      showCurrent();
      setMsg(
        "ok",
        `✓ Sparat. Ny inloggning: <b>${esc(res.username)}</b>${
          savedPassword ? ` / <b>${esc(savedPassword)}</b>` : ""
        }`
      );
      if (onSaved) onSaved(res);
    } catch (err) {
      setMsg("error", esc(err?.message || "Kunde inte spara."));
    } finally {
      saveBtn.disabled = false;
    }
  });

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  $(".cx-modal-close").addEventListener("click", close);
  $(".le-cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  userIn.focus();
  return { close };
}
