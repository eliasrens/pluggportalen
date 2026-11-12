// ============================================================================
// Kurragömma 🙈 – ELEVENS SPELYTA utan Firebase (#839, spec §6). kurragomma-
// student.js kopplar in callables + Firestore + RTDB (api = kurragomma-data.js),
// förhandsvisningen och demot en låtsasserver (kg-demo.js). Kärnan äger lobbyns
// ram, 3-2-1-KÖR!, närvaro, sen anslutning och slutskärmens ram.
//
// Layout: 3D-vyn (scen/kg-scen.js) fyller ytan; ovanpå timer + fas överst,
// skyddsmätaren i mitten, låsknappen (gömfasen); frågepanelen till höger
// (~360 px över 1100 px) eller som ett hopfällbart kort längst ned. Inget ljud.
// Faserna (kge-logik.js elevLage):
//   gom-gomd    "Göm dig! Ingen annan ser var du går.", nedräkning, mätaren,
//               🔒 Lås → kgLas (ångras inte). Platsen sparas i sessionStorage
//               (aldrig på servern) så en omladdning fortsätter där eleven var.
//               Tar tiden slut skickas platsen automatiskt.
//   gom-sokare  täckt skärm "🙈 Du blundar – räkna till 30!" + frågor (laddar lampan)
//   leta-gomd   frågor, "Du är gömd i buskaget", poäng, hjärtslaget, egen
//               vissling (text + hopp) och raden "Det visslar vid ladan" (3 s)
//   leta-sokare frågor, tre ficklampor, 🔦 Leta (mellanslag/E, 2 s spärr), pilen
//   hittad      ruta ≤ 2 s "Leo hittade dig! Nu letar du också." → sökare från gömstället
// Rollbyte och poäng kommer ur det egna kgPlayers (watchMe) – inget annat lyssnas på.
//
//   createKgStage({ view, host, uid, classId, session, mode, answerKind },
//                 { api, now, roster, onCoins?, storage?, css?, tvinga2d? }) → { update(st, player), destroy() }
//     api = { anslut, las, svara, leta, avsluta, getQuestions, watchMe, kanal({ sid, uid }) }
// ============================================================================

import { ensureLiveCss } from "../../live-css.js";
import { myReward } from "../../live-rewards.js";
import { toMs } from "../../live-time.js";
import { LAS_MARGINAL_MS, HITTAD_RUTA_MS, VISSLING_RAD_MS } from "./delat/kg-config.js";
import { platsNamn } from "./delat/kg-geometri.js";
import {
  TEXT, elevLage, scenLage, gomdText, hittadText, hittadeText, andraVisslingText, blundText, nedrakning, laddningarHtml,
  skyddPrickSvg, skyddText, startplats, sparaPos, lasPos, glomPos, letaTangent, panelLage, mittenText,
} from "./kge-logik.js";
import { skapaSpel } from "./kge-spel.js";

export const KGE_CSS = ["src/live/formats/kurragomma/kurragomma-elev.css", "src/live/formats/kurragomma/scen/kurragomma-scen.css"];
const AVSLUTA_EFTER_MS = [20_000, 35_000];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function createKgStage({ view, host, uid, session, mode, answerKind }, { api, now, roster = null, onCoins = () => {}, storage = undefined, css = KGE_CSS, tvinga2d = false }) {
  ensureLiveCss(css);
  view.classList.add("kge-elev-vy");
  const sid = session.id;
  const quiz = mode.id === "plugga_quiz";
  const lagring = storage === undefined ? (() => { try { return window.sessionStorage; } catch { return null; } })() : storage;
  host.innerHTML = `<div class="kge" data-panel="sida">
    <div class="kge-huvud">
      <div class="kge-scen"></div>
      <div class="kge-topp"><span class="kge-fastext" data-fastext></span><b class="kge-timer" data-timer></b><span class="kge-poang" data-poang></span></div>
      <div class="kge-matare" data-matare hidden></div>
      <div class="kge-rad" data-rad role="status" hidden></div>
      <button type="button" class="kge-las" data-las hidden>${TEXT.las}</button>
      <div class="kge-blund" data-blund hidden><p data-blundtext></p><b data-blundtimer></b><small>Svara på frågorna så laddar du ficklampan.</small></div>
      <div class="kge-hittad" data-hittad role="status" hidden></div>
      <p class="kge-vanta" data-vanta>Ansluter till ön …</p>
    </div>
    <aside class="kge-panel">
      <button type="button" class="kge-fall" data-fall aria-expanded="true"><span>Frågor</span><i aria-hidden="true"></i></button>
      <div class="kge-panel-inre">
        <div class="kge-sokare" data-sokare hidden>
          <div class="kge-lampor" data-lampor aria-label="Ficklampans laddningar"></div>
          <button type="button" class="kge-leta" data-leta>${TEXT.leta} <kbd>mellanslag</kbd></button>
        </div>
        <p class="kge-mitten" data-mitten></p>
        <div class="kge-svar" data-svar></div>
        <p class="kge-fel" data-fel role="status" hidden></p>
      </div>
    </aside>
  </div>`;
  const $ = (q) => host.querySelector(q);
  const root = $(".kge");
  const yta = $(".kge-scen");

  let st = null;
  let player = null;
  let info = null; // kgAnslut-svaret
  let fas = null;
  let lage = null;
  let roll = null;
  let harLast = false;
  let gomstalle = null;
  let poang = 0;
  let scen = null;
  let kanal = null;
  let unMe = null;
  let quizQs = [];
  let starting = false;
  let ready = false;
  let destroyed = false;
  let laser = false;
  let slutGjort = false;
  let coinTimers = null;
  let avslutaT = 0;
  let radT = 0;
  let felT = 0;
  let hittadT = 0;
  let sparT = 0;
  const namn = (u) => (st?.session?.showNames !== false ? st?.players?.find((p) => p.uid === u)?.name : null) || null;

  const spel = skapaSpel({
    sid, uid, api, mode, answerKind, questions: () => quizQs, fragorHost: $("[data-svar]"),
    ui: {
      namn,
      svar(res) {
        if (Number.isFinite(res?.poang)) { poang = res.poang; ritaTopp(); }
        if (Number.isFinite(res?.laddningar)) ritaLampor(res.laddningar);
        if (res?.vissling) { rad(TEXT.egenVissling, "egen"); scen?.hopp(); }
      },
      fel,
      vissling(h, egen) { if (!egen && lage === "leta-gomd") rad(andraVisslingText(h.plats)); },
      hittade(lista, r) {
        if (Number.isFinite(r?.poang)) { poang = r.poang; ritaTopp(); }
        rad(lista.length ? lista.map((h) => hittadeText(h.namn)).join(" ") : TEXT.hittadeIngen, lista.length ? "hittade" : "");
      },
      laddningar: ritaLampor,
      letar(v) { $("[data-leta]").classList.toggle("kge-skickar", v); },
      flytt(p) {
        // Gömmarens plats sparas bara lokalt (sessionStorage) under gömfasen – aldrig på servern.
        if (lage !== "gom-gomd" || harLast) return;
        clearTimeout(sparT);
        sparT = setTimeout(() => sparaPos(lagring, sid, p), 200);
      },
    },
  });

  // --- små ritare -----------------------------------------------------------------------
  function rad(text, typ = "") {
    const r = $("[data-rad]");
    r.textContent = text;
    r.dataset.typ = typ;
    r.hidden = false;
    clearTimeout(radT);
    radT = setTimeout(() => { r.hidden = true; }, VISSLING_RAD_MS);
  }
  function fel(text) {
    const f = $("[data-fel]");
    f.textContent = text || "";
    f.hidden = !text;
    clearTimeout(felT);
    if (text) felT = setTimeout(() => { f.hidden = true; }, 3500);
  }
  function ritaLampor(n) {
    spel.laddningar = n;
    $("[data-lampor]").innerHTML = laddningarHtml(n);
    $("[data-leta]").disabled = !(n > 0) || lage !== "leta-sokare";
    $("[data-mitten]").textContent = mittenText({ lage, laddningar: n });
  }
  function ritaMatare() {
    const m = $("[data-matare]");
    if (!scen || !(lage === "gom-gomd" || lage === "leta-gomd")) { m.hidden = true; return; }
    const n = scen.skydd();
    const plats = harLast ? gomdText(gomstalle?.namn || platsNamn(scen.jag().x, scen.jag().z)) : skyddText(n);
    m.innerHTML = `${skyddPrickSvg(n)}<span>${esc(harLast ? `${plats} · ${skyddText(gomstalle?.skydd ?? n)}` : plats)}</span>`;
    m.hidden = false;
  }
  function ritaTopp() {
    const t = now();
    const gomSlut = toMs(info?.tider?.gomSlut);
    const fastext = lage === "gom-gomd" ? "Gömfasen" : lage === "gom-sokare" ? "Du blundar" : lage === "leta-gomd" ? "Du är gömd" : lage === "leta-sokare" ? "Du letar" : "";
    $("[data-fastext]").textContent = fastext;
    $("[data-timer]").textContent = fas === "gom" && gomSlut ? `Göm: ${nedrakning(gomSlut, t)}` : st?.clock || "";
    $("[data-blundtimer]").textContent = gomSlut ? nedrakning(gomSlut, t) : "";
    $("[data-poang]").textContent = ready ? `${poang} p` : "";
  }
  function visaHittad(av) {
    const h = $("[data-hittad]");
    h.textContent = hittadText(av);
    h.hidden = false;
    clearTimeout(hittadT);
    hittadT = setTimeout(() => { h.hidden = true; }, HITTAD_RUTA_MS);
  }

  // --- läget ---------------------------------------------------------------------------------
  function sattLage() {
    if (!ready) return;
    const ny = elevLage({ roll, fas });
    const bytt = ny !== lage;
    lage = ny;
    root.dataset.lage = lage;
    spel.lage(lage);
    scen?.lage(scenLage(lage, harLast));
    $("[data-las]").hidden = lage !== "gom-gomd" || harLast;
    $("[data-blund]").hidden = lage !== "gom-sokare";
    $("[data-sokare]").hidden = !(lage === "leta-sokare" || lage === "gom-sokare");
    spel.fragor(lage !== "gom-gomd");
    ritaLampor(spel.laddningar);
    ritaMatare();
    ritaTopp();
    if (bytt && lage === "leta-sokare") scen?.jag(scen.jag()); // kameran bakom figuren igen
  }
  function sattFas(f) {
    if (f !== "gom" && f !== "leta") return;
    if (f === fas) return;
    fas = f;
    if (fas === "leta" && roll === "gomd" && !harLast) lasNu(); // tiden tog slut – platsen skickas
    sattLage();
  }

  /** 🔒 Lås (eller tiden tog slut): kgLas med figurens plats; ogiltig plats flyttas av servern. */
  async function lasNu() {
    if (laser || harLast || !scen || roll !== "gomd") return;
    laser = true;
    $("[data-las]").disabled = true;
    try {
      const r = await api.las(sid, scen.jag());
      if (destroyed) return;
      gomstalle = r.gomstalle;
      harLast = true;
      glomPos(lagring, sid);
      if (gomstalle) scen.jag({ x: gomstalle.x, z: gomstalle.z, yaw: scen.jag().yaw });
      spel.gomstalle(gomstalle);
      rad(gomdText(gomstalle?.namn), "last");
      sattLage();
    } catch (err) {
      if (destroyed) return;
      // Nekad för att gömfasen är slut: servern har (eller får strax) ett gömställe åt mig –
      // hämta det med kgAnslut, annars står figuren fel och hjärtslaget räknas mot fel plats.
      if (err?.code === "failed-precondition" && (await hamtaGomstalle())) return;
      fel(err?.message || "Kunde inte låsa – försök igen.");
      $("[data-las]").disabled = false;
    } finally { laser = false; }
  }
  async function hamtaGomstalle() {
    try {
      const i2 = await api.anslut(sid);
      if (destroyed || i2.roll !== "gomd" || !i2.gomstalle) return false;
      info = i2;
      gomstalle = i2.gomstalle;
      harLast = true;
      glomPos(lagring, sid);
      scen?.jag({ x: gomstalle.x, z: gomstalle.z, yaw: scen.jag().yaw });
      spel.gomstalle(gomstalle);
      rad(gomdText(gomstalle.namn), "last");
      sattLage();
      return true;
    } catch { return false; }
  }

  /** Det egna kgPlayers: hittad → sökare, poäng, laddningar – och tystnadsregelns egna vissling. */
  let tystRef = null;
  function meUppdaterad(me) {
    if (!me || destroyed || !ready) return;
    if (Number.isFinite(me.poang)) poang = me.poang;
    // Servern visslade åt mig (tystnadsregeln): tystRef flyttas till visslingens t utan att
    // senastSvarAt rörs (ett svar sätter båda). Första läsningen är bara en referens.
    const tr = Number(me.tystRef) || 0;
    if (tystRef != null && me.roll === "gomd" && tr > tystRef && tr !== Number(me.senastSvarAt) && tr > (toMs(info?.tider?.letStart) || 0)) {
      spel.egenVissling(tr);
      rad(TEXT.egenVissling, "egen");
      scen?.hopp();
    }
    tystRef = tr;
    if (Number.isFinite(me.laddningar) && !spel.letar) ritaLampor(me.laddningar);
    if (me.roll === "sokare" && roll === "gomd") {
      roll = "sokare";
      if (me.hittadAvNamn || me.hittadAv) visaHittad(me.hittadAvNamn);
      else rad("Ny sökare – nu letar du!", "hittade");
      sattLage();
    }
    ritaTopp();
  }

  // --- start --------------------------------------------------------------------------------
  async function begin() {
    if (starting || ready || !player || destroyed) return;
    starting = true;
    try {
      info = await api.anslut(sid);
      if (destroyed) return;
      roll = info.roll;
      fas = info.fas || "gom";
      harLast = !!info.harLast;
      gomstalle = info.gomstalle || null;
      poang = info.poang | 0;
      spel.laddningar = info.laddningar | 0;
      if (quiz && !quizQs.length) quizQs = await api.getQuestions(sid).catch(() => []);
      if (Number.isInteger(info.nextQ)) spel.setNextQ(info.nextQ);
      const { skapaKgScen } = await import("./scen/kg-scen.js");
      const l0 = elevLage({ roll, fas });
      scen = await skapaKgScen({ yta, lage: scenLage(l0, harLast), roster, jagUid: uid, namnPa: st?.session?.showNames !== false, tvinga2d });
      if (destroyed) { scen.destroy(); return; }
      // Startplatsen: gömstället (låst/omladdning), serverns start (sökare), sparad plats (omladdning i gömfasen) eller kanten.
      if (gomstalle) scen.jag({ x: gomstalle.x, z: gomstalle.z, yaw: 0 });
      else if (roll === "sokare" && info.start) scen.jag({ ...info.start, yaw: 0 });
      else scen.jag(lasPos(lagring, sid) || startplats(uid));
      scen.on("skydd", ritaMatare);
      kanal = api.kanal({ sid, uid });
      await kanal.start();
      if (destroyed) return;
      kanal.paStatus((s) => { if (s?.fas) sattFas(s.fas); });
      spel.koppla({ scen, kanal });
      spel.gomstalle(gomstalle);
      unMe = api.watchMe(sid, uid, meUppdaterad, (e) => console.warn("Kurragömma: kgPlayers", e));
      ready = true;
      $("[data-vanta]").hidden = true;
      sattLage();
    } catch (err) {
      if (destroyed) return;
      console.warn("Kurragömma: kunde inte ansluta", err);
      $("[data-vanta]").textContent = `Kunde inte ansluta till ön (${err?.message || err}) – försöker igen …`;
      setTimeout(() => { starting = false; begin(); }, 4000);
      return;
    }
    starting = false;
  }

  // Gömfasens slut på klientens klocka – servern byter fas lat i nästa anrop ändå.
  const ticker = setInterval(() => {
    if (destroyed || !ready) return;
    ritaTopp();
    const gomSlut = toMs(info?.tider?.gomSlut);
    if (fas === "gom" && gomSlut) {
      const t = now();
      if (t >= gomSlut && roll === "gomd" && !harLast) lasNu();
      if (t >= gomSlut + LAS_MARGINAL_MS + 500) sattFas("leta");
    }
  }, 250);

  // --- knappar och tangenter ---------------------------------------------------------------------
  $("[data-las]").addEventListener("click", () => lasNu());
  $("[data-leta]").addEventListener("click", () => spel.leta());
  $("[data-fall]").addEventListener("click", () => {
    const ihop = root.classList.toggle("kge-ihop");
    $("[data-fall]").setAttribute("aria-expanded", String(!ihop));
  });
  function onKey(e) {
    if (lage !== "leta-sokare" || !letaTangent(e)) return;
    if (e.key !== " " && e.target?.closest?.("input, textarea")) return; // E i ett textfält lämnas i fred
    e.preventDefault();
    spel.leta();
  }
  host.ownerDocument.addEventListener("keydown", onKey, true);
  const anpassa = () => { root.dataset.panel = panelLage(root.clientWidth); };
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(anpassa) : null;
  if (ro) ro.observe(root);
  anpassa();

  // --- slutet ---------------------------------------------------------------------------------
  function drawEnd() {
    if (!slutGjort && st?.phase !== "cancelled") {
      slutGjort = true;
      spel.fragor(false);
      scen?.paus(true);
      const [a, b] = AVSLUTA_EFTER_MS;
      const forsok = (kvar) => {
        if (destroyed || st?.result || !player) return;
        api.avsluta(sid).catch(() => { if (kvar > 0) avslutaT = setTimeout(() => forsok(kvar - 1), 15_000); });
      };
      avslutaT = setTimeout(() => forsok(2), a + Math.random() * (b - a));
    }
    if (st?.result && !coinTimers && myReward(st.result, uid)) {
      const refresh = () => { if (!destroyed) onCoins(); };
      coinTimers = [setTimeout(refresh, 4000), setTimeout(refresh, 15000)];
    }
  }

  function sync() {
    if (destroyed || !st) return;
    const ph = st.phase;
    if (ph === "ended" || ph === "finished" || ph === "cancelled") return drawEnd();
    if (ph !== "live") return;
    if (!player) return;
    if (!ready) begin();
    else { scen?.namnPa(st.session?.showNames !== false); ritaTopp(); }
  }

  return {
    update(next, p) {
      st = next;
      player = p;
      sync();
    },
    destroy() {
      destroyed = true;
      clearInterval(ticker);
      [radT, felT, hittadT, sparT, avslutaT].forEach(clearTimeout);
      (coinTimers || []).forEach(clearTimeout);
      ro?.disconnect();
      host.ownerDocument.removeEventListener("keydown", onKey, true);
      unMe?.();
      spel.destroy();
      try { kanal?.stang(); } catch { /* redan stängd */ }
      scen?.destroy();
      view.classList.remove("kge-elev-vy");
    },
  };
}
