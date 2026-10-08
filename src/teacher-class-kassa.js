// ============================================================================
// Pluggporten – lärarsidan: Klasskassan per klass (teacher-class-kassa.js)
// ----------------------------------------------------------------------------
// Issue #526. Ett block i Klasscentret-sektionen (teacher-class-klasscenter.js):
//   • Saldo i realtid + "Lägg från klasskassan" (välj föremål + belopp) –
//     läraren får alltid, oavsett kassörer.
//   • Klasskassörer: kryssrutor (samma mönster som "Vem får inreda?") →
//     classCenters/{id}.kassorer. Klassen röstar fram dem IRL; läraren kan
//     byta när som helst. Utan kassör kan bara läraren lägga från kassan.
//   • Historiken: in (Live-match) och ut (föremål, av vem, när).
//
// Laddas DYNAMISKT (via teacher-class-klasscenter.js) – aldrig i den statiska
// bootgrafen (#271). Rena delar: klasscenter/kc-larare.js, kc-kassa-plan.js.
// ============================================================================

import { el, esc, icon } from "./teacher-shared.js";
import { KC_SHOP_ITEMS, kcShopItem } from "./klasscenter/kc-shop-items.js";
import { kassorerHtml, elevNamn } from "./klasscenter/kc-larare.js";
import { narText } from "./klasscenter/kc-rum-historik.js";

const ok = (t) => `<span class="ok-inline">✓ ${esc(t)}</span>`;
const fel = (t) => `<span class="err-inline">${esc(t)}</span>`;
const H3 = "display:flex;align-items:center;gap:8px;margin:0 0 6px";
const H4 = "margin:16px 0 6px";
const LISTA = "list-style:none;margin:0;padding:0;display:grid;gap:6px";
const RAD = "display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;padding:8px 12px;" +
  "border:1px solid var(--t-border, #ccc);border-radius:10px";
const tal = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("sv-SE");

/** Historikrader (lärarens stil). */
function historikHtml(poster, namnFor) {
  if (!poster.length) return `<p class="hint">Inga händelser än. Kassan fylls när klassen vinner en Live-match med mynt-pris.</p>`;
  return `<ul style="${LISTA}">${poster.map((p) => {
    const it = kcShopItem(p.itemId);
    const vad = p.typ === "in"
      ? `<b style="color:var(--t-accent,#27ae60)">+${tal(p.belopp)}</b> Live-match: ${esc(p.titel || p.sessionId)}`
      : `<b style="color:#d9534f">−${tal(p.belopp)}</b> ${esc(it ? `${it.emoji} ${it.namn}` : p.itemId)} · av ${esc(namnFor(p.uid))}`;
    return `<li style="${RAD}"><span>${vad}</span><span class="hint">${esc(narText(p.at))}</span></li>`;
  }).join("")}</ul>`;
}

/**
 * Rendera Klasskassan-blocket in i `host`.
 * @param {HTMLElement} host
 * @param {object} cls       klassdokumentet
 * @param {object[]} elever  klassens elever (sorterade)
 * @param {(uid:string)=>string} namnFor
 */
export async function renderClassKassa(host, cls, elever, namnFor) {
  const [api, fundApi] = await Promise.all([
    import("./klasscenter/kc-kassa-data.js"),
    import("./klasscenter/kc-fund-data.js"),
  ]);
  const box = el(`<div>
    <h3 style="${H3}">${icon("trophy", 18)} Klasskassan</h3>
    <p class="hint">Klassen vinner mynt till kassan i Live-matcher med mynt-pris. Kassörerna (och du) lägger
      kassan på Klasscentrum-föremål – samma mätare som elevernas egna donationer.</p>
    <p style="font-size:1.25rem;margin:6px 0">Saldo: <b class="kc-kassa-saldo">…</b></p>
    <div class="row-inline" style="flex-wrap:wrap;gap:8px">
      <select class="select kc-kassa-item" aria-label="Föremål"></select>
      <input class="kc-kassa-belopp" type="number" min="1" step="1" inputmode="numeric" placeholder="Belopp" style="width:8em;padding:8px 12px" />
      <button class="btn gron small" data-act="kc-kassa-lagg">Lägg från klasskassan</button>
      <span class="kc-kassa-resultat"></span>
    </div>
    <h4 style="${H4}">Klasskassörer</h4>
    <p class="hint">Klassen röstar fram kassörer på klassrådet – kryssa i dem här. Bara kassörer och du kan lägga
      mynt från kassan. Utan kassör kan bara du.</p>
    <div class="kc-kassorer-lista"><div class="spinner">Laddar…</div></div>
    <div class="row-inline" style="margin-top:12px">
      <button class="btn gron small" data-act="kc-spara-kassorer">${icon("save", 16)}<span>Spara kassörer</span></button>
      <span class="kc-kassorer-resultat"></span>
    </div>
    <h4 style="${H4}">Historik</h4>
    <div class="kc-kassa-historik"><div class="spinner">Laddar…</div></div>
  </div>`);
  host.replaceChildren(box);
  const $ = (s) => box.querySelector(s);

  let saldo = 0;
  let funds = null;
  const unsubs = [];
  const stang = () => {
    unsubs.splice(0).forEach((u) => u());
    clearInterval(vakt);
  };
  const vakt = setInterval(() => !box.isConnected && stang(), 5000);

  function ritaVal() {
    const val = $(".kc-kassa-item");
    const fore = val.value;
    const kvar = KC_SHOP_ITEMS.filter((it) => !funds?.[it.id]?.isUnlocked);
    val.innerHTML = kvar.length
      ? kvar.map((it) => {
        const f = funds?.[it.id];
        const saknas = (f?.targetPrice || it.targetPrice) - (f?.fundedAmount || 0);
        return `<option value="${esc(it.id)}">${esc(it.emoji)} ${esc(it.namn)} – ${tal(saknas)} mynt saknas</option>`;
      }).join("")
      : `<option value="">Allt är redan köpt</option>`;
    if (kvar.some((it) => it.id === fore)) val.value = fore;
    $('[data-act="kc-kassa-lagg"]').disabled = !kvar.length || saldo < 1;
  }

  unsubs.push(api.subscribeKassa(cls.id, (s) => {
    saldo = s;
    $(".kc-kassa-saldo").textContent = `${tal(s)} mynt`;
    $(".kc-kassa-belopp").max = String(s);
    ritaVal();
  }, (err) => ($(".kc-kassa-saldo").innerHTML = fel(`Kunde inte läsa kassan: ${err.message}`))));
  unsubs.push(fundApi.subscribeFunds(cls.id, (f) => {
    funds = f;
    ritaVal();
  }, () => {}));
  unsubs.push(api.subscribeKassaHistorik(cls.id, (poster) => {
    $(".kc-kassa-historik").innerHTML = historikHtml(poster, namnFor);
  }, (err) => ($(".kc-kassa-historik").innerHTML = fel(`Kunde inte läsa historiken: ${err.message}`))));

  $('[data-act="kc-kassa-lagg"]').addEventListener("click", async (e) => {
    const knapp = e.currentTarget;
    const itemId = $(".kc-kassa-item").value;
    const belopp = Math.floor(Number($(".kc-kassa-belopp").value));
    const res = $(".kc-kassa-resultat");
    if (!itemId || !(belopp >= 1)) {
      res.innerHTML = fel("Välj föremål och ett belopp på minst 1 mynt.");
      return;
    }
    knapp.disabled = true;
    res.innerHTML = "Lägger…";
    const r = await api.laggFranKassan(cls.id, itemId, belopp);
    const namn = kcShopItem(itemId)?.namn || itemId;
    res.innerHTML = r.ok
      ? ok(r.isUnlocked ? `${namn} är köpt! (${tal(r.amount)} mynt ur kassan)` : `${tal(r.amount)} mynt lades på ${namn}${r.cappat ? " (det behövdes inte mer)" : ""}.`)
      : fel(r.error || "Det gick inte.");
    if (r.ok) $(".kc-kassa-belopp").value = "";
    ritaVal();
  });

  const lista = $(".kc-kassorer-lista");
  const spara = $('[data-act="kc-spara-kassorer"]');
  try {
    lista.innerHTML = kassorerHtml(elever, await api.getKassorer(cls.id));
  } catch (err) {
    lista.innerHTML = fel(`Kunde inte läsa kassörerna: ${err.message}`);
    spara.disabled = true;
    return;
  }
  spara.addEventListener("click", async () => {
    const res = $(".kc-kassorer-resultat");
    const valda = [...lista.querySelectorAll("input[data-kc-kassor]:checked")].map((c) => c.dataset.kcKassor);
    spara.disabled = true;
    res.innerHTML = "Sparar…";
    try {
      const sparat = await api.setKassorer(cls.id, valda);
      const namn = elever.filter((s) => sparat.includes(s.id)).map(elevNamn);
      res.innerHTML = namn.length ? ok(`Sparat – kassörer: ${namn.join(", ")}`) : ok("Sparat – ingen kassör (bara du kan lägga från kassan)");
    } catch (err) {
      res.innerHTML = fel(`Kunde inte spara: ${err.message}`);
    } finally {
      spara.disabled = false;
    }
  });
}
