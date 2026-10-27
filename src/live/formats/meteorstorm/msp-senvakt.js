// ============================================================================
// Meteorstormen – projektorns SENVAKT (#822 F1, Elias 2026-10-21: bufferten är
// KONSTANT, RENDER_FORDROJNING_MS = 2 s). Ren, node-testad.
//
// Händelseloggen går från msEvents-dokumenten till motorns handlingar här. En
// händelse som når projektorn EFTER att dess tid redan visats (leveransen tog
// längre än bufferten – utanför specen) får aldrig ändra det som redan syntes:
// den stämplas om till "strax efter det som visats" (visad + 1 ms) och verkar
// därifrån. En meteor som redan flugit vidare fortsätter flyga; den sena
// dragstrålen fångar nästa, den sena skölden fyller på från nu. Omstämplingen
// minns per händelse, så varje senare ögonblicksbild ger samma logg. Två
// projektorer kan då skilja sig åt (de visade olika långt) tills slutrutan –
// slutet är alltid serverns msAvsluta-result. Första ögonblicksbilden är
// historiken (en projektor som öppnas mitt i matchen) och stämplas aldrig om.
// Leveranstiden (ankomst på den server-korrigerade klockan − händelsens t)
// mäts för QA (stat).
//
//   skapaSenvakt() → {
//     las(events, visadT, ankomstMs) → handlingar (motorns, med omstämplingarna)
//     stat()  → { sena, n, median, p95, max } (sena = omstämplade handlingar)
//   }
// ============================================================================

import { handlingarUr } from "./msp-scen.js";

const FONSTER = 400;
const kvantil = (s, q) => s[Math.min(s.length - 1, Math.floor(s.length * q))];

export function skapaSenvakt() {
  const kanda = new Set();
  const omstamplade = new Map(); // id → t på den här projektorn
  const prov = [];
  let forsta = true;
  return {
    las(events, visadT, ankomstMs) {
      for (const e of events || []) {
        if (!e?.id || kanda.has(e.id)) continue;
        kanda.add(e.id);
        if (forsta || !Number.isFinite(e.t)) continue;
        if (Number.isFinite(ankomstMs)) {
          prov.push(Math.max(0, ankomstMs - e.t));
          if (prov.length > FONSTER) prov.shift();
        }
        if (e.typ !== "fel" && Number.isFinite(visadT) && e.t <= visadT) omstamplade.set(e.id, visadT + 1);
      }
      forsta = false;
      const ut = handlingarUr(events);
      for (const h of ut) if (omstamplade.has(h.id)) h.t = omstamplade.get(h.id);
      return ut;
    },
    stat() {
      const s = [...prov].sort((a, b) => a - b);
      return { sena: omstamplade.size, n: s.length, median: s.length ? Math.round(kvantil(s, 0.5)) : null,
        p95: s.length ? Math.round(kvantil(s, 0.95)) : null, max: s.length ? Math.round(s[s.length - 1]) : null };
    },
  };
}
