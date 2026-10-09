// ============================================================================
// Live – inbyggda spelformat (#547, epic #546)
// ----------------------------------------------------------------------------
// ENDA stället där format kopplas in. Nytt format = mapp ./<id>/ + importera
// här + lägg till i BUILTIN_FORMATS. Live-kärnan importerar härifrån (inte
// från live-formats.js direkt) så att registret alltid är fyllt.
//
// API: formatIdOf(session) → session.format ?? "klassmatch" (bakåtkompatibelt:
//        alla sessioner före #547 saknar fältet och ÄR Klassmatchen)
//      formatOf(session)   → format | null (null = okänt id, t.ex. en session
//        skapad av en nyare klient – visa "ladda om", krascha inte)
//      DEFAULT_FORMAT      – id:t lärarens väljare förvaljer
//      re-exporterar getFormat/requireFormat/listFormats/answerKindsFor
//
// ⚠️ Bootgraf (#271): importera bara DYNAMISKT från Live-sidorna, aldrig
// statiskt från app.js eller en annan kärn-bootfil.
// ============================================================================

import { registerFormat, getFormat } from "../live-formats.js";
import KLASSMATCH from "./klassmatch/index.js";

const BUILTIN_FORMATS = [KLASSMATCH];

for (const f of BUILTIN_FORMATS) if (!getFormat(f.id)) registerFormat(f);

export const DEFAULT_FORMAT = KLASSMATCH.id;

/** Sessionens format-id – saknat fält = Klassmatchen (ingen migrering). */
export function formatIdOf(session) {
  return session?.format ?? DEFAULT_FORMAT;
}

/** Sessionens format, eller null om id:t är okänt i den här versionen. */
export function formatOf(session) {
  return getFormat(formatIdOf(session));
}

export { getFormat, requireFormat, listFormats, answerKindsFor } from "../live-formats.js";
