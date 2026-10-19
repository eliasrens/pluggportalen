// ============================================================================
// Pluggporten – lärarsidan: Hem (teacher-hem.js, #807)
// ----------------------------------------------------------------------------
// #/larare/hem (gamla #/larare/oversikt omdirigeras hit) – epic #802 DEL 2,
// ersätter översikten från #679. Svarar på "vad behöver jag göra, och hur går det?":
//   * Kom igång (bara årskurslärare): fyra steg som bockas av automatiskt,
//     "Gör det nu" per steg, "Dölj" sparas i localStorage
//   * Att göra: prov att rätta, öppna prov, fokusläge på (Stäng av), Live som
//     pågår (Öppna), elever som inte övat på 2 veckor (Visa); annars
//     "Inget att göra just nu 👍"
//   * Snabbval: fyra genvägar
//   * Mina klasser: kompakta kort; admin kan dölja klasser (localStorage per lärare)
// Logiken: teacher-hem-logik.js. Läsningarna: teacher-hem-data.js (högst en per
// klass, docs/LARARSIDAN_HEM_LASNINGAR.md). Laddas med import() ur TEACHER_TABS
// – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import * as data from "./data.js";
import { el, esc, icon, isTeacher, renderGate, teacherHead, teacherNav, wireHashLinks } from "./teacher-shared.js";
import { filterClasses, myRole } from "./teacher-role.js";
import { activeLock, formatKlockslag, lockLabel } from "./class-lock.js";
import { clearClassLock, serverNow } from "./data-class-lock.js";
import {
  LAGRING, SNABBVAL, attGoraRader, harOmraden, inaktiva, klassKort, komIgangSteg, synligaKlasser, visaKomIgang,
} from "./teacher-hem-logik.js";
import { doldaKlasser, lasHem, lasLokalt, sparaDoldaKlasser, sparaLokalt, FIRESTORE } from "./teacher-hem-data.js";

export async function pageLarareHem(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  ctx.app.replaceChildren(el(`<div class="spinner">Laddar Hem…</div>`));
  const startHash = window.location.hash;

  let classes = [];
  let role;
  try {
    [classes, role] = await Promise.all([data.getClasses(), myRole()]);
  } catch (err) {
    ctx.app.replaceChildren(el(`<div class="panel"><div class="msg error">Kunde inte ladda klasser: ${esc(err.message)}</div></div>`));
    return;
  }
  if (window.location.hash !== startHash) return;
  classes = filterClasses(classes, role);
  const uid = role.uid;

  // Kom igång (2.1): stegen som redan räknats klara läses inte om.
  const sparat = lasLokalt(LAGRING.komIgangKlart(uid), {}) || {};
  const klart = { kort: !!lasLokalt(LAGRING.kortUtskrivna(uid)), omraden: harOmraden(classes), prov: !!sparat.prov, live: !!sparat.live };
  const komDold = !!lasLokalt(LAGRING.komIgangDold(uid));
  const komMojlig = visaKomIgang({ admin: role.admin, dold: komDold, steg: komIgangSteg(klart) });
  const fraga = komMojlig ? { prov: !klart.prov, live: !klart.live } : {};

  // Admin: dolda klasser (testklasser) på Hem – "Visa alla" visar dem igen.
  const st = { dolda: role.admin ? doldaKlasser(uid) : new Set(), visaAlla: false, live: [] };
  const synliga = () => (role.admin ? synligaKlasser(classes, st.dolda, st.visaAlla) : classes);

  const las = await lasHem({ classes, synliga: synliga(), role, fraga });
  if (window.location.hash !== startHash) return;
  const members = las.members;
  const markeraKlart = (key) => {
    if (klart[key]) return;
    klart[key] = true;
    sparaLokalt(LAGRING.komIgangKlart(uid), { prov: klart.prov, live: klart.live });
  };
  if (las.egetProv) markeraKlart("prov");
  if (las.egenLive) markeraKlart("live");

  const page = el(`<div class="teacher-page teacher-dark hem-page">
    <p class="hem-lead">Här ser du det som behöver göras och hur det går för dina klasser.</p>
    <div class="hem-kom-host"></div>
    <div class="hem-grid2">
      <section class="panel hem-block" aria-labelledby="hem-att">
        <h2 class="subhead hem-h" id="hem-att">${icon("check", 18)}<span>Att göra</span></h2>
        <div class="hem-att-host"></div>
      </section>
      <section class="panel hem-block" aria-labelledby="hem-snabb">
        <h2 class="subhead hem-h" id="hem-snabb">${icon("bolt", 18)}<span>Snabbval</span></h2>
        <div class="hem-snabb">${SNABBVAL.map((s) => `<button type="button" class="hem-snabbval" data-hash="${esc(s.hash)}">
          <span class="hem-snabb-ic" aria-hidden="true">${icon(s.icon, 18)}</span><b>${esc(s.titel)}</b><span class="hint">${esc(s.text)}</span></button>`).join("")}</div>
      </section>
    </div>
    <section class="hem-block hem-klasser" aria-labelledby="hem-mk">
      <div class="hem-klasser-head">
        <h2 class="subhead hem-h" id="hem-mk">${icon("users", 18)}<span>Mina klasser</span></h2>
        <span class="hem-dolda"></span>
      </div>
      <div class="hem-kort-grid"></div>
    </section>
  </div>`);
  page.prepend(teacherNav(ctx, "hem"), teacherHead(ctx, { icon: "home", title: `Hej ${role.name}!` }));
  wireHashLinks(ctx, page.querySelector(".hem-snabb"));

  // --- Kom igång ----------------------------------------------------------------
  const komHost = page.querySelector(".hem-kom-host");
  const ritaKom = () => {
    const steg = komIgangSteg(klart);
    const dold = !!lasLokalt(LAGRING.komIgangDold(uid));
    if (!visaKomIgang({ admin: role.admin, dold, steg })) return komHost.replaceChildren();
    const n = steg.filter((s) => s.klar).length;
    const ruta = el(`<section class="panel hem-kom" aria-labelledby="hem-kom-h">
      <div class="hem-kom-head"><h2 class="subhead hem-h" id="hem-kom-h">${icon("sparkle", 18)}<span>Kom igång – ${n} av ${steg.length} klart</span></h2>
        <button type="button" class="btn ghost small" data-act="dolj">Dölj</button></div>
      <ol class="hem-steg">${steg.map((s) => `<li class="${s.klar ? "klar" : ""}">
        <span class="hem-bock" aria-hidden="true">${s.klar ? icon("check", 14) : ""}</span>
        <span class="hem-steg-txt">${esc(s.text)}${s.klar ? `<span class="sr-only"> (klart)</span>` : ""}</span>
        ${s.klar ? "" : `<button type="button" class="btn small" data-hash="${esc(s.hash)}">Gör det nu</button>`}</li>`).join("")}</ol>
    </section>`);
    wireHashLinks(ctx, ruta);
    ruta.querySelector('[data-act="dolj"]').addEventListener("click", () => {
      sparaLokalt(LAGRING.komIgangDold(uid), true);
      komHost.replaceChildren();
    });
    komHost.replaceChildren(ruta);
  };

  // --- Att göra -----------------------------------------------------------------
  const attHost = page.querySelector(".hem-att-host");
  const namnPa = (id) => classes.find((c) => c.id === id)?.name || id;
  const ritaAtt = () => {
    const now = serverNow();
    const syns = new Set(synliga().map((c) => c.id));
    const fokus = synliga().flatMap((c) => {
      const lock = activeLock(c, now);
      return lock ? [{ classId: c.id, klass: c.name || c.id, mal: lockLabel(lock), sluttid: formatKlockslag(lock.till) }] : [];
    });
    const ina = synliga().map((c) => ({
      classId: c.id, klass: c.name || c.id, elever: members.get(c.id) ? inaktiva(members.get(c.id), c.studentIds) : [],
    }));
    const rader = attGoraRader({
      // #807 F3: admin – dolda klasser syns inte här heller (märket följer samma val).
      attRatta: las.attRatta.filter((r) => syns.has(r.classId)),
      oppnaProv: las.oppnaProv.filter((tf) => syns.has(tf.classId)).map((tf) => ({ id: tf.id, namn: tf.provNamn || "Prov", klass: namnPa(tf.classId) })),
      fokus,
      live: st.live.map((s) => ({ id: s.id, namn: s.name || "Live-match", lobby: s.status === "lobby" })),
      inaktiva: ina,
    });
    if (!rader.length) return attHost.replaceChildren(el(`<p class="hem-tom">Inget att göra just nu 👍</p>`));
    const ul = el(`<ul class="hem-lista">${rader.map((r) => `<li class="hem-rad hem-rad-${r.typ}">
      <span class="hem-rad-ic ${r.ton}" aria-hidden="true">${icon(r.ikon, 18)}</span>
      <span class="hem-rad-txt"><b>${esc(r.titel)}</b><span class="hint">${esc(r.text)}</span></span>
      <button type="button" class="btn small${r.typ === "ratta" ? "" : " ghost"}" ${r.hash ? `data-hash="${esc(r.hash)}"` : `data-stang="${esc(r.classId)}"`}>${esc(r.knapp)}</button>
    </li>`).join("")}</ul>`);
    wireHashLinks(ctx, ul);
    ul.querySelectorAll("[data-stang]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await clearClassLock(b.dataset.stang);
        const c = classes.find((k) => k.id === b.dataset.stang);
        if (c) delete c.lock;
        ritaAtt();
        ritaKort();
      } catch (err) {
        b.disabled = false;
        b.after(el(`<span class="msg error hem-fel">Kunde inte stänga av: ${esc(err.message)}</span>`));
      }
    }));
    attHost.replaceChildren(ul);
  };

  // --- Mina klasser ----------------------------------------------------------------
  const grid = page.querySelector(".hem-kort-grid");
  const doldaHost = page.querySelector(".hem-dolda");
  const namnKarta = lasLokalt(LAGRING.omradesNamn, {}) || {};
  const ritaKort = () => {
    const now = serverNow();
    const lista = synliga();
    grid.replaceChildren(...(lista.length
      ? lista.map((c) => {
        const lock = activeLock(c, now);
        const k = klassKort(c, { lock, members: members.get(c.id) || null, namnKarta, sluttid: lock ? formatKlockslag(lock.till) : "" });
        const dold = st.dolda.has(c.id);
        const kort = el(`<article class="hem-kort${dold ? " dold" : ""}">
          <button type="button" class="hem-kort-oppna" data-hash="${esc(k.hash)}" aria-label="Öppna ${esc(k.namn)}">
            <span class="hem-kort-namn">${esc(k.namn)}<small>${k.elever} elev${k.elever === 1 ? "" : "er"}</small></span>
            ${k.ovat ? `<span class="hint">Övat den här veckan: <b>${k.ovat.ovat} av ${k.ovat.av}</b></span>
              <span class="hem-stapel" aria-hidden="true"><i style="width:${k.ovat.av ? Math.round((100 * k.ovat.ovat) / k.ovat.av) : 0}%"></i></span>` : ""}
            <span class="hem-chips">${k.fokus ? `<span class="hem-chip fokus">${icon("lock", 13)}<span>Fokusläge till ${esc(k.fokus.sluttid)}</span></span>` : ""}
              <span class="hem-chip">${k.omraden.length ? `Jobbar med: ${esc(k.omraden.join(", "))}` : "Alla områden"}</span></span>
          </button>
          ${role.admin ? `<button type="button" class="btn ghost small hem-dolj" data-dolj="${esc(c.id)}">${dold ? "Visa igen" : "Dölj den här"}</button>` : ""}
        </article>`);
        wireHashLinks(ctx, kort);
        return kort;
      })
      : [el(`<p class="hint">${role.admin ? (classes.length ? "Alla klasser är dolda." : "Inga klasser än – skapa dem under Admin → Klasser &amp; elevkonton.")
        : "Kontot har inga klasser än – admin väljer dem under Lärarkonton."}</p>`)]));
    grid.querySelectorAll("[data-dolj]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.dolj;
      if (st.dolda.has(id)) st.dolda.delete(id);
      else st.dolda.add(id);
      sparaDoldaKlasser(uid, st.dolda);
      ritaKort();
      ritaAtt();
    }));
    ritaDolda();
  };
  // "3 klasser dolda · Visa alla" / "Dölj de dolda igen" (bara admin).
  const ritaDolda = () => {
    const n = classes.filter((c) => st.dolda.has(c.id)).length;
    if (!role.admin || !n) return doldaHost.replaceChildren();
    doldaHost.replaceChildren(el(`<span class="hint">${n} ${n === 1 ? "klass" : "klasser"} dold${n === 1 ? "" : "a"} ·
      <button type="button" class="btn ghost small">${st.visaAlla ? "Dölj dem igen" : "Visa alla"}</button></span>`));
    doldaHost.querySelector("button").addEventListener("click", async () => {
      st.visaAlla = !st.visaAlla;
      ritaKort();
      ritaAtt();
      // De dolda klassernas projektioner läses först nu (en läsning per klass).
      const saknas = synliga().filter((c) => !members.has(c.id));
      if (!saknas.length) return;
      const vals = await Promise.all(saknas.map((c) => FIRESTORE.projektion(c.id).catch(() => null)));
      saknas.forEach((c, i) => members.set(c.id, vals[i]));
      if (page.isConnected) (ritaKort(), ritaAtt());
    });
  };

  ritaKom();
  ritaAtt();
  ritaKort();
  ctx.app.replaceChildren(page);

  // Live i realtid (samma lyssnare som översikten hade); stängs när sidan lämnas.
  const mine = (s) => role.admin || (s.participatingClassIds || []).some((id) => role.classIds.has(id));
  let unsub = () => {};
  try {
    const { watchActiveSessions } = await import("./live/live-data.js");
    unsub = watchActiveSessions((list) => {
      if (!page.isConnected) return;
      st.live = list.filter(mine);
      if (st.live.some((s) => s.createdBy === uid)) (markeraKlart("live"), ritaKom());
      ritaAtt();
    }, () => {});
  } catch { /* Live-raden visas inte */ }
  const tick = setInterval(() => {
    if (!page.isConnected) return void (clearInterval(tick), unsub());
    ritaAtt(); // ett passerat klockslag släcker fokusläget
    ritaKort();
  }, 15000);
}
