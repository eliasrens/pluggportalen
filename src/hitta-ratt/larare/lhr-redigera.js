// ============================================================================
// Hitta rätt! – skapa / redigera ett eget område (src/hitta-ratt/larare/lhr-redigera.js) · #634
// ----------------------------------------------------------------------------
//   #/larare/hitta-ratt?vy=ny                skapa nytt
//   #/larare/hitta-ratt?vy=ny&id=e-…         redigera (bara ägaren – andra får duplicera)
//   #/larare/hitta-ratt?vy=ny&kopia=<packId> duplicera (officiellt eller eget) → osparad kopia
// Arkitektur §11.9 punkt 3. Spara = hittaRattSparaPack (servern validerar
// igen, höjer versionen vid ändrat facit och skriver katalogen). Geo och typ
// är låsta när packet sparats. Osparade ändringar → lämna-vakten frågar.
// Kryssrutan "Skoltopplista / Gör till skolutmaning" (#635, §11.5) hör till
// formuläret (lämna-vakten ser den) men skickas efter sparningen via
// hittaRattSattTopplista – bara om den ändrats.
// Bilder (#637): frivillig per fråga (lhr-bilder.js). En kopia av ett eget
// pack skickar kopieraFran vid första sparningen – servern kopierar bilderna.
// ============================================================================

import { el, esc, icon } from "../../teacher-shared.js";
import { auth } from "../../firebase-config.js";
import { getClasses } from "../../data-classes.js";
import { IKONER, GRANS, nyttPackId } from "../delat/egna.js";
import { arEget } from "../hr-egna.js";
import { armeraLamnaVakt } from "../hr-lamna-vakt.js";
import {
  GEOER, TYPER, FACIT_VARNING, LAMNA_TEXT, TOPPLISTA_TEXT, bytKarta, dupliceraPack, facitAndras, formularFranPack,
  klassText, kontrollera, nyttFormular, raderaText, tillIndata, topplistaAndras, topplistaKvitto,
} from "./lhr-modell.js";
import { hamtaOfficielltPack, hamtaPack, laddaOmraden, raderaPack, sattTopplista, sparaPack } from "./lhr-data.js";
import { ritaFragor } from "./lhr-fragor.js";
import { skapaKartval } from "./lhr-kartval.js";

const HASH = "#/larare/material?flik=hitta-ratt"; // Material → Hitta rätt! (#806)
let flash = null; // { id, html } – meddelande efter sparning, visas en gång

export async function renderRedigera(ctx, host, { id, kopia } = {}) {
  host.replaceChildren(el(`<div class="spinner">Laddar…</div>`));
  const uid = auth.currentUser?.uid || "";
  let f, original = null, klasser = [];
  try {
    const kalla = id ? hamtaPack(id) : kopia ? (arEget(kopia) ? hamtaPack(kopia) : hamtaOfficielltPack(kopia)) : null;
    const [pack, k] = await Promise.all([kalla, getClasses().catch(() => [])]);
    klasser = k;
    if ((id || kopia) && !pack) return fel(ctx, host, "Kartan finns inte längre.");
    if (id && pack.ownerUid !== uid) return fel(ctx, host, "Bara läraren som skapade kartan kan ändra den. Duplicera den i stället.", pack.id);
    if (id) {
      original = pack;
      f = formularFranPack(pack);
    } else {
      f = kopia ? dupliceraPack(pack, nyttPackId()) : nyttFormular(nyttPackId());
    }
  } catch (err) {
    return fel(ctx, host, `Kartan gick inte att läsa: ${err?.message || err}`);
  }
  ritaFormular(ctx, host, { f, original, klasser });
}

function fel(ctx, host, text, kopiaId) {
  const vy = el(`<div class="panel lhr-fel" role="alert"><p>${esc(text)}</p>
    <div class="lhr-knappar">${kopiaId ? `<button class="btn gron" data-act="kopia">${icon("copy", 16)}<span>Duplicera</span></button>` : ""}
    <button class="btn" data-act="tillbaka">← Mina områden</button></div></div>`);
  vy.querySelector('[data-act="tillbaka"]').addEventListener("click", () => ctx.go(`${HASH}&vy=mina`));
  vy.querySelector('[data-act="kopia"]')?.addEventListener("click", () => ctx.go(`${HASH}&vy=ny&kopia=${encodeURIComponent(kopiaId)}`));
  host.replaceChildren(vy);
}

function ritaFormular(ctx, host, { f, original, klasser }) {
  const st = { f, omraden: null };
  const las = f.sparad ? "disabled" : "";
  const vy = el(`<form class="panel lhr-form" novalidate>
    <div class="lhr-form-topp">
      <h2 class="subhead">${f.sparad ? `Redigera ”${esc(f.title)}”` : f.kopiaAv ? `Kopia av ”${esc(f.kopiaAv)}”` : "Skapa nytt område"}</h2>
      ${f.kopiaAv ? `<p class="hint">Kopian är inte sparad än. Klasserna följer inte med – välj klasser och spara.</p>` : ""}
    </div>
    <div class="lhr-msg" aria-live="polite">${flash?.id === f.id ? flash.html : ""}</div>
    <div class="lhr-form-grid">
      <label class="field">Namn<input type="text" data-k="title" maxlength="${GRANS.titel}" value="${esc(f.title)}" placeholder="t.ex. Gästrikland runt" required /></label>
      <label class="field"><span>Kort beskrivning <span class="hint">(valfri)</span></span>
        <textarea data-k="description" maxlength="${GRANS.beskrivning}" rows="2" placeholder="Vad eleverna ska hitta">${esc(f.description)}</textarea></label>
      <fieldset class="lhr-falt"><legend>Ikon</legend><div class="lhr-ikoner">
        ${IKONER.map((ik) => `<label class="lhr-ikon"><input type="radio" name="lhr-ikon" value="${ik}" ${ik === f.ikon ? "checked" : ""} /><span>${ik}</span></label>`).join("")}
      </div></fieldset>
      <fieldset class="lhr-falt"><legend>Karta</legend>
        <select data-k="geo" ${las}>${GEOER.map((g) => `<option value="${g.geo}" ${g.geo === f.geo ? "selected" : ""}>${esc(g.namn)}</option>`).join("")}</select>
        <p class="hint">${f.sparad ? "Kartan och frågetypen går inte att byta efter att området sparats – duplicera det i stället." : "Kartan och frågetypen väljs bara nu. De går inte att byta efter att området sparats."}</p>
      </fieldset>
      <fieldset class="lhr-falt"><legend>Frågetyp</legend><div class="lhr-val">
        ${Object.entries(TYPER).map(([t, v]) => `<label class="lhr-radio"><input type="radio" name="lhr-typ" value="${t}" ${t === f.type ? "checked" : ""} ${las} />
          <span><b>${v.ikon} ${v.namn}</b><span class="hint">${v.hint}</span></span></label>`).join("")}
      </div></fieldset>
      <fieldset class="lhr-falt"><legend>Startvy</legend><div class="lhr-val">
        <label class="lhr-radio"><input type="radio" name="lhr-startvy" value="auto" ${f.startvy !== "hel" ? "checked" : ""} /><span><b>Anpassad</b><span class="hint">Kartan startar inzoomad där frågorna finns (minst 4 frågor).</span></span></label>
        <label class="lhr-radio"><input type="radio" name="lhr-startvy" value="hel" ${f.startvy === "hel" ? "checked" : ""} /><span><b>Hela kartan</b></span></label>
      </div></fieldset>
      <fieldset class="lhr-falt"><legend>Klasser som ser området</legend>
        ${klasser.length ? `<div class="lhr-klasser">${klasser.map((k) => `<label class="lhr-check"><input type="checkbox" value="${esc(k.id)}" ${f.classIds.includes(k.id) ? "checked" : ""} /><span>${esc(k.name || k.id)}</span></label>`).join("")}</div>`
          : `<p class="hint">Det finns inga klasser ännu.</p>`}
        <p class="hint">Ingen klass vald = bara lärare ser området.</p>
      </fieldset>
    </div>
    <div class="lhr-fragor-host"></div>
    <fieldset class="lhr-falt lhr-topplista" data-plats="topplista"><legend>Topplista</legend>
      <label class="lhr-check"><input type="checkbox" data-k-topplista ${f.leaderboard ? "checked" : ""} />
        <span><b>Skoltopplista / Gör till skolutmaning</b></span></label>
      <p class="hint lhr-topplista-text">${esc(f.leaderboard ? TOPPLISTA_TEXT.pa : TOPPLISTA_TEXT.av)}</p>
      <p class="hint">${esc(TOPPLISTA_TEXT.vem)}</p>
    </fieldset>
    <div class="msg warn lhr-facit-varning" role="status" hidden>⚠️ ${esc(FACIT_VARNING)}</div>
    <div class="lhr-fel-rad msg error" role="alert" hidden></div>
    <div class="lhr-knappar lhr-form-knappar">
      <button type="submit" class="btn gron" data-act="spara">${icon("save", 16)}<span>Spara</span></button>
      <button type="button" class="btn ghost" data-act="avbryt">Tillbaka</button>
      ${f.sparad ? `<span class="lhr-spacer"></span>
        <button type="button" class="btn small ghost" data-act="prov">${icon("eye", 16)}<span>Provspela</span></button>
        <button type="button" class="btn small ghost" data-act="kopia">${icon("copy", 16)}<span>Duplicera</span></button>
        <button type="button" class="btn small danger" data-act="radera">${icon("trash", 16)}<span>Radera</span></button>` : ""}
    </div>
  </form>`);
  if (flash?.id === f.id) flash = null;
  const $ = (s) => vy.querySelector(s);

  // Osparat-läge: jämför med det som senast sparades/laddades.
  const bild = () => JSON.stringify([tillIndata(st.f), st.f.leaderboard === true]);
  let sparadBild = f.kopiaAv ? "" : bild();
  let avarmera = null;
  const andrad = () => {
    const smutsig = bild() !== sparadBild;
    if (smutsig && !avarmera) avarmera = armeraLamnaVakt({ text: LAMNA_TEXT });
    if (!smutsig && avarmera) slappVakt();
    $(".lhr-facit-varning").hidden = !facitAndras(original, st.f, st.omraden?.geoOmraden);
    $(".lhr-fel-rad").hidden = true;
  };
  const slappVakt = () => {
    avarmera?.();
    avarmera = null;
  };

  async function ritaFragorna() {
    const fh = $(".lhr-fragor-host");
    st.omraden = null;
    st.kartval?.destroy();
    st.kartval = null;
    if (st.f.type === "area") {
      fh.replaceChildren(el(`<div class="spinner">Laddar områdena…</div>`));
      try {
        st.omraden = await laddaOmraden(st.f.geo);
      } catch {
        fh.replaceChildren(el(`<p class="err-inline">Områdena gick inte att ladda. Ladda om sidan.</p>`));
        return;
      }
    }
    // Kartvalet (#636) ritas EN gång per karta/typ; listan ritas om runt det.
    const kartvalHost = el(`<div class="lhr-kartval-host"></div>`);
    const andradOchSynka = () => {
      st.kartval?.synka();
      andrad();
    };
    const visaLista = () => {
      ritaFragor(fh, st, { omraden: st.omraden, andrad: andradOchSynka, kartval: st.kartval, kartvalHost });
      andradOchSynka();
    };
    st.kartval = skapaKartval(kartvalHost, st, { omraden: st.omraden, andrad: andradOchSynka, omritaLista: visaLista });
    visaLista();
  }

  vy.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("input", () => {
    if (inp.dataset.k === "geo") return;
    st.f[inp.dataset.k] = inp.value;
    andrad();
  }));
  vy.querySelectorAll('[name="lhr-ikon"]').forEach((r) => r.addEventListener("change", () => { st.f.ikon = r.value; andrad(); }));
  vy.querySelectorAll('[name="lhr-startvy"]').forEach((r) => r.addEventListener("change", () => { st.f.startvy = r.value; andrad(); }));
  $("[data-k-topplista]").addEventListener("change", (e) => {
    st.f.leaderboard = e.target.checked;
    $(".lhr-topplista-text").textContent = st.f.leaderboard ? TOPPLISTA_TEXT.pa : TOPPLISTA_TEXT.av;
    andrad();
  });
  vy.querySelectorAll(".lhr-klasser input").forEach((c) => c.addEventListener("change", () => {
    st.f.classIds = [...vy.querySelectorAll(".lhr-klasser input:checked")].map((x) => x.value);
    andrad();
  }));

  // Byte av karta/typ (bara osparade). Frågor som inte passar tas bort efter en fråga.
  async function byt(nytt, aterstall) {
    const nycklar = nytt.geo && nytt.geo !== st.f.geo && st.f.type === "area" ? (await laddaOmraden(nytt.geo).catch(() => null))?.nycklar || {} : {};
    const { form, borttagna } = bytKarta(st.f, nytt, nycklar);
    if (borttagna && !confirm(`${borttagna} ${borttagna === 1 ? "fråga passar" : "frågor passar"} inte på den nya kartan eller frågetypen och tas bort. Fortsätta?`)) {
      aterstall();
      return;
    }
    st.f = form;
    ritaFragorna();
  }
  $('[data-k="geo"]').addEventListener("change", (e) => byt({ geo: e.target.value }, () => { e.target.value = st.f.geo; }));
  vy.querySelectorAll('[name="lhr-typ"]').forEach((r) => r.addEventListener("change", () =>
    byt({ type: r.value }, () => { vy.querySelector(`[name="lhr-typ"][value="${st.f.type}"]`).checked = true; })
  ));

  const visaFel = (text) => {
    const rad = $(".lhr-fel-rad");
    rad.textContent = text;
    rad.hidden = false;
    rad.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  vy.addEventListener("submit", async (e) => {
    e.preventDefault();
    const k = kontrollera(st.f, st.omraden?.geoOmraden);
    if (!k.ok) return visaFel(k.fel);
    if (facitAndras(original, st.f, st.omraden?.geoOmraden) && !confirm(`${FACIT_VARNING}\n\nSpara ändå?`)) return;
    const knapp = $('[data-act="spara"]');
    knapp.disabled = true;
    knapp.lastElementChild.textContent = "Sparar…";
    try {
      const svar = await sparaPack(tillIndata(st.f), { kopieraFran: st.f.sparad ? null : st.f.kopieraFran });
      const klasstext = klassText(st.f.classIds, klasser);
      const delad = st.f.classIds.length ? `Eleverna i ${esc(klasstext)} ser området.` : "Ingen klass ser området ännu.";
      let toppText = "";
      if (topplistaAndras(original, st.f)) {
        try {
          await sattTopplista(svar.id, st.f.leaderboard);
          toppText = ` ${esc(topplistaKvitto(st.f.leaderboard, klasstext))}`;
        } catch (err) {
          toppText = `</div><div class="msg error">Området sparades, men topplistan kunde inte ${st.f.leaderboard ? "slås på" : "stängas av"}: ${esc(err?.message || "okänt fel")} Försök igen.`;
        }
      }
      slappVakt();
      sparadBild = bild();
      flash = {
        id: svar.id,
        html: `<div class="msg ok">Sparat! ${svar.nollstalld ? "Rekorden och topplistan började om från noll." : delad}${toppText}</div>`,
      };
      const hash = `${HASH}&vy=ny&id=${encodeURIComponent(svar.id)}`;
      history.replaceState(null, "", hash);
      renderRedigera(ctx, host, { id: svar.id });
    } catch (err) {
      knapp.disabled = false;
      knapp.lastElementChild.textContent = "Spara";
      visaFel(err?.message || "Något gick fel – inget sparades.");
    }
  });

  $('[data-act="avbryt"]').addEventListener("click", () => ctx.go(`${HASH}&vy=mina`)); // vakten frågar om osparat
  $('[data-act="prov"]')?.addEventListener("click", () => ctx.go(`${HASH}&prov=${encodeURIComponent(f.id)}&fran=mina`));
  $('[data-act="kopia"]')?.addEventListener("click", () => ctx.go(`${HASH}&vy=ny&kopia=${encodeURIComponent(f.id)}`));
  $('[data-act="radera"]')?.addEventListener("click", async () => {
    if (!confirm(raderaText({ title: original?.title, leaderboard: original?.leaderboard === true }))) return;
    try {
      await raderaPack(f.id);
      slappVakt();
      ctx.go(`${HASH}&vy=mina`);
    } catch (err) {
      visaFel(err?.message || "Området kunde inte raderas.");
    }
  });

  host.replaceChildren(vy);
  ritaFragorna();
  if (!f.sparad && !f.kopiaAv) $('[data-k="title"]').focus();
}
