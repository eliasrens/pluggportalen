// ============================================================================
// Prov (#741, spec §6–§7): rättningens rena logik – förslagen, bedömningen
// (en elev eller en hel grupp identiska kortsvar), statusen per elev,
// summeringen, tillbakalämningen och elevens resultat. Ingen Firebase/DOM
// (testas i test/prov-rattning.test.js); rättningsvyn (prov-ratta-sida.js)
// och resultatvyn (prov-resultat-vy.js) bygger på den.
//
// rattning/{elevUid} (docs/DATAMODELL.md "Prov"):
//   { elevId, classId, provNamn, fragor: { [fragaId]: { poang, ratt, kommentar?, auto } },
//     totalPoang, maxPoang, niva, helhetskommentar?, aterlamnad, aterlamnadAt?, facit? }
// En post med auto: true är ett FÖRSLAG – det räknas inte som rättat förrän
// läraren godkänner eller ändrar det (§6.3).
// ============================================================================

import { arFraga, fragetyp } from "./prov-fragetyper.js";
import { NIVAER, autoForslag, fragaNummer, maxPoang } from "./prov-modell.js";
import { delpoang } from "./prov-rattning.js";

/** Status per elev (§6.3) – i den ordningen. */
export const ELEV_STATUS = Object.freeze({ EJ: "ej", DELVIS: "delvis", RATTAD: "rattad", TILLBAKA: "tillbaka" });
export const ELEV_STATUS_NAMN = Object.freeze({
  ej: "Ej rättad", delvis: "Delvis rättad", rattad: "Rättad", tillbaka: "Tillbakalämnad",
});

/** Bedömningarna med ikon och text (aldrig bara färg, §7). */
export const BEDOMNINGAR = Object.freeze([
  { ratt: true, id: "ratt", namn: "Rätt", ikon: "✓", tangent: "1" },
  { ratt: "delvis", id: "delvis", namn: "Delvis rätt", ikon: "½", tangent: "2" },
  { ratt: false, id: "fel", namn: "Fel", ikon: "✗", tangent: "3" },
]);
/** Tangentbordet i rättningen (§6.1): 1 = rätt, 2 = delvis, 3 = fel. */
export const TANGENT_RATT = Object.freeze({ 1: true, 2: "delvis", 3: false });

const arRatt = (v) => v === true || v === false || v === "delvis";
export const bedomning = (ratt) => BEDOMNINGAR.find((b) => b.ratt === ratt) || null;

/** Har läraren bedömt posten (inte bara ett automatiskt förslag)? */
export const arBedomd = (post) => !!post && post.auto !== true && arRatt(post.ratt);
/** Är posten ett förslag som väntar på läraren? */
export const arForslag = (post) => !!post && post.auto === true && arRatt(post.ratt);

/** Frågorna som rättas (inte textblocken). */
export const rattFragor = (fragor) => (fragor || []).filter(arFraga);

/** Elevens status (§6.3) för en rättning (eller null = ingen rättning än). */
export function elevStatus(r, fragor) {
  if (r?.aterlamnad === true) return ELEV_STATUS.TILLBAKA;
  const lista = rattFragor(fragor);
  const n = lista.filter((f) => arBedomd(r?.fragor?.[f.id])).length;
  if (!n) return ELEV_STATUS.EJ;
  return n === lista.length ? ELEV_STATUS.RATTAD : ELEV_STATUS.DELVIS;
}

/** Totalen och maxpoängen (§6.2) – förslagen räknas med, poäng saknas = 0. */
export function summera(r, fragor) {
  let total = 0;
  for (const f of rattFragor(fragor)) {
    const p = Number(r?.fragor?.[f.id]?.poang);
    if (Number.isFinite(p)) total += p;
  }
  return { ...r, totalPoang: Math.round(total * 2) / 2, maxPoang: maxPoang(fragor) };
}

/**
 * Förslagen för en elev (§6.1): typernas automatik, och "fel" för en
 * obesvarad fråga som typen inte rättar själv (fritext). Allt med auto: true.
 */
export function forslagFor(fragor, svar, facit) {
  const ut = autoForslag(fragor, svar, facit);
  for (const f of rattFragor(fragor)) {
    const typ = fragetyp(f.typ);
    if (ut[f.id] || !typ) continue;
    if (!typ.arBesvarad(svar?.[f.id], f)) ut[f.id] = { poang: 0, ratt: false, auto: true };
  }
  return ut;
}

/** En ny rättning med förslagen ifyllda (sparas direkt, §6.3). */
export function nyRattning({ elevId, classId, provNamn, fragor, svar, facit }) {
  return summera({
    elevId, classId, provNamn: provNamn || "", fragor: forslagFor(fragor, svar, facit),
    niva: null, aterlamnad: false,
  }, fragor);
}

/**
 * Fyll i förslag för frågor som saknar en post i en befintlig rättning (t.ex.
 * om den skapades innan eleven lämnade in). Rör aldrig lärarens bedömningar.
 * @returns {{ r: object, andrad: boolean }}
 */
export function kompletteraForslag(r, fragor, svar, facit) {
  const forslag = forslagFor(fragor, svar, facit);
  const fr = { ...(r.fragor || {}) };
  let andrad = false;
  for (const [id, p] of Object.entries(forslag)) {
    if (!fr[id] || (!arRatt(fr[id].ratt) && !fr[id].kommentar)) {
      fr[id] = p;
      andrad = true;
    }
  }
  return { r: andrad ? summera({ ...r, fragor: fr }, fragor) : r, andrad };
}

/** Poängen som följer en bedömning: rätt = max, fel = 0, delvis = halva (eller tidigare delpoäng). */
export function poangFor(ratt, max, tidigare) {
  if (ratt === true) return max;
  if (ratt === false) return 0;
  const t = Number(tidigare);
  return Number.isFinite(t) && t > 0 && t < max ? t : delpoang(0.5, max);
}

/** Bedömningen som följer en poäng: max = rätt, 0 = fel, annars delvis. */
export function rattFor(poang, max) {
  if (poang >= max && max > 0) return true;
  if (poang <= 0) return false;
  return "delvis";
}

/** Poäng 0–max i halva poäng (sifferfältet). null = ogiltig. */
export function tolkaPoang(v, max) {
  const n = Number(String(v ?? "").replace(",", "."));
  if (String(v ?? "").trim() === "" || !Number.isFinite(n)) return null;
  return Math.min(max, Math.max(0, Math.round(n * 2) / 2));
}

export const KOMMENTAR_MAX = 1000;
export const HELHET_MAX = 4000;

/**
 * Lärarens bedömning av en fråga hos en elev. `andring` = { ratt?, poang?, kommentar? }.
 * Ny bedömning eller poäng → auto: false (läraren har bestämt). En kommentar
 * ensam ändrar inte bedömningen (ett förslag förblir ett förslag).
 * @returns ny rättning (summerad)
 */
export function bedom(r, fraga, andring, fragor) {
  const max = Number(fraga.poang) || 0;
  const fore = r.fragor?.[fraga.id] || {};
  const post = { ...fore };
  if ("ratt" in andring && arRatt(andring.ratt)) {
    post.ratt = andring.ratt;
    post.poang = "poang" in andring && andring.poang != null ? andring.poang : poangFor(andring.ratt, max, fore.ratt === "delvis" ? fore.poang : null);
    post.auto = false;
  } else if ("poang" in andring && andring.poang != null) {
    post.poang = Math.min(max, Math.max(0, andring.poang));
    post.ratt = rattFor(post.poang, max);
    post.auto = false;
  }
  if ("kommentar" in andring) {
    const k = String(andring.kommentar ?? "").trim().slice(0, KOMMENTAR_MAX);
    if (k) post.kommentar = k;
    else delete post.kommentar;
  }
  if (post.auto === undefined) post.auto = false;
  return summera({ ...r, fragor: { ...r.fragor, [fraga.id]: post } }, fragor);
}

/** Godkänn förslaget på en fråga (auto → false). Oförändrad om inget förslag. */
export function godkann(r, fragaId) {
  const p = r.fragor?.[fragaId];
  if (!arForslag(p)) return r;
  return { ...r, fragor: { ...r.fragor, [fragaId]: { ...p, auto: false } } };
}

/** Alla elevens förslag godkända (per elev-läget). */
export function godkannAlla(r, fragor) {
  return rattFragor(fragor).reduce((acc, f) => godkann(acc, f.id), r);
}

/**
 * Svaren på en fråga i rättningsvyn (§6.1). Kortsvar och luckor (typer med
 * gruppNyckel) grupperas efter normalisering – "Birka – 12 elever" – störst
 * först; andra typer får en rad per elev i elevernas ordning.
 * @param {object} fraga  tillfällets fråga
 * @param {string[]} elevIds  eleverna som rättas, i visningsordning
 * @param {(uid: string) => any} svarAv  elevens svar på frågan
 * @param {object} [facit]  privat/facit.facit[fraga.id]
 * @returns {{ nyckel: string, elever: string[], svar: any, grupp: boolean }[]}
 */
export function svarsGrupper(fraga, elevIds, svarAv, facit) {
  const typ = fragetyp(fraga.typ);
  if (!typ?.gruppNyckel) return elevIds.map((uid) => ({ nyckel: uid, elever: [uid], svar: svarAv(uid), grupp: false }));
  const per = new Map();
  for (const uid of elevIds) {
    const svar = svarAv(uid);
    const k = typ.arBesvarad(svar, fraga) ? typ.gruppNyckel(svar, fraga, facit) : "";
    if (!per.has(k)) per.set(k, { nyckel: k, elever: [], svar, grupp: true });
    per.get(k).elever.push(uid);
  }
  // Störst först; obesvarade sist.
  return [...per.values()].sort((a, b) => (a.nyckel === "") - (b.nyckel === "") || b.elever.length - a.elever.length || a.nyckel.localeCompare(b.nyckel, "sv"));
}

/**
 * Bedöm en hel grupp (§6.1: "bedömningen gäller alla i gruppen"). Elever vars
 * prov redan lämnats tillbaka hoppas över (ångra först).
 * @returns {string[]} eleverna som ändrades (ska sparas)
 */
export function bedomGrupp(rattningar, elevIds, fraga, andring, fragor) {
  const andrade = [];
  for (const uid of elevIds) {
    const r = rattningar[uid];
    if (!r || r.aterlamnad) continue;
    rattningar[uid] = bedom(r, fraga, andring, fragor);
    andrade.push(uid);
  }
  return andrade;
}

/** "Godkänn alla förslag på den här frågan" (§6.1) → eleverna som ändrades. */
export function godkannFraga(rattningar, elevIds, fragaId) {
  const andrade = [];
  for (const uid of elevIds) {
    const r = rattningar[uid];
    if (!r || r.aterlamnad || !arForslag(r.fragor?.[fragaId])) continue;
    rattningar[uid] = godkann(r, fragaId);
    andrade.push(uid);
  }
  return andrade;
}

/**
 * Gruppens gemensamma post, eller null om eleverna bedömts olika ("blandat").
 * Samma bedömning där några är godkända och några förslag = ett förslag
 * (auto: true) – läraren behöver bara bekräfta.
 */
export function gruppPost(rattningar, elevIds, fragaId) {
  const poster = elevIds.map((uid) => rattningar[uid]?.fragor?.[fragaId] || null);
  const forsta = poster[0];
  const lika = (a, b) => (a?.ratt ?? null) === (b?.ratt ?? null) && (a?.poang ?? null) === (b?.poang ?? null) &&
    (a?.kommentar || "") === (b?.kommentar || "");
  if (!poster.every((p) => lika(p, forsta))) return null;
  return forsta && poster.some((p) => p?.auto === true) ? { ...forsta, auto: true } : forsta;
}

/** Hur många förslag väntar på frågan? */
export const forslagPaFraga = (rattningar, elevIds, fragaId) =>
  elevIds.filter((uid) => !rattningar[uid]?.aterlamnad && arForslag(rattningar[uid]?.fragor?.[fragaId])).length;

/** Är frågan färdigbedömd för alla (inte tillbakalämnade) elever? */
export const fragaKlar = (rattningar, elevIds, fragaId) =>
  elevIds.every((uid) => rattningar[uid]?.aterlamnad || arBedomd(rattningar[uid]?.fragor?.[fragaId]));

/**
 * Räkneverket på tillfället (tillfället.rattStatus, visas i Provtillfällen):
 * { antal, rattade, tillbaka } – rattade räknar även tillbakalämnade.
 */
export function rattStatusSumma(elevIds, rattningar, fragor) {
  let rattade = 0;
  let tillbaka = 0;
  for (const uid of elevIds) {
    const s = elevStatus(rattningar[uid], fragor);
    if (s === ELEV_STATUS.TILLBAKA) tillbaka++;
    if (s === ELEV_STATUS.TILLBAKA || s === ELEV_STATUS.RATTAD) rattade++;
  }
  return { antal: elevIds.length, rattade, tillbaka };
}

/** "18 av 24 rättade" (+ " · 10 tillbakalämnade"). */
export function rattStatusText(s) {
  if (!s?.antal) return "";
  return `${s.rattade} av ${s.antal} rättade${s.tillbaka ? ` · ${s.tillbaka} tillbakalämnade` : ""}`;
}

/**
 * "Lämna tillbaka till alla rättade" (§7): färdigrättade lämnas tillbaka,
 * de andra hoppas över och redan tillbakalämnade rörs inte.
 * @returns {{ klara: string[], ejKlara: string[], redan: string[] }}
 */
export function aterlamnaPlan(elevIds, rattningar, fragor) {
  const plan = { klara: [], ejKlara: [], redan: [] };
  for (const uid of elevIds) {
    const s = elevStatus(rattningar[uid], fragor);
    if (s === ELEV_STATUS.TILLBAKA) plan.redan.push(uid);
    else if (s === ELEV_STATUS.RATTAD) plan.klara.push(uid);
    else plan.ejKlara.push(uid);
  }
  return plan;
}

/** "3 elever är inte färdigrättade och lämnas inte tillbaka än." ("" = alla klara). */
export function ejKlaraText(n) {
  if (!n) return "";
  return n === 1
    ? "1 elev är inte färdigrättad och lämnas inte tillbaka än."
    : `${n} elever är inte färdigrättade och lämnas inte tillbaka än.`;
}

/**
 * Rättningsdokumentet som det skrivs vid tillbakalämningen (§7): aterlamnad
 * true och facit BARA om läraren valt "Visa facit". Tiden (aterlamnadAt)
 * sätter datalagret till serverns tid.
 */
export function aterlamnadDok(r, { visaFacit, facit }) {
  const { aterlamnadAt: _a, facit: _f, ...rest } = r;
  const ut = { ...rest, aterlamnad: true };
  if (visaFacit && facit && Object.keys(facit).length) ut.facit = facit;
  return ut;
}

/** Ångra tillbakalämningen (§7): aterlamnad false, facit och tiden bort. */
export function angratDok(r) {
  const { aterlamnadAt: _a, facit: _f, ...rest } = r;
  return { ...rest, aterlamnad: false };
}

/**
 * Rättningen i sparbar form: bara reglernas fält, summerad. `provInfo`
 * (#742, provInfoDok i prov-statistik.js) följer med för statistikfliken "Prov".
 */
export function sparDok(r, fragor, provInfo = null) {
  const s = summera(r, fragor);
  const ut = {
    elevId: s.elevId, classId: s.classId, provNamn: s.provNamn || "",
    fragor: s.fragor || {}, totalPoang: s.totalPoang, maxPoang: s.maxPoang,
    niva: NIVAER.some((n) => n.id === s.niva) ? s.niva : null,
    aterlamnad: s.aterlamnad === true,
  };
  const helhet = String(s.helhetskommentar || "").trim().slice(0, HELHET_MAX);
  if (helhet) ut.helhetskommentar = helhet;
  if (ut.aterlamnad && s.facit) ut.facit = s.facit;
  if (provInfo) ut.provInfo = provInfo;
  return ut;
}

export const nivaNamn = (id) => NIVAER.find((n) => n.id === id)?.namn || "";

/**
 * Elevens resultat (§7 "Elevens resultatvy"): null tills provet lämnats
 * tillbaka. Facit finns bara om läraren valde att visa det (rattning.facit).
 * @param {object} tf   tillfället (frågorna utan facit)
 * @param {object|null} svarDok  elevens svar-dokument
 * @param {object|null} r  elevens rättning
 */
export function resultatModell(tf, svarDok, r) {
  if (!r || r.aterlamnad !== true) return null;
  const fragor = tf?.fragor || [];
  const nr = fragaNummer(fragor);
  const poangsatt = tf?.installningar?.poang !== false;
  const visaFacit = !!r.facit && Object.keys(r.facit).length > 0;
  const summa = summera(r, fragor);
  return {
    namn: tf?.provNamn || r.provNamn || "Prov",
    poangsatt,
    totalPoang: summa.totalPoang,
    maxPoang: summa.maxPoang,
    niva: r.niva || null,
    nivaNamn: nivaNamn(r.niva),
    helhetskommentar: r.helhetskommentar || "",
    visaFacit,
    poster: fragor.map((f) => ({
      fraga: f,
      nr: nr[f.id] ?? null,
      svar: svarDok?.svar?.[f.id],
      post: arFraga(f) ? r.fragor?.[f.id] || null : null,
      facit: visaFacit ? r.facit[f.id] ?? null : null,
    })),
  };
}
