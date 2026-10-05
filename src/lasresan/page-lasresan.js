// ============================================================================
// Läsresan – route-skal (src/lasresan/page-lasresan.js)  ·  #399 + #401
// ----------------------------------------------------------------------------
//   #/elev/lasresan          kartan (huvudvyn) → text → sammanfattning → karta
//   #/elev/lasresan?vy=min   "Min läsning" (spec §20)
//
// Routen ligger i app.js med DYNAMISK import (som äventyret, #267/#271), så
// Läsresan aldrig hamnar i bootgrafen. Stilarna (lasresan.css) laddas härifrån
// först när eleven öppnar Läsresan.
//
// Slutför-flödet (spec §6), i ordning:
//   1. completeText: försök + tillstånd i EN transaktion (data-lasresan.js)
//   2. 3 pluggcoins/rätt på det vanliga saldot (rewards.award, inne i completeText)
//   3. dold nivåändring (räknas i samma transaktion, returneras aldrig)
//   4. kort positiv sammanfattning (antal rätt + coins, aldrig nivån)
//   5. kartan med animateFromStep = walk.fromStep, avataren går ett steg
//
// En påbörjad text återupptas (currentTextId), och redan låsta svar följer med
// via localStorage (reader-logic.js). Nivån (lasresa.level) används bara för
// textvalet och visas ALDRIG.
// ============================================================================

import * as data from "../data.js";
import { app, el, go, getParams, loading, renderTopbar } from "../ui.js";
import { getLasresa, startText, completeText } from "../data-lasresan.js";
import { loadBank, findText } from "./content/loader.js";
import { pickText } from "./picker.js";
import { summarize } from "./stats.js";
import { getWorld, firstWorld } from "./worlds/index.js";
import { renderJourneyMap } from "./ui-map.js";
import { renderReader } from "./ui-reader.js";
import { renderSummary, renderMyReading } from "./ui-summary.js";
import { loadPending, savePending, clearPending } from "./reader-logic.js";

const HASH = "#/elev/lasresan";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Ladda lasresan.css en gång. Vänta (högst en kort stund) på att den laddats
 * så att första vyn inte blinkar ostylad. Fel = vi kör vidare ändå.
 */
function ensureStyles() {
  if (document.querySelector("link[data-lasresan-css]")) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./lasresan.css", import.meta.url).href;
  link.dataset.lasresanCss = "1";
  const ready = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return ready;
}

/** Avatar-data för kartan (samma källa som sidomenyn). */
async function loadAvatar() {
  try {
    const sd = await data.getStudentData();
    return { avatarId: sd.avatarId, avatarItems: sd.avatarItems || [] };
  } catch {
    return { avatarId: null, avatarItems: [] };
  }
}

/**
 * Vilken text ska eleven läsa nu? Påbörjad text återupptas; annars väljs en
 * ny på elevens dolda nivå (picker.js) och markeras som påbörjad.
 */
export async function nextTextFor(lasresa) {
  if (lasresa.currentTextId) {
    const current = await findText(lasresa.currentTextId);
    if (current) return current;
  }
  const bank = await loadBank();
  const picked = pickText(lasresa.level, lasresa.seenTextIds, bank, { lastTextId: lasresa.lastTextId });
  if (!picked) throw new Error("Det finns inga texter att läsa just nu.");
  // force: den påbörjade texten (om någon) fanns inte längre i banken.
  const res = await startText(picked.id, undefined, { force: !!lasresa.currentTextId });
  if (res.textId === picked.id) return picked;
  return (await findText(res.textId)) || picked;
}

export async function pageLasresan() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await Promise.all([renderTopbar(), ensureStyles()]);

  const studentId = data.currentStudentId();
  const host = el(`<div class="lasresan">
    <div class="lr-verktyg" data-lr-verktyg></div>
    <div class="lr-vy" data-lr-vy></div>
  </div>`);
  const bar = host.querySelector("[data-lr-verktyg]");
  const vy = host.querySelector("[data-lr-vy]");
  app.replaceChildren(host);
  const avatar = await loadAvatar();
  let view = null;

  function swap(next) {
    if (view) view.destroy();
    view = next;
    requestAnimationFrame(fitHeight);
  }

  // F3 (#413): textrutan får inte gå under kanten vid sidstart. Mät hur långt
  // ner läsvyn börjar (topbar + verktygsrad) och låt CSS dra av det.
  function fitHeight() {
    if (!host.isConnected) return window.removeEventListener("resize", fitHeight);
    const top = vy.getBoundingClientRect().top + window.scrollY;
    host.style.setProperty("--lr-ovan", `${Math.round(top) + 24}px`);
  }
  window.addEventListener("resize", fitHeight);

  /** Verktygsraden ovanför vyn: [{ label, cls, onClick }]. Tom lista = dold. */
  function toolbar(buttons = []) {
    bar.replaceChildren(
      ...buttons.map(({ label, cls = "", onClick }) => {
        const b = el(`<button class="btn liten ${cls}" type="button">${label}</button>`);
        b.addEventListener("click", onClick);
        return b;
      })
    );
    bar.hidden = buttons.length === 0;
  }

  function busy(msg) {
    swap(null);
    toolbar();
    vy.replaceChildren(el(`<div class="panel center lr-busy"><div class="big-emoji">📖</div><p class="hint">${msg}</p></div>`));
  }

  const minLasning = { label: "📊 Min läsning", cls: "ghost lr-min-knapp", onClick: () => go(`${HASH}?vy=min`) };

  /**
   * Kartan. `after` = resultatet av en färdig text ({ walk, worldCompleted }):
   * avataren går walk.fromStep → walk.toStep. Vid världsbyte visas först den
   * GAMLA världen klar (sista steget), med en knapp vidare till nästa värld.
   */
  async function showMap(after = null) {
    const lasresa = await getLasresa();
    const walk = after && after.walk;
    let world = getWorld(lasresa.worldId) || firstWorld();
    let progress = { worldId: lasresa.worldId, stepInWorld: lasresa.stepInWorld, completedWorlds: lasresa.completedWorlds };
    const buttons = [];
    if (walk && walk.worldId !== lasresa.worldId && getWorld(walk.worldId)) {
      const next = world;
      world = getWorld(walk.worldId);
      progress = { worldId: world.id, stepInWorld: walk.toStep, completedWorlds: lasresa.completedWorlds };
      buttons.push({ label: `Vidare till ${next.name} →`, cls: "gron lr-nasta-varld", onClick: () => showMap().catch(showError) });
    }
    buttons.push(minLasning);
    swap(null);
    toolbar(buttons);
    vy.replaceChildren();
    swap(
      renderJourneyMap(vy, {
        world,
        progress,
        avatar,
        animateFromStep: walk ? walk.fromStep : null,
        // Extra (utöver kontraktet), för en karta som vill fira världsbytet:
        walk: walk || null,
        worldCompleted: !!(after && after.worldCompleted),
        onStartNext: () => showReader().catch(showError),
      })
    );
  }

  async function showReader() {
    busy("Hämtar en text…");
    const text = await nextTextFor(await getLasresa());
    swap(null);
    toolbar([{ label: "← Kartan", cls: "ghost", onClick: () => showMap().catch(showError) }]);
    vy.replaceChildren();
    swap(
      renderReader(vy, {
        text,
        initialAnswers: loadPending(storage(), studentId, text.id),
        onAnswer: (answers) => savePending(storage(), studentId, text.id, answers),
        onDone: ({ answers }) => finish(text, answers).catch(showError),
      })
    );
  }

  /** Slutför-flödet (spec §6), se filhuvudet. */
  async function finish(text, answers) {
    // Låt sista ✅/❌ synas en kort stund innan vyn byts.
    await new Promise((r) => setTimeout(r, 900));
    busy("Sparar…");
    const res = await completeText({ text, answers });
    clearPending(storage(), studentId);
    if (!res.ok) {
      // Redan avslutad (dubbelklick/annan flik) – inget nytt att visa.
      await showMap();
      return;
    }
    await renderTopbar(); // nytt saldo i sidomenyn
    const a = res.attempt;
    const worldDone = res.worldCompleted ? getWorld(res.completedWorldId) : null;
    const nextWorld = res.unlockedWorldId ? getWorld(res.unlockedWorldId) : null;
    swap(null);
    toolbar();
    vy.replaceChildren();
    swap(
      renderSummary(vy, {
        correct: a.correct,
        total: a.totalQuestions,
        coins: res.coins,
        worldDone,
        nextWorld,
        onContinue: () => showMap({ walk: res.walk, worldCompleted: res.worldCompleted }).catch(showError),
      })
    );
  }

  async function showMyReading() {
    const lasresa = await getLasresa();
    swap(null);
    toolbar();
    vy.replaceChildren();
    swap(renderMyReading(vy, { stats: summarize(lasresa), onBack: () => go(HASH) }));
  }

  function showError(err) {
    console.error("[Läsresan]", err);
    swap(null);
    toolbar();
    const box = el(`<div class="panel center"><div class="big-emoji">📚</div>
      <h2>Något gick fel</h2><p class="hint">Prova igen om en stund.</p>
      <button class="btn" type="button">Tillbaka till kartan</button></div>`);
    box.querySelector("button").addEventListener("click", () => showMap().catch(showError));
    vy.replaceChildren(box);
  }

  const start = getParams().vy === "min" ? showMyReading : showMap;
  await start().catch(showError);
}
