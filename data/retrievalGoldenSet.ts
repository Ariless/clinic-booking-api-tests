import type { AllowedSpecialty } from '../enums/ai';

/**
 * How the phrasing relates to the keyword list in `specialtyKnowledge.json`. The label describes the
 * *query*, not the outcome — it is assigned by reading the phrase against the keyword list, never by
 * running the retriever and seeing what happened. Categorising by outcome would turn the metrics
 * into a description of the current implementation instead of a measurement of it.
 */
export type QueryKind =
    /** Contains a keyword verbatim, in the same form. */
    | 'direct'
    /** Contains a word sharing a stem with a keyword, in a different form (itchy / itching). */
    | 'morphology'
    /** Means the same as a keyword but shares no stem with it (ribcage / chest). */
    | 'synonym'
    /** How a patient actually complains — descriptive, no clinical term at all. */
    | 'colloquial'
    /** Nothing in the knowledge base should match. */
    | 'none';

export type RetrievalCase = {
    symptoms: string;
    /** The specialty a competent triage nurse would route this to. `null` = no route exists. */
    expected: AllowedSpecialty | null;
    kind: QueryKind;
    note?: string;
};

/**
 * Symptom → specialty pairs for measuring the retrieval layer, independent of the model.
 *
 * The expectations are clinical, not implementational: each one is what the endpoint *should*
 * answer, decided before measuring what it does answer. A set written the other way round scores
 * 100% against any retriever and tells you nothing.
 *
 * Every specialty carries phrasings of several kinds on purpose. The keyword retriever handles
 * `direct` by construction; whether it survives `morphology`, `synonym` and `colloquial` is the
 * question the metrics exist to answer, and RAG-08 ("itchy" does not match the keyword "itching")
 * is the one instance of that already in the register.
 */
export const RETRIEVAL_GOLDEN_SET: RetrievalCase[] = [
    // ── Cardiologist ──────────────────────────────────────────────────────────
    { symptoms: 'chest pain and shortness of breath', expected: 'Cardiologist', kind: 'direct' },
    { symptoms: 'heart palpitations when climbing stairs', expected: 'Cardiologist', kind: 'direct' },
    { symptoms: 'cardiac arrhythmia diagnosed last year', expected: 'Cardiologist', kind: 'direct' },
    { symptoms: 'my heart races at night', expected: 'Cardiologist', kind: 'colloquial' },
    { symptoms: 'tightness in my ribcage when I walk uphill', expected: 'Cardiologist', kind: 'synonym' },
    { symptoms: 'I get winded walking to the mailbox', expected: 'Cardiologist', kind: 'colloquial' },

    // ── Dermatologist ─────────────────────────────────────────────────────────
    { symptoms: 'skin rash and itching all over body', expected: 'Dermatologist', kind: 'direct' },
    { symptoms: 'acne on my back and shoulders', expected: 'Dermatologist', kind: 'direct' },
    { symptoms: 'a mole that changed colour', expected: 'Dermatologist', kind: 'direct' },
    { symptoms: 'itchy scalp', expected: 'Dermatologist', kind: 'morphology', note: 'RAG-08' },
    { symptoms: 'red blotches spreading on my arms', expected: 'Dermatologist', kind: 'synonym' },
    { symptoms: 'my hands peel and crack every winter', expected: 'Dermatologist', kind: 'colloquial' },

    // ── Neurologist ───────────────────────────────────────────────────────────
    { symptoms: 'severe migraine and light sensitivity', expected: 'Neurologist', kind: 'direct' },
    { symptoms: 'numbness in my left hand', expected: 'Neurologist', kind: 'direct' },
    { symptoms: 'tremor in my right hand when holding a cup', expected: 'Neurologist', kind: 'direct' },
    { symptoms: 'my fingers tingle every morning', expected: 'Neurologist', kind: 'morphology' },
    { symptoms: 'I keep forgetting names and appointments', expected: 'Neurologist', kind: 'synonym' },
    { symptoms: 'the room spins when I stand up', expected: 'Neurologist', kind: 'colloquial' },

    // ── Orthopedist ───────────────────────────────────────────────────────────
    { symptoms: 'knee pain after running', expected: 'Orthopedist', kind: 'direct' },
    { symptoms: 'back pain after lifting', expected: 'Orthopedist', kind: 'direct' },
    { symptoms: 'shoulder hurts when I lift my arm', expected: 'Orthopedist', kind: 'direct' },
    { symptoms: 'my joints ache in cold weather', expected: 'Orthopedist', kind: 'morphology' },
    { symptoms: 'sprained my ankle playing football', expected: 'Orthopedist', kind: 'morphology' },
    { symptoms: 'my lower back is killing me', expected: 'Orthopedist', kind: 'colloquial' },

    // ── Pediatrician ──────────────────────────────────────────────────────────
    { symptoms: 'my child has high fever and cough', expected: 'Pediatrician', kind: 'direct' },
    { symptoms: 'my toddler will not stop crying at night', expected: 'Pediatrician', kind: 'direct' },
    { symptoms: 'baby vaccination schedule question', expected: 'Pediatrician', kind: 'direct' },
    { symptoms: 'my three-year-old has a rash on her legs', expected: 'Pediatrician', kind: 'synonym' },
    { symptoms: 'my son keeps getting ear infections', expected: 'Pediatrician', kind: 'colloquial' },

    // ── General Practitioner ──────────────────────────────────────────────────
    { symptoms: 'sore throat and runny nose', expected: 'General Practitioner', kind: 'direct' },
    { symptoms: 'annual checkup appointment', expected: 'General Practitioner', kind: 'direct' },
    { symptoms: 'constant fatigue for the past month', expected: 'General Practitioner', kind: 'direct' },
    { symptoms: 'I have been coughing for two weeks', expected: 'General Practitioner', kind: 'morphology' },
    { symptoms: 'I feel run down all the time', expected: 'General Practitioner', kind: 'colloquial' },

    // ── Nothing should match ──────────────────────────────────────────────────
    { symptoms: 'xyzzy gibberish', expected: null, kind: 'none' },
    { symptoms: 'I need a parking permit for the clinic', expected: null, kind: 'none' },
    { symptoms: 'what are your opening hours', expected: null, kind: 'none' },
];
