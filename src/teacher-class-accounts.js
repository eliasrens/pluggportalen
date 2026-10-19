// ============================================================================
// Pluggporten – lärarsidan: elevkonton PER KLASS (teacher-class-accounts.js)
// ----------------------------------------------------------------------------
// Utbruten hjälpmodul till teacher-classes.js (håller huvudfilen under fil-cap).
// Klass-centrerat kontoskapande: läraren anger ett ANTAL elever och får N konton
// på en gång – auto-genererade användarnamn (klassprefix + löpnummer, unika) och
// enkla utdelbara lösenord (≥6 tecken). Kontona skapas via data.upsertStudent
// (som i sin tur kör createStudentAuthAccount mot en sekundär Firebase-app, så
// lärarens egen session inte kastas ut) och kopplas till klassen.
//
// Här bor även byggstenarna som förr var "medlemshanteraren" under en klass
// (namn/avatar, ge mynt, skapa nya konton, lägg till befintliga elever). Sedan
// #805 (epic #802 §3.4) använder den kompakta elevtabellen dem
// (teacher-elever-tabell.js + teacher-elever-atgarder.js).
// ============================================================================

import * as data from "./data.js";
import { AVATARS, avatarEmoji, isBuyableAvatar } from "./avatars.js";
import { el, errText, esc, icon } from "./teacher-shared.js";
import { coinIcon } from "./icons.js";
import { renderAccountEditor, credentialsPanel } from "./teacher-login-cards.js";
import { fordelaMynt } from "./teacher-elever-val.js";
// credentialsPanel bor i teacher-login-cards.js (fil-cap, #440) – exportnamnet
// behålls här för befintliga importörer (preview/preview-larare.html).
export { credentialsPanel };

// --- Genererade inloggningsuppgifter ----------------------------------------

// Enkla, utdelbara lösenordsord (ren ASCII, ≥3 tecken → ord+3 siffror ger ≥6,
// vilket är Firebase-kravet). Lätta att läsa upp i klassrummet.
const WORDS = [
  "sol", "katt", "hund", "boll", "fisk", "stjarna", "banan", "apelsin",
  "tiger", "delfin", "panda", "robot", "raket", "pingvin", "draken",
  "ekorre", "kanin", "zebra", "elefant", "skoter",
];

/** Ett enkelt lösenord: ord + tre siffror (t.ex. "katt482"). Alltid ≥6 tecken. */
export function generatePassword() {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  return w + String(Math.floor(Math.random() * 900) + 100); // 100–999
}

/** Rensa ett klassnamn till användarnamnsprefix (a–z,0–9), t.ex. "6A" → "6a". */
export function usernamePrefix(className) {
  return String(className || "").toLowerCase().replace(/[^a-z0-9]/g, "") || "elev";
}

/** Nästa lediga användarnamn `${prefix}NN` som inte finns i `taken` (uppdaterar `taken`). */
export function nextUsername(prefix, taken) {
  let n = 1;
  let u;
  do {
    u = `${prefix}${n < 10 ? "0" + n : n}`;
    n++;
  } while (taken.has(u));
  taken.add(u);
  return u;
}

/**
 * Bygg `count` auto-förslag { namn, username, password } utan att skapa något.
 * Används som default-värden i den redigerbara kontotabellen (läraren kan ändra
 * dem innan kontona faktiskt skapas). Muterar `taken` med de valda namnen.
 * @param {{count:number, prefix:string, taken:Set<string>}} o
 */
export function buildAccountPlan({ count, prefix, taken }) {
  const plan = [];
  for (let i = 0; i < count; i++) {
    const username = nextUsername(prefix, taken);
    plan.push({ namn: username, username, password: generatePassword() });
  }
  return plan;
}

/**
 * Skapa elevkonton från färdiga (ev. lärar-redigerade) rader. Varje rad skapar
 * Auth-kontot + students-dokumentet via data.upsertStudent(null, …) och läggs
 * till i `created` som { id, namn, username, password } (lösenordet i klartext;
 * det sparas även i studentCredentials för läraren). Kastar vid fel, men bifogar `err.created`
 * med de rader som hann skapas så anroparen inte tappar dem.
 * @param {Array<{namn:string, username:string, password:string}>} entries
 * @param {Function=} onProgress (done, total)
 */
export async function createAccountsFromEntries(entries, onProgress) {
  const created = [];
  for (let i = 0; i < entries.length; i++) {
    const { namn, username, password } = entries[i];
    try {
      const id = await data.upsertStudent(null, { namn, username, password, avatarId: "fox" });
      created.push({ id, namn, username, password });
    } catch (err) {
      err.created = created;
      throw err;
    }
    if (onProgress) onProgress(i + 1, entries.length);
  }
  return created;
}

// --- Byggstenar för elevtabellen (Mina klasser → Elever, #805) --------------
// Flyttade oförändrade ur förra medlemshanteraren (renderMemberManager, #440):
// ge mynt, namn/avatar, skapa nya konton och lägg till befintliga elever.
// Tabellen själv bor i teacher-elever-tabell.js / teacher-elever-atgarder.js.

/** Ge mynt-rutan (antal, +10, +50, Ge). Kopplas med wireGiveCoins. */
export const giveCoinsHtml = () => `<div class="give-coins">
  <div class="gc-row">
    <input class="cell gc-amount" type="number" min="1" step="1" value="10" aria-label="Antal mynt" />
    <button type="button" class="btn ghost small gc-quick" data-add="10">+10</button>
    <button type="button" class="btn ghost small gc-quick" data-add="50">+50</button>
    <button type="button" class="btn gron small gc-give">Ge ${coinIcon("1em")}</button>
  </div>
  <div class="gc-flash" aria-live="polite"></div>
</div>`;

/** Koppla Ge mynt-rutan i `row` för en elev. onGiven(nyttSaldo) efter lyckad gåva. */
export function wireGiveCoins(row, student, onGiven) {
  const amountEl = row.querySelector(".gc-amount");
  const giveBtn = row.querySelector(".gc-give");
  const flashEl = row.querySelector(".gc-flash");

  row.querySelectorAll(".gc-quick").forEach((b) =>
    b.addEventListener("click", () => {
      amountEl.value = b.dataset.add;
      amountEl.focus();
    })
  );
  giveBtn.addEventListener("click", async () => {
    // Samma gräns som Ge hela klassen mynt (#805 F3): heltal 1–1000.
    const { antal: amount, fel } = fordelaMynt(amountEl.value);
    if (fel) {
      flashEl.innerHTML = `<span class="gc-err">${esc(fel)}</span>`;
      amountEl.focus();
      return;
    }
    giveBtn.disabled = true;
    flashEl.innerHTML = `<span class="hint">Ger mynt…</span>`;
    try {
      await data.addCoins(amount, student.id);
      const nytt = await data.getCoins(student.id);
      const namn = student.namn || student.username || "eleven";
      flashEl.innerHTML = `<span class="gc-ok">✓ ${esc(namn)} fick ${amount} ${coinIcon("1em")} – nytt saldo: ${nytt} ${coinIcon("1em")}</span>`;
      if (onGiven) onGiven(nytt);
    } catch (err) {
      flashEl.innerHTML = `<span class="gc-err">Kunde inte ge mynt: ${esc(errText(err))}</span>`;
    } finally {
      giveBtn.disabled = false;
    }
  });
}

export function avatarSelectHtml(sel) {
  // En köpt avatar (#694) står inte i AVATARS – visa den så "Spara" inte byter bort den.
  const val = isBuyableAvatar(sel) ? [[sel, avatarEmoji(sel)]] : [];
  return `<select class="select avatar-sel" aria-label="Avatar">${[...Object.entries(AVATARS), ...val]
    .map(([id, emoji]) => `<option value="${id}" ${id === sel ? "selected" : ""}>${emoji}</option>`)
    .join("")}</select>`;
}

/**
 * Namn + avatar för en elev (förr raden i medlemshanteraren): avatarväljare,
 * namnfält och Spara. Muterar `s` vid lyckad sparning och anropar onSaved().
 */
export function renderNameEditor(host, s, onSaved) {
  host.replaceChildren(el(`<div class="mm-main et-namnruta">
    ${avatarSelectHtml(s.avatarId || "fox")}
    <input class="cell mm-namn" value="${esc(s.namn || "")}" placeholder="Elevens namn" aria-label="Elevens namn" />
    <button type="button" class="btn gron small mm-save">${icon("save", 16)}<span>Spara</span></button>
    <span class="mm-save-flash" aria-live="polite"></span>
  </div>`));
  const saveFlash = host.querySelector(".mm-save-flash");
  host.querySelector(".mm-namn").focus();
  host.querySelector(".mm-save").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const namn = host.querySelector(".mm-namn").value.trim();
    const avatarId = host.querySelector(".avatar-sel").value;
    if (!namn) return void (saveFlash.innerHTML = `<span class="gc-err">Namn saknas.</span>`);
    btn.disabled = true;
    try {
      await data.upsertStudent(s.id, { namn, avatarId });
      s.namn = namn;
      s.avatarId = avatarId;
      saveFlash.innerHTML = `<span class="gc-ok">✓ Sparat</span>`;
      if (onSaved) onSaved();
    } catch (err) {
      saveFlash.innerHTML = `<span class="gc-err">${esc(errText(err))}</span>`;
    } finally {
      btn.disabled = false;
    }
  });
}

/**
 * Skapa nya elevkonton i klassen: antal → redigerbar kontotabell → skapa.
 * onCreated(created) efter att kontona kopplats till klassen (cls.studentIds
 * uppdaterad, eleverna pushade i `students`).
 */
export function renderCreateAccounts(host, { cls, students, onCreated }) {
  const prefix = usernamePrefix(cls.name || cls.id);
  host.replaceChildren(el(`<div>
    <p class="hint">Ange hur många nya elever du vill lägga till. Konton skapas med
      auto-genererade användarnamn (<b>${esc(prefix)}NN</b>) och lösenord.</p>
    <div class="row-inline">
      <input class="cell mm-count" type="number" min="1" max="40" step="1" value="5" aria-label="Antal nya elever" />
      <button type="button" class="btn gron small mm-create">${icon("plus", 16)}<span>Förbered konton</span></button>
      <span class="mm-create-flash" aria-live="polite"></span>
    </div>
    <div class="mm-editor"></div>
  </div>`));
  const createFlash = host.querySelector(".mm-create-flash");
  const editorHost = host.querySelector(".mm-editor");
  host.querySelector(".mm-create").addEventListener("click", () => {
    const count = Math.floor(Number(host.querySelector(".mm-count").value));
    if (!Number.isFinite(count) || count <= 0) {
      createFlash.innerHTML = `<span class="gc-err">Ange ett antal (minst 1).</span>`;
      return;
    }
    createFlash.innerHTML = "";
    const taken = new Set(students.map((x) => String(x.username || "").toLowerCase()).filter(Boolean));
    renderAccountEditor(editorHost, {
      count,
      prefix,
      className: cls.name || cls.id,
      taken,
      onCancel: () => editorHost.replaceChildren(),
      onCreated: async (created) => {
        created.forEach((c) => students.push({ id: c.id, namn: c.namn, username: c.username, avatarId: "fox" }));
        const nextIds = [...(cls.studentIds || []), ...created.map((c) => c.id)];
        let fel = null;
        try {
          await data.setClassStudents(cls.id, nextIds);
          cls.studentIds = nextIds;
        } catch (err) {
          fel = `Kontona skapades men klasskopplingen misslyckades: ${esc(err.message)}`;
        }
        onCreated(created, fel);
      },
    });
  });
}

/** Lägg till befintliga elevkonton (som inte redan är med) i klassen. onAdded() efteråt. */
export function renderAddExisting(host, { cls, students, onAdded }) {
  const memberIds = new Set(cls.studentIds || []);
  const nonMembers = students.filter((s) => !memberIds.has(s.id)).sort(byNamn);
  if (nonMembers.length === 0) {
    host.replaceChildren(el(`<p class="hint">Alla elevkonton finns redan i den här klassen.</p>`));
    return;
  }
  const rows = nonMembers
    .map(
      (s) => `<label class="member-row">
        <input type="checkbox" value="${esc(s.id)}" />
        <span class="member-avatar">${avatarEmoji(s.avatarId)}</span>
        <span class="member-name">${esc(s.namn || s.username || s.id)}</span>
      </label>`
    )
    .join("");
  const box = el(`<div>
    <div class="member-grid">${rows}</div>
    <div class="row-inline" style="margin-top:10px">
      <button type="button" class="btn gron small mm-link">${icon("link", 16)}<span>Lägg till valda</span></button>
      <span class="mm-link-flash" aria-live="polite"></span>
    </div>
  </div>`);
  box.querySelector(".mm-link").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const picked = [...box.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
    if (picked.length === 0)
      return void (box.querySelector(".mm-link-flash").innerHTML = `<span class="gc-err">Kryssa i minst en elev.</span>`);
    btn.disabled = true;
    try {
      const nextIds = [...(cls.studentIds || []), ...picked];
      await data.setClassStudents(cls.id, nextIds);
      cls.studentIds = nextIds;
      onAdded();
    } catch (err) {
      box.querySelector(".mm-link-flash").innerHTML = `<span class="gc-err">Kunde inte lägga till: ${esc(errText(err))}</span>`;
      btn.disabled = false;
    }
  });
  host.replaceChildren(box);
}

/** Sortering på namn (annars användarnamn), svensk ordning. */
export const byNamn = (a, b) =>
  String(a.namn || a.username || "").localeCompare(String(b.namn || b.username || ""), "sv");
