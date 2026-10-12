// ============================================================================
// Hitta rätt! – lärarens provspel (src/hitta-ratt/larare/lhr-provspel.js) · #634
// ----------------------------------------------------------------------------
// #/larare/hitta-ratt?prov=<packId>[&fran=<vy>]. Kör elevens hr-spel.js med
// lokala deps (lhr-modell.js provData): rättningen sker i klienten med samma
// raknaOmgang som servern, inget försök skapas, inget sparas, inga coins.
// Officiella pack läses ur repot, egna (också kollegors) ur hittaRattPacks –
// utan klasskontroll, läraren får provspela alla.
// ============================================================================

import { el, esc } from "../../teacher-shared.js";
import { arEget } from "../hr-egna.js";
import { provData } from "./lhr-modell.js";
import { hamtaOfficielltPack, hamtaPack, laddaOmraden } from "./lhr-data.js";

export async function provspela(ctx, packId, hem) {
  const visaFel = (text) => {
    const vy = el(`<div class="teacher-page teacher-dark"><div class="panel lhr-fel" role="alert">
      <h2>Provspelet gick inte att starta</h2><p class="hint">${esc(text)}</p>
      <button class="btn" data-act="tillbaka">← Tillbaka</button></div></div>`);
    vy.querySelector('[data-act="tillbaka"]').addEventListener("click", () => ctx.go(hem));
    ctx.app.replaceChildren(vy);
  };
  let pack, omradesIds = [];
  try {
    pack = arEget(packId) ? await hamtaPack(packId) : await hamtaOfficielltPack(packId);
    if (!pack) return visaFel("Kartan finns inte längre.");
    if (pack.type === "area") omradesIds = Object.values((await laddaOmraden(pack.geo)).nycklar);
  } catch (err) {
    return visaFel(err?.message || "Kontrollera uppkopplingen och försök igen.");
  }
  const { spelaPack } = await import("../hr-spel.js");
  await spelaPack({ id: pack.id }, { pack, data: provData(pack, omradesIds), prov: true, hem });
}
