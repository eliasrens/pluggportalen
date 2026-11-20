// ============================================================================
// Matchdagen (#869): STATISTIK-fliken (spec §6.3) – siffrorna (matcher,
// vinster–oavgjorda–förluster, gjorda mål, andel rätt, speltid), rätt per källa
// som staplar, de senaste 20 matcherna (klick → detaljer: EN läsning av
// matcher/{id}), säsongshistoriken och pokalskåpet. Allt utom detaljerna står i
// karriärdokumentet som redan är läst – fliken kostar inga läsningar (§13).
// Etapp 2c (#872, §9.2): rekorden (md-vy-cup.js rekordLista) och cupmatcherna.
// Etapp 3 (#873): Mästarcupens matcher, klubbhistoriken (§10.3, de gamla klubbarna med
// säsonger och pokaler) och pokalerna med de tecknade sorterna (hela skåpet: Pokalskåpet).
// ============================================================================

import { CUP, DIVISIONER, MASTARCUP } from "../delat/md-config.js";
import { pokalSort } from "../delat/md-legend.js";
import { historikHtml } from "./md-vy-pokaler.js";
import { esc, procent, tidText } from "./md-vy-delat.js";
import { rekordLista } from "./md-vy-cup.js";

/** Källans namn: "7:ans tabell", områdets namn eller nyckeln. */
export function kallText(nyckel, post = {}) {
  if (post.namn) return post.namn;
  const [typ, rest = ""] = String(nyckel).split(":");
  if (typ === "tabell") return `${rest}:ans tabell`;
  return rest.split("/").pop() || nyckel;
}

/** Tal ur elevens dokument – aldrig text in i HTML. */
const tal = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
/** "2–1", "1–1 (straffar 4–3)" – kvalets straffar (#870). */
const resText = (m) => `${tal(m.oss)}–${tal(m.dem)}${Array.isArray(m.straffar) ? ` (straffar ${tal(m.straffar[0])}–${tal(m.straffar[1])})` : ""}`;
const KVAL_UTFALL = { upp: "kvalade upp", kvar: "förlorade kvalet" };
/** "kval", "Silverpokalen, kvartsfinal" eller "omgång 3" – rundan och omgången som tal ur listan. */
function matchTyp(m) {
  if (m.typ === "kval") return "kval";
  if (m.typ === "cup") return `${CUP.namn}, ${(CUP.rundor[tal(m.omg) - 1] || "cup").toLowerCase()}`;
  if (m.typ === "mastarcup") return `${MASTARCUP.namn}, ${(MASTARCUP.rundor[tal(m.omg) - 1] || "cup").toLowerCase()}`;
  return `omgång ${m.omg == null ? "–" : tal(m.omg)}`;
}
const TAGG = { kval: "kval", cup: "cup", mastarcup: "Mästarcupen" };
const POKAL_KLASS = { cup: " silver", mastarcup: " silver stor", superliga: " stor" };

const STAT_RAD = [["skott", "Skott"], ["skottPaMal", "Skott på mål"], ["pass", "Pass"], ["passOk", "Lyckade pass"],
  ["tacklingar", "Tacklingar och täckningar"], ["vunnaBollar", "Vunna bollar"], ["raddningar", "Räddningar"], ["horner", "Hörnor"]];

function detaljer(m) {
  const st = m.stat || {};
  return `<div class="md-detalj">
    <p><b>${resText(m)}</b> mot ${esc(m.mot)} · säsong ${tal(m.sasong)}, ${esc(matchTyp(m))} · ${Math.round(tal(m.sekunder) / 60)} min</p>
    ${Array.isArray(m.mal) && m.mal.length ? `<p class="md-svag">Mål: ${m.mal.map((x) => `${tal(x?.min)}' ${x?.lag === "oss" ? "vi" : esc(m.mot)}`).join(", ")}</p>` : ""}
    <dl class="md-dl">${STAT_RAD.map(([k, t]) => `<div><dt>${t}</dt><dd>${Number(st[k]) || 0}</dd></div>`).join("")}
      <div><dt>Rätt svar</dt><dd>${tal(m.ratt)}/${tal(m.fragor)}</dd></div></dl>
  </div>`;
}

export function visaStat(S, el) {
  const K = S.K;
  const s = K.summa || {};
  const kallor = Object.entries(s.perKalla || {}).filter(([, v]) => v && typeof v === "object").sort((a, b) => (Number(b[1].fragor) || 0) - (Number(a[1].fragor) || 0));
  const senaste = K.senaste || [];
  el.innerHTML = `<div class="md-panel md-stat">
    <h2>Statistik</h2>
    <div class="md-siffror">
      <div><b>${tal(s.matcher)}</b>matcher</div>
      <div><b>${tal(s.v)}–${tal(s.o)}–${tal(s.f)}</b>vinst–oavgjort–förlust</div>
      <div><b>${tal(s.gjorda)}</b>gjorda mål</div>
      <div><b>${procent(s.ratt || 0, s.fragor || 0)}</b>rätt svar</div>
      <div><b>${tidText(s.spelminuter)}</b>speltid</div>
    </div>
    <h3>Rätt per ämne och källa</h3>
    ${kallor.length ? `<div class="md-staplar">${kallor.map(([k, v]) => `<div class="md-stapelrad">
      <span>${esc(kallText(k, v))}</span><div class="md-stapel" role="img" aria-label="${procent(tal(v.ratt), tal(v.fragor))} rätt"><i style="width:${tal(v.fragor) ? Math.round((100 * tal(v.ratt)) / tal(v.fragor)) : 0}%"></i></div>
      <span class="md-tal">${tal(v.ratt)}/${tal(v.fragor)}</span></div>`).join("")}</div>` : `<p class="md-svag">Inga frågor än.</p>`}
    <h3>De senaste matcherna</h3>
    ${senaste.length ? `<div class="md-scroll"><table class="md-tabell md-senaste">
      <thead><tr><th scope="col">Datum</th><th scope="col">Motståndare</th><th scope="col">Resultat</th><th scope="col">Rätt</th></tr></thead>
      <tbody>${senaste.map((m) => `<tr class="${m.oss > m.dem ? "vinst" : m.oss < m.dem ? "forlust" : "oavgjort"}">
        <td>${esc(m.datum)}</td><td><button type="button" class="md-lank" data-match="${esc(m.id)}">${esc(m.mot)}</button>${TAGG[m.typ] ? ` <span class="md-tagg">${TAGG[m.typ]}</span>` : ""}</td>
        <td>${resText(m)}</td><td>${tal(m.ratt)}/${tal(m.fragor)}</td></tr>`).join("")}</tbody></table></div>
      <div class="md-detaljyta" aria-live="polite"></div>` : `<p class="md-svag">Inga matcher än – spela din första under Match.</p>`}
    <h3>Rekord</h3>
    ${rekordLista(K.rekord)}
    <h3>Säsongerna</h3>
    ${(K.sasonger || []).length ? `<ul class="md-lista">${K.sasonger.map((x) => `<li>Säsong ${tal(x.sasong)} · ${esc(DIVISIONER[x.div] || "")} · plats ${tal(x.plac)} av ${tal(x.lag) || 6}${KVAL_UTFALL[x.kval] ? ` · ${KVAL_UTFALL[x.kval]}` : ""}</li>`).join("")}</ul>`
      : `<p class="md-svag">Säsong ${K.sasong} pågår.</p>`}
    ${historikHtml(K)}
    <h3>Pokalerna</h3>
    ${(K.pokaler || []).length ? `<ul class="md-pokaler">${K.pokaler.map((p) => `<li><span class="md-pokal${POKAL_KLASS[pokalSort(p)] || ""}" aria-hidden="true"></span>${esc(p?.namn)} <span class="md-svag">(säsong ${tal(p?.sasong)})</span></li>`).join("")}</ul>
      <p class="md-svag"><button type="button" class="md-lank" data-skap>Se dem i Pokalskåpet</button></p>`
      : `<p class="md-svag">Vinn en division eller ${esc(CUP.namn)} för din första pokal.</p>`}
  </div>`;
  el.querySelector("[data-skap]")?.addEventListener("click", () => S.visa("pokaler"));
  const yta = el.querySelector(".md-detaljyta");
  el.querySelectorAll("[data-match]").forEach((b) => b.addEventListener("click", async () => {
    yta.innerHTML = `<p class="md-svag">Hämtar matchen …</p>`;
    try {
      const m = await S.data.lasMatch(S.uid, b.dataset.match);
      yta.innerHTML = m ? detaljer(m) : `<p class="md-svag">Matchen finns inte sparad än.</p>`;
    } catch {
      yta.innerHTML = `<p class="md-svag">Matchen kunde inte hämtas just nu.</p>`;
    }
  }));
}
