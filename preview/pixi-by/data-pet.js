// Preview-stub för src/data-pet.js (#420): riktiga modulen re-exporteras, bara
// det husvärlden kör vid start skrivs över (inga husdjur → inga läsningar).
export * from "/src/data-pet.js?real";
export async function hatchReadyPets() { return { pets: [], justHatchedIds: [] }; }
export async function savePetPositions() {}
