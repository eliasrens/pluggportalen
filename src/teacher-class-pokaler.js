// ============================================================================
// Pluggporten – lärarsidan: klassens pokaler (#528) under Klasscentret.
// ----------------------------------------------------------------------------
//   • Läsresan: hur många godkända texter klassen läst + nästa milstolpe.
//     Öppnas blocket delas saknade milstolpar ut (bara lärare får, reglerna).
//   • Dela ut en egen pokal: motiv + titel + text → trophies/larare-<id>.
//   • Klassens pokaler i realtid; lärarens egna går att ta bort.
// Laddas DYNAMISKT från teacher-class-klasscenter.js (#271). Rena delar:
// klasscenter/kc-larare-pokal.js.
// ============================================================================

import { esc, icon } from "./teacher-shared.js";
import { formularHtml, lasresanRad, pokalListaHtml } from "./klasscenter/kc-larare-pokal.js";

const CSS = "src/klasscenter/kc-larare-pokal.css";
const H3 = "display:flex;align-items:center;gap:8px;margin:0 0 6px";

function laddaCss() {
  if (document.querySelector(`link[data-kc-css="${CSS}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS;
  link.dataset.kcCss = CSS;
  document.head.appendChild(link);
}

/**
 * Rendera pokalblocket för klassen `cls` in i `host` (ett .cls-block).
 * @param {HTMLElement} host
 * @param {object} cls  klassdokumentet
 */
export async function renderClassPokaler(host, cls) {
  laddaCss();
  const api = await import("./klasscenter/kc-pokal-data.js");
  host.innerHTML = `
    <h3 style="${H3}">${icon("trophy", 18)} Pokaler</h3>
    <p class="hint">Klassens pokaler står i Klasscentrets rum (med en ruta som visar texten när
      eleverna pekar på dem). De delas ut automatiskt för Mattematchen (1:a–3:e plats), Live och
      Läsresan – och du kan dela ut egna.</p>
    <p class="kclp-lasresan hint">📚 Räknar Läsresan-texter…</p>
    <h4 class="kclp-rubrik">Dela ut en egen pokal till ${esc(cls.name || cls.id)}</h4>
    ${formularHtml()}
    <h4 class="kclp-rubrik">Klassens pokaler</h4>
    <div class="kclp-lista-host"><div class="spinner">Laddar pokalerna…</div></div>`;

  const lasRad = host.querySelector(".kclp-lasresan");
  api.delaUtLasresanMilstolpar(cls.id, { tvinga: true }).then(({ antal, nya }) => {
    const r = lasresanRad(antal);
    lasRad.textContent = `📚 ${r.text}` + (nya.length ? ` Ny pokal: ${nya.join(", ")} texter! 🏆` : "");
  });

  const listHost = host.querySelector(".kclp-lista-host");
  let unsub = null;
  const stang = () => {
    unsub?.();
    unsub = null;
    clearInterval(vakt);
  };
  const vakt = setInterval(() => !host.isConnected && stang(), 5000);
  unsub = api.bevakaPokaler(cls.id, (pokaler) => {
    if (!host.isConnected) return stang();
    listHost.innerHTML = pokalListaHtml(pokaler);
  }, (err) => {
    listHost.innerHTML = `<span class="err-inline">Kunde inte läsa pokalerna: ${esc(err.message)}</span>`;
    stang();
  });

  listHost.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-kc-ta-bort]");
    if (!btn) return;
    const titel = btn.closest("li")?.querySelector("b")?.textContent || "pokalen";
    if (!confirm(`Ta bort "${titel}" från klassens pokaler?`)) return;
    btn.disabled = true;
    const r = await api.taBortLararPokal(cls.id, btn.dataset.kcTaBort);
    if (!r.ok) {
      btn.disabled = false;
      alert(r.error);
    }
  });

  const form = host.querySelector(".kclp-form");
  const res = form.querySelector(".kclp-resultat");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const knapp = form.querySelector('button[type="submit"]');
    knapp.disabled = true;
    res.innerHTML = "Delar ut…";
    const r = await api.delaUtLararPokal(cls.id, {
      motiv: form.querySelector('input[name="kclp-motiv"]:checked')?.value,
      titel: form.elements.titel.value,
      text: form.elements.text.value,
    });
    knapp.disabled = false;
    if (r.ok) {
      res.innerHTML = `<span class="ok-inline">✓ Pokalen står nu i klassens Klasscentrum!</span>`;
      form.elements.titel.value = "";
      form.elements.text.value = "";
    } else {
      res.innerHTML = `<span class="err-inline">${esc(r.error)}</span>`;
    }
  });
}
