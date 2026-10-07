// ============================================================================
// Klasscentrets rum – en öppning av rummet: data, inredning, Spara/Historik
// (#490, epic #475). Skalet (lager, kamera, öppna/stäng) är kc-rum-vy.js.
// ----------------------------------------------------------------------------
// Inredningen är rum-inredning.js med en adapter mot klassens gemensamma
// layout (kc-layout-data.js):
//   möbellådan = upplåsta föremål (subscribeFunds → unlockedItems) som inte
//                står i rummet; tom → tips om shoppen
//   "Spara"    = saveLayout (explicit knapp – samtidigheten blir begriplig:
//                andras sparningar syns i realtid men skriver aldrig över en
//                pågående drag eller osparade ändringar, se kc-rum-tillstand.js)
//   Historik   = listHistory + restoreLayout (kc-rum-historik.js)
//   kanInreda  = false för gäst (grannby) och bockad elev → läsläge: ingen
//                låda, ingen drag, ingen Spara/Återställ – titta + hovra går.
//                Reglerna (#489) är den riktiga spärren.
// Laddas BARA dynamiskt (#271). deps kan injiceras (preview utan Firestore).
// ============================================================================

import { flash } from "../ui.js";
import { mountInredning } from "../rum-inredning.js";
import { kcHallHtml } from "../art-klasscenter-hall.js";
import { kcInredningSvg, kcInredningStorlek } from "../art-klasscenter-inredning.js";
import { KC_SHOP_ITEMS, kcShopItem } from "./kc-shop-items.js";
import { skapaKcRumTillstand, statusHtml } from "./kc-rum-tillstand.js";
import { ritaHistorik } from "./kc-rum-historik.js";

/** Riktiga beroenden (Firestore) – laddas först när rummet öppnas. */
async function riktigaDeps() {
  const [layout, fund, auth, fb, sdk] = await Promise.all([
    import("./kc-layout-data.js"),
    import("./kc-fund-data.js"),
    import("../auth.js"),
    import("../firebase-config.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
  ]);
  return {
    subscribeLayout: layout.subscribeLayout,
    saveLayout: layout.saveLayout,
    listHistory: layout.listHistory,
    restoreLayout: layout.restoreLayout,
    kanInreda: layout.kanInreda,
    subscribeFunds: fund.subscribeFunds,
    unlockedItems: fund.unlockedItems,
    arLarare: auth.isTeacher,
    // Bara läraren ser "vem" i historiken (elevnamn ur students/{uid}).
    namnFor: async (uids) => {
      const mig = auth.currentStudentId();
      const par = await Promise.all(uids.map(async (u) => {
        if (u === mig) return [u, "du"];
        const s = await sdk.getDoc(sdk.doc(fb.db, "students", u)).catch(() => null);
        return [u, s?.exists() ? s.data().namn || s.data().username || "" : ""];
      }));
      return new Map(par.filter(([, n]) => n));
    },
  };
}

/**
 * Starta en session i ett redan byggt skal.
 * @param {object} o   oppnaKcRum-argumenten (classId, visaOnly, niva, deps …)
 * @param {{ lager:HTMLElement, q:(k:string)=>HTMLElement }} skal
 * @returns {{ t:object, slapAmbient:(pa:boolean)=>void,
 *   panelOppnad:(namn:string)=>void, stad:()=>void }}
 */
export function startaKcRumSession(o, { lager, q }) {
  const visaOnly = !!o.visaOnly;
  const classId = o.classId;
  const t = skapaKcRumTillstand();
  let deps = o.deps || null;
  let kan = false;
  let animera = false;
  let sparar = false;
  let sparatNyss = false;
  let upplasta = new Set();
  let ladaLaddad = false;
  let fel = "";
  let levande = true;
  const avreg = [];

  const adapter = {
    placements: () => t.placements,
    lada: (id) => (upplasta.has(id) ? 1 : 0),
    ladaIds: () => KC_SHOP_ITEMS.filter((it) => upplasta.has(it.id)).map((it) => it.id),
    spara: () => {
      t.andrat();
      sparatNyss = false;
      status();
    },
    kanInreda: () => kan && t.laddad,
    sak: (id) => {
      const it = kcShopItem(id);
      if (!it) return null;
      const st = kcInredningStorlek(it.art) || { w: it.storlek.w / 2.5, h: it.storlek.h / 2.5 };
      return {
        namn: it.namn, w: st.w, h: st.h, golv: it.zon === "golv",
        art: kcInredningSvg(it.art, { animera }) || it.emoji,
      };
    },
    rang: (k) => t.rang(k),
    ovanpa: (k) => t.ovanpa(k),
    efterDrag: () => {
      if (t.efterDrag()) ritaAllt();
      status();
    },
  };

  const inr = mountInredning({
    stage: lager,
    tray: q("lada"),
    trayHint: q("lada-hint"),
    adapter,
    bakgrund: () => kcHallHtml(o.niva || 1),
    text: {
      tomtRum: () => (!t.laddad ? ""
        : kan ? "Rummet är tomt – öppna Möbellådan 📦 och ställ in klassens saker!"
        : "Rummet är tomt än så länge."),
      tomLada: "Lådan är tom. Samla ihop till föremål i shoppen under Klasscentrum! 🛍️",
      allaUte: "Alla klassens saker står i rummet. 🎉",
      valj: "Klicka på en sak för att ställa den i rummet. Dra den sedan dit du vill och tryck Spara.",
    },
  });

  function ritaAllt() {
    if (!levande) return;
    inr.rita();
    inr.ritaLada();
  }

  function status() {
    if (!levande) return;
    const spara = q("spara");
    spara.disabled = !t.osparat || sparar;
    spara.querySelector("span").textContent = sparar ? "Sparar…" : "Spara";
    spara.classList.toggle("kc-osparat", t.osparat);
    const html = statusHtml({
      fel, laddad: t.laddad, kan, visaOnly, vantande: !!t.vantande, osparat: t.osparat, sparatNyss,
    });
    q("status").innerHTML = html;
    q("status").hidden = !html;
  }

  async function startaData() {
    deps ||= await riktigaDeps();
    if (!levande) return;
    kan = visaOnly ? false : await deps.kanInreda(classId).catch(() => false);
    if (!levande) return;
    q("verktyg").hidden = !kan;
    avreg.push(deps.subscribeLayout(classId, (layout) => {
      fel = "";
      if (t.fjarr(layout, { dragPagar: inr.pagarDrag() }) === "ritad") {
        inr.avmarkera();
        ritaAllt();
      }
      status();
    }, (err) => {
      console.warn("[klasscenter] layouten kunde inte läsas", err?.code || err);
      fel = "Rummet gick inte att hämta just nu.";
      status();
    }));
    if (kan) {
      avreg.push(deps.subscribeFunds(classId, (funds) => {
        upplasta = new Set(deps.unlockedItems(funds).map((it) => it.id));
        ladaLaddad = true;
        inr.ritaLada();
      }, (err) => console.warn("[klasscenter] möbellådan kunde inte läsas", err?.code || err)));
    }
  }

  async function spara() {
    if (!t.osparat || sparar || !kan) return;
    sparar = true;
    status();
    const res = await deps.saveLayout(classId, t.placedItemsAttSpara());
    sparar = false;
    if (!levande) return;
    if (!res.ok) flash(res.error || "Det gick inte att spara rummet.", true);
    else {
      t.sparat(res);
      sparatNyss = true;
    }
    status();
  }

  function visaHistorik() {
    return ritaHistorik({
      lista: q("historik"),
      hint: q("historik-hint"),
      hamta: () => deps.listHistory(classId),
      aktuellVersion: () => t.version,
      visaVem: !!deps.arLarare?.(),
      namnFor: deps.namnFor,
    });
  }

  async function aterstall(slot, historikVersion) {
    if (!kan) return;
    if (t.osparat && !confirm("Återställningen ersätter dina osparade ändringar. Fortsätta?")) return;
    const res = await deps.restoreLayout(classId, slot, { historikVersion });
    if (!levande) return;
    if (!res.ok) {
      flash(res.error || "Det gick inte att återställa.", true);
      if (res.kod === "historik-andrad") visaHistorik();
      return;
    }
    t.aterstallt(res);
    inr.avmarkera();
    ritaAllt();
    sparatNyss = false;
    status();
    flash("Rummet är återställt ✓ – det blev en ny sparning, så det går att ångra i Historik.");
    visaHistorik();
  }

  // Sessionens knappar (skalet äger Till byn/paneler/Escape).
  const ui = q("status").parentElement;
  const vidKlick = (e) => {
    if (e.target.closest('[data-kc="spara"]')) return spara();
    if (e.target.closest('[data-kc="visa-deras"]')) {
      if (t.visaVantande()) {
        inr.avmarkera();
        ritaAllt();
      }
      return status();
    }
    const btn = e.target.closest("[data-slot]");
    if (btn) aterstall(Number(btn.dataset.slot), Number(btn.dataset.version));
  };
  ui.addEventListener("click", vidKlick);

  q("verktyg").hidden = true;
  ritaAllt();
  status();
  startaData().catch((err) => {
    console.warn("[klasscenter] rummet", err);
    fel = "Rummet gick inte att öppna just nu.";
    status();
  });

  return {
    t,
    // #374: ambient (fiskar, vatten, glitter) bara när kameran står still.
    slapAmbient(pa) {
      if (animera === pa || !levande) return;
      animera = pa;
      inr.rita();
    },
    panelOppnad(namn) {
      if (namn === "historik" && deps) visaHistorik();
      if (namn === "lada" && !ladaLaddad) q("lada-hint").textContent = "Hämtar klassens saker…";
    },
    stad() {
      levande = false;
      ui.removeEventListener("click", vidKlick);
      for (const a of avreg) a?.();
      q("status").hidden = true;
    },
  };
}
