// ============================================================================
// Pluggporten – lärarsidan: Klasscentret per klass (teacher-class-klasscenter.js)
// ----------------------------------------------------------------------------
// Issue #491 (epic #475, spec-klasscentret §4–5). Tre block under klassen:
//   • Inredning: kryssruta "Får inreda" per elev (förifylld = alla). Urbockade
//     sparas i classCenters/{id}.inredningSparr (setInredningSparr) – de kan
//     fortfarande titta och donera, men reglerna nekar deras Spara.
//   • Insamling: varje föremål med insamlat/mål/Köpt + vem som donerat hur
//     mycket (BARA här – för eleverna är donationerna anonyma). Mätarna följer
//     subscribeFunds i realtid; donationslistan hämtas om när en mätare rör sig.
//   • Layout-historik: de senaste ~10 sparningarna (vem/när) + Återställ
//     (bekräftelse; blir en NY version, så den kan ångras härifrån).
//
// Laddas DYNAMISKT från teacher-classes-sections.js – aldrig i den statiska
// bootgrafen (#271). Rena delar: klasscenter/kc-larare.js.
// ============================================================================

import { el, esc, icon } from "./teacher-shared.js";
import { auth } from "./firebase-config.js";
import { elevNamn, sparrUrBockning, inredningHtml, insamlingHtml, historikHtml } from "./klasscenter/kc-larare.js";

const ok = (t) => `<span class="ok-inline">✓ ${esc(t)}</span>`;
const fel = (t) => `<span class="err-inline">${esc(t)}</span>`;
const H3 = "display:flex;align-items:center;gap:8px;margin:0 0 6px";

/**
 * Rendera Klasscentret-sektionen för klassen `cls` in i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet
 * @param {HTMLElement} host  värd-element att fylla
 * @param {object[]} students alla lärarens elever (store.state.students)
 */
export async function renderClassKlasscenter(ctx, cls, host, students) {
  const [layoutApi, fundApi] = await Promise.all([
    import("./klasscenter/kc-layout-data.js"),
    import("./klasscenter/kc-fund-data.js"),
  ]);
  const ids = new Set(Array.isArray(cls.studentIds) ? cls.studentIds : []);
  const elever = (students || [])
    .filter((s) => ids.has(s.id))
    .sort((a, b) => elevNamn(a).localeCompare(elevNamn(b), "sv"));
  const perId = new Map((students || []).map((s) => [s.id, s]));
  const namnFor = (uid) =>
    uid === auth.currentUser?.uid ? "du (lärare)" : perId.has(uid) ? elevNamn(perId.get(uid)) : "lärare / tidigare elev";

  const box = el(`<div>
    <div class="cls-block" data-kc="inredning">
      <h3 style="${H3}">${icon("pencil", 18)} Vem får inreda?</h3>
      <p class="hint">Bocka ur elever som <b>inte</b> ska få flytta saker och spara rummet i
        <b>${esc(cls.name || cls.id)}</b>s Klasscentrum. Urbockade kan fortfarande titta i rummet
        och donera mynt till klassens föremål. Som standard får alla inreda.</p>
      <div class="kc-inredning-lista"><div class="spinner">Laddar elever…</div></div>
      <div class="row-inline" style="margin-top:12px">
        <button class="btn gron small" data-act="kc-spara-inredning">${icon("save", 16)}<span>Spara</span></button>
        <button class="btn ghost small" data-act="kc-alla-inreda">Alla får inreda</button>
        <span class="kc-inredning-resultat"></span>
      </div>
    </div>
    <div class="cls-block" data-kc="insamling">
      <h3 style="${H3}">${icon("trophy", 18)} Insamling</h3>
      <p class="hint">Klassens gemensamma insamling till Klasscentrets föremål. Eleverna ser bara
        totalsumman – vem som donerat syns bara för dig.</p>
      <div class="kc-insamling"><div class="spinner">Laddar insamlingen…</div></div>
    </div>
    <div class="cls-block" data-kc="historik">
      <h3 style="${H3}">${icon("shuffle", 18)} Rummets historik</h3>
      <p class="hint">De senaste sparningarna av rummet. Har någon ställt till det kan du återställa
        en tidigare version – den blir en ny sparning, så den går att ångra.</p>
      <div class="kc-historik"><div class="spinner">Laddar historiken…</div></div>
      <div class="kc-historik-resultat" style="margin-top:8px"></div>
    </div>
  </div>`);
  host.replaceChildren(box);

  await Promise.all([
    ritaInredning(box, cls, elever, layoutApi),
    ritaInsamling(box, cls, namnFor, fundApi),
    ritaHistorikBlock(box, cls, namnFor, layoutApi),
  ]);
}

/** Kryssrutorna + Spara (setInredningSparr). */
async function ritaInredning(box, cls, elever, api) {
  const lista = box.querySelector(".kc-inredning-lista");
  const res = box.querySelector(".kc-inredning-resultat");
  const spara = box.querySelector('[data-act="kc-spara-inredning"]');
  try {
    lista.innerHTML = inredningHtml(elever, await api.getInredningSparr(cls.id));
  } catch (err) {
    lista.innerHTML = fel(`Kunde inte läsa inredningsbehörigheten: ${err.message}`);
    spara.disabled = true;
    return;
  }
  box.querySelector('[data-act="kc-alla-inreda"]').addEventListener("click", () => {
    lista.querySelectorAll("input[data-kc-inreda]").forEach((c) => (c.checked = true));
  });
  spara.addEventListener("click", async () => {
    const ikryssade = [...lista.querySelectorAll("input[data-kc-inreda]:checked")].map((c) => c.dataset.kcInreda);
    spara.disabled = true;
    res.innerHTML = "Sparar…";
    try {
      const sparr = await api.setInredningSparr(cls.id, sparrUrBockning(elever, ikryssade));
      const namn = elever.filter((s) => sparr.includes(s.id)).map(elevNamn);
      res.innerHTML = namn.length ? ok(`Sparat – får inte inreda: ${namn.join(", ")}`) : ok("Sparat – alla får inreda");
    } catch (err) {
      res.innerHTML = fel(`Kunde inte spara: ${err.message}`);
    } finally {
      spara.disabled = false;
    }
  });
}

/** Insamlingstabellen i realtid. Lyssnaren stängs när sektionen lämnat DOM:en. */
function ritaInsamling(box, cls, namnFor, api) {
  const host = box.querySelector(".kc-insamling");
  let unsub = null;
  let senaste = "";
  const stang = () => {
    if (unsub) unsub();
    unsub = null;
    clearInterval(vakt);
  };
  const vakt = setInterval(() => !box.isConnected && stang(), 5000);
  return new Promise((klar) => {
    unsub = api.subscribeFunds(cls.id, async (funds) => {
      if (!box.isConnected) {
        stang();
        return klar();
      }
      // Samma summor → ingen ny donation, ingen ny läsning (kvot-regeln #114).
      const nyckel = Object.values(funds).map((f) => `${f.itemId}:${f.fundedAmount}`).join(",");
      if (nyckel === senaste) return klar();
      senaste = nyckel;
      try {
        host.innerHTML = insamlingHtml(funds, await api.listDonations(cls.id), namnFor);
      } catch (err) {
        host.innerHTML = fel(`Kunde inte läsa donationerna: ${err.message}`);
      }
      klar();
    }, (err) => {
      host.innerHTML = fel(`Kunde inte läsa insamlingen: ${err.message}`);
      stang();
      klar();
    });
  });
}

/** Historiklistan + Återställ (bekräftelse → restoreLayout → rita om). */
async function ritaHistorikBlock(box, cls, namnFor, api) {
  const host = box.querySelector(".kc-historik");
  const res = box.querySelector(".kc-historik-resultat");
  const rita = async () => {
    try {
      const [poster, layout] = await Promise.all([api.listHistory(cls.id), api.getLayout(cls.id)]);
      host.innerHTML = historikHtml(poster, { aktuellVersion: layout.version, namnFor });
    } catch (err) {
      host.innerHTML = fel(`Kunde inte läsa historiken: ${err.message}`);
    }
  };
  host.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-kc-aterstall]");
    if (!btn) return;
    const nar = btn.closest("li")?.querySelector(".kc-nar")?.textContent || "";
    if (!confirm(`Återställ rummet till sparningen från ${nar}? Den nuvarande layouten finns kvar i historiken.`)) return;
    btn.disabled = true;
    res.innerHTML = "Återställer…";
    const r = await api.restoreLayout(cls.id, Number(btn.dataset.kcAterstall));
    res.innerHTML = r.ok ? ok(`Återställt – rummet ser ut som ${nar} igen.`) : fel(r.error || "Det gick inte att återställa.");
    await rita();
  });
  await rita();
}
