// ============================================================================
// Kurragömma 🙈 – projektorns HUVUDVY "Ön" (#839, spec §7). Ön snett ovanifrån
// med långsam rotation (scen/kg-scen.js i läget projektor), sökarna ur
// rörelsekanalen (kg-kanal.js) – gömmarna syns ALDRIG – och:
//   toppraden (fredad, §0.2)  logga · timer ("Göm: 0:24" i gömfasen, matchklockan
//                            i letfasen) · "Låsta 12/21" / "Gömda 14 · Sökare 6" ur
//                            RTDB status. Scenen ligger UNDER raden i DOM:en, så
//                            ingen effekt kan hamna över den.
//   händelseflödet (≤ 4 rader) visslingar (aldrig namn), hittade, miss, ny sökare,
//                            "Alla har gömt sig – nu letar sökarna!", "1 minut kvar!"
//   effekter + ljud          scen.vissling/hittad (ringar, noter, konfetti, glidning –
//                            en glidning vid täta händelser), kgp-ljud.js (riktat)
//   finalen                  kgp-final.js ur serverns result (finale: true)
// Projektorn (inte elevskärmsfönstret) anropar kgStarta efter KÖR! och kgTick var
// TICK_MS – och lyssnar INTE på kgPlayers/kgEvents under matchen (kvoten, §5.5):
// siffrorna kommer ur status, händelserna ur hand. Ingen topplista före finalen.
// Musiken sänks under gömfasen (music.skala). prefers-reduced-motion: scenen
// stänger av rotation och glidning själv.
//
//   createOn(host, { st, sound, music, screen, deps }) → { update(st), destroy() }
//     deps.kurragomma (demot) = { kanal({ sid, uid }), starta(sid), tick(sid), roster?, tvinga2d? }
//     – annars kurragomma-data.js (riktiga callables + RTDB) och createAvatarRoster().
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { ensureLiveCss } from "../../live-css.js";
import { TICK_MS, FLODE_MAX_RADER } from "./delat/kg-config.js";
import { fasAv, gomSlutMs, toppText, flodesRad, FAS_LETA_RAD, MINUT_KVAR_RAD, minutKvar } from "./kgp-logik.js";
import { createKgLjud } from "./kgp-ljud.js";
import { createFinal } from "./kgp-final.js";

export const KGP_CSS = ["src/live/formats/kurragomma/kurragomma-projektor.css", "src/live/formats/kurragomma/scen/kurragomma-scen.css"];
const RAD_MS = 14_000;
const GOM_MUSIK = 0.5;
const PROJEKTOR_UID = "projektor";
const START_IGEN_MS = 4000;

async function standardKoppling() {
  const [api, { createAvatarRoster }] = await Promise.all([import("./kurragomma-data.js"), import("../../design/live-avatars.js")]);
  return { ...api, roster: createAvatarRoster() };
}

export function createOn(host, { st, sound = null, music = null, screen = false, deps = {} }) {
  ensureLiveCss(KGP_CSS);
  const s0 = st.session;
  const sid = s0.id;
  const root = document.createElement("div");
  root.className = "kgp kgp-on";
  root.innerHTML = `
    <div class="kgp-topp" role="status">
      <div class="kgp-logga">🙈 KURRAGÖMMA</div>
      <div class="kgp-timer"><b data-timer>00:00</b></div>
      <div class="kgp-rad" data-rad></div>
    </div>
    <div class="kgp-scen"></div>
    <ol class="kgp-flode" aria-live="polite"></ol>
    <div class="kgp-vanta" hidden></div>`;
  host.appendChild(root);
  const $ = (q) => root.querySelector(q);
  const yta = $(".kgp-scen");
  const flodeEl = $(".kgp-flode");
  const ljud = createKgLjud(sound, music);

  let state = st;
  let scen = null;
  let koppling = null;
  let kanal = null;
  let status = null;
  let fas = null;
  let prevMs = null;
  let startad = false;
  let tickT = 0;
  let startT = 0;
  let tickar = false;
  let final = null;
  let betalat = false;
  let destroyed = false;
  const sedda = new Set();
  const namn = new Map();
  const rader = []; // { li, t }

  // Skalan: 1 enhet = 1/1920 av bredden (samma ritning på 1920×1080 och 1280×720).
  const anpassa = () => root.style.setProperty("--kgp-u", `${Math.max(0.2, root.clientWidth / 1920)}px`);
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(anpassa) : null;
  if (ro) ro.observe(root);
  anpassa();

  // --- flödet (högst FLODE_MAX_RADER, nyast nederst) -------------------------------
  function rad(r) {
    if (!r || destroyed) return;
    const li = document.createElement("li");
    li.className = `kgp-flodrad kgp-flodrad-${r.typ}`;
    li.innerHTML = `<span class="kgp-flodikon" aria-hidden="true">${r.ikon}</span><span class="kgp-flodtext">${esc(r.text)}</span>`;
    flodeEl.appendChild(li);
    const post = { li, t: setTimeout(() => bort(post), RAD_MS) };
    rader.push(post);
    while (rader.length > FLODE_MAX_RADER) bort(rader[0], true);
    requestAnimationFrame(() => li.classList.add("kgp-synlig"));
  }
  /** direkt = trängs ut av en nyare rad (aldrig fler än FLODE_MAX_RADER synliga, även vid en skur). */
  function bort(post, direkt = false) {
    const i = rader.indexOf(post);
    if (i >= 0) rader.splice(i, 1);
    clearTimeout(post.t);
    post.li.classList.remove("kgp-synlig");
    if (direkt) post.li.remove();
    else setTimeout(() => post.li.remove(), 450);
  }

  // --- toppraden ---------------------------------------------------------------------
  function ritaTopp() {
    const s = state.session;
    const t = toppText({ fas, status, gomSlutMs: gomSlutMs(s), now: deps.now?.() ?? Date.now(), clock: state.clock, antal: (state.players || []).length });
    const timer = state.phase === "countdown" ? "Snart!" : state.phase === "ended" || state.phase === "finished" ? "Slut" : t.timer;
    if ($("[data-timer]").textContent !== timer) $("[data-timer]").textContent = timer;
    if ($("[data-rad]").textContent !== t.rad) $("[data-rad]").textContent = t.rad;
    root.classList.toggle("kgp-slutet", state.phase === "live" && fas === "leta" && state.msLeft <= 60_000);
  }
  const toppT = setInterval(() => { if (!destroyed) ritaTopp(); }, 250);

  // --- rörelsekanalen: positioner, händelser, status -------------------------------
  function handelse(h) {
    if (!h || sedda.has(h.id) || destroyed) return;
    sedda.add(h.id);
    const showNames = state.session?.showNames !== false;
    const p = Number.isFinite(h.x) && Number.isFinite(h.z) ? { x: h.x, z: h.z } : null;
    if (h.typ === "vissling" && p) { scen?.vissling(p); ljud.vissling(scen?.skarm(p)); }
    else if (h.typ === "hittad" && p) { scen?.hittad(p); ljud.hittad(); }
    else if (h.typ === "nySokare") ljud.nySokare();
    rad(flodesRad(h, { showNames }));
  }
  function pos(uid, p) {
    if (!scen || uid === PROJEKTOR_UID) return;
    if (!p) return scen.sokareBort(uid);
    scen.sokare([{ uid, x: p.x, z: p.z, yaw: p.yaw, t: p.t, namn: namn.get(uid) || null }]);
  }
  function nyStatus(s) {
    status = s || null;
    bytFas(fasAv(state.session, status));
  }
  function bytFas(ny) {
    if (ny === fas) return;
    const var_ = fas;
    fas = ny;
    if (ny === "leta" && var_ === "gom") { rad(FAS_LETA_RAD); ljud.gomSlut(); }
    music?.skala?.(ny === "gom" ? GOM_MUSIK : 1);
    ritaTopp();
  }

  async function starta() {
    if (startad || destroyed) return;
    startad = true;
    try {
      koppling = deps.kurragomma || (await standardKoppling());
      if (destroyed) return;
      koppling.roster?.prefetch?.(state.session?.participatingClassIds || []);
      const { skapaKgScen } = await import("./scen/kg-scen.js");
      scen = await skapaKgScen({ yta, lage: "projektor", roster: koppling.roster || null, jagUid: PROJEKTOR_UID, namnPa: state.session?.showNames !== false, tvinga2d: !!koppling.tvinga2d });
      if (destroyed) { scen.destroy(); scen = null; return; }
      kanal = koppling.kanal({ sid, uid: PROJEKTOR_UID });
      await kanal.start();
      if (destroyed) return;
      kanal.paStatus(nyStatus);
      kanal.paHandelse(handelse);
      kanal.paPos(pos);
      sync();
    } catch (err) {
      console.warn("[kurragomma] projektorn kunde inte ansluta", err);
      vanta(`Projektorn kunde inte ansluta till ön (${err?.message || err}) – försöker igen …`);
      try { kanal?.stang(); } catch { /* inte startad */ }
      kanal = null;
      scen?.destroy();
      scen = null;
      startad = false;
      if (!destroyed) startT = setTimeout(() => starta(), START_IGEN_MS);
    }
  }

  // kgStarta efter KÖR! och kgTick var TICK_MS – bara projektorn, aldrig elevskärmsfönstret.
  function tickaIgang() {
    if (screen || tickar || !koppling?.tick) return;
    tickar = true;
    koppling.starta?.(sid).catch((e) => console.warn("[kurragomma] kgStarta", e?.message || e));
    const tick = async () => {
      if (destroyed || state.phase !== "live") return;
      try {
        const r = await koppling.tick(sid);
        if (r?.klart) return; // servern har avslutat – kärnan ser status finished
      } catch (e) { console.warn("[kurragomma] kgTick", e?.message || e); }
      if (!destroyed && state.phase === "live") tickT = setTimeout(tick, TICK_MS);
    };
    tickT = setTimeout(tick, 400);
  }

  // Slutade servern matchen (kgTick → kgAvsluta: alla hittade / 00:00) skrivs finished och
  // result i samma transaktion, och kärnans resultInputs-väg (bara när result saknas) körs
  // aldrig – pluggmynten betalas då här, en gång, av projektorn (inte elevskärmsfönstret).
  // avslutaOchBetala är idempotent (kgAvsluta → redan, kvittot coinReceipts/{uid}).
  function betala() {
    if (betalat || screen || deps.kurragomma || state.session?.demo === true) return;
    betalat = true;
    import("./kg-avslut.js")
      .then(({ avslutaOchBetala }) => avslutaOchBetala({ ...state.session, status: "finished", result: state.result }))
      .catch((e) => { console.warn("[kurragomma] utbetalningen efter serverns avslut", e?.message || e); betalat = false; });
  }

  function vanta(text) {
    const v = $(".kgp-vanta");
    v.textContent = text || "";
    v.hidden = !text;
  }

  function sync() {
    if (destroyed) return;
    const s = state.session;
    if (!s) return;
    for (const p of state.players || []) namn.set(p.uid, p.name || "");
    koppling?.roster?.ensure?.((state.players || []).map((p) => ({ uid: p.uid, classId: p.classId })));
    scen?.namnPa(s.showNames !== false);
    const ph = state.phase;
    if (ph === "live") {
      bytFas(fasAv(s, status));
      if (koppling) tickaIgang();
      if (fas === "leta" && minutKvar(prevMs, state.msLeft)) rad(MINUT_KVAR_RAD);
      prevMs = state.msLeft;
      vanta("");
    } else if (ph === "ended") {
      if (fas !== "slut") { fas = "slut"; music?.skala?.(1); rad({ ikon: "⏱", text: "Tiden är ute!", typ: "tid" }); }
      vanta(state.result ? "" : "Räknar ihop …");
    } else if (ph === "finished") {
      fas = "slut";
      if (state.result && !final) {
        vanta("");
        flodeEl.hidden = true;
        final = createFinal(root, { result: state.result, session: s, scen, ljud });
      } else if (!state.result) vanta("Räknar ihop …");
      if (state.result) betala();
    }
    ritaTopp();
  }

  starta();
  sync();

  return {
    update(next) {
      state = next;
      sync();
    },
    destroy() {
      destroyed = true;
      clearInterval(toppT);
      clearTimeout(tickT);
      clearTimeout(startT);
      rader.forEach((p) => clearTimeout(p.t));
      ro?.disconnect();
      final?.destroy();
      try { kanal?.stang(); } catch { /* redan stängd */ }
      scen?.destroy();
      ljud.destroy();
      music?.skala?.(1);
      root.remove();
    },
  };
}
