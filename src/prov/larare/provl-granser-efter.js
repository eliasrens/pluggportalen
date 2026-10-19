// ============================================================================
// Prov (#796): ändrade färggränser i Mina prov-redigeraren för ett prov som
// redan har tillfällen. Efter sparningen frågas: "Använd de nya gränserna även
// för redan körda tillfällen (N st)?" – Ja skriver installningar.granser på
// varje tillfälle (EN skrivning per tillfälle, sparaGranser), Nej låter dem
// behålla sina. Tillfället är källan för rättning, översikt och statistik.
// Laddas lat av redigeraren, bara när gränserna faktiskt ändrats.
// ============================================================================

import { esc, errText } from "../../teacher-shared.js";
import { getClasses } from "../../data-classes.js";
import { filterClasses, myRole } from "../../teacher-role.js";
import { listaTillfallen } from "../prov-tillfalle-data.js";
import { sparaGranser } from "../prov-rattning-data.js";
import { granserFor } from "../prov-statistik.js";
import { ruta } from "../prov-tillfalle-rutor.js";

/** Gränserna är olika (båda talen). */
export const andradeGranser = (a, b) => a.gul !== b.gul || a.gron !== b.gron;

/** Tillfällena av provet i lärarens klasser vars gränser skiljer sig från `granser`. */
export async function tillfallenAttUppdatera(provId, granser) {
  const [role, klasser] = await Promise.all([myRole(), getClasses()]);
  const mina = filterClasses(klasser, role);
  if (!mina.length) return [];
  return (await listaTillfallen(mina.map((c) => c.id)))
    .filter((x) => x.provId === provId && andradeGranser(granserFor(x.installningar), granser));
}

/**
 * Frågar och uppdaterar. Slutar aldrig med ett kast – fel visas i rutan.
 * @param {string} provId
 * @param {{ gul: number, gron: number }} granser  de nysparade
 * @returns {Promise<"ja"|"nej"|"inga">}
 */
export async function fragaOmTillfallen(provId, granser) {
  let lista;
  try {
    lista = await tillfallenAttUppdatera(provId, granser);
  } catch {
    return "inga"; // går inte att läsa – tillfällena ändras då bara i rättningsvyn
  }
  if (!lista.length) return "inga";
  return new Promise((klar) => {
    const { box, stang } = ruta(`
      <h2 class="provl-ruta-rubrik">Nya färggränser</h2>
      <p>Använd de nya gränserna (gul från ${granser.gul} %, grön från ${granser.gron} %) även för redan körda tillfällen (${lista.length} st)?</p>
      <p class="hint">Ja: rättning, översikt, statistik, CSV och utskrift får de nya färgerna direkt. Nej: de tillfällena behåller sina gränser – du kan ändra dem i rättningsvyn när som helst.</p>
      <p class="msg error provl-tf-fel" role="alert" hidden></p>
      <div class="provl-tf-knappar">
        <button class="btn gron" data-act="ja">Ja, uppdatera ${lista.length} st</button>
        <button class="btn ghost" data-act="nej">Nej, behåll de gamla</button>
      </div>`, { etikett: "Nya färggränser" });
    box.querySelector('[data-act="nej"]').addEventListener("click", () => { stang(); klar("nej"); });
    const ja = box.querySelector('[data-act="ja"]');
    ja.addEventListener("click", async () => {
      ja.disabled = true;
      ja.textContent = "Uppdaterar…";
      const fel = box.querySelector(".provl-tf-fel");
      const kvar = [];
      for (const x of lista) {
        try {
          await sparaGranser(x.id, granser);
        } catch (err) {
          kvar.push(`${x.klassNamn || x.id}: ${errText(err)}`);
        }
      }
      if (!kvar.length) { stang(); return klar("ja"); }
      ja.disabled = false;
      ja.textContent = "Försök igen";
      lista = lista.filter((x) => kvar.some((k) => k.startsWith(`${x.klassNamn || x.id}:`)));
      fel.hidden = false;
      fel.innerHTML = `${kvar.length} tillfällen kunde inte uppdateras:<br>${kvar.map(esc).join("<br>")}`;
    });
  });
}
