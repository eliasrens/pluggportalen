// ============================================================================
// Prov (#740, spec §5.2–§5.4): lärarens rutor för provtillfällen – "Kör i
// klass", Öppna / Öppna igen (med fokuslåset), Stäng och Radera. Rutor på
// sidan, aldrig confirm() (§3). Används av prov-tillfallen-sida.js; B:s knapp
// "Kör i klass" i Mina prov (#739) anropar korIKlass via import().
// Anpassningarna (#748): extra tid per elev i Kör i klass och Öppna; omprovet
// och lärarens extra tid under provet bor i prov-anpassningar-rutor.js.
// Helskärmsläget (#810): av/på + undantag i Kör i klass och Öppna (prov-helskarm-falt.js).
// ============================================================================

import { el, errText, esc } from "../teacher-shared.js";
import { getClasses } from "../data-classes.js";
import { getStudentsByIds } from "../data-content.js";
import {
  EFTER, EFTER_STANDARD, EFTER_VALBARA, OVNING_MODULER, formatKlockslag, normalizeEfter, tillFromKlockslag,
} from "../class-lock.js";
import { serverNow, syncServerClock } from "../data-class-lock.js";
import { filterClasses, myRole } from "../teacher-role.js";
import { arFraga } from "./prov-fragetyper.js";
import { STATUS } from "./prov-modell.js";
import { arOmprov, rensaExtraTid, tillfalleNamn } from "./prov-anpassningar.js";
import { extraTidFalt } from "./prov-anpassningar-falt.js";
import { helskarmFalt } from "./prov-helskarm-falt.js";
import { helskarmPa } from "./prov-helskarm.js";
import { hamtaProv, oppnaTillfalle, raderaTillfalle, sparaExtraTid, sparaHelskarm, skapaTillfalle, stangTillfalle } from "./prov-tillfalle-data.js";
import { standardLasMinuter, tillbakaVarning } from "./prov-tillfalle-logik.js";
import { TIDSGRANS_MAX, TIDSGRANS_MIN, tolkaTidsgrans } from "./prov-validera.js";
import { laddaCss } from "./prov-vy.js";

const antalFragor = (fragor) => (fragor || []).filter(arFraga).length;

/** Elevernas namn (en läsning per elev) – först när läraren vill ge extra tid. */
export async function elevNamn(ids) {
  return (await getStudentsByIds(ids || []))
    .map((e) => ({ id: e.id, namn: e.namn || e.username || e.id }))
    .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
}

/** Tidsgränsen: "Ingen" eller ett antal minuter. Läs med tidsgransVal(box). */
export function tidsgransFalt(std) {
  return `<fieldset class="provl-tf-grupp">
      <legend>Tidsgräns</legend>
      <label class="provl-kryss"><input type="radio" name="provl-tid" value="ingen" ${std ? "" : "checked"} /> Ingen</label>
      <label class="provl-kryss"><input type="radio" name="provl-tid" value="min" ${std ? "checked" : ""} />
        <input type="number" class="cell provl-min" data-f="min" min="${TIDSGRANS_MIN}" max="${TIDSGRANS_MAX}" value="${std || 40}" aria-label="Minuter" /> minuter</label>
    </fieldset>`;
}
/** null = ingen, undefined = ogiltig, annars minuter. */
export function tidsgransVal(box) {
  return box.querySelector('input[name="provl-tid"]:checked').value === "min" ? tolkaTidsgrans(box.querySelector('[data-f="min"]').value) : null;
}
/** Skriver läraren minuter väljs "minuter"; onAndrat efter varje ändring. */
export function kopplaTidsgrans(box, onAndrat = () => {}) {
  box.querySelector('[data-f="min"]').addEventListener("input", () => { box.querySelector('input[name="provl-tid"][value="min"]').checked = true; onAndrat(); });
  box.querySelectorAll('input[name="provl-tid"]').forEach((r) => r.addEventListener("change", onAndrat));
}
export const TIDSGRANS_FEL = `Tidsgränsen ska vara ${TIDSGRANS_MIN}–${TIDSGRANS_MAX} minuter.`;

/** "HH:MM" om `min` minuter, avrundat uppåt till hela 5 minuter. */
function klockslagOm(min) {
  const d = new Date(serverNow() + min * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return formatKlockslag(d.getTime());
}

/** En ruta över sidan. Returnerar { box, stang }. Esc och "Avbryt" stänger. */
export function ruta(html, { etikett }) {
  const bakgrund = el(`<div class="provl-bakgrund teacher-dark"><div class="provl-ruta panel" role="dialog" aria-modal="true" aria-label="${esc(etikett)}">${html}</div></div>`);
  const box = bakgrund.firstElementChild;
  const fore = document.activeElement;
  const stang = () => {
    bakgrund.remove();
    document.removeEventListener("keydown", esc_);
    fore?.focus?.();
  };
  const esc_ = (e) => { if (e.key === "Escape") stang(); };
  document.addEventListener("keydown", esc_);
  bakgrund.addEventListener("click", (e) => { if (e.target === bakgrund) stang(); });
  box.querySelectorAll("[data-avbryt]").forEach((b) => b.addEventListener("click", stang));
  document.body.append(bakgrund);
  (box.querySelector("[autofocus]") || box.querySelector("select, input, button"))?.focus();
  return { box, stang };
}

// "Efter inlämning får eleven:" (#788) – lägena i class-lock.js (EFTER).
const EFTER_VAL = [
  [EFTER.PROV, "Stanna på provsidan"],
  [EFTER.OVNING, "Bara övning (Plugga och resorna)"],
  [EFTER.KLASS, "Klassens vanliga läge"],
  [EFTER.EGNA, "Välj själv"],
];

/** Efter inlämning: fyra lägen + kryssrutor per modul för "Välj själv" (förifyllda med övning). */
function efterFalt(efter) {
  const e = normalizeEfter(efter) || { lage: EFTER_STANDARD };
  const valda = new Set(e.lage === EFTER.EGNA ? e.moduler : OVNING_MODULER);
  return `<fieldset class="provl-efter">
      <legend>Efter inlämning får eleven:</legend>
      ${EFTER_VAL.map(([v, text]) => `<label class="provl-kryss"><input type="radio" name="provl-efter" value="${v}" ${v === e.lage ? "checked" : ""} /> ${text}</label>`).join("")}
      <div class="provl-efter-egna">
        ${EFTER_VALBARA.map((m) => `<label class="provl-kryss"><input type="checkbox" data-efter-modul="${m.id}" ${valda.has(m.id) ? "checked" : ""} /> ${esc(m.label)}</label>`).join("")}
      </div>
      <p class="hint">Gäller bara den som har lämnat in. De som skriver är kvar i provet.</p>
    </fieldset>`;
}
function efterVal(box) {
  const lage = box.querySelector('input[name="provl-efter"]:checked')?.value || EFTER_STANDARD;
  const moduler = [...box.querySelectorAll("[data-efter-modul]:checked")].map((c) => c.dataset.efterModul);
  return normalizeEfter({ lage, moduler });
}

/** Låsfälten: "Lås klassen till provet" + klockslag + "Dölj allt annat" + efter inlämning (#788). */
function lasFalt(standardMin, { pa = true, doljOvrigt = true, efter = null } = {}) {
  return `<fieldset class="provl-tf-grupp provl-las">
    <legend>Fokusläge</legend>
    <label class="provl-kryss"><input type="checkbox" data-f="las" ${pa ? "checked" : ""} /> Lås klassen till provet</label>
    <div class="provl-las-detalj">
      <label>till klockan <input type="time" step="60" class="cell" data-f="lasTill" value="${klockslagOm(standardMin)}" /></label>
      <label class="provl-kryss"><input type="checkbox" data-f="dolj" ${doljOvrigt ? "checked" : ""} /> Dölj allt annat (hus, shop)</label>
      ${efterFalt(efter)}
    </div>
    <p class="hint">Eleverna hamnar direkt i provet och kan inte öppna något annat förrän de lämnat in, du stänger provet eller klockslaget passerar.</p>
  </fieldset>`;
}
function lasVal(box) {
  if (!box.querySelector('[data-f="las"]').checked) return { las: null };
  const till = tillFromKlockslag(box.querySelector('[data-f="lasTill"]').value, serverNow());
  if (!till) return { fel: "Välj ett klockslag för låset senare idag." };
  return { las: { till, doljOvrigt: box.querySelector('[data-f="dolj"]').checked, efter: efterVal(box) } };
}
function kopplaLas(box) {
  const pa = box.querySelector('[data-f="las"]');
  const detalj = box.querySelector(".provl-las-detalj");
  const egna = box.querySelector(".provl-efter-egna");
  const visa = () => {
    detalj.classList.toggle("provl-av", !pa.checked);
    egna.classList.toggle("provl-av", efterVal(box).lage !== EFTER.EGNA);
  };
  pa.addEventListener("change", visa);
  box.querySelectorAll('input[name="provl-efter"]').forEach((r) => r.addEventListener("change", visa));
  visa();
}

/**
 * "Kör i klass" (§5.2): klass, tidsgräns, lås, Öppna nu / Spara och öppna senare.
 * @param {object} ctx  lärarsidans ctx
 * @param {string | { id, namn, fragor?, installningar? }} provEllerId  provets id (B) eller provet
 * @param {{ onKlar?: (tillfalleId: string, oppnat: boolean) => void }} [o]
 */
export async function korIKlass(ctx, provEllerId, { onKlar } = {}) {
  laddaCss("prov-tillfalle.css");
  await syncServerClock();
  // B (#739) anropar med provets id – läs då provet (en läsning).
  const prov = typeof provEllerId === "string" ? await hamtaProv(provEllerId).catch(() => null) : provEllerId;
  if (!prov) {
    ruta(`<div class="msg error">Provet finns inte längre – det kan ha raderats.</div>
      <div class="provl-tf-knappar"><button class="btn ghost" data-avbryt>Stäng</button></div>`, { etikett: "Fel" });
    return;
  }
  const [role, klasser] = await Promise.all([myRole(), getClasses()]);
  const mina = filterClasses(klasser, role);
  const std = tolkaTidsgrans(prov.installningar?.tidsgransMin) ?? null;
  const { box, stang } = ruta(`
    <h2 class="provl-ruta-rubrik">Kör i klass: ${esc(prov.namn)}</h2>
    <p class="hint">${antalFragor(prov.fragor)} frågor. Eleverna ser provet först när du öppnar det.</p>
    ${mina.length ? "" : `<div class="msg warn">Du har inga klasser än.</div>`}
    <label class="provl-tf-falt">Klass
      <select class="select" data-f="klass" autofocus>${mina.map((c) => `<option value="${esc(c.id)}">${esc(c.name || c.id)}</option>`).join("")}</select>
    </label>
    ${tidsgransFalt(std)}
    <div data-plats="extra"></div>
    <div data-plats="helskarm"></div>
    ${lasFalt(standardLasMinuter(std))}
    <p class="provl-tf-fel msg error" role="alert" hidden></p>
    <div class="provl-tf-knappar">
      <button class="btn gron" data-act="nu" ${mina.length ? "" : "disabled"}>Öppna nu</button>
      <button class="btn ghost" data-act="senare" ${mina.length ? "" : "disabled"}>Spara och öppna senare</button>
      <button class="btn ghost" data-avbryt>Avbryt</button>
    </div>`, { etikett: `Kör i klass: ${prov.namn}` });
  kopplaLas(box);
  const fel = box.querySelector(".provl-tf-fel");
  const klassEl = box.querySelector('[data-f="klass"]');
  const klassens = () => mina.find((c) => c.id === klassEl.value)?.studentIds || [];
  // Låsets förval följer tidsgränsen + den längsta extra tiden (+10 min) tills
  // läraren rört klockslaget (#749 F1).
  const lasTill = box.querySelector('[data-f="lasTill"]');
  let rortTill = false;
  lasTill.addEventListener("input", () => (rortTill = true));
  let extra = null;
  const lasForval = () => {
    if (!rortTill) lasTill.value = klockslagOm(standardLasMinuter(tidsgransVal(box) || null, extra?.varde()));
  };
  // #748: extra tid per elev – namnen läses först när läraren fäller ut listan.
  extra = extraTidFalt({ hamta: () => elevNamn(klassens()), onAndrat: lasForval });
  box.querySelector('[data-plats="extra"]').replaceWith(extra.el);
  const hs = helskarmFalt({ hamta: () => elevNamn(klassens()) });
  box.querySelector('[data-plats="helskarm"]').replaceWith(hs.el);
  klassEl.addEventListener("change", () => { extra.laddaOm(klassens()); hs.laddaOm(klassens()); });
  kopplaTidsgrans(box, lasForval);

  const kor = async (oppnaNu, knapp) => {
    fel.hidden = true;
    const tid = tidsgransVal(box);
    if (tid === undefined) return visaFel(TIDSGRANS_FEL);
    const { las, fel: lasFel } = lasVal(box);
    if (lasFel && oppnaNu) return visaFel(lasFel);
    const classId = klassEl.value;
    box.querySelectorAll("button").forEach((b) => (b.disabled = true));
    knapp.textContent = oppnaNu ? "Öppnar…" : "Sparar…";
    let t = null;
    try {
      const fokus = { pa: box.querySelector('[data-f="las"]').checked, doljOvrigt: box.querySelector('[data-f="dolj"]').checked, efter: efterVal(box) };
      const extraTid = rensaExtraTid(extra.varde(), klassens());
      t = await skapaTillfalle({ prov, classId, tidsgransMin: tid, fokus, larare: role, extraTid, helskarm: hs.varde() });
      if (oppnaNu) await oppnaTillfalle({ id: t, status: STATUS.FORBERETT, provId: prov.id, provNamn: prov.namn, classId }, las);
      stang();
      onKlar?.(t, oppnaNu);
    } catch (err) {
      box.querySelectorAll("button").forEach((b) => (b.disabled = false));
      knapp.textContent = oppnaNu ? "Öppna nu" : "Spara och öppna senare";
      visaFel(t ? `Tillfället sparades men kunde inte öppnas: ${errText(err)}` : `Kunde inte spara: ${errText(err)}`);
      if (t) onKlar?.(t, false);
    }
  };
  function visaFel(text) {
    fel.textContent = text;
    fel.hidden = false;
  }
  box.querySelector('[data-act="nu"]').addEventListener("click", (e) => kor(true, e.currentTarget));
  box.querySelector('[data-act="senare"]').addEventListener("click", (e) => kor(false, e.currentTarget));
}

/** Öppna ett förberett/stängt tillfälle: rutan med låsvalet (§5.2, §5.4 "öppna igen"). */
export function oppnaRuta(tf, klar) {
  const igen = tf.status === STATUS.STANGT;
  const std = standardLasMinuter(tf.tidsgransMin, tf.extraTid);
  // Ett omprov (#748) låser aldrig klassen – låset gäller hela klassen.
  const omprov = arOmprov(tf);
  const { box, stang } = ruta(`
    <h2 class="provl-ruta-rubrik">${igen ? "Öppna igen" : "Öppna"}: ${esc(tillfalleNamn(tf))}</h2>
    <p class="hint">${igen
      ? "Elever som inte hann lämna in kan fortsätta (inom sin tidsgräns). De som själva lämnat in är klara."
      : `${tf.tidsgransMin ? `Tidsgräns ${tf.tidsgransMin} minuter per elev, från att eleven startar.` : "Ingen tidsgräns."}`}</p>
    ${igen && tillbakaVarning(tf.rattStatus) ? `<p class="msg provl-tf-varning" role="status">${esc(tillbakaVarning(tf.rattStatus))}</p>` : ""}
    <div data-plats="extra"></div>
    <div data-plats="helskarm"></div>
    ${omprov ? `<p class="hint">Fokusläget låser hela klassen och används inte för omprov.</p>`
      : lasFalt(std, { pa: igen ? false : tf.fokus?.pa !== false, doljOvrigt: tf.fokus?.doljOvrigt !== false, efter: tf.fokus?.efter })}
    <p class="provl-tf-fel msg error" role="alert" hidden></p>
    <div class="provl-tf-knappar">
      <button class="btn gron" data-act="oppna" autofocus>${igen ? "Öppna igen" : "Öppna nu"}</button>
      <button class="btn ghost" data-avbryt>Avbryt</button>
    </div>`, { etikett: `Öppna ${tf.provNamn}` });
  if (!omprov) kopplaLas(box);
  // #748: extra tid per elev (i ett omprov bara de valda eleverna).
  const elevIds = async () => (omprov ? tf.elevIds : (await getClasses()).find((c) => c.id === tf.classId)?.studentIds || []);
  // Låsets förval följer den extra tiden tills läraren rört klockslaget (#749 F1).
  const lasTill = box.querySelector('[data-f="lasTill"]');
  let rortTill = false;
  lasTill?.addEventListener("input", () => (rortTill = true));
  let extra = null;
  const lasForval = () => {
    if (lasTill && !rortTill && extra) lasTill.value = klockslagOm(standardLasMinuter(tf.tidsgransMin, extra.varde()));
  };
  extra = extraTidFalt({ hamta: async () => elevNamn(await elevIds()), extraTid: tf.extraTid, onAndrat: lasForval });
  box.querySelector('[data-plats="extra"]').replaceWith(extra.el);
  const hs = helskarmFalt({ hamta: async () => elevNamn(await elevIds()), helskarm: { pa: helskarmPa(tf), undantag: tf.helskarmUndantag } });
  box.querySelector('[data-plats="helskarm"]').replaceWith(hs.el);
  const fel = box.querySelector(".provl-tf-fel");
  const knapp = box.querySelector('[data-act="oppna"]');
  knapp.addEventListener("click", async () => {
    const { las, fel: lasFel } = omprov ? { las: null } : lasVal(box);
    if (lasFel) {
      fel.textContent = lasFel;
      fel.hidden = false;
      return;
    }
    knapp.disabled = true;
    knapp.textContent = "Öppnar…";
    try {
      if (extra.andrat()) await sparaExtraTid(tf.id, rensaExtraTid(extra.varde(), await elevIds()));
      if (hs.andrat() || !("helskarm" in tf)) await sparaHelskarm(tf.id, hs.varde());
      await oppnaTillfalle(tf, las);
      stang();
      klar();
    } catch (err) {
      knapp.disabled = false;
      knapp.textContent = igen ? "Öppna igen" : "Öppna nu";
      fel.textContent = `Kunde inte öppna: ${errText(err)}`;
      fel.hidden = false;
    }
  });
}

/** Stäng: rutan på sidan (§5.4). */
export function stangRuta(tf, klar) {
  const { box, stang } = ruta(`
    <h2 class="provl-ruta-rubrik">Stäng provet: ${esc(tillfalleNamn(tf))}</h2>
    <p>Alla som inte har lämnat in får sitt prov inlämnat nu. Elevernas senast sparade svar gäller.</p>
    <p class="hint">Fokusläget som provet satte tas bort. Du kan öppna provet igen om det behövs.</p>
    <p class="provl-tf-fel msg error" role="alert" hidden></p>
    <div class="provl-tf-knappar">
      <button class="btn danger" data-act="stang" autofocus>Stäng provet</button>
      <button class="btn ghost" data-avbryt>Avbryt</button>
    </div>`, { etikett: `Stäng ${tf.provNamn}` });
  const knapp = box.querySelector('[data-act="stang"]');
  knapp.addEventListener("click", async () => {
    knapp.disabled = true;
    knapp.textContent = "Stänger…";
    try {
      await stangTillfalle(tf);
      stang();
      klar();
    } catch (err) {
      knapp.disabled = false;
      knapp.textContent = "Stäng provet";
      const fel = box.querySelector(".provl-tf-fel");
      fel.textContent = `Kunde inte stänga: ${errText(err)}`;
      fel.hidden = false;
    }
  });
}

/** Radera: "Radera provtillfället och alla elevsvar? Det går inte att ångra." (§3). */
export function raderaRuta(tf, klar) {
  const { box, stang } = ruta(`
    <h2 class="provl-ruta-rubrik">Radera provtillfället och alla elevsvar? Det går inte att ångra.</h2>
    <p class="hint">${esc(tillfalleNamn(tf))} – själva provet finns kvar under Mina prov.</p>
    <p class="provl-tf-fel msg error" role="alert" hidden></p>
    <div class="provl-tf-knappar">
      <button class="btn danger" data-act="radera">Radera</button>
      <button class="btn ghost" data-avbryt autofocus>Avbryt</button>
    </div>`, { etikett: "Radera provtillfället" });
  const knapp = box.querySelector('[data-act="radera"]');
  knapp.addEventListener("click", async () => {
    knapp.disabled = true;
    knapp.textContent = "Raderar…";
    try {
      await raderaTillfalle(tf);
      stang();
      klar();
    } catch (err) {
      knapp.disabled = false;
      knapp.textContent = "Radera";
      const fel = box.querySelector(".provl-tf-fel");
      fel.textContent = `Kunde inte radera: ${errText(err)}`;
      fel.hidden = false;
    }
  });
}
