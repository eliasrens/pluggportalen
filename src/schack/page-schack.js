// ============================================================================
// Schack – route-skal (src/schack/page-schack.js) · #776 §4
// ----------------------------------------------------------------------------
//   #/elev/schack                 startsidan: Spela mot datorn, kompis/lär dig/pussel (kommer snart)
//   #/elev/schack?vy=dator        partiet mot datorn (fortsätter det sparade; annars nivåval)
//   #/elev/schack?vy=dator&ny=1   nivåval → nytt parti
//
// Routen ligger i app.js med DYNAMISK import (dynSida), så inget i src/schack/
// hamnar i bootgrafen (#271). Modulen är opt-in per klass (STUDENT_MODULES,
// enabledModules) och stängs av fokusläget – grinden i app.js/ui.js släpper bara
// in elever vars klass slagit på schack. Partiet sparas i localStorage per elev
// (schack-parti.js); ingen Firestore-skrivning och inga pluggmynt i Etapp 1.
// ============================================================================

import { app, el, go, getParams, loading, renderTopbar } from "../ui.js";
import { getSession, currentStudentId, getStudentData } from "../data.js";
import { avatarMarkup, DEFAULT_AVATAR } from "../avatars.js";
import { partiNyckel } from "./schack-parti.js";

const HASH = "#/elev/schack";
let aktiv = null;
let lyssnar = false;

function stadaVidByte() {
  if (lyssnar) return;
  lyssnar = true;
  const stada = async () => {
    if (location.hash.startsWith(HASH)) return;
    window.removeEventListener("hashchange", stada);
    lyssnar = false;
    aktiv?.destroy();
    aktiv = null;
    (await import("./schack-flode.js")).stangSchack(); // workern stängs när eleven lämnar schacket
  };
  window.addEventListener("hashchange", stada);
}

export async function pageSchack() {
  aktiv?.destroy();
  aktiv = null;
  loading();
  const sid = currentStudentId();
  if (!sid) return go("#/");
  const [{ visaSchack }, sd] = await Promise.all([
    import("./schack-flode.js"),
    getStudentData().catch(() => ({})),
    renderTopbar(),
  ]);
  const host = el(`<div class="schack-rot"></div>`);
  app.replaceChildren(host);
  aktiv = visaSchack(host, {
    namn: getSession()?.namn || "Du",
    avatarHtml: avatarMarkup(sd?.avatarId || DEFAULT_AVATAR, sd?.avatarItems || []),
    nyckel: partiNyckel(sid),
    go,
    hashBas: HASH,
  }, getParams());
  stadaVidByte();
}
