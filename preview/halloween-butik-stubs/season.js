// Preview-stub för src/season.js (#692): den RIKTIGA season-store.js med en
// styrbar "serverklocka" (performance.now-baserad) i stället för Firestore – så att
// test 5/5b (Halloween av/på, slutdatum passerar, framställd datorklocka) kan
// visas utan Firebase. Date.now() används aldrig av butiken.
import { createSeasonStore } from "/src/season-store.js";

// "Serverns" tid: startvärde + monoton tid sedan sidan laddades (+ spolning).
// Som serverNow() i appen (offset mot sajtens Date-header) bryr den sig inte om
// att elevens datorklocka (Date.now) ställs om.
let offset = 0;
const start = Date.now();
const p0 = performance.now();
export const serverNow = () => start + (performance.now() - p0) + offset;
const store = createSeasonStore({ now: serverNow });
globalThis.__season = {
  set: (doc) => store.snapshot(doc),
  // Spola "serverklockan" framåt och räkna om (som timern gör vid slutdatum).
  spola: (ms) => { offset += ms; store.recheck(); },
  get: () => store.get(),
  serverNow,
};
export const getSeason = () => store.get();
export const isHalloweenActive = () => store.get().halloweenActive;
export const onSeasonChange = (fn) => store.subscribe(fn);
export const startSeasonWatch = () => {};
export const seasonLoaded = async () => {};
