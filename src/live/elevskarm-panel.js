// ============================================================================
// Live – elevskärmen i KONTROLLPANELEN (#533): "📺 Öppna elevskärm", status
// "Elevskärm ansluten ✓" / "Ingen elevskärm" och "Stäng elevskärm" i
// projektorvyns verktygsrad. Utan öppnad elevskärm är projektorvyn exakt som
// förut (duplicerad skärm). Kanalen: elevskarm-kanal.js.
//
// API: createScreenControl(host, { sid, state, say, onConnect, link? })
//        → { publish(), connected(), destroy() }
//   state()      lärarens lokala val { view, sound } att skicka ut
//   onConnect({ connected, audio }) elevskärmen kom/försvann eller fick ljud
//                (projektorn tystar sitt eget ljud när skärmen kan spela det)
// ============================================================================

import { createPanelLink, screenHash } from "./elevskarm-kanal.js";

export function createScreenControl(host, { sid, state, say, onConnect = () => {}, link }) {
  const box = document.createElement("div");
  box.className = "lp-es";
  box.innerHTML = `
    <span class="lp-es-status" data-es-status role="status"></span>
    <button class="lp-btn" data-es-open>📺 Öppna elevskärm</button>
    <button class="lp-btn" data-es-close hidden>Stäng elevskärm</button>`;
  host.replaceChildren(box);
  const $ = (s) => box.querySelector(s);
  let win = null;
  let info = { connected: false, audio: false };

  const lk = link || createPanelLink(sid, { onChange: (i) => { info = i; render(); onConnect(i); } });
  if (!lk.available) { box.hidden = true; return { publish() {}, connected: () => false, destroy() {} }; }

  function render() {
    const s = $("[data-es-status]");
    s.textContent = info.connected
      ? `📺 Elevskärm ansluten ✓${state().sound && !info.audio ? " – klicka en gång på elevskärmen för ljud" : ""}`
      : "Ingen elevskärm";
    s.classList.toggle("on", info.connected);
    $("[data-es-open]").hidden = info.connected;
    $("[data-es-close]").hidden = !info.connected;
  }

  $("[data-es-open]").addEventListener("click", () => {
    if (win && !win.closed) { win.focus(); return; }
    const url = `${location.origin}${location.pathname}${location.search}${screenHash(sid)}`;
    // Måste ske direkt i klicket (popup-blockerare). Eget namn per session:
    // ett andra klick återanvänder samma fönster i stället för att öppna fler.
    win = window.open(url, `pp-elevskarm-${sid}`, "popup=yes,width=1280,height=760");
    if (!win) say("Webbläsaren blockerade fönstret – tillåt popup-fönster för sidan och klicka igen.");
    else say("");
  });
  $("[data-es-close]").addEventListener("click", () => {
    lk.close();
    try { win?.close(); } catch {}
    win = null;
  });

  render();
  return {
    publish() { lk.publish(state()); render(); },
    connected: () => lk.connected(),
    destroy: () => lk.destroy(),
  };
}
