// ============================================================================
// Snilleblixten – TV-studion (#559): LOBBYN (designspec §5.2). Stor
// SNILLEBLIXTEN-logga med blixten, klassnamnet och "Väntar på start …".
// Varje elev som ansluter studsar in i publiken som sin avatar (med kläder,
// klassprojektionen – EN läsning per klass, delad med spelvyerna) med namnet
// under och ett litet "pling"; en strålkastare riktas kort mot den nya
// eleven. "24 elever i studion". Stor STARTA → skalets 3–2–1–KÖR!.
// Elevskärmen (#533, readonly): inga knappar.
//
// API: createLobby(host, { st, modeName, actions, say, readonly, sound?, deps? })
//        → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { createLiveRegi } from "../../design/live-regi.js";
import { sessionRewards, placementPrize } from "../../live-rewards.js";
import { avatarRoster } from "./sb-koppling.js";
import { ensureStudioCss, miljoHtml, logoHtml } from "./sb-miljo.js";
import { createPublik } from "./sb-publik.js";

const KIND = { choice: "🔘 Flerval", free: "✍️ Skriv själv" };

/** "Pluggmynt: 1:a 100 · 2:a 85 · 3:e 72 + mynt för varje rätt svar" */
function prisText(rw) {
  const delar = [];
  if (rw.firstPrize) delar.push([1, 2, 3].map((p) => `${p}:${p < 3 ? "a" : "e"} ${placementPrize(rw.firstPrize, p)}`).join(" · "));
  if (rw.perCorrect) delar.push("mynt för varje rätt svar");
  return `Pluggmynt efter matchen: ${delar.join(" + ")}`;
}

export function createLobby(host, { st, modeName = "", actions = {}, say = () => {}, readonly = false, sound = null, deps = null }) {
  ensureStudioCss();
  const s = st.session;
  const sid = st.sessionId || s.id;
  const klass = (s.participatingClassIds || []).map((id) => s.classNames?.[id] || id).join(" + ");
  const rw = sessionRewards(s);
  const root = document.createElement("div");
  root.className = "sb sb-lobby";
  root.dataset.scene = "lobby";
  root.innerHTML = `${miljoHtml()}
    <div class="sbl">
      ${logoHtml({ size: "stor" })}
      <h1 class="sbl-klass">${esc(klass)}</h1>
      <div class="sbl-meta">${esc(modeName)} · ${esc(KIND[s.answerKind] || "")} · ${Number(s.questionCount) || 0} frågor · ${Number(s.questionSeconds) || 0} s per fråga</div>
      ${rw ? `<div class="sbl-pris">🪙 ${esc(prisText(rw))}</div>` : ""}
      <div class="sbl-rad">
        <div class="sbl-antal"><b data-n>0</b> <span data-ord>elever i studion</span></div>
        <div class="sbl-vantar"><i class="sbl-puls"></i>Väntar på start …</div>
      </div>
      ${readonly ? "" : `<button class="sbl-start" data-start>⚡ STARTA</button>
      <div class="sbl-fot">
        <span>Eleverna går in via <b>Live</b> i menyn.</span>
        <button class="lp-link" data-cancel>Avbryt</button>
        ${actions.remove ? `<button class="lp-link" data-remove>Radera</button>` : ""}
      </div>`}
    </div>
    <footer class="sb-fot"></footer>`;
  host.replaceChildren(root);

  const roster = avatarRoster(sid, deps);
  roster.prefetch(s.participatingClassIds || []);
  const pool = createAvatarPool({ roster });
  const publik = createPublik(root.querySelector(".sb-fot"), { pool });
  // Ankomst: studs + damm (reaktionen) + pling (ljudkön) + strålkastare.
  const regi = createLiveRegi({
    sessionId: `${sid}:lobby`,
    pool,
    sound,
    map(evt) {
      if (evt.type !== "join") return [];
      requestAnimationFrame(() => publik.spot(evt.uid));
      return [{ kind: "reaction", uid: evt.uid, reaction: "ankomst", cue: "pling" }];
    },
  });

  function wire() {
    const start = root.querySelector("[data-start]");
    start?.addEventListener("click", async () => {
      start.disabled = true;
      start.textContent = "Startar …";
      try {
        await actions.start?.();
      } catch (e) {
        say(e?.message || String(e));
        start.disabled = false;
        start.textContent = "⚡ STARTA";
      }
    });
    root.querySelector("[data-cancel]")?.addEventListener("click", () => {
      if (confirm("Avbryta Snilleblixten? Den sparas som avbruten.")) actions.cancel?.().catch((e) => say(e.message));
    });
    root.querySelector("[data-remove]")?.addEventListener("click", () => {
      if (confirm("Radera Snilleblixten helt? Den har inte startat.")) actions.remove?.().catch((e) => say(e.message));
    });
  }
  wire();

  function update(next) {
    const players = next.players || [];
    roster.ensure(players);
    publik.update(players);
    regi.sync({ phase: "lobby", players: players.map((p) => ({ uid: p.uid, name: p.name })) });
    const n = players.length;
    root.querySelector("[data-n]").textContent = String(n);
    root.querySelector("[data-ord]").textContent = n === 1 ? "elev i studion" : "elever i studion";
  }
  update(st);

  return {
    update,
    destroy() {
      regi.destroy();
      pool.destroy();
      root.remove();
    },
  };
}
