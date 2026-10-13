// ============================================================================
// Ämnesläsning – elevflödet (src/amneslasning/page-amneslasning.js)  ·  #672
// ----------------------------------------------------------------------------
//   #/elev/spela?subj=…&area=…&mode=amneslasning
//
// Startas av dispatchern i gamemodes.js med DYNAMISK import (#271) – inget här
// får nås statiskt från app.js. Spec: docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md §4.
//
// Flödet: kortet → DIREKT nästa text (picker.js, ingen karta/lista) →
// Läsresans läsvy (renderReader) → Läsresans sammanfattning (renderSummary,
// utan karta) med mynt och "Läs nästa text" → nästa text.
//
// Påbörjad text återupptas på två plan, som Läsresan: vilken text (områdets
// currentTextId i Firestore) och redan låsta svar (localStorage, reader-logic).
// Nivån (ämnesnivå/läsnivå) används bara för textvalet och visas ALDRIG.
// ============================================================================

import * as data from "../data.js";
import { app, el, go, loading, renderTopbar } from "../ui.js";
import { enc } from "../game-shared.js";
import { getAmnesArea, startAmnesText, completeAmnesText } from "../data-amneslasning.js";
import { renderReader } from "../lasresan/ui-reader.js";
import { renderSummary } from "../lasresan/ui-summary.js";
import { loadPending, savePending, clearPending } from "../lasresan/reader-logic.js";
import { ALL_READ_MESSAGE, pendingKey, pickAmnesText, readProgress, readProgressLine } from "./picker.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Läsresans stilmall (läsvyn + sammanfattningen), en gång – som page-lasresan.js. */
function ensureStyles() {
  if (document.querySelector("link[data-lasresan-css]")) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../lasresan/lasresan.css", import.meta.url).href;
  link.dataset.lasresanCss = "1";
  const ready = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return ready;
}

/** @param {{subj:string, area:string, areaData:object}} ctx */
export async function startAmneslasning({ subj, area, areaData }) {
  if (!data.isLoggedIn()) return go("#/elev");
  loading(); // dispatchern har redan ritat topbaren
  await ensureStyles();
  // Läsresans bredare innehållsyta. app.js nollställer klassen vid nästa route.
  document.body.classList.add("lasresan-lage");

  const studentId = data.currentStudentId();
  const texts = areaData.readingTexts;
  const pending = pendingKey(area, studentId);
  const tillOmradet = () => go(`#/elev/omrade?subj=${enc(subj)}&area=${enc(area)}`);

  const host = el(`<div class="lasresan amneslasning">
    <div class="lr-verktyg" data-lr-verktyg></div>
    <div class="lr-vy" data-lr-vy></div>
  </div>`);
  const bar = host.querySelector("[data-lr-verktyg]");
  const vy = host.querySelector("[data-lr-vy]");
  app.replaceChildren(host);
  let view = null;

  function swap(next) {
    if (view) view.destroy();
    view = next;
    requestAnimationFrame(fitHeight);
  }

  // Som Läsresan (#413 F3): textrutan ryms under topbar + verktygsrad.
  function fitHeight() {
    if (!host.isConnected) return window.removeEventListener("resize", fitHeight);
    const top = vy.getBoundingClientRect().top + window.scrollY;
    host.style.setProperty("--lr-ovan", `${Math.round(top) + 24}px`);
  }
  window.addEventListener("resize", fitHeight);

  /** Verktygsraden: diskret info till vänster, "← Till området" till höger. */
  function toolbar({ line = "", besked = "" } = {}) {
    const info = el(`<div class="amn-info" role="status">
      ${besked ? `<span class="amn-besked" data-amn-besked>${esc(besked)}</span>` : ""}
      ${line ? `<span class="amn-rad" data-amn-rad>${esc(line)}</span>` : ""}
    </div>`);
    const back = el(`<button class="btn liten ghost" type="button">← Till området</button>`);
    back.addEventListener("click", tillOmradet);
    bar.replaceChildren(info, back);
    bar.hidden = false;
  }

  function busy(msg) {
    swap(null);
    toolbar();
    vy.replaceChildren(el(`<div class="panel center lr-busy"><div class="big-emoji">📖</div><p class="hint">${msg}</p></div>`));
  }

  /** Nästa text: påbörjad återupptas, annars väljs och markeras en ny. */
  async function nextText() {
    const { amnesLevel, area: state } = await getAmnesArea(subj, area);
    const pick = pickAmnesText(texts, amnesLevel, state);
    if (!pick) return null;
    if (pick.resumed) return { ...pick, state };
    // force: den påbörjade texten (om någon) finns inte längre i området.
    const res = await startAmnesText({ subjectId: subj, areaId: area, textId: pick.text.id }, undefined, { force: pick.stale });
    if (res.textId === pick.text.id) return { ...pick, state };
    // En annan flik hann starta en text – fortsätt med den om den finns kvar.
    const other = (texts || []).find((t) => t && t.id === res.textId);
    return other ? { text: other, resumed: true, allRead: false, state } : { ...pick, state };
  }

  async function showReader() {
    busy("Hämtar en text…");
    const next = await nextText();
    if (!next) return showEmpty();
    const { text, allRead, state } = next;
    swap(null);
    toolbar({ line: readProgressLine(readProgress(texts, state)), besked: allRead ? ALL_READ_MESSAGE : "" });
    vy.replaceChildren();
    swap(
      renderReader(vy, {
        text,
        initialAnswers: loadPending(storage(), pending, text.id),
        onAnswer: (answers) => savePending(storage(), pending, text.id, answers),
        onDone: ({ answers }) => finish(text, answers).catch(showError),
      })
    );
  }

  async function finish(text, answers) {
    // Låt sista ✅/❌ synas en kort stund innan vyn byts (som Läsresan).
    await new Promise((r) => setTimeout(r, 900));
    busy("Sparar…");
    const res = await completeAmnesText({ subjectId: subj, areaId: area, text, answers });
    clearPending(storage(), pending);
    if (!res.ok) {
      // Redan avslutad (dubbelklick/annan flik) – hämta nästa.
      await showReader();
      return;
    }
    await renderTopbar(); // nytt saldo i sidomenyn
    const a = res.attempt;
    swap(null);
    toolbar();
    vy.replaceChildren();
    swap(
      renderSummary(vy, {
        correct: a.correct,
        total: a.totalQuestions,
        coins: res.coins,
        note: readProgressLine(readProgress(texts, res.area)),
        continueLabel: "Läs nästa text 📖",
        onContinue: () => showReader().catch(showError),
      })
    );
  }

  function showEmpty() {
    swap(null);
    toolbar();
    const box = el(`<div class="panel center"><div class="big-emoji">📖</div>
      <h2>Inga texter än</h2><p class="hint">Det finns inga texter att läsa i området just nu.</p>
      <button class="btn" type="button">Tillbaka till området</button></div>`);
    box.querySelector("button").addEventListener("click", tillOmradet);
    vy.replaceChildren(box);
  }

  function showError(err) {
    console.error("[Ämnesläsning]", err);
    swap(null);
    toolbar();
    const box = el(`<div class="panel center"><div class="big-emoji">📚</div>
      <h2>Något gick fel</h2><p class="hint">Prova igen om en stund.</p>
      <button class="btn" type="button">Försök igen</button></div>`);
    box.querySelector("button").addEventListener("click", () => showReader().catch(showError));
    vy.replaceChildren(box);
  }

  await showReader().catch(showError);
}
