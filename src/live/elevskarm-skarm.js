// ============================================================================
// Live – ELEVSKÄRMENS skal (#533): det enda som finns utöver matchen själv.
// Inga lärarkontroller – bara (1) ett startkort "Klicka här för helskärm och
// ljud (eller F11)" som försvinner vid första klicket i fönstret (klicket är
// den användargest som både helskärm och ljud kräver i JUST detta fönster –
// gesten från "Öppna elevskärm" följer inte med), och (2) en diskret ⛶-knapp
// i hörnet som bara syns när musen rör sig (döljs via .lp-idle, projector.js).
//
// API: createScreenChrome(root, { sound }) → { destroy() }
// ============================================================================

export function createScreenChrome(root, { sound }) {
  const card = document.createElement("div");
  card.className = "lp-es-start";
  card.innerHTML = `<div><b>📺 Elevskärm</b>
    <span>Dra fönstret till projektorn och <b>klicka här</b> – helskärm + ljud.</span>
    <small>Eller tryck F11. Styr matchen från ditt andra fönster.</small></div>`;
  const fsBtn = document.createElement("button");
  fsBtn.className = "lp-btn lp-es-fs";
  fsBtn.title = "Helskärm (F11)";
  fsBtn.textContent = "⛶";
  root.append(card, fsBtn);

  const enterFs = () => {
    if (!document.fullscreenElement) root.requestFullscreen?.().catch(() => {});
  };
  // Första klicket var som helst: ljudet låses upp (proj-sound lyssnar själv
  // på gesten) och fönstret går i helskärm.
  const onFirst = () => {
    window.removeEventListener("pointerdown", onFirst, true);
    card.remove();
    sound.unlock();
    enterFs();
  };
  window.addEventListener("pointerdown", onFirst, true);
  fsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else enterFs();
  });

  return {
    destroy() {
      window.removeEventListener("pointerdown", onFirst, true);
      card.remove();
      fsBtn.remove();
    },
  };
}
