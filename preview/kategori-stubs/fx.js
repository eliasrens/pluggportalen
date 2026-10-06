// Preview-stub för src/fx.js – konfetti/ljud utan beroenden (kopia av lasf-stubs + combo för Kunskapsjakt).
export function confetti() {
  console.log("[preview] 🎉 konfetti");
}
const noop = () => {};
export const sound = {
  correct: noop, wrong: noop, finish: noop, click: noop, combo: noop,
};
let muted = false;
export function isMuted() { return muted; }
export function toggleMuted() { muted = !muted; return muted; }
