import { S } from "./state.js";
const ls = new Set();
export const onLiveVisibleChange = (fn) => (ls.add(fn), () => ls.delete(fn));
export function stopLiveWatch() {}
export async function liveVisibleFor() { return S.live; }
// Testkrok: lobbyn startar/slutar → bevakaren meddelar som den riktiga.
window.__pvSetLive = (on) => { S.live = on; ls.forEach((fn) => fn(on)); };
