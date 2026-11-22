// ============================================================================
// Matchdagen (#871, Etapp 2b): spelarkorten i Truppen – startelvan, reserverna och
// marknaden – och köpen och bytena (spec §8.1–8.3). Korten är rena strängar (testas
// i node, test/matchdagen-trupp-vy.test.js): eleven skriver dokumentet själv, så allt
// ur det escapas eller blir tal (#869 G1, lagrad XSS).
//
//   lagdelarHtml(trupp), startKort(p), reservKort(K, r), marknadKort(K, p)  → html
//   hinderMatch(S) → text | null        en match pågår – inga köp, byten eller läger då
//   kopa(S, id, signal) / bytaIn(S, reservId, truppId) → text till eleven (kastar med .text)
// Ett köp eller byte = EN skrivning (md-data.js sparaTrupp), efter att kön av osparade
// matcher är tom (md-spara.js sparaKon) – annars skulle köpet sparas före matchen det kom ur.
// ============================================================================

import { LAGDELAR, RADDNING, TRANING } from "../delat/md-config.js";
import { lagbonus } from "../delat/md-motor.js";
import { POS_NAMN } from "../delat/md-namn.js";
import { bytIn, kop, kopInfo, lagdelSnitt, saljPris, xpTill } from "../delat/md-trupp.js";
import { cupLage } from "../delat/md-cup.js";
import { mcLage } from "../delat/md-mastarcup.js";
import { lasPagaende } from "../md-lokal.js";
import { sparaKon } from "../md-spara.js";
import { esc, ruta } from "./md-vy-delat.js";

const tal = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
/** "1 210 kr" – alltid ett tal. */
export const kr = (n) => `${tal(n, -1e9, 1e9).toLocaleString("sv-SE")} kr`;
export const stjarnor = (st) => {
  const s = tal(st, 0, 5);
  return `<span class="md-stjarnor" aria-label="${s} av 5 stjärnor">${"★".repeat(s)}${"☆".repeat(5 - s)}</span>`;
};
const posNamn = (pos) => esc(POS_NAMN[pos] || pos);
const namn = (p) => esc(p?.namn);

/** Vad lagdelens bonus påverkar (§8.1) – målvaktens räknas dubbelt i räddningen (md-motor.js chansRaddning). */
const EFFEKT = { MV: "räddningar", "FÖR": "tacklingar", MIT: "pass", ANF: "skott" };
const FAKTOR = { MV: RADDNING.bonus };
const procent = (b) => {
  const n = Math.round(b * 100);
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)} %`;
};

/** Lagdelarna: snittstjärnorna och lagbonusen ((snitt − 2) × 0,05, md-motor.js lagbonus). */
export function lagdelarHtml(trupp) {
  const snitt = lagdelSnitt(trupp);
  const bonus = lagbonus(trupp);
  return `<div class="md-lagdelar">${LAGDELAR.map((d) => `<div>
    <span class="md-pos">${posNamn(d)}</span>
    <b>${snitt[d].toLocaleString("sv-SE", { maximumFractionDigits: 1 })}★</b>
    <small>${EFFEKT[d]} ${procent(bonus[d] * (FAKTOR[d] ?? 1))}</small></div>`).join("")}</div>`;
}

/** Stapeln mot nästa stjärna (§8.4, #883): "143 / 250 till ★★★★" – eller "Fullt tränad" vid 5★. */
export function traningsStapel(p) {
  const st = tal(p.st, 0, 5);
  if (st >= TRANING.maxSt) return `<small class="md-svag">Fullt tränad</small>`;
  const mal = xpTill(st);
  const xp = tal(p.xp, 0, mal - 1);
  const bredd = Math.round((100 * xp) / mal);
  return `<div class="md-stapel" role="progressbar" aria-label="Träning mot ${st + 1} stjärnor" aria-valuemin="0" aria-valuemax="${mal}" aria-valuenow="${xp}"><i style="width:${bredd}%"></i></div>
    <small class="md-svag">${xp} / ${mal} till ${"★".repeat(st + 1)}</small>`;
}

function kort(p, under = "") {
  return `<div class="md-spkort">
    <span class="md-pos">${posNamn(p.pos)}${p.grundpelare === true ? " · Grundpelare" : ""}</span>
    <b>${namn(p)}${p.kapten === true ? ` <span class="md-kapten" title="Lagkapten">C</span>` : ""}</b>
    ${stjarnor(p.st)}<small class="md-svag">Nr ${tal(p.nr, 0, 999)}</small>
    ${under}</div>`;
}

export const startKort = (p) => kort(p, traningsStapel(p));

/** En reserv: byt in den för en startspelare på samma position (§8.2). */
export function reservKort(K, r) {
  const mot = K.trupp.filter((p) => p.pos === r.pos);
  return kort(r, `${traningsStapel(r)}
    <div class="md-kortknappar">${mot.map((p) => `<button type="button" class="md-ghost" data-byt="${esc(r.id)}" data-mot="${esc(p.id)}">Byt in för ${namn(p)}</button>`).join("")}</div>`);
}

const ORSAK = {
  inteBattre: (i) => `Inte bättre än ${namn(i.ersatt)} (${tal(i.ersatt.st, 0, 5)}★)`,
  kassa: (i, K) => `Kassan räcker inte – ${kr(K.kassa)} i klubbkassan`,
  reserverFulla: () => "Reserverna är fulla med grundpelare – de säljs aldrig",
  position: () => "Ingen i startelvan på den positionen",
  saknas: () => "Inte till salu längre",
};

/** En spelare till salu: priset, vem hen ersätter (den sämsta på positionen) – eller varför det inte går. */
export function marknadKort(K, p) {
  const i = kopInfo(K, p.id);
  const pris = `Köp för ${kr(i.kostnad ?? 0)}`;
  const under = i.kan
    ? `<button type="button" class="md-kop" data-kop="${esc(p.id)}">${pris}</button>
       <small class="md-svag">Ersätter ${namn(i.ersatt)}${i.tillReserv ? " – grundpelaren går till reserverna" : ` – som säljs för ${kr(i.aterbetalning)}`}</small>`
    : `<button type="button" class="md-kop" disabled>${pris}</button><small class="md-svag">${ORSAK[i.orsak](i, K)}</small>`;
  return kort(p, under);
}

/** En pågående match (också en sparad lokalt efter omladdning) stoppar köp, byten och träningsläger. */
export function hinderMatch(S) {
  const pagar = S.spel?.pagar || ["liga", "kval"].some((typ) => lasPagaende(S.lagring, S.uid, S.K, typ)) ||
    !!lasPagaende(S.lagring, S.uid, S.K, "cup", cupLage(S.K).spelade) ||
    !!lasPagaende(S.lagring, S.uid, S.K, "mastarcup", mcLage(S.K).spelade); // #873
  return pagar ? "Spela klart matchen först – den väntar under Match." : null;
}

/** Spara ett köp eller byte: först kön av osparade matcher, sedan EN skrivning. Kastar med .text. */
async function sparaAndring(S, K2) {
  if (!(await sparaKon(S))) {
    throw Object.assign(new Error("kön"), { text: "Den senaste matchen är inte sparad än. Prova igen när datorn har kontakt med servern." });
  }
  try {
    await S.data.sparaTrupp(S.uid, K2);
  } catch (err) {
    console.warn("Matchdagen: truppen kunde inte sparas", err);
    throw Object.assign(new Error("spara"), { text: "Kunde inte spara just nu – prova igen, eller ladda om sidan." });
  }
  S.K = K2;
  S.kassa?.();
}

/**
 * Köpet (§8.3). Är reserverna fulla och en grundpelare ska dit väljer eleven först vem
 * som släpps (bara köpta spelare). @returns text till eleven, eller null (avbrutet)
 */
export async function kopa(S, id, signal) {
  const info = kopInfo(S.K, id);
  if (!info.kan) return null;
  let slapp = null;
  if (info.masteSlappa) {
    slapp = await ruta(S.host, {
      rubrik: "Reserverna är fulla",
      html: `<p>${namn(info.ny)} tar platsen från ${namn(info.ersatt)}, som flyttas till reserverna. Välj vem som släpps – hen säljs för halva priset.</p>`,
      knappar: [...info.slappbara.map((r) => ({ id: r.id, text: `Släpp ${r.namn} (+${kr(saljPris(r.st))})` })), { id: "", text: "Avbryt" }],
    }, signal);
    if (!slapp) return null;
  }
  const r = kop(S.K, id, { slapp });
  await sparaAndring(S, r.K);
  const salda = r.salda.map((s) => `${namn(s)} såldes för ${kr(s.belopp)}.`).join(" ");
  return `${namn(info.ny)} är köpt för ${kr(info.kostnad)}!${info.tillReserv ? ` ${namn(info.ersatt)} sitter bland reserverna.` : ""} ${salda}`.trim();
}

/** Bytet (§8.2): reserven och startspelaren byter plats. @returns text till eleven */
export async function bytaIn(S, reservId, truppId) {
  const r = S.K.reserver.find((p) => p.id === reservId);
  const t = S.K.trupp.find((p) => p.id === truppId);
  await sparaAndring(S, bytIn(S.K, reservId, truppId));
  return `${namn(r)} spelar nu i stället för ${namn(t)}.`;
}
