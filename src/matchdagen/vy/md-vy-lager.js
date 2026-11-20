// ============================================================================
// Matchdagen (#871, Etapp 2b): TRÄNINGSLÄGRET i Truppen (spec §8.4). Ett läger per
// spelad omgång och ett extra före kvalet (md-trupp.js lagerNyckel): eleven väljer
// en startspelare med färre än 5 stjärnor och svarar på 8 frågor – 12 träningspoäng
// per rätt, vid 100 en stjärna till ("Selma Lind fick en stjärna till!").
//
// Varje svar sparas lokalt SÅ FORT det är givet (md-lokal.js sparaLager, vidSvar före
// pausen som visar rätt svar) – en omladdning fortsätter på nästa fråga och ger aldrig
// en ny chans på samma (#870 F1). När alla 8 är besvarade sparas lägret med EN
// skrivning (md-data.js sparaTrupp). Matchen väntar tills lägret är sparat (md-vy-match.js).
//
//   visaLager(S, yta, { signal, klar }) – klar() ritar om korten när lägret är sparat
// Ett nytt anrop för samma yta avbryter det förra (aldrig två frågeslingor samtidigt), och
// en fråga som avbryts av ett flikbyte visas igen när eleven kommer tillbaka (S.lagerFraga)
// – att byta flik ska inte hoppa över en svår fråga. Köp/byten och lägrets start väntar på
// varandra (S.truppUpptagen).
// ============================================================================

import { TRANING } from "../delat/md-config.js";
import { lagerNyckel, lagerResultat, tranaSpelare } from "../delat/md-trupp.js";
import { lasLager, rensaLager, sparaLager } from "../md-lokal.js";
import { sparaKon } from "../md-spara.js";
import { esc, vanta } from "./md-vy-delat.js";
import { hinderMatch, stjarnor, traningsStapel } from "./md-vy-marknad.js";
import { strom } from "./md-strom.js";

const st = (p) => Math.min(5, Math.max(0, Math.round(Number(p?.st) || 0)));
const xp = (p) => Math.min(TRANING.xpPerStjarna, Math.max(0, Math.round(Number(p?.xp) || 0)));
const FIRA_MS = 1400;

/** Texten när inget läger är ledigt (pure – testas i node). */
export function lagerStangtText(K) {
  if (!(Number(K?.liga?.omg) > 0)) return "Spela första matchen, så öppnar träningslägret.";
  return "Laget har tränat den här omgången. Spela nästa match, så får ni ett nytt träningsläger.";
}
/** "Selma Lind fick en stjärna till!" (§8.4) – html-säker. */
export const firaText = (p) => `${esc(p.namn)} fick en stjärna till!`;

/** En egen signal per yta: avbryts av ett nytt visaLager eller av den yttre (flikbytet). */
function ytansSignal(yta, yttre) {
  yta.mdLager?.abort();
  const ac = new AbortController();
  yta.mdLager = ac;
  if (yttre?.aborted) ac.abort();
  else yttre?.addEventListener("abort", () => ac.abort(), { once: true });
  return ac.signal;
}

export async function visaLager(S, yta, opt0 = {}) {
  const opt = { ...opt0, yttre: opt0.signal, signal: ytansSignal(yta, opt0.signal) };
  const pagar = lasLager(S.lagring, S.uid, S.K);
  if (pagar) return korLager(S, yta, pagar, opt);
  const nyckel = lagerNyckel(S.K);
  if (!nyckel) {
    yta.innerHTML = `<p class="md-svag">${esc(lagerStangtText(S.K))}</p>`;
    return;
  }
  const kandidater = S.K.trupp.filter((p) => st(p) < TRANING.maxSt);
  if (!kandidater.length) {
    yta.innerHTML = `<p class="md-svag">Hela startelvan har fem stjärnor – laget är fullt tränat!</p>`;
    return;
  }
  const kval = nyckel.endsWith("-k");
  yta.innerHTML = `<p>${kval ? "<b>Ett extra träningsläger före kvalet!</b> " : ""}Välj en spelare och svara på ${TRANING.fragor} frågor. Varje rätt svar ger spelaren ${TRANING.xpPerRatt} träningspoäng – vid ${TRANING.xpPerStjarna} får hen en stjärna till. Ett läger per omgång.</p>
    <div class="md-rad">
      <select class="md-lagerval" aria-label="Spelare att träna">${kandidater.map((p) =>
        `<option value="${esc(p.id)}">${esc(p.namn)} (${st(p)}★, ${xp(p)}/${TRANING.xpPerStjarna})</option>`).join("")}</select>
      <button type="button" class="md-stor" data-lager>Starta träningen</button>
    </div>
    <p class="md-fel" aria-live="polite"></p>`;
  const knapp = yta.querySelector("[data-lager]");
  knapp.addEventListener("click", async () => {
    const fel = yta.querySelector(".md-fel");
    const hinder = hinderMatch(S) || (S.truppUpptagen ? "Vänta tills köpet är sparat." : null);
    if (hinder) { fel.textContent = hinder; return; }
    knapp.disabled = true;
    S.truppUpptagen = true;
    // Lägret sparas mot karriären på servern – en osparad match måste in först.
    const kon = await sparaKon(S);
    if (!kon || nyckel !== lagerNyckel(S.K)) {
      S.truppUpptagen = false;
      knapp.disabled = false;
      fel.textContent = kon ? "Laget har redan tränat den här omgången." : "Den senaste matchen är inte sparad än. Prova igen när datorn har kontakt med servern.";
      return;
    }
    const post = { nyckel, spelareId: yta.querySelector(".md-lagerval").value, svar: [], sek: 0 };
    sparaLager(S.lagring, S.uid, post);
    S.truppUpptagen = false;
    return korLager(S, yta, lasLager(S.lagring, S.uid, S.K) || { v: 1, ...post }, opt);
  });
}

/** Frågorna som är kvar (en omladdning fortsätter där eleven var), sedan sparningen. */
async function korLager(S, yta, post, opt) {
  const bas = S.K.trupp.find((p) => p.id === post.spelareId);
  const spelaren = () => post.svar.reduce((p, s) => tranaSpelare(p, s.ratt).p, bas);
  if (post.svar.length < TRANING.fragor) {
    const fr = await strom(S);
    if (fr.tom) { yta.innerHTML = `<p class="md-svag">${esc(fr.meddelande || "Inga frågor än")}</p>`; return; }
    const { visaFraga } = await import("../md-svar.js");
    while (post.svar.length < TRANING.fragor) {
      if (opt.signal?.aborted) return;
      const p = spelaren();
      yta.innerHTML = `<div class="md-lager-huvud">
        <p><b>${esc(p.namn)}</b> tränar · fråga ${post.svar.length + 1} av ${TRANING.fragor}</p>
        <div class="md-lager-spelare">${stjarnor(p.st)}${traningsStapel(p)}</div>
      </div>
      <p class="md-firande" role="status" aria-live="polite"></p>
      <div class="md-lager-fraga"></div>`;
      const firande = yta.querySelector(".md-firande");
      let fira = false;
      // Samma fråga igen om den förra avbröts av ett flikbyte (samma läger, samma plats).
      const n = post.svar.length;
      const sist = S.lagerFraga;
      const fraga = sist && sist.nyckel === post.nyckel && sist.n === n ? sist.fraga : fr.nasta();
      S.lagerFraga = { nyckel: post.nyckel, n, fraga };
      const r = await visaFraga(yta.querySelector(".md-lager-fraga"), fraga, {
        ratta: fr.ratta, klocka: S.inst.klocka, signal: opt.signal,
        vidSvar: (x) => {
          const ut = tranaSpelare(spelaren(), !!x.ratt);
          post.svar.push({ ratt: !!x.ratt });
          post.sek = Math.round((post.sek + (Number(x.sekunder) || 0)) * 10) / 10;
          sparaLager(S.lagring, S.uid, post);
          yta.querySelector(".md-lager-spelare").innerHTML = `${stjarnor(ut.p.st)}${traningsStapel(ut.p)}`;
          if (ut.nyStjarna) { fira = true; firande.innerHTML = firaText(ut.p); }
        },
      });
      if (r.avbruten) return;
      if (fira) await vanta(S.lugnt ? 600 : FIRA_MS);
    }
  }
  return sparaLagret(S, yta, post, opt);
}

/** Lägret med alla svar → EN skrivning. Misslyckas den ligger svaren kvar och eleven kan prova igen. */
async function sparaLagret(S, yta, post, opt) {
  let ut;
  try {
    ut = lagerResultat(S.K, { nyckel: post.nyckel, spelareId: post.spelareId, svar: post.svar, sekunder: post.sek, nu: Date.now() });
  } catch (err) {
    console.warn("Matchdagen: träningslägret gäller inte längre", err);
    rensaLager(S.lagring, S.uid);
    yta.innerHTML = `<p class="md-svag">${esc(lagerStangtText(S.K))}</p>`;
    return;
  }
  yta.innerHTML = `<p class="md-svag" role="status">Sparar träningen …</p>`;
  try {
    await S.data.sparaTrupp(S.uid, ut.K);
  } catch (err) {
    console.warn("Matchdagen: träningslägret kunde inte sparas", err);
    yta.innerHTML = `<p>Träningen är klar men kunde inte sparas än – svaren finns kvar på den här datorn.</p>
      <div class="md-rad"><button type="button" class="md-stor" data-igen>Spara träningen</button></div>`;
    yta.querySelector("[data-igen]").addEventListener("click", () => sparaLagret(S, yta, post, opt));
    return;
  }
  S.K = ut.K;
  rensaLager(S.lagring, S.uid);
  const p = ut.spelare;
  const ratt = post.svar.filter((s) => s.ratt).length;
  yta.innerHTML = `<p><b>Träningen är klar!</b> ${ratt} av ${post.svar.length} rätt. ${esc(p.namn)} har nu ${st(p)}★${st(p) < TRANING.maxSt ? ` och ${xp(p)}/${TRANING.xpPerStjarna} träningspoäng` : " – fullt tränad"}.</p>
    ${ut.stjarnor ? `<p class="md-firande">${firaText(p)}</p>` : ""}
    ${lagerNyckel(S.K)
      ? `<div class="md-rad"><button type="button" class="md-stor" data-nasta>Ett läger till före kvalet</button></div>`
      : `<p class="md-svag">Spela nästa match, så får ni ett nytt träningsläger.</p>`}`;
  yta.querySelector("[data-nasta]")?.addEventListener("click", () => visaLager(S, yta, { ...opt, signal: opt.yttre }));
  opt.klar?.();
}
