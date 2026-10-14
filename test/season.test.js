// ============================================================================
// Tester: säsongen (#690, epic #689) – ren logik i src/season-config.js och
// src/season-store.js.
//   • test 1: saknat/trasigt config/season = sommar utan Halloween
//   • Halloween = halloween:true OCH slutdatumet inte passerat
//   • test 5b (logik): slutdatumet passerar medan eleven är inne → läget byter
//     utan omladdning; en framställd datorklocka påverkar inget (tiden kommer
//     bara från den server-korrigerade klockan)
//   • localStorage-cachen ger startläget; förvalt slutdatum 2 nov 23.59
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEASONS,
  defaultHalloweenUntil,
  describeSeason,
  fromLocalInput,
  halloweenActive,
  nextSeasonBoundary,
  normalizeSeason,
  seasonConfig,
  toLocalInput,
  toMs,
} from "../src/season-config.js";
import { createSeasonStore } from "../src/season-store.js";

const NU = new Date(2026, 9, 30, 12, 0).getTime(); // 30 okt 2026 12.00 lokal tid
const SLUT = new Date(2026, 10, 2, 23, 59).getTime();

/** Fejkade timers: tick(ms) flyttar "serverns" klocka och kör förfallna timers. */
function rigg({ start = NU, cache = null } = {}) {
  let now = start;
  let seq = 0;
  const timers = new Map();
  const sparat = [];
  const store = createSeasonStore({
    now: () => now,
    load: () => cache,
    save: (s) => sparat.push(s),
    setTimeout: (fn, ms) => (timers.set(++seq, { fn, at: now + ms }), seq),
    clearTimeout: (id) => timers.delete(id),
  });
  const tick = (ms) => {
    now += ms;
    for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (t.at <= now && timers.has(id)) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  return { store, tick, timers, sparat };
}

test("test 1: saknat dokument = sommar, ingen Halloween (exakt som i dag)", () => {
  for (const raw of [null, undefined, {}, "x", { season: "vinter", halloween: "ja" }]) {
    const s = normalizeSeason(raw);
    assert.deepEqual(s, { season: "sommar", halloween: false, halloweenUntil: null });
    assert.equal(halloweenActive(raw, NU), false);
  }
  const { store } = rigg();
  assert.equal(store.get().season, "sommar");
  assert.equal(store.get().halloweenActive, false);
  assert.equal(store.get().config, SEASONS.sommar);
  assert.equal(store.get().config.dekor.leaves, false);
  store.snapshot(null);
  assert.equal(store.get().season, "sommar");
});

test("säsongen är en nyckel till en konfiguration (okänd → sommar)", () => {
  assert.equal(seasonConfig("host"), SEASONS.host);
  assert.equal(seasonConfig("host").label, "Höst");
  assert.equal(seasonConfig("jul"), SEASONS.sommar);
  for (const k of Object.keys(SEASONS)) {
    assert.ok(SEASONS[k].label && SEASONS[k].palette && SEASONS[k].dekor && SEASONS[k].preview, k);
  }
});

test("Halloween på = halloween:true och slutdatumet inte passerat", () => {
  assert.equal(halloweenActive({ halloween: true }, NU), true);
  assert.equal(halloweenActive({ halloween: true, halloweenUntil: null }, NU), true);
  assert.equal(halloweenActive({ halloween: true, halloweenUntil: SLUT }, NU), true);
  assert.equal(halloweenActive({ halloween: true, halloweenUntil: SLUT }, SLUT), false);
  assert.equal(halloweenActive({ halloween: true, halloweenUntil: SLUT }, SLUT + 1), false);
  assert.equal(halloweenActive({ halloween: false, halloweenUntil: SLUT }, NU), false);
  assert.equal(nextSeasonBoundary({ halloween: true, halloweenUntil: SLUT }, NU), SLUT);
  assert.equal(nextSeasonBoundary({ halloween: true }, NU), null);
  assert.equal(nextSeasonBoundary({ halloween: true, halloweenUntil: SLUT }, SLUT + 1), null);
});

test("tidsstämplar: Firestore Timestamp, {seconds}, Date, ms", () => {
  assert.equal(toMs({ toMillis: () => SLUT }), SLUT);
  assert.equal(toMs({ seconds: SLUT / 1000, nanoseconds: 0 }), SLUT);
  assert.equal(toMs(new Date(SLUT)), SLUT);
  assert.equal(toMs(SLUT), SLUT);
  assert.equal(toMs(null), null);
  assert.equal(toMs("2026-11-02"), null);
  assert.equal(normalizeSeason({ halloween: true, halloweenUntil: { seconds: SLUT / 1000 } }).halloweenUntil, SLUT);
});

test("test 5b: slutdatumet passerar medan eleven är inne → Halloween av utan omladdning", () => {
  const { store, tick } = rigg({ start: SLUT - 60_000 });
  const handelser = [];
  store.subscribe((nytt, forra) => handelser.push([forra.halloweenActive, nytt.halloweenActive]));
  store.snapshot({ season: "host", halloween: true, halloweenUntil: { toMillis: () => SLUT } });
  assert.equal(store.get().halloweenActive, true);
  assert.deepEqual(handelser, [[false, true]]);
  tick(59_000);
  assert.equal(store.get().halloweenActive, true);
  tick(2_000); // över slutdatumet → timern slår igenom
  assert.equal(store.get().halloweenActive, false);
  assert.equal(store.get().halloween, true, "dokumentet är orört – bara läget räknas om");
  assert.equal(store.get().season, "host", "säsongen påverkas inte");
  assert.deepEqual(handelser, [[false, true], [true, false]]);
});

test("test 5b: en framställd datorklocka påverkar inget (bara serverns tid räknas)", () => {
  const { store } = rigg();
  store.snapshot({ season: "host", halloween: true, halloweenUntil: SLUT });
  const riktig = Date.now;
  try {
    Date.now = () => SLUT + 365 * 86_400_000; // eleven ställer fram datorn ett år
    store.recheck();
    assert.equal(store.get().halloweenActive, true);
  } finally {
    Date.now = riktig;
  }
});

test("lyssnare får bara händelser vid faktisk ändring", () => {
  const { store } = rigg();
  let n = 0;
  const av = store.subscribe(() => n++);
  store.snapshot({ season: "sommar", halloween: false });
  assert.equal(n, 0, "samma som förvalet");
  store.snapshot({ season: "host", halloween: false });
  store.snapshot({ season: "host", halloween: false });
  assert.equal(n, 1);
  store.snapshot({ season: "host", halloween: true });
  assert.equal(n, 2);
  av();
  store.snapshot({ season: "sommar", halloween: false });
  assert.equal(n, 2);
});

test("lyssnare som kastar stoppar inte de andra", () => {
  const { store } = rigg();
  let ok = false;
  const fel = console.error;
  console.error = () => {};
  try {
    store.subscribe(() => {
      throw new Error("boom");
    });
    store.subscribe(() => (ok = true));
    store.snapshot({ season: "host" });
  } finally {
    console.error = fel;
  }
  assert.equal(ok, true);
});

test("localStorage-cachen ger startläget och uppdateras vid varje snapshot", () => {
  const { store, sparat } = rigg({ cache: { season: "host", halloween: true, halloweenUntil: SLUT } });
  assert.equal(store.fromServer, false);
  assert.equal(store.get().season, "host");
  assert.equal(store.get().halloweenActive, true);
  store.snapshot(null);
  assert.equal(store.fromServer, true);
  assert.equal(store.get().season, "sommar");
  assert.deepEqual(sparat.at(-1), { season: "sommar", halloween: false, halloweenUntil: null });
});

test("ett cachat slutdatum som passeras slår av Halloween även innan servern svarat", () => {
  const { store, tick } = rigg({ start: SLUT - 1000, cache: { season: "host", halloween: true, halloweenUntil: SLUT } });
  assert.equal(store.get().halloweenActive, true);
  tick(1500);
  assert.equal(store.get().halloweenActive, false);
});

test("trasig cache = sommar", () => {
  const store = createSeasonStore({ now: () => NU, load: () => { throw new Error("SyntaxError"); } });
  assert.equal(store.get().season, "sommar");
});

test("slutdatum långt fram: timern väcks i etapper (setTimeout-taket)", () => {
  const langt = NU + 60 * 86_400_000;
  const { store, tick, timers } = rigg();
  store.snapshot({ halloween: true, halloweenUntil: langt });
  assert.equal(timers.size, 1);
  tick(30 * 86_400_000);
  assert.equal(store.get().halloweenActive, true);
  assert.equal(timers.size, 1, "ny timer efter väckningen");
  tick(31 * 86_400_000);
  assert.equal(store.get().halloweenActive, false);
  assert.equal(timers.size, 0);
});

test("förvalt slutdatum: 2 nov 23.59 innevarande år (nästa år om passerat)", () => {
  assert.equal(defaultHalloweenUntil(NU), SLUT);
  assert.equal(defaultHalloweenUntil(new Date(2026, 0, 5).getTime()), SLUT);
  assert.equal(defaultHalloweenUntil(new Date(2026, 10, 3).getTime()), new Date(2027, 10, 2, 23, 59).getTime());
});

test("datetime-local fram och tillbaka", () => {
  assert.equal(toLocalInput(SLUT), "2026-11-02T23:59");
  assert.equal(fromLocalInput("2026-11-02T23:59"), SLUT);
  assert.equal(fromLocalInput(""), null);
  assert.equal(fromLocalInput("trasig"), null);
  assert.equal(toLocalInput(null), "");
});

test("beskrivningen av läget", () => {
  assert.equal(describeSeason(null, NU), "Sommar · Halloween av");
  assert.equal(describeSeason({ season: "host", halloween: true, halloweenUntil: SLUT }, NU), "Höst · Halloween på till 2 nov 23.59");
  assert.equal(describeSeason({ season: "host", halloween: true }, NU), "Höst · Halloween på (inget slutdatum)");
  assert.match(describeSeason({ halloween: true, halloweenUntil: SLUT }, SLUT + 1), /Halloween av \(slutdatumet 2 nov 23.59 har passerat\)/);
});
