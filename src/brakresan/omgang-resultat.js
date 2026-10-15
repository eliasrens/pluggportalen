// ============================================================================
// Bråkresan – omgångens avslutning (src/brakresan/omgang-resultat.js) · #709 D
// ----------------------------------------------------------------------------
// Spec §5 "Avslutning" + §11 "Belöningskänsla":
//   • resultatet ur finishRound (servern avgjorde stjärna/uppmuntran/mynt –
//     klienten visar bara det som verkligen betalats): createResultat (B)
//   • drakens kläckning/nivå nämns kort (animationen hör till I/H)
//   • 0–5 rätt: två relevanta utmaningar att prova (forslag)
//   • genomgång av de felaktiga uppgifterna: modellen, elevens första svar,
//     rätt svar och förklaringen – utan att de blir nya poänggivande frågor
// svarText(task, answer) beskriver ett elevsvar i ord (genomgången, K:s historik).
// ============================================================================

import { createResultat } from "./komponenter/index.js";
import { h } from "./komponenter/bas.js";
import { CHALLENGES, challengeMeta } from "./schema/katalog.js";
import { monteraUppgift, promptNod } from "./omgang-uppgift.js";

/** Två närliggande utmaningar (samma kunskapstagg, tidigare i listan) att prova vid 0–5 rätt. */
export function forslag(challengeId) {
  const meta = challengeMeta(challengeId);
  if (!meta) return [];
  const fore = CHALLENGES.filter((c) => c.nr < meta.nr);
  const samma = fore.filter((c) => c.tags.some((t) => meta.tags.includes(t))).slice(-2).reverse();
  const lista = samma.length >= 2 ? samma : [...samma, ...fore.slice(-2).reverse().filter((c) => !samma.includes(c))].slice(0, 2);
  return lista.map((c) => ({ id: c.id, text: `${c.id}. ${c.name}` }));
}

const brak = (f) => (f?.n === undefined ? "?" : `${f.n || "?"}/${f.d || "?"}`);

/** Elevens svar i ord – aldrig mer än det eleven själv lämnade in. */
export function svarText(task, answer) {
  if (!answer) return "Inget svar";
  return delText(task.answer, task.view, answer) ?? "Ditt svar är sparat.";
}

/** Kortets text (bråk, ord eller "Kort 3" för en bild). */
function kortNamn(cards, id) {
  const i = (cards || []).findIndex((c) => c.id === id);
  const c = cards?.[i];
  if (!c) return String(id);
  if (c.face?.kind === "fraction") return `${c.face.n}/${c.face.d}`;
  return c.face?.text !== undefined ? `"${String(c.face.text).replace(/\.$/, "")}"` : `kort ${i + 1}`;
}

/** Korten i vyn (även inne i en sammansatt vy). */
function allaKort(view) {
  if (view?.cards) return view.cards;
  // Verkstadens val (F #711: elevlösningens rader och förklaringar i 33) som textkort.
  if (view?.fragor) return view.fragor.flatMap((f) => f.options.map((o) => ({ id: o.id, face: { text: o.etikett ? `${o.etikett}: ${o.text}` : o.text } })));
  return (view?.delar || []).flatMap((d) => allaKort(d.view));
}

function delText(spec, view, answer) {
  if (!answer) return null;
  const typ = spec?.type;
  if (typ === "paint") return `Du markerade ${answer.selected?.length ?? 0} av ${spec.parts.length} delar.`;
  if (typ === "select" || typ === "choice") {
    const ids = typ === "select" ? answer.ids || [] : [answer.id];
    const cards = allaKort(view);
    if (view?.component === "tallinje") return `Du valde punkt ${answer.id}.`;
    return `Du valde ${ids.map((id) => kortNamn(cards, id)).join(", ")}.`;
  }
  if (typ === "point") {
    const v = answer.value;
    const t = view.ticks;
    return v ? `Du placerade punkten på streck ${(v.n * t) / v.d} av ${t} från 0.` : "Ingen punkt";
  }
  if (typ === "pairs") return `Du gjorde ${answer.pairs?.length ?? 0} par.`;
  if (typ === "categories") {
    const l = Object.values(answer.bins || {}).map((x) => x.length);
    return `Du lade ${l.join(" + ")} i ${l.length} ${l.length === 1 ? "grupp" : "grupper"}.`;
  }
  if (typ === "order") return "Du ordnade korten.";
  if (typ === "multi") {
    // Varje del som ett verb + värde; bara tal → "Du skrev 2/4, 1/4, 3/4."
    const delar = Object.entries(spec.parts).map(([id, s]) => {
      const a = answer.parts?.[id];
      if (!a) return null;
      if (!s?.type || s.type === "number") return { verb: "skrev", text: a.fields ? brak(a.fields) : a.text ?? "" };
      if (s.type === "relation") return { verb: "valde", text: a.value };
      const t = delText(s, view, a)?.replace(/^Du (\S+) /, "").replace(/\.$/, "");
      return t ? { verb: delText(s, view, a).split(" ")[1], text: t } : null;
    }).filter(Boolean);
    if (delar.every((d) => d.verb === "skrev")) return `Du skrev ${delar.map((d) => d.text).join(", ")}.`;
    return `Du ${delar.map((d) => `${d.verb} ${d.text}`).join(" och ")}.`;
  }
  if (typ === "number") return `Du skrev ${answer.fields ? brak(answer.fields) : answer.text ?? ""}.`;
  if (typ === "relation" || typ === "yesno") return `Du svarade ${String(answer.value)}.`;
  return null;
}

/**
 * @param {HTMLElement} host
 * @param {{ fin, round, challengeId, demo, onNy, onTillbaka, onOppna(id) }} o
 *   fin = finishRound-svaret, round = omgångsdokumentet (tasks + answers med reveal)
 */
export async function visaResultat(host, { fin, round, challengeId, demo = false, onNy, onTillbaka, onOppna }) {
  const reward = fin.reward || { kind: "ingen", coins: 0 };
  const starsBefore = demo ? 0 : Math.max(0, (fin.stars ?? 0) - (reward.kind === "stjarna" ? 1 : 0));
  const results = round.answers.map((a) => a.first?.correct === true);
  const fs = forslag(challengeId);
  const actions = [
    { label: reward.kind === "repetition" ? "Repetera igen" : "Ny omgång", primary: true, onClick: onNy },
    ...(fin.correctCount <= 5 ? fs.map((f) => ({ label: `Prova ${f.text}`, onClick: () => onOppna?.(f.id) })) : []),
    { label: "Tillbaka till Bråkresan", onClick: onTillbaka },
  ];
  const yta = h("div", { class: "brv-resultat" });
  host.append(yta);
  await createResultat(yta, {
    correct: fin.correctCount, reward, starsBefore, results, suggestions: fs.map((f) => f.text),
    message: demo ? fin.message : null,
  }, { actions });
  const extra = [];
  // Stjärnans "+40 mynt" visas redan av resultatet; uppmuntran ska heta "10 mynt för ditt arbete" (§2).
  if (fin.rewardText && reward.kind === "uppmuntran") extra.push(fin.rewardText);
  if (fin.dragon?.hatched) extra.push("Ditt drakägg har kläckts! 🐉 Titta på draken i Bråkresan.");
  else if (fin.dragon?.levelAfter > fin.dragon?.levelBefore) extra.push(`Din drake växte till nivå ${fin.dragon.levelAfter}!`);
  if (fin.coinsAfter != null && reward.coins > 0) extra.push(`Du har nu ${fin.coinsAfter} mynt.`);
  if (extra.length) yta.querySelector(".br-resultat-text")?.after(...extra.map((t) => h("p", { class: "brv-belopp" }, t)));

  const fel = round.answers.map((a, i) => ({ a, t: round.tasks[i], i })).filter((x) => x.a.first && !x.a.first.correct);
  if (!fel.length) return;
  const lista = h("ol", { class: "brv-genomgang-lista" });
  const sek = h("section", { class: "brv-genomgang", "aria-label": "Genomgång" },
    h("h3", null, "Genomgång av det som blev fel"),
    h("p", { class: "brv-svag" }, "Titta på varje uppgift i lugn och ro. Genomgången ger inga nya poäng."), lista);
  host.append(sek);
  for (const { a, t, i } of fel) {
    const modell = h("div", { class: "brv-genomgang-modell" });
    const li = h("li", { class: "brv-genomgang-uppgift" },
      h("h4", null, `Uppgift ${i + 1}`), promptNod(t.prompt), modell,
      h("p", null, h("strong", null, "Ditt första svar: "), svarText(t, a.first.answer)),
      a.reveal?.display ? h("p", null, h("strong", null, "Rätt: "), promptNod(a.reveal.display, "span", "")) : null,
      a.reveal?.review ? promptNod(a.reveal.review, "p", "brv-review") : null);
    lista.append(li);
    try {
      const m = await monteraUppgift(modell, t, { interactive: false, size: "kort" });
      if (a.first.answer) m.setAnswer?.(a.first.answer);
    } catch {
      modell.remove();
    }
  }
}
