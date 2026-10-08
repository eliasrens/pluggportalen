// ============================================================================
// Klasscentret – klasskassan överst i Klasscentrum-shoppen (#526).
// ----------------------------------------------------------------------------
// Monteras av kc-shop-vy.js (bara dynamiskt, #271) för den valda klassen:
// saldot i realtid, vilka som är kassörer, och historiken (in: Live-match,
// ut: föremål, av vem, när) bakom en knapp – historiken prenumereras först
// när den öppnas. Talar om för shoppen om eleven är kassör (onChange) så
// korten kan visa "Från klasskassan". Reglerna avgör ändå på riktigt.
//
// API
//   mountKassaRad(host, { classId, uid, deps, onChange }) → stopp()
//     deps     { getKassorer, subscribeKassa, subscribeKassaHistorik, namnFor(uid) → Promise<string> }
//     onChange({ kan, saldo })  vid varje ändring av saldo/kassörsroll
// ============================================================================

import { kassaRadHtml, kassaHistorikHtml, kassorText } from "./kc-kassa-html.js";

export function mountKassaRad(host, { classId, uid, deps, onChange = () => {} }) {
  let aktiv = true;
  let saldo = 0;
  let kan = false;
  let kassorer = "";
  let oppen = false;
  let poster = null;
  let unsubSaldo = null;
  let unsubHist = null;
  const namn = new Map(); // uid → visningsnamn (historikens "av vem")

  const stopp = () => {
    aktiv = false;
    unsubSaldo?.();
    unsubHist?.();
    host.onclick = null;
  };

  function rita() {
    if (!aktiv) return;
    host.innerHTML = kassaRadHtml(saldo, { kan, oppen, kassorer });
    if (oppen) ritaLista();
  }
  function ritaLista() {
    const lista = host.querySelector(".kcs-kassa-lista");
    if (!lista) return;
    lista.innerHTML = poster
      ? kassaHistorikHtml(poster, { namnFor: (u) => namn.get(u) || "…" })
      : `<p class="kcs-kassa-tom">Laddar…</p>`;
  }
  async function hamtaNamn(uids) {
    const nya = [...new Set(uids)].filter((u) => u && !namn.has(u));
    if (!nya.length) return false;
    await Promise.all(nya.map(async (u) => namn.set(u, await deps.namnFor(u).catch(() => "någon"))));
    return true;
  }

  host.onclick = (e) => {
    if (!e.target.closest(".kcs-kassa-hist")) return;
    oppen = !oppen;
    if (oppen && !unsubHist) {
      unsubHist = deps.subscribeKassaHistorik(classId, async (p) => {
        poster = p;
        ritaLista();
        if (await hamtaNamn(p.filter((x) => x.typ === "ut").map((x) => x.uid)) && aktiv) ritaLista();
      }, (err) => {
        console.warn("[klasscenter] kassans historik kunde inte läsas", err?.code || err);
        poster = [];
        ritaLista();
      });
    }
    rita();
  };

  (async () => {
    const lista = await deps.getKassorer(classId).catch(() => []);
    if (!aktiv) return;
    kan = lista.includes(uid);
    await hamtaNamn(lista);
    kassorer = kassorText(lista.map((u) => namn.get(u)));
    rita();
    onChange({ kan, saldo });
    unsubSaldo = deps.subscribeKassa(classId, (s) => {
      saldo = s;
      const el = host.querySelector(".kcs-kassa-saldo");
      if (el) el.textContent = `${s.toLocaleString("sv-SE")} mynt`;
      else rita();
      onChange({ kan, saldo });
    }, (err) => {
      console.warn("[klasscenter] klasskassan kunde inte läsas", err?.code || err);
      if (aktiv) host.innerHTML = "";
    });
  })();

  rita();
  return stopp;
}
