// Stubb för src/teacher-role.js (#740-preview).
export const myRole = async () => ({ admin: false, uid: "ak4", name: "Årskurs 4", classIds: new Set(["4a", "4b"]) });
export const filterClasses = (classes, role) => (role?.classIds ? classes.filter((c) => role.classIds.has(c.id)) : classes);
