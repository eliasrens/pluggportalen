// ============================================================================
// Kurragömma 🙈 – projektorns LOBBY (#839, spec §11.1). Ön i projektorläge
// (långsam rotation) och varje ansluten elev som en figur på stranden vid bron
// (kgp-logik.js lobbyPlatser, riktiga avatarer ur klassprojektionen – en
// läsning per klass), rubriken, inställningarna, pluggmynten, "N elever redo",
// förklaringen och STARTA → skalets 3–2–1–KÖR!. Lobbyn är tyst (ingen musik,
// inget ljud). Elevskärmen (#533, readonly): inga knappar.
//
// API: createLobby(host, { st, modeName, actions, say, readonly, deps }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { coinIcon } from "../../../icons.js";
import { ensureLiveCss } from "../../live-css.js";
import { sessionRewards, placementPrize } from "../../live-rewards.js";
import { normInstallningar } from "./delat/kg-regler.js";
import { lobbyPlatser, LOBBY_TEXT } from "./kgp-logik.js";
import { KGP_CSS } from "./kgp-on.js";

const KIND = { choice: "🔘 Flerval", free: "✍️ Skriv själv" };
const MAX_PRICKAR = 40;

export function createLobby(host, { st, modeName = "", actions = {}, say = () => {}, readonly = false, deps = {} }) {
  ensureLiveCss(KGP_CSS);
  const s = st.session;
  const id = (s.participatingClassIds || [])[0];
  const klass = s.classNames?.[id] || id || "";
  const inst = normInstallningar(s.kgInstallningar);
  const rw = sessionRewards(s);
  const speltid = Math.round(((Number(s.durationSeconds) || 0) - inst.gomtid) / 60);
  const root = document.createElement("div");
  root.className = "kgp kgp-lobby";
  root.innerHTML = `
    <div class="kgp-scen"></div>
    <div class="kgp-lobbyruta">
      <div class="kgp-logga">🙈 KURRAGÖMMA</div>
      <h1 class="kgp-lobbytitel">${esc(klass)}</h1>
      <div class="kgp-lobbymeta">${esc(modeName)} · ${esc(KIND[s.answerKind] || "")}${speltid ? ` · ⏱ ${speltid} min` : ""} · 🙈 gömtid ${inst.gomtid} s</div>
      ${rw ? `<div class="kgp-lobbypris">${coinIcon("1em")} Pluggmynt efter matchen: ${rw.firstPrize ? esc(`${rw.firstPrize} till ettan, ${placementPrize(rw.firstPrize, 2)} till tvåan`) : ""}${rw.firstPrize && rw.perCorrect ? " + " : ""}${rw.perCorrect ? "mynt för varje rätt svar" : ""}</div>` : ""}
      <p class="kgp-lobbytext">${esc(LOBBY_TEXT)}</p>
      <div class="kgp-lobbyklass"><b><i data-n>0</i> elever redo</b><div class="kgp-prickar" data-prickar></div></div>
      <div class="kgp-lobbystatus"><i class="kgp-puls"></i>Väntar på start …</div>
      ${readonly ? "" : `<button class="kgp-start" data-start>▶ STARTA</button>
      <div class="kgp-lobbyfot"><span>Eleverna går in via <b>Live</b> i menyn.</span>
        <button class="lp-link" data-cancel>Avbryt</button>
        ${actions.remove ? `<button class="lp-link" data-remove>Radera</button>` : ""}</div>`}
    </div>`;
  host.replaceChildren(root);
  const yta = root.querySelector(".kgp-scen");
  const anpassa = () => root.style.setProperty("--kgp-u", `${Math.max(0.2, root.clientWidth / 1920)}px`);
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(anpassa) : null;
  if (ro) ro.observe(root);
  anpassa();

  let scen = null;
  let roster = null;
  let destroyed = false;
  let visade = new Set();
  let senaste = st;

  (async () => {
    try {
      roster = deps.kurragomma?.roster || (await import("../../design/live-avatars.js")).createAvatarRoster();
      roster.prefetch?.(s.participatingClassIds || []);
      const { skapaKgScen } = await import("./scen/kg-scen.js");
      const sc = await skapaKgScen({ yta, lage: "projektor", roster, jagUid: "projektor", namnPa: s.showNames !== false });
      if (destroyed) return sc.destroy();
      scen = sc;
      figurer(senaste);
    } catch (err) {
      console.warn("[kurragomma] lobbyn: scenen kunde inte startas", err);
    }
  })();

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
    if (confirm("Avbryta Kurragömma? Matchen sparas som avbruten.")) actions.cancel?.().catch((e) => say(e.message));
  });
  root.querySelector("[data-remove]")?.addEventListener("click", () => {
    if (confirm("Radera Kurragömma helt? Matchen har inte startat.")) actions.remove?.().catch((e) => say(e.message));
  });

  /** Figurerna på stranden: en per ansluten elev, i anslutningsordning. */
  function figurer(next) {
    if (!scen) return;
    const players = [...(next.players || [])].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a.uid.localeCompare(b.uid));
    roster?.ensure?.(players.map((p) => ({ uid: p.uid, classId: p.classId })));
    const t = Date.now();
    const platser = lobbyPlatser(players.map((p) => p.uid));
    const namn = new Map(players.map((p) => [p.uid, p.name || ""]));
    scen.sokare(platser.map((p) => ({ ...p, t, namn: namn.get(p.uid) || null })));
    const nu = new Set(platser.map((p) => p.uid));
    for (const uid of visade) if (!nu.has(uid)) scen.sokareBort(uid);
    visade = nu;
  }

  function update(next) {
    senaste = next;
    const n = (next.players || []).length;
    root.querySelector("[data-n]").textContent = String(n);
    root.querySelector("[data-prickar]").innerHTML = "<i></i>".repeat(Math.min(MAX_PRICKAR, n));
    figurer(next);
  }
  update(st);

  return {
    update,
    destroy() {
      destroyed = true;
      ro?.disconnect();
      scen?.destroy();
      root.remove();
    },
  };
}
