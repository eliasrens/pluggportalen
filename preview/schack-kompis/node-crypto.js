// Förhandsvisningen (#780): det enda ur node:crypto som serverkoden i functions/
// använder (randomInt – färgen och id:n), för webbläsaren via sidans import map.
export function randomInt(min, max) {
  if (max === undefined) [min, max] = [0, min];
  const span = max - min;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return min + Math.floor((buf[0] / 2 ** 32) * span);
}
