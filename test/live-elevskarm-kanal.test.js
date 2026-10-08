// Live – elevskärmens kanal (#533): protokollet kontrollpanel ↔ elevskärm.
import test from "node:test";
import assert from "node:assert/strict";
import {
  createPanelLink, createScreenLink, channelName, screenHash, STALE_MS,
} from "../src/live/elevskarm-kanal.js";

// Synkron låtsas-BroadcastChannel: postMessage når alla ANDRA med samma namn.
function hub() {
  const all = [];
  const open = (name) => {
    const ch = {
      name, onmessage: null, closed: false,
      postMessage(data) {
        if (ch.closed) throw new Error("stängd");
        for (const o of all) if (o !== ch && o.name === name && !o.closed) o.onmessage?.({ data: structuredClone(data) });
      },
      close() { ch.closed = true; },
    };
    all.push(ch);
    return ch;
  };
  return { open, all };
}

test("kanalnamn och elevskärmens hash är per session", () => {
  assert.equal(channelName("abc"), "pp-live-elevskarm:abc");
  assert.equal(screenHash("a b"), "#/larare/live?id=a%20b&skarm=elev");
});

test("nyöppnad elevskärm får panelens aktuella vy och ljud direkt (hello → state)", () => {
  const h = hub();
  const panel = createPanelLink("s1", { open: h.open, poll: false });
  panel.publish({ view: "statistik", sound: true });
  const got = [];
  createScreenLink("s1", { open: h.open, poll: false, onState: (s) => got.push(s) });
  assert.deepEqual(got, [{ view: "statistik", sound: true }]);
  assert.equal(panel.connected(), true);
});

test("vybyte ×3 och ljud av följer med till elevskärmen i ordning", () => {
  const h = hub();
  const panel = createPanelLink("s1", { open: h.open, poll: false });
  const got = [];
  createScreenLink("s1", { open: h.open, poll: false, onState: (s) => got.push(s.view + (s.sound ? "+" : "-")) });
  panel.publish({ view: "raket", sound: true });
  panel.publish({ view: "statistik", sound: true });
  panel.publish({ view: "dragkamp", sound: false });
  assert.deepEqual(got, ["raket+", "statistik+", "dragkamp-"]);
});

test("en annan sessions elevskärm påverkas inte", () => {
  const h = hub();
  const panel = createPanelLink("s1", { open: h.open, poll: false });
  const other = [];
  createScreenLink("s2", { open: h.open, poll: false, onState: (s) => other.push(s) });
  panel.publish({ view: "statistik", sound: true });
  assert.deepEqual(other, []);
  assert.equal(panel.connected(), false);
});

test("närvaro: ansluten via livstecken, borta efter STALE_MS eller bye", () => {
  const h = hub();
  let t = 1000;
  const changes = [];
  const panel = createPanelLink("s1", { open: h.open, poll: false, now: () => t, onChange: (i) => changes.push(i) });
  let audio = false;
  const screen = createScreenLink("s1", { open: h.open, poll: false, audio: () => audio });
  assert.deepEqual(changes.at(-1), { connected: true, audio: false });
  audio = true;
  screen.ping();
  assert.deepEqual(changes.at(-1), { connected: true, audio: true });
  t += STALE_MS + 1;
  panel.check();
  assert.equal(panel.connected(), false);
  assert.equal(changes.at(-1).connected, false);
  screen.ping();
  assert.equal(panel.connected(), true);
  screen.destroy();
  assert.equal(panel.connected(), false);
  assert.equal(changes.at(-1).connected, false);
});

test("omladdad panel hittar en redan öppen elevskärm (panelens hello → ping)", () => {
  const h = hub();
  createScreenLink("s1", { open: h.open, poll: false, audio: () => true });
  const changes = [];
  const panel = createPanelLink("s1", { open: h.open, poll: false, onChange: (i) => changes.push(i) });
  assert.equal(panel.connected(), true);
  assert.deepEqual(changes, [{ connected: true, audio: true }]);
});

test("omladdad elevskärm återansluter och får senaste läget igen", () => {
  const h = hub();
  const panel = createPanelLink("s1", { open: h.open, poll: false });
  const first = createScreenLink("s1", { open: h.open, poll: false });
  panel.publish({ view: "dragkamp", sound: false });
  first.destroy(); // omladdning
  const got = [];
  createScreenLink("s1", { open: h.open, poll: false, onState: (s) => got.push(s) });
  assert.deepEqual(got, [{ view: "dragkamp", sound: false }]);
});

test("Stäng elevskärm: skärmen får close", () => {
  const h = hub();
  const panel = createPanelLink("s1", { open: h.open, poll: false });
  let closed = 0;
  createScreenLink("s1", { open: h.open, poll: false, onClose: () => closed++ });
  panel.close();
  assert.equal(closed, 1);
  assert.equal(panel.connected(), false);
});

test("utan BroadcastChannel: inga fel, available = false", () => {
  const panel = createPanelLink("s1", { open: () => null, poll: false });
  const screen = createScreenLink("s1", { open: () => null, poll: false });
  assert.equal(panel.available, false);
  assert.equal(screen.available, false);
  panel.publish({ view: "raket", sound: true });
  screen.ping();
  panel.destroy();
  screen.destroy();
});

test("riktig BroadcastChannel (Node) bär protokollet", { skip: typeof BroadcastChannel === "undefined" }, async () => {
  const panel = createPanelLink("real", { poll: false });
  panel.publish({ view: "statistik", sound: true });
  const got = await new Promise((resolve) => {
    const screen = createScreenLink("real", { poll: false, onState: (s) => { screen.destroy(); resolve(s); } });
  });
  panel.destroy();
  assert.deepEqual(got, { view: "statistik", sound: true });
});
