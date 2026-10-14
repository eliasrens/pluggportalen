// ============================================================================
// Guldrushen – Skattkammaren (#565, designspec §6.3): HÄNDELSEFLÖDET längs
// högerkanten. De senaste (högst MAX = 4, #591) händelserna glider in överst
// och tonar ut efter en stund. EN rad per händelse, aldrig radbrytning: den
// korta texten (feedItem.short, kistkonfigens feedText – "💎 Alma +50",
// "✖️2 Alma +150", "🦝 Alma → Omar 30") med den som gjorde det som liten
// avatar först; blir raden ändå för lång kortas den med "…" (hela texten
// ligger i title). "✖️2" och {mynt} ritas som SVG (gr-ikoner withGrIcons).
// Lärarens "Visa namn" av → "Någon"/"en klasskamrat" och inga avatarer (#578).
// Listan har en fast höjd för MAX rader – flödet växer aldrig ut över något.
// TEMPO: högst en ny post per PACE_MS så att texten hinner läsas. Väntande
// poster är högst PENDING; fler → de minst viktiga (småguld först, stora
// händelser sist) och äldsta hoppas över. Storm (designtest 7): 30 kistor i
// samma ögonblick → flödet visar de viktigaste/senaste inom ~2 s och ligger
// aldrig efter. Bara transform/opacitet animeras (de andra posterna glider
// ned med FLIP).
// Avatarerna är avatarpoolens element (plats per post) och släpps när posten
// försvinner.
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-flode.js – här bara grottans texter och CSS-prefixet grf.
//
// API
//   createFlode(host, { pool, max? = 4, ttlMs? = 14000 }) → {
//     add(items)       feedItem-poster, äldst först (köas i tempot)
//     el, size(), pending(), destroy()
//   }
// ============================================================================

import { createFlode as ksCreateFlode } from "../../kistspel/ks-flode.js";
import { withGrIcons } from "./gr-ikoner.js";
import { trimPending } from "./gr-proj-scen.js";

export function createFlode(host, { pool, max, ttlMs }) {
  return ksCreateFlode(host, {
    pool, max, ttlMs,
    cls: "grf",
    label: "Händelser i grottan",
    heading: "📜 I grottan",
    empty: "Grottan väntar på första kistan …",
    icons: withGrIcons,
    trim: trimPending,
  });
}
