// ============================================================================
// Pluggporten – lärarsidan: skapa en ny klass (teacher-classes-create.js)
// ----------------------------------------------------------------------------
// Issue #440: skapa-klass-flödet (K-02–K-08) flyttat ur teacher-classes.js till
// detaljytans "ny"-läge (lead-beslut D-4, ingen overlay). Samma validering och
// data-anrop som förut: id = slugify(namn), dubblettkoll, order = max+1 →
// data.upsertClass; N elever → kontoeditorn → data.setClassStudents.
// Nytt: klassen väljs automatiskt efteråt och landar på Elever-sektionen, där
// lösenords-panelen ligger kvar tills läraren stänger den (X-08).
// ============================================================================

import * as data from "./data.js";
import { slugify } from "./validate.js";
import { el, esc, icon } from "./teacher-shared.js";
import { credentialsPanel, usernamePrefix } from "./teacher-class-accounts.js";
import { renderAccountEditor } from "./teacher-login-cards.js";

/** Rendera skapa-formuläret in i `host`. */
export function renderCreateClass(ctx, store, host) {
  const view = el(`<div class="cls-create">
    <h2 class="subhead">${icon("plus", 20)}<span>Skapa en ny klass</span></h2>
    <p class="hint">Ange klassnamn och antal elever. Vi skapar klassen och elevkontona på en
      gång – med auto-genererade användarnamn och lösenord som du får dela ut. (Sätt 0 elever
      om du bara vill skapa en tom klass.)</p>
    <form class="row-inline new-class">
      <label class="cls-create-field">
        <span>Klassnamn</span>
        <input id="new-name" class="cell" placeholder="Ny klass, t.ex. 6A" autocomplete="off" />
      </label>
      <label class="cls-create-field">
        <span>Antal elever</span>
        <input id="new-count" class="cell" type="number" min="0" max="40" step="1" value="0" />
      </label>
      <button class="btn gron" type="submit">${icon("plus")}<span>Skapa klass</span></button>
    </form>
    <div id="new-msg"></div>
  </div>`);
  host.replaceChildren(view);

  const form = view.querySelector("form");
  const input = view.querySelector("#new-name");
  const countInput = view.querySelector("#new-count");
  const newMsg = view.querySelector("#new-msg");
  input.focus();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    newMsg.innerHTML = "";
    const name = input.value.trim();
    if (!name) {
      newMsg.innerHTML = `<div class="msg error">Skriv ett namn på klassen först.</div>`;
      return;
    }
    const count = Math.max(0, Math.floor(Number(countInput.value) || 0));
    const id = slugify(name) || `klass-${Date.now()}`;
    if (store.classes.some((c) => c.id === id)) {
      newMsg.innerHTML = `<div class="msg error">Det finns redan en klass som heter "${esc(name)}".</div>`;
      return;
    }
    const nextOrder = store.classes.reduce((m, c) => Math.max(m, Number(c.order) || 0), 0) + 1;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const cls = { id, name, order: nextOrder, studentIds: [] };
    try {
      await data.upsertClass(id, { name, order: nextOrder });
    } catch (err) {
      newMsg.innerHTML = `<div class="msg error">Kunde inte skapa klassen: ${esc(err.message)}</div>`;
      submitBtn.disabled = false;
      return;
    }
    submitBtn.disabled = false;

    if (count === 0) {
      // K-06: tom klass → välj den direkt och visa Elever, där konton kan skapas.
      store.flashes.set(id, `✓ Klassen "${esc(name)}" skapades. Lägg till elever nedan.`);
      store.classes.push(cls);
      store.select(id, "elever");
      return;
    }

    // K-07: klassen finns redan i listan; visa den redigerbara kontotabellen
    // (förslag ifyllda) innan kontona skapas.
    store.addClass(cls);
    input.value = "";
    countInput.value = "0";
    newMsg.replaceChildren(
      el(`<div class="msg ok">✓ Klassen "${esc(name)}" skapades. Kontrollera elevkontona nedan
        och klicka sedan Skapa.</div>`)
    );
    const editorHost = el(`<div class="new-editor"></div>`);
    newMsg.appendChild(editorHost);
    const students = store.state.students;
    const taken = new Set(students.map((s) => String(s.username || "").toLowerCase()).filter(Boolean));
    renderAccountEditor(editorHost, {
      count,
      prefix: usernamePrefix(name),
      className: name,
      taken,
      onCancel: () => editorHost.replaceChildren(),
      // K-08: samma kopplingssteg som förut, sedan landar läraren på klassens Elever
      // med lösenords-panelen (sparad i storen tills den stängs, X-08).
      onCreated: async (created) => {
        created.forEach((c) =>
          students.push({ id: c.id, namn: c.namn, username: c.username, avatarId: "fox" })
        );
        cls.studentIds = created.map((c) => c.id);
        store.creds.set(id, created);
        try {
          await data.setClassStudents(id, cls.studentIds);
        } catch (err) {
          // Kopplingen misslyckades: stanna här med felet + lösenorden (de får inte tappas).
          newMsg.replaceChildren(
            el(`<div class="msg error">✓ ${created.length} elevkonto${created.length === 1 ? "" : "n"}
              skapades, men klasskopplingen misslyckades: ${esc(err.message)}. Skriv ut eller kopiera
              lösenorden nu.</div>`),
            credentialsPanel(name, created)
          );
          store.notify();
          return;
        }
        store.flashes.set(
          id,
          `✓ ${created.length} elevkonto${created.length === 1 ? "" : "n"} skapades i "${esc(name)}".
            Skriv ut eller kopiera lösenorden nu.`
        );
        store.select(id, "elever");
      },
    });
  });
}
