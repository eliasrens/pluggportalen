// ============================================================================
// Prov (#740, spec §5.5): elevens sidor.
//   #/elev/prov                      pågående prov + tillbakalämnade prov
//   #/elev/prov/skriv?t=<tillfälle>  själva provet: autosparning, tidsgräns,
//                                    inlämning (fokuslåset skickar eleven hit)
//   #/elev/prov/resultat?t=<…>       resultatvyn efter tillbakalämningen (#741)
// Routerna ligger i app.js med DYNAMISK import (#271). Inga mynt, stjärnor,
// XP eller ljud – provet är lugnt och seriöst.
// ============================================================================

import { app, el, escHtml, getHiddenModules, getLockGate, go, loading, onLockChange, renderTopbar } from "../ui.js";
import { kopplaVidare } from "./prov-vidare.js";
import { currentStudentId } from "../auth.js";
import { serverNow } from "../data-class-lock.js";
import { arFraga } from "./prov-fragetyper.js";
import { renderaProv } from "./prov-elev-vy.js";
import { hamtaMinRattning, hamtaMittSvar, hamtaTillfalle, lamnaIn, lamnaInPausad, sparaSvar, startaProv } from "./prov-elev-data.js";
import { lasLokal, rensaLokal, skrivLokal } from "./prov-elev-lokal.js";
import { FORKLARING, begarHelskarm, helskarmFor, kopplaHelskarm } from "./prov-helskarm-elev.js";
import { resultatModell } from "./prov-resultat-modell.js";
import { arSlutgiltigtFel, skapaSparare } from "./prov-sparning.js";
import { elevLage, kvarNiva, kvarText, slutTid, tillMs, valjStartSvar } from "./prov-tillfalle-logik.js";
import { onProvChange, provForMe } from "./prov-watch.js";
import { elevProvNamn, gallerElev, tidsgransFor, tolkaFlikbyten } from "./prov-anpassningar.js";
import { laddaCss } from "./prov-vy.js";
import { poangAv } from "./prov-poang.js";

const LISTA = "#/elev/prov";
const skrivHash = (t) => `#/elev/prov/skriv?t=${encodeURIComponent(t)}`;
const datum = (ms) => (ms ? new Date(ms).toLocaleDateString("sv-SE", { day: "numeric", month: "long" }) : "");

// Det som ska städas när eleven lämnar routen (timers, lyssnare, sista sparning).
let aktiv = null;
function stada() {
  aktiv?.();
  aktiv = null;
}
function vidByte(fn) {
  stada();
  const route = location.hash;
  const koll = () => { if (location.hash !== route) stada(); };
  window.addEventListener("hashchange", koll);
  aktiv = () => {
    window.removeEventListener("hashchange", koll);
    fn();
  };
}

function sida(...innehall) {
  const wrap = el(`<div class="provv-rot"></div>`);
  wrap.append(...innehall);
  app.replaceChildren(wrap);
  return wrap;
}

const antalFragor = (tf) => (tf.fragor || []).filter(arFraga).length;

// --- #/elev/prov ------------------------------------------------------------------

export async function pageProvLista() {
  stada();
  loading();
  const meId = currentStudentId();
  const [info] = await Promise.all([provForMe(meId), renderTopbar(), laddaCss("prov-elev.css")]);
  // Elevens eget svar per öppet prov (Starta / Fortsätt / Inlämnat) – oftast ett.
  const mina = await Promise.all(info.oppna.map((tf) => hamtaMittSvar(tf.id, meId).catch(() => null)));
  if (location.hash.split("?")[0] !== LISTA) return;

  const kort = info.oppna.map((tf, i) => {
    const lage = elevLage(tf, mina[i], serverNow(), meId);
    const min = tidsgransFor(tf, meId); // med elevens extra tid (#748)
    const knapp = lage === "inlamnat"
      ? `<span class="provv-etikett provv-etikett-klar">✓ Inlämnat</span>`
      : `<button class="provv-lamna-in" data-t="${escHtml(tf.id)}">${lage === "ny" ? "Starta provet" : "Fortsätt provet"}</button>`;
    return `<article class="provv-kort">
      <h2>${escHtml(elevProvNamn(tf))}</h2>
      <p class="provv-kort-fakta">${antalFragor(tf)} frågor${min ? ` · ${min} minuter` : " · ingen tidsgräns"}</p>
      ${knapp}
    </article>`;
  }).join("");
  const tillbaka = info.tillbaka.map((r) => {
    const resultat = r.totalPoang != null && r.maxPoang ? poangAv(r.totalPoang, r.maxPoang) : "";
    return `<li><a class="provv-tillbaka" href="#/elev/prov/resultat?t=${encodeURIComponent(r.id)}">
      <span class="provv-tillbaka-namn">${escHtml(r.provNamn || "Prov")}</span>
      <span class="provv-tillbaka-info">${escHtml(datum(tillMs(r.aterlamnadAt)))}${resultat ? ` · ${escHtml(resultat)}` : ""}</span>
    </a></li>`;
  }).join("");

  const wrap = sida(el(`<div class="provv-panel provv-listsida">
    <h1 class="provv-sidrubrik">📝 Prov</h1>
    <section>
      <h2 class="provv-underrubrik">Pågående prov</h2>
      ${kort || `<p class="provv-tom">Just nu finns inget prov att skriva.</p>`}
    </section>
    ${tillbaka ? `<section><h2 class="provv-underrubrik">Tillbakalämnade prov</h2><ul class="provv-tillbaka-lista">${tillbaka}</ul></section>` : ""}
  </div>`));
  wrap.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => go(skrivHash(b.dataset.t))));
  // Läraren öppnar/stänger medan eleven står här → rita om.
  const av = onProvChange(() => { if (location.hash.split("?")[0] === LISTA) pageProvLista(); });
  vidByte(av);
}

// --- #/elev/prov/skriv ---------------------------------------------------------------

function meddelande(rubrik, text, { lankLista = true, vidare = null } = {}) {
  const m = el(`<div class="provv-panel provv-meddelande" role="status">
    <h1 class="provv-sidrubrik">${escHtml(rubrik)}</h1>
    ${text ? `<p>${escHtml(text)}</p>` : ""}
    ${vidare ? `<div class="provv-vidare"></div>` : ""}
    ${lankLista ? `<p><a href="${LISTA}" class="provv-lank">Till dina prov</a></p>` : ""}
  </div>`);
  sida(m);
  if (vidare) visaVidare(m.querySelector(".provv-vidare"), vidare);
}

// Vägen vidare efter inlämningen (#788): ritas om när låset ändras.
const visaVidare = (plats, t) => kopplaVidare(plats, t, { getLockGate, getHiddenModules, onLockChange });

const KLART = "Ditt prov är inlämnat! Din lärare rättar det och lämnar tillbaka det sen.";
const TID_SLUT = "Tiden är slut – ditt prov är inlämnat.";
const STANGT = "Provet är stängt. Dina sparade svar gäller.";

export async function pageProvSkriv() {
  stada();
  loading();
  const t = new URLSearchParams(location.hash.split("?")[1] || "").get("t") || "";
  const meId = currentStudentId();
  const route = location.hash;
  await Promise.all([renderTopbar(), laddaCss("prov-elev.css")]);
  const info = await provForMe(meId);
  let tf = info.oppna.find((x) => x.id === t) || null;
  if (!tf && t) tf = await hamtaTillfalle(t).catch(() => null);
  if (location.hash !== route) return;
  if (!tf) return meddelande("Provet finns inte", "Det här provet är inte öppet för din klass.");
  // Ett omprov för valda elever (#748) – reglerna nekar de andra ändå.
  if (!gallerElev(tf, meId)) return meddelande("Provet finns inte", "Det här provet är inte öppet för dig.");
  let svarDok = await hamtaMittSvar(t, meId).catch(() => null);
  if (location.hash !== route) return;

  const lage = elevLage(tf, svarDok, serverNow(), meId);
  if (lage === "inlamnat") return meddelande("Inlämnat", svarDok.inlamnadNar === "tid" ? TID_SLUT : KLART, { vidare: t });
  if (lage === "stangt") return meddelande("Provet är stängt", svarDok ? STANGT : "Din lärare har stängt provet.");
  if (lage === "ny") return startRuta(tf, meId, route);
  return skriv(tf, svarDok, meId);
}

function startRuta(tf, meId, route) {
  const min = tidsgransFor(tf, meId);
  const ruta = el(`<div class="provv-panel provv-start">
    <h1 class="provv-sidrubrik">${escHtml(elevProvNamn(tf))}</h1>
    <ul class="provv-start-fakta">
      <li>${antalFragor(tf)} frågor</li>
      <li>${min ? `Du har ${min} minuter. Tiden börjar när du startar.` : "Ingen tidsgräns."}</li>
      <li>Dina svar sparas automatiskt medan du skriver.</li>
      ${helskarmFor(tf, meId) ? `<li><b>${escHtml(FORKLARING)}</b></li>` : ""}
    </ul>
    <button class="provv-lamna-in" type="button">Starta provet</button>
    <p class="provv-fel" role="alert" hidden></p>
  </div>`);
  sida(ruta);
  const knapp = ruta.querySelector("button");
  knapp.focus();
  knapp.addEventListener("click", async () => {
    // #810: helskärmen begärs direkt i klicket (webbläsaren kräver det); går den inte startar provet ändå.
    const hs = helskarmFor(tf, meId) ? begarHelskarm() : Promise.resolve(true);
    knapp.disabled = true;
    knapp.textContent = "Startar…";
    try {
      const helskarmFel = !(await hs);
      // Fanns ett svar redan (annan flik) används det – annars skapas det nu.
      const dok = (await hamtaMittSvar(tf.id, meId)) || (await startaProv(tf.id, meId, tf.classId, {}, { helskarmFel }));
      if (location.hash === route) skriv(tf, dok, meId, { nyss: true, helskarmFel });
    } catch (err) {
      console.warn("Prov: kunde inte starta", err);
      knapp.disabled = false;
      knapp.textContent = "Starta provet";
      const fel = ruta.querySelector(".provv-fel");
      fel.hidden = false;
      fel.textContent = arSlutgiltigtFel(err)
        ? "Provet går inte att starta – det kan ha stängts. Fråga din lärare."
        : "Kunde inte starta – kontrollera internet och försök igen.";
    }
  });
}

function skriv(tf, svarDok, meId, { nyss = false, helskarmFel = false } = {}) {
  const t = tf.id;
  const lokal = lasLokal(t, meId);
  const { svar, franLokal } = valjStartSvar(svarDok, lokal);
  let klar = false;
  let tick = null;
  // #748: hur många gånger eleven lämnat provfliken – bara information till läraren.
  let flikbyten = Math.max(tolkaFlikbyten(svarDok.flikbyten), tolkaFlikbyten(lokal?.flikbyten));
  let baraFlik = false; // det osparade är bara flikbytena (inga svar) – spara inom taket, aldrig direkt

  const vy = renderaProv({
    namn: tf.provNamn, fragor: tf.fragor, installningar: tf.installningar, svar, elevId: meId,
    onAndrat: (s) => {
      baraFlik = false;
      skrivLokal(t, meId, s, flikbyten);
      sparare.andrat();
    },
    onLamnat: () => sparare.lamnatRuta(),
    onLamnaIn: () => lamna("elev"),
  });
  const banner = el(`<div class="provv-banner" role="status" hidden></div>`);
  vy.el.prepend(banner);
  sida(vy.el);

  const nySparare = () => skapaSparare({
    spara: () => sparaSvar(t, meId, vy.svar(), flikbyten, hs?.helskarmFel),
    onStatus: (s) => vy.satSparstatus(s),
    onSlutgiltigt: () => kollaLage(),
  });
  let sparare = nySparare();
  vy.satSparstatus({ lage: "sparat", tid: tillMs(svarDok.uppdaterad) });
  if (franLokal) sparare.andrat(); // osparade ändringar från förra gången
  else if (flikbyten > tolkaFlikbyten(svarDok.flikbyten)) { // bara flikbyten osparade (#748)
    baraFlik = true;
    sparare.andrat();
  }

  const hs = helskarmFor(tf, meId) ? kopplaHelskarm({ // #810 – pauserna räknas i flikbyten
    t, meId, svarDok, vyEl: vy.el, nyss, helskarmFel, svarNu: () => vy.svar(), flikbyten: () => flikbyten, satFlikbyten: (n) => (flikbyten = n),
    forePaus: () => { sparare.stoppa(); skrivLokal(t, meId, vy.svar(), flikbyten); },
    efterPaus: () => { baraFlik = false; sparare = nySparare(); }, onLage: () => kollaLage(),
  }) : null;

  const avsluta = (rubrik, text) => {
    klar = true;
    hs?.slut(); // provvyn tillbaka, ut ur helskärm (#788: vägen vidare gäller)
    clearInterval(tick);
    sparare.stoppa();
    vy.las(true);
    vy.satTid("");
    banner.hidden = false;
    banner.innerHTML = `<b>${escHtml(rubrik)}</b> ${escHtml(text)} <a href="${LISTA}" class="provv-lank">Till dina prov</a>
      <div class="provv-vidare"></div>`;
    visaVidare(banner.querySelector(".provv-vidare"), t);
    banner.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Läraren stängde provet, eller reglerna nekade en sparning: läs läget en gång.
  async function kollaLage() {
    if (klar) return;
    const [nyTf, nyttSvar] = await Promise.all([hamtaTillfalle(t).catch(() => null), hamtaMittSvar(t, meId).catch(() => null)]);
    if (klar) return;
    const l = elevLage(nyTf || { status: "stangt" }, nyttSvar, serverNow());
    if (l === "inlamnat") {
      rensaLokal(t, meId);
      avsluta("Inlämnat.", nyttSvar.inlamnadNar === "tid" ? TID_SLUT : nyttSvar.inlamnadNar === "stangt" ? STANGT : KLART);
    } else if (l === "stangt") avsluta("Provet är stängt.", "Dina sparade svar gäller.");
    else if (l === "tiden-slut") {
      // Reglerna nekade redan "tid"-inlämningen (gränsen + 2 min har passerat,
      // t.ex. när läraren tog bort extra tid) – sluta försöka, det senast sparade gäller.
      if (tidNekad) avsluta("Tiden är slut.", "Dina senast sparade svar gäller.");
      else lamna("tid");
    }
  }

  // Inlämningen: sista svaren + inlämnad i en skrivning. "tid" försöker igen
  // tills det går (inom reglernas 2 minuters marginal); "elev" visar felet.
  let lamnar = false;
  let tidNekad = false;
  async function lamna(nar) {
    if (klar || lamnar) return;
    lamnar = true;
    sparare.stoppa();
    if (nar === "tid") {
      vy.las(true);
      vy.satTid("Tiden är slut", "rod");
      vy.satSparstatus({ lage: "sparar" });
    }
    const svarNu = vy.svar();
    skrivLokal(t, meId, svarNu, flikbyten);
    for (let forsok = 0; ; forsok++) {
      try {
        // Offline hänger skrivningen (SDK:t köar den) – vänta högst 10 s per försök.
        await Promise.race([
          // Tiden tog slut under pausen (#810): de svar som sparades när pausen började gäller.
          hs?.pausad ? lamnaInPausad(t, meId) : lamnaIn(t, meId, svarNu, nar, flikbyten, hs?.helskarmFel),
          new Promise((_, nej) => setTimeout(() => nej(Object.assign(new Error("timeout"), { code: "deadline-exceeded" })), 10_000)),
        ]);
        rensaLokal(t, meId);
        avsluta("Inlämnat.", nar === "tid" ? TID_SLUT : KLART);
        return;
      } catch (err) {
        // Nekad: kanske redan inlämnad (en köad skrivning gick igenom) eller stängd.
        if (arSlutgiltigtFel(err)) {
          lamnar = false;
          if (nar === "tid") tidNekad = true;
          return kollaLage();
        }
        if (nar === "elev") {
          lamnar = false;
          sparare = nySparare();
          sparare.andrat();
          vy.inlamningMisslyckades("Kunde inte lämna in – kontrollera internet och försök igen. Dina svar finns kvar här.");
          return;
        }
        vy.satSparstatus({ lage: "fel" });
        if (klar) return;
        await new Promise((r) => setTimeout(r, Math.min(5_000 * (forsok + 1), 20_000)));
      }
    }
  }

  // Nedräkningen mot serverns klocka (§5.5): gul vid 5 min, röd vid 1 min.
  // Elevens egen tidsgräns: tidsgränsen + extra tid (#748) – läraren kan ge mer under provet.
  let slut = null;
  const ritaTid = () => {
    if (slut == null || klar) return;
    const kvar = slut - serverNow();
    vy.satTid(kvarText(kvar), kvarNiva(kvar));
    if (kvar <= 0) lamna("tid");
  };
  const satSlut = (x) => {
    slut = slutTid(svarDok.startad, tidsgransFor(x, meId));
    if (slut != null && !tick) tick = setInterval(ritaTid, 1000);
    ritaTid();
  };
  satSlut(tf);

  // Läraren stänger provet → tillfället försvinner ur elevens öppna lista.
  const avProv = onProvChange(({ oppna }) => {
    const ny = oppna.find((x) => x.id === t);
    if (!ny) kollaLage();
    else if (!klar && !lamnar) satSlut(ny), hs?.galler(helskarmFor(ny, meId));
  });
  // Eleven lämnar sidan eller fliken: spara direkt (utan tak).
  const spola = () => { if (!klar && sparare.osparat) sparare.spolaNu(); };
  // #748: varje gång fliken döljs under provet räknas ett flikbyte. Osparade
  // svar sparas direkt som förut (och tar med bytet); annars följer bytet med
  // nästa sparning inom taket – flikbyten ger aldrig fler skrivningar än taket.
  const synlighet = () => {
    if (!document.hidden || klar || lamnar || hs?.aktiv) return; // #810: helskärmsläget räknar pauserna
    const svarOsparade = sparare.osparat && !baraFlik;
    flikbyten = Math.min(flikbyten + 1, 10_000);
    skrivLokal(t, meId, vy.svar(), flikbyten);
    if (svarOsparade) return void spola();
    if (!sparare.osparat) baraFlik = true;
    sparare.andrat();
  };
  window.addEventListener("pagehide", spola);
  window.addEventListener("online", spola); // nätet tillbaka → försök direkt
  document.addEventListener("visibilitychange", synlighet);
  vidByte(() => {
    spola();
    clearInterval(tick);
    avProv();
    window.removeEventListener("pagehide", spola);
    window.removeEventListener("online", spola);
    document.removeEventListener("visibilitychange", synlighet);
    hs?.lamnaSidan();
  });
}

// --- #/elev/prov/resultat -----------------------------------------------------------

/**
 * Resultatvyn (#741, §7): syns först när läraren lämnat tillbaka provet.
 * Läser tillfället, elevens svar och rättningen – tre läsningar, en gång.
 */
export async function pageProvResultat() {
  stada();
  loading();
  const t = new URLSearchParams(location.hash.split("?")[1] || "").get("t") || "";
  const meId = currentStudentId();
  const route = location.hash;
  await Promise.all([renderTopbar(), laddaCss("prov-elev.css")]);
  let tf;
  let svarDok;
  let r;
  try {
    [tf, svarDok, r] = await Promise.all([
      hamtaTillfalle(t).catch(() => null),
      hamtaMittSvar(t, meId).catch(() => null),
      hamtaMinRattning(t, meId),
    ]);
  } catch (err) {
    console.warn("Prov: resultatet kunde inte läsas", err);
    if (location.hash === route) meddelande("Resultat", "Kunde inte hämta resultatet – kontrollera internet och försök igen.");
    return;
  }
  if (location.hash !== route) return;
  // Tillfället kan ha öppnats igen eller raderats – rättningen bär provets namn.
  const m = resultatModell(tf || { provNamn: r?.provNamn, fragor: [] }, svarDok, r);
  if (!m) return meddelande("Inte tillbakalämnat än", "Här ser du ditt rättade prov när läraren har lämnat tillbaka det.");
  const nar = tillMs(tf?.oppnad) ?? tillMs(svarDok?.startad) ?? tillMs(r.aterlamnadAt);
  const { renderaResultat } = await import("./prov-resultat-vy.js");
  if (location.hash !== route) return;
  app.replaceChildren(renderaResultat(m, { datum: nar ? `Skrivet ${datum(nar)}` : "", tillbakaHref: LISTA }));
  window.scrollTo?.(0, 0);
}
