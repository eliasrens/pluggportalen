// ============================================================================
// Pluggporten – lärarsidan: Material med underflikar (teacher-material.js, #806)
// ----------------------------------------------------------------------------
// Epic #802 DEL 4. EN sida, #/larare/material?flik=<plugga|lasresan|ekvationsresan|
// brakresan|hitta-ratt|schack>, med flikraden, en rad om var klassinställningarna
// finns och en yta där flikens vy ritas. Vyerna är de gamla sidorna, flyttade:
// materialtabellen (teacher-content.js), Bråkresans testläge, Hitta rätt!-sidan.
// Flikarna står i teacher-material-flikar.js och laddas med import() (#271).
//
// Vyerna ritas i `sub` = lärarkontexten med app = ytan (och embedded: true, så att de
// hoppar över toppmeny och sidhuvud som Materialet redan har). En flik som rollen inte
// har visas inte; en direktlänk till en admin-flik ger det vanliga "bara admin"-beskedet.
// De gamla adresserna (#/larare/innehall, /brakresan, /hitta-ratt?prov=…) omdirigeras
// hit via TEACHER_REDIRECTS.
// ============================================================================

import { ADMIN_ONLY, el, esc, icon, isAdmin, isTeacher, renderGate, teacherHead, teacherNav, wireHashLinks } from "./teacher-shared.js";
import { materialFlik, materialFlikar } from "./teacher-material-flikar.js";
import { getParams } from "./ui.js";

export const MATERIAL_HASH = "#/larare/material";
let stada = null; // städar den visade vyn (t.ex. schackmotorns worker) när man byter flik eller lämnar sidan

function lamnar() {
  if (location.hash.startsWith(MATERIAL_HASH)) return;
  window.removeEventListener("hashchange", lamnar);
  stada?.();
  stada = null;
}

export async function pageLarareMaterial(ctx) {
  stada?.();
  stada = null;
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  const admin = isAdmin();
  const params = getParams();
  const synliga = materialFlikar(admin);
  const vald = materialFlik(params.flik);
  const flik = vald || synliga[0];
  // Provspelet i Hitta rätt! (?prov=) är en helskärmsvy som styr hela sidan, som förut.
  if (flik.helsida?.(params) && (!flik.admin || admin)) return flik.rita({ ...ctx, embedded: false });

  const sida = el(`<div class="teacher-page teacher-dark mat-sida"></div>`);
  sida.append(teacherNav(ctx, "material"), teacherHead(ctx, "material"));
  const flikrad = el(`<nav class="mat-flikar" aria-label="Material">${synliga.map((f) =>
    `<a class="mat-flik${f.key === flik.key ? " active" : ""}" href="${MATERIAL_HASH}?flik=${f.key}" data-hash="${MATERIAL_HASH}?flik=${f.key}"${
      f.key === flik.key ? ' aria-current="page"' : ""}>${icon(f.icon, 16)}<span>${esc(f.label)}</span></a>`).join("")}</nav>`);
  sida.append(flikrad);
  const host = el(`<div class="mat-host"></div>`);
  if (flik.admin && !admin) {
    // En admin-flik via direktlänk: samma besked som förut, inte en tom sida.
    host.append(el(`<div class="panel"><div class="msg warn">${ADMIN_ONLY}</div></div>`));
    sida.append(host);
    wireHashLinks(ctx, flikrad);
    return ctx.app.replaceChildren(sida);
  }
  const hint = el(`<p class="mat-hint" role="note">${icon("link", 15)}<span>${flik.hint}</span></p>`);
  sida.append(hint, host);
  wireHashLinks(ctx, flikrad);
  wireHashLinks(ctx, hint);
  ctx.app.replaceChildren(sida);

  window.addEventListener("hashchange", lamnar);
  const sub = { ...ctx, app: host, renderTopbar() {}, embedded: true };
  try {
    const res = await flik.rita(sub, params);
    stada = res?.destroy ? () => res.destroy() : null;
  } catch (err) {
    console.error("Material: fliken kunde inte laddas:", err);
    host.replaceChildren(el(`<div class="panel"><div class="msg error">Kunde inte ladda ${esc(flik.label)} – ladda om sidan om en stund.
      (${esc(err?.message || err)})</div></div>`));
  }
}
