// Live i elevens sidomeny (#460, #824): "Live pågår!" syns bara när klassen har
// en lobby eller en match vars klocka går – borta vid 00:00 och när status blir
// finished, för alla format (src/live/live-watch.js), och ligger inte kvar för
// att eleven står kvar på slutskärmen i #/elev/live (src/ui.js villkorSynlig).
// live-watch.js och ui.js laddas med Firebase-stubben (ingen emulator, inget nät).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";

let W, villkorSynlig;
before(async () => {
  installeraFirebaseStubbe();
  // ui.js läser några element vid import – en minimal låtsas-DOM räcker.
  globalThis.document ??= {
    getElementById: () => null,
    body: { classList: { contains: () => false, toggle() {} } },
  };
  globalThis.window ??= { location: { hash: "" }, addEventListener() {} };
  W = await import("../src/live/live-watch.js");
  ({ villkorSynlig } = await import("../src/ui.js"));
});

const T = 1_700_000_000_000;
const MIN = 60_000;
// Startad vid T, 3 s nedräkning, 10 min matchklocka → 00:00 vid T + 3 s + 10 min.
const SLUT = T + 3000 + 10 * MIN;
const s = (over = {}) => ({
  id: "s1", format: "meteorstorm", status: "live", participatingClassIds: ["4b"],
  startedAt: T, countdownSeconds: 3, durationSeconds: 600, ...over,
});

describe("live-watch: bannerSessions (menyns Live pågår!)", () => {
  it("lobby och pågående match syns för elevens klass, inte för andra klasser", () => {
    assert.equal(W.bannerSessions([s({ status: "lobby", startedAt: null })], ["4b"], T).length, 1);
    assert.equal(W.bannerSessions([s()], ["4b"], T + MIN).length, 1);
    assert.equal(W.bannerSessions([s()], ["5e"], T + MIN).length, 0);
  });
  it("borta vid 00:00 (fas ended) – sidan behåller sin marginal", () => {
    assert.equal(W.bannerSessions([s()], ["4b"], SLUT - 1).length, 1);
    assert.equal(W.bannerSessions([s()], ["4b"], SLUT).length, 0);
    assert.equal(W.relevantSessions([s()], ["4b"], SLUT + MIN).length, 1, "#/elev/live hittar matchen 2 min till");
    assert.equal(W.relevantSessions([s()], ["4b"], SLUT + 2 * MIN).length, 0);
  });
  it("finished/cancelled syns aldrig, oavsett format och klocka", () => {
    for (const format of ["klassmatch", "snilleblixt", "guldrush", "datakuppen", "meteorstorm"]) {
      assert.equal(W.bannerSessions([s({ format, status: "finished" })], ["4b"], T + MIN).length, 0, format);
      assert.equal(W.bannerSessions([s({ format, status: "cancelled" })], ["4b"], T + MIN).length, 0, format);
    }
  });
  it("lärarstyrt format utan matchklocka: syns tills läraren avslutar", () => {
    const k = s({ format: "klassmatch", durationSeconds: 0 });
    assert.equal(W.bannerSessions([k], ["4b"], T + 60 * MIN).length, 1);
    assert.equal(W.bannerSessions([{ ...k, status: "finished" }], ["4b"], T + 60 * MIN).length, 0);
  });
  it("msTillNastaSlut: närmaste 00:00 i framtiden (menyn ritas om precis då)", () => {
    const b = s({ id: "s2", startedAt: T + MIN });
    assert.equal(W.msTillNastaSlut([s(), b], T + MIN), SLUT - (T + MIN));
    assert.equal(W.msTillNastaSlut([s()], SLUT), null);
    assert.equal(W.msTillNastaSlut([s({ status: "lobby", startedAt: null })], T), null);
  });
});

describe("ui.js villkorSynlig – villkorade menylänkar", () => {
  const LIVE = { hash: "#/elev/live", grupp: "live", villkor: "live" };
  const PROV = { hash: "#/elev/prov", grupp: "prov", villkor: "prov" };
  it("villkoret sant → syns; länk utan villkor syns alltid", () => {
    assert.equal(villkorSynlig(LIVE, { live: true }, "/elev/hus"), true);
    assert.equal(villkorSynlig({ hash: "#/elev/hus" }, {}, "/elev/hus"), true);
  });
  it("Live-rutan försvinner när matchen är slut även om eleven står kvar i #/elev/live", () => {
    assert.equal(villkorSynlig(LIVE, { live: false }, "/elev/live"), false);
    assert.equal(villkorSynlig(LIVE, { live: false }, "/elev/hus"), false);
  });
  it("övriga villkorade länkar ligger kvar på sin egen sida (oförändrat)", () => {
    assert.equal(villkorSynlig(PROV, { prov: false }, "/elev/prov"), true);
    assert.equal(villkorSynlig(PROV, { prov: false }, "/elev/hus"), false);
  });
});
