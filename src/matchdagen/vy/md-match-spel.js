// ============================================================================
// Matchdagen (#869): MATCHEN (spec §3, §4, §5, §14) – resultatskylten som på tv,
// planen (3D eller 2D-reserven, md-plan.js), kommentatorns rad och frågekortet
// direkt under planen. Varje läge: valet (1–4), frågan/frågorna (md-svar.js),
// motorn (md-motor.js spela), animationen, och den pågående matchen sparas
// lokalt (md-lokal.js) – en omladdning fortsätter där eleven slutade. Halvtid
// med paus, slutsignal, rutan efter matchen och EN sparning (karriär + matcher).
// ============================================================================

import { andraHalvlek, antalFragor, lage, lagbonus, nyMatch, resultat, spela } from "../delat/md-motor.js";
import { LAGE_TEXT } from "../delat/md-texter.js";
import { matchKlar, nastaMatch } from "../delat/md-sasong.js";
import { laggIKo, rensaPagaende, sparaPagaende } from "../md-lokal.js";
import { sparaKon } from "../md-spara.js";
import { kortNamn } from "../plan/md-plan.js";
import { chip, esc, ruta, valMeny, vanta } from "./md-vy-delat.js";
import { omgangText } from "./md-vy-match.js";

const LJUS = new Set(["#f2f2f2"]);

/** Frågeströmmen (en per besök – områdena läses en gång, §13) och källornas namn till statistiken. */
async function strom(S) {
  if (S.strom) return S.strom;
  const kallNamn = {};
  const { skapaFragestrom } = await import("../md-fragor.js");
  const s = await skapaFragestrom({
    inst: S.inst, uid: S.uid,
    hamtaOmrade: async (subj, area) => {
      const a = await S.hamtaOmrade(subj, area);
      if (a?.name) { kallNamn[`omrade:${subj}/${area}`] = a.name; kallNamn[`rakna:${subj}/${area}`] = a.name; }
      return a;
    },
  });
  for (const t of S.inst.tabeller) kallNamn[`tabell:${t}`] = `${t}:ans tabell`;
  S.strom = { ...s, kallNamn };
  return S.strom;
}

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
    kort: el.querySelector(".md-kortyta"), res: el.querySelector("[data-res]"), tid: el.querySelector("[data-tid]"),
    ljudKnapp: el.querySelector("[data-ljud]"), fps: el.querySelector(".md-fps"),
  };
}

export async function spelaMatch(S, el, { pagaende = null } = {}) {
  const n = nastaMatch(S.K);
  const fr = await strom(S);
  if (fr.tom) throw Object.assign(new Error("inga frågor"), { meddelande: fr.meddelande });
  const nu = Date.now();
  const post = pagaende || {
    sasong: S.K.sasong, omg: S.K.liga.omg, matchId: `s${S.K.sasong}-d${S.K.div}-o${n.omg + 1}-${nu.toString(36)}`,
    m: nyMatch({ mot: { namn: n.mot.namn, styrka: n.mot.styrka }, bonus: lagbonus(S.K.trupp), div: S.K.div, nu }),
  };
  let m = post.m;
  if (pagaende) m.senast = nu; // tiden borta räknas inte (MAX_LAGE_S)
  const v = layout(S, el, n.mot);
  const kapten = S.K.trupp.findIndex((p) => p.kapten);
  const [{ skapaPlan }, { skapaLjud }, avatar] = await Promise.all([import("../plan/md-plan.js"), import("../plan/md-ljud.js"), avatarBild(S)]);
  const ljud = skapaLjud({ lugnt: S.lugnt });
  const sattLjudknapp = () => {
    v.ljudKnapp.setAttribute("aria-pressed", String(ljud.pa));
    v.ljudKnapp.textContent = ljud.pa ? "Ljud på" : "Ljud av";
  };
  sattLjudknapp();
  v.ljudKnapp.addEventListener("click", () => { ljud.satt(!ljud.pa); sattLjudknapp(); });
  let utropTimer = 0;
  const plan = await skapaPlan({
    yta: v.yta, lugnt: S.lugnt, tvinga2d: S.tvinga2d, avatar,
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
  const sparaLokalt = () => sparaPagaende(S.lagring, S.uid, { sasong: post.sasong, omg: post.omg, matchId: post.matchId, m });
  plan.stall(m, { avspark: m.lagen === 0 || m.x === 50 });
  skylt();
  sag(m.lagen ? "Matchen fortsätter!" : `${omgangText(S.K, n)} · Avspark!`);
  ljud.sorl(true);
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
    for (let i = 0; i < antalFragor(m, valId); i++) {
      if (i === 1) sag(LAGE_TEXT.dubbel);
      const f = fr.nasta();
      const { visaFraga } = await import("../md-svar.js");
      const r = await visaFraga(v.kort, f, { ratta: fr.ratta, klocka: S.inst.klocka, signal });
      if (r.avbruten) return;
      svar.push({ ratt: r.ratt, kalla: f.kalla });
    }
    const ut = spela(m, valId, svar, Math.random, Date.now());
    m = ut.m;
    sparaLokalt();
    v.kort.innerHTML = "";
    sag(ut.h.rad);
    await plan.spela(ut.h, m);
    skylt();
  }

  // Slutsignal → resultatet, sparningen (EN batch) och rutan efter matchen.
  ljud.spela("slutvissla");
  ljud.sorl(false);
  sag("Slutsignal!");
  v.kort.innerHTML = "";
  const res = resultat(m);
  const klar = matchKlar(S.K, { res, rng: Math.random, nu: Date.now(), matchId: post.matchId, kallNamn: fr.kallNamn });
  S.K = klar.K;
  // Kön först (då försvinner ingen match om sparningen misslyckas), sedan hela kön
  // med den nya karriären – tidsgränsen i md-data.js gör att rutan aldrig hänger offline.
  laggIKo(S.lagring, S.uid, { K: klar.K, matchId: post.matchId, match: klar.match });
  rensaPagaende(S.lagring, S.uid);
  const sparad = await sparaKon(S, klar.K);
  S.kassa();
  await vanta(S.lugnt ? 200 : 700);
  const valet = await efterMatchen(S, res, klar, n.mot, sparad, signal);
  stang();
  if (valet) S.visa("tabell");
}

/** Rutan efter matchen (§5): resultat, rätt svar, skott, lyckade pass och pengar – och pauspåminnelsen (§1.2). */
function efterMatchen(S, res, klar, mot, sparad, signal) {
  const st = res.stat;
  const rubrik = res.utfall === "vinst" ? "Seger!" : res.utfall === "oavgjort" ? "Oavgjort" : "Förlust – nästa gång!";
  const paus = S.inst.paus > 0 && Date.now() - S.sessionStart >= S.inst.paus * 60000;
  if (paus) S.sessionStart = Date.now();
  return ruta(S.host, {
    rubrik: `${rubrik} ${res.oss} – ${res.dem}`,
    klass: "md-efter",
    html: `<p class="md-svag">mot ${esc(mot.namn)}</p>
      <div class="md-siffror">
        <div><b>${st.ratt}/${st.fragor}</b>rätt svar</div><div><b>${st.skott}</b>skott</div>
        <div><b>${st.passOk}/${st.pass}</b>lyckade pass</div><div><b>+${klar.pengar}</b>kr till klubbkassan</div>
      </div>
      ${paus ? `<p class="md-paus">Bra jobbat! Dags för en paus.</p>` : ""}
      ${sparad ? "" : `<p class="md-svag">Matchen sparas så fort det går – den finns kvar på den här datorn.</p>`}`,
    knappar: [{ id: "vidare", text: klar.sasongKlar ? "Se hur säsongen slutade" : "Till tabellen" }],
  }, signal);
}
