// ============================================================================
// Prov (#748, spec §14): lärarens rutor för anpassningarna.
//   omprovRuta(tf, onKlar)          "Omprov": ett nytt tillfälle av samma prov
//                                   för bara de elever läraren väljer (elevIds)
//                                   – förvalda är de som inte skrev provet
//   extraTidRuta(tf, elever, klar)  extra tid per elev medan provet pågår
// Rutorna och tidsgränsfältet kommer från prov-tillfalle-rutor.js. Ett omprov
// låser aldrig klassen (fokusläget gäller hela klassen).
// ============================================================================

import { errText, esc } from "../teacher-shared.js";
import { getClasses } from "../data-classes.js";
import { myRole } from "../teacher-role.js";
import { OMPROV_MAX, arOmprov, omprovForval, rensaExtraTid, tillfalleNamn } from "./prov-anpassningar.js";
import { elevLista } from "./prov-anpassningar-falt.js";
import { STATUS } from "./prov-modell.js";
import { hamtaSvar, oppnaTillfalle, sparaExtraTid, skapaTillfalle } from "./prov-tillfalle-data.js";
import { TIDSGRANS_FEL, elevNamn, kopplaTidsgrans, ruta, tidsgransFalt, tidsgransVal } from "./prov-tillfalle-rutor.js";

const fel = (box, text) => {
  const f = box.querySelector(".provl-tf-fel");
  f.textContent = text;
  f.hidden = !text;
};

/**
 * Omprov (§14): eleverna i klassen (eller i omprovet man utgår från), med de
 * som inte skrev förvalda; tidsgräns och extra tid; Öppna nu / senare.
 * Läser elevernas namn och tillfällets svar en gång.
 * @param {object} tf  tillfället omprovet gäller
 * @param {(t: string, oppnat: boolean) => void} onKlar
 */
export async function omprovRuta(tf, onKlar) {
  let elever;
  let forval;
  let role;
  try {
    const [klasser, svar, r] = await Promise.all([getClasses(), hamtaSvar(tf.id), myRole()]);
    role = r;
    const ids = arOmprov(tf) ? tf.elevIds : klasser.find((c) => c.id === tf.classId)?.studentIds || [];
    elever = await elevNamn(ids);
    forval = omprovForval(ids, svar);
  } catch (err) {
    ruta(`<div class="msg error">Kunde inte läsa klassen: ${esc(errText(err))}</div>
      <div class="provl-tf-knappar"><button class="btn ghost" data-avbryt>Stäng</button></div>`, { etikett: "Fel" });
    return;
  }
  const { box, stang } = ruta(`
    <h2 class="provl-ruta-rubrik">Omprov: ${esc(tf.provNamn)}</h2>
    <p class="hint">Ett nytt tillfälle av samma prov för bara de elever du väljer, till exempel de som var sjuka. De andra i klassen ser det inte.
      ${forval.length ? "Förvalda är de som inte skrev provet." : ""}</p>
    <fieldset class="provl-tf-grupp">
      <legend>Elever <span class="hint provl-ap-antal" data-f="antal"></span></legend>
      <div class="provl-ap-knappar">
        <button type="button" class="btn ghost small" data-val="alla">Markera alla</button>
        <button type="button" class="btn ghost small" data-val="inga">Ingen</button>
        <span class="hint">Extra tid till höger, om någon behöver det.</span>
      </div>
      <div data-plats="elever"></div>
    </fieldset>
    ${tidsgransFalt(tf.tidsgransMin || null)}
    <p class="hint">Fokusläget låser hela klassen och används inte för omprov.</p>
    <p class="provl-tf-fel msg error" role="alert" hidden></p>
    <div class="provl-tf-knappar">
      <button class="btn gron" data-act="nu">Öppna nu</button>
      <button class="btn ghost" data-act="senare">Spara och öppna senare</button>
      <button class="btn ghost" data-avbryt>Avbryt</button>
    </div>`, { etikett: `Omprov: ${tf.provNamn}` });
  kopplaTidsgrans(box);
  const antal = box.querySelector('[data-f="antal"]');
  let lista;
  const rita = (valda) => {
    lista = elevLista({ elever, valda, extraTid: lista ? lista.varde() : tf.extraTid, valbar: true, onAndrat: raknaUt });
    box.querySelector(".provl-ap-lista, [data-plats='elever']").replaceWith(lista.el);
    raknaUt();
  };
  function raknaUt() {
    const n = lista.valda().length;
    antal.textContent = `· ${n} av ${elever.length} valda`;
  }
  rita(forval);
  box.querySelector('[data-val="alla"]').addEventListener("click", () => rita(elever.map((e) => e.id)));
  box.querySelector('[data-val="inga"]').addEventListener("click", () => rita([]));

  const kor = async (oppnaNu, knapp) => {
    fel(box, "");
    const elevIds = lista.valda();
    if (!elevIds.length) return fel(box, "Välj minst en elev.");
    if (elevIds.length > OMPROV_MAX) return fel(box, `Ett omprov kan gälla högst ${OMPROV_MAX} elever.`);
    const tid = tidsgransVal(box);
    if (tid === undefined) return fel(box, TIDSGRANS_FEL);
    const text = knapp.textContent;
    box.querySelectorAll("button").forEach((b) => (b.disabled = true));
    knapp.textContent = oppnaNu ? "Öppnar…" : "Sparar…";
    let t = null;
    try {
      t = await skapaTillfalle({
        prov: { id: tf.provId, namn: tf.provNamn, installningar: tf.installningar }, classId: tf.classId, tidsgransMin: tid,
        fokus: { pa: false }, larare: role, extraTid: rensaExtraTid(lista.varde(), elevIds), elevIds,
        // Alltid det ursprungliga tillfället (även omprov av ett omprov): pluggmynten delar dess kvitto.
        omprovAv: tf.omprovAv || tf.id,
        // #810: omprovet ärver helskärmsläget (och de undantagna som skriver omprovet).
        helskarm: { pa: tf.helskarm !== false, undantag: (tf.helskarmUndantag || []).filter((u) => elevIds.includes(u)) },
      });
      if (oppnaNu) await oppnaTillfalle({ id: t, status: STATUS.FORBERETT, provId: tf.provId, provNamn: tf.provNamn, classId: tf.classId }, null);
      stang();
      onKlar?.(t, oppnaNu);
    } catch (err) {
      box.querySelectorAll("button").forEach((b) => (b.disabled = false));
      knapp.textContent = text;
      fel(box, t ? `Omprovet sparades men kunde inte öppnas: ${errText(err)}` : `Kunde inte spara: ${errText(err)}`);
      if (t) onKlar?.(t, false);
    }
  };
  box.querySelector('[data-act="nu"]').addEventListener("click", (e) => kor(true, e.currentTarget));
  box.querySelector('[data-act="senare"]').addEventListener("click", (e) => kor(false, e.currentTarget));
}

/**
 * Extra tid medan provet pågår (§14): samma lista som i Kör i klass. Eleven
 * får den nya tiden nästa gång provsidan läser tillfället (lyssnaren).
 * @param {object} tf
 * @param {{ id, namn }[]} elever  översiktens elever (redan lästa)
 * @param {() => void} klar
 */
export function extraTidRuta(tf, elever, klar) {
  const { box, stang } = ruta(`
    <h2 class="provl-ruta-rubrik">Extra tid: ${esc(tillfalleNamn(tf))}</h2>
    <p class="hint">${tf.tidsgransMin
      ? `Tidsgränsen är ${tf.tidsgransMin} minuter. Den extra tiden läggs till för just de eleverna – även för den som redan skriver. Tar du bort tid från någon som redan skrivit längre än så lämnas provet in med det senast sparade.`
      : "Provet har ingen tidsgräns – extra tid spelar ingen roll förrän det får en."}</p>
    <div data-plats="elever"></div>
    <p class="provl-tf-fel msg error" role="alert" hidden></p>
    <div class="provl-tf-knappar">
      <button class="btn gron" data-act="spara">Spara</button>
      <button class="btn ghost" data-avbryt>Avbryt</button>
    </div>`, { etikett: "Extra tid" });
  const lista = elevLista({ elever, extraTid: tf.extraTid });
  box.querySelector('[data-plats="elever"]').replaceWith(lista.el);
  const knapp = box.querySelector('[data-act="spara"]');
  knapp.addEventListener("click", async () => {
    knapp.disabled = true;
    knapp.textContent = "Sparar…";
    try {
      const extraTid = rensaExtraTid(lista.varde(), elever.map((e) => e.id));
      await sparaExtraTid(tf.id, extraTid);
      tf.extraTid = extraTid;
      stang();
      klar();
    } catch (err) {
      knapp.disabled = false;
      knapp.textContent = "Spara";
      fel(box, `Kunde inte spara: ${errText(err)}`);
    }
  });
}
