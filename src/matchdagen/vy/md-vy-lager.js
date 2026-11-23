// ============================================================================
// Matchdagen (#871, Etapp 2b): TRÄNINGSLÄGRET i Truppen (spec §8.4). Upp till tre läger
// per spelad omgång (#883, md-trupp.js lagerNyckel – "Träningsläger 2/3"): eleven väljer
// en startspelare med färre än 5 stjärnor och svarar på 8 frågor – 12 träningspoäng
// per rätt, vid 50/100/250/500 en stjärna till ("Selma Lind fick en stjärna till!").
//
// Varje svar sparas lokalt SÅ FORT det är givet (md-lokal.js sparaLager, vidSvar före
// pausen som visar rätt svar) – en omladdning fortsätter på nästa fråga och ger aldrig
// en ny chans på samma (#870 F1). Lägret märks som påbörjat på servern innan första
// frågan (md-trupp.js lagerStart, EN skrivning): finns det inga sparade svar när eleven
// kommer tillbaka (lokal lagring rensad, en annan dator) räknas lägret som använt
// (lagerAvbrutet) – aldrig ett nytt läger. När alla 8 är besvarade sparas lägret med EN
// skrivning (md-data.js sparaTrupp). Matchen väntar tills lägret är sparat (md-vy-match.js).
//
//   visaLager(S, yta, { signal, klar }) – klar() ritar om korten när lägret är sparat
// Ett nytt anrop för samma yta avbryter det förra (aldrig två frågeslingor samtidigt), och
// en fråga som avbryts av ett flikbyte visas igen när eleven kommer tillbaka (S.lagerFraga)
// – att byta flik ska inte hoppa över en svår fråga. Köp/byten och lägrets start väntar på
// varandra (S.truppUpptagen).
// ============================================================================

import { TRANING } from "../delat/md-config.js";
import { lagerAvbrutet, lagerNummer, lagerNyckel, lagerPaborjat, lagerResultat, lagerStart, tranaSpelare, xpTill } from "../delat/md-trupp.js";
import { pagaendeLager, rensaLager, sparaLager } from "../md-lokal.js";
import { sparaKon } from "../md-spara.js";
import { esc, vanta } from "./md-vy-delat.js";
import { hinderMatch, stjarnor, traningsStapel } from "./md-vy-marknad.js";
import { strom } from "./md-strom.js";

const st = (p) => Math.min(5, Math.max(0, Math.round(Number(p?.st) || 0)));
const xp = (p) => Math.min(xpTill(st(p)), Math.max(0, Math.round(Number(p?.xp) || 0)));
const FIRA_MS = 1400;

/** Texten när inget läger är ledigt (pure – testas i node). */
export function lagerStangtText(K) {
  if (!(Number(K?.liga?.omg) > 0)) return "Spela första matchen, så öppnar träningslägret.";
  if (K.kval?.spelad) return "Kvalet är spelat. Nästa säsong öppnar träningslägret igen.";
  if (String(K.lager ?? "").endsWith("-k")) return "Laget har tränat inför kvalet. Nästa säsong öppnar träningslägret igen."; // äldre nyckel (före #883)
  return `Laget har tränat i alla ${TRANING.perOmgang} träningsläger den här omgången. Spela nästa match, så får ni nya.`;
}
/** "Träningsläger 2/3" för nyckeln (kvalets äldre extra läger: bara "Träningsläger"). */
export function lagerRubrik(nyckel) {
  const n = lagerNummer(nyckel);
  return n ? `Träningsläger ${n}/${TRANING.perOmgang}` : "Träningsläger";
}
/** Inget läger ledigt: texten – och efter en spelad omgång en avstängd knapp (alla läger använda). */
export function stangtHtml(K) {
  const knapp = Number(K?.liga?.omg) > 0 ? `<div class="md-rad"><button type="button" class="md-stor" disabled>Starta träningen</button></div>` : "";
  return `<p class="md-svag">${esc(lagerStangtText(K))}</p>${knapp}`;
}
/** Poängen till varje stjärna: "50, 100, 250 och 500". */
const KOSTNADER = Object.values(TRANING.xpTillStjarna).join(", ").replace(/, (\d+)$/, " och $1");
/** "Selma Lind fick en stjärna till!" (§8.4) – html-säker. */
export const firaText = (p) => `${esc(p.namn)} fick en stjärna till!`;
export const AVBRUTET_TEXT = "Träningslägret avbröts innan det var klart – det räknas som använt.";

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
  const pagar = pagaendeLager(S);
  if (pagar) return korLager(S, yta, pagar, opt);
  if (lagerPaborjat(S.K)) return avbrutet(S, yta, opt);
  const nyckel = lagerNyckel(S.K);
  if (!nyckel) {
    yta.innerHTML = stangtHtml(S.K);
    return;
  }
  const kandidater = S.K.trupp.filter((p) => st(p) < TRANING.maxSt);
  if (!kandidater.length) {
    yta.innerHTML = `<p class="md-svag">Hela startelvan har fem stjärnor – laget är fullt tränat!</p>`;
    return;
  }
  yta.innerHTML = `<p><b>${esc(lagerRubrik(nyckel))}</b></p>
    <p>Välj en spelare och svara på ${TRANING.fragor} frågor. Varje rätt svar ger spelaren ${TRANING.xpPerRatt} träningspoäng. En stjärna till kostar ${KOSTNADER} poäng – ju fler stjärnor, desto svårare. Upp till ${TRANING.perOmgang} läger mellan varje match.</p>
    <div class="md-rad">
      <select class="md-lagerval" aria-label="Spelare att träna">${kandidater.map((p) =>
        `<option value="${esc(p.id)}">${esc(p.namn)} (${st(p)}★, ${xp(p)}/${xpTill(st(p))})</option>`).join("")}</select>
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
      fel.textContent = kon ? "Det här träningslägret är redan använt – ladda om sidan." : "Den senaste matchen är inte sparad än. Prova igen när datorn har kontakt med servern.";
      return;
    }
    // Påbörjat på servern FÖRE första frågan – går skrivningen inte fram startar lägret inte.
    const startat = lagerStart(S.K);
    try {
      await S.data.sparaTrupp(S.uid, startat);
    } catch (err) {
      console.warn("Matchdagen: träningslägret kunde inte startas", err);
      S.truppUpptagen = false;
      knapp.disabled = false;
      fel.textContent = "Träningen kunde inte startas. Prova igen när datorn har kontakt med servern.";
      return;
    }
    S.K = startat;
    const post = { v: 1, nyckel, spelareId: yta.querySelector(".md-lagerval").value, svar: [], sek: 0 };
    sparaLager(S.lagring, S.uid, post);
    S.lagerMinne = post;
    S.truppUpptagen = false;
    // Utan lokal lagring (privat fönster) körs lägret i minnet (S.lagerMinne, tills sidan laddas om).
    return korLager(S, yta, pagaendeLager(S) || post, opt);
  });
}

/** Påbörjat på servern men inga sparade svar här: lägret räknas som använt (EN skrivning, ingen träning). */
async function avbrutet(S, yta, opt) {
  yta.innerHTML = `<p class="md-svag" role="status">${esc(AVBRUTET_TEXT)}</p>`;
  const K = lagerAvbrutet(S.K);
  try {
    await S.data.sparaTrupp(S.uid, K);
  } catch (err) {
    // Lägret startar ändå inte – nästa gång Truppen visas sparas det igen.
    console.warn("Matchdagen: det avbrutna träningslägret kunde inte sparas", err);
    return;
  }
  S.K = K;
  if (opt.signal?.aborted || !lagerNyckel(S.K)) return;
  // Ett läger till är fortfarande ledigt i omgången.
  yta.innerHTML += `<div class="md-rad"><button type="button" class="md-stor" data-nasta>Nästa träningsläger (${esc(lagerRubrik(lagerNyckel(S.K)))})</button></div>`;
  yta.querySelector("[data-nasta]").addEventListener("click", () => visaLager(S, yta, { ...opt, signal: opt.yttre }));
}

/** Frågorna som är kvar (en omladdning fortsätter där eleven var), sedan sparningen. */
async function korLager(S, yta, post, opt) {
  S.lagerMinne = post;
  const bas = S.K.trupp.find((p) => p.id === post.spelareId);
  const spelaren = () => post.svar.reduce((p, s) => tranaSpelare(p, s.ratt).p, bas);
  if (post.svar.length < TRANING.fragor) {
    const fr = await strom(S);
    if (fr.tom) { yta.innerHTML = `<p class="md-svag">${esc(fr.meddelande || "Inga frågor än")}</p>`; return; }
    const { visaFraga, klockaFor } = await import("../md-svar.js");
    while (post.svar.length < TRANING.fragor) {
      if (opt.signal?.aborted) return;
      const p = spelaren();
      yta.innerHTML = `<div class="md-lager-huvud">
        <p>${esc(lagerRubrik(post.nyckel))} · <b>${esc(p.namn)}</b> tränar · fråga ${post.svar.length + 1} av ${TRANING.fragor}</p>
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
        ratta: fr.ratta, klocka: klockaFor(S.inst.klocka, fraga), signal: opt.signal,
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
    S.lagerMinne = null;
    yta.innerHTML = stangtHtml(S.K);
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
  S.lagerMinne = null;
  const p = ut.spelare;
  const ratt = post.svar.filter((s) => s.ratt).length;
  yta.innerHTML = `<p><b>Träningen är klar!</b> ${ratt} av ${post.svar.length} rätt. ${esc(p.namn)} har nu ${st(p)}★${st(p) < TRANING.maxSt ? ` och ${xp(p)}/${xpTill(st(p))} träningspoäng mot nästa stjärna` : " – fullt tränad"}.</p>
    ${ut.stjarnor ? `<p class="md-firande">${firaText(p)}</p>` : ""}
    ${lagerNyckel(S.K)
      ? `<div class="md-rad"><button type="button" class="md-stor" data-nasta>Nästa träningsläger (${esc(lagerRubrik(lagerNyckel(S.K)))})</button></div>`
      : stangtHtml(S.K)}`;
  yta.querySelector("[data-nasta]")?.addEventListener("click", () => visaLager(S, yta, { ...opt, signal: opt.yttre }));
  opt.klar?.();
}
