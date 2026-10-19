// ============================================================================
// Pluggporten – lärarsidan: statistikflikarnas hjälpare (teacher-stats-av.js)
// ----------------------------------------------------------------------------
// #804 (epic #802 §3.2) för renderClassStats i teacher-class.js:
//   * modulAv(cls, id) – är modulen avstängd för klassen (hiddenModules, eller
//     opt-in utan enabledModules)? Fliken visas då nedtonad med "· av".
//   * avNotis – "X är avstängd för 4B. Eleverna ser den inte. Slå på den under
//     Vad eleverna ser" (länk) överst i fliken; statistiken står kvar under.
//   * lastStatsTab/sparaStatsTab – senast valda underflik, minns över sidbyten
//     och omladdning (localStorage, med minnet som reserv).
// Laddas bara via teacher-class.js (aldrig i den statiska bootgrafen, #271).
// ============================================================================

import { TOGGLABLE_MODULES, normalizeEnabledModules, normalizeHiddenModules } from "./gamemode-visibility.js";
import { el, esc } from "./teacher-shared.js";

/** Är modulen `id` avstängd för klassen? Opt-in (#605) = av tills den slagits på. */
export function modulAv(cls, id) {
  const m = TOGGLABLE_MODULES.find((x) => x.id === id);
  if (!m) return false;
  if (normalizeHiddenModules(cls?.hiddenModules).includes(id)) return true;
  return !!m.optIn && !normalizeEnabledModules(cls?.enabledModules).includes(id);
}

/** "X är avstängd för 4B …" med länk till Vad eleverna ser; returnerar värden för innehållet. */
export function avNotis(ctx, pane, tab, opts) {
  const namn = TOGGLABLE_MODULES.find((m) => m.id === tab.modul)?.label || tab.label;
  const klass = opts.cls.name || opts.cls.id;
  const href = `#/larare/mina-klasser?${new URLSearchParams({ klass: opts.cls.id, flik: "ser" })}`;
  const box = el(`<div class="stats-av-notis msg warn" role="status">
    <b>${esc(namn)} är avstängd för ${esc(klass)}.</b> Eleverna ser den inte. Slå på den under
    <a href="${esc(href)}" class="stats-av-lank">Vad eleverna ser</a>.
  </div>`);
  box.querySelector("a").addEventListener("click", (e) => {
    e.preventDefault();
    if (opts.visaSer) opts.visaSer();
    else ctx.go(href);
  });
  const inner = el(`<div></div>`);
  pane.replaceChildren(box, inner);
  return inner;
}

// Senast valda statistikflik (lastStatsTab): minns över sidbyten och omladdning (#804).
export const STATS_TAB_KEY = "pp:larare:statsflik";
let senastStatsTab = "amnen";
export function lastStatsTab() {
  try {
    return localStorage.getItem(STATS_TAB_KEY) || senastStatsTab;
  } catch {
    return senastStatsTab;
  }
}
export function sparaStatsTab(key) {
  senastStatsTab = key;
  try {
    localStorage.setItem(STATS_TAB_KEY, key);
  } catch {}
}
