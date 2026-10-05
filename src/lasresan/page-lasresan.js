// ============================================================================
// Läsresan – route-skal (src/lasresan/page-lasresan.js)  ·  SKAL (issue #399)
// ----------------------------------------------------------------------------
// Kopplar ihop kärnan med vyerna: karta → (välj/återuppta text) → läsvy →
// completeText → tillbaka till kartan med gånganimation.
//
// REGISTRERAS INTE i nav/router här. Issue #401 lägger routen i app.js med
// DYNAMISK import (som äventyret, #267/#271) – aldrig statiskt, så Läsresan
// aldrig hamnar i bootgrafen:
//
//   "/elev/lasresan": async () => (await import("./lasresan/page-lasresan.js")).pageLasresan(),
//
// Nivån (lasresa.level) används bara för textvalet och visas ALDRIG.
// ============================================================================

import * as data from "../data.js";
import { app, el, go, loading, renderTopbar } from "../ui.js";
import { getLasresa, startText, completeText } from "../data-lasresan.js";
import { loadBank, findText } from "./content/loader.js";
import { pickText } from "./picker.js";
import { getWorld, firstWorld } from "./worlds/index.js";
import { renderJourneyMap } from "./ui-map.js";
import { renderReader } from "./ui-reader.js";

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
 * ny på elevens dolda nivå och markeras som påbörjad.
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
  await renderTopbar();

  const host = el(`<div class="lasresan"></div>`);
  app.replaceChildren(host);
  const avatar = await loadAvatar();
  let view = null;

  async function showMap(animateFromStep = null) {
    if (view) view.destroy();
    const lasresa = await getLasresa();
    const world = getWorld(lasresa.worldId) || firstWorld();
    view = renderJourneyMap(host, {
      world,
      progress: { worldId: lasresa.worldId, stepInWorld: lasresa.stepInWorld, completedWorlds: lasresa.completedWorlds },
      avatar,
      animateFromStep,
      onStartNext: () => showReader().catch(showError),
    });
  }

  async function showReader() {
    if (view) view.destroy();
    loading();
    const text = await nextTextFor(await getLasresa());
    app.replaceChildren(host);
    view = renderReader(host, {
      text,
      onDone: async ({ answers }) => {
        try {
          const res = await completeText({ text, answers });
          await renderTopbar(); // nytt saldo i sidomenyn
          await showMap(res.ok ? res.walk.fromStep : null);
        } catch (err) {
          showError(err);
        }
      },
    });
  }

  function showError(err) {
    console.error("[Läsresan]", err);
    host.replaceChildren(
      el(`<div class="panel center"><div class="big-emoji">📚</div>
        <h2>Något gick fel</h2><p class="hint">Prova igen om en stund.</p></div>`)
    );
  }

  await showMap().catch(showError);
}
