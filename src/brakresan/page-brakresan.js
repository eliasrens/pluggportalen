// ============================================================================
// Bråkresan – route-skal (src/brakresan/page-brakresan.js) · #709 D
// ----------------------------------------------------------------------------
//   #/elev/brakresan                 huvudvyn (listan med de 50 utmaningarna)
//   #/elev/brakresan?u=03            utmaningsvyn: före/under/efter omgången (omgang.js)
//   #/elev/brakresan?u=03&lage=test  testomgång helt i klienten (demoBackend) –
//                                     inga anrop, inget sparas (förhandsvisning, K)
// Routen ligger i app.js med DYNAMISK import (dynSida), så inget i
// src/brakresan/ hamnar i bootgrafen (#271).
//
// Huvudvyn här är en ENKEL lista tills H (#713) bygger den riktiga (sök,
// filter, drakpanel, miniatyrer, scrollposition) – H ersätter visaLista.
// ============================================================================

import { app, go, getParams, loading, renderTopbar } from "../ui.js";
import { h } from "./komponenter/bas.js";
import { CHALLENGES, SECTIONS, isChallengeId } from "./schema/katalog.js";
import { challengeStatus } from "./schema/regler.js";
import { loadAllChallenges } from "./utmaningar/index.js";

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
  const [alla, state] = await Promise.all([
    loadAllChallenges(),
    import("./data.js").then((d) => d.getState()).catch(() => null),
  ]);
  const byggd = new Set(alla.filter((c) => c.implemented).map((c) => c.id));
  const total = state?.totalStars ?? 0;
  const rot = h("section", { class: "brv brv-lista" },
    h("header", { class: "brv-huvud" },
      h("h1", { class: "brv-titel" }, "Bråkresan"),
      h("p", { class: "brv-mal" }, "Träna bråk, decimaltal och procent i 50 utmaningar. Tio uppgifter per omgång – 8 rätt ger en stjärna."),
      h("p", { class: "brv-meta" }, `Stjärnor: ${total} av 150`)));
  for (const s of SECTIONS) {
    const lista = h("ol", { class: "brv-utmaningar" });
    rot.append(h("h2", { class: "brv-avsnitt" }, `${s.name} – ungefär årskurs ${s.grade}`), lista);
    for (const c of CHALLENGES.filter((x) => x.section === s.id)) {
      const e = state?.challenges?.[c.id] || {};
      const st = challengeStatus(e);
      const ok = byggd.has(c.id);
      lista.append(h("li", { class: `brv-rad${ok ? "" : " brv-rad--snart"}` },
        h(ok ? "a" : "span", { class: "brv-radlank", href: ok ? `${LISTA}?u=${c.id}` : null },
          h("span", { class: "brv-nr" }, c.id),
          h("span", { class: "brv-radnamn" }, c.name, h("small", null, c.goal)),
          h("span", { class: "brv-radstatus" }, ok ? `${"★".repeat(e.stars || 0)}${"☆".repeat(3 - (e.stars || 0))} ${st.label}` : "Byggs just nu"))));
    }
  }
  host.append(rot);
}
