// ============================================================================
// Hitta rätt! – spelflödet (src/hitta-ratt/hr-spel.js) · #608
// ----------------------------------------------------------------------------
// Laddas bara DYNAMISKT från page-hitta-ratt.js (#/elev/hitta-ratt?pack=…),
// aldrig i bootgrafen (#271).
//
// En omgång = ALLA frågor i packet i ny slumpad ordning (§12):
//   1. startaForsok → hittaRattAttempts/{id} (serverns starttid) INNAN första
//      frågan blir aktiv, så Σ aktiv tid alltid ryms i serverns kontroll.
//   2. Per fråga: kartan är interaktiv direkt, ingen nål/inget val förrän
//      eleven klickar (§5/§9). "Lås svar" är inaktiv tills dess. Lås →
//      motorn får facit först nu (showResult/showAreaResult), feedback i text,
//      och eleven trycker själv "Nästa" (ingen auto-vidaregång). "Nästa" tar
//      emot klick först efter en kort spärr – ingen dubbelklicksfälla.
//   3. Aktiv tid (område, §11) = från att frågan blir aktiv till lås; står
//      still under feedbacken (hr-omgang.js skapaStoppur).
//   4. Sista "Nästa" → skickaOmgang (hittaRattSubmit räknar om allt, sparar
//      personbästa/topplista och krediterar coins EN gång) → resultatskärmen.
//      Nätfel → "Försök igen" med SAMMA attemptId (idempotent).
// Lämna-vakten (#605) är på från första frågan tills resultatet skickas.
//
// Egna pack (#633): deps.pack = färdigt pack eller en laddare () => Promise<pack>
// (page-hitta-ratt.js läser hittaRattPacks). Då hämtas ingen packfil ur repot,
// bara geofilen. startvy "auto"/"hel" räknas om till en ruta (hr-egna.js).
// Serverns fel för egna pack (ändrad karta, inte delad, borttagen) får en egen
// vy; "Starta ny omgång" laddar om packet.
// ============================================================================

import { app, el, go, loading, renderTopbar } from "../ui.js";
import { coinIcon } from "../icons.js";
import { esc, formatTid } from "./hr-start-vy.js";
import { blanda, skapaStoppur, skapaOmgang, berom, omradeText, formatKm } from "./hr-omgang.js";
import { resultatHtml, sparFelHtml } from "./hr-resultat-vy.js";
import { armeraLamnaVakt } from "./hr-lamna-vakt.js";
import { arEget, egetSparFel, startvyAuto } from "./hr-egna.js";

const HASH = "#/elev/hitta-ratt";
const NASTA_SPARR_MS = 450;
const KALLOR = { ne: "Natural Earth", "lm-landskap": "Lantmäteriet (CC0)" };

// Klass-EXP (Klasscentret, kc-koppling.js #479) – AV tills Elias bestämt
// (arkitektur §10 fråga 4). TODO: sätt true OCH registrera regeln i
// src/klasscenter/kc-exp-regler.js, t.ex.
//   registreraRegel("hittaratt", andelRegel("Hitta rätt!: varje omgång med minst 50 % godkända svar", 1, 2));
// Utan regeln gör anropet ingenting (behoverSkrivning → false), så flaggan
// ensam ger ingen trafik. Samma fire-and-forget-krok som Läsresan.
export const KLASS_EXP_PA = false;

const jsonCache = new Map();
/** Pack- och geofiler (statiska i repot), cachade per session. */
function hamtaJson(rel) {
  if (!jsonCache.has(rel)) {
    const p = fetch(new URL(`./content/${rel}`, import.meta.url)).then((r) => {
      if (!r.ok) throw new Error(`${rel}: ${r.status}`);
      return r.json();
    });
    p.catch(() => jsonCache.delete(rel)); // nästa försök hämtar igen
    jsonCache.set(rel, p);
  }
  return jsonCache.get(rel);
}

const bildUrl = (fil) => new URL(`./content/bilder/${fil}`, import.meta.url).href;

function felVy(rubrik, text, igen, igenText = "Försök igen") {
  const vy = el(`<div class="panel center hr-stub" role="alert">
    <div class="big-emoji" aria-hidden="true">🧭</div>
    <h2>${esc(rubrik)}</h2>
    <p class="hint">${esc(text)}</p>
    <div class="hr-res-knappar">
      ${igen ? `<button class="btn gron" data-act="igen">${esc(igenText)}</button>` : ""}
      <button class="btn hr-tillbaka" data-act="tillbaka">← Till kartorna</button>
    </div>
  </div>`);
  vy.querySelector('[data-act="tillbaka"]').addEventListener("click", () => go(HASH));
  vy.querySelector('[data-act="igen"]')?.addEventListener("click", igen);
  app.replaceChildren(vy);
}

/**
 * Spela ett pack. `meta` = posten i index.json (id, title, type, geo …).
 * deps (tester/preview): { data: { startaForsok, skickaOmgang },
 *   pack: eget pack | () => Promise<pack> (kastar { code: "not-found" } om det saknas) }
 */
export async function spelaPack(meta, deps = {}) {
  let pack, geo, motor, data;
  try {
    [pack, motor, data] = await Promise.all([
      typeof deps.pack === "function" ? deps.pack() : deps.pack || hamtaJson(`packs/${meta.id}.json`),
      import("./karta/kartmotor.js"),
      deps.data || import("./hr-data.js"),
    ]);
    geo = await hamtaJson(`geo/${pack.geo}.json`);
  } catch (err) {
    if (err?.code === "not-found") {
      felVy("Kartan finns inte längre", "Läraren kan ha tagit bort kartan eller slutat dela den med din klass.");
    } else {
      felVy("Kartan gick inte att ladda", "Kontrollera uppkopplingen och försök igen.", () => spelaPack(meta, deps));
    }
    return;
  }
  if (typeof pack.startvy === "string") pack = { ...pack, startvy: startvyAuto(pack, geo) };
  await nyOmgang({ meta, deps, pack, geo, motor, data });
}

async function nyOmgang(ctx) {
  const { pack, data } = ctx;
  loading("Startar omgången…");
  let attemptId;
  try {
    attemptId = await data.startaForsok(pack.id);
  } catch (err) {
    felVy("Omgången kunde inte startas", err?.message || "Försök igen om en stund.", () => nyOmgang(ctx));
    return;
  }
  spelaOmgang(ctx, attemptId);
}

function spelaOmgang(ctx, attemptId) {
  const { pack, geo, motor } = ctx;
  const omrade = pack.type === "area";
  const ordning = blanda(pack.items);
  const omgang = skapaOmgang(pack, ordning);
  const stoppur = skapaStoppur();
  let godkanda = 0;
  let nastaFran = 0;
  let stadad = false;

  const vy = el(`<div class="hr-spel ${omrade ? "hr-spel-omrade" : "hr-spel-punkt"}">
    <div class="panel hr-spel-topp">
      <div class="hr-spel-info">
        <h1 class="hr-spel-titel">${esc(pack.title)}</h1>
        <span class="hr-spel-nr" data-v="nr"></span>
      </div>
      <div class="hr-spel-matt">
        ${omrade
          ? `<span class="hr-spel-chip" data-v="tid" title="Aktiv svarstid – står still medan du tittar på svaret">⏱️ <b>0:00</b><span class="hr-spel-paus" hidden> · pausad</span></span>
             <span class="hr-spel-chip" data-v="ratt">✅ <b>0</b> rätt</span>`
          : `<span class="hr-spel-chip" data-v="poang">🎯 <b>0</b> p</span>`}
        <span class="hr-spel-chip hr-spel-coins" data-v="coins" title="Coins den här omgången">${coinIcon(20)} <b>0</b></span>
      </div>
      <button class="btn hr-spel-avsluta" data-act="avsluta">Avsluta</button>
      <div class="hr-spel-bar" aria-hidden="true"><span></span></div>
    </div>
    <div class="panel hr-spel-fraga">
      <img class="hr-spel-bild" alt="" hidden />
      <div class="hr-spel-fraga-text">
        <p class="hr-spel-namn" hidden></p>
        <p class="hr-spel-prompt" aria-live="polite"></p>
        <p class="hr-spel-foto" hidden></p>
      </div>
    </div>
    <div class="hr-spel-karta"></div>
    <div class="panel hr-spel-fot">
      <div class="hr-spel-feedback" aria-live="polite"></div>
      <div class="hr-spel-knappar">
        <button class="btn gron hr-las" data-act="las" disabled>Lås svar</button>
        <button class="btn hr-nasta" data-act="nasta" hidden>Nästa →</button>
      </div>
    </div>
  </div>`);
  const $ = (s) => vy.querySelector(s);
  const lasBtn = $(".hr-las");
  const nastaBtn = $(".hr-nasta");
  const feedback = $(".hr-spel-feedback");
  app.replaceChildren(vy);

  const karta = motor.skapaKarta($(".hr-spel-karta"), geo, {
    lage: omrade ? "omrade" : "punkt",
    maxZoom: pack.maxZoom,
    startvy: pack.startvy || pack.bounds || undefined,
    visaGranser: pack.visaGranser,
    attribution: `Kartdata: ${(geo.kalla || ["ne"]).map((k) => KALLOR[k] || k).join(" · ")}`,
  });
  const kanLasa = () => {
    if (!karta.last) lasBtn.disabled = false;
  };
  karta.on("gissning", kanLasa);
  karta.on("val", kanLasa);

  let avarmera = armeraLamnaVakt();
  const tick = setInterval(() => {
    if (!vy.isConnected) return stada();
    if (omrade) ritaTid();
  }, 250);

  function stada() {
    if (stadad) return;
    stadad = true;
    clearInterval(tick);
    karta.destroy();
    avarmera?.();
    avarmera = null;
  }

  function ritaTid() {
    $('[data-v="tid"] b').textContent = formatTid(stoppur.nuMs() / 100);
    $(".hr-spel-paus").hidden = stoppur.pagar || !karta.last; // pausad = under feedbacken
  }

  function ritaMatt() {
    const s = omgang.summa();
    if (omrade) {
      $('[data-v="ratt"] b').textContent = s.r;
      ritaTid();
    } else {
      $('[data-v="poang"] b').textContent = s.s;
    }
    $('[data-v="coins"] b').textContent = godkanda;
    $(".hr-spel-bar span").style.width = `${(100 * s.besvarade) / omgang.antal}%`;
  }

  function visaFraga() {
    const it = omgang.aktuell;
    karta.reset();
    $('[data-v="nr"]').innerHTML = `Fråga <b>${omgang.nr + 1}</b> av ${omgang.antal}`;
    const bild = !omrade && it.bild;
    const img = $(".hr-spel-bild");
    img.hidden = !bild;
    vy.classList.toggle("hr-spel-med-bild", !!bild);
    $(".hr-spel-namn").hidden = !bild;
    $(".hr-spel-foto").hidden = !bild;
    if (bild) {
      img.src = bildUrl(it.bild.fil);
      img.alt = it.name;
      img.width = it.bild.bredd;
      img.height = it.bild.hojd;
      $(".hr-spel-namn").textContent = it.name;
      const b = it.bild;
      $(".hr-spel-foto").innerHTML = `Foto: ${esc(b.fotograf || "okänd")}, <a href="${esc(b.licensUrl)}" target="_blank" rel="noopener">${esc(b.licens)}</a>, <a href="${esc(b.kallaUrl)}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
    } else {
      img.removeAttribute("src");
    }
    $(".hr-spel-prompt").textContent = it.prompt || (omrade ? `Hitta ${it.name}` : `Var ligger ${it.name}?`);
    feedback.className = "hr-spel-feedback";
    feedback.innerHTML = `<span class="hint">${omrade
      ? "Zooma och flytta kartan. Klicka på området du tror är rätt – du kan byta innan du låser."
      : "Zooma och flytta kartan. Klicka där du tror att platsen ligger – du kan flytta nålen innan du låser."}</span>`;
    lasBtn.hidden = false;
    lasBtn.disabled = true;
    nastaBtn.hidden = true;
    forladdaNastaBild();
    stoppur.starta();
    ritaMatt();
  }

  function forladdaNastaBild() {
    const nasta = ordning[omgang.nr + 1];
    if (!omrade && nasta?.bild) new Image().src = bildUrl(nasta.bild.fil);
  }

  function las() {
    if (karta.last || lasBtn.disabled) return;
    const it = omgang.aktuell;
    if (omrade) {
      const valt = karta.getVal();
      if (!valt) return;
      const u = omgang.lasOmrade(valt, stoppur.stoppa());
      karta.showAreaResult({ valt, ratt: it.omrade, label: it.name });
      const t = omradeText(u, it.name, omgang.nr);
      feedback.className = `hr-spel-feedback ${u.ratt ? "hr-fb-ratt" : "hr-fb-fel"}`;
      feedback.innerHTML = `<b class="hr-fb-rubrik">${u.ratt ? "✅" : "❌"} ${esc(t.rubrik)}</b> <span>${esc(t.text)}</span>${u.godkand ? coinPop() : ""}`;
      if (u.godkand) godkanda += 1;
    } else {
      const guess = karta.getGuess();
      if (!guess) return;
      stoppur.stoppa();
      const u = omgang.lasPunkt(guess);
      karta.showResult({ guess, target: { lon: it.lon, lat: it.lat }, km: u.km, label: it.name });
      feedback.className = `hr-spel-feedback ${u.godkand ? "hr-fb-ratt" : "hr-fb-noll"}`;
      feedback.innerHTML = `<b class="hr-fb-rubrik">${esc(berom(u.p, omgang.nr))}</b>
        <span>Du var <b>${esc(formatKm(u.km))}</b> från rätt plats – <b>${esc(it.name)}</b>.</span>
        <span class="hr-fb-poang">${u.p} / 100 p</span>${u.godkand ? coinPop() : ""}`;
      if (u.godkand) godkanda += 1;
    }
    lasBtn.hidden = true;
    nastaBtn.textContent = omgang.sista ? "Se resultatet →" : "Nästa →";
    nastaBtn.hidden = false;
    nastaBtn.disabled = true;
    nastaFran = performance.now() + NASTA_SPARR_MS;
    setTimeout(() => {
      if (stadad) return;
      nastaBtn.disabled = false;
      nastaBtn.focus({ preventScroll: true });
      nastaBtn.scrollIntoView({ block: "nearest" }); // mobil: feedbacken kan skjuta ner knappen
    }, NASTA_SPARR_MS);
    ritaMatt();
  }

  const coinPop = () => `<span class="hr-fb-coin" aria-label="plus 1 coin">+1 ${coinIcon(18)}</span>`;

  function nasta() {
    if (!karta.last || nastaBtn.disabled || performance.now() < nastaFran) return;
    if (omgang.nasta()) visaFraga();
    else avsluta();
  }

  async function avsluta() {
    stada();
    await skicka(ctx, attemptId, omgang.svar());
  }

  lasBtn.addEventListener("click", las);
  nastaBtn.addEventListener("click", nasta);
  $('[data-act="avsluta"]').addEventListener("click", () => go(HASH)); // vakten frågar

  visaFraga();
}

async function skicka(ctx, attemptId, svar) {
  const { pack, data } = ctx;
  loading("Sparar resultatet…");
  let res;
  try {
    res = await data.skickaOmgang(attemptId, svar);
  } catch (err) {
    const eget = arEget(pack.id) && egetSparFel(err?.code, err?.message);
    if (eget) {
      felVy(eget.rubrik, eget.text, eget.igen ? () => spelaPack(ctx.meta, ctx.deps) : null, "Starta ny omgång");
      return;
    }
    const vy = el(sparFelHtml(pack, err?.message));
    vy.querySelector('[data-act="spara-igen"]').addEventListener("click", () => skicka(ctx, attemptId, svar));
    vy.querySelector('[data-act="tillbaka"]').addEventListener("click", () => go(HASH));
    app.replaceChildren(vy);
    return;
  }
  // Coins krediterade på servern (hr-data.js har invaliderat cachen) → sidomenyns saldo.
  if (res?.result?.godkanda > 0) renderTopbar().catch(() => {});
  if (KLASS_EXP_PA && res?.result) {
    import("../klasscenter/kc-koppling.js")
      .then((m) => m.klassExpEfterOvning({ modul: "hittaratt", resultat: { ratt: res.result.godkanda, totalt: res.result.n } }))
      .catch(() => {});
  }
  const vy = el(resultatHtml(pack, res));
  vy.querySelector('[data-act="igen"]').addEventListener("click", () => nyOmgang(ctx));
  vy.querySelector('[data-act="tillbaka"]').addEventListener("click", () => go(HASH));
  app.replaceChildren(vy);
  vy.querySelector('[data-act="igen"]').focus({ preventScroll: true });
}
