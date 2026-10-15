// Preview-stub för src/ui.js (#694) – butikens DOM-hjälpare (#692) + det avatarvalet behöver.
export * from "/preview/halloween-butik-stubs/ui.js";
export const getLockGate = async () => null;
export const escHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
