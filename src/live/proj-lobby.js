// ============================================================================
// Live-projektorn: LOBBYN (#461) – "MATTEMATCH LIVE · 4B VS 5E", "N elever
// redo" per klass (live), matchtid, "Väntar på start" och den stora STARTA
// MATCH-knappen i SAMMA vy (läraren speglar sin skärm till projektorn).
// Mynt-pris (#526): "🪙 Vinnarklassen får 1 000 mynt till klasskassan!".
// Vilken lärare som helst som öppnat sessionen kan starta – startLiveSession
// är en transaktion, så två samtidiga tryck startar inte om klockan.
//
// Trollkarlsduellen (#536): i tvåklassmatcher visas vem som är Rasmus/Elias
// och läraren kan byta (bara i lobbyn – sparas i sessionen, wizards).
//
// API: createLobby(host, { st, colors, modeName, actions, say, readonly })
//        → { update(st), destroy() }
//   actions: { start(), cancel(), setDivisor(classId, n), setWizards?(map) } (Promise)
//   readonly: elevskärmen (#533) – inga knappar/nämnarfält, bara det eleverna ser
// ============================================================================

import { esc } from "../teacher-shared.js";
import { prizeText } from "./live-core.js";
import { resolveWizards, swapWizards, WIZARD_NAMES } from "./trollkarl/trollkarl-val.js";

const MAX_DOTS = 40;

export function createLobby(host, { st, colors, modeName, actions, say, readonly = false }) {
  const s = st.session;
  const duel = st.classes.length === 2;
  let session = s;
  const names = st.classes.map((c) => `<span style="color:${colors[c.classId]}">${esc(c.name)}</span>`);
  const root = document.createElement("div");
  root.className = "lpl";
  root.innerHTML = `
    <div class="lpl-badge">⚡ MATTEMATCH LIVE</div>
    <h1 class="lpl-title">${names.join(`<i class="lpl-vs">VS</i>`)}</h1>
    <div class="lpl-sub">${esc(s.name)} · ${esc(modeName)}</div>
    ${prizeText(s) ? `<div class="lp-prize">🪙 ${esc(prizeText(s))}</div>` : ""}
    <div class="lpl-cards">${st.classes.map((c) => `
      <div class="lpl-card" style="--c:${colors[c.classId]}" data-cid="${esc(c.classId)}">
        <div class="lpl-cname">${esc(c.name)}</div>
        <div class="lpl-ready"><b data-ready>0</b><span>elever redo</span></div>
        <div class="lpl-dots" data-dots aria-hidden="true"></div>
        ${readonly ? "" : `<label class="lpl-div" title="Poängen räknas som rätt svar ÷ nämnaren">Nämnare
          <input type="number" min="1" max="999" value="${c.divisor}" data-div /></label>`}
      </div>`).join("")}
    </div>
    ${duel ? `<div class="lpl-tk">🧙 <span>Trollkarlsduellen:</span> <b data-tk></b>
      ${readonly || !actions?.setWizards ? "" : `<button class="lp-btn" data-tk-swap title="Byt vilken klass som är Rasmus och Elias">⇄ Byt trollkarlar</button>`}</div>` : ""}
    <div class="lpl-meta">
      <span class="lpl-len">⏱ Matchtid: <b>${Math.round((s.durationSeconds || 0) / 60)} min</b></span>
      <span class="lpl-status"><i class="lpl-pulse"></i>Väntar på start</span>
    </div>
    ${readonly ? "" : `<button class="lpl-start" data-start>▶ STARTA MATCH</button>`}
    <div class="lpl-foot">
      <span>Eleverna går in via <b>Live</b> i menyn och väntar i lobbyn.</span>
      ${readonly ? "" : `<button class="lp-link" data-cancel>Avbryt matchen</button>`}
    </div>`;
  host.replaceChildren(root);
  if (!readonly) wireControls(root, { actions, say });
  const tkText = root.querySelector("[data-tk]");
  const swapBtn = root.querySelector("[data-tk-swap]");
  swapBtn?.addEventListener("click", () => {
    const map = resolveWizards(session);
    if (!map) return;
    swapBtn.disabled = true;
    actions.setWizards(swapWizards(map)).then(() => say(""))
      .catch((err) => say(`Kunde inte byta trollkarlar: ${err.message}`))
      .finally(() => { swapBtn.disabled = false; });
  });
  function drawWizards() {
    if (!tkText) return;
    const map = resolveWizards(session) || {};
    tkText.innerHTML = st.classes.map((c) =>
      `<span style="color:${colors[c.classId]}">${esc(c.name)}</span> = ${WIZARD_NAMES[map[c.classId]] || "?"}`).join(" · ");
  }

  const cards = new Map();
  root.querySelectorAll("[data-cid]").forEach((card) => cards.set(card.dataset.cid, {
    ready: card.querySelector("[data-ready]"),
    dots: card.querySelector("[data-dots]"),
    div: card.querySelector("[data-div]"),
    last: -1,
    lastDiv: -1,
  }));

  function update(next) {
    if (next.session && next.session !== session) {
      session = next.session;
      drawWizards();
    }
    for (const c of next.classes) {
      const ui = cards.get(c.classId);
      if (!ui) continue;
      if (c.ready !== ui.last || c.divisor !== ui.lastDiv) {
        if (c.ready > ui.last && ui.last >= 0) {
          ui.ready.classList.remove("pop");
          void ui.ready.offsetWidth; // starta om animationen
          ui.ready.classList.add("pop");
        }
        ui.ready.textContent = c.ready;
        // En prick per förväntad elev (nämnaren) – fylls när eleverna går in.
        const total = Math.min(MAX_DOTS, Math.max(c.divisor, c.ready));
        const filled = Math.min(total, c.ready);
        ui.dots.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < filled ? "on" : ""}"></i>`).join("");
        ui.last = c.ready;
      }
      // Nämnaren ändrad av en annan lärare – skriv inte över medan någon skriver här.
      if (ui.div && c.divisor !== ui.lastDiv && document.activeElement !== ui.div) ui.div.value = c.divisor;
      ui.lastDiv = c.divisor;
    }
  }

  drawWizards();
  update(st);
  return { update, destroy() {} };
}

function wireControls(root, { actions, say }) {
  const startBtn = root.querySelector("[data-start]");
  startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    startBtn.textContent = "Startar…";
    try {
      await actions.start();
    } catch (err) {
      say(`Kunde inte starta: ${err.message}`);
      startBtn.disabled = false;
      startBtn.textContent = "▶ STARTA MATCH";
    }
  });
  root.querySelector("[data-cancel]").addEventListener("click", () => {
    if (confirm("Avbryta matchen? Eleverna i lobbyn får se att den avbröts.")) actions.cancel().catch((err) => say(err.message));
  });
  root.querySelectorAll("[data-div]").forEach((inp) => {
    const cid = inp.closest("[data-cid]").dataset.cid;
    inp.addEventListener("change", () => {
      actions.setDivisor(cid, inp.value).then(() => say("")).catch((err) => say(err.message));
    });
  });
}
