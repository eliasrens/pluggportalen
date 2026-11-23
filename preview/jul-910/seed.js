// Startdata för preview-jul-910-app.html (#910): #908:s by (vinter-908/seed.js,
// hämtad med ?bas så att importmappen inte pekar tillbaka hit) med Jul PÅ som
// förval och elev1 med 6 000 mynt – nog för ett julhus och några julsaker.
// ?sasong=… följer #908 (vinter med jul = förval här); ?jul=av stänger Jul.
import { SEED as BAS } from "/preview/vinter-908/seed.js?bas";

const q = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
export const SEED = structuredClone(BAS);
if (SEED["config/season"]) SEED["config/season"].jul = q.get("jul") !== "av";
SEED["studentData/elev1"].coins = Number(q.get("mynt")) || 6000;
