// ============================================================================
// Hitta rätt! – bild per fråga i lärarens editor (src/hitta-ratt/larare/lhr-bilder.js) · #637
// ----------------------------------------------------------------------------
// Arkitektur §11.8. Bild är HELT frivillig per fråga (båda frågetyperna):
//   "Sök bild online"  Wikimedia Commons från lärarens webbläsare (commons.js).
//                      Första förslaget = Wikidatas P18 om platsen kom därifrån
//                      (it.p18 från platssökningen, annars slås Q-id:t upp).
//                      Bara licenser på vitlistan visas. Vid val hämtas
//                      960-miniatyren, skalas ned (lhr-skala.js) och KOPIERAS
//                      till hittaRattBilder – eleven hämtar aldrig från Commons.
//                      fotograf, licens, licensUrl, fil och kallaUrl sparas.
//   "Ladda upp egen"   filväljare + kryssrutan "Jag har rätt att använda
//                      bilden" (krävs). kalla "egen", ingen attribution.
//   "Ingen bild"       standard; tar bort bilden från frågan (servern raderar
//                      det oanvända dokumentet vid nästa sparning).
//
//   bildHtml(it) → bildraden i en fråga (lhr-fragor.js)
//   kopplaBild(rad, it, { packId, andrad, omrita })
// Laddas bara dynamiskt (lärarfliken), aldrig i bootgrafen.
// ============================================================================

import { el, esc } from "../../teacher-shared.js";
import { attributionHtml, skapaBildCache } from "../hr-bild.js";
import { skapaCommons, RUTNAT_PX } from "./commons.js";
import { skalaBild } from "./lhr-skala.js";
import { sparaBild } from "./lhr-data.js";

const commons = skapaCommons();
const cache = skapaBildCache(); // sparade bilder (tummar) – gäller hela sessionen
const lokala = new Map(); // id → objectURL för bilder som just laddats upp
const kb = (n) => `${Math.max(1, Math.round(n / 1000))} kB`;

export function bildHtml(it) {
  const b = it.bild;
  const text = !b ? `<span class="hint">Ingen bild</span>`
    : b.kalla === "egen" ? `<span class="hint">Egen bild${it.bildInfo ? ` · ${esc(it.bildInfo)}` : ""}</span>`
      : `<span class="hint lhr-bild-attr">${attributionHtml(b, esc)}${it.bildInfo ? ` · ${esc(it.bildInfo)}` : ""}</span>`;
  return `<div class="lhr-bild" data-v="bild">
    ${b ? `<img class="lhr-bild-tumme" alt="" data-v="tumme" />` : `<span class="lhr-bild-tom" aria-hidden="true">🖼️</span>`}
    <div class="lhr-bild-info">
      ${text}
      <div class="lhr-bild-knappar">
        <button type="button" class="btn small ghost" data-act="bild-sok">🔍 <span>Sök bild online</span></button>
        <button type="button" class="btn small ghost" data-act="bild-ladda">⬆️ <span>Ladda upp egen</span></button>
        ${b ? `<button type="button" class="btn small ghost" data-act="bild-bort">Ingen bild</button>` : ""}
      </div>
    </div>
  </div>`;
}

export function kopplaBild(rad, it, { packId, andrad = () => {}, omrita = () => {} }) {
  const tumme = rad.querySelector('[data-v="tumme"]');
  if (tumme && it.bild) {
    const lokal = it.bild.id && lokala.get(it.bild.id);
    (lokal ? Promise.resolve(lokal) : cache.url(it.bild)).then((u) => {
      if (u) tumme.src = u;
      else tumme.replaceWith(el(`<span class="lhr-bild-tom" title="Bilden gick inte att läsa">⚠️</span>`));
    });
  }
  const valj = async (lage) => {
    const ny = await bildval(rad, it, { packId, lage });
    if (!ny) return;
    it.bild = ny.bild;
    it.bildInfo = ny.info;
    andrad();
    omrita();
  };
  rad.querySelector('[data-act="bild-sok"]').addEventListener("click", () => valj("sok"));
  rad.querySelector('[data-act="bild-ladda"]').addEventListener("click", () => valj("ladda"));
  rad.querySelector('[data-act="bild-bort"]')?.addEventListener("click", () => {
    delete it.bild;
    delete it.bildInfo;
    andrad();
    omrita();
  });
}

/** Skala ned + spara som eget dokument → { bild, info } (info = "800×533 · 55 kB"). */
async function spara(packId, blob, meta) {
  const r = await skalaBild(blob);
  const id = await sparaBild(packId, r);
  lokala.set(id, URL.createObjectURL(r.blob));
  return { bild: { id, ...meta, bredd: r.bredd, hojd: r.hojd }, info: `${r.bredd}×${r.hojd} · ${kb(r.blob.size)}`, bytes: r.blob.size };
}

/** Dialogen. Löser ut { bild, info } eller null (Avbryt/Esc). */
function bildval(rad, it, { packId, lage }) {
  return new Promise((klar) => {
    const d = el(`<dialog class="lhr-bild-dialog" aria-label="Bild till frågan">
      <div class="lhr-bild-dialog-topp">
        <h3 class="subhead">Bild till ”${esc(it.name || "frågan")}”</h3>
        <div class="lhr-bild-flikar" role="tablist">
          <button type="button" class="btn small" role="tab" data-flik="sok">🔍 Sök bild online</button>
          <button type="button" class="btn small" role="tab" data-flik="ladda">⬆️ Ladda upp egen</button>
        </div>
      </div>
      <section data-panel="sok">
        <form class="lhr-bild-sok" role="search">
          <input type="search" data-v="q" maxlength="80" value="${esc(it.name || "")}" placeholder="t.ex. Gävle rådhus" />
          <button type="submit" class="btn small">Sök</button>
        </form>
        <p class="hint">Bilder från Wikimedia Commons med fri licens (Public domain, CC0, CC BY, CC BY-SA). Bilden kopieras till Pluggporten – eleverna hämtar inget från Commons.</p>
        <div class="lhr-bild-rutnat" aria-live="polite"></div>
      </section>
      <section data-panel="ladda" hidden>
        <input type="file" accept="image/*" data-v="fil" />
        <label class="lhr-check"><input type="checkbox" data-v="ratt" /><span><b>Jag har rätt att använda bilden</b> (jag har tagit den själv eller fått lov).</span></label>
        <button type="button" class="btn small gron" data-act="ladda-upp" disabled>Ladda upp</button>
      </section>
      <p class="lhr-bild-status" role="status" aria-live="polite"></p>
      <div class="lhr-knappar"><span class="lhr-spacer"></span><button type="button" class="btn ghost" data-act="stang">Avbryt</button></div>
    </dialog>`);
    const $ = (s) => d.querySelector(s);
    const status = (t, fel = false) => {
      $(".lhr-bild-status").textContent = t;
      $(".lhr-bild-status").classList.toggle("err-inline", fel);
    };
    let upptagen = false;
    const slut = (svar) => {
      d.close();
      d.remove();
      klar(svar);
    };
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      if (!upptagen) slut(null);
    });
    $('[data-act="stang"]').addEventListener("click", () => !upptagen && slut(null));

    const visaFlik = (f) => {
      d.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== f; });
      d.querySelectorAll("[data-flik]").forEach((b) => {
        b.classList.toggle("gron", b.dataset.flik === f);
        b.setAttribute("aria-selected", String(b.dataset.flik === f));
      });
    };
    d.querySelectorAll("[data-flik]").forEach((b) => b.addEventListener("click", () => visaFlik(b.dataset.flik)));

    const kor = async (fn) => {
      if (upptagen) return;
      upptagen = true;
      d.classList.add("upptagen");
      try {
        slut(await fn());
      } catch (err) {
        status(err?.message || "Bilden kunde inte sparas.", true);
      } finally {
        upptagen = false;
        d.classList.remove("upptagen");
      }
    };

    // --- Commons -------------------------------------------------------
    const rutnat = $(".lhr-bild-rutnat");
    const valjCommons = (t) => kor(async () => {
      status("Hämtar och skalar ned bilden …");
      const stor = (await commons.info(t.fil)) || t;
      let blob;
      try {
        const r = await fetch(stor.thumb, { mode: "cors", referrerPolicy: "strict-origin-when-cross-origin" });
        if (!r.ok) throw new Error(String(r.status));
        blob = await r.blob();
      } catch {
        throw new Error("Bilden gick inte att hämta från Commons. Försök igen eller välj en annan.");
      }
      const { licens, licensUrl, fotograf, sida, fil } = stor;
      return spara(packId, blob, { kalla: "commons", fil: fil.replace(/^File:/, ""), fotograf, licens, licensUrl, kallaUrl: sida });
    });
    const ruta = (t, forslag = false) => {
      const b = el(`<button type="button" class="lhr-bild-val${forslag ? " forslag" : ""}" title="${esc(`${t.fil.replace(/^File:/, "")} – ${t.fotograf}, ${t.licens}`)}">
        <img src="${esc(t.thumb)}" alt="" loading="lazy" width="${RUTNAT_PX}" />
        <span>${forslag ? "⭐ Förslag från Wikidata · " : ""}${esc(t.licens)}</span></button>`);
      b.addEventListener("click", () => valjCommons(t));
      return b;
    };
    let forslag = null;
    const qid = /^wikidata:(Q\d+)$/.exec(it.kalla || "")?.[1];
    const hamtaForslag = async () => {
      const fil = it.p18 || (qid ? await commons.p18(qid).catch(() => null) : null);
      return fil ? commons.info(fil, RUTNAT_PX).catch(() => null) : null;
    };
    const sok = async (q) => {
      status("Söker …");
      try {
        const [f, lista] = await Promise.all([forslag ?? (forslag = hamtaForslag()), commons.sok(q)]);
        const ovriga = lista.filter((t) => t.fil !== f?.fil);
        rutnat.replaceChildren(...(f ? [ruta(f, true)] : []), ...ovriga.map((t) => ruta(t)));
        status(f || ovriga.length ? "Klicka på en bild för att välja den." : "Inga bilder med fri licens hittades. Prova ett annat sökord.");
      } catch (err) {
        status(err?.message || "Bildsökningen fungerar inte just nu.", true);
      }
    };
    $(".lhr-bild-sok").addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation(); // dialogen ligger i lärarformuläret
      const q = $('[data-v="q"]').value.trim();
      if (q) sok(q);
    });

    // --- Egen bild -----------------------------------------------------
    const fil = $('[data-v="fil"]');
    const ratt = $('[data-v="ratt"]');
    const uppKnapp = $('[data-act="ladda-upp"]');
    const kanLadda = () => { uppKnapp.disabled = !(fil.files?.[0] && ratt.checked); };
    fil.addEventListener("change", kanLadda);
    ratt.addEventListener("change", kanLadda);
    uppKnapp.addEventListener("click", () => {
      if (!ratt.checked) return status("Kryssa i att du har rätt att använda bilden.", true);
      const f = fil.files?.[0];
      if (!f) return;
      kor(() => {
        status("Skalar ned och sparar bilden …");
        return spara(packId, f, { kalla: "egen" });
      });
    });

    (rad.closest(".teacher-dark") || document.body).append(d);
    visaFlik(lage);
    d.showModal();
    if (lage === "sok") {
      const q = (it.name || "").trim();
      if (q || it.p18 || qid) sok(q || it.p18);
      $('[data-v="q"]').focus();
    } else {
      fil.focus();
    }
  });
}
