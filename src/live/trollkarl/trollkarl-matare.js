// ============================================================================
// Trollkarlsduellen (#536): MAGIMÄTAREN (spec §7.1/7.2) – lysande energivätska
// som fylls mjukt (transform scaleX + transition), bubblor, gnistor som flyger
// upp vid nya rätt, extra glöd nära full och en kraftig blixt när den slår
// över (attack). Rasmus = eld/orange, Elias = is/blått (CSS via data-who).
// Mätaren visar magipoäng (rätt % 100) – ALDRIG matchpoäng.
//
// API: createMeter(host, { who, side }) → {
//   update(magicState, threshold?) – { meter, fraction, attacks, near } ur trollkarl-magi.js
//   setWho(who), burst() – "full!"-blixten, destroy()
// }
// ============================================================================

const MAX_SPARKS = 14;

export function createMeter(host, { who, side }) {
  const el = document.createElement("div");
  el.className = `tkm tkm-${side}`;
  el.dataset.who = who;
  el.innerHTML = `
    <div class="tkm-top"><span class="tkm-label">✨ MAGI</span><b class="tkm-count">0 / 100</b><span class="tkm-attacks" title="Utförda attacker">⚡ 0</span></div>
    <div class="tkm-tube">
      <div class="tkm-fill"><i class="tkm-shine"></i><span class="tkm-bubbles">${"<i></i>".repeat(7)}</span></div>
      <div class="tkm-ticks">${"<i></i>".repeat(9)}</div>
      <div class="tkm-sparks"></div>
    </div>`;
  host.appendChild(el);
  const fill = el.querySelector(".tkm-fill");
  const count = el.querySelector(".tkm-count");
  const attacks = el.querySelector(".tkm-attacks");
  const sparks = el.querySelector(".tkm-sparks");
  let last = null;
  let burstT = 0;
  let wrapT = 0;
  let target = 0;

  function spark(fraction) {
    if (sparks.childElementCount >= MAX_SPARKS) return;
    const s = document.createElement("i");
    const at = Math.max(2, Math.min(98, fraction * 100 - Math.random() * 6));
    s.style.left = `${side === "right" ? 100 - at : at}%`;
    s.style.setProperty("--dx", `${(Math.random() - 0.5) * 40}px`);
    sparks.appendChild(s);
    s.addEventListener("animationend", () => s.remove(), { once: true });
    setTimeout(() => s.remove(), 1500);
  }

  function burst() {
    el.classList.remove("tkm-burst");
    void el.offsetWidth;
    el.classList.add("tkm-burst");
    clearTimeout(burstT);
    burstT = setTimeout(() => el.classList.remove("tkm-burst"), 1600);
  }

  function update(m, threshold = 100) {
    if (!m) return;
    target = m.fraction;
    if (last && m.attacks > last.attacks) {
      // Slog över: fyll hela vägen, blixt, börja om från 0 (aldrig "dränera" baklänges).
      clearTimeout(wrapT);
      fill.style.transform = "scaleX(1)";
      burst();
      wrapT = setTimeout(() => {
        wrapT = 0;
        fill.style.transition = "none";
        fill.style.transform = "scaleX(0)";
        void fill.offsetWidth;
        fill.style.transition = "";
        fill.style.transform = `scaleX(${target})`;
      }, 650);
    } else if (!wrapT) fill.style.transform = `scaleX(${target})`;
    el.style.setProperty("--f", m.fraction.toFixed(3));
    el.classList.toggle("tkm-near", m.near);
    count.textContent = `${m.meter} / ${threshold}`;
    attacks.textContent = `⚡ ${m.attacks}`;
    if (last && (m.correct > last.correct)) {
      const n = Math.min(3, m.correct - last.correct);
      for (let i = 0; i < n; i++) spark(m.fraction);
    }
    last = m;
  }

  return {
    update,
    burst,
    setWho(w) { el.dataset.who = w; },
    destroy() { clearTimeout(burstT); clearTimeout(wrapT); el.remove(); },
  };
}
