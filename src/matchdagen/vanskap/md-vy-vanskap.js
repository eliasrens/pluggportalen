// ============================================================================
// Matchdagen (#874, Etapp 4): fliken Vänskap – lobbyn (spec §11.1–11.2, §11.4).
// Klasskompisarna som också har Matchdagen, utmaningarna (2 minuter), pågående
// matcher i klassen och de inbördes mötena ("Blixtarna IF – FC Omar: 3–1–2").
// En match där eleven är med öppnas direkt (md-vanskap-spel.js) – både för den som
// antog och för den som utmanade (lobbyn ändras, båda lyssnar).
//
// Kvoten (§13): EN onSnapshot på mdLobby/{classId} bara medan fliken är öppen,
// mdVanskapElev/{uid} EN gång (dagens betalda matcher), klasslistan EN gång per besök
// (classProjections, page-matchdagen.js). Allt annat går genom callables.
//
//   visaVanskap(S, el)   S.vanskap = { classId, kompisar() → [{ uid, namn }], moln() → modulen }
//   lobbyHtml(S, { lob, kompisar, elev, nu }) → lobbyns HTML (allt namn-text med esc())
//   bevaka(S, moln, matchId) → vakten: EN lyssnare per match och sida, kvar över flikbyten.
//     Slutar matchen räknas kassan och de inbördes mötena in i S.K precis som servern gör
//     (FieldValue.increment) – nästa sparning från appen får inte skriva över dem.
// ============================================================================

import { VANSKAP } from "../delat/md-config.js";
import { dagNyckel } from "../delat/md-sasong.js";
import { inbordesText, motsida } from "../delat/md-vanskap.js";
import { sparaKon } from "../md-spara.js";
import { esc } from "../vy/md-vy-delat.js";

const UTMANING_MS = VANSKAP.utmaning * 1000;
const tal = (x) => Math.max(0, Math.floor(Number(x) || 0));

/** Slutet sett av den här sidan: kassan och de inbördes mötena in i S.K (som servern skrev dem). */
function rakneIn(S, m) {
  const r = m.resultat;
  const s = m.a === S.uid ? "a" : "b";
  const o = motsida(s);
  if (!r || !S.K) return;
  const vof = r.vinnare === s ? "v" : r.vinnare === o ? "f" : "o";
  const mot = m[o];
  const g = S.K.inbordes?.[mot] || {};
  S.K = {
    ...S.K, kassa: tal(S.K.kassa) + tal(r.kassa?.[s]),
    inbordes: { ...S.K.inbordes, [mot]: { ...g, [vof]: tal(g[vof]) + 1, namn: String(m.V?.lag?.[o]?.namn || "").slice(0, 24) } },
  };
  S.kassa?.();
}

export function bevaka(S, moln, matchId) {
  if (S.vanskapVakt?.id === matchId) return S.vanskapVakt;
  S.vanskapVakt?.stopp();
  const lyss = new Set();
  let sagPagar = false;
  let inraknad = false;
  const vakt = { id: matchId, M: null, fel: null, laddad: false };
  const av = moln.lyssnaMatch(matchId, (m) => {
    vakt.M = m;
    vakt.laddad = true;
    if (m?.status === "pagar") sagPagar = true;
    // Bara en match som pågick när vakten startade – karriären som lästes före slutet saknar pengarna.
    if (m && m.status !== "pagar" && sagPagar && !inraknad) { inraknad = true; rakneIn(S, m); }
    lyss.forEach((f) => f());
    if (m?.status !== "pagar" && !lyss.size) vakt.stopp();
  }, (err) => { vakt.fel = err; lyss.forEach((f) => f()); });
  vakt.lyssna = (f) => { lyss.add(f); return () => lyss.delete(f); };
  vakt.stopp = () => { av(); if (S.vanskapVakt === vakt) S.vanskapVakt = null; };
  S.signal?.addEventListener("abort", vakt.stopp, { once: true });
  S.vanskapVakt = vakt;
  return vakt;
}

function kompisRad(k, { lob, uid, nu }) {
  const spelar = Object.values(lob.matcher).some((x) => x.a === k.uid || x.b === k.uid);
  const utmanad = Object.entries(lob.utmaningar).find(([, u]) => u.fran === uid && u.till === k.uid && nu - u.sedan < UTMANING_MS);
  const knapp = spelar ? `<span class="md-svag">spelar just nu</span>`
    : utmanad ? `<span class="md-svag">väntar på svar …</span> <button type="button" class="md-ghost" data-tillbaka="${esc(utmanad[0])}">Ta tillbaka</button>`
      : `<button type="button" class="md-stor" data-utmana="${esc(k.uid)}">Utmana</button>`;
  return `<li class="mdv-kompis"><b>${esc(k.namn)}</b><span class="mdv-hoger">${knapp}</span></li>`;
}

export function lobbyHtml(S, { lob, kompisar, elev, nu }) {
  const uid = S.uid;
  const inkomna = Object.entries(lob.utmaningar).filter(([, u]) => u.till === uid && nu - u.sedan < UTMANING_MS);
  const andra = Object.values(lob.matcher).filter((x) => x.a !== uid && x.b !== uid);
  const idag = elev?.dag === dagNyckel(nu) ? tal(elev.antal) : 0;
  const k = VANSKAP.kassa;
  const inb = Object.entries(S.K?.inbordes || {}).filter(([, r]) => r && typeof r === "object")
    .sort(([, a], [, b]) => tal(b.v) + tal(b.o) + tal(b.f) - (tal(a.v) + tal(a.o) + tal(a.f)));
  return `<div class="mdv">
    ${inkomna.map(([id, u]) => `<div class="md-panel mdv-inbjudan" role="status">
      <p class="md-overrad">Utmaning!</p>
      <h2>${esc(u.franNamn || "En kompis")} (${esc(u.franLag || "")}) vill spela en vänskapsmatch</h2>
      <div class="md-rad"><button type="button" class="md-stor" data-anta="${esc(id)}">Anta</button>
        <button type="button" class="md-ghost" data-nej="${esc(id)}">Nej tack</button></div>
    </div>`).join("")}
    <div class="md-panel">
      <h2>Vänskapsmatcher</h2>
      <p class="md-svag">Spela mot en klasskompis med era egna lag. Båda svarar på frågor på sin egen nivå – den som svarar rätt gör bäst ifrån sig. Ligan påverkas inte.</p>
      ${kompisar.length ? `<ul class="mdv-lista">${kompisar.map((x) => kompisRad(x, { lob, uid, nu })).join("")}</ul>`
        : `<p>Ingen annan i klassen har Matchdagen än.</p>`}
      <p class="md-fel" data-fel aria-live="polite"></p>
      <p class="md-svag mdv-kassa">${k.deltagande} kr för att spela och ${k.vinst} kr extra vid vinst, för ${k.perDag} vänskapsmatcher per dag. I dag: <b>${Math.min(idag, k.perDag)} av ${k.perDag}</b>.</p>
    </div>
    ${andra.length ? `<div class="md-panel"><h3>Spelar just nu</h3><ul class="mdv-lista">${andra.map((x) =>
      `<li>${esc(x.aNamn)} (${esc(x.aLag)}) – ${esc(x.bNamn)} (${esc(x.bLag)})</li>`).join("")}</ul></div>` : ""}
    <div class="md-panel"><h3>Inbördes möten</h3>
      ${inb.length ? `<p class="md-svag">Vinster–oavgjorda–förluster</p><ul class="mdv-lista">${inb.map(([, r]) =>
        `<li>${esc(inbordesText(S.K.klubb?.namn || "", r.namn || "", r))}</li>`).join("")}</ul>` : `<p class="md-svag">Inga vänskapsmatcher spelade än.</p>`}
    </div>
  </div>`;
}

export async function visaVanskap(S, el) {
  const VS = S.vanskap;
  const signal = S.flik?.signal;
  el.innerHTML = `<div class="md-panel"><p class="md-svag">Hämtar lobbyn …</p></div>`;
  const moln = await VS.moln();
  // Kommer eleven tillbaka till en pågående match (vakten finns) öppnas den direkt.
  if (S.vanskapVakt?.M?.status === "pagar") return oppna(S, el, moln, S.vanskapVakt.id);
  const [kompisar, elev] = await Promise.all([VS.kompisar().catch(() => []), moln.lasElev(S.uid).catch(() => ({}))]);
  if (signal?.aborted) return;
  let lob = null;
  let felText = "";
  let upptagen = false;
  let oppnad = false;
  const rita = () => {
    if (!lob || oppnad || signal?.aborted) return;
    const egen = Object.entries(lob.matcher).find(([, x]) => x.a === S.uid || x.b === S.uid);
    if (egen) { oppnad = true; stang(); oppna(S, el, moln, egen[0]); return; }
    // Fokus stannar på samma knapp när lobbyn ritas om (tangentbordet).
    const nyckel = (b) => JSON.stringify({ ...b.dataset });
    const fokus = document.activeElement && el.contains(document.activeElement) ? nyckel(document.activeElement) : null;
    el.innerHTML = lobbyHtml(S, { lob, kompisar, elev, nu: moln.serverNow() });
    el.querySelector("[data-fel]").textContent = felText;
    el.querySelectorAll("button").forEach((b) => { b.disabled = upptagen; });
    if (fokus) [...el.querySelectorAll("button")].find((b) => nyckel(b) === fokus)?.focus({ preventScroll: true });
  };
  const norm = (d) => {
    const map = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    return { utmaningar: map(d?.utmaningar), matcher: map(d?.matcher) };
  };
  const av = moln.lyssnaLobby(VS.classId, (d) => { lob = norm(d); rita(); }, (err) => {
    console.warn("Matchdagen: lobbyn kunde inte läsas", err);
    el.innerHTML = `<div class="md-panel"><p>Lobbyn går inte att öppna just nu. Prova igen om en stund.</p></div>`;
  });
  const timer = setInterval(rita, 5000); // utmaningar som gått ut försvinner
  const stang = () => { av(); clearInterval(timer); };
  signal?.addEventListener("abort", stang, { once: true });

  async function gor(fn) {
    upptagen = true;
    felText = "";
    rita();
    try {
      // En match som inte hann sparas (offline) sparas först – annars skriver den över kassan efteråt.
      if (!(await sparaKon(S).catch(() => false))) throw new Error("Din senaste match är inte sparad än. Kontrollera nätet och försök igen.");
      const r = await fn();
      if (r?.matchId && !signal?.aborted) { oppnad = true; stang(); return oppna(S, el, moln, r.matchId); }
    } catch (err) {
      felText = err?.message || "Det gick inte just nu – försök igen.";
    }
    upptagen = false;
    rita();
  }
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || upptagen || oppnad) return;
    if (b.dataset.utmana) gor(() => moln.utmana(VS.classId, b.dataset.utmana));
    else if (b.dataset.anta) gor(() => moln.svara(b.dataset.anta, true, VS.classId));
    else if (b.dataset.nej) gor(() => moln.svara(b.dataset.nej, false, VS.classId));
    else if (b.dataset.tillbaka) gor(() => moln.svara(b.dataset.tillbaka, false, VS.classId));
  }, { signal });
}

async function oppna(S, el, moln, matchId) {
  const vakt = bevaka(S, moln, matchId);
  const { spelaVanskap } = await import("./md-vanskap-spel.js");
  return spelaVanskap(S, el, { moln, vakt });
}
