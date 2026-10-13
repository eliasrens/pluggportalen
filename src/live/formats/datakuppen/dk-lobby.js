// ============================================================================
// Datakuppen – Nätverket (#654, spec §4.4): LOBBYN. Stor DATAKUPPEN-logga med
// roboten, klassnamnet, inställningarna och pluggmyntpriset. Eleverna
// "loggar in" i nätverket: varje elev som ansluter dyker upp som sin avatar
// vid en egen NOD (en lysande ring på en kretsbana) med "> namn" i
// monospace. "24 inloggade". Ett SÄKERHETSTIPS roterar (tipAt, byts var
// 9:e sekund, tonar mjukt). Lobbyn är TYST: inga ljud vid inloggning och
// ingen musik (format.music lobby: 0). Stor STARTA → skalets 3–2–1–KÖR!.
// Elevskärmen (#533, readonly): inga knappar.
//
// API: createLobby(host, { st, modeName, actions, say, readonly, deps? })
//        → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { coinIcon } from "../../../icons.js";
import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { createLiveRegi } from "../../design/live-regi.js";
import { sessionRewards, placementPrize } from "../../live-rewards.js";
import { avatarRoster } from "./dk-koppling.js";
import { ensureNatverkCss, natverkHtml, logoHtml, createDekorVakt } from "./dk-natverk.js";
import { classTitle, tipAt } from "./dk-proj-scen.js";

const KIND = { choice: "🔘 Flerval", free: "✍️ Skriv själv" };

function prisText(rw) {
  const delar = [];
  if (rw.firstPrize) delar.push([1, 2, 3].map((p) => `${p}:${p < 3 ? "a" : "e"} ${placementPrize(rw.firstPrize, p)}`).join(" · "));
  if (rw.perCorrect) delar.push("mynt för varje rätt svar");
  return `Pluggmynt efter matchen: ${delar.join(" + ")}`;
}

/** Figurstorlek efter antalet (alla ryms ovanför nederkanten). */
function figSize(n) {
  return n <= 12 ? "clamp(46px, 8.4vh, 104px)" : n <= 24 ? "clamp(40px, 7vh, 86px)" : "clamp(34px, 6.1vh, 74px)";
}

export function createLobby(host, { st, modeName = "", actions = {}, say = () => {}, readonly = false, deps = null }) {
  ensureNatverkCss();
  const s = st.session;
  const sid = st.sessionId || s.id;
  const rw = sessionRewards(s);
  const min = Math.round((Number(s.durationSeconds) || 0) / 60);
  const root = document.createElement("div");
  root.className = "dkn dknl";
  root.innerHTML = `${natverkHtml({ variant: "lobby" })}
    <div class="dknl-mitt">
      ${logoHtml({ size: "stor" })}
      <h1 class="dknl-klass">${esc(classTitle(s))}</h1>
      <div class="dknl-meta">${esc(modeName)} · ${esc(KIND[s.answerKind] || "")}${min ? ` · ⏱ ${min} min` : ""} · ${s.hacking === false ? "💾 bara data" : "💻 hackning på"}</div>
      ${rw ? `<div class="dknl-pris">${coinIcon("1em")} ${esc(prisText(rw))}</div>` : ""}
      <div class="dknl-rad">
        <div class="dknl-antal"><b data-n>0</b> <span>inloggade</span></div>
        <div class="dknl-vantar"><i class="dknl-puls"></i>Väntar på start …</div>
      </div>
      ${readonly ? "" : `<button class="dknl-start" data-start>▶ STARTA</button>
      <div class="dknl-fot">
        <span>Eleverna går in via <b>Live</b> i menyn och väljer sin kod.</span>
        <button class="lp-link" data-cancel>Avbryt</button>
        ${actions.remove ? `<button class="lp-link" data-remove>Radera</button>` : ""}
      </div>`}
      <p class="dknl-tips" role="status"><span aria-hidden="true">🔑</span> <b>Säkerhetstips:</b> <span data-tips></span></p>
    </div>
    <div class="dknl-folk"></div>`;
  host.replaceChildren(root);
  const folk = root.querySelector(".dknl-folk");
  const tipsEl = root.querySelector("[data-tips]");
  // Dekor (noder, paket, robotar) aldrig bakom text eller de inloggade.
  const vakt = createDekorVakt(root, () =>
    [...root.querySelectorAll(".dknl-mitt > *, .dknl-plats")].map((el) => el.getBoundingClientRect()));
  const now = () => (deps?.now ? deps.now() : Date.now());

  const roster = avatarRoster(sid, deps);
  roster.prefetch(s.participatingClassIds || []);
  const pool = createAvatarPool({ roster });
  const seats = new Map(); // uid → { el, name }
  // Inloggning: avataren studsar upp vid sin nod. Tyst (inget ljud i lobbyn).
  const regi = createLiveRegi({
    sessionId: `${sid}:lobby`,
    pool,
    map(evt) {
      return evt.type === "join" ? [{ kind: "reaction", uid: evt.uid, reaction: "ankomst" }] : [];
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
      start.textContent = "▶ STARTA";
    }
  });
  root.querySelector("[data-cancel]")?.addEventListener("click", () => {
    if (confirm("Avbryta Datakuppen? Den sparas som avbruten.")) actions.cancel?.().catch((e) => say(e.message));
  });
  root.querySelector("[data-remove]")?.addEventListener("click", () => {
    if (confirm("Radera Datakuppen helt? Den har inte startat.")) actions.remove?.().catch((e) => say(e.message));
  });

  // Tipset: samma i alla fönster (klockan), tonar när det byts.
  let tip = "";
  function visaTips() {
    const t = tipAt(now());
    if (t === tip) return;
    const first = !tip;
    tip = t;
    if (first) { tipsEl.textContent = t; return; }
    tipsEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished.catch(() => {}).finally(() => {
      tipsEl.textContent = tip;
      tipsEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, fill: "forwards" });
    });
  }
  visaTips();
  const iv = setInterval(visaTips, 1000);

  function seat(p) {
    const s1 = seats.get(p.uid);
    if (s1) {
      if (p.name && p.name !== s1.name) {
        s1.name = p.name;
        s1.el.querySelector(".dknl-namn").textContent = `> ${p.name}`;
      }
      return;
    }
    const el = document.createElement("div");
    el.className = "dknl-plats";
    const av = pool.el(p.uid);
    av.classList.add("vantar");
    el.append(av);
    el.insertAdjacentHTML("beforeend", `<i class="dknl-nod" aria-hidden="true"></i><span class="dknl-namn"></span>`);
    el.querySelector(".dknl-namn").textContent = `> ${p.name || ""}`;
    folk.appendChild(el);
    seats.set(p.uid, { el, name: p.name || "" });
  }

  function update(next) {
    const players = next.players || [];
    roster.ensure(players);
    players.forEach(seat);
    folk.style.setProperty("--dknl-fig", figSize(seats.size));
    regi.sync({ phase: "lobby", players: players.map((p) => ({ uid: p.uid, name: p.name })) });
    root.querySelector("[data-n]").textContent = String(players.length);
    vakt?.check();
  }
  update(st);

  return {
    update,
    destroy() {
      clearInterval(iv);
      vakt.destroy();
      regi.destroy();
      pool.destroy();
      root.remove();
    },
  };
}
