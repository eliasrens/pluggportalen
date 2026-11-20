// ============================================================================
// Matchdagen (#869): MATCHEN (spec §3, §4, §5, §14) – resultatskylten som på tv,
// planen (3D eller 2D-reserven, md-plan.js), kommentatorns rad och frågekortet
// direkt under planen. Varje läge: valet (1–4), frågan/frågorna (md-svar.js),
// motorn (md-motor.js spela), animationen, och den pågående matchen sparas
// lokalt (md-lokal.js) – en omladdning fortsätter där eleven slutade. Halvtid
// med paus, slutsignal, rutan efter matchen och EN sparning (karriär + matcher).
// Kvalet (#870, §7.2): samma match mot laget från divisionen ovanför; oavgjort →
// straffläggningen (md-straff-spel.js), och rutan efter berättar om uppflyttningen.
// Silverpokalen (#872, §9.1): en cupmatch avgörs också på straffar (md-cup.js cupKlar), och
// rutan efter matchen (md-efter-match.js) visar nya rekord (§9.2) direkt.
// Mästarcupen (#873, §10.2): samma match med straffar (md-mastarcup.js mcKlar); finalen får
// introt "FINALEN", fullsatt läktare med flaggor och ett större jubel, och en vunnen final eller
// en vunnen Superliga (§10.1) slutar med firandet på planen (plan.fest: pokalen lyfts,
// fyrverkerier i lugnt tempo – inga i lugnt läge) före rutan efter matchen.
// ============================================================================

import { andraHalvlek, antalFragor, arKlar, behoverFraga, behoverStraffar, lage, lagbonus, nyMatch, resultat, spela } from "../delat/md-motor.js";
import { LAGE_TEXT } from "../delat/md-texter.js";
import { matchKlar, motFarg } from "../delat/md-sasong.js";
import { kvalKlar } from "../delat/md-kval.js";
import { cupKlar } from "../delat/md-cup.js";
import { mcKlar } from "../delat/md-mastarcup.js";
import { laggIKo, rensaPagaende, sparaPagaende } from "../md-lokal.js";
import { kaptenPlats } from "../delat/md-trupp.js";
import { sparaKon } from "../md-spara.js";
import { kortNamn } from "../plan/md-plan.js";
import { chip, esc, ruta, valMeny, vanta } from "./md-vy-delat.js";
import { strom } from "./md-strom.js";
import { nastaSpel, startaNastaSasong } from "./md-vy-match.js";
import { efterMatchen } from "./md-efter-match.js";

const LJUS = new Set(["#f2f2f2"]);

async function avatarBild(S) {
  if (!S.avatar) return null;
  try {
    const { ritaAvatar, BILD_BREDD, BILD_HOJD } = await import("../../live/formats/kurragomma/scen/kg-avatar-bild.js");
    const c = document.createElement("canvas");
    c.width = BILD_BREDD / 2;
    c.height = BILD_HOJD / 2;
    await Promise.race([ritaAvatar(c, S.avatar), vanta(2500)]);
    return c;
  } catch { return null; }
}

/** Hela namnet på bred skärm, förkortningen ("BIF") på smal – som på tv. */
const namnPar = (namn) => `<span class="md-lang">${esc(namn)}</span><span class="md-kortnamn" aria-hidden="true">${esc(kortNamn(namn))}</span>`;

/**
 * Planens höjd efter fönstret (§14): skylt, plan, kommentar och frågekort ska synas
 * samtidigt i 1366 × 768 utan att scrolla – också med appens sidhuvud ovanför.
 * UNDER = kommentarens rad + frågekortet (fyra val i två rader) + appens marginal.
 */
const UNDER = 262;
function passaPlanen(plan) {
  const passa = () => {
    if (!plan.isConnected) { window.removeEventListener("resize", passa); return; }
    const topp = plan.getBoundingClientRect().top + window.scrollY;
    const h = Math.round(Math.min(420, Math.max(220, window.innerHeight - topp - UNDER)));
    plan.style.setProperty("--md-plan-h", `${h}px`);
  };
  passa();
  window.addEventListener("resize", passa);
}

function layout(S, el, mot) {
  const vi = S.K.klubb;
  el.innerHTML = `<div class="md-match${S.lugnt ? " lugnt" : ""}">
    <div class="md-skylt" aria-live="polite">
      <div class="md-skylt-lag">${chip(vi.farg)}${namnPar(vi.namn)}</div>
      <div class="md-skylt-res" data-res>0 – 0</div>
      <div class="md-skylt-lag">${namnPar(mot.namn)}${chip(mot.farg)}</div>
      <div class="md-skylt-tid" data-tid>0'</div>
      <div class="md-skylt-straff" data-straff hidden></div>
    </div>
    <div class="md-plan">
      <div class="md-yta"></div>
      <div class="md-utrop" aria-hidden="true"></div>
      <button type="button" class="md-ljudknapp" data-ljud aria-pressed="false"></button>
      <span class="md-fps" hidden></span>
    </div>
    <p class="md-kommentar" aria-live="polite"></p>
    <div class="md-kortyta"></div>
  </div>`;
  passaPlanen(el.querySelector(".md-plan"));
  return {
    yta: el.querySelector(".md-yta"), utrop: el.querySelector(".md-utrop"), kommentar: el.querySelector(".md-kommentar"),
    kort: el.querySelector(".md-kortyta"), res: el.querySelector("[data-res]"), tid: el.querySelector("[data-tid]"), straff: el.querySelector("[data-straff]"),
    ljudKnapp: el.querySelector("[data-ljud]"), fps: el.querySelector(".md-fps"),
  };
}

export async function spelaMatch(S, el, { pagaende = null, spel = null } = {}) {
  const n0 = spel || nastaSpel(S.K, S.uid);
  const kval = n0.typ === "kval";
  const cup = n0.typ === "cup";
  const mc = n0.typ === "mastarcup";
  const final = mc && !!n0.final;
  // Samma tröjfärg som motståndaren (eleven bytte färg mitt i säsongen)? De spelar i en annan.
  const n = { ...n0, mot: { ...n0.mot, farg: motFarg(S.K.klubb.farg, n0.mot.farg) } };
  const fr = await strom(S);
  if (fr.tom) throw Object.assign(new Error("inga frågor"), { meddelande: fr.meddelande });
  const nu = Date.now();
  const post = pagaende || {
    sasong: S.K.sasong, omg: S.K.liga.omg, typ: n.typ, ...(cup || mc ? { runda: n.runda } : {}),
    matchId: `s${S.K.sasong}-d${S.K.div}-${kval ? "kval" : cup ? `cup${n.runda + 1}` : mc ? `mc${n.runda + 1}` : `o${n.omg + 1}`}-${nu.toString(36)}`,
    m: nyMatch({ mot: { namn: n.mot.namn, styrka: n.mot.styrka }, bonus: lagbonus(S.K.trupp), div: S.K.div, avgor: kval || cup || mc, nu }),
  };
  let m = post.m;
  if (pagaende) m.senast = nu; // tiden borta räknas inte (MAX_LAGE_S)
  const v = layout(S, el, n.mot);
  const kapten = kaptenPlats(S.K.trupp);
  const [{ skapaPlan }, { skapaLjud }, avatar] = await Promise.all([import("../plan/md-plan.js"), import("../plan/md-ljud.js"), avatarBild(S)]);
  const ljud = skapaLjud({ lugnt: S.lugnt, final });
  const sattLjudknapp = () => {
    v.ljudKnapp.setAttribute("aria-pressed", String(ljud.pa));
    v.ljudKnapp.textContent = ljud.pa ? "Ljud på" : "Ljud av";
  };
  sattLjudknapp();
  v.ljudKnapp.addEventListener("click", () => { ljud.satt(!ljud.pa); sattLjudknapp(); });
  let utropTimer = 0;
  const plan = await skapaPlan({
    yta: v.yta, lugnt: S.lugnt, tvinga2d: S.tvinga2d, avatar, final,
    vi: { troja: S.K.klubb.farg, byxor: LJUS.has(S.K.klubb.farg) ? "#1d2c4a" : "#ffffff", mv: "#ffd23f", kapten },
    dem: { troja: n.mot.farg, byxor: "#1c2433", mv: "#1b1b1b" },
    hooks: {
      ljud: (x) => ljud.spela(x),
      utrop(text, ms) {
        clearTimeout(utropTimer);
        v.utrop.textContent = text;
        v.utrop.classList.add("visa");
        utropTimer = setTimeout(() => v.utrop.classList.remove("visa"), S.lugnt ? Math.min(ms, 900) : ms);
      },
    },
  });
  el.querySelector(".md-match").dataset.ritare = plan.typ;
  S.spel = { pagar: true, plan, post };
  const signal = S.signal;
  let fpsTimer = 0;
  const stang = () => {
    signal?.removeEventListener("abort", stang);
    plan.dispose(); ljud.stang(); clearInterval(fpsTimer); S.spel = null;
  };
  signal?.addEventListener("abort", stang, { once: true });
  if (/[?&]fps=1/.test(location.search + location.hash)) {
    v.fps.hidden = false;
    fpsTimer = setInterval(() => { const f = plan.fps(); v.fps.textContent = `${plan.typ} · ${f.snitt} fps${f.lagst ? ` (lägst ${f.lagst})` : ""}`; }, 1000);
  }

  const skylt = () => {
    v.res.textContent = `${m.oss} – ${m.dem}`;
    v.tid.textContent = `${Math.min(90, Math.round(m.min))}'`;
  };
  const sag = (t) => { v.kommentar.textContent = t; };
  let klar = null;
  const sparaLokalt = () => { if (!klar) sparaPagaende(S.lagring, S.uid, { sasong: post.sasong, omg: post.omg, typ: post.typ || "liga", runda: post.runda, matchId: post.matchId, m }); };
  // Bokförs i kön SÅ FORT matchen är avgjord, före sista animationen: en flik som
  // stängs under den får inte ge ett nytt försök (allra minst på ett förlorat kval).
  const bokfor = () => {
    if (klar || !arKlar(m)) return;
    const res = resultat(m);
    const o = { res, rng: Math.random, nu: Date.now(), matchId: post.matchId, kallNamn: fr.kallNamn };
    klar = kval ? kvalKlar(S.K, o) : cup ? cupKlar(S.K, { ...o, uid: S.uid }) : mc ? mcKlar(S.K, { ...o, uid: S.uid }) : matchKlar(S.K, o);
    S.K = klar.K;
    laggIKo(S.lagring, S.uid, { K: klar.K, matchId: post.matchId, match: klar.match });
    rensaPagaende(S.lagring, S.uid);
  };
  plan.stall(m, { avspark: m.lagen === 0 || m.x === 50 });
  skylt();
  sag(m.lagen ? "Matchen fortsätter!" : `${n.text} · Avspark!`);
  ljud.sorl(true);
  if (!m.lagen && final) await finalIntro(S, el, n);
  if (!m.lagen) { ljud.spela("vissla"); await vanta(S.lugnt ? 300 : 900); }

  while (!m.slut) {
    if (signal?.aborted) return;
    if (m.halvtid) {
      ljud.spela("slutvissla");
      plan.stall(m, { avspark: false });
      v.kort.innerHTML = "";
      const st = m.stat;
      const svar = await ruta(S.host, {
        rubrik: `Halvtid: ${m.oss} – ${m.dem}`,
        html: `<p>Ta en kort paus. Du har svarat rätt på <b>${st.ratt} av ${st.fragor}</b> frågor hittills.</p>`,
        knappar: [{ id: "vidare", text: "Andra halvlek" }],
      }, signal);
      if (!svar) return;
      m = andraHalvlek(m, Date.now());
      sparaLokalt();
      plan.stall(m, { avspark: true });
      skylt();
      ljud.spela("vissla");
      sag("Andra halvlek – avspark!");
      await vanta(S.lugnt ? 300 : 800);
      continue;
    }
    const l = lage(m);
    sag(l.rad);
    let valId = null;
    if (l.val.length) {
      valId = await valMeny(v.kort, l.val, signal);
      if (!valId) return;
    } else {
      v.kort.innerHTML = "";
      if (!l.fragor) await vanta(S.lugnt ? 300 : 700);
    }
    const svar = [];
    // Läget spelas och sparas lokalt SÅ FORT det sista svaret är givet (vidSvar), före
    // pausen som visar rätt svar – en omladdning då ger ingen ny fråga (#870 F1).
    let ut = null;
    const spelaLaget = () => {
      ut = spela(m, valId, svar, Math.random, Date.now());
      m = ut.m;
      sparaLokalt();
      bokfor();
    };
    // Från Division 3 (§7.3): först finten, sedan skottet – fel på finten avgör direkt.
    if (antalFragor(m, valId) === 2) sag(LAGE_TEXT.dubbel);
    while (!ut && behoverFraga(m, valId, svar)) {
      if (svar.length === 1) sag(LAGE_TEXT.skottEfterFint);
      const f = fr.nasta();
      const { visaFraga } = await import("../md-svar.js");
      const r = await visaFraga(v.kort, f, {
        ratta: fr.ratta, klocka: S.inst.klocka, signal,
        vidSvar: (x) => {
          svar.push({ ratt: x.ratt, kalla: f.kalla });
          if (!behoverFraga(m, valId, svar)) spelaLaget();
        },
      });
      if (r.avbruten) return;
    }
    if (!ut) spelaLaget();
    v.kort.innerHTML = "";
    sag(ut.h.rad);
    await plan.spela(ut.h, m);
    skylt();
  }

  // Slutsignal → (kval och cup: straffar vid oavgjort) → resultatet, sparningen (EN batch) och rutan efter matchen.
  if (!m.straffar) ljud.spela("slutvissla");
  sag("Slutsignal!");
  v.kort.innerHTML = "";
  if (behoverStraffar(m)) {
    if (!pagaende?.m?.straffar) await vanta(S.lugnt ? 300 : 900);
    const { spelaStraffar } = await import("./md-straff-spel.js");
    const ok = await spelaStraffar(S, { m, v, plan, fr, signal, sag, sparaLokalt, satt: (x) => { m = x; bokfor(); } });
    if (!ok) return;
    skylt();
  }
  ljud.sorl(false);
  const res = resultat(m);
  // Kön först (bokfor, då försvinner ingen match om sparningen misslyckas), sedan hela
  // kön med den nya karriären – tidsgränsen i md-data.js gör att rutan aldrig hänger offline.
  bokfor();
  const sparad = await sparaKon(S, klar.K);
  S.kassa();
  await vanta(S.lugnt ? 200 : 700);
  // En titel (§10.1, §10.2): pokalen lyfts på planen före rutan – firandet fortsätter bakom den.
  const titel = mc && klar.vannCupen ? "mastarcup" : klar.mastare ? "superliga" : null;
  if (titel) {
    sag(titel === "mastarcup" ? "Mästarcupen är er – pokalen lyfts!" : "Mästare i Superligan – pokalen lyfts!");
    plan.fest(titel);
    ljud.spela("fanfar");
    ljud.spela("jubel");
    v.utrop.textContent = titel === "mastarcup" ? "MÄSTARCUPEN ÄR ER!" : "MÄSTARE!";
    v.utrop.classList.add("visa", "titel");
    await vanta(S.lugnt ? 1500 : 5000);
  }
  const valet = await efterMatchen(S, { res, klar, mot: n.mot, sparad, signal, typ: n.typ });
  stang();
  if (!valet) return;
  if (kval) startaNastaSasong(S);
  if (valet === "legend") {
    await S.visa("match");
    const { startaLegend } = await import("./md-vy-legend.js");
    return startaLegend(S, S.sektion("match"), () => S.visa("match"));
  }
  S.visa(kval ? "match" : "tabell");
}

/**
 * Introt före finalen i Mästarcupen (§10.2): "FINALEN" över planen med lagen – i lugnt läge
 * och med prefers-reduced-motion utan rörelse och kortare.
 */
async function finalIntro(S, el, n) {
  const d = document.createElement("div");
  d.className = `md-finalintro${S.lugnt ? " lugnt" : ""}`;
  d.setAttribute("role", "status");
  d.innerHTML = `<small>Mästarcupen</small><b>FINALEN</b><span>${esc(S.K.klubb.namn)} – ${esc(n.mot.namn)}</span>`;
  el.querySelector(".md-plan")?.appendChild(d);
  await vanta(S.lugnt ? 1200 : 3200);
  d.remove();
}
