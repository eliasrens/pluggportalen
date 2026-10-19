// ============================================================================
// Prov (#810, spec §5.6): helskärmsläget i lärarens översikt (§5.3).
//   pausPanel({ tf, elever, onAndrat })  raderna överst: "⏸ Elias lämnade
//       provet 10:42 (bytte flik) – Släpp in" (+5 min), "Släpp in alla", och
//       valen ljud / blinkande flikrubrik (av som standard, sparas i webbläsaren).
//       EN lyssnare: where("pausad","==",true) på tillfällets svar.
//   helskarmRuta(tf, elever, klar)       ändra av/på + undantag medan provet pågår
// Laddas av prov-tillfallen-sida.js (som själv laddas dynamiskt, #271).
// CSS: prov-tillfalle.css (.provl-hs-).
// ============================================================================

import { errText, esc } from "../teacher-shared.js";
import { arPausad, helskarmPa, pausRadText, SLAPP_IN_EXTRA_MIN } from "./prov-helskarm.js";
import { helskarmFalt } from "./prov-helskarm-falt.js";
import { lyssnaPausade, slappIn, sparaHelskarm } from "./prov-tillfalle-data.js";
import { tillMs } from "./prov-tillfalle-logik.js";
import { ruta } from "./prov-tillfalle-rutor.js";
import { h } from "./prov-vy.js";

const VAL_NYCKEL = "pp:prov:helskarm:val";
function lasVal() {
  try {
    const v = JSON.parse(localStorage.getItem(VAL_NYCKEL) || "{}");
    return { ljud: v.ljud === true, blink: v.blink === true };
  } catch {
    return { ljud: false, blink: false };
  }
}
function skrivVal(v) {
  try { localStorage.setItem(VAL_NYCKEL, JSON.stringify(v)); } catch {}
}

// En kort, lågmäld signal (Web Audio) – bara om läraren slagit på ljudet.
function pip() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.08, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.35);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.36);
    o.onended = () => ac.close();
  } catch {}
}

/**
 * @param {object} o
 * @param {object} o.tf                        tillfället (extraTid uppdateras här efter "+5 min")
 * @param {{ id, namn }[]} o.elever
 * @param {(pausade: Record<string, object>) => void} [o.onAndrat]  efter varje ändring (tabellen, rubriken)
 * @returns {{ el: HTMLElement, pausade: () => Record<string, object>, stoppa: () => void }}
 */
export function pausPanel({ tf, elever, onAndrat = () => {} }) {
  const namn = Object.fromEntries(elever.map((e) => [e.id, e.namn]));
  const val = lasVal();
  let pausade = {};
  let blinkTimer = null;
  const titel = document.title;
  const lista = h("ul", { class: "provl-hs-lista" });
  const fel = h("p", { class: "msg error provl-hs-fel", role: "alert", hidden: true });
  const plusAlla = h("input", { type: "checkbox" });
  const allaKnapp = h("button", { class: "btn gron small", type: "button", text: "Släpp in alla" });
  const alla = h("div", { class: "provl-hs-alla" }, allaKnapp,
    tf.tidsgransMin ? h("label", { class: "provl-kryss" }, plusAlla, ` +${SLAPP_IN_EXTRA_MIN} min till alla`) : null);
  const kryss = (k, text) => {
    const c = h("input", { type: "checkbox", checked: val[k] });
    c.addEventListener("change", () => { val[k] = c.checked; skrivVal(val); if (!c.checked && k === "blink") blinka(false); });
    return h("label", { class: "provl-kryss" }, c, ` ${text}`);
  };
  const el = h("div", { class: "panel provl-hs-panel", hidden: true, role: "region", "aria-label": "Pausade elever" },
    h("div", { class: "provl-hs-rubrik" }, h("b", { text: "Pausade elever" }),
      h("span", { class: "provl-hs-val" }, kryss("ljud", "Ljud"), kryss("blink", "Blinkande flikrubrik"))),
    lista, alla, fel);

  function blinka(pa) {
    if (pa && !blinkTimer) {
      let av = false;
      blinkTimer = setInterval(() => {
        av = !av;
        const n = Object.keys(pausade).length;
        document.title = av ? `⏸ ${n} pausad${n === 1 ? "" : "e"} – ${titel}` : titel;
      }, 1000);
    } else if (!pa && blinkTimer) {
      clearInterval(blinkTimer);
      blinkTimer = null;
      document.title = titel;
    }
  }

  async function slapp(uids, plusMin, knapp) {
    fel.hidden = true;
    const text = knapp.textContent;
    knapp.disabled = true;
    knapp.textContent = "Släpper in…";
    try {
      const ny = await slappIn(tf, uids, { plusMin });
      if (ny) tf.extraTid = ny;
      onAndrat(pausade);
    } catch (err) {
      fel.textContent = `Kunde inte släppa in: ${errText(err)}`;
      fel.hidden = false;
    } finally {
      if (knapp.isConnected) {
        knapp.disabled = false;
        knapp.textContent = text;
      }
    }
  }

  function rita() {
    const rader = Object.values(pausade).filter(arPausad)
      .sort((a, b) => (tillMs(a.pausadAt) ?? 0) - (tillMs(b.pausadAt) ?? 0));
    el.hidden = !rader.length;
    alla.hidden = rader.length < 2;
    lista.replaceChildren(...rader.map((d) => {
      const slappKnapp = h("button", { class: "btn gron small", type: "button", text: "Släpp in" });
      slappKnapp.addEventListener("click", () => slapp([d.id], false, slappKnapp));
      const plus = tf.tidsgransMin ? h("button", { class: "btn ghost small", type: "button", text: `Släpp in +${SLAPP_IN_EXTRA_MIN} min` }) : null;
      plus?.addEventListener("click", () => slapp([d.id], true, plus));
      return h("li", { class: "provl-hs-rad" },
        h("span", { class: "provl-hs-text", text: pausRadText(namn[d.id], d, tillMs(d.pausadAt)) }),
        h("span", { class: "provl-hs-knappar" }, slappKnapp, plus));
    }));
  }
  allaKnapp.addEventListener("click", () => slapp(Object.keys(pausade), plusAlla.checked, allaKnapp));

  const av = lyssnaPausade(tf.id, (ny) => {
    const nya = Object.keys(ny).filter((uid) => !pausade[uid]);
    pausade = ny;
    rita();
    if (nya.length && val.ljud) pip();
    blinka(val.blink && Object.keys(pausade).length > 0);
    onAndrat(pausade);
  }, (err) => {
    fel.textContent = `Pausade elever kunde inte läsas: ${errText(err)}`;
    fel.hidden = false;
    el.hidden = false;
  });

  return {
    el,
    pausade: () => pausade,
    stoppa() {
      av();
      blinka(false);
    },
  };
}

/** "Helskärm": av/på och undantag medan provet pågår (§5.6). */
export function helskarmRuta(tf, elever, klar) {
  const { box, stang } = ruta(`
    <h2 class="provl-ruta-rubrik">Helskärmsläge: ${esc(tf.provNamn || "Prov")}</h2>
    <div data-plats="helskarm"></div>
    <p class="hint">Ändringen gäller när eleven startar provet eller släpps in nästa gång. Pausade elever behöver fortfarande släppas in.</p>
    <p class="provl-tf-fel msg error" role="alert" hidden></p>
    <div class="provl-tf-knappar">
      <button class="btn gron" data-act="spara">Spara</button>
      <button class="btn ghost" data-avbryt>Avbryt</button>
    </div>`, { etikett: "Helskärmsläge" });
  const hs = helskarmFalt({ hamta: async () => elever, helskarm: { pa: helskarmPa(tf), undantag: tf.helskarmUndantag } });
  box.querySelector('[data-plats="helskarm"]').replaceWith(hs.el);
  const knapp = box.querySelector('[data-act="spara"]');
  knapp.addEventListener("click", async () => {
    knapp.disabled = true;
    knapp.textContent = "Sparar…";
    try {
      const v = hs.varde();
      await sparaHelskarm(tf.id, v);
      tf.helskarm = v.pa;
      tf.helskarmUndantag = v.undantag;
      stang();
      klar();
    } catch (err) {
      knapp.disabled = false;
      knapp.textContent = "Spara";
      const fel = box.querySelector(".provl-tf-fel");
      fel.textContent = `Kunde inte spara: ${errText(err)}`;
      fel.hidden = false;
    }
  });
}
