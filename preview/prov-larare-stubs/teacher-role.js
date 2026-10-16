// Preview-stub för src/teacher-role.js (#739): rollen utan Firebase.
export * from "../../src/teacher-role-core.js";
const admin = new URLSearchParams(location.search).get("roll") === "admin";
export const myRole = async () =>
  admin
    ? { admin: true, uid: "admin1", name: "Admin", classIds: null }
    : { admin: false, uid: "anna", name: "Årskurs 4 (Anna)", classIds: new Set(["k4a"]) };
