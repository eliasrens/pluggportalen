import { S } from "./state.js";
import { buildLock, lockHomeHash, lockLabel, formatKlockslag, lockAllowsRoute, lockIsTarget, lockAllowsArea } from "../../src/class-lock.js";
export const onLockChange = () => () => {};
export function stopLockWatch() {}
export function gateFor(lock) {
  if (!lock) return null;
  return { lock, home: lockHomeHash(lock), label: lockLabel(lock), klockslag: formatKlockslag(lock.till),
    allows: (p, qq) => lockAllowsRoute(lock, p, qq), isTarget: (p, qq) => lockIsTarget(lock, p, qq),
    allowsArea: (s, a) => lockAllowsArea(lock, s, a) };
}
export async function lockForMe() {
  if (!S.lock) return null;
  const till = Date.now() + 3600e3;
  return S.lock === "lasresan"
    ? buildLock({ typ: "lasresan", till, doljOvrigt: S.doljOvrigt })
    : buildLock({ typ: "omrade", id: "matte/brak", namn: "Bråk", till, doljOvrigt: S.doljOvrigt });
}
