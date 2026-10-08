// ============================================================================
// Trollkarlsduellen (#536): HUD:en (spec §6.2/6.3, §13) – det som ALLTID ska
// gå att läsa, ovanför alla effektlager:
//   uppe i mitten  stor matchklocka (matchens riktiga tid, st.clock) + VS
//   uppe v/h       klassnamn, trollkarlens namn, matchpoäng ("20,0 poäng/elev"
//                  = befintliga Live-snittet) + "rätt ÷ nämnare", 👑 LEDER
//   nere v/h       magimätarna (trollkarl-matare.js)
// Ledaren markeras utan att den andra ser besegrad ut (bara en krona + glöd).
//
// API: createHud(stage) → { update(duelData), meters: { left, right }, destroy() }
// ============================================================================

import { esc } from "../../teacher-shared.js";
import { createMeter } from "./trollkarl-matare.js";

function sideHtml(side) {
  return `<div class="tkh-side tkh-${side}" data-side="${side}">
    <div class="tkh-lead" aria-hidden="true">👑 LEDER</div>
    <div class="tkh-class" data-class></div>
    <div class="tkh-wiz" data-wiz></div>
    <div class="tkh-score"><b data-score>0,0</b><span>poäng/elev</span></div>
    <small class="tkh-raw" data-raw></small>
  </div>`;
}

export function createHud(stage) {
  const el = document.createElement("div");
  el.className = "tkh";
  el.innerHTML = `
    ${sideHtml("left")}
    <div class="tkh-mid">
      <div class="tkh-clock" role="timer" aria-label="Tid kvar"><b data-clock>00:00</b><span>kvar</span></div>
      <div class="tkh-vs">VS</div>
    </div>
    ${sideHtml("right")}
    <div class="tkh-meters"><div class="tkh-mhost" data-m="left"></div><div class="tkh-mhost" data-m="right"></div></div>`;
  stage.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const sides = Object.fromEntries(["left", "right"].map((side) => {
    const root = el.querySelector(`.tkh-${side}`);
    return [side, {
      root,
      cls: root.querySelector("[data-class]"),
      wiz: root.querySelector("[data-wiz]"),
      score: root.querySelector("[data-score]"),
      raw: root.querySelector("[data-raw]"),
      last: "",
    }];
  }));
  const meters = {
    left: createMeter($('[data-m="left"]'), { who: "rasmus", side: "left" }),
    right: createMeter($('[data-m="right"]'), { who: "elias", side: "right" }),
  };
  let clockText = "";

  function update(d) {
    if (d.clock !== clockText) {
      clockText = d.clock;
      $("[data-clock]").textContent = d.clock;
    }
    el.dataset.tension = d.tension;
    el.dataset.phase = d.phase;
    for (const s of d.sides) {
      const ui = sides[s.side];
      const key = `${s.name}|${s.who}`;
      if (key !== ui.last) {
        ui.last = key;
        ui.cls.innerHTML = esc(s.name);
        ui.wiz.textContent = `🧙 ${s.wizardName}`;
        ui.root.dataset.who = s.who;
        meters[s.side].setWho(s.who);
      }
      const score = s.scoreText;
      if (ui.score.textContent !== score) {
        ui.score.textContent = score;
        ui.score.classList.remove("tkh-pop");
        void ui.score.offsetWidth;
        ui.score.classList.add("tkh-pop");
      }
      ui.raw.textContent = `${s.correct} rätt ÷ ${s.divisor}`;
      ui.root.classList.toggle("leder", s.leading);
    }
  }

  return {
    update,
    meters,
    destroy() {
      meters.left.destroy();
      meters.right.destroy();
      el.remove();
    },
  };
}
