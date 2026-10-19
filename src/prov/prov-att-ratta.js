// ============================================================================
// Prov (#807, epic #802 §1.3 + DEL 5): märket på Prov i toppmenyn ("Prov 18")
// och rutan "Att rätta" överst på Prov → Mina prov (Hem visar samma rader).
// Siffrorna kommer från räknarna på tillfällena (prov-raknare.js) – inga svar-
// eller rättningsdokument läses.
//
// EN fråga per 30 klasser: provTillfallen where classId in [lärarens klasser]
// + where attRatta == true (bara tillfällen med orättade prov – en läsning per
// träff, minst en). Två likhetsvillkor = inget sammansatt index. Svaret cachas i
// sessionen (CACHE_MS) och töms när rättningen, Stäng, Öppna igen eller Radera
// ändrar räknarna, så att märket inte läser om vid varje sidbyte.
// Laddas med import() från teacherNav (teacher-shared.js), Mina prov och Hem –
// aldrig i bootgrafen (#271).
// ============================================================================

import { db } from "../firebase-config.js";
import { collection, getDocs, limit, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { el, esc, icon } from "../teacher-shared.js";
import { getClasses } from "../data-classes.js";
import { filterClasses, myRole } from "../teacher-role.js";
import { SAMLING_TILLFALLEN } from "./prov-modell.js";
import { attRattaCache, attRattaRader, rattaHash, summaAttRatta } from "./prov-raknare.js";
import { LAGRING } from "../teacher-hem-logik.js";

export const CACHE_MS = 5 * 60_000;
/** Högst så många tillfällen per fråga (#807 F4): gamla, aldrig färdigrättade prov får inte göra märket dyrt. */
export const MAX_TILLFALLEN = 50;

/**
 * Tillfällena med orättade prov i klasserna (en fråga per 30 klasser, högst
 * MAX_TILLFALLEN var). Listan får `fler = true` om någon fråga slog i taket.
 */
export async function lasAttRattaTillfallen(classIds) {
  const ids = [...new Set(classIds)];
  const delar = [];
  for (let i = 0; i < ids.length; i += 30) delar.push(ids.slice(i, i + 30));
  const snaps = await Promise.all(delar.map((d) =>
    getDocs(query(collection(db, SAMLING_TILLFALLEN), where("classId", "in", d), where("attRatta", "==", true), limit(MAX_TILLFALLEN)))));
  const ut = snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
  ut.fler = snaps.some((s) => s.size >= MAX_TILLFALLEN);
  return ut;
}

/**
 * Admin: utan klasserna som är dolda på Hem (#807 F3) – samma val (localStorage
 * per lärare), så att märket, Att rätta och Hem säger samma sak.
 */
export function utanDolda(rader, role) {
  let dolda = [];
  try {
    if (role?.admin) dolda = JSON.parse(localStorage.getItem(LAGRING.doldaKlasser(role.uid)) || "[]");
  } catch { /* ingen lagring */ }
  if (!dolda.length) return rader;
  const ut = rader.filter((r) => !dolda.includes(r.classId));
  ut.fler = rader.fler;
  return ut;
}

/**
 * Raderna i "Att rätta" för lärarens klasser (årskurskonto: kontots, admin: alla).
 * @param {{ classes?: object[], role?: object }} [o]  redan lästa klasser/roll (Hem)
 * @returns {Promise<{ id, namn, klass, classId, antal, inlamnade, rattade }[]>}
 */
export async function hamtaAttRatta({ classes, role } = {}) {
  role ||= await myRole();
  const mina = filterClasses(classes || (await getClasses()), role);
  const nyckel = `${role.uid}|${mina.map((c) => c.id).join(",")}`;
  const c = attRattaCache;
  if (!c.lofte || c.nyckel !== nyckel || Date.now() - c.tid > CACHE_MS) {
    c.nyckel = nyckel;
    c.tid = Date.now();
    c.lofte = (mina.length ? lasAttRattaTillfallen(mina.map((k) => k.id)) : Promise.resolve([]))
      .then((tf) => Object.assign(attRattaRader(tf, mina), { fler: !!tf.fler }))
      .catch((err) => {
        c.lofte = null;
        throw err;
      });
  }
  return c.lofte;
}

/** Lärarens rader utan Hem-dolda klasser (admin) – märket och Mina prov. Tyst vid fel. */
async function minaRader() {
  try {
    const role = await myRole();
    return utanDolda(await hamtaAttRatta({ role }), role);
  } catch {
    return [];
  }
}

/** Märket "Prov 18" på toppmenyns Prov (och samma val i ☰-menyn); "50+" när frågan slog i taket. */
export async function provMarke(nav) {
  const rader = await minaRader();
  const n = summaAttRatta(rader);
  if (!n || !nav.isConnected) return;
  const text = `${n}${rader.fler ? "+" : ""}`;
  nav.querySelectorAll('.tnav[data-hash="#/larare/prov"]').forEach((a) => {
    a.querySelector(".tnav-marke")?.remove();
    a.append(el(`<span class="tnav-marke" title="${text} prov att rätta"><span class="sr-only">, </span>${text}<span class="sr-only"> att rätta</span></span>`));
  });
}

/** En rad i "Att rätta": provnamn · klass, siffrorna och knappen Rätta. */
export function attRattaRad(r) {
  return `<li class="hem-rad">
    <span class="hem-rad-ic gul" aria-hidden="true">${icon("pencil", 18)}</span>
    <span class="hem-rad-txt"><b>${r.antal} prov att rätta</b>
      <span class="hint">${esc(r.namn)}${r.omprov ? " (omprov)" : ""} · ${esc(r.klass)} · ${r.inlamnade} inlämnade · ${r.rattade} rättade</span></span>
    <button type="button" class="btn small" data-hash="${esc(rattaHash(r.id))}">Rätta</button>
  </li>`;
}

/** Rutan "Att rätta" överst på Mina prov (DEL 5). Visas bara när något väntar. */
export async function renderAttRatta(ctx, host) {
  const rader = await minaRader();
  if (!rader.length || !host.isConnected) return;
  const ruta = el(`<section class="panel hem-att-ratta" aria-labelledby="provl-att-ratta">
    <h2 class="subhead hem-h" id="provl-att-ratta">${icon("inbox", 18)}<span>Att rätta</span></h2>
    <ul class="hem-lista">${rader.map(attRattaRad).join("")}</ul>
    ${rader.fler ? `<p class="hint">Visar de ${rader.length} första – resten finns under <a data-hash="#/larare/prov/tillfallen">Provtillfällen</a>.</p>` : ""}
  </section>`);
  ruta.querySelectorAll("[data-hash]").forEach((b) => b.addEventListener("click", () => ctx.go(b.dataset.hash)));
  host.replaceChildren(ruta);
}
