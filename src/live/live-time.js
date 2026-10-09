// ============================================================================
// Live: tidsstämplar → ms (#547). Lövmodul (inga importer) så att både
// live-core och formaten (src/live/formats/*) kan använda den utan cykel.
// live-core re-exporterar toMs – befintliga importer fungerar som förut.
// ============================================================================

/** Timestamp | Date | number → ms (null om saknas). */
export function toMs(t) {
  if (t == null) return null;
  if (typeof t === "number") return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t.seconds === "number") return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return null;
}
