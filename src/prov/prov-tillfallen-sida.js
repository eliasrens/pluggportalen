// ============================================================================
// Prov (#740, spec §5.1–§5.4): lärarsidans provtillfällen.
//   #/larare/prov/tillfallen        fliken "Provtillfällen" (gruppen Prov): per
//                                   klass, status, Öppna/Stäng/Översikt/Radera
//   #/larare/prov/tillfalle?t=<id>  översikten under provet: en rad per elev,
//                                   läses om var 60:e sekund + "Uppdatera nu"
//                                   (ALDRIG onSnapshot på svaren, §5.3)
//   korIKlass(ctx, prov)            rutan "Kör i klass" (§5.2, prov-tillfalle-rutor.js)
//                                   – B:s knapp i "Mina prov" (#739) anropar den
//   Omprov / Extra tid (#748)       prov-anpassningar-rutor.js
//   Helskärmsläget (#810)           prov-helskarm-larare.js: pausade elever överst
//                                   (EN lyssnare, bara på pausad == true) + "Helskärm"
// Läraren ser bara sina egna klasser (filterClasses). Laddas DYNAMISKT (#271).
// CSS: prov-tillfalle.css (.provl-).
// ============================================================================

import { el, emptyState, errText, esc, icon, isTeacher, renderGate, teacherHead, teacherNav, wireHashLinks } from "../teacher-shared.js";
import { getClasses } from "../data-classes.js";
import { getStudentsByIds } from "../data-content.js";
import { formatKlockslag } from "../class-lock.js";
import { serverNow, syncServerClock } from "../data-class-lock.js";
import { filterClasses, myRole } from "../teacher-role.js";
import { arFraga } from "./prov-fragetyper.js";
import { STATUS, STATUS_NAMN } from "./prov-modell.js";
import { arOmprov, extraTidText, gallerElev, tillfalleNamn } from "./prov-anpassningar.js";
import { extraTidRuta, omprovRuta } from "./prov-anpassningar-rutor.js";
import { helskarmPa } from "./prov-helskarm.js";
import { helskarmRuta, pausPanel } from "./prov-helskarm-larare.js";
import { rattStatusText } from "./prov-rattning-logik.js";
import { hamtaSvar, hamtaTillfalle, listaProv, listaTillfallen, uppgraderaRaknare } from "./prov-tillfalle-data.js";
import { OVERSIKT_INTERVALL_MS, kvarText, oversiktRader, oversiktSumma, tillMs } from "./prov-tillfalle-logik.js";
import { korIKlass, oppnaRuta, raderaRuta, ruta, stangRuta } from "./prov-tillfalle-rutor.js";
import { laddaCss } from "./prov-vy.js";

// "Kör i klass"-rutan bor i prov-tillfalle-rutor.js; re-exporteras för B (#739).
export { korIKlass };

const LISTA = "#/larare/prov/tillfallen";
const oversiktHash = (t) => `#/larare/prov/tillfalle?t=${encodeURIComponent(t)}`;
const rattaHash = (t) => `#/larare/prov/ratta?t=${encodeURIComponent(t)}`;
const datum = (ms) => (ms ? new Date(ms).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) : "");
const antalFragor = (fragor) => (fragor || []).filter(arFraga).length;
const statusEtikett = (s) => `<span class="provl-status provl-status-${esc(s)}">${esc(STATUS_NAMN[s] || s)}</span>`;

async function skal(ctx, flik, laddaText) {
  ctx.renderTopbar();
  if (!isTeacher()) {
    renderGate(ctx);
    return null;
  }
  laddaCss("prov-tillfalle.css");
  const page = el(`<div class="teacher-page teacher-dark provl-sida"></div>`);
  page.append(teacherNav(ctx, flik), teacherHead(ctx, flik));
  const body = el(`<div class="provl-kropp"><div class="spinner">${esc(laddaText)}</div></div>`);
  page.append(body);
  ctx.app.replaceChildren(page);
  return { page, body };
}

/** Statusknapparna för ett tillfälle (listan och översikten). */
function knappar(tf, { oversikt = true } = {}) {
  const k = [];
  if (tf.status === STATUS.FORBERETT) k.push(`<button class="btn gron small" data-act="oppna">Öppna</button>`);
  if (tf.status === STATUS.OPPET) k.push(`<button class="btn small" data-act="stang">Stäng</button>`);
  if (tf.status === STATUS.STANGT) k.push(`<button class="btn ghost small" data-act="oppna">Öppna igen</button>`);
  if (oversikt && tf.status !== STATUS.FORBERETT) k.push(`<button class="btn ghost small" data-hash="${esc(oversiktHash(tf.id))}">Översikt</button>`);
  // Rättningen (#741): när provet är stängt (eller medan de inlämnade väntar).
  if (tf.status !== STATUS.FORBERETT) k.push(`<button class="btn ${tf.status === STATUS.STANGT ? "gron" : "ghost"} small" data-hash="${esc(rattaHash(tf.id))}">Rätta</button>`);
  // "Rätta alla automatiska frågor" (#764, §6.0): öppnar rättningen och kör knappen där.
  if (!oversikt && tf.status !== STATUS.FORBERETT) k.push(`<button class="btn ghost small" data-hash="${esc(rattaHash(tf.id))}&amp;rattaAlla=1">Rätta alla automatiska frågor</button>`);
  // Resultatet i grönt/gult/rött (#742): rättningsvyns flik Översikt.
  if (tf.status !== STATUS.FORBERETT && tf.rattStatus?.antal) k.push(`<button class="btn ghost small" data-hash="${esc(rattaHash(tf.id))}&amp;lage=oversikt">Resultat</button>`);
  // Anpassningar (#748): extra tid medan provet pågår (översikten), omprov för valda elever.
  if (!oversikt && tf.status === STATUS.OPPET) k.push(`<button class="btn ghost small" data-act="extra">Extra tid</button>`);
  // Helskärmsläget (#810): av/på + undantag, även medan provet pågår.
  if (!oversikt && tf.status !== STATUS.STANGT) k.push(`<button class="btn ghost small" data-act="helskarm">Helskärm: ${helskarmPa(tf) ? "på" : "av"}</button>`);
  if (tf.status !== STATUS.FORBERETT) k.push(`<button class="btn ghost small" data-act="omprov" title="Ett nytt tillfälle för bara de elever du väljer">Omprov</button>`);
  k.push(`<button class="btn ghost small danger" data-act="radera" aria-label="Radera ${esc(tf.provNamn)}">${icon("trash", 16)}</button>`);
  return k.join("");
}
function kopplaKnappar(ctx, root, tf, klar, raderad = klar) {
  wireHashLinks(ctx, root);
  root.querySelector('[data-act="omprov"]')?.addEventListener("click", () => omprovRuta(tf, (t, oppnat) => (oppnat ? ctx.go(oversiktHash(t)) : ctx.go(LISTA))));
  root.querySelector('[data-act="oppna"]')?.addEventListener("click", () => oppnaRuta(tf, klar));
  root.querySelector('[data-act="stang"]')?.addEventListener("click", () => stangRuta(tf, klar));
  root.querySelector('[data-act="radera"]')?.addEventListener("click", () => raderaRuta(tf, raderad));
}

// --- #/larare/prov/tillfallen --------------------------------------------------------

/** Route-handler (TEACHER_TABS "provtillfallen"). */
export async function pageProvTillfallen(ctx) {
  const s = await skal(ctx, "provtillfallen", "Laddar provtillfällena…");
  if (!s) return;
  const { body } = s;
  try {
    await syncServerClock();
    const [role, klasser] = await Promise.all([myRole(), getClasses()]);
    const mina = filterClasses(klasser, role);
    const tillfallen = mina.length ? await listaTillfallen(mina.map((c) => c.id)) : [];
    if (window.location.hash.split("?")[0] !== LISTA) return;
    uppgraderaRaknare(tillfallen); // #807 F2: äldre tillfällen syns sedan i märket och Att rätta
    ritaLista(ctx, body, mina, tillfallen);
  } catch (err) {
    body.replaceChildren(el(`<div class="panel"><div class="msg error">Kunde inte ladda provtillfällena: ${esc(errText(err))}</div></div>`));
  }
}

function ritaLista(ctx, body, klasser, tillfallen) {
  const omRita = () => pageProvTillfallen(ctx);
  const verktyg = el(`<div class="provl-verktyg">
    <button class="btn gron" data-act="kor">${icon("plus", 16)}<span>Kör ett prov i klass</span></button>
    <span class="hint">Eller tryck <b>Kör i klass</b> på ett prov under Mina prov.</span>
  </div>`);
  verktyg.querySelector('[data-act="kor"]').addEventListener("click", () => valjProv(ctx, omRita));
  const per = new Map(klasser.map((c) => [c.id, []]));
  for (const tf of tillfallen) per.get(tf.classId)?.push(tf);
  const ordning = { oppet: 0, forberett: 1, stangt: 2 };
  const sektioner = klasser.filter((c) => per.get(c.id).length).map((c) => {
    const lista = per.get(c.id).sort((a, b) => ordning[a.status] - ordning[b.status] || (tillMs(b.skapad) ?? 0) - (tillMs(a.skapad) ?? 0));
    const sek = el(`<section class="panel provl-klass">
      <h2 class="provl-klass-namn">${esc(c.name || c.id)}</h2>
      <ul class="provl-lista"></ul>
    </section>`);
    const ul = sek.querySelector("ul");
    for (const tf of lista) {
      // Ett omprov (#748) gäller bara sina elever: "Vikingaprovet – omprov (3 elever)".
      const n = arOmprov(tf) ? tf.elevIds.length : (c.studentIds || []).length;
      const li = el(`<li class="provl-tf-rad">
        <div class="provl-tf-rad-info">
          <span class="provl-tf-rad-namn">${esc(tillfalleNamn(tf))}</span>
          ${statusEtikett(tf.status)}
          <span class="hint">${tf.status === STATUS.FORBERETT ? "Inte öppnat än" : `${antalFragor(tf.fragor)} frågor`}${
            tf.tidsgransMin ? ` · ${tf.tidsgransMin} min` : ""}${
            tf.tidsgransMin && Object.keys(tf.extraTid || {}).length ? ` (${Object.keys(tf.extraTid).length} med extra tid)` : ""} · ${n} elever · ${esc(datum(tillMs(tf.oppnad) ?? tillMs(tf.skapad)))}${
            tf.rattStatus?.antal ? ` · <b>${esc(rattStatusText(tf.rattStatus))}</b>` : ""}</span>
        </div>
        <div class="provl-tf-rad-knappar">${knappar(tf)}</div>
      </li>`);
      // Rättningen (#741): "18 av 24 rättade" ur tillfällets räkneverk (rattStatus, ingen extra läsning).
      kopplaKnappar(ctx, li, tf, omRita);
      ul.append(li);
    }
    return sek;
  });
  body.replaceChildren(verktyg, ...(sektioner.length ? sektioner : [emptyState(ctx, {
    title: "Inga provtillfällen än",
    text: klasser.length ? "Välj ett prov och tryck <b>Kör i klass</b> för att öppna det för en klass." : "Du har inga klasser än.",
    icon: "inbox",
  })]));
}

/** Utan "Mina prov" (B) i närheten: välj ett prov i en lista och kör det. */
async function valjProv(ctx, klar) {
  let prov;
  try {
    prov = (await listaProv()).sort((a, b) => String(a.namn).localeCompare(String(b.namn), "sv"));
  } catch (err) {
    return ruta(`<div class="msg error">Kunde inte läsa proven: ${esc(errText(err))}</div>
      <div class="provl-tf-knappar"><button class="btn ghost" data-avbryt>Stäng</button></div>`, { etikett: "Fel" });
  }
  const { box, stang } = ruta(`
    <h2 class="provl-ruta-rubrik">Vilket prov?</h2>
    ${prov.length ? `<label class="provl-tf-falt">Prov
      <select class="select" data-f="prov" autofocus>${prov.map((p) =>
        `<option value="${esc(p.id)}">${esc(p.namn)} (${antalFragor(p.fragor)} frågor)</option>`).join("")}</select></label>`
      : `<p class="hint">Det finns inga prov än – skapa ett under Mina prov.</p>`}
    <div class="provl-tf-knappar">
      <button class="btn gron" data-act="vidare" ${prov.length ? "" : "disabled"}>Vidare</button>
      <button class="btn ghost" data-avbryt>Avbryt</button>
    </div>`, { etikett: "Välj prov" });
  box.querySelector('[data-act="vidare"]').addEventListener("click", () => {
    const valt = prov.find((p) => p.id === box.querySelector('[data-f="prov"]').value);
    stang();
    if (valt) korIKlass(ctx, valt, { onKlar: (t, oppnat) => (oppnat ? ctx.go(oversiktHash(t)) : klar()) });
  });
}

// --- #/larare/prov/tillfalle?t= --------------------------------------------------------

/** Route-handler: lärarens översikt under provet (§5.3). */
export async function pageProvTillfalle(ctx) {
  const route = window.location.hash;
  const t = new URLSearchParams(route.split("?")[1] || "").get("t") || "";
  const s = await skal(ctx, "provtillfallen", "Laddar provet…");
  if (!s) return;
  const { body } = s;
  let tf;
  let elever;
  try {
    await syncServerClock();
    tf = await hamtaTillfalle(t);
    if (!tf) throw new Error("Provtillfället finns inte (det kan ha raderats).");
    const klass = (await getClasses()).find((c) => c.id === tf.classId);
    // Elevernas namn – en gång när vyn öppnas (§9.2: en klass i taget). Ett omprov: bara de valda (#748).
    elever = (await getStudentsByIds((klass?.studentIds || []).filter((id) => gallerElev(tf, id))))
      .map((e) => ({ id: e.id, namn: e.namn || e.username || e.id }))
      .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
    tf.klassNamn = klass?.name || tf.classId;
  } catch (err) {
    body.replaceChildren(el(`<div class="panel"><div class="msg error">${esc(errText(err))}</div>
      <p><a data-hash="${LISTA}" class="provl-lank">← Provtillfällen</a></p></div>`));
    wireHashLinks(ctx, body);
    return;
  }
  if (window.location.hash !== route) return;

  const vy = el(`<div class="provl-oversikt">
    <div class="panel provl-huvud">
      <a data-hash="${LISTA}" class="provl-lank">← Provtillfällen</a>
      <div class="provl-huvud-rad">
        <h2 class="provl-huvud-namn">${esc(tillfalleNamn(tf))} <span class="provl-klassnamn">· ${esc(tf.klassNamn)}</span></h2>
        <span class="provl-huvud-status"></span>
      </div>
      <p class="hint provl-fakta"></p>
      <div class="provl-tf-rad-knappar provl-huvud-knappar"></div>
    </div>
    <div class="panel">
      <div class="provl-summa" role="status"></div>
      <div class="provl-uppdatera">
        <span class="hint provl-uppdaterad"></span>
        <button class="btn ghost small" data-act="uppdatera">Uppdatera nu</button>
      </div>
      <div class="provl-tabell-wrap">
        <table class="provl-tabell">
          <thead><tr><th scope="col">Namn</th><th scope="col">Status</th><th scope="col">Besvarade</th>${tf.tidsgransMin ? `<th scope="col">Tid kvar</th>` : ""}</tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>`);
  body.replaceChildren(vy);
  wireHashLinks(ctx, vy);
  // #810: pausade elever överst, direkt (lyssnaren) – resten som förut en gång i minuten.
  // Lyssnarens dokument är färskare än minutläsningen – de ersätter elevens rad (även efter Släpp in).
  const panel = pausPanel({ tf, elever, onAndrat: (p) => {
    for (const [uid, d] of Object.entries(p)) svar[uid] = d;
    ritaHuvud();
    ritaTabell();
  } });
  vy.querySelector(".provl-huvud").after(panel.el);
  const lamnat = () => {
    if (window.location.hash === route && vy.isConnected) return;
    panel.stoppa();
    window.removeEventListener("hashchange", lamnat);
  };
  window.addEventListener("hashchange", lamnat);

  let svar = {};
  let senast = 0;
  let laddar = false;
  const tbody = vy.querySelector("tbody");
  const ritaHuvud = () => {
    vy.querySelector(".provl-huvud-status").innerHTML = statusEtikett(tf.status);
    const namn = Object.fromEntries(elever.map((e) => [e.id, e.namn]));
    vy.querySelector(".provl-fakta").textContent = [`${antalFragor(tf.fragor)} frågor`,
      tf.tidsgransMin ? `${tf.tidsgransMin} minuter per elev` : "ingen tidsgräns", `${elever.length} elever`,
      tf.tidsgransMin ? extraTidText(tf.extraTid, namn) : ""].filter(Boolean).join(" · ");
    const k = vy.querySelector(".provl-huvud-knappar");
    k.innerHTML = knappar(tf, { oversikt: false });
    kopplaKnappar(ctx, k, tf, () => uppdatera(true), () => ctx.go(LISTA));
    k.querySelector('[data-act="extra"]')?.addEventListener("click", () => extraTidRuta(tf, elever, () => { ritaHuvud(); ritaTabell(); }));
    k.querySelector('[data-act="helskarm"]')?.addEventListener("click", () => helskarmRuta(tf, elever, () => { ritaHuvud(); ritaTabell(); }));
  };
  const ritaTabell = () => {
    // #810: lyssnaren vet vilka som är pausade just nu – den går före minutläsningen.
    const live = panel.pausade();
    const svarNu = Object.fromEntries(Object.entries(svar).map(([uid, d]) => [uid, { ...d, pausad: !!live[uid] }]));
    const rader = oversiktRader(elever, svarNu, tf, serverNow());
    const sum = oversiktSumma(rader);
    const pausade = rader.filter((r) => r.pausad).length;
    vy.querySelector(".provl-summa").innerHTML = `<b>${sum.antal} elever:</b> ${sum.ej} inte börjat · ${sum.skriver} skriver${
      pausade ? ` (${pausade} pausad${pausade === 1 ? "" : "e"})` : ""} · ${sum.inlamnat} inlämnat`;
    tbody.innerHTML = rader.map((r) => `<tr class="provl-elev provl-elev-${r.status}">
      <th scope="row">${esc(r.namn)}${r.extraMin ? ` <span class="provl-ap-tag" title="Extra tid">+${r.extraMin} min</span>` : ""}${
        r.helskarmFel ? ` <span class="provl-ap-tag provl-hs-tag">Helskärm fungerade inte</span>` : ""}</th>
      <td><span class="provl-elevstatus provl-elevstatus-${r.pausad ? "pausad" : r.status}">${r.pausad ? "⏸ " : ""}${esc(r.statusText)}${r.inlamnadNar === "tid" ? " (tiden)" : r.inlamnadNar === "stangt" ? " (stängt)" : ""}</span></td>
      <td>${r.status === "ej" ? "–" : `${r.besvarade} av ${r.antal}`}</td>
      ${tf.tidsgransMin ? `<td>${r.kvarMs == null ? "–" : esc(kvarText(r.kvarMs).replace(/ kvar$/, ""))}</td>` : ""}
    </tr>`).join("") || `<tr><td colspan="4" class="hint">Klassen har inga elever.</td></tr>`;
    vy.querySelector(".provl-uppdaterad").textContent = senast ? `Uppdaterad ${formatKlockslag(senast)}` : "";
  };
  // Svaren läses om var 60:e sekund och med "Uppdatera nu" – aldrig onSnapshot,
  // och inte medan fliken är dold (§5.3, §9.1: 25 elever × 40 läsningar).
  async function uppdatera(medTillfalle = false) {
    if (laddar) return;
    laddar = true;
    try {
      if (medTillfalle) {
        const ny = await hamtaTillfalle(t);
        if (!ny) return ctx.go(LISTA);
        Object.assign(tf, ny);
        ritaHuvud();
      }
      if (tf.status !== STATUS.FORBERETT) svar = await hamtaSvar(t);
      senast = serverNow();
      ritaTabell();
    } catch (err) {
      vy.querySelector(".provl-uppdaterad").textContent = `Kunde inte uppdatera: ${errText(err)}`;
    } finally {
      laddar = false;
    }
  }
  vy.querySelector('[data-act="uppdatera"]').addEventListener("click", () => uppdatera(true));
  ritaHuvud();
  await uppdatera();

  const iv = setInterval(() => {
    if (window.location.hash !== route || !vy.isConnected) return clearInterval(iv), lamnat();
    if (!document.hidden && tf.status === STATUS.OPPET && serverNow() - senast >= OVERSIKT_INTERVALL_MS) uppdatera();
    else ritaTabell(); // tid kvar räknas ner utan läsning
  }, 15_000);
}
