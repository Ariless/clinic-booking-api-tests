// Master fixture export: the unstaffed-specialty fixture sits at the end of the chain
// (userFixture → slotFixture → twoUsersFixture → pages → unstaffedSpecialty), so a single
// `test` import gives tests the data fixtures, the page objects and the DB-state fixture.
// Fixtures are lazy — nothing is created or mutated unless a test destructures it.
export * from "./unstaffedSpecialtyFixture";
export type { UserPayload, SlotBody, SlotFixturePayload } from "./slotFixture";
export type { UnstaffedSpecialty } from "./unstaffedSpecialtyFixture";
