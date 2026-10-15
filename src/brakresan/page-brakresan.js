// ============================================================================
// Bråkresan – route-skal (src/brakresan/page-brakresan.js) · #709 D
// ----------------------------------------------------------------------------
//   #/elev/brakresan                 huvudvyn (huvudvy.js, #713)
//   #/elev/brakresan?u=03            utmaningsvyn: före/under/efter omgången (omgang.js)
//   #/elev/brakresan?u=03&lage=test  testomgång helt i klienten (demoBackend) –
//                                     inga anrop, inget sparas (förhandsvisning, K)
// Routen ligger i app.js med DYNAMISK import (dynSida), så inget i
// src/brakresan/ hamnar i bootgrafen (#271).
//
// Huvudvyn (#713 H): huvudvy.js – lista, sök, filter, "Börja här",
// drakkortet och drakpanelen (drakpanel.js), scrollposition vid återkomst.
// ============================================================================

import { app, go, getParams, loading, renderTopbar } from "../ui.js";
import { currentStudentId, getClasses } from "../data.js";
import { h } from "./komponenter/bas.js";
import { isChallengeId } from "./schema/katalog.js";

let aktiv = null;
let lyssnar = false;
const LISTA = "#/elev/brakresan";

function stadaVidByte() {
  if (lyssnar) return;
  lyssnar = true;
  const stada = () => {
    if (!location.hash.startsWith(LISTA)) {
      aktiv?.destroy?.();
      aktiv = null;
      lyssnar = false;
      window.removeEventListener("hashchange", stada);
    }
  };
  window.addEventListener("hashchange", stada);
}

export async function pageBrakresan() {
  aktiv?.destroy?.();
  aktiv = null;
  loading();
  const { u, lage } = getParams();
  // Elevens omgångar kräver inloggning; testomgången (lage=test) körs helt i klienten.
  if (!currentStudentId() && lage !== "test") return go("#/");
  const [{ ensureOmgangCss }] = await Promise.all([import("./omgang.js"), renderTopbar()]);
  await ensureOmgangCss();
  const host = h("div", { class: "brv-rot" });
  app.replaceChildren(host);
  if (isChallengeId(u)) await visaUtmaning(host, u, lage === "test");
  else await visaLista(host);
  stadaVidByte();
}

async function visaUtmaning(host, id, test) {
  const [{ createUtmaningsvy }, { serverBackend, demoBackend }, { loadChallenge }] = await Promise.all([
    import("./omgang.js"), import("./omgang-backend.js"), import("./utmaningar/index.js")]);
  const ch = await loadChallenge(id);
  if (!ch.implemented) {
    host.append(h("div", { class: "brv" }, h("p", null, `${ch.id}. ${ch.name} är inte klar ännu.`),
      h("button", { type: "button", class: "br-knapp", onclick: () => go(LISTA) }, "Tillbaka")));
    return;
  }
  const backend = test ? demoBackend(id) : await serverBackend(id);
  aktiv = await createUtmaningsvy(host, {
    challengeId: id, backend,
    onBack: () => go(LISTA),
    onOpen: (nytt) => go(`${LISTA}?u=${nytt}${test ? "&lage=test" : ""}`),
    onReward: () => renderTopbar().catch(() => {}), // nytt saldo i sidomenyn
  });
}

async function visaLista(host) {
  const sid = currentStudentId();
  const [data, { createHuvudvy }, { rekommendationer }, klasser] = await Promise.all([
    import("./data.js"), import("./huvudvy.js"), import("./huvudvy-lista.js"),
    getClasses().catch(() => []),
  ]);
  const klassIds = (klasser || []).filter((k) => (k.studentIds || []).includes(sid)).map((k) => k.id);
  const [state, rek] = await Promise.all([
    data.getState(),
    data.getRecommendations(klassIds).then(rekommendationer).catch(() => new Map()),
  ]);
  aktiv = await createHuvudvy(host, {
    state, rek,
    href: (id) => `${LISTA}?u=${id}`,
    drakpanel: {
      byt: data.renameDragon,
      // Kläckningen/evolutionen är visad – progressionen sparades redan av servern.
      onVisad: (niva) => data.ackDragon(niva).catch(() => {}),
    },
  });
}
