// ============================================================================
// Matchdagen (#874, Etapp 4): VÄNSKAPSMATCHEN på skärmen (spec §11.3–11.4). Samma skylt,
// plan (3D eller 2D-reserven), kommentar och frågekort som solospelet (md-match-spel.js
// layout) – men servern spelar matchen. Klienten:
//   • lyssnar på matchdokumentet (vakten i md-vy-vanskap.js, EN onSnapshot) och spelar
//     varje nytt läge (h) som en animation, sett från det egna laget (spegla, vy)
//   • i varje läge: valet (1–4) → mdFraga → frågan (md-svar.js, rättas av mdSvar)
//   • klockan: elevens tid i läget (fas.start + tid); tar den slut räknas svaret som fel.
//     Har motståndaren inte svarat när serverns tid gått anropas mdTick (båda klienterna gör
//     det – servern avgör en gång). Den som inte gör något på 3 minuter förlorar på walkover.
//   • halvtid: "Andra halvlek" (mdTick redo) – matchen fortsätter när båda är redo, senast efter en minut
//   • slutet: resultatet, kassan och de inbördes mötena (servern har skrivit dem – vakten räknar in dem i S.K)
// Eleven kan lämna matchen (mdGeUpp = walkover). Byter eleven flik ligger matchen kvar på servern
// och öppnas igen under Vänskap.
// ============================================================================

import { VANSKAP } from "../delat/md-config.js";
import { VANSKAP_TEXT } from "../delat/md-texter.js";
import { motFarg } from "../delat/md-sasong.js";
import { kaptenPlats } from "../delat/md-trupp.js";
import { inbordesText, motsida, spegla, vLage, vy } from "../delat/md-vanskap.js";
import { esc, ruta, valMeny, vanta } from "../vy/md-vy-delat.js";
import { avatarBild, layout, LJUS } from "../vy/md-match-spel.js";

/** När sidans tid i läget är ute på servern (ms) – samma som functions/md-vanskap-spel.js deadline. */
export const deadline = (m, s) => m.fas.start + ((Number(m.tid?.[s]) || VANSKAP.tid) + VANSKAP.anim) * 1000;

/** Frågan från servern som md-svar.js visar: bilden (klockan, figurer) ritas här ur problemet. */
async function kortFraga(f) {
  if (!f?.bild) return f;
  try {
    const { renderTopicVisual } = await import("../../matte-visuals.js");
    return { ...f, bild: renderTopicVisual(JSON.parse(f.bild)) || undefined };
  } catch { return { ...f, bild: undefined }; }
}

/** Kommentatorns rad till valet. */
function valText(l, roll, mot) {
  const t = (x) => x.replace(/\{mot\}/g, mot);
  if (roll === "forsv") return t(l.d <= 30 ? VANSKAP_TEXT.forsvarNara : VANSKAP_TEXT.forsvar);
  if (l.horna) return VANSKAP_TEXT.horna;
  return l.valAnf.some((v) => v.id === "skjut" && !v.av) ? VANSKAP_TEXT.nara : VANSKAP_TEXT.anfall;
}

export async function spelaVanskap(S, el, { moln, vakt }) {
  const signal = S.flik?.signal;
  const matchId = vakt.id;
  const vantare = new Set();
  const avLyss = vakt.lyssna(() => vantare.forEach((f) => f()));
  signal?.addEventListener("abort", () => { avLyss(); vantare.forEach((f) => f()); }, { once: true });
  /** Vänta tills den senaste ögonblicksbilden uppfyller villkoret (eller avbrott/fel). */
  const vantaPa = (villkor, sig = signal) => new Promise((ok) => {
    const f = () => {
      // Ett saknat dokument (M = null efter första ögonblicksbilden) löser också – anroparen avslutar.
      if (!(sig?.aborted || signal?.aborted || vakt.fel || (vakt.laddad && (!vakt.M || villkor(vakt.M))))) return;
      vantare.delete(f);
      sig?.removeEventListener("abort", f);
      ok(vakt.M);
    };
    vantare.add(f);
    sig?.addEventListener("abort", f, { once: true });
    f();
  });

  el.innerHTML = `<div class="md-panel"><p class="md-svag">Matchen laddas …</p></div>`;
  await vantaPa(() => true);
  if (signal?.aborted) return;
  const M0 = vakt.M;
  if (!M0 || vakt.fel) {
    el.innerHTML = `<div class="md-panel"><p>Matchen går inte att öppna just nu.</p></div>`;
    vakt.stopp();
    return;
  }
  const s = M0.a === S.uid ? "a" : "b";
  const o = motsida(s);
  const egen = M0.V.lag[s];
  const mot = { ...M0.V.lag[o], farg: motFarg(egen.farg, M0.V.lag[o].farg) };
  const kompis = String(M0.namn?.[o] || "kompisen");
  const v = layout(S, el, mot, egen);
  v.utrop.insertAdjacentHTML("afterend", `<button type="button" class="md-planknapp mdv-lamna" data-lamna>Lämna</button>`);
  const [{ skapaPlan }, avatar] = await Promise.all([import("../plan/md-plan.js"), avatarBild(S)]);
  let utropTimer = 0;
  const plan = await skapaPlan({
    yta: v.yta, lugnt: S.lugnt, tvinga2d: S.tvinga2d, avatar,
    vi: { troja: egen.farg, byxor: LJUS.has(egen.farg) ? "#1d2c4a" : "#ffffff", mv: "#ffd23f", kapten: kaptenPlats(S.K?.trupp || []) },
    dem: { troja: mot.farg, byxor: "#1c2433", mv: "#1b1b1b" },
    hooks: {
      utrop(text, ms) {
        clearTimeout(utropTimer);
        v.utrop.textContent = text;
        v.utrop.classList.add("visa");
        utropTimer = setTimeout(() => v.utrop.classList.remove("visa"), S.lugnt ? Math.min(ms, 900) : ms);
      },
    },
  });
  el.querySelector(".md-match").dataset.ritare = plan.typ;
  el.querySelector(".md-match").classList.add("mdv-match");
  // mdTick när serverns tid i läget (eller halvtiden) har gått och läget väntar på den – högst var 4:e sekund.
  let tickVillkor = () => false;
  let senastTick = 0;
  const tickTimer = setInterval(() => {
    const nu = moln.serverNow();
    if (!tickVillkor(nu) || nu - senastTick < 4000) return;
    senastTick = nu;
    moln.tick(matchId).catch(() => {});
  }, 500);
  let stangd = false;
  const stang = () => { if (stangd) return; stangd = true; clearInterval(tickTimer); plan.dispose(); };
  signal?.addEventListener("abort", stang, { once: true });
  const slutAc = new AbortController(); // frågan "Lämna matchen?" stängs om matchen tar slut
  vantaPa((x) => x.status !== "pagar").then(() => slutAc.abort());
  el.querySelector("[data-lamna]").addEventListener("click", async () => {
    if (slutAc.signal.aborted) return;
    const svar = await ruta(S.host, {
      rubrik: "Lämna matchen?",
      html: `<p>Lämnar du förlorar du på walkover och ${esc(kompis)} vinner.</p>`,
      knappar: [{ id: "stanna", text: "Spela vidare" }, { id: "lamna", text: "Lämna matchen" }],
    }, slutAc.signal);
    if (svar === "lamna") moln.geUpp(matchId).catch((err) => { v.kommentar.textContent = err?.message || "Det gick inte just nu."; });
  });

  const skylt = (V) => {
    v.res.textContent = `${V.stallning[s]} – ${V.stallning[o]}`;
    v.tid.textContent = `${Math.min(90, Math.round(V.min))}'`;
  };
  const sag = (t) => { v.kommentar.textContent = t; };
  let visad = M0.h?.nr ?? 0;
  let svaradFas = 0;
  let forsta = true;
  plan.stall(vy(M0.V, s), { avspark: !M0.V.lagen || M0.V.x === 50 });
  skylt(M0.V);
  sag(M0.V.lagen ? "Matchen fortsätter!" : `Vänskapsmatch mot ${kompis} · Avspark!`);
  if (!M0.V.lagen) await vanta(S.lugnt ? 300 : 900);

  /** Ett läge: valet, frågan och svaret – sedan väntan tills servern avgjort läget. */
  async function lage(m) {
    const n = m.fas.nr;
    const ac = new AbortController();
    const nytt = (x) => !x || x.fas?.nr !== n || x.status !== "pagar" || !!x.halvtid || (x.h?.nr ?? 0) > visad;
    // Läget avgjort (motståndaren svarade, eller tiden gick på servern): valet/frågan stängs – men ett
    // givet svar får visa rätt svar klart först. Läget avgörs ofta av elevens EGET svar: ögonblicksbilden
    // kan komma före callablens svar, så kortet stängs inte medan svaret är på väg (skickar).
    let besvarad = false;
    let skickar = false;
    vantaPa(nytt).then(() => { if (!besvarad && !skickar) ac.abort(); });
    const slapp = () => { skickar = false; if (nytt(vakt.M)) ac.abort(); };
    const skicka = (svar) => {
      skickar = true;
      return moln.svar(matchId, svar).then((r) => { if (!r?.giltig) slapp(); return r; }, (err) => { slapp(); throw err; });
    };
    // Servern väntar på den andra när den egna sidan är klar (svarat, eller tiden ute) och den andras tid gått.
    tickVillkor = (nu) => (svaradFas === n || nu >= deadline(m, s)) && nu >= deadline(m, o) + 300;
    // Elevens klocka: högst tid[s] från att frågan visas, och aldrig förbi serverns gräns (animationstiden
    // i början av läget räknas inte bort – den ingår i serverns marginal), 1,5 s säkerhet för nätet.
    const grans = deadline(m, s) - 1500;
    const tidS = Number(m.tid?.[s]) || VANSKAP.tid;
    if (svaradFas !== n) {
      let p = null;
      if (forsta) { // tillbaka i en pågående match: läget kan redan vara valt eller besvarat
        forsta = false;
        p = await moln.lasPrivat(matchId, S.uid).catch(() => null);
        if (p?.fas !== n) p = null;
      }
      let q = p?.fraga ? p : null;
      if (!q && !ac.signal.aborted) {
        const l = vLage(m.V);
        const roll = l.anf === s ? "anf" : "forsv";
        sag(valText(l, roll, mot.namn));
        const tidUte = setTimeout(() => ac.abort(), Math.max(0, grans - moln.serverNow()));
        const val = await valMeny(v.kort, roll === "anf" ? l.valAnf : l.valForsv, ac.signal);
        clearTimeout(tidUte);
        if (val) q = await moln.fraga(matchId, val).catch((err) => { sag(err?.message || "Det gick inte just nu."); return null; });
        else if (!signal?.aborted && !nytt(vakt.M)) sag("Tiden är ute – nästa läge kommer.");
      }
      if (q?.svar) svaradFas = n;
      else if (q?.fraga && !ac.signal.aborted) {
        const { visaFraga } = await import("../md-svar.js");
        const r = await visaFraga(v.kort, await kortFraga(q.fraga), {
          ratta: (_f, svar) => skicka(svar),
          ute: () => skicka(null),
          klocka: Math.max(1, Math.min(tidS, Math.ceil((grans - moln.serverNow()) / 1000))),
          signal: ac.signal,
          vidSvar: () => { besvarad = true; svaradFas = n; },
        });
        if (!r.avbruten) svaradFas = n;
      }
    }
    if (!nytt(vakt.M)) {
      v.kort.innerHTML = `<div class="md-panel mdv-vantar" role="status">${esc(VANSKAP_TEXT.vantar.replace("{mot}", kompis))}</div>`;
    }
    await vantaPa(nytt);
  }

  async function halvtid(m) {
    plan.stall(vy(m.V, s), { avspark: false });
    v.kort.innerHTML = "";
    sag(VANSKAP_TEXT.halvtid);
    tickVillkor = (nu) => nu >= m.halvtid.start + VANSKAP.halvtid * 1000 + 300;
    const ac = new AbortController();
    const slut = (x) => !x || !x.halvtid || x.status !== "pagar";
    vantaPa(slut).then(() => ac.abort());
    const st = m.V.stat[s];
    const redo = m.halvtid.redo?.[s] ? "redo" : await ruta(S.host, {
      rubrik: `Halvtid: ${m.V.stallning[s]} – ${m.V.stallning[o]}`,
      html: `<p>Du har svarat rätt på <b>${Number(st.ratt) || 0} av ${Number(st.fragor) || 0}</b> frågor. Andra halvlek börjar när ni båda är redo – senast om en minut.</p>`,
      knappar: [{ id: "redo", text: "Andra halvlek" }],
    }, ac.signal);
    if (redo && !slut(vakt.M)) {
      await moln.tick(matchId, true).catch(() => {});
      if (!slut(vakt.M)) sag(VANSKAP_TEXT.vantar.replace("{mot}", kompis));
    }
    await vantaPa(slut);
    const M = vakt.M;
    if (!M || M.halvtid || M.status !== "pagar") return;
    plan.stall(vy(M.V, s), { avspark: true });
    skylt(M.V);
    sag("Andra halvlek – avspark!");
    await vanta(S.lugnt ? 300 : 800);
  }

  while (!signal?.aborted && !vakt.fel && vakt.M) {
    const m = vakt.M;
    if (m.h && m.h.nr > visad) {
      tickVillkor = () => false;
      visad = m.h.nr;
      v.kort.innerHTML = "";
      sag(m.h.rad);
      await plan.spela(spegla(m.h, s), vy(m.V, s));
      skylt(m.V);
      continue;
    }
    if (m.status !== "pagar") break;
    if (m.halvtid) await halvtid(m);
    else await lage(m);
  }
  if (signal?.aborted) return;
  const M = vakt.M;
  clearInterval(tickTimer);
  v.kort.innerHTML = "";
  if (!M || vakt.fel) {
    sag("Kontakten med matchen bröts.");
    vakt.stopp();
    return;
  }
  skylt(M.V);
  sag(VANSKAP_TEXT.slut);
  await vanta(S.lugnt ? 300 : 900);
  const r = M.resultat;
  const oss = Number(M.V.stallning[s]) || 0;
  const dem = Number(M.V.stallning[o]) || 0;
  const kassa = Number(r?.kassa?.[s]) || 0;
  const rubrik = !r ? "Matchen avbröts" : r.vinnare === s ? "Vinst!" : r.vinnare === o ? "Förlust – nästa gång!" : "Oavgjort!";
  const wo = r?.walkover === s ? "Du lämnade matchen – den räknas som walkover." : r?.walkover === o ? `${esc(kompis)} lämnade matchen – du vinner på walkover.` : "";
  const g = S.K?.inbordes?.[M[o]];
  const html = !r ? `<p>Ingen av er hann spela klart, så matchen räknas inte.</p>`
    : `<p class="mdv-slutres">${esc(egen.namn)} ${oss} – ${dem} ${esc(M.V.lag[o].namn)}</p>
      ${wo ? `<p>${wo}</p>` : ""}
      <p>${kassa ? `<b>+${kassa} kr</b> till klubbkassan.` : r.walkover === s ? "Ingen klubbkassa den här gången." : `Dagens ${VANSKAP.kassa.perDag} vänskapsmatcher med pengar är redan spelade.`}</p>
      ${g ? `<p class="md-svag">Inbördes: ${esc(inbordesText(S.K.klubb?.namn || egen.namn, g.namn || M.V.lag[o].namn, g))}</p>` : ""}`;
  await ruta(S.host, { rubrik: esc(rubrik), html, knappar: [{ id: "lobby", text: "Till lobbyn" }] }, signal);
  stang();
  vakt.stopp();
  if (!signal?.aborted) S.visa("vanskap");
}
