// ============================================================================
// Guldrushen (#564): GULDSIFFRAN överst på elevskärmen – räknar mjukt upp/ned
// till serverns värde (requestAnimationFrame, bara textContent).
// Under en kistöppning hålls siffran (hold) tills locket öppnas; därefter
// visas serverns svar (openChest/chooseVictim) även om grPlayers-snapshoten
// inte hunnit ikapp än (expect), så siffran aldrig hoppar tillbaka.
//
// API
//   createGoldCounter(el, { reduced? }) → {
//     hold(on)              håll siffran (kistan väljs/öppnas)
//     reveal(prev, gold)    serverns nya guld (prev = snapshotens värde nu)
//     sync(snapshotGold)    snapshoten ändrades – räkna dit om inget hålls
//     destroy()
//   }
// ============================================================================

import { countUp, formatGold } from "./gr-elev.js";

const EXPECT_MS = 2500;

export function createGoldCounter(el, { reduced = false } = {}) {
  let shown = 0;
  let held = false;
  let expect = null; // { prev, gold, until }
  let last = 0; // senaste snapshot-värdet
  let raf = 0;

  function countTo(target) {
    cancelAnimationFrame(raf);
    const from = shown;
    if (from === target) return;
    if (reduced) {
      shown = target;
      el.textContent = formatGold(target);
      return;
    }
    const t0 = performance.now();
    const dur = Math.min(650, 250 + Math.abs(target - from) * 4);
    const step = (t) => {
      const x = (t - t0) / dur;
      shown = countUp(from, target, x);
      el.textContent = formatGold(shown);
      if (x < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function target() {
    if (expect && Date.now() < expect.until && last === expect.prev) return expect.gold;
    expect = null;
    return last;
  }

  return {
    hold(on) {
      held = !!on;
      if (!held) countTo(target());
    },
    reveal(prev, gold) {
      held = false;
      expect = { prev, gold, until: Date.now() + EXPECT_MS };
      countTo(gold);
    },
    sync(snapshotGold) {
      last = Number(snapshotGold) || 0;
      if (!held) countTo(target());
    },
    destroy() {
      cancelAnimationFrame(raf);
    },
  };
}
