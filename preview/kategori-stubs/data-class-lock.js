// Preview-stub för src/data-class-lock.js (#853): data-mynt.js behöver bara
// serverklockan – i previewn är klientens klocka serverns.
export function serverNow() {
  return Date.now();
}
export async function syncServerClock() {
  return 0;
}
