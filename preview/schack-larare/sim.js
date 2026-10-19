// ============================================================================
// Simulerade elever för preview/preview-schack-larare.html (#781): spelar drag
// i Alva–Bo var 3:e sekund (och Cleo–Dino var 7:e) med SAMMA regel- och
// klocklogik som servern (schack-server-parti.js / schack-server-delat.js) och
// skriver partidokumentet – lärarens lyssnare ser dragen live. Panelen nere
// till vänster (inte en del av appen): pausa, nytt parti, ge upp.
// ============================================================================

import { doc, getDoc, runTransaction, updateDoc, setDoc, deleteField } from "./fb-firestore.js";
import { byggParti, provaDrag } from "../../src/schack/schack-server-parti.js";
import { klockaEfterDrag, nyKlocka, uppdateraTabell } from "../../src/schack/schack-server-delat.js";
import { PARTI_KLOCKA, PARTI_UTAN } from "./seed.js";

const ref = (p) => doc(null, p);
let paus = false;
let slump = 7;
const rnd = (n) => ((slump = (slump * 16807) % 2147483647) % n);

/** Ett drag: slag och schack föredras, annars slumpat. */
function valjDrag(drag) {
  const moves = byggParti(drag).moves({ verbose: true });
  if (!moves.length) return null;
  const bra = moves.filter((m) => m.captured || m.san.includes("+"));
  const m = bra.length && rnd(3) ? bra[rnd(bra.length)] : moves[rnd(moves.length)];
  return { from: m.from, to: m.to, promotion: m.promotion };
}

async function avsluta(id, p, slut) {
  const nu = Date.now();
  await runTransaction(null, async (tx) => {
    const k = (await tx.get(ref(`schackKlass/${p.classId}`))).data() || {};
    const upd = { [`partier.${id}`]: deleteField() };
    if (slut.orsak !== "avbrutet") {
      for (const [uid, rad] of Object.entries(uppdateraTabell(k.tabell || {}, { vit: p.vit, svart: p.svart, resultat: slut.resultat }))) {
        upd[`tabell.${uid}`] = rad;
      }
    }
    tx.update(ref(`schackPartier/${id}`), { status: "slut", resultat: slut.resultat, orsak: slut.orsak, remiErbjudenAv: null, uppdaterad: nu });
    tx.update(ref(`schackKlass/${p.classId}`), upd);
  });
}

async function spela(id) {
  if (paus) return;
  const p = (await getDoc(ref(`schackPartier/${id}`))).data();
  if (!p || p.status !== "pagar") return;
  const forslag = valjDrag(p.drag);
  const r = forslag && provaDrag(p.drag, forslag);
  if (!r) return;
  const nu = Date.now();
  const klocka = p.klocka ? klockaEfterDrag(p.klocka, p.tur, nu) : null;
  if (p.klocka && !klocka) return avsluta(id, p, { resultat: p.tur === "w" ? "0-1" : "1-0", orsak: "tid" });
  await updateDoc(ref(`schackPartier/${id}`), { fen: r.fen, drag: r.drag, tur: r.tur, klocka, senastDragAt: nu, uppdaterad: nu });
  if (r.slut) await avsluta(id, { ...p, drag: r.drag }, r.slut);
}

setInterval(() => spela(PARTI_KLOCKA), 3000);
setInterval(() => spela(PARTI_UTAN), 7000);

let nr = 0;
async function nyttParti() {
  const id = `pv-nytt-${++nr}`;
  const nu = Date.now();
  const [vit, svart] = nr % 2 ? ["Greta", "Hugo"] : ["Filip", "Ines"];
  const sid = (n) => `stub-${n.toLowerCase()}`;
  await setDoc(ref(`schackPartier/${id}`), {
    classId: "5e", vit: sid(vit), svart: sid(svart), vitNamn: vit, svartNamn: svart, fen: byggParti([]).fen(), drag: [], tur: "w",
    status: "pagar", resultat: null, orsak: null, klocka: nyKlocka(5, nu), remiErbjudenAv: null, senastDragAt: nu, skapad: nu, uppdaterad: nu,
  });
  await updateDoc(ref("schackKlass/5e"), { [`partier.${id}`]: { vit: sid(vit), svart: sid(svart), vitNamn: vit, svartNamn: svart, klocka: 5, start: nu } });
  setInterval(() => spela(id), 2000);
}

async function geUpp() {
  const p = (await getDoc(ref(`schackPartier/${PARTI_KLOCKA}`))).data();
  if (p?.status === "pagar") await avsluta(PARTI_KLOCKA, p, { resultat: "1-0", orsak: "gav-upp" });
}

const panel = document.createElement("div");
panel.className = "pv-schack-panel";
panel.innerHTML = `<b>Förhandsvisning</b> (inte en del av appen)<br>
  <button type="button" data-pv="paus">Pausa eleverna</button>
  <button type="button" data-pv="nytt">Nytt parti</button>
  <button type="button" data-pv="geupp">Bo ger upp</button>
  <span class="pv-lyssnare"></span>`;
panel.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;max-width:calc(100vw - 16px);padding:8px 10px;border-radius:10px;" +
  "background:#202a36;color:#e7edf3;border:1px dashed rgba(255,255,255,.3);font:13px/1.5 system-ui;display:flex;flex-wrap:wrap;gap:6px;align-items:center";
document.body.appendChild(panel);
panel.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pv]");
  if (!b) return;
  if (b.dataset.pv === "paus") {
    paus = !paus;
    b.textContent = paus ? "Fortsätt eleverna" : "Pausa eleverna";
  } else if (b.dataset.pv === "nytt") nyttParti();
  else geUpp();
});
setInterval(() => {
  const l = window.__ppStub?.lyssnare?.() || {};
  panel.querySelector(".pv-lyssnare").textContent = `Öppna lyssnare: ${Object.keys(l).filter((p) => p.startsWith("schack")).join(", ") || "inga"}`;
}, 1000);
