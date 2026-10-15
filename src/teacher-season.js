// ============================================================================
// Pluggporten – lärarsidan: Säsong (teacher-season.js, #690, epic #689)
// ----------------------------------------------------------------------------
// #/larare/admin/sasong – BARA för admin (spec UTVECKLINGSUPPDRAG_HOST_HALLOWEEN.md §1.2):
//   * Säsong: Sommar / Höst (en knapp per nyckel i SEASONS)
//   * Halloween: Av / På + slutdatum (förval 2 nov 23.59, kan ändras eller
//     tas bort – efter datumet räknas Halloween som av för alla automatiskt)
//   * enkel förhandsvisning av världen med de valda inställningarna
//   * bekräftelse innan sparning: "Detta ändras för alla elever direkt."
// Skriver config/season via season.js (reglerna släpper bara in admin).
// Registreras i TEACHER_TABS med admin: true och laddas DYNAMISKT (#271).
// ============================================================================

import { el, esc, errText, icon, isTeacher, renderGate, teacherHead, teacherNav } from "./teacher-shared.js";
import {
  SEASONS, defaultHalloweenUntil, describeSeason, formatUntil, fromLocalInput, toLocalInput,
} from "./season-config.js";

const HASH = "#/larare/admin/sasong";
export const CONFIRM_TEXT = "Detta ändras för alla elever direkt.";

function ensureCss() {
  if (document.querySelector('link[data-ts-css="1"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./teacher-season.css", import.meta.url).href;
  link.dataset.tsCss = "1";
  document.head.appendChild(link);
}

/** Route-handler (TEACHER_TABS). */
export async function pageLarareSasong(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  ensureCss();
  const page = el(`<div class="teacher-page teacher-dark ts-page"></div>`);
  page.append(teacherNav(ctx, "sasong"), teacherHead(ctx, "sasong"));
  const body = el(`<div class="spinner">Laddar säsongen…</div>`);
  page.appendChild(body);
  ctx.app.replaceChildren(page);
  try {
    const [season, clock] = await Promise.all([import("./season.js"), import("./data-class-lock.js")]);
    await Promise.race([season.seasonLoaded(), new Promise((r) => setTimeout(r, 4000))]);
    await clock.syncServerClock();
    if (window.location.hash.split("?")[0] !== HASH) return;
    body.remove();
    page.appendChild(renderForm(season, clock.serverNow));
  } catch (err) {
    body.remove();
    page.appendChild(el(`<div class="panel"><div class="msg error">Kunde inte ladda säsongen: ${esc(err.message)}</div></div>`));
  }
}

function renderForm(season, now) {
  const cur = season.getSeason();
  // Formulärets läge (sparas först efter bekräftelsen).
  const val = {
    season: cur.season,
    halloween: cur.halloween,
    // Saknat datum: förvalet om Halloween är av, annars "inget slutdatum".
    until: cur.halloweenUntil ?? (cur.halloween ? null : defaultHalloweenUntil(now())),
  };
  const node = el(`<div class="ts-wrap">
    <div class="panel ts-nu" role="status" aria-live="polite"></div>
    <form class="panel ts-form" novalidate>
      <div class="ts-grid">
        <div class="ts-val">
          <fieldset class="ts-grupp"><legend>Säsong i världen</legend>
            <div class="ts-knappar">${Object.entries(SEASONS).map(([k, s]) =>
              `<label class="ts-opt"><input type="radio" name="ts-season" value="${esc(k)}" /> <span>${esc(s.label)}</span></label>`).join("")}</div>
            <p class="hint">Gäller huset utifrån, trädgården, byn och grannbyn – inte spelen, Plugga, Live eller lärarsidan.</p>
          </fieldset>
          <fieldset class="ts-grupp"><legend>Halloween</legend>
            <div class="ts-knappar">
              <label class="ts-opt"><input type="radio" name="ts-hw" value="av" /> <span>Av</span></label>
              <label class="ts-opt"><input type="radio" name="ts-hw" value="pa" /> <span>På</span></label>
            </div>
            <div class="ts-slut">
              <div class="field"><label for="ts-until">Slutdatum <small>(stängs automatiskt för alla efter det)</small></label>
                <input id="ts-until" type="datetime-local" /></div>
              <label class="ts-inget"><input type="checkbox" id="ts-inget" /> Inget slutdatum</label>
              <button type="button" class="btn ghost small" data-forval="1">Förval: 2 nov 23.59</button>
            </div>
            <p class="hint">När Halloween är på syns Halloween-sektionen i butiken och kostymerna kan bäras.
              Allt som köpts finns kvar året runt.</p>
          </fieldset>
        </div>
        <figure class="ts-forhand"><div class="ts-svg"></div>
          <figcaption class="hint">Förhandsvisning (förenklad)</figcaption></figure>
      </div>
      <div class="ts-fel" role="alert"></div>
      <div class="ts-bekrafta" hidden>
        <div class="msg warn"><b>${esc(CONFIRM_TEXT)}</b> <span class="ts-sammanfatt"></span></div>
        <div class="row-inline">
          <button type="button" class="btn gron small" data-ja="1">${icon("check", 16)}<span>Ja, ändra för alla</span></button>
          <button type="button" class="btn ghost small" data-nej="1">Avbryt</button>
        </div>
      </div>
      <div class="row-inline ts-spara-rad">
        <button type="submit" class="btn gron small" data-spara="1">${icon("save", 16)}<span>Spara</span></button>
        <span class="hint">${esc(CONFIRM_TEXT)}</span>
      </div>
    </form>
  </div>`);
  const $ = (s) => node.querySelector(s);
  const form = $(".ts-form");
  const untilEl = $("#ts-until");
  const ingetEl = $("#ts-inget");
  const fel = $(".ts-fel");
  const bekrafta = $(".ts-bekrafta");
  const sparaRad = $(".ts-spara-rad");

  const visaNu = (s) => {
    $(".ts-nu").innerHTML = `<span class="ts-nu-etikett">Just nu för eleverna:</span> <b>${esc(describeSeason(s, now()))}</b>`;
  };
  visaNu(cur);
  // Live: en ändring (härifrån eller från en annan admin) eller ett passerat
  // slutdatum syns direkt. Avregistreras när admin lämnar sidan.
  const av = season.onSeasonChange((s) => {
    if (!node.isConnected) return av();
    visaNu(s);
  });

  const sync = () => {
    form.querySelector(`input[name="ts-season"][value="${val.season}"]`).checked = true;
    form.querySelector(`input[name="ts-hw"][value="${val.halloween ? "pa" : "av"}"]`).checked = true;
    ingetEl.checked = val.until == null;
    untilEl.value = toLocalInput(val.until);
    untilEl.disabled = !val.halloween || val.until == null;
    ingetEl.disabled = !val.halloween;
    $("[data-forval]").disabled = !val.halloween;
    $(".ts-slut").classList.toggle("ts-av", !val.halloween);
    $(".ts-svg").innerHTML = previewSvg(val.season, val.halloween && (val.until == null || val.until > now()));
    stang();
  };
  const stang = () => {
    bekrafta.hidden = true;
    sparaRad.hidden = false;
  };

  form.querySelectorAll('input[name="ts-season"]').forEach((r) =>
    r.addEventListener("change", () => ((val.season = r.value), sync())));
  form.querySelectorAll('input[name="ts-hw"]').forEach((r) =>
    r.addEventListener("change", () => {
      val.halloween = r.value === "pa";
      if (val.halloween && val.until != null && val.until <= now()) val.until = defaultHalloweenUntil(now());
      sync();
    }));
  ingetEl.addEventListener("change", () => {
    val.until = ingetEl.checked ? null : defaultHalloweenUntil(now());
    sync();
  });
  untilEl.addEventListener("change", () => {
    val.until = fromLocalInput(untilEl.value);
    sync();
  });
  $("[data-forval]").addEventListener("click", () => ((val.until = defaultHalloweenUntil(now())), sync()));

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    fel.innerHTML = "";
    if (val.halloween && !ingetEl.checked && val.until == null) {
      fel.innerHTML = `<div class="msg error">Skriv ett slutdatum – eller kryssa i Inget slutdatum.</div>`;
      return;
    }
    if (val.halloween && val.until != null && val.until <= now()) {
      fel.innerHTML = `<div class="msg error">Slutdatumet har redan passerat – välj ett datum framåt.</div>`;
      return;
    }
    $(".ts-sammanfatt").textContent = `Nytt läge: ${describeSeason(spara(), now())}.`;
    bekrafta.hidden = false;
    sparaRad.hidden = true;
    $("[data-ja]").focus();
  });
  const spara = () => ({ season: val.season, halloween: val.halloween, halloweenUntil: val.halloween ? val.until : null });
  $("[data-nej]").addEventListener("click", stang);
  let saving = false;
  $("[data-ja]").addEventListener("click", async () => {
    if (saving) return;
    saving = true;
    fel.innerHTML = `<div class="msg">Sparar…</div>`;
    try {
      await season.saveSeason(spara());
      const s = spara();
      fel.innerHTML = `<div class="msg ok">✓ Sparat. Eleverna ser nu: ${esc(describeSeason(s, now()))}${
        s.halloween && s.halloweenUntil ? ` – Halloween stängs automatiskt ${esc(formatUntil(s.halloweenUntil, now()))}` : ""}.</div>`;
      stang();
    } catch (err) {
      fel.innerHTML = `<div class="msg error">${esc(errText(err))}</div>`;
    } finally {
      saving = false;
    }
  });

  sync();
  return node;
}

/** Enkel världsvy: himmel, gräs, hus, träd – höstlöv och pumpa/måne efter valen. */
export function previewSvg(seasonKey, halloween) {
  const p = (SEASONS[seasonKey] || SEASONS.sommar).preview;
  const leaves = SEASONS[seasonKey]?.dekor?.leaves;
  const sky = halloween ? "#4B3F7A" : p.sky;
  const lov = leaves
    ? [[60, 40, 0], [150, 70, 1], [250, 30, 2], [205, 110, 0], [95, 120, 2], [300, 85, 1]]
        .map(([x, y, i]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.5" fill="${p.tree[i]}" stroke="#3B3350" stroke-width="1.2" transform="rotate(${x % 70 - 35} ${x} ${y})"/>`).join("")
    : "";
  const himmel = halloween
    ? `<circle cx="290" cy="38" r="20" fill="#FFF3DC" stroke="#3B3350" stroke-width="2"/>`
    : `<circle cx="290" cy="38" r="16" fill="#F7C948" stroke="#3B3350" stroke-width="2"/>`;
  const pumpa = halloween
    ? `<g transform="translate(232 168)"><ellipse cx="0" cy="0" rx="17" ry="13" fill="#F49E4C" stroke="#3B3350" stroke-width="2.2"/>
         <path d="M-6 0v-12M0 1v-13M6 0v-12" stroke="#D97A2B" stroke-width="1.6" fill="none"/>
         <path d="M0-13q2-6 6-6" stroke="#58C6A9" stroke-width="3" fill="none" stroke-linecap="round"/>
         <path d="M-8-3l3-3 3 3zM2-3l3-3 3 3z" fill="#3B3350"/><path d="M-7 5q7 5 14 0" stroke="#3B3350" stroke-width="2" fill="none" stroke-linecap="round"/></g>`
    : "";
  return `<svg viewBox="0 0 340 200" role="img" aria-label="Förhandsvisning: ${esc((SEASONS[seasonKey] || SEASONS.sommar).label)}${halloween ? " med Halloween" : ""}">
    <rect width="340" height="200" fill="${sky}"/>${himmel}
    <path d="M0 150q85-18 170 0t170 0V200H0z" fill="${p.grass}" stroke="#3B3350" stroke-width="2"/>
    <rect x="58" y="96" width="14" height="60" rx="4" fill="#8A6242" stroke="#3B3350" stroke-width="2"/>
    <circle cx="65" cy="88" r="30" fill="${p.tree[0]}" stroke="#3B3350" stroke-width="2.4"/>
    <circle cx="48" cy="98" r="16" fill="${p.tree[1]}" stroke="#3B3350" stroke-width="2"/>
    <circle cx="84" cy="100" r="14" fill="${p.tree[2]}" stroke="#3B3350" stroke-width="2"/>
    <rect x="130" y="100" width="76" height="58" rx="4" fill="#FFF3DC" stroke="#3B3350" stroke-width="2.4"/>
    <path d="M122 104l46-38 46 38z" fill="#EF6F6C" stroke="#3B3350" stroke-width="2.4" stroke-linejoin="round"/>
    <rect x="160" y="124" width="18" height="34" rx="3" fill="#B0805A" stroke="#3B3350" stroke-width="2"/>
    <rect x="138" y="114" width="16" height="14" rx="2" fill="${halloween ? "#B79BE0" : "#7FC7E8"}" stroke="#3B3350" stroke-width="2"/>
    <rect x="184" y="114" width="16" height="14" rx="2" fill="${halloween ? "#B79BE0" : "#7FC7E8"}" stroke="#3B3350" stroke-width="2"/>
    ${pumpa}${lov}
  </svg>`;
}
