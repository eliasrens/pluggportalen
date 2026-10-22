// ============================================================================
// Meteorstormen ☄️ (#823, spec §5): ELEVENS SPELYTA utan Firebase –
// meteorstorm-student.js kopplar in Cloud Functions/Firestore (api =
// meteorstorm-data.js), förhandsvisningen och demot en låtsasserver
// (ms-elev-demo.js). Kärnan äger lobbyns ram, 3-2-1-KÖR!, närvaro, sen
// anslutning och slutskärmens ram; här ritas resten.
//
// Layout (mobil 375 px och Chromebook, utan scroll):
//   överst   ⚡ energi (fem prickar) · den egna stationen (skrov + sköld ur
//            msPublic/status) · de andras skrov som små mätare · klockan
//   banderoll  pågående händelse (☀️ Solstorm … med sekunder kvar)
//   mitten   frågan (kistspelets createQuestionFlow: skriv själv, flerval,
//            tidslinje) ELLER, efter ett rätt svar, tre stora knappar
//            🛡️ Sköld · 🔫 Laser · 🌀 Dragstråle med kostnad (gråa utan råd,
//            dragstrålen med nedräkning; ingen dragstråle i En klass/Attacker
//            av) + "Spara energin". Genvägar 1 2 3 och mellanslag.
//   kvittens  "🛡️ +0,6 – skölden 34/60" ur msAgera-svaret, ~2,5 s
//
// Svar + handling i ETT anrop (Elias 2026-10-21): ms-klient.js håller det
// rätta svaret tills eleven valt och skickar båda i msAgera; fel svar
// buffras där. lage() körs när spelet börjar (återställer läget efter en
// omladdning). Serverns 1,5 s-spärr: klienten väntar själv en gång; vyn
// väntar sedan lugnt och försöker igen – ingen felruta mot eleven.
// Slutet: felbufferten skickas (skickaFel), och om inget result kommit efter
// ~20–35 s ber eleven servern avsluta (msAvsluta – idempotent; mynten betalar
// läraren ut).
//
// API
//   createMsStage({ view, host, uid, classId, session, mode, answerKind },
//                 { api, now, onCoins?, css? }) → { update(st, player), destroy() }
//     api = { skapaKlient(opts), skapaStatusvakt(sid, cb), getQuestions(sid), avsluta(sid) }
//     now() = serverkorrigerad klocka · onCoins() = läraren har betalat ut
// ============================================================================

import { ensureLiveCss } from "../../live-css.js";
import { myReward } from "../../live-rewards.js";
import { createQuestionFlow } from "../../kistspel/ks-fraga.js";
import { ENERGI_TAK } from "./delat/ms-balans.js";
import {
  stageAction, planCfg, minStation, andraStationer, energiVinst, knappar, tangentTyp, kvittens, handelseRad,
  stationRad, lagesRad,
} from "./ms-elev.js";
import { stationSvg, matareHtml } from "./ms-station-mini.js";

export const MSE_CSS = ["src/live/formats/meteorstorm/meteorstorm-elev.css"];
const PART_OF = { laddar: "vanta", fraga: "svar", val: "val", slut: null };
const KVITTO_MS = 2600;
const VANTA_MAX_MS = 30_000;
const AVSLUTA_EFTER_MS = [20_000, 35_000];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const paus = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMsStage({ view, host, uid, classId, session, mode, answerKind }, { api, now, onCoins = () => {}, css = MSE_CSS }) {
  ensureLiveCss(css);
  view.classList.add("mse-elev-vy");
  const sid = session.id;
  const quiz = mode.id === "plugga_quiz";
  const egetNamn = session.classNames?.[classId] || classId || "";
  host.innerHTML = `<div class="mse-elev">
      <div class="mse-topp">
        <div class="mse-energi" aria-live="polite"><span class="mse-energi-tal"></span><span class="mse-prickar" aria-hidden="true"></span></div>
        <div class="mse-egen"><div class="mse-egen-bild"></div><div class="mse-egen-text"><b>${esc(egetNamn)}</b><span class="mse-egen-rad"></span></div></div>
        <div class="mse-andra"></div>
        <span class="mse-klocka" aria-label="Tid kvar"></span>
      </div>
      <p class="mse-banderoll" role="status" hidden></p>
      <p class="mse-lagesrad" hidden></p>
      <p class="mse-felrad" role="status" hidden></p>
      <div class="mse-mitt">
        <div class="mse-svar"></div>
        <div class="mse-val" hidden>
          <p class="mse-val-rubrik">✅ Rätt! Vad ska energin göra?</p>
          <div class="mse-knappar"></div>
          <button type="button" class="mse-spara" data-typ="spara">⚡ Spara energin <kbd>mellanslag</kbd></button>
        </div>
        <p class="mse-vanta" hidden>⏳ Ansluter till rymdstationen …</p>
      </div>
      <div class="mse-kvitto" role="status" aria-live="polite" hidden></div>
    </div>`;
  const $ = (s) => host.querySelector(s);
  const root = $(".mse-elev");
  const parts = { svar: $(".mse-svar"), val: $(".mse-val"), vanta: $(".mse-vanta") };

  const klient = api.skapaKlient({ sid, uid, seed: session.msSeed, gameMode: session.gameMode, antalFragor: session.questionCount || 0 });
  let vakt = null;
  let status = null;
  let st = null;
  let player = null;
  let destroyed = false;
  let quizQs = [];
  let ready = false;
  let starting = false;
  let lage = "laddar";
  let busy = false;
  let skickar = null; // typen som skickas just nu
  let shownAt = 0;
  let slutGjort = false;
  let avslutaT = 0;
  let coinTimers = null;
  let kvittoT = 0;
  let felT = 0;
  let stationNyckel = "";
  let cfg = null; // stormplanen ur fröet – händelserna och energins vinst utan läsningar
  const ticker = setInterval(() => { if (!destroyed && stageAction(st?.phase) === "spel") { drawTop(); if (lage === "val") drawVal(); } }, 1000);

  const fragor = quiz ? mode : { ...mode, createSource: klient.kalla };
  const flow = createQuestionFlow(parts.svar, {
    mode: fragor, answerKind, tlCls: "mse-svar-tl",
    questions: () => quizQs,
    send: (payload) => klient.svara(payload),
    onCorrect: () => visaVal(),
    onProblem: (err) => {
      if (over()) return;
      if (err?.details?.omsynk) return flow.setNextQ(klient.fraga());
      fel(err?.code === "resource-exhausted" ? "⏳ Lugn i stormen – ett svar i taget!" : "📡 Svaret kom inte fram – försök igen.");
    },
  });

  const over = () => destroyed || stageAction(st?.phase) !== "spel";

  // --- Toppraden ----------------------------------------------------------------
  function energiNu() {
    const e = Number(klient.energi) || 0;
    return lage === "val" ? Math.min(ENERGI_TAK, e + energiVinst(status, now(), cfg)) : e;
  }

  function drawTop() {
    const e = energiNu();
    $(".mse-energi-tal").textContent = `⚡ ${e}`;
    $(".mse-energi").setAttribute("aria-label", `Energi ${e} av ${ENERGI_TAK}`);
    $(".mse-prickar").innerHTML = Array.from({ length: ENERGI_TAK }, (_, i) => `<i${i < e ? ' class="pa"' : ""}></i>`).join("");
    const mine = minStation(status, classId);
    const nyckel = mine ? `${mine.skrov}|${Math.round(mine.skold)}|${mine.flyter}` : "";
    if (nyckel !== stationNyckel) {
      stationNyckel = nyckel;
      $(".mse-egen-bild").innerHTML = stationSvg(mine || {});
    }
    $(".mse-egen-rad").textContent = stationRad(mine);
    $(".mse-andra").innerHTML = andraStationer(status, classId, session).map((x) => matareHtml(x)).join("");
    $(".mse-klocka").textContent = st?.clock ? `⏱ ${st.clock}` : "";
    const h = handelseRad(status, now(), cfg);
    const ban = $(".mse-banderoll");
    ban.hidden = !h;
    if (h) {
      ban.textContent = h.text;
      ban.dataset.typ = h.typ;
    }
    const rad = lagesRad(mine, egetNamn);
    $(".mse-lagesrad").hidden = !rad;
    $(".mse-lagesrad").textContent = rad;
  }

  function onStatus(s) {
    if (!s || destroyed) return;
    status = s;
    drawTop();
    if (lage === "val") drawVal();
  }

  // --- Lägen i mitten -------------------------------------------------------------
  function show(l) {
    lage = l;
    for (const [k, el] of Object.entries(parts)) el.hidden = k !== PART_OF[l];
    root.dataset.lage = l;
  }

  function fel(text) {
    const f = $(".mse-felrad");
    f.textContent = text || "";
    f.hidden = !text;
    clearTimeout(felT);
    if (text) felT = setTimeout(() => { f.hidden = true; }, 3500);
  }

  function visaKvitto(k) {
    if (!k) return;
    const box = $(".mse-kvitto");
    box.textContent = k.text;
    box.dataset.ton = k.ton;
    box.hidden = false;
    clearTimeout(kvittoT);
    kvittoT = setTimeout(() => { box.hidden = true; }, KVITTO_MS);
  }

  function nastaFraga() {
    busy = false;
    skickar = null;
    if (over()) return drawTop();
    show("fraga");
    drawTop();
    flow.show();
  }

  function visaVal() {
    if (over()) return;
    flow.hide();
    show("val");
    shownAt = Date.now();
    busy = false;
    drawVal();
    drawTop();
    root.querySelector(".mse-knapp:not([disabled])")?.focus({ preventScroll: true });
  }

  function drawVal() {
    const lista = knappar({ energi: klient.energi, vinst: energiVinst(status, now(), cfg), status, classId, session, now: now() });
    const box = $(".mse-knappar");
    const html = lista.map((k) => `<button type="button" class="mse-knapp mse-knapp-${k.typ}${skickar === k.typ ? " mse-skickar" : ""}" data-typ="${k.typ}"${k.kan && !busy ? "" : " disabled"}
        aria-keyshortcuts="${k.tangent}"><span class="mse-knapp-ikon" aria-hidden="true">${k.ikon}</span><b>${esc(k.namn)}</b>
        <small>${esc(k.info)}</small><kbd>${k.tangent}</kbd></button>`).join("");
    if (box.dataset.html !== html) {
      const fokus = host.ownerDocument.activeElement?.dataset?.typ;
      box.innerHTML = html;
      box.dataset.html = html;
      if (fokus) box.querySelector(`[data-typ="${fokus}"]:not([disabled])`)?.focus({ preventScroll: true });
    }
    box.dataset.antal = String(lista.length);
    $(".mse-spara").disabled = busy;
    $(".mse-spara").classList.toggle("mse-skickar", skickar === "spara");
  }

  async function agera(typ) {
    for (let n = 0, vantat = 0; ; n++) {
      try {
        return await klient.agera(typ);
      } catch (err) {
        const v = Number(err?.details?.vantaMs);
        if (err?.code !== "resource-exhausted" || n >= 4 || vantat > VANTA_MAX_MS || over()) throw err;
        visaKvitto({ text: "⏳ Ett ögonblick – energin skickas strax …", ton: "lugn" });
        const ms = Math.min(Math.max(v > 0 ? v + 100 : 1500, 500), 15_000);
        vantat += ms;
        await paus(ms);
      }
    }
  }

  async function valj(typ) {
    if (busy || lage !== "val" || over()) return;
    const k = knappar({ energi: klient.energi, vinst: energiVinst(status, now(), cfg), status, classId, session, now: now() })
      .find((x) => x.typ === typ);
    if (typ !== "spara" && !k?.kan) return;
    busy = true;
    skickar = typ;
    drawVal();
    let res;
    try {
      res = await agera(typ);
    } catch (err) {
      if (destroyed) return;
      if (over()) return drawEnd();
      if (err?.details?.omsynk || !klient.vantar()) {
        // Ordningen stämde inte (annan flik) – klienten har börjat om efter serverns länk.
        if (quiz) flow.setNextQ(klient.fraga());
        return nastaFraga();
      }
      busy = false;
      skickar = null;
      drawVal();
      fel(err?.code === "resource-exhausted" ? "⏳ Stationen är upptagen – tryck igen om en stund." : "📡 Stationen svarar inte just nu – tryck igen.");
      return;
    }
    if (destroyed) return;
    vakt?.fran(res?.status);
    visaKvitto(kvittens(res, { classId, session }));
    nastaFraga();
  }

  parts.val.addEventListener("click", (e) => {
    const b = e.target.closest("[data-typ]");
    if (b && !b.disabled) valj(b.dataset.typ);
  });
  function onKey(e) {
    if (lage !== "val" || e.defaultPrevented || Date.now() - shownAt < 200) return;
    const typ = tangentTyp(e);
    if (!typ) return;
    e.preventDefault();
    valj(typ);
  }
  host.ownerDocument.addEventListener("keydown", onKey);

  // --- Start och slut -----------------------------------------------------------------
  async function begin() {
    if (starting || ready || !player || over()) return;
    starting = true;
    show("laddar");
    vakt ||= api.skapaStatusvakt(sid, onStatus);
    if (quiz && !quizQs.length) quizQs = await api.getQuestions(sid).catch(() => []);
    try {
      const r = await klient.lage();
      vakt.fran(r?.status);
    } catch { /* servern nås inte just nu – klientens sparade läge gäller, nästa svar synkar */ }
    if (quiz) flow.setNextQ(klient.fraga());
    ready = true;
    starting = false;
    if (destroyed) return;
    if (over()) return sync();
    nastaFraga();
  }

  function drawEnd() {
    if (lage !== "slut") {
      flow.hide();
      show("slut");
      $(".mse-kvitto").hidden = true;
    }
    if (!slutGjort && st?.phase !== "cancelled") {
      slutGjort = true;
      vakt?.stop();
      klient.skickaFel().catch(() => {});
      const [a, b] = AVSLUTA_EFTER_MS;
      avslutaT = setTimeout(() => {
        if (!destroyed && !st?.result && player) api.avsluta(sid).catch(() => {});
      }, a + Math.random() * (b - a));
    }
    if (st?.result && !coinTimers && myReward(st.result, uid)) {
      const refresh = () => { if (!destroyed) onCoins(); };
      coinTimers = [setTimeout(refresh, 4000), setTimeout(refresh, 15000)];
    }
  }

  function sync() {
    if (destroyed || !st) return;
    if (!cfg && st.session) cfg = planCfg(st.session);
    const what = stageAction(st.phase);
    if (what === "slut") return drawEnd();
    if (what !== "spel") return;
    drawTop();
    if (!player) return show("laddar");
    if (!ready) begin();
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
      clearTimeout(kvittoT);
      clearTimeout(felT);
      clearTimeout(avslutaT);
      (coinTimers || []).forEach(clearTimeout);
      vakt?.stop();
      host.ownerDocument.removeEventListener("keydown", onKey);
      flow.destroy();
      view.classList.remove("mse-elev-vy");
    },
  };
}
