// ============================================================================
// Live – ELEVSKÄRMENS KANAL (#533): kontrollpanel ↔ elevskärm i SAMMA webbläsare.
// ----------------------------------------------------------------------------
// Utvidgad skärm: läraren öppnar en elevskärm (eget fönster, #/larare/live?
// id=<sid>&skarm=elev) som dras till projektorn. Matchdata (status, timer,
// poäng) hämtar elevskärmen SJÄLV ur Firestore precis som projektorvyn – över
// kanalen går bara lärarens LOKALA val: aktiv vy, ljud och musik på/av (#593). Kanalen är en
// BroadcastChannel per session ("pp-live-elevskarm:<sid>"), så den når aldrig
// en annan dator – Rasmus projektor påverkas inte av Elias val.
//
// Protokoll (meddelanden { t, ... }):
//   panel → skärm  "state"  { view, sound, music }  vid varje ändring + som svar på hello
//                  "hello"  {}               nyladdad panel: vem är ansluten?
//                  "close"  {}               "Stäng elevskärm" (skärmen stänger sig)
//   skärm → panel  "hello"  { audio, music }  nyöppnad/omladdad skärm: skicka läget
//                  "ping"   { audio, music }  livstecken var PING_MS (audio = ljudet,
//                                            music = musiken upplåst där)
//                  "bye"    {}               fönstret stängs
// Tystnar panelen står skärmen kvar på senaste vy och fortsätter följa matchen.
// Panelen räknar skärmen som ansluten om ett livstecken kommit inom STALE_MS.
//
// API (ren logik; `open` = kanalfabrik, injicerbar för test)
//   createPanelLink(sid, { onChange, open?, now?, poll? })
//     → { publish({ view, sound, music }), connected(), audio(), music(), close(), check(), destroy() }
//     onChange({ connected, audio, music })
//   createScreenLink(sid, { onState, onClose, audio?, music?, open?, poll? })
//     → { ping(), destroy() }
//   screenHash(sid) → "#/larare/live?id=<sid>&skarm=elev"
// ============================================================================

export const PING_MS = 1500;
export const STALE_MS = 4500;

export const channelName = (sid) => `pp-live-elevskarm:${sid}`;
export const screenHash = (sid) => `#/larare/live?id=${encodeURIComponent(sid)}&skarm=elev`;

function defaultOpen(name) {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(name);
}

/** Kontrollpanelen (lärarens laptopfönster). */
export function createPanelLink(sid, { onChange = () => {}, open = defaultOpen, now = Date.now, poll = true } = {}) {
  const ch = open(channelName(sid));
  let last = null; // senast publicerade { view, sound, music }
  let seenAt = 0;
  let audio = false;
  let music = false;
  let was = false;

  const post = (msg) => { try { ch?.postMessage(msg); } catch {} };
  const connected = () => seenAt > 0 && now() - seenAt < STALE_MS;
  function check() {
    const c = connected();
    if (c !== was) { was = c; onChange({ connected: c, audio, music }); }
  }
  function seen(m) {
    seenAt = now();
    const a = !!m.audio;
    const mu = !!m.music;
    const changed = !was || a !== audio || mu !== music;
    audio = a;
    music = mu;
    was = true;
    if (changed) onChange({ connected: true, audio, music });
  }
  if (ch) {
    ch.onmessage = (e) => {
      const m = e.data || {};
      if (m.t === "hello") { seen(m); if (last) post({ t: "state", ...last }); }
      else if (m.t === "ping") seen(m);
      else if (m.t === "bye") { seenAt = 0; check(); }
    };
    post({ t: "hello" });
  }
  const iv = poll && ch ? setInterval(check, 1000) : 0;

  return {
    available: !!ch,
    publish(state) {
      last = { view: state.view, sound: !!state.sound, music: state.music !== false };
      post({ t: "state", ...last });
    },
    connected,
    audio: () => audio,
    music: () => music,
    close() { post({ t: "close" }); seenAt = 0; check(); },
    check,
    destroy() { clearInterval(iv); try { ch?.close(); } catch {} },
  };
}

/** Elevskärmen (projektorfönstret). `audio()`/`music()` = kan ljudet/musiken låta här? */
export function createScreenLink(sid, { onState = () => {}, onClose = () => {}, audio = () => false, music = () => false, open = defaultOpen, poll = true } = {}) {
  const ch = open(channelName(sid));
  const post = (msg) => { try { ch?.postMessage(msg); } catch {} };
  const flags = () => ({ audio: !!audio(), music: !!music() });
  if (ch) {
    ch.onmessage = (e) => {
      const m = e.data || {};
      // music saknas (panel före #593) = på, standardläget.
      if (m.t === "state") onState({ view: m.view, sound: !!m.sound, music: m.music !== false });
      else if (m.t === "hello") post({ t: "ping", ...flags() });
      else if (m.t === "close") onClose();
    };
    post({ t: "hello", ...flags() });
  }
  const ping = () => post({ t: "ping", ...flags() });
  const iv = poll && ch ? setInterval(ping, PING_MS) : 0;
  return {
    available: !!ch,
    ping,
    destroy() { clearInterval(iv); post({ t: "bye" }); try { ch?.close(); } catch {} },
  };
}
