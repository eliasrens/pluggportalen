// ============================================================================
// Prov (#739, spec §8.1): formuläret för EN fråga, ett per frågetyp – samma
// mönster som teacher-area-items-forms.js: formuläret samlar fälten och anropar
// onSubmit(falt) → { ok, errors }; logiken (fält → fråga, validering) bor i
// prov-redigera-ops.js (fragaFranFalt/sparaFraga). Fel visas under formuläret.
//
//   byggFragaForm(fraga, { poangPa, stavfel, onSubmit, onCancel }) → <form>
//
// Ny frågetyp ⇒ en post i KROPP nedan (typens egna fält) – de gemensamma
// fälten (fråga, poäng, hjälptext) ritas för alla typer med arFraga.
// ============================================================================

import { el, esc, icon } from "../../teacher-shared.js";
import { fragetyp } from "../prov-fragetyper.js";
import { STAVFEL } from "../prov-validera.js";
import { GRANS } from "../typer/delat.js";
import { POANG_MAX, POANG_MIN, POANG_STEG } from "../prov-poang.js";
import { tolkaLucktext } from "../typer/lucktext.js";

let uid = 0;
const nyttId = () => `provl-f${++uid}`;

function falt(label, name, value, { textarea = false, rows = 3, max = 0, hint = "", typ = "text", placeholder = "" } = {}) {
  const id = nyttId();
  const attr = `id="${id}" name="${name}"${max ? ` maxlength="${max}"` : ""}${placeholder ? ` placeholder="${esc(placeholder)}"` : ""}`;
  const ctl = textarea
    ? `<textarea ${attr} rows="${rows}">${esc(value ?? "")}</textarea>`
    : `<input ${attr} type="${typ}" autocomplete="off" value="${esc(value ?? "")}" />`;
  return `<div class="provl-falt provl-falt-${name}"><label for="${id}">${label}</label>${ctl}${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
}

const kryss = (name, on, text) =>
  `<label class="provl-check"><input type="checkbox" name="${name}" ${on ? "checked" : ""} /><span>${text}</span></label>`;

// Vad ett stavfel ger väljs per prov (#759) – tipset följer valet (#749).
const STAVFEL_TIPS = {
  [STAVFEL.AUTO]: "– av: ett svar med en bokstav fel blir \"delvis\"",
  [STAVFEL.SJALV]: "– av: ett svar med en bokstav fel rättar du själv",
};
const normalisering = (f, o = {}) => `<fieldset class="provl-grupp"><legend>Rättning</legend>
  ${kryss("exaktStavning", f.exaktStavning !== false, `<b>Exakt stavning krävs</b> <span class="hint">${STAVFEL_TIPS[o.stavfel] || STAVFEL_TIPS[STAVFEL.AUTO]}</span>`)}
  ${kryss("skiftlage", f.skiftlage === true, "<b>Stor och liten bokstav spelar roll</b> <span class=\"hint\">– t.ex. egennamn</span>")}
  <span class="hint">Mellanslag, en punkt sist och decimalkomma/-punkt ("7" = "7,0") jämförs alltid snällt.</span>
</fieldset>`;

/**
 * En lista med rader som kan läggas till och tas bort (alternativ, par, saker).
 * `rad(v, i)` ritar en rad; `tom()` ger en ny rad. Klistrar läraren in flera
 * rader i ett fält blir det en rad var (#763) – `fyll(radEl, text)` lägger en
 * inklistrad rad i en rad (par: "begrepp – förklaring"). `nummer` = 1, 2, 3 …
 * i stället för A, B, C (ordna: raderna ÄR facit-ordningen).
 */
function radlista(namn, varden, { min, max, rad, tom, laggTill, nummer = false, fyll = (r, t) => { r.querySelector("input[type=text]").value = t; } }) {
  const id = nyttId();
  return {
    html: `<div class="provl-rader" data-rader="${namn}" data-min="${min}" data-max="${max}" id="${id}">
      <div class="provl-rader-lista">${varden.map(rad).join("")}</div>
      <button type="button" class="btn small ghost provl-ny-rad" data-ny-rad>${icon("plus", 15)}<span>${laggTill}</span></button>
    </div>`,
    koppla(form) {
      const box = form.querySelector(`#${id}`);
      const lista = box.querySelector(".provl-rader-lista");
      const knapp = box.querySelector("[data-ny-rad]");
      const uppdatera = () => {
        const n = lista.children.length;
        knapp.hidden = n >= max;
        lista.querySelectorAll("[data-bort]").forEach((b) => (b.disabled = n <= min));
        lista.querySelectorAll("[data-radnr]").forEach((s, i) => (s.textContent = nummer ? `${i + 1}.` : String.fromCharCode(65 + i)));
        lista.querySelectorAll("input[type=radio], input[type=checkbox][data-ratt]").forEach((x, i) => (x.value = String(i)));
      };
      lista.addEventListener("click", (e) => {
        const b = e.target.closest("[data-bort]");
        if (!b || b.disabled) return;
        b.closest(".provl-rad").remove();
        uppdatera();
      });
      knapp.addEventListener("click", () => {
        const ny = el(rad(tom(), lista.children.length));
        lista.appendChild(ny);
        uppdatera();
        ny.querySelector("input[type=text]")?.focus();
      });
      // Flera rader inklistrade i ett fält → en rad var, nedåt (tomma rader fylls först).
      lista.addEventListener("paste", (e) => {
        const text = e.clipboardData?.getData("text") || "";
        const delar = text.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
        const radEl = e.target.closest?.(".provl-rad");
        if (delar.length < 2 || !radEl) return;
        e.preventDefault();
        let r = radEl;
        delar.forEach((t, i) => {
          if (i > 0) {
            let nasta = r.nextElementSibling;
            while (nasta && [...nasta.querySelectorAll("input[type=text]")].some((x) => x.value.trim())) nasta = nasta.nextElementSibling;
            if (!nasta) {
              if (lista.children.length >= max) return;
              nasta = el(rad(tom(), lista.children.length));
              lista.appendChild(nasta);
            }
            r = nasta;
          }
          fyll(r, t);
        });
        uppdatera();
      });
      uppdatera();
    },
  };
}

const bortKnapp = `<button type="button" class="btn small ghost provl-bort" data-bort title="Ta bort raden" aria-label="Ta bort raden">${icon("x", 14)}</button>`;

function alternativRader(f, { flera }) {
  const max = flera ? 8 : 6;
  const ratt = new Set(flera ? f.ratt || [] : [f.ratt]);
  const grupp = nyttId();
  return radlista("alternativ", f.alternativ?.length ? f.alternativ : ["", ""], {
    min: 2, max, laggTill: "Lägg till alternativ", tom: () => "",
    rad: (v, i) => `<div class="provl-rad">
      <label class="provl-ratt" title="Rätt svar">
        <input type="${flera ? "checkbox" : "radio"}" ${flera ? "data-ratt" : `name="${grupp}"`} value="${i}" ${ratt.has(i) ? "checked" : ""} aria-label="Rätt svar" />
        <span class="provl-radnr" data-radnr>${String.fromCharCode(65 + i)}</span></label>
      <input type="text" data-alt maxlength="${GRANS.alternativ}" value="${esc(v)}" placeholder="Alternativ" aria-label="Alternativ" />
      ${bortKnapp}</div>`,
  });
}

// Typens egna fält: { html, koppla?(form), samla(form) → del av falt }.
const KROPP = {
  flerval: (f) => {
    const r = alternativRader(f, { flera: false });
    return {
      html: `<div class="provl-falt"><span class="provl-etikett">Alternativ <span class="hint">– markera det rätta</span></span>${r.html}</div>`,
      koppla: r.koppla,
      samla: (form) => {
        const rader = [...form.querySelectorAll("[data-rader=alternativ] .provl-rad")];
        return {
          alternativ: rader.map((x) => x.querySelector("[data-alt]").value),
          ratt: rader.findIndex((x) => x.querySelector("input[type=radio]").checked),
        };
      },
    };
  },
  "flerval-flera": (f) => {
    const r = alternativRader(f, { flera: true });
    return {
      html: `<div class="provl-falt"><span class="provl-etikett">Alternativ <span class="hint">– kryssa ALLA rätta</span></span>${r.html}</div>`,
      koppla: r.koppla,
      samla: (form) => {
        const rader = [...form.querySelectorAll("[data-rader=alternativ] .provl-rad")];
        return {
          alternativ: rader.map((x) => x.querySelector("[data-alt]").value),
          ratt: rader.map((x, i) => (x.querySelector("[data-ratt]").checked ? i : -1)).filter((i) => i >= 0),
        };
      },
    };
  },
  santfalskt: (f) => {
    const g = nyttId();
    return {
      html: `<fieldset class="provl-grupp"><legend>Rätt svar</legend><div class="provl-val">
        <label class="provl-check"><input type="radio" name="${g}" value="true" ${f.ratt !== false ? "checked" : ""} /><span>Sant</span></label>
        <label class="provl-check"><input type="radio" name="${g}" value="false" ${f.ratt === false ? "checked" : ""} /><span>Falskt</span></label>
      </div></fieldset>`,
      samla: (form) => ({ ratt: form.querySelector(`[name="${g}"]:checked`)?.value }),
    };
  },
  kortsvar: (f, o) => ({
    html: falt("Godkända svar <span class=\"hint\">– ett per rad</span>", "godkanda", (f.godkanda || []).join("\n"), {
      textarea: true, rows: 3, placeholder: "Birka\nBjörkö", hint: "Skriv alla svar som ska räknas som rätt, t.ex. stavningsvarianter och synonymer.",
    }) + normalisering(f, o),
    samla: (form) => ({
      godkanda: form.elements.godkanda.value,
      exaktStavning: form.elements.exaktStavning.checked,
      skiftlage: form.elements.skiftlage.checked,
    }),
  }),
  lucktext: (f, o) => ({
    html: falt("Texten med luckor", "lucktext", f.lucktext, {
      textarea: true, rows: 5, max: GRANS.lucktext, placeholder: "Sveriges huvudstad heter [[Stockholm]].",
      hint: "Skriv varje lucka som <code>[[svar]]</code>. Fler godkända svar: <code>[[Miklagård|Konstantinopel]]</code>. <span data-luckor></span>",
    }) + normalisering(f, o),
    koppla: (form) => {
      const visa = () => {
        const n = tolkaLucktext(form.elements.lucktext.value).luckor.length;
        form.querySelector("[data-luckor]").textContent = n ? `Nu: ${n} ${n === 1 ? "lucka" : "luckor"}.` : "";
      };
      form.elements.lucktext.addEventListener("input", visa);
      visa();
    },
    samla: (form) => ({
      lucktext: form.elements.lucktext.value,
      exaktStavning: form.elements.exaktStavning.checked,
      skiftlage: form.elements.skiftlage.checked,
    }),
  }),
  para: (f) => {
    const tom = { vanster: "", hoger: "" };
    const r = radlista("par", f.par?.length ? f.par : [tom, tom, tom], {
      min: 3, max: 10, laggTill: "Lägg till par", tom: () => tom,
      fyll: (rad, t) => {
        const [v, ...h] = t.split(/\s+[–—-]\s+|\t|:\s+/);
        rad.querySelector("[data-v]").value = v.trim();
        rad.querySelector("[data-h]").value = h.join(" – ").trim();
      },
      rad: (p) => `<div class="provl-rad provl-par">
        <input type="text" data-v maxlength="${GRANS.alternativ}" value="${esc(p.vanster)}" placeholder="Begrepp" aria-label="Vänster led" />
        <span class="provl-pil" aria-hidden="true">↔</span>
        <input type="text" data-h maxlength="${GRANS.alternativ}" value="${esc(p.hoger)}" placeholder="Förklaring" aria-label="Höger led" />
        ${bortKnapp}</div>`,
    });
    return {
      html: `<div class="provl-falt"><span class="provl-etikett">Paren <span class="hint">– ett par per rad, begrepp – förklaring. Eleven får förklaringarna blandade. Klistra in flera rader "Tor – åska" så blir det ett par var.</span></span>${r.html}</div>`,
      koppla: r.koppla,
      samla: (form) => ({
        par: [...form.querySelectorAll("[data-rader=par] .provl-rad")].map((x) => ({ vanster: x.querySelector("[data-v]").value, hoger: x.querySelector("[data-h]").value })),
      }),
    };
  },
  ordna: (f) => {
    const r = radlista("saker", f.saker?.length ? f.saker : ["", "", ""], {
      min: 3, max: 10, laggTill: "Lägg till sak", tom: () => "", nummer: true,
      rad: (v, i) => `<div class="provl-rad"><span class="provl-radnr" data-radnr>${i + 1}.</span>
        <input type="text" data-sak maxlength="${GRANS.alternativ}" value="${esc(v)}" placeholder="Sak" aria-label="Sak" />${bortKnapp}</div>`,
    });
    return {
      html: `<div class="provl-falt"><span class="provl-etikett">Sakerna i RÄTT ordning <span class="hint">– en per rad, den första först (det är facit). Varje elev får dem i en egen blandad ordning. Klistra in flera rader så blir det en sak per rad.</span></span>${r.html}</div>`,
      koppla: r.koppla,
      samla: (form) => ({ saker: [...form.querySelectorAll("[data-sak]")].map((x) => x.value) }),
    };
  },
  fritext: (f) => ({
    html: falt("Bedömningsstöd <span class=\"hint\">(valfritt – bara du ser det)</span>", "bedomningsstod", f.bedomningsstod, {
      textarea: true, rows: 3, max: GRANS.bedomningsstod, hint: `Exempelsvar eller vad som krävs. Eleven skriver högst ${GRANS.fritext} tecken.`,
    }) + falt("Poängkriterier <span class=\"hint\">(valfritt – ett per rad)</span>", "kriterier", (f.kriterier || []).join("\n"), {
      textarea: true, rows: 4, placeholder: "1 p: nämner en orsak\n2 p: nämner två orsaker\n+1 p: förklarar varför",
      hint: "Stöd när du rättar – du sätter poängen själv. Eleven ser dem bara efter tillbakalämningen, om du väljer det under Inställningar.",
    }),
    samla: (form) => ({ bedomningsstod: form.elements.bedomningsstod.value, kriterier: form.elements.kriterier.value }),
  }),
  text: (f) => ({
    html: falt("Titel <span class=\"hint\">(valfri)</span>", "titel", f.titel, { max: GRANS.titel })
      + falt("Text", "brodtext", f.brodtext, { textarea: true, rows: 7, max: GRANS.textblock, hint: "Frågorna efter textblocket kan handla om texten." }),
    samla: (form) => ({ titel: form.elements.titel.value, brodtext: form.elements.brodtext.value }),
  }),
  avsnitt: (f) => ({
    html: falt("Rubrik", "titel", f.titel, { max: GRANS.titel, placeholder: "t.ex. Del 1 – Begrepp" })
      + falt("Instruktion <span class=\"hint\">(valfri – eleven ser den under rubriken)</span>", "instruktion", f.instruktion, {
        textarea: true, rows: 2, max: GRANS.instruktion, placeholder: "t.ex. Svara med hela meningar.",
        hint: "Frågorna numreras löpande genom hela provet. Avsnittet har ingen poäng.",
      }),
    samla: (form) => ({ titel: form.elements.titel.value, instruktion: form.elements.instruktion.value }),
  }),
};

/**
 * Formuläret för en fråga.
 * @param {object} fraga befintlig eller tomFraga(typ)
 * @param {{ ny?: boolean, poangPa?: boolean, stavfel?: string, onSubmit: (falt: object) => {ok: boolean, errors: string[]}, onCancel: () => void }} o
 */
export function byggFragaForm(fraga, { ny = false, poangPa = true, stavfel = STAVFEL.AUTO, onSubmit, onCancel }) {
  const typ = fragetyp(fraga.typ);
  const kropp = KROPP[fraga.typ](fraga, { stavfel });
  const gemensamt = typ.arFraga === false ? "" : `
    ${falt(fraga.typ === "santfalskt" ? "Påstående" : "Fråga", "fraga", fraga.fraga, { textarea: true, rows: 2, max: GRANS.fragetext })}
    <div class="provl-falt-rad">
      ${falt("Poäng", "poang", fraga.poang ?? 1, { typ: "number", hint: poangPa ? "0,5–20 i steg om 0,5" : "Provet poängsätts inte – poängen används inte." })}
      ${falt("Hjälptext <span class=\"hint\">(valfri – eleven ser den under frågan)</span>", "hjalptext", fraga.hjalptext, { max: GRANS.hjalptext })}
    </div>`;
  const form = el(`<form class="provl-form" novalidate>
    <div class="provl-form-titel"><span aria-hidden="true">${typ.ikon}</span> ${ny ? "Ny fråga" : "Redigera"}: ${esc(typ.namn)}</div>
    ${gemensamt}
    ${kropp.html}
    <div class="provl-form-fel" role="alert" aria-live="polite"></div>
    <div class="provl-knappar">
      <button type="submit" class="btn gron small">${icon("check", 15)}<span>${ny ? "Lägg till" : "Klar"}</span></button>
      <button type="button" class="btn ghost small" data-avbryt>Avbryt</button>
    </div>
  </form>`);
  const poang = form.elements.poang;
  // Halvpoäng (#762): 0,5–20 i steg om 0,5.
  if (poang) Object.assign(poang, { min: POANG_MIN, max: POANG_MAX, step: POANG_STEG, inputMode: "decimal" });
  kropp.koppla?.(form);
  const felBox = form.querySelector(".provl-form-fel");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = { ...kropp.samla(form) };
    // Ett ogiltigt sifferfält ger value "" – skicka något ogiltigt så att valideringen säger till (i stället för standard 1).
    if (typ.arFraga !== false) Object.assign(f, { fraga: form.elements.fraga.value, poang: poang.validity?.badInput ? "?" : poang.value, hjalptext: form.elements.hjalptext.value });
    const res = onSubmit(f);
    felBox.innerHTML = res?.ok ? "" : `<div class="msg error"><div>Rätta det här:</div>
      <ul class="error-list">${(res?.errors || ["Okänt fel."]).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  });
  form.querySelector("[data-avbryt]").addEventListener("click", onCancel);
  form.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  });
  queueMicrotask(() => form.querySelector("textarea, input[type=text]")?.focus());
  return form;
}
