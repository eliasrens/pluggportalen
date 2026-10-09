// ============================================================================
// Live – lärarformulärets "🪙 Pluggmynt efter matchen" (#557). Laddas LATT
// som custom-fältet "rewards" (live-rewards.js rewardsSetupField) – samma
// sektion för alla nya format. Tre tal + förhandsvisning som följer det
// läraren skriver. value() = råvärdena; formatets validateSetup kontrollerar.
//
// API: mount(box, inner) → { sync(classIds), value() }
// ============================================================================

import { el, esc } from "../teacher-shared.js";
import { LIVE_REWARDS, LIVE_REWARD_LIMITS } from "./rewards-config.js";
import { rewardsPreviewText, validateRewards } from "./live-rewards.js";

const FALT = [
  { key: "firstPrize", label: "Pris till 1:a plats", max: LIVE_REWARD_LIMITS.firstPrize, value: LIVE_REWARDS.defaultFirstPrize || "", placeholder: "t.ex. 300" },
  { key: "perCorrect", label: "Pluggmynt per rätt svar", max: LIVE_REWARD_LIMITS.perCorrect, value: LIVE_REWARDS.defaultPerCorrect },
  { key: "cap", label: "Tak per elev", min: 1, max: LIVE_REWARD_LIMITS.cap, value: LIVE_REWARDS.defaultCap },
];

export function mount(box, inner) {
  box.hidden = false;
  inner.replaceChildren(el(`<div>
    <div class="live-divisor-rows">${FALT.map((f) => `<label class="live-divisor"><span>${esc(f.label)}</span>
      <input type="number" min="${f.min ?? 0}" max="${f.max}" step="1" inputmode="numeric" data-rw="${f.key}"
        value="${esc(f.value)}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""} /></label>`).join("")}</div>
    <p class="hint live-rewards-preview" aria-live="polite"></p></div>`));
  const read = () => Object.fromEntries(FALT.map((f) => [f.key, inner.querySelector(`[data-rw="${f.key}"]`).value]));
  const preview = inner.querySelector(".live-rewards-preview");
  const draw = () => {
    const errs = validateRewards(read());
    preview.textContent = errs.length ? errs[0] : rewardsPreviewText(read());
    preview.classList.toggle("err-inline", errs.length > 0);
  };
  inner.querySelectorAll("[data-rw]").forEach((i) => i.addEventListener("input", draw));
  draw();
  return { sync() {}, value: read };
}
