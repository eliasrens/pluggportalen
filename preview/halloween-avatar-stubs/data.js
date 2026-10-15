// Preview-stub för src/data.js (#694) – butikens minnes-elev (#692) + avatarvalet.
export * from "/preview/halloween-butik-stubs/data.js";
import { MEM } from "/preview/halloween-butik-stubs/data.js";
MEM.avatarId ||= "fox";
MEM.avatarChosen = true;
export async function setAvatar(avatarId) {
  MEM.avatarId = avatarId;
  console.log("[preview] setAvatar", avatarId);
  globalThis.__onAvatar?.(avatarId);
  return avatarId;
}
