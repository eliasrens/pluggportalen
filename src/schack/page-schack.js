// ============================================================================
// Schack – route-skal (src/schack/page-schack.js) · #776 §4, #780 §7
// ----------------------------------------------------------------------------
//   #/elev/schack                    startsidan: mot datorn, mot en kompis, lär dig, pussel
//   #/elev/schack?vy=dator           partiet mot datorn (fortsätter det sparade; annars nivåval)
//   #/elev/schack?vy=dator&ny=1      nivåval → nytt parti
//   #/elev/schack?vy=kompis          lobbyn "Spela mot en kompis" (#780)
//   #/elev/schack?vy=kompis&parti=X  partiet mot en kompis
//   #/elev/schack?vy=lar(&lektion=N) guiden "Lär dig schack" (#790) – framstegen i
//                                    studentData.schack.lektioner, EN skrivning per
//                                    förbättrad lektion (schack-moln.js lektionKlar)
//   #/elev/schack?vy=pussel(&sort=…) pusslen (#791) – framstegen i studentData.schack.pussel,
//                                    EN skrivning per NYTT löst pussel (schack-moln.js pusselLost)
//
// Routen ligger i app.js med DYNAMISK import (dynSida), så inget i src/schack/
// hamnar i bootgrafen (#271). Modulen är opt-in per klass (STUDENT_MODULES,
// enabledModules) och stängs av fokusläget – grinden i app.js/ui.js släpper bara
// in elever vars klass slagit på schack. Partiet mot datorn sparas i localStorage
// per elev (schack-parti.js); när det tar slut ökar studentData.schack.datorPartier
// med 1 (EN skrivning).
//
// Pluggmynten (#798, docs/SCHACK.md §18): bara servern betalar (callables i schack-moln.js
// – första vinsten per nivå mot datorn, 5 per lektion, 5 per pussel). Kvittot
// schackMynt/{uid} läses EN gång per besök (bockarna), och bara när en vy behöver det;
// efter en utbetalning läses studentData om (saldot i sidomenyn). Bara elever med en
// klass där schack är påslaget – samma grind som servern.
//
// Utloggning: ui.js väntar på window.__ppSchackLamna (högst 1,5 s) innan signOut, så att
// en egen väntan hinner tas bort. Flikstängning (pagehide) försöker också, men webbläsaren
// avbryter oftast anropet – då försvinner väntan efter 10 min (servern filtrerar den).
//
// Kompisläget (§9, kvoten): klasslistan (namn + avatarer) läses EN gång per besök ur
// classProjections; lobbyn är EN onSnapshot på schackKlass/{classId} och partiet EN
// på schackPartier/{id}. Båda stängs när eleven lämnar schacksidan: route-byte
// (även utloggning, som går till #/), pagehide och byte av inloggad användare.
// ============================================================================

import { app, el, go, getParams, loading, renderTopbar } from "../ui.js";
import { getSession, currentStudentId, getStudentData, getClasses, ensureClassProjection, invalidateStudentData } from "../data.js";
import { avatarMarkup, DEFAULT_AVATAR } from "../avatars.js";
import { partiNyckel } from "./schack-parti.js";

const HASH = "#/elev/schack";
let aktiv = null;
let lyssnar = false;
let besok = null; // { uid, classId, klasslista, mynt } – gäller tills eleven lämnar schacksidan

const moln = () => import("./schack-moln.js");
const LAMNA_MAX_MS = 1_500; // utloggningen väntar högst så här länge på schackSlutaVanta

async function stang() {
  aktiv?.destroy();
  aktiv = null;
  besok = null;
  return (await import("./schack-flode.js")).stangSchack(); // workern och lobbyns lyssnare stängs
}

/**
 * Utloggning (F1): logga-ut-knappen i ui.js anropar window.__ppSchackLamna FÖRE
 * data.logout(), så att väntan tas bort medan eleven fortfarande är inloggad
 * (efteråt nekar servern anropet och väntan står kvar i 10 min).
 */
function lamnaFore() {
  return Promise.race([stang().catch(() => false), new Promise((r) => setTimeout(() => r(false), LAMNA_MAX_MS))]);
}

function stadaVidByte() {
  if (lyssnar) return;
  lyssnar = true;
  const stada = async () => {
    if (location.hash.startsWith(HASH)) return;
    window.removeEventListener("hashchange", stada);
    window.removeEventListener("pagehide", gomd);
    window.removeEventListener("pageshow", visad);
    if (window.__ppSchackLamna === lamnaFore) delete window.__ppSchackLamna;
    lyssnar = false;
    await stang();
  };
  // Fliken stängs/byts (så gott det går): stäng lyssnarna och ta bort en egen väntan.
  const gomd = () => { stang(); };
  // Tillbaka ur bfcache: lyssnarna är stängda – rita om sidan.
  const visad = (e) => { if (e.persisted && location.hash.startsWith(HASH)) pageSchack(); };
  window.__ppSchackLamna = lamnaFore;
  window.addEventListener("hashchange", stada);
  window.addEventListener("pagehide", gomd);
  window.addEventListener("pageshow", visad);
}

/** Elevens klass med schack påslaget (första i lärarens ordning), annars null. */
function schackKlass(klasser, uid) {
  return (klasser || []).find((c) =>
    Array.isArray(c.studentIds) && c.studentIds.includes(uid) &&
    Array.isArray(c.enabledModules) && c.enabledModules.includes("schack") &&
    !(Array.isArray(c.hiddenModules) && c.hiddenModules.includes("schack"))) || null;
}

/**
 * Klasskompisarna med namn och avatar – EN läsning (classProjections) per besök.
 * Saknas någon i projektionen byggs den posten en gång (self-heal, #231).
 */
function klasslistaFor(classId, studentIds) {
  let p = null;
  return () => (p ||= ensureClassProjection(classId, studentIds || []).then(({ members }) =>
    (studentIds || []).map((uid) => {
      const m = members?.[uid] || {};
      return { uid, namn: m.namn || "Okänd", avatarHtml: avatarMarkup(m.avatarId || DEFAULT_AVATAR, m.avatarItems || []) };
    })).catch(() => []));
}

/**
 * Guidens framsteg (#790): läses ur den redan cachade studentData (ingen egen
 * läsning). En förbättring skrivs i studentData-cachen direkt (så att översikten
 * stämmer vid nästa vybyte utan ny läsning) och sedan med EN skrivning i Firestore.
 */
function guideFor(sd) {
  return {
    lektioner: () => sd?.schack?.lektioner || {},
    spara: async (nr, stjarnor) => {
      if (sd && typeof sd === "object") {
        const s = sd.schack && typeof sd.schack === "object" ? sd.schack : {};
        sd.schack = { ...s, lektioner: { ...(s.lektioner || {}), [String(nr)]: stjarnor } };
      }
      return (await moln()).lektionKlar(nr, stjarnor);
    },
  };
}

/**
 * Pusslens framsteg (#791): som guiden – ur den cachade studentData, och ett nytt
 * löst pussel skrivs i cachen direkt och sedan med EN skrivning i Firestore.
 */
function pusselFor(sd) {
  return {
    framsteg: () => sd?.schack?.pussel || {},
    spara: async (sort, nr) => {
      if (sd && typeof sd === "object") {
        const s = sd.schack && typeof sd.schack === "object" ? sd.schack : {};
        const p = s.pussel && typeof s.pussel === "object" ? s.pussel : {};
        const gammal = p[sort] && typeof p[sort] === "object" ? p[sort] : {};
        sd.schack = { ...s, pussel: { ...p, [sort]: { losta: (gammal.losta || 0) + 1, senast: nr } } };
      }
      return (await moln()).pusselLost(sort, nr);
    },
  };
}

/**
 * Pluggmynten (#798) för ett besök: kvittot läses lat EN gång, anropen går till servern.
 * En utbetalning läser om studentData (nästa getStudentData) och ritar sidomenyns saldo.
 */
function myntFor(sid) {
  let modul = null;
  const m = () => (modul ||= Promise.all([moln(), import("./schack-mynt.js")]));
  let klient = null;
  const lat = (fn) => (...a) => m().then(([mo, sm]) => {
    klient ||= sm.skapaMynt({
      hamtaKvitto: () => mo.lasMyntKvitto(),
      datorVinst: (d) => mo.mynt.datorVinst(d),
      lektion: (d) => mo.mynt.lektion(d),
      pussel: (d) => mo.mynt.pussel(d),
      onBetalt: () => {
        invalidateStudentData(sid);
        renderTopbar().catch(() => {});
      },
    });
    return fn(klient, ...a);
  });
  return {
    nu: () => klient?.nu() ?? null,
    kvitto: lat((k) => k.kvitto()),
    datorVinst: lat((k, parti) => k.datorVinst(parti)),
    lektion: lat((k, nr, losning) => k.lektion(nr, losning)),
    pussel: lat((k, sort, nr, id, drag) => k.pussel(sort, nr, id, drag)),
  };
}

export async function pageSchack() {
  aktiv?.destroy();
  aktiv = null;
  loading();
  const sid = currentStudentId();
  if (!sid) return go("#/");
  const forstaGangen = !besok || besok.uid !== sid;
  const [{ visaSchack }, sd, klasser] = await Promise.all([
    import("./schack-flode.js"),
    getStudentData().catch(() => ({})),
    besok?.uid === sid ? null : getClasses().catch(() => []),
    renderTopbar(),
  ]);
  if (forstaGangen) {
    const k = schackKlass(klasser, sid);
    besok = { uid: sid, classId: k?.id || null, klasslista: k ? klasslistaFor(k.id, k.studentIds) : null, mynt: k ? myntFor(sid) : null };
  }
  const params = getParams();
  const kompis = besok.classId ? { moln, classId: besok.classId, uid: sid, klasslista: besok.klasslista } : null;
  const host = el(`<div class="schack-rot"></div>`);
  app.replaceChildren(host);
  aktiv = visaSchack(host, {
    namn: getSession()?.namn || "Du",
    avatarHtml: avatarMarkup(sd?.avatarId || DEFAULT_AVATAR, sd?.avatarItems || []),
    nyckel: partiNyckel(sid),
    go,
    hashBas: HASH,
    kompis,
    // Bara när eleven kommer in på schacksidan utan vald vy: tillbaka till ett pågående kompisparti.
    fortsattParti: forstaGangen && !params.vy ? sd?.schack?.aktivtParti || null : null,
    onDatorSlut: () => { moln().then((m) => m.datorPartiKlart()).catch(() => {}); },
    guide: guideFor(sd),
    pussel: pusselFor(sd),
    mynt: besok.mynt || undefined,
  }, params);
  stadaVidByte();
}
