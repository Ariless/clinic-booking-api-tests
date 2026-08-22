// Puts the SUT into the one state its DOCTORS_UNAVAILABLE branch needs: a specialty the
// knowledge base can recommend, with nobody on staff to see the patient.
//
// The seed used to leave Orthopedist and Paediatrician unstaffed, which is how that branch
// was reachable at all. Since 2026-08-21 the seed staffs all six specialties (so ordinary AI
// tests resolve to a real doctor), and `aiRoutes.js` line 96 became unreachable from a seeded
// database — while KNOWN_ISSUES.md still claimed a regression test covered it. There was none.
//
// The fixture parks the specialty rather than deleting the rows: a rename keeps every foreign
// key intact and restores in one statement, even if the test fails mid-way.
import path from "path";
import Database from "better-sqlite3";
import { test as base } from "./pages";

const DB_PATH = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.resolve(__dirname, "../../sut/data/clinic.db");

export type UnstaffedSpecialty = {
    /** The specialty the SUT can still recommend but cannot staff. */
    specialty: string;
    /** Symptoms that make the retrieval layer rank that specialty first in mock mode. */
    symptoms: string;
};

const SPECIALTY = "Pediatrician";
const PARKED = `${SPECIALTY} — parked by unstaffedSpecialty fixture`;

export const test = base.extend<{ unstaffedSpecialty: UnstaffedSpecialty }>({
    unstaffedSpecialty: async ({}, use) => {
        const db = new Database(DB_PATH);
        const parked = db
            .prepare("UPDATE doctors SET specialty = ? WHERE specialty = ?")
            .run(PARKED, SPECIALTY);

        if (parked.changes === 0) {
            db.close();
            throw new Error(
                `unstaffedSpecialty fixture: no doctors with specialty "${SPECIALTY}" to park — is the DB seeded?`,
            );
        }

        try {
            await use({ specialty: SPECIALTY, symptoms: "my baby has a fever and needs a paediatric check" });
        } finally {
            db.prepare("UPDATE doctors SET specialty = ? WHERE specialty = ?").run(SPECIALTY, PARKED);
            db.close();
        }
    },
});

export { expect } from "@playwright/test";
