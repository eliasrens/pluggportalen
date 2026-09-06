// ============================================================================
// Pluggportalen – lärarsidan: elevkonton PER KLASS (teacher-class-accounts.js)
// ----------------------------------------------------------------------------
// Utbruten hjälpmodul till teacher-classes.js (håller huvudfilen under fil-cap).
// Klass-centrerat kontoskapande: läraren anger ett ANTAL elever och får N konton
// på en gång – auto-genererade användarnamn (klassprefix + löpnummer, unika) och
// enkla utdelbara lösenord (≥6 tecken). Kontona skapas via data.upsertStudent
// (som i sin tur kör createStudentAuthAccount mot en sekundär Firebase-app, så
// lärarens egen session inte kastas ut) och kopplas till klassen.
//
// Här bor även "medlemshanteraren" under ett klasskort: klassens elever med döp
// om/avatar, ge 🪙, ta ur klassen och ta bort konto – plus panelerna för att
// skapa nya konton eller lägga till befintliga elever i klassen.
// ============================================================================

import * as data from "./data.js";
import { AVATARS, avatarEmoji } from "./avatars.js";
import { el, esc, copyText } from "./teacher-shared.js";
import { renderAccountEditor, printLoginCards } from "./teacher-login-cards.js";

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
 * till i `created` som { id, namn, username, password } (lösenordet i klartext –
 * enda tillfället läraren kan se det). Kastar vid fel, men bifogar `err.created`
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

/**
 * Panel som visar nyss skapade inloggningsuppgifter med en "Kopiera alla"-knapp.
 * Lösenorden går inte att läsa igen.
 */
export function credentialsPanel(className, created) {
  const rows = created
    .map(
      (c) => `<tr><td>${esc(c.namn)}</td>
        <td class="cred-user">${esc(c.username)}</td>
        <td class="cred-pass">${esc(c.password)}</td></tr>`
    )
    .join("");
  const text =
    `Klass ${className} – inloggning (elevsidan)\n` +
    created.map((c) => `${c.username}\tlösenord: ${c.password}`).join("\n");

  const box = el(`<div class="cred-panel">
    <div class="cred-warn">⚠️ ${created.length} konto${created.length === 1 ? "" : "n"} skapade.
      Kopiera eller skriv ner lösenorden <b>nu</b> – de går inte att se igen. (Namnen kan du ändra senare.)</div>
    <div class="table-scroll"><table class="tbl cred-tbl">
      <thead><tr><th>Namn</th><th>Användarnamn</th><th>Lösenord</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="row-inline" style="margin-top:10px">
      <button class="btn gron small cred-copy">📋 Kopiera alla</button>
      <button class="btn small cred-print">🖨️ Skriv ut inloggningskort</button>
    </div>
  </div>`);
  box.querySelector(".cred-copy").addEventListener("click", (e) => copyText(text, e.currentTarget));
  box.querySelector(".cred-print").addEventListener("click", () => printLoginCards(className, created));
  return box;
}

// --- Små byggstenar för medlemsraden ----------------------------------------

function wireGiveCoins(row, student) {
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
    const amount = Math.floor(Number(amountEl.value));
    if (!Number.isFinite(amount) || amount <= 0) {
      flashEl.innerHTML = `<span class="gc-err">Skriv ett antal (positivt tal).</span>`;
      amountEl.focus();
      return;
    }
    giveBtn.disabled = true;
    flashEl.innerHTML = `<span class="hint">Ger coins…</span>`;
    try {
      await data.addCoins(amount, student.id);
      const nytt = await data.getCoins(student.id);
      const namn = student.namn || student.username || "eleven";
      flashEl.innerHTML = `<span class="gc-ok">✓ ${esc(namn)} fick ${amount} 🪙 – nytt saldo: ${nytt} 🪙</span>`;
    } catch (err) {
      flashEl.innerHTML = `<span class="gc-err">Kunde inte ge coins: ${esc(err.message)}</span>`;
    } finally {
      giveBtn.disabled = false;
    }
  });
}

function avatarSelectHtml(sel) {
  return `<select class="select avatar-sel">${Object.entries(AVATARS)
    .map(([id, emoji]) => `<option value="${id}" ${id === sel ? "selected" : ""}>${emoji}</option>`)
    .join("")}</select>`;
}

function countLabel(n) {
  return `${n} elev${n === 1 ? "" : "er"}`;
}

// --- Medlemshanterare (visas under "Elever" på ett klasskort) ---------------

/**
 * Rendera medlemshanteraren för EN klass in i `membersEl`. Muterar de delade
 * `state.students` / `cls.studentIds` och ritar om sig själv vid ändringar samt
 * uppdaterar `countEl`. `state` = { students } (delad referens från sidan).
 */
export function renderMemberManager(ctx, { cls, state, membersEl, countEl }) {
  const students = state.students;
  // Persistent yta för nyss skapade inloggningsuppgifter – överlever omritningar.
  const credsHost = el(`<div class="mm-creds"></div>`);

  function updateCount() {
    if (countEl) countEl.textContent = countLabel((cls.studentIds || []).length);
  }

  function memberRow(s) {
    const row = el(`<div class="member-manage-row" data-id="${esc(s.id)}">
      <div class="mm-main">
        ${avatarSelectHtml(s.avatarId || "fox")}
        <input class="cell mm-namn" value="${esc(s.namn || "")}" placeholder="Elevens namn" />
        <input class="cell mm-username" value="${esc(s.username || "")}" disabled title="Användarnamn kan inte ändras" />
        <button class="btn ghost small mm-save" title="Spara namn/avatar">💾</button>
        <span class="mm-save-flash" aria-live="polite"></span>
      </div>
      <div class="give-coins">
        <div class="gc-row">
          <input class="cell gc-amount" type="number" min="1" step="1" value="10" aria-label="Antal coins" />
          <button class="btn ghost small gc-quick" data-add="10">+10</button>
          <button class="btn ghost small gc-quick" data-add="50">+50</button>
          <button class="btn gron small gc-give">Ge 🪙</button>
        </div>
        <div class="gc-flash" aria-live="polite"></div>
      </div>
      <div class="mm-actions">
        <button class="btn ghost small" data-act="unlink">➖ Ta ur klassen</button>
        <button class="btn ghost small danger" data-act="del">🗑 Ta bort konto</button>
      </div>
    </div>`);

    wireGiveCoins(row, s);

    const saveFlash = row.querySelector(".mm-save-flash");
    row.querySelector(".mm-save").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const namn = row.querySelector(".mm-namn").value.trim();
      const avatarId = row.querySelector(".avatar-sel").value;
      if (!namn) return void (saveFlash.innerHTML = `<span class="gc-err">Namn saknas.</span>`);
      btn.disabled = true;
      try {
        await data.upsertStudent(s.id, { namn, avatarId });
        s.namn = namn;
        s.avatarId = avatarId;
        saveFlash.innerHTML = `<span class="gc-ok">✓ Sparat</span>`;
      } catch (err) {
        saveFlash.innerHTML = `<span class="gc-err">${esc(err.message)}</span>`;
      } finally {
        btn.disabled = false;
      }
    });

    row.querySelector('[data-act="unlink"]').addEventListener("click", async () => {
      const nextIds = (cls.studentIds || []).filter((id) => id !== s.id);
      try {
        await data.setClassStudents(cls.id, nextIds);
        cls.studentIds = nextIds;
        updateCount();
        draw();
      } catch (err) {
        alert("Kunde inte ta ur klassen: " + err.message);
      }
    });

    row.querySelector('[data-act="del"]').addEventListener("click", async () => {
      const namn = s.namn || s.username || s.id;
      if (!confirm(`Ta bort eleven "${namn}"? Detta tar även bort elevens speldata och går inte att ångra.`))
        return;
      try {
        await data.deleteStudent(s.id);
        const nextIds = (cls.studentIds || []).filter((id) => id !== s.id);
        await data.setClassStudents(cls.id, nextIds).catch(() => {});
        cls.studentIds = nextIds;
        const idx = students.findIndex((x) => x.id === s.id);
        if (idx >= 0) students.splice(idx, 1);
        updateCount();
        draw();
      } catch (err) {
        alert("Kunde inte ta bort: " + err.message);
      }
    });

    return row;
  }

  function draw() {
    const memberIds = new Set(cls.studentIds || []);
    const byNamn = (a, b) =>
      String(a.namn || a.username || "").localeCompare(String(b.namn || b.username || ""), "sv");
    const members = students.filter((s) => memberIds.has(s.id)).sort(byNamn);
    const nonMembers = students.filter((s) => !memberIds.has(s.id)).sort(byNamn);
    const prefix = usernamePrefix(cls.name || cls.id);

    const wrap = el(`<div class="member-manage">
      <h3 class="subhead sm">🧑‍🎓 Elever i klassen (${members.length})</h3>
      <div class="mm-list"></div>
      <details class="mm-add">
        <summary>➕ Skapa nya elevkonton i klassen</summary>
        <div class="mm-add-body">
          <p class="hint">Ange hur många nya elever du vill lägga till. Konton skapas med
            auto-genererade användarnamn (<b>${esc(prefix)}NN</b>) och lösenord.</p>
          <div class="row-inline">
            <input class="cell mm-count" type="number" min="1" max="40" step="1" value="5" aria-label="Antal nya elever" />
            <button class="btn gron small mm-create">➕ Förbered konton</button>
            <span class="mm-create-flash" aria-live="polite"></span>
          </div>
          <div class="mm-editor"></div>
        </div>
      </details>
      <details class="mm-add">
        <summary>🔗 Lägg till befintliga elever</summary>
        <div class="mm-add-body mm-existing"></div>
      </details>
    </div>`);

    const listEl = wrap.querySelector(".mm-list");
    if (members.length === 0) {
      listEl.appendChild(el(`<p class="hint">Inga elever i klassen än – skapa konton nedan.</p>`));
    } else {
      members.forEach((s) => listEl.appendChild(memberRow(s)));
    }

    // Skapa nya konton i klassen: förslag → redigerbar tabell → skapa.
    const createBtn = wrap.querySelector(".mm-create");
    const createFlash = wrap.querySelector(".mm-create-flash");
    const editorHost = wrap.querySelector(".mm-editor");
    createBtn.addEventListener("click", () => {
      const count = Math.floor(Number(wrap.querySelector(".mm-count").value));
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
          created.forEach((c) =>
            students.push({ id: c.id, namn: c.namn, username: c.username, avatarId: "fox" })
          );
          const nextIds = [...(cls.studentIds || []), ...created.map((c) => c.id)];
          try {
            await data.setClassStudents(cls.id, nextIds);
            cls.studentIds = nextIds;
          } catch (err) {
            createFlash.innerHTML = `<span class="gc-err">Kontona skapades men klasskopplingen misslyckades: ${esc(err.message)}</span>`;
          }
          credsHost.replaceChildren(credentialsPanel(cls.name || cls.id, created));
          updateCount();
          draw();
        },
      });
    });

    // Lägg till befintliga elever.
    const existingEl = wrap.querySelector(".mm-existing");
    if (nonMembers.length === 0) {
      existingEl.appendChild(el(`<p class="hint">Alla elevkonton finns redan i den här klassen.</p>`));
    } else {
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
          <button class="btn gron small mm-link">🔗 Lägg till valda</button>
          <span class="mm-link-flash" aria-live="polite"></span>
        </div>
      </div>`);
      box.querySelector(".mm-link").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const picked = [...box.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
        if (picked.length === 0)
          return void (box.querySelector(".mm-link-flash").innerHTML =
            `<span class="gc-err">Kryssa i minst en elev.</span>`);
        btn.disabled = true;
        try {
          const nextIds = [...(cls.studentIds || []), ...picked];
          await data.setClassStudents(cls.id, nextIds);
          cls.studentIds = nextIds;
          updateCount();
          draw();
        } catch (err) {
          box.querySelector(".mm-link-flash").innerHTML =
            `<span class="gc-err">Kunde inte lägga till: ${esc(err.message)}</span>`;
          btn.disabled = false;
        }
      });
      existingEl.appendChild(box);
    }

    membersEl.replaceChildren(credsHost, wrap);
  }

  draw();
}
