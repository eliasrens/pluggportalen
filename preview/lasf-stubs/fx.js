// Preview-stub för src/fx.js – konfetti/ljud utan beroenden.
export function confetti() {
  console.log("[preview] 🎉 konfetti");
}
const noop = () => {};
export const sound = {
  correct: noop, wrong: noop, finish: noop, click: noop,
};
let muted = false;
export function isMuted() { return muted; }
export function toggleMuted() { muted = !muted; return muted; }
