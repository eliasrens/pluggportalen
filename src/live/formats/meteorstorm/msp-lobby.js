// ============================================================================
// Meteorstormen – projektorns LOBBY (#822). Rymden med stationerna i vila
// (samma ritning som matchen, ingen storm än), METEORSTORMEN-rubriken, klass
// mot klass eller "4B försvarar sin station", inställningarna, pluggmynten och
// "N elever redo" per klass. Stor STARTA → skalets 3–2–1–KÖR!. Lobbyn är tyst.
// Elevskärmen (#533, readonly): inga knappar.
//
// API: createLobby(host, { st, colors, modeName, actions, say, readonly }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { coinIcon } from "../../../icons.js";
import { sessionRewards, placementPrize } from "../../live-rewards.js";
import { skapaMotor } from "./delat/ms-motor.js";
import { W, H, motorIndata, skapaLoggminne } from "./msp-scen.js";
import { skapaBild } from "./msp-bild.js";
import { ensureMspCss } from "./msp-rymd.js";

const KIND = { choice: "🔘 Flerval", free: "✍️ Skriv själv" };
const ATTACK = { av: "inga dragstrålar", milda: "milda attacker", vilda: "vilda attacker" };
const MAX_PRICKAR = 40;

export function createLobby(host, { st, colors = {}, modeName = "", actions = {}, say = () => {}, readonly = false }) {
  ensureMspCss();
  const s = st.session;
  const ids = s.participatingClassIds || [];
  const namn = (id) => s.classNames?.[id] || id;
  const inst = s.msInstallningar || {};
  const kmk = inst.lage !== "en-klass" && ids.length > 1;
  const rw = sessionRewards(s);
  const min = Math.round((Number(s.durationSeconds) || 0) / 60);
  const root = document.createElement("div");
  root.className = "msp msp-lobby";
  const titel = kmk
    ? ids.map((id) => `<span style="color:${esc(colors[id] || "#fff")}">${esc(namn(id))}</span>`).join('<i class="msp-mot">mot</i>')
    : `<span style="color:${esc(colors[ids[0]] || "#fff")}">${esc(namn(ids[0]))}</span> försvarar sin station`;
  root.innerHTML = `<div class="msp-ram"><canvas class="msp-canvas" aria-hidden="true"></canvas>
    <div class="msp-lobbyruta">
      <div class="msp-logga">☄️ METEORSTORMEN</div>
      <h1 class="msp-lobbytitel">${titel}</h1>
      <div class="msp-lobbymeta">${esc(modeName)} · ${esc(KIND[s.answerKind] || "")}${min ? ` · ⏱ ${min} min` : ""}${kmk ? ` · 🌀 ${esc(ATTACK[inst.attacker] || "")}` : ""}</div>
      ${rw ? `<div class="msp-lobbypris">${coinIcon("1em")} Pluggmynt efter stormen: ${rw.firstPrize ? esc(kmk ? `vinnarklassen ${rw.firstPrize}, tvåan ${placementPrize(rw.firstPrize, 2)}` : `${rw.firstPrize} vid ⭐⭐⭐`) : ""}${rw.firstPrize && rw.perCorrect ? " + " : ""}${rw.perCorrect ? "mynt för varje rätt svar" : ""}</div>` : ""}
      <div class="msp-lobbyklasser">${ids.map((id) => `
        <div class="msp-lobbyklass" data-cid="${esc(id)}" style="--msp-k:${esc(colors[id] || "#ffd166")}">
          <b>${esc(namn(id))}</b><span><i data-n>0</i> elever redo</span><div class="msp-prickar" data-prickar></div>
        </div>`).join("")}</div>
      <div class="msp-lobbystatus"><i class="msp-puls"></i>Väntar på start …</div>
      ${readonly ? "" : `<button class="msp-start" data-start>▶ STARTA STORMEN</button>
      <div class="msp-lobbyfot"><span>Eleverna går in via <b>Live</b> i menyn.</span>
        <button class="lp-link" data-cancel>Avbryt</button>
        ${actions.remove ? `<button class="lp-link" data-remove>Radera</button>` : ""}</div>`}
    </div></div>`;
  host.replaceChildren(root);
  const ram = root.querySelector(".msp-ram");
  const bild = skapaBild(root.querySelector("canvas"));
  const motor = skapaMotor(motorIndata(s));
  const vila = motor.tillstand(motor.cfg.startMs);
  const farger = motor.cfg.stationer.map((x) => colors[x.classId] || "#ffd166");

  function anpassa() {
    const r = root.getBoundingClientRect();
    const w = Math.max(160, Math.min(r.width, (r.height * 16) / 9));
    ram.style.width = `${w}px`;
    ram.style.height = `${(w * 9) / 16}px`;
    ram.style.setProperty("--msp-u", `${w / W}px`);
    const pxW = Math.min(2048, Math.round(w * Math.min(window.devicePixelRatio || 1, 2)));
    bild.storlek(pxW, Math.round((pxW * H) / W));
    // stationerna i vila, högre upp (som slutets läge) – rutan ligger under
    bild.rita({
      s: vila, tMotor: 0, tAnim: 0, cfg: motor.cfg, plan: motor.plan, minne: skapaLoggminne().las([]),
      farger, namn, seed: motor.cfg.seed, rorelse: false, slut: { sedan: 0, firar: [] },
    });
  }
  const ro = new ResizeObserver(anpassa);
  ro.observe(root);

  const start = root.querySelector("[data-start]");
  start?.addEventListener("click", async () => {
    start.disabled = true;
    start.textContent = "Startar …";
    try {
      await actions.start?.();
    } catch (e) {
      say(e?.message || String(e));
      start.disabled = false;
      start.textContent = "▶ STARTA STORMEN";
    }
  });
  root.querySelector("[data-cancel]")?.addEventListener("click", () => {
    if (confirm("Avbryta Meteorstormen? Den sparas som avbruten.")) actions.cancel?.().catch((e) => say(e.message));
  });
  root.querySelector("[data-remove]")?.addEventListener("click", () => {
    if (confirm("Radera Meteorstormen helt? Den har inte startat.")) actions.remove?.().catch((e) => say(e.message));
  });

  function update(next) {
    const players = next.players || [];
    for (const id of ids) {
      const box = root.querySelector(`[data-cid="${CSS.escape(id)}"]`);
      const n = players.filter((p) => p.classId === id).length;
      box.querySelector("[data-n]").textContent = String(n);
      box.querySelector("[data-prickar]").innerHTML = "<i></i>".repeat(Math.min(MAX_PRICKAR, n));
    }
  }
  update(st);

  return { update, destroy() { ro.disconnect(); root.remove(); } };
}
