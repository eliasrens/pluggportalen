// ============================================================================
// Schack – route-skal (src/schack/page-schack.js) · #776 §4, #780 §7
// ----------------------------------------------------------------------------
//   #/elev/schack                    startsidan: mot datorn, mot en kompis, lär dig/pussel (kommer snart)
//   #/elev/schack?vy=dator           partiet mot datorn (fortsätter det sparade; annars nivåval)
//   #/elev/schack?vy=dator&ny=1      nivåval → nytt parti
//   #/elev/schack?vy=kompis          lobbyn "Spela mot en kompis" (#780)
//   #/elev/schack?vy=kompis&parti=X  partiet mot en kompis
//
// Routen ligger i app.js med DYNAMISK import (dynSida), så inget i src/schack/
// hamnar i bootgrafen (#271). Modulen är opt-in per klass (STUDENT_MODULES,
// enabledModules) och stängs av fokusläget – grinden i app.js/ui.js släpper bara
// in elever vars klass slagit på schack. Partiet mot datorn sparas i localStorage
// per elev (schack-parti.js); när det tar slut ökar studentData.schack.datorPartier
// med 1 (EN skrivning). Inga pluggmynt.
//
// Kompisläget (§9, kvoten): klasslistan (namn + avatarer) läses EN gång per besök ur
// classProjections; lobbyn är EN onSnapshot på schackKlass/{classId} och partiet EN
// på schackPartier/{id}. Båda stängs när eleven lämnar schacksidan: route-byte
// (även utloggning, som går till #/), pagehide och byte av inloggad användare.
// ============================================================================

import { app, el, go, getParams, loading, renderTopbar } from "../ui.js";
import { getSession, currentStudentId, getStudentData, getClasses, ensureClassProjection } from "../data.js";
import { avatarMarkup, DEFAULT_AVATAR } from "../avatars.js";
import { partiNyckel } from "./schack-parti.js";

const HASH = "#/elev/schack";
let aktiv = null;
let lyssnar = false;
let besok = null; // { uid, classId, klasslista } – gäller tills eleven lämnar schacksidan

const moln = () => import("./schack-moln.js");

async function stang() {
  aktiv?.destroy();
  aktiv = null;
  besok = null;
  (await import("./schack-flode.js")).stangSchack(); // workern och lobbyns lyssnare stängs
}

function stadaVidByte() {
  if (lyssnar) return;
  lyssnar = true;
  const stada = async () => {
    if (location.hash.startsWith(HASH)) return;
    window.removeEventListener("hashchange", stada);
    window.removeEventListener("pagehide", gomd);
    window.removeEventListener("pageshow", visad);
    lyssnar = false;
    await stang();
  };
  // Fliken stängs/byts (så gott det går): stäng lyssnarna och ta bort en egen väntan.
  const gomd = () => { stang(); };
  // Tillbaka ur bfcache: lyssnarna är stängda – rita om sidan.
  const visad = (e) => { if (e.persisted && location.hash.startsWith(HASH)) pageSchack(); };
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
    besok = { uid: sid, classId: k?.id || null, klasslista: k ? klasslistaFor(k.id, k.studentIds) : null };
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
  }, params);
  stadaVidByte();
}
