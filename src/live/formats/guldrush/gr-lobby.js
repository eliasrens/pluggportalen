// ============================================================================
// Guldrushen – Skattkammaren (#565): LOBBYN (designspec §6.2). Stor
// GULDRUSHEN-logga med guldkistan, klassnamnet, inställningarna och
// pluggmyntpriset. Varje elev som ansluter studsar in som sin avatar (med
// kläder, klassprojektionen – EN läsning per klass, delad med spelvyerna) och
// ställer sig vid grottans ingång, med ett litet "pling". "24 skattjägare
// redo". Stor STARTA → skalets 3–2–1–KÖR!. Elevskärmen (#533, readonly):
// inga knappar.
//
// API: createLobby(host, { st, modeName, actions, say, readonly, sound?, deps? })
//        → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { createLiveRegi } from "../../design/live-regi.js";
import { sessionRewards, placementPrize } from "../../live-rewards.js";
import { avatarRoster } from "./gr-koppling.js";
import { ensureGrottaCss, grottaHtml, logoHtml } from "./gr-grotta.js";
import { classTitle } from "./gr-proj-scen.js";

const KIND = { choice: "🔘 Flerval", free: "✍️ Skriv själv" };

function prisText(rw) {
  const delar = [];
  if (rw.firstPrize) delar.push([1, 2, 3].map((p) => `${p}:${p < 3 ? "a" : "e"} ${placementPrize(rw.firstPrize, p)}`).join(" · "));
  if (rw.perCorrect) delar.push("mynt för varje rätt svar");
  return `Pluggmynt efter matchen: ${delar.join(" + ")}`;
}

/** Figurstorlek efter antalet (alla ryms ovanför nederkanten, designtest 4). */
function figSize(n) {
  return n <= 12 ? "clamp(48px, 9vh, 110px)" : n <= 24 ? "clamp(42px, 7.6vh, 90px)" : "clamp(36px, 6.6vh, 78px)";
}

export function createLobby(host, { st, modeName = "", actions = {}, say = () => {}, readonly = false, sound = null, deps = null }) {
  ensureGrottaCss();
  const s = st.session;
  const sid = st.sessionId || s.id;
  const rw = sessionRewards(s);
  const min = Math.round((Number(s.durationSeconds) || 0) / 60);
  const root = document.createElement("div");
  root.className = "gr gr-lobby";
  root.innerHTML = `${grottaHtml({ variant: "lobby" })}
    <div class="grlb">
      ${logoHtml({ size: "stor" })}
      <h1 class="grlb-klass">${esc(classTitle(s))}</h1>
      <div class="grlb-meta">${esc(modeName)} · ${esc(KIND[s.answerKind] || "")}${min ? ` · ⏱ ${min} min` : ""} · ${s.stealSwap === false ? "💰 bara guld" : "🦝 stöld och byte"}</div>
      ${rw ? `<div class="grlb-pris">🪙 ${esc(prisText(rw))}</div>` : ""}
      <div class="grlb-rad">
        <div class="grlb-antal"><b data-n>0</b> <span>skattjägare redo</span></div>
        <div class="grlb-vantar"><i class="grlb-puls"></i>Väntar på start …</div>
      </div>
      ${readonly ? "" : `<button class="grlb-start" data-start>⛏️ STARTA</button>
      <div class="grlb-fot">
        <span>Eleverna går in via <b>Live</b> i menyn.</span>
        <button class="lp-link" data-cancel>Avbryt</button>
        ${actions.remove ? `<button class="lp-link" data-remove>Radera</button>` : ""}
      </div>`}
    </div>
    <div class="grlb-folk"></div>`;
  host.replaceChildren(root);
  const folk = root.querySelector(".grlb-folk");

  const roster = avatarRoster(sid, deps);
  roster.prefetch(s.participatingClassIds || []);
  const pool = createAvatarPool({ roster });
  const seats = new Map(); // uid → { el, name }
  // Ankomst: studs + damm (reaktionen) + pling (ljudkön).
  const regi = createLiveRegi({
    sessionId: `${sid}:lobby`,
    pool,
    sound,
    map(evt) {
      return evt.type === "join" ? [{ kind: "reaction", uid: evt.uid, reaction: "ankomst", cue: "pling" }] : [];
    },
  });

  const start = root.querySelector("[data-start]");
  start?.addEventListener("click", async () => {
    start.disabled = true;
    start.textContent = "Startar …";
    try {
      await actions.start?.();
    } catch (e) {
      say(e?.message || String(e));
      start.disabled = false;
      start.textContent = "⛏️ STARTA";
    }
  });
  root.querySelector("[data-cancel]")?.addEventListener("click", () => {
    if (confirm("Avbryta Guldrushen? Den sparas som avbruten.")) actions.cancel?.().catch((e) => say(e.message));
  });
  root.querySelector("[data-remove]")?.addEventListener("click", () => {
    if (confirm("Radera Guldrushen helt? Den har inte startat.")) actions.remove?.().catch((e) => say(e.message));
  });

  function seat(p) {
    const s1 = seats.get(p.uid);
    if (s1) {
      if (p.name && p.name !== s1.name) {
        s1.name = p.name;
        s1.el.querySelector(".grlb-namn").textContent = p.name;
      }
      return;
    }
    const el = document.createElement("div");
    el.className = "grlb-plats";
    const av = pool.el(p.uid);
    av.classList.add("vantar");
    el.append(av);
    el.insertAdjacentHTML("beforeend", `<span class="grlb-namn">${esc(p.name || "")}</span>`);
    folk.appendChild(el);
    seats.set(p.uid, { el, name: p.name || "" });
  }

  function update(next) {
    const players = next.players || [];
    roster.ensure(players);
    players.forEach(seat);
    folk.style.setProperty("--grlb-fig", figSize(seats.size));
    regi.sync({ phase: "lobby", players: players.map((p) => ({ uid: p.uid, name: p.name })) });
    root.querySelector("[data-n]").textContent = String(players.length);
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
