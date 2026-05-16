# Project Backlog

Full backlog across SUT (`clinic-booking-api`) + test repo (`clinic-booking-api-tests`).

---

## Project 3 — Roguelike game engine (separate repo)

### Goal
Build a deterministic roguelike simulation engine in TypeScript and write a professional test suite against it. The engine is the SUT. The point is **not** to demonstrate game testing skills — it is to demonstrate that advanced testing techniques (property-based, state machine, seeded randomness) apply universally across domains.

**Project tagline:** *A deterministic roguelike simulation engine built to explore advanced testing techniques through unstable timelines and reproducible state corruption.*

### Narrative — minimalist dark lore (decided 2026-05-15)
Atmosphere without worldbuilding. One concept, one character, a few phrases. Costs nothing to implement.

**World concept: broken simulation**
The dungeon is an unstable simulation. Every seed creates a separate timeline. Most timelines are stable. Some collapse into impossible states. The engine hunts them.

```
The dungeon is unstable.
Reality fractures differently under every seed.
Some timelines collapse.
Some heroes survive impossible states.
Some runs should never exist.
```

**Identity hook: The Archivist**
Not a hero with a biography — a system persona. The Archivist remembers every failed seed. Sees broken timelines. Detects impossible states. The replay system IS the Archive.

> *"The Archivist remembers every failed seed."*
> *"Some deaths repeat across timelines."*

Seeds as alternate realities:
```
Seed 44112: The knight survived.
Seed 44113: The same battle collapsed instantly.
```

**Narrative reframing of technical features:**
| Technical | Narrative |
|-----------|----------|
| Failed test / invariant violation | Corrupted timeline |
| Replay file | Archived timeline |
| `debugger.html` | Timeline Archive viewer |
| `npm run simulate` | Scanning timelines for corruption |
| Failing seed saved to `/artifacts` | Corrupted timeline archived by The Archivist |
| CI run | Automated timeline stability scan |
| State divergence / non-determinism | Timeline drift |
| Mutation survived | Hidden corruption |
| Flaky test | Unstable observation |
| Invariant holds / test passes | Containment successful |
| Shrinking to minimal failing case | Corruption isolated to step N |
| All CI tests green | Simulation stable. No invariant drift detected. |

**"TIMELINE CORRUPTED" screen** (replaces "INVARIANT VIOLATION"):
```
TIMELINE CORRUPTED

dead entity acted

Seed: 882911  Turn: 17

The Archivist has archived this run.
```
Same technical content (seed + turn + violated invariant), wrapped in narrative.

**Loading phrases** (10 lines of text, free to implement):
```
"Not every timeline is valid."
"The dead should not act."
"Invariants preserve reality."
"Some seeds should never be opened."
"The Archivist remembers."
"A fragile victory."
"The cycle repeats."
"Iteration 44112 terminated."
"Persistence outlives failure."
```

**Tonal inspiration matrix (decided 2026-05-15):**
Tonal references only — mood, archetypes, phrases, aesthetics. No direct copying of names, items, or characters.

| Source | What it inspires | Example |
|--------|-----------------|---------|
| **Darkest Dungeon** | Narration tone; fragility of victory | *"A fragile victory."* / *"Another seed lost to corruption."* |
| **SCP Foundation** | Anomaly language for impossible states | *"ANOMALY DETECTED"* / *"Reality integrity compromised."* |
| **Disco Elysium** | System diagnostic format for invariant checks | `LOGIC [Challenging: Failure] — Dead entities attempted to act.` |
| **Matrix** | Simulation / determinism terminology | *"Residual instability detected."* / *"Simulation divergence."* |
| **Slay the Spire** | Visual combat UX — intents, card design, map nodes | Card colours, enemy intent icons |
| **Nier: Automata** | Repeated timelines, failed cycles | *"Iteration 44112 terminated."* |

**"TIMELINE CORRUPTED" screen — final format:**
```
TIMELINE CORRUPTION DETECTED

Seed: 882911  ·  Turn: 17

LOGIC [Challenging: Failure]
Dead entities attempted to act.

The Archivist has preserved this replay for analysis.
```

**Stability vocabulary (decided 2026-05-15):**
The system has a measurable stability — shown in CI output, debugger header, and replay metadata. Counterbalances the corruption/collapse vocabulary; gives language for when things GO RIGHT.

```
Timeline Stability: 98.2%
Residual instability detected.

Simulation stable.
No invariant drift detected.

Containment successful. Invariant preserved.
Corruption isolated to Timeline Segment 17.
```

Used in:
- CI output footer — "Simulation stable." or "Instability detected in N timelines."
- debugger.html header — current seed's stability score
- Replay metadata — `"stability": 0.982`
- Shrinking output — "Corruption isolated to 3 actions."

**Archivist constraint (decided 2026-05-15):**
The Archivist works because it is almost a system process — not a character.
```
❌ No: dialogue, backstory, "who was he", emotional arc, motivations, lore explanations
✓ Yes: system outputs, anomaly reports, archived logs, process-like behavior
```
The moment it gets a personality, it becomes a game character. It must stay a forensic system persona.

**Mechanic = narrative (decided 2026-05-15):**
Status effects are not numbers — they are explanations of why this rule exists in this world:

| Status | Narrative framing |
|--------|-------------------|
| **Bleed** | *"A wound that won't close — the body keeps losing strength until it finally collapses"* |
| **Vulnerable** | *"Loss of stance and control — not a stat reduction, a breakdown"* |
| **Death's Door** | *"Already dead by the laws of this world — still acting on momentum alone"* |
| **Stun** | *"Reality around the entity fractured for one turn"* |
| **Defend** | *"A borrowed moment of order — it doesn't last"* |

**Card names as behaviour, not abilities (decided 2026-05-15):**

| Old name | New name | Why |
|----------|----------|-----|
| Sacrifice | **Bloodrite** | You pay in blood for power — a ritual, not a mistake |
| Mend | **Stubborn Recovery** | Not healing — refusing to die |
| Feral Roar | **Reality Crack** | In werewolf form, the world around you breaks |
| Defend | **Brace Through Pain** | Protection costs something |
| Hemorrhage | **Open the Wound** | Deliberate, not accidental damage |

**Hero conflict triangle (decided 2026-05-15):**
Three heroes in fundamental mechanical conflict — their interactions generate the combinatorial state space that makes property-based testing necessary.

| Hero | Archetype | Ideological axis | Mechanic |
|------|-----------|-----------------|---------|
| **Paladin → "The Preserver"** | Order | Survival = victory; patience accumulates into power | Heal + charge stacks |
| **Blood Mage → "The Catalyst"** | Entropy | Destruction precedes transformation | Self-damage as fuel; bleed as spreading chaos |
| **Berserker → "The Threshold"** | Chaos | Power lives at the edge of death; healing = weakness | Berserker bonus from low HP; transformation = surrender to instinct |

**Central conflict — "weaponized help":**
Paladin heals Berserker → removes their power source. This breaks a common assumption:

> *"Healing someone should always be beneficial"* — **false invariant** in this system.

`assertHealIsAlwaysBeneficial()` → FAILS → documented as intentional exception → bug cemetery candidate.

Other embedded conflicts:
- Paladin heal → forces Berserker out of werewolf form if HP > 50% — *"saving someone at the cost of their transformation"*
- Blood Mage Bloodrite → deliberately enters Death's Door — *"death as a tool"*
- Berserker at Death's Door + Paladin heal → strategic choice: heal and lose berserker bonus, or let them stay at the edge

**Hero README lines:**
```
The Preserver: charges slowly, breaks decisively.
The Catalyst: feeds on what kills others.
The Threshold: strongest where others surrender.
```

**What is NOT in scope for tone:**
No Marvel jokes, no Rick and Morty random humor, no anime references, no meme language, no Deadpool tone. No procedural narrative with choices — separate project. No world-reacts-to-playstyle meta-flags — too complex. These kill professional feel immediately.

### Positioning — what this IS and what it is NOT

| IS | IS NOT |
|----|--------|
| A portfolio piece showing testing technique breadth | A pivot to game QA / gamedev |
| A new SUT that generates richer state machine scenarios than a booking API | A game development project |
| Evidence that you think in testing patterns, not just in domains | Experience in Darkest Dungeon / Slay the Spire domain knowledge |
| A conversation starter for backend QA roles in gaming companies | A qualification for functional game tester roles |

**Interview framing:** "I built a small roguelike engine as a second SUT specifically because it generates richer non-deterministic state machine scenarios than a CRUD API — and used it to explore property-based and seeded randomness testing patterns."

### Why this domain
- Position-based combat + card system + status effects = complex state machine with combinatorial explosion — more interesting than a booking form
- RNG is pervasive but seedable — teaches deterministic testing of non-deterministic systems
- Death's Door mechanic (hero survives at 0 HP, next hit may kill) = a real multi-condition state rarely seen in web apps
- Inspired by Slay the Spire + Darkest Dungeon mechanics — rich enough to generate real bugs, small enough to build in days

### Scope (minimal viable engine)
3 heroes, 4 enemies + 1 boss, 4 status effects, position system. Content is minimal — complexity comes from interactions, not volume.

**Not** content for players. **Yes** — edge cases, branching logic, interaction rules that generate state-machine complexity.

**⛔ CONTENT FREEZE (decided 2026-05-15):** No new heroes, enemies, statuses, or cards. The system is dense enough. Any addition now reduces signal — dilutes interaction density, increases maintenance, distracts from the actual portfolio value. Next steps are execution: execution model, invariant registry, EventSpec, replay architecture, debugger, CI narrative. Adding content is the wrong direction.

#### Heroes (3 heroes, decided 2026-05-15)

Zero overlap in testing patterns — each covers a unique test paradigm.

**Card design rule (decided 2026-05-15):** every card must touch minimum 2 of 4 system axes:
- **Tempo** — who controls the turn (stun, extra action, delay)
- **Pressure** — unavoidable damage over time (bleed, mark, stacking debuff)
- **Stability** — survival control (block, cleanse, reposition)
- **Conversion** — turning one resource into another (HP→damage, block→damage, status→buff)

**Paladin** — HP ceiling, charge accumulation, threshold boundary
Charge stacks accumulate at Action Resolution Pipeline `step 5` (post-effects) when a qualifying attack lands. Charge-fuelled double damage fires at `step 4` (damage calculation) of the triggering attack. Stacks survive boss Phase 3 state reset (only status effects reset, not charge).


| Card | Axes | Effect | Testing value |
|------|------|--------|---------------|
| **Righteous Strike** | Tempo + Conversion | Deal 5 damage; if target is vulnerable → gain 1 charge stack | exploits enemy state; charge × vulnerable interaction |
| **Stubborn Recovery** | Stability + Conversion | Heal self for 6 HP | HP ceiling invariant: `hp <= maxHp`; heal × werewolf reversion |
| **Divine Charge** | Tempo + Conversion | Gain 1 charge stack (max 3); at 3 stacks next attack deals double damage | multi-turn accumulation; boundary at exactly 3 stacks; charge × Death's Door |

**Blood Mage** — bleed stacking, self-damage, RNG targeting
| Card | Axes | Effect | Testing value |
|------|------|--------|---------------|
| **Open the Wound** | Pressure + Stability disruption | Apply 3 bleed; if target already bleeding → also apply vulnerable | bleed stacking; off-by-one; bleed→vulnerable conversion; mutation target |
| **Bloodrite** | Conversion + Pressure | Deal 8 damage, take 3 self-damage | HP→damage conversion; Death's Door trigger via own card |
| **Chaos Bolt** | Tempo + Pressure | Deal 5 damage to **random** target | RNG call; seeded reproducibility; back-row targeting edge case |

**Berserker** — nested state machine (form × hero state), berserker scaling
| Card (human form) | Axes | Effect | Testing value |
|------|------|--------|---------------|
| **Savage Lunge** | Tempo + Stability disruption | Deal 6 damage + push enemy to back row | position transition via card; melee range invalidation after push |
| **Primal Fury** | Conversion + Tempo | Deal 4 damage + gain 1 rage stack | rage accumulation; conversion: attack→resource |
| **Primal Dodge** | Stability + Conversion | Gain defend 4; if berserker passive active → reduce energy cost of next card | defend in non-defensive class; passive-conditional effect |

| Card (werewolf form) | Axes | Effect | Testing value |
|------|------|--------|---------------|
| **Rend** | Pressure + Tempo | Deal 8 damage + apply bleed 2 | damage + DoT combo; bleed applied after damage (order matters) |
| **Rampage** | Tempo + Pressure | Deal 4 damage to **all** front-row enemies | AOE; position system; multiple simultaneous damage events |
| **Reality Crack** | Pressure + Conversion | Apply vulnerable to all enemies | mass debuff; vulnerable × bleed interaction; tensionMeter +high |

**Berserker passive:** damage dealt scales with missing HP — `damage * (1 + missingHp / maxHp)`. Applied at Action Resolution Pipeline `step 4` (damage calculation) as a flat multiplier before vulnerable. Mutation target: the formula itself.

**Property test — card axes invariant:**
```ts
// every card must affect at least 2 system axes
forAll(allCards, card => axesAffected(card).length >= 2)

// every card must leave combat state measurably changed
forAll(seeds, s => forAll(allCards, card =>
  combatStateAfter(card, s) !== combatStateBefore(card, s)
))
```

#### Overstack / idempotency rules (decided 2026-05-15)
Edge cases at system boundaries — exactly the cases mutation testing needs to catch:

| Rule | Invariant | Test case |
|------|-----------|-----------|
| Bleed stack **capped at 10** | `bleed.stacks <= 10` always | Apply bleed 8 + bleed 5 → stacks = 10, not 13 |
| Stun **does not extend** duration | Re-applying stun resets to 1, never stacks | Stun a stunned enemy → still 1 turn skipped |
| Multiple death triggers **idempotent** | `dead → dead` is a no-op | Bleed tick + attack both "kill" hero same turn → dies once, no double event |
| Death's Door is **sticky** — only explicit heal clears it | `death_door` not cleared by form change or turn end | Berserker transforms at Death's Door → still Death's Door in werewolf form |

#### Berserker / Werewolf rules (decided 2026-05-15)
Nested state machine — hero has own form SM inside game SM:
```
hero states:  alive → death_door → dead
form states:  human → werewolf → human
```

| Rule | Turn Pipeline step | Test case |
|------|-------------------|-----------|
| Transformation **automatic** at ≤50% HP — not a card action | Step 3 (start-of-turn passive check): if HP ≤ 50% → trigger transform | "Hidden" transition in property-based tests; triggers mid-sequence without player choice |
| Werewolf form lasts **3 turns**, then auto-reverts | Step 3 (start-of-turn): revert check on turn counter | Boundary: exactly 3 turns, not 2 not 4 |
| Werewolf form also reverts if HP healed **above 50%** (Paladin heal) | Step 3 (start-of-turn): HP threshold re-evaluated after heal; revert fires same mechanism | Heal × form reversion; healing weakens berserker |
| Status effects **carry across** transformation | Step 3 (start-of-turn): form changes, status list is unaffected | Bleed continues in werewolf form; stun continues; no reset |
| Stun does **not** block transformation — it's automatic, not an action | Step 3: stun sets `canAct = false` (blocks step 4/5 actions); passive transform check is separate | Stun × transformation timing invariant |
| Human-form cards **invalid** in werewolf form and vice versa | Step 4/5 (action execution): card validity checked at dispatch | Invalid action test; `assertValidGameState()` catches it |
| Death's Door rules apply in **both** forms | Step 9 (death resolution): form is irrelevant to death state | Death's Door in werewolf → next hit kills regardless of form |
| Revert while stunned on turn 3 → **revert happens**, stun continues | Step 3: revert check fires; step 4 skipped due to stun | Turn timing: revert is automatic, stun is a status — both apply |

#### Enemies

| Enemy | Mechanic | Testing value |
|-------|---------|---------------|
| **Goblin** | Simple melee, front-row only | baseline; cannon fodder for Necromancer to raise |
| **Necromancer** | Raises dead allies as Skeletons | entity lifecycle; spawn invariants; order of operations; stun × raise |
| **Guardian** | Shield (absorbs hits) + stun; if stunned while shield active → shield breaks | multi-status interaction; shield × stun edge case |
| **Vampire** | Lifesteal on living targets only; heals self equal to damage dealt (post-defend, post-vulnerable); no heal on Skeleton (undead) | HP ceiling invariant; lifesteal × defend; lifesteal × vulnerable; undead targeting logic |

**Cultist removed** — bleed already covered by Blood Mage's Open the Wound card.

#### Encounter dramaturgy — intent sequences (decided 2026-05-15)
Enemies are not random AI. Each enemy has a **telegraphed 3-turn pattern** — almost like scripted direction. This makes encounters predictable (testable) and dramatically structured.

Every intent is shown to the player before acting (Slay the Spire style):
`⚔ 6` = attack for 6 · `🩸 3` = apply bleed 3 · `🛡` = will defend · `💀` = raise dead · `✨` = empower

**Goblin — "the pressure"**
Simple loop. Exists to feed Necromancer and Vampire.
```
Turn 1: ⚔ 6  — Melee Strike (front hero)
Turn 2: ⚔ 6  — Melee Strike (front hero)
Turn 3: repeat
```
Testing value: baseline sequence; property test — Goblin always targets front row; seeded = always same target.

**Necromancer — "the orchestrator"**
Weakens → raises → amplifies. Sets up the board for others.
```
Turn 1: 🩸 3  — Wither (apply bleed 3 to front hero)
Turn 2: 💀    — Raise Dead (if ally dead → spawn Skeleton); else 🩸 3 again
Turn 3: ✨    — Empower Skeleton (next Skeleton attack +3); else apply vulnerable
```
Testing value: conditional branching on board state; Skeleton spawn on turn 2 = entity lifecycle test; empower timing = order-of-operations test.

**Guardian — "the lockdown"**
Defends → stuns → punishes. Classic setup/execute pattern.
```
Turn 1: 🛡    — Shield self (gain 8 defend)
Turn 2: ⚡    — Stun front hero (hero canAct = false next turn)
Turn 3: ⚔ 10 — Heavy Strike (hero is stunned, cannot defend)
```
Testing value: stun × defend sequence; hero stunned on turn 3 = canAct invariant; Heavy Strike while stunned = property test "stunned hero cannot play cards".

**Vampire — "the opportunist"**
Probes → exploits → finishes. Responds to existing statuses on hero.
```
Turn 1: ⚔ 6  — Strike (lifesteal if target living)
Turn 2: 🩸+⚔ — Exploit Wound (if hero has bleed: extra attack + amplified lifesteal); else ⚔ 6
Turn 3: ⚔ 12 — Execute (if hero at Death's Door: high damage attempt); else ⚔ 8
```
Testing value: conditional on hero state (bleed, Death's Door); lifesteal × bleed = two status interactions through pipeline; Execute at Death's Door = terminal state targeting test.

**Cross-enemy awareness rules (decided 2026-05-15, updated 2026-05-15):**
Cross-enemy effects are **event-scoped, not state-scoped** — they trigger on specific events and affect only the next actions, not global state permanently. This keeps enemies as agents, not rule triggers, and makes the system replay-safe.

| Rule | Event trigger | Scope | Test case |
|------|--------------|-------|-----------|
| Vampire acts **after** Necromancer in turn order | — (turn order rule) | permanent | Turn order determinism; Vampire sees bleed = true |
| `onEvent: stunApplied` → **next** enemy attack +2 damage | stunApplied | next action only, not all remaining turns | Stun on turn 2 → enemy attack on turn 3 is +2; turn 4 is normal |
| Necromancer won't raise if **no corpse on field** | raiseAttempted | graceful no-op | assertValidGameState() after no-raise turn |
| Skeleton **inherits Necromancer's empowerment** only if raised before empower | empowerApplied | targets existing Skeleton only | Order matters: raise turn 2 → empower turn 3 ✓; empower with no Skeleton = no-op |

**Why this matters for testing:**
Deterministic sequences = predictable multi-step scenarios:
```
Seed 42, turn 1: Guardian shields
Seed 42, turn 2: Guardian stuns → hero.canAct = false
Seed 42, turn 3: Guardian heavy strike → hero stunned, no defense
```
Property test: `forAll(seeds, s => guardianTurn3DamageIsUnblocked(simulate(s)))`

#### Encounter phase model (decided 2026-05-15)
Every combat is a scripted 4-phase scene — not random exchanges:

```
Phase 1 — Setup Pressure    enemies apply bleed / weak; background damage + dread
Phase 2 — Constraint        stun / position lock; player loses tempo
Phase 3 — Vulnerability     vulnerable + burst intent; peak damage window
Phase 4 — Resolution        burst lands / reset / new threat spawns
```

**Enemy roles in the scene** — our enemies already fill these:
| Role | Enemy | Job in scene |
|------|-------|-------------|
| Pressure Unit | Necromancer | Applies bleed; creates inevitability |
| Controller | Guardian | Stun + position lock; breaks player plans |
| Window Maker | Vampire | Exploits existing statuses; opens burst window |
| Finisher | Guardian (turn 3) / Vampire Execute | Closes the scene |

**Combat state machine** — enemies push the fight between states:
```
Stable → Pressured (bleed dominates) → Controlled (player loses actions)
       → Exposed (vulnerable window) → Collapsing (burst phase)
```

The encounter phase model and CombatStateMachine describe the same progression — phase model is the narrative view, CombatStateMachine is the technical implementation. Phase 1 = `Stable→Pressured`, Phase 2 = `Pressured→Controlled`, Phase 3 = `Controlled→Exposed`, Phase 4 = `Exposed→Collapsing`. Never treat them as separate parallel models.

**Property tests on dramaturgy** (not on damage — this is the key):
```ts
// state entropy increases over time until resolution (stronger than length >= 2)
forAll(seeds, s => stateEntropyIncreasesUntilResolution(simulate(s)))

// no regression to Stable after Exposed — temporal logic invariant
forAll(seeds, s => {
  const states = combatStates(simulate(s))
  const exposedIndex = states.indexOf('Exposed')
  return exposedIndex === -1 ||
    states.slice(exposedIndex).every(s => s !== 'Stable')
})

// every Stun must be followed by Exposed or Pressured phase
forAll(seeds, s => stunAlwaysLeadsToVulnerabilityOrPressure(simulate(s)))

// every encounter eventually reaches Resolution
forAll(seeds, s => combatEventuallyTerminates(simulate(s)))
```
These test **encounter design**, not damage numbers. Temporal logic invariants (`no regression after X`) are a stronger class than state counting.

#### Boss — "The Archivist" (decided 2026-05-15)
The entity that preserved corrupted timelines has itself become corrupted. The final encounter is the testing system vs an adversarial version of its own pipeline.

**Design rule:** The Archivist deals zero direct damage. It only modifies the rules. All damage in the fight comes from the broken rule system itself.

**Four phases — each breaks a different layer of the pipeline:**

```
Phase 1 — "Memory Suppression"    (turns 1–3)
  Removes all incomingHealing hooks for 2 turns.
  Paladin's Stubborn Recovery plays but heals 0.
  Testing value: applyEvent() with empty hook list for a modifier type;
                 Paladin charge stacks still accumulate (healing and charge are separate hooks).

Phase 2 — "Timeline Inversion"    (triggers when boss HP < 75%)
  Reverses resolution order for 1 turn:
  post-effects fire BEFORE damage calculation.
  Lifesteal (Vampire) calculated on pre-damage value → wrong amount.
  Testing value: resolution order pipeline under adversarial reorder;
                 assert lifesteal !== expected when phase active.

Phase 3 — "State Reset"           (triggers when boss HP < 50%)
  Forces ALL entities to alive (removes death_door, clears stun, clears bleed).
  Berserker's form also reset to human — forced transition at wrong time.
  Paladin's charge stacks: do they reset? Rule: NO — stacks survive (only statuses reset).
  Testing value: forced state reset; assertValidGameState() after reset;
                 charge stack preservation invariant.

Phase 4 — "Invariant Breach"      (triggers when boss HP < 25%)
  The Archivist attempts to set a dead entity's canAct = true.
  assertValidGameState() MUST catch this and throw TIMELINE CORRUPTED.
  Testing value: the ultimate invariant test — boss literally tries to corrupt state.
                 This is the test that proves the invariant system works.
```

**Property tests specific to the boss:**
```ts
// game state remains valid through every boss phase
forAll(seeds, s => allBossPhases(simulate(s)).every(state => isValidGameState(state)))

// pipeline inversion produces different results but always valid state
forAll(seeds, s => invertedPipelineState(simulate(s)).isValid === true)

// boss phase transitions are deterministic
forAll(seeds, s => {
  return JSON.stringify(bossPhaseSequence(simulate(s))) ===
         JSON.stringify(bossPhaseSequence(simulate(s)))
})

// Invariant Breach phase always triggers TIMELINE CORRUPTED, never a silent pass
forAll(seeds, s => phase4TriggersCorruptionDetected(simulate(s)))
```

**Narrative framing:**
```
FINAL ENCOUNTER

The Archivist no longer observes timelines.
It writes them.

Phase: Memory Suppression
"It is removing the ability to recover."

Phase: Timeline Inversion  
"Causality is reversed. Effects precede their causes."

Phase: State Reset
"It is erasing what happened."

Phase: Invariant Breach
"It is attempting the impossible."
→ TIMELINE CORRUPTED
   The invariant held.
   The Archivist has been archived.
```

**Boss decomposition — 3 separate concerns (decided 2026-05-15):**
```
Boss             → scripted phase controller; emits CorruptionEvents only
RuleMutationEngine → applies CorruptionEvents to engine; separate layer
Engine            → always validates AFTER mutation: applyMutation() → run() → assertValidState()
```
Boss does NOT directly break semantics. It submits inputs. The engine either holds or fails on its own terms.

**CorruptionEvent — boss actions are observable, not imperative:**
```ts
interface CorruptionEvent {
  type: "reorderResolution" | "removeHooks" | "forceStateReset" | "injectIllegalTransition"
  scope: "nextTurn" | "thisTurn" | "untilPhaseEnd"
  appliedAt: number        // turn number
  reversible: boolean
  constraintViolation: boolean  // true = assertValidGameState() must catch this
}
```
`constraintViolation: true` → bug cemetery entry. Every phase 4 event has `constraintViolation: true`.

**Shared mutation schema — boss and fast-check use the same formal model:**
```ts
// BossMutationSchema === ArbitraryMutationSchema (fc.arbitrary)
// game runtime and CI test suite are the same adversary

// fast-check version:
fc.assert(
  fc.property(fc.array(fc.constantFrom(...BossMutationSchema)), mutations => {
    mutations.forEach(m => RuleMutationEngine.apply(m))
    return isValidGameState(engine.state)
  })
)
```
Game and CI share the same formal model — "mirrored test oracle". Defeating The Archivist in-game and passing CI are equivalent proofs.

**Phase 4 — test expects violation, not absence:**
```ts
// Phase 4 "Invariant Breach" is asserting that detection works:
expect(() => {
  RuleMutationEngine.apply({ type: "injectIllegalTransition", constraintViolation: true })
  engine.run()
}).toThrow("TIMELINE CORRUPTED")
// test passes when the system correctly REJECTS the corruption
```

**Victory condition rewrite per phase:**
Win condition changes as The Archivist progresses — each shift creates a new invariant to assert:
```
Phase 1-2: "Kill The Archivist"          → assertBossDefeatable()
Phase 3:   "Survive 8 turns"             → assertCombatDoesNotSoftlock()
Phase 4:   "Restore system stability"    → assertAllInvariantsHold()
```
Test: `assertWinConditionIsValid(currentPhase)` — win condition itself must be a valid state.

**fast-check mirrors boss behavior outside the game (strongest testing idea):**
The Archivist inside the game = manual adversarial test.
fast-check test suite outside the game = automated version of the same adversary.
Both validate the same invariants. Two adversarial systems, one correctness proof.

```ts
// fast-check version of Phase 4 "Invariant Breach":
fc.assert(
  fc.property(fc.array(auditActions), actions => {
    const state = applyAuditActions(actions)
    return isValidGameState(state)  // must hold even under adversarial AuditActions
  })
)
```

Interview line: *"My final boss and my property-based test suite are the same adversary — one runs inside the game, one runs in CI. They validate identical invariants."*

**Why this is the strongest portfolio piece:**
The boss fight IS the test suite running against adversarial conditions. Defeating The Archivist = `assertValidGameState()` holding through 4 phases of pipeline corruption. This is not a game mechanic — it's a demonstration of defensive system design.

#### Vampire rules (decided 2026-05-15)
All rules mapped to resolution order pipeline phase. No temporal ambiguity.

| Rule | Pipeline phase | Test case |
|------|---------------|-----------|
| Heal = damage dealt **after** defend reduction | `5. post-effects` — runs after `4. damage calculation` | Target has defend 5, Vampire hits 8 → heals 3, not 8 |
| Heal = damage dealt **after** vulnerable amplification | `5. post-effects` — finalDamage includes vulnerable multiplier | Target vulnerable, Vampire hits 8 → damage 12 → heals 12 |
| HP **cannot exceed max** | `5. post-effects` — postcondition after heal applied | Vampire at 18/20 HP, hits for 6 → HP = 20, not 24 |
| Lifesteal does **not** trigger on Skeleton (undead) | `5. post-effects` — precondition: `target.type !== undead` | Vampire attacks Skeleton → healAmount = 0 |
| Lifesteal does **not** trigger from bleed ticks | `2. status application` — bleed is not Vampire's action; no post-effect hook | Bleed tick fires in phase 2; Vampire lifesteal hook only in phase 5 |
| Stun blocks attack → no heal | Turn Pipeline `step 3` (start-of-turn): `canAct = false` → no attack intent emitted at step 5 → no post-effect at step 8 → heal = 0 | Stunned Vampire emits no attack event → no post-effect → heal = 0 |

#### Necromancer rules (decided 2026-05-15)
All rules mapped to resolution order pipeline phase.

| Rule | Pipeline phase | Test case |
|------|---------------|-----------|
| Raise is a **conditional intent** on Necromancer's turn — if corpse present → spawn | Turn Pipeline `step 5` (enemy intent execution) of Necromancer's turn; EntitySpawn resolves via Action Resolution Pipeline `step 1` (state transitions) | Goblin dies turn 4 → Necromancer executes Raise Dead on turn 5 (step 5) → Skeleton spawns |
| Raised Skeleton gets **fresh state** — no inherited statuses | Action Resolution Pipeline `step 1` — spawn with clean state; no status copy | Goblin died with bleed 3 → Skeleton spawns with bleed 0 |
| Each corpse can be raised **once only** | Action Resolution Pipeline `step 1` — idempotency constraint: corpse flag `raisedOnce` | Kill Skeleton → corpse.raisedOnce = true → raise attempt = no-op |
| Stun **blocks raise** — stunned Necromancer skips raise action | Turn Pipeline `step 3`: `canAct = false` → intent cancelled at step 5; next eligible turn, raise fires if corpse still available | Stun turn 4 → Necromancer skips turn 5 entirely → raise fires turn 6 if corpse present |
| **Field capacity: 3 entities max** | Action Resolution Pipeline `step 1` — precondition: `fieldCount < 3` | Full field → raise attempt = graceful no-op, no error, no crash |

#### Status effect architecture — event modifier pipeline (decided 2026-05-15)
Statuses are NOT hardcoded effect combinations. They are temporary rewrites of world rules via shared hooks. Combos emerge automatically — no `if (bleed && vulnerable)` needed.

**Wrong approach (O(n²) conditions, combinatorial test hell):**
```ts
if (hasBleed && hasVulnerable) { damageTaken *= 1.3 } // never do this
```

**Correct approach: status → modifies rules → rules interact:**
```
ACTION → BASE VALUE → STATUS MODIFIERS → FINAL VALUE → RESULT
```

**Implementation:**
```ts
function applyEvent(event, entity) {
  let value = event.value
  for (const status of entity.statuses) {
    value = status.modify?.[event.type]?.(value, entity) ?? value
  }
  return value
}
```

**Statuses as hook collections (not effect descriptions):**
```ts
Bleed     = { onTurnStart: (e) => e.hp -= stacks,  incomingHealing: (v) => v * 0.5 }
Vulnerable= { incomingDamage: (v) => v * 1.5 }
Stun      = { canAct: () => false }
Defend    = { incomingDamage: (v) => Math.max(0, v - stacks),  onTurnEnd: clearDefend }
```

**Shared hook points (few hooks, many statuses — the design rule):**
```
onTurnStart       onTurnEnd
onDamageDealt     onDamageTaken
onHeal            canAct
modifyTargeting
```
Never add: `onBleedTick`, `onVulnerableHit`, `onStunBreak` — these are hardcoded interactions, not a pipeline.

**Three modifier layers (flat → multiplicative → rule-breaking):**
| Layer | Example | Drama level |
|-------|---------|-------------|
| Flat | `+2 damage` | Low |
| Multiplicative | `×1.5 incoming damage` | Medium |
| **Rule-breaking** | `canAct = false`, `ignoreBlock = true`, `damageBecomesTrueDamage = true` | **High — this is where drama lives** |

**Emergent combos (no manual wiring):**
| Situation | Emerges from |
|-----------|-------------|
| Bleed + Vulnerable | `onTurnStart` hp loss + `incomingDamage` amplification — death accelerates from both directions |
| Stun + Bleed | `canAct = false` + `onTurnStart` hp loss — entity watches its own disappearance |
| Stun + Vulnerable | `canAct = false` + `incomingDamage ×1.5` — object in an experiment, not a subject |

**Why this matters for testing:**
- Emergent combos = emergent test cases — property-based tests discover them automatically
- Flat list of hooks = flat list of mutation targets
- Adding a new status = zero changes to existing tests (open/closed principle)
- `applyEvent()` is the single mutation target for the entire modifier system

#### Presentation layer types (decided 2026-05-15)
Renderer reads events and presentation structs — never game state directly.

**CardPresentation** — shared by game UI (card in hand) and debugger (card detail popup on event click):
```ts
interface CardPresentation {
  id: string
  title: string
  heroClass: "paladin" | "bloodmage" | "berserker" | "werewolf"
  axes: Axis[]
  rulesText: string
  imageUrl: string        // card art — AI-generated or curated; e.g. "/assets/cards/rend.jpg"
  narrativeLine?: string  // italic flavour text, optional
}
```
`heroClass` drives frame colour (paladin = gold, bloodmage = crimson, berserker = bone, werewolf = bone+red glow). No portraits, no images — everything from design tokens + unicode.

**Intent type union** — enemies and the debugger use one contract:
```ts
type Intent =
  | { type: "attack";    value: number }
  | { type: "bleed";     value: number }
  | { type: "defend" }
  | { type: "stun" }
  | { type: "raise" }
  | { type: "empower";   value: number }

// renderIntent(intent: Intent): string  — one function; all consumers
```

**Timeline event schema** — renderer reads events, not state:
```ts
interface TimelineEvent {
  turn: number
  type: "damage_applied" | "status_applied" | "entity_spawned" | "state_transition" | "invariant_violation"
  source: string        // entity id
  target: string        // entity id
  amount?: number
  modifiers?: string[]  // e.g. ["vulnerable", "lifesteal"]
  seed: number
  tensionMeter: number
}
// debugger is: events.map(renderEvent)
```

**TimelineState** — maps to both stability vocabulary and UI visual states:
```ts
type TimelineState = "stable" | "unstable" | "corrupted" | "collapsed"
// used in: CI output, debugger header, replay metadata, TIMELINE CORRUPTED screen
```

**Debug overlay format** — pipeline breakdown inside debugger (strongest portfolio signal):
```
[EVENT 441]
damage_pipeline:
  base:        8
  vulnerable:  +4
  defend:      -0
  final:       12

TRANSITION:
  alive → death_door
```
This looks like distributed tracing / audit tooling, not a game UI. That's the point.

#### Architecture principle — single source of truth (decided 2026-05-15)
`CombatStateMachine` is the primary model. Everything else is a derived view — not a parallel truth.

```
Execution layer (truth):
  intent sequences   → input schedule to state machine
  RNG                → seeded, deterministic
  state machine      → the one true model

Effects layer:
  statuses           → hooks on state transitions
  damage rules       → pipeline modifiers
  transformations    → form changes, entity lifecycle

Observability layer (derived, not authoritative):
  phase model        → derived from state distribution over time
  dramaturgy labels  → visualization of state transitions
  debug UI           → reads from telemetry only
```

**Risk to avoid:** phase model or intent sequences becoming a second source of truth. If Guardian stun appears in intent sequence AND phase model AND cross-enemy rules AND state machine — that's semantic drift. The test suite will start verifying different abstractions and diverge silently.

#### Action Resolution Pipeline (decided 2026-05-15)
Resolves **one specific action or effect** — called from within the Turn Pipeline at steps 4 and 5 (player actions, enemy actions). Not a turn structure — a per-action resolution order.

```
1. state transitions    — form change (werewolf), entity spawn (Necromancer raise)
2. status application   — bleed tick, stun decrement, defend expiry
3. positional effects   — melee range validation, back-row checks
4. damage calculation   — base × berserker scaling × vulnerable × battlefield condition
5. post-effects         — lifesteal (Vampire); death notification → marks corpse for raise
```

Vampire and Necromancer rule tables use **Action Resolution Pipeline** step numbers (1–5). Every test that involves two or more systems firing simultaneously relies on this order being stable. Mutation testing targets each step.

#### Turn Pipeline — per-turn contract (decided 2026-05-15)
Structures **one full turn** — what happens and in what order. References to "step X" in EffectType, BattlefieldCondition scope, and target validation use these step numbers (1–9).

**Steps 4 and 5 call the Action Resolution Pipeline** for each individual action taken.

```
Turn Pipeline (9 steps):
1. Apply battlefield conditions        ← BattlefieldCondition fires HERE ONLY
2. Determine turn order                ← seeded shuffle if Broken Order active
3. Start-of-turn passive checks        ← canAct (stun), HP threshold (werewolf), passive powers
4. Player actions          →  calls Action Resolution Pipeline per action
5. Enemy actions (intents) →  calls Action Resolution Pipeline per intent
6. Damage resolution                   ← resolves pending damage after all actions
7. Status tick                         ← automatic: bleed damage, stun decrement, defend expiry
8. End-of-turn effects                 ← Vampire lifesteal post-effect
9. Death resolution                    ← alive → death_door → dead; idempotent
```

**Effect categorisation — EffectType (decided 2026-05-15):**
```ts
type EffectType =
  | "DirectDamage"      // damage dealt via card or intent
  | "StatusApplication" // applying or ticking a status effect
  | "StateTransition"   // entity lifecycle: alive/death_door/dead, form change
  | "EntitySpawn"       // spawning a new entity (Necromancer raise, Turn Pipeline step 5)
  | "PipelineModifier"  // modifies turn structure (BattlefieldCondition, Turn Pipeline steps 1–2)
```
EffectType is a discriminant tag on each Effect — it says WHAT category, not WHEN it fires. Timing is defined per-event in `EventSpec.stage`. Every effect is tagged at creation: invariants, mutation tests, and replay diffs are grouped by EffectType.

**All rules execute through pipeline steps — never directly:**
No rule fires outside of its assigned pipeline step. Status hooks, battlefield conditions, positional checks, and boss mutations are all pipeline-mediated. This is a stronger statement of the "single source of truth" principle: no hidden side effects, no implicit ordering.

#### Tension meter (decided 2026-05-15)
Global combat state variable that accumulates based on play style and modifies enemy behaviour. New state = new invariant class.

```ts
tensionMeter: number  // 0–100; persists across turns within a combat
```

**How it accumulates:**
- Hero plays burst/direct damage cards → `+tension`
- Hero prolongs fight via status effects (bleed stacking, bleed ticking) → `+tension`
- Hero heals or defends → `-tension` (stabilising play reduces pressure)

**How it affects the system:**
- `tensionMeter < 30` → enemies use standard intent sequences
- `tensionMeter 30–70` → enemies may accelerate intent (skip setup phase, go straight to Phase 3)
- `tensionMeter > 70` → enemies switch to aggressive intents; Vampire skips probe → executes immediately

**Invariants:**
```ts
expect(tensionMeter).toBeGreaterThanOrEqual(0)
expect(tensionMeter).toBeLessThanOrEqual(100)
```

**Property tests:**
```ts
// high tension always leads to at least one intent escalation
forAll(seeds, s => highTensionLeadsToEscalation(simulate(s)))

// tension never causes an impossible state transition
forAll(seeds, s => assertValidGameState(simulateWithTension(s)))

// tension is deterministic — same seed = same tension curve
forAll(seeds, s => {
  return JSON.stringify(tensionCurve(simulate(s))) ===
         JSON.stringify(tensionCurve(simulate(s)))
})
```

**Mechanic → CombatState transition map (decided 2026-05-15):**
Each mechanic drives the CombatStateMachine forward. Unified semantic vocabulary — cards, statuses, and the state machine share one pressure model:

| Mechanic | CombatState transition |
|----------|----------------------|
| bleed applied | `Stable → Pressured` |
| stun applied | `Pressured → Controlled` |
| vulnerable applied | `Controlled → Exposed` |
| execute / kill | `Exposed → Collapsing` |

This means every card's Axes map directly to state machine pressure. Property test: `forAll(seeds, s => combatEventuallyReaches("Collapsing"))`.

**Testing value:** new class of global-state invariants; tension curve is a mutation target; ties hero conflict (Preserver stabilises → lowers tension, Catalyst prolongs → raises tension) to measurable system behaviour.

#### Battlefield Condition (decided 2026-05-15)
One active global modifier per combat. Adds cross-system interactions without adding content.

**"Broken Order"** — turn order reshuffled each round (seeded, so deterministic):
- Testing value: order-of-operations bugs; resolution pipeline stress test; "same seed = same shuffle" invariant
- **Scope constraint:** `BattlefieldCondition` modifies ONLY pipeline step 2 (turn order). No other pipeline step. This gives predictability, test isolation, and no hidden side effects from conditions.
- One condition only for v1 — room to expand but not required

#### Status effects

| Effect | Rule | Testing value |
|--------|------|---------------|
| **bleed** | Takes N damage per turn; stacks; cannot go below 0 | property test: bleed damage never negative; mutation: off-by-one in tick |
| **stun** | Skips exactly one turn | boundary: exactly 1 skip, not 0, not 2 |
| **defend** | Absorbs damage before HP; expires next turn | invariant: defend never increases incoming damage |
| **vulnerable** | Takes 50% more damage | interaction: vulnerable × bleed × stun combinatorial |

#### Position system
- Front / back row per side
- Melee cards cannot reach back row if front is alive
- Stunned entity cannot move between rows
- **Target validation occurs at pipeline step 3 (start-of-turn), BEFORE intent execution at step 5.** This closes edge cases: Chaos Bolt with back-row-only targets; Necromancer raise into invalid position; Broken Order shuffle into unreachable target.
- Generates combinatorial cases: position × skill type × target × stun state

#### Death's Door mechanic
```
HP reaches 0 → status: death_door (not dead)
Next hit     → dead
Heal         → back to alive (HP = 1)
```
State machine: `alive → death_door → dead` / `death_door → alive`
Invalid: `dead → alive`, `dead → death_door`
This is the richest state for property-based and boundary testing.

**Death's Door immunity invariant (decided 2026-05-15):**
```ts
// Death's Door cannot be removed by status effects — only damage or heal can transition it
expect(deathDoorCannotBeRemovedByStatusEffect).toBe(true)
// e.g. stun must NOT clear death_door; bleed ticks must NOT bypass the transition order
```
Without this: stun clears Death's Door (state corruption), bleed bypasses death_door → dead transition.

#### Run structure
4 rooms: `combat → elite → treasure → boss`
Seeded RNG — same seed = same room order, same enemy, same loot = deterministic tests.

#### What is NOT in scope
No map generation, no inventory (treasure room = HP restoration roll; `duplicateLootRoll` fault tests this roll), no talent trees, no crafting, no multiplayer, no graphics/canvas, no animations beyond CSS. Complexity from interactions, not content volume.

### Testing techniques showcased

| Technique | Concrete scenario | Invariant class |
|-----------|-----------------|-----------------|
| **State machine** | `alive → death_door → dead`; `game: exploring → in_combat → game_over`; invalid transitions caught by `assertValidGameState()` | temporal transitions |
| **Property-based (fast-check)** | Any random combat sequence → valid state; bleed damage never negative; stun skips exactly 1 turn; deck size conserved | numeric invariants |
| **Boundary** | Hero at exactly 0 HP (Death's Door trigger); bleed at stack 0 → no damage; Chaos Bolt with only back-row targets alive | boundary invariants |
| **Combinatorial** | `vulnerable` × `stun` × `bleed` stacked on same entity; position × skill type × target | interaction explosion |
| **Randomness / determinism** | Same seed → identical RNG stream; Chaos Bolt hits same target; different seeds diverge at first RNG call | determinism invariants |
| **Save / load** | Serialise full game state mid-combat; deserialise and continue; assert state identity | identity invariants |
| **Mutation testing** | Stryker on bleed tick formula; off-by-one in stack math must be caught by property invariants | numeric invariants |
| **Metamorphic** | Doubling bleed duration never reduces total damage; enemy order shuffled with fixed seed → total rewards invariant | relational invariants |
| **Fault injection** | `bleedOffByOne: true` → property test catches it; fast-check shrinks to minimal sequence; seed reproduces it | numeric + temporal |

### Positioning (refined)
**Not** "roguelike game" — **"deterministic adversarial simulation framework with explicit interaction semantics"**

**Narrative framing:** *observability fiction* — the narrative explains diagnostics, romanticizes determinism, and turns replay/debugging into fiction. Not dark fantasy. Not roguelike lore. A genre that doesn't exist yet, and that's exactly why it works for an SDET project.

> The Archivist doesn't make the project feel like a game. It makes the testing infrastructure feel like a system with memory.

The strongest phrase in the project: **"Some runs should never exist."** — simultaneously lore, invariant theory, and property-based testing philosophy.

Interview line: *"I intentionally chose a roguelike combat engine because it creates far richer state transitions and non-deterministic behaviour than a standard CRUD API. The goal wasn't game development — it was to explore advanced testing strategies: deterministic seeded randomness, property-based testing, model/state-machine testing, replay-driven debugging, mutation testing, and invariant validation. The engine became a controlled environment for validating testing techniques that also apply to distributed systems, financial systems, and backend orchestration platforms."*

### Architecture — 5 layers (decided 2026-05-15)

```
engine/      — pure deterministic logic (no I/O, no RNG calls directly)
runtime/     — seed, RNG, executor; wires engine + randomness together
telemetry/   — replay log, event store; every action recorded as JSON
testing/     — fast-check, invariants, Stryker; reads from engine + telemetry
debugger/    — debugger.html; reads telemetry, visualises timeline
```

**Key architectural rule:** `engine/` has zero knowledge of `testing/` or `debugger/`. `debugger/` reads only from `telemetry/`. Loose coupling is the point.

**Rendering data flow (decided 2026-05-15) — this is the critical architectural decision:**
```
GAME RULES
    ↓
EVENTS          ← renderer reads events, never game state directly
    ↓
PRESENTATION    ← events translated to display structures (Intent, TimelineEvent)
    ↓
RENDERER        ← debugger.html, combat UI, CI screenshots
```
The renderer is `events.map(renderEvent)` — not `gameState → React components`. This makes the debugger replayable, testable, and deterministic. It's event sourcing + observability in one pattern.

### Priority — what to build (decided 2026-05-15)

**MUST HAVE** (makes the project strong):
- [ ] Seeded RNG — same seed = same dungeon = reproducible failing case
- [ ] Replay system — every action logged as `{ seed, actions[] }`; `replayGame(log)` is byte-perfect
- [ ] Fault injection toggles — `createGame({ faults: { bleedOffByOne, ignoreStun, duplicateLootRoll } })`; tests find the bug, fast-check shrinks it, seed makes it reproducible
- [ ] Impossible State Detector — `assertValidGameState(state)` called after every action in tests
- [ ] Invariant-based tests — no `expect(hp).toBe(17)`; only `hp >= 0`, `deadHeroCannotAct`, `deckSizeConserved`
- [ ] fast-check property tests (= the "chaos monkey") — generates thousands of action sequences, shrinks failing case automatically
- [ ] `debugger.html` — separate page, reads `replay.json`, shows timeline + HP bars + events + seed; Playwright-tested

**MUST HAVE** (добавлено 2026-05-15):
- [ ] **Bug cemetery** (`BUGS.md`) — каждый реально найденный баг: seed, root cause, как нашли (invariant / property test / fault toggle), fix. Дёшево писать, убийственно на интервью — показывает testing ROI в живом виде.
- [ ] **Invariant Registry System** — единый реестр инвариантов; fast-check, boss, runtime и debugger используют один источник правды:
  ```ts
  interface Invariant {
    id: string
    appliesAt: PipelineStep   // 1–9
    check(state: GameState): boolean
    severity: "hard" | "soft" // hard = throw; soft = warn + log
  }
  const InvariantRegistry: Invariant[] = [] // populated by each engine module
  ```
  `assertValidGameState()` итерирует реестр. Boss CorruptionEvent проверяется против него же. Replay debugger подсвечивает нарушения по `appliesAt`. Interview line: *"One invariant definition catches bugs in the engine, the boss, and the debugger simultaneously."*

  **EventSpec upgrade — event-level invariants (decided 2026-05-15):**
  Each event carries its own preconditions + postconditions. Replay debugger, fast-check, mutation tests, and the visualizer all work from one model:
  ```ts
  interface EventSpec {
    event: string             // e.g. "ApplyBleed"
    stage: PipelineStep       // e.g. "postDamage" (step 7)
    preconditions: string[]   // e.g. ["targetAlive"]
    postconditions: string[]  // e.g. ["bleed <= 10"]
  }
  ```
  `InvariantRegistry` entries reference `EventSpec` definitions — the registry becomes the single model for correctness across all consumers.
- [ ] **Combat Execution Pipeline formalized** — 9-step turn contract живёт в `engine/resolution.ts`; каждый шаг — отдельная функция; все тесты знают в какой шаг что происходит.

**NICE TO HAVE** (if time allows):
- [ ] Mutation testing (Stryker) + "survived mutant → added invariant → killed" PR narrative
- [ ] Fault injection: expand to more scenarios
- [ ] Shrinking visualizer — при падении теста вывод в консоль: `Original: 82 actions → Shrunk: 3 actions` + минимальная последовательность; fast-check уже умеет, нужно красиво отформатировать
- [ ] State coverage heatmap — какие переходы state machine покрыты тестами (`✔ alive→death_door`, `✘ dead→alive`); CI артефакт или раздел README
- [ ] Monte-Carlo simulation mode — `npm run simulate --runs 100000` → winrate по классам, avg combat length, самый смертоносный враг; дёшево: просто запустить много сидов и собрать статистику
- [ ] Metamorphic testing — отношения между входами/выходами вместо абсолютных значений: "doubling bleed duration should never reduce total damage"; "enemy order shuffled but seed fixed → total rewards invariant"; редкая техника, интервьюеры запоминают
- [ ] RNG inspector в telemetry — логировать все RNG вызовы в replay: `{ call: "crit_roll", value: 0.92, turn: 4 }`; same seed → identical RNG stream
- [ ] diff view в debugger.html — при переключении хода показывать что изменилось: `- hp: 6 / + hp: 4 / + bleed: 2`
- [ ] Failure artifacts — при падении теста автосохранять в `/artifacts`: `replay.json` + `state-before.json` + `state-after.json` + `rng-stream.json`

**SKIP for v1:**
- Differential testing (two engine implementations) — 2x maintenance, 10% extra signal
- "AI chaos monkey" as separate module — fast-check already is the chaos monkey
- Chaos mode (corrupt save / duplicate event) — fault injection уже покрывает концепт
- Testing dashboard HTML page — раздел README со stats даёт 80% эффекта
- Complex debugger UX (animations, sounds, polished game feel)
- Testing notebook / research docs — write after implementation

### Fault injection design
Controlled scenarios only — not random runtime corruption:
```ts
engine = createGame({
  seed: 42,
  faults: {
    bleedOffByOne: true,      // bleed ticks for (stacks - 1) instead of stacks
    ignoreStun: false,        // stunned enemies act anyway
    duplicateLootRoll: true   // loot table rolled twice, second overwrites first
  }
})
```
Tests: find the bug → fast-check minimises failing sequence → seed makes it reproducible → story: "mutation survived → added property invariant → now caught."

### Invariants (not expected values)
```ts
// Never:
expect(hp).toBe(17)

// Always:
expect(hp).toBeGreaterThanOrEqual(0)
expect(deadHeroCannotAct).toBe(true)
expect(totalCards).toBe(initialDeckSize)          // deck size conserved
expect(noDuplicateEntities).toBe(true)
expect(stunSkipsExactlyOneTurn).toBe(true)
expect(defendNeverIncreasesIncomingDamage).toBe(true)
expect(bleedDamageCannotHeal).toBe(true)
```

### Replay system design
```json
{
  "seed": 1337,
  "actions": [
    {
      "type": "play_card",
      "card": "Strike",
      "target": 0,
      "turn": 1,
      "turnPipelineStep": 4,
      "actionResolutionStep": "damage_calculation",
      "tensionMeter": 42,
      "preStateHash": "a3f9c1",
      "postStateHash": "b7d2e4"
    },
    {
      "type": "end_turn",
      "turn": 1,
      "turnPipelineStep": 9,
      "actionResolutionStep": "state_transitions",
      "tensionMeter": 44,
      "preStateHash": "b7d2e4",
      "postStateHash": "c1a8f2"
    }
  ]
}
```
**Field naming:** `turnPipelineStep` = Turn Pipeline step (1–9). `actionResolutionStep` = Action Resolution Pipeline step name (`state_transitions` / `status_application` / `positional_effects` / `damage_calculation` / `post_effects`). `tensionMeter` recorded per-event — required for byte-perfect replay because tension affects enemy intent selection.

`preStateHash` + `postStateHash` per event enables: replay diff debugging, per-event invariant verification, mutation isolation (which event caused divergence). `replayGame(log)` reproduces combat byte-perfect. Failed property test → auto-saves `failing-seed-XXXX.json` as CI artifact.

### debugger.html — scope (decided 2026-05-15, updated 2026-05-15)
**Separate page** (not embedded in game UI) — lives in `debugger/` layer, reads from `telemetry/`. This is a QA tool, not a game feature.

**Frame: forensic analysis tool, not a game replay viewer.** The debugger looks like an investigation interface — it analyses an archived timeline for corruption. This ties directly to the Archivist persona without adding any code.

**URL routing:** `/replay/882911` opens that seed directly — shareable link to any failing case.

**UI vocabulary (UI layer only — NOT in code, variable names, or test IDs):**
| Code/technical | UI display text |
|---------------|----------------|
| Turn N | Timeline Segment N |
| Replay loaded | Archived timeline restored |
| Seed: 882911 | Timeline ID: 882911 |
| HP / health | Integrity |
| Invariant violation | Corruption event detected |
| No violations found | Containment successful |
| Stability score | Timeline Stability: 98.2% |

Includes:
- Timeline segments panel (left) — was "turn timeline"
- Integrity bars — hero + enemies (current segment)
- Cards played + target
- Status effect stacks
- Timeline ID + current RNG value
- Buttons: prev segment / next segment / jump to segment N
- **"Copy timeline URL"** button — copies `/replay/<seed>` to clipboard; one line of JS, production-quality vibe
- Export archived timeline (JSON)
- Diff view between segments: `- hp: 6 / + hp: 4 / + bleed: 2`
- Header: `Timeline Stability: N%` — computed from invariant pass rate across all segments

Excludes: animations, sound, illustration art, PWA, mobile, any game-feel polish.

**Tested with Playwright** — "I test the test debugger with Playwright" is the interview line.

### game/index.html — playable UI scope (decided 2026-05-15)
Turn-based combat UI. You choose cards, the engine runs, telemetry records, UI re-renders. **No game logic in the UI** — `game.ts` sends actions to `runtime/executor`, reads `telemetry/` for state display.

**Core loop:**
```
Player clicks card → game.ts dispatches action → executor runs Turn Pipeline
→ telemetry records events → game.ts reads new telemetry → re-renders
```

**Seed input at top** — set any seed to reproduce a failing scenario from BUGS.md interactively. This is the key portfolio value: "I can reproduce any failing seed by hand."

**Includes (MUST HAVE):**
- Hero panel (left): HP bar, status chips (statusRenderPriority order), hand of 3 cards
- Enemy panel (right): HP bar, status chips, **intent display** (`⚔ 8` / `🛡 defend` / `💀 raise`)
- Card hand: 3 cards per turn; click to select, click enemy to target, card plays
- End Turn button
- Combat log (right panel): last 5 events, fadeIn animation
- Seed display + seed input field (top bar)
- Death's Door visual: HP = 0 → screen tint red + entity pulses
- "TIMELINE CORRUPTED" overlay when `assertValidGameState()` throws

**Excludes:**
- Animations beyond CSS transitions and fadeIn
- Sound, particles, card draw animation
- Victory/defeat screen beyond simple text overlay
- Multiple rooms in one session (fight one encounter, then it's over)
- Any game logic — UI is a pure consumer of telemetry events

**Tested with Playwright** (`tests/ui/game.test.ts`):
- Can play a card
- Can end turn
- Enemy intent updates after player acts
- Death's Door tint appears at 0 HP
- TIMELINE CORRUPTED overlay appears when invariant fires
- Seed input changes the combat (different seed = different enemy)

**Portfolio value:**
`game/` and `debugger/` are two independent Playwright-tested consumers of the same engine. Interview line: *"The game UI and the forensic debugger both read from the same telemetry layer. I Playwright-test both. They can't diverge from the engine because neither one imports it directly."*

### Mobile — decision (2026-05-15)
**Skip entirely.** For backend QA / SDET narrative, mobile is noise. Time better spent on replay tooling, fuzzing, observability, and deterministic infra. Mobile only makes sense if the career target is mobile QA or frontend — it isn't.

### Repo structure (decided 2026-05-15)

```
roguelike-engine/
├── src/
│   ├── engine/                    # pure logic — no I/O, no RNG
│   │   ├── types.ts               # GameState, Entity, Card, Status interfaces
│   │   ├── game.ts                # createGame(config), GameConfig
│   │   ├── combat.ts              # CombatStateMachine
│   │   ├── resolution.ts          # 5-step resolution pipeline
│   │   ├── tension.ts             # TensionMeter 0-100
│   │   ├── invariants.ts          # assertValidGameState(); InvariantRegistry
│   │   ├── entities/
│   │   │   ├── hero.ts            # Hero base + Knight, Paladin, Berserker
│   │   │   └── enemy.ts           # Enemy base + Goblin, Vampire, Necromancer
│   │   ├── statuses/
│   │   │   ├── index.ts           # Status interface (hook collection)
│   │   │   ├── bleed.ts
│   │   │   ├── stun.ts
│   │   │   ├── defend.ts
│   │   │   └── vulnerable.ts
│   │   ├── cards/
│   │   │   ├── index.ts           # Card interface + Axis types
│   │   │   ├── knight.ts
│   │   │   ├── paladin.ts
│   │   │   └── berserker.ts
│   │   └── boss/
│   │       ├── archivist.ts       # Boss + CorruptionEvent interface
│   │       └── rule-mutation-engine.ts
│   ├── runtime/                   # wires engine + randomness
│   │   ├── rng.ts                 # seeded RNG (mulberry32); all RNG calls here
│   │   ├── executor.ts            # runs engine steps, calls RNG + recorder
│   │   └── faults.ts              # FaultConfig + injection hooks
│   └── telemetry/                 # every action recorded as JSON
│       ├── types.ts               # ReplayEvent, ReplayLog
│       ├── recorder.ts            # records events during run
│       ├── replayer.ts            # replayGame(log) — byte-perfect
│       ├── hasher.ts              # hashState() → pre/postStateHash
│       └── artifacts.ts           # saves failing seeds to /artifacts/
├── game/                          # playable UI — reads telemetry; sends actions to runtime
│   ├── index.html
│   ├── game.ts                    # compiled to game.js; no direct engine imports
│   └── styles.css                 # shares tokens with debugger/styles.css
├── debugger/                      # QA tool — reads telemetry only
│   ├── index.html
│   ├── debugger.ts
│   └── styles.css
├── tests/
│   ├── unit/                      # fast, no fast-check
│   │   ├── engine/
│   │   │   ├── combat.test.ts
│   │   │   ├── resolution.test.ts
│   │   │   ├── statuses.test.ts
│   │   │   └── tension.test.ts
│   │   └── runtime/
│   │       └── rng.test.ts
│   ├── property/                  # fast-check
│   │   ├── invariants.test.ts
│   │   ├── dramaturgy.test.ts
│   │   ├── metamorphic.test.ts
│   │   └── boss.test.ts
│   ├── replay/
│   │   └── replay.test.ts
│   ├── fault/
│   │   └── fault-injection.test.ts
│   └── ui/                        # Playwright — tests both game UI and debugger
│       ├── game.test.ts
│       └── debugger.test.ts
├── scripts/
│   └── simulate.ts                # npm run simulate — Monte-Carlo mode
├── artifacts/                     # failing seeds (gitignored except .gitkeep)
│   └── .gitkeep
├── .github/workflows/ci.yml
├── BUGS.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── stryker.config.json
```

**package.json scripts:**
```json
{
  "typecheck":     "tsc --noEmit",
  "test":          "vitest run",
  "test:unit":     "vitest run tests/unit",
  "test:property": "vitest run tests/property",
  "test:replay":   "vitest run tests/replay",
  "test:fault":    "vitest run tests/fault",
  "test:ui":       "playwright test tests/ui",
  "test:mutation": "stryker run",
  "simulate":      "tsx scripts/simulate.ts"
}
```

**Layer coupling rules:**
- `engine/` has zero imports from `testing/`, `runtime/`, `debugger/`, or `game/`
- `debugger/` reads only from `telemetry/` — never imports `engine/` directly
- `game/` reads from `telemetry/` and sends actions to `runtime/` — never imports `engine/` directly
- `runtime/` is the only caller of RNG; `engine/` receives values as arguments
- `game/` and `debugger/` are independent consumers of the same telemetry — they share `tokens.ts` and presentation types, nothing else

### Stack
- TypeScript (strict), Vitest, fast-check, Stryker (mutation)
- Separate GitHub repo — not merged into clinic-booking-api-tests
- BDD/Cucumber optional layer on top (natural language combat scenarios)

### Visual style — Slay the Spire dark with colour accents
Pure HTML + CSS, no canvas, no framework. Card art will be real images (AI-generated or curated free assets — decided during implementation). Game logic is separate from rendering — tests cover logic only; Playwright covers UI layer.

**Rule:** every visual feature must help debugging OR observability OR show deterministic behaviour. Anything purely decorative = skip.

**Colour system — card type = card colour:**

| Type | Background | Glow | Symbol |
|------|-----------|------|--------|
| Attack | `#3d0000` dark red | `rgba(220,50,50,0.4)` | ⚔️ |
| Skill | `#001a3d` dark blue | `rgba(50,100,220,0.4)` | 🛡️ |
| Power | `#1a003d` dark purple | `rgba(120,50,220,0.4)` | ⚡ |
| Curse | `#1a1a1a` near black | none | 💀 |

**CSS techniques:** `box-shadow` for glow; `linear-gradient` for card face; gold `border` (`#c9a84c`); `transform: translateY(-8px) scale(1.03)` on hover; Google Font **Cinzel** for gothic typography.

**Card art:** real image per card (AI-generated or free dark fantasy assets) as `background-image` in card body. Unicode symbols remain for status chips and intent icons.

**Global palette:** `bg: #0d0d1a`, text: `#f0e6d3`, accent gold: `#c9a84c`, HP red: `#c0392b`, energy amber: `#e67e22`.

**Design tokens — exported as a single source (decided 2026-05-15):**
All colours, shadows, and radii as one exported constant — game UI, debugger, CI screenshots, and corruption screens all import from here:
```ts
export const tokens = {
  colors: {
    bg:          "#0d0d1a",
    panel:       "#17172a",
    text:        "#f0e6d3",
    gold:        "#c9a84c",
    bone:        "#cfcfcf",
    hp:          "#b83a3a",
    defend:      "#5c8df6",
    bleed:       "#7a1f1f",
    vulnerable:  "#8f5be8",
    corruption:  "#7b1010",
  }
}
```
Corruption screen uses `tokens.colors.corruption`. Debugger uses `tokens.colors.panel`. Visual consistency = visual invariant.

**Status rendering priority (decided 2026-05-15):**
Status chips render in this fixed order — ensures Death's Door is always visible; stun overrides bleed visually:
```ts
const statusRenderPriority = [
  "death_door",   // must always be visible; full-overlay trigger
  "stun",         // player loses action — critical info
  "bleed",        // ongoing damage
  "vulnerable",   // incoming amplifier
  "defend",       // temporary; fades next turn
]
```
This is a visual invariant: order never changes based on stacks or duration. Testable via Playwright snapshot test.

**Card layout rule (decided 2026-05-15):**
Every card renders in the same 3-zone structure — no exceptions:
```
┌─────────────────────┐
│ TITLE               │  ← name
│ [Axis] [Axis]       │  ← axis tags
├─────────────────────┤
│                     │
│  Main effect text   │  ← rulesText[]
│                     │
├─────────────────────┤
│ "Narrative flavour" │  ← optional; in italics
└─────────────────────┘
```
Consistent structure → snapshot testing catches regressions; debugger and combat UI share the same card component.

**Visual features — core stack (decided 2026-05-15):**

- **Animated combat log** — `⚔ Knight hits Goblin for 6 / 🩸 Goblin suffers bleed (2) / 💀 Goblin enters Death's Door`; CSS `animation: fadeIn 0.2s ease`; newest event glows; old entries fade. Cheap, makes replay feel alive.
- **Death's Door visual** — when hero HP = 0: screen tint red + portrait pulse (`@keyframes pulse`). Signature mechanic, ~10 lines CSS. Memorable in README GIF.
- **"Invariant violation" screen** — when `assertValidGameState()` catches impossible state: full-screen overlay styled as a crash report: `INVARIANT VIOLATION / dead entity acted / Seed: 882911 / Turn: 17`. One screenshot sells the entire testing narrative.
- **Status effect chips** — `🩸 Bleed 3 / 🛡 Defend 5 / ⚡ Vulnerable` with glow; inline in combat view and debugger.
- **Enemy intent display** — enemy shows next action before it happens: `⚔ 8` / `🛡 defend`; ties to "telegraphed intents" in engine scope; helps both game UI and replay debugging.

**debugger.html visual upgrades:**
- **Replay scrubber** — drag timeline `|----●---------|  Turn 12 / 28`; upgrade from prev/next buttons; looks like a professional debugging tool immediately.

**Skip:**
- Floating damage numbers — adds JS animation scope without QA narrative benefit
- CSS particles — complexity without signal
- Mutation kill animation — can't demo without Stryker running live
- Auto-play simulation in UI — already covered by `npm run simulate` CLI

---

---

## ⏳ Pending verification — requires Docker

| # | What to run | What to verify |
|---|-------------|----------------|
| 1 | `cd sut && docker compose -f docker-compose.kafka.yml up -d` then `KAFKA_BROKER=localhost:9092 npm run dev` | Log shows `"event":"kafka.connected"` on startup |
| 2 | Book an appointment via API or UI | `docker exec -it sut-kafka-1 kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic clinic.appointment.booked --from-beginning --max-messages 1` returns JSON with `appointmentId`, `patientId`, `timestamp`, `requestId` |
| 3 | `npm run dev` without `KAFKA_BROKER` | SUT starts cleanly; log shows warn `"kafka.connect_failed"` (not error); all API calls work normally |

---

## ⏳ Pending verification — requires Anthropic API credits

All three items were implemented and tested locally; the infrastructure works but the actual AI call failed with "credit balance too low". Verify in this order after top-up.

| # | What to run | What to verify |
|---|-------------|----------------|
| 1 | `DEMO_BUG_REPORTER=true ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env \| cut -d= -f2) npx playwright test bug-reporter.demo` | Allure report (`npm run report`) shows two failed tests, each with a "Bug Report" attachment containing AI-generated markdown (title, severity, steps to reproduce, actual vs expected). File also saved to `bug-reports/`. |
| 2 | `ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env \| cut -d= -f2) npm run ai:gap-analysis` | `docs/AI_GAP_ANALYSIS.md` regenerated by Claude Haiku; compare with current manual version; commit if output is better. |
| 3 | `npx playwright test --grep @rag` | All `@rag` tests pass (LLM eval, LLM judge, RAG completeness, prompt injection, graceful degradation). These use real Claude calls and were last green before the balance ran out. |

---

## Feature backlog (SUT + tests)

| Item | Status | Notes |
|------|--------|-------|
| Multi-tenancy — multiple clinics; `clinicId` on all entities; RBAC scoped per clinic; tests: cross-clinic data isolation | [ ] | |
| Audit trail | skipped | Pino + Loki/Grafana already covers this at production level; no portfolio value in adding a DB table on top |
| Notifications (webhook) | [x] done 2026-05-01 | `notificationService.js`; `notifications.webhook.test.js` (3 tests) + E2E in `booking.cross-layer.test.js` |
| Payments (online consultations) | [x] done 2026-05-01 | `POST /api/v1/consultations`; `PAYMENT_MODE`; `X-Idempotency-Key`; `consultations.payment.test.js` (6 tests) |
| WebSocket notifications | [x] done 2026-05-01 | `ws://localhost:3000/ws?token=<JWT>`; `notifications.ws.test.js`; SUT bug fixed 2026-05-03 |
| AI integration — RAG | [x] done 2026-05-04 | real Claude call (`claude-haiku-4-5-20251001`); mock mode; LLM eval + prompt injection + graceful degradation |
| COMPLETED appointment status — new terminal state | [x] done 2026-05-13 | SUT: state machine + repository + route + metrics + UI (doctor + patient) + OpenAPI + API_ENDPOINTS.md. Tests planned below. |
| Recurring appointments | [~] SUT done 2026-05-15 | `POST /api/v1/appointments/recurring` + `PATCH /series/:seriesId/cancel`; `seriesId` column on appointments; weekly pattern; partial booking model; UI: series badge + Cancel series button. Tests planned below. |
| **Appointment notes** — patient + doctor add notes to appointment; `POST /appointments/:id/notes`, `GET /appointments/:id/notes` | [ ] | 🔴 Strong: XSS (OWASP A03) + IDOR (OWASP A01); note on cancelled appt; character limit bypass. **UI bugs:** XSS renders in note display; IDOR visible in UI (patient sees another patient's note); stale data after save without reload. **Integration bugs:** note saved via API → UI shows old data without refresh; doctor note visible to patient when it shouldn't be; note on soft-deleted appointment still returned |
| **Search / filtering + Pagination** — `GET /appointments?status=&doctorId=&from=&page=&limit=` | [ ] | 🔴 Strong: SQL injection; off-by-one; total mismatch after filter; unstable sort across pages |
| **Soft delete** — `deletedAt` on users/doctors/slots instead of hard delete | [ ] | 🔴 Strong: JWT valid after delete (security); deleted doctor's appts still active; deleted slot bookable if filter missing. **UI bugs:** deleted doctor still appears in booking dropdown; cancelled slot shows as available if filter missing in frontend. **Integration bugs:** JWT remains valid after soft-delete → all API calls pass; one missing `WHERE deletedAt IS NULL` in SQL → deleted records visible everywhere; deleted doctor's future appointments not auto-cancelled |
| **Doctor ratings** — patient rates doctor after `completed` appointment only; `POST /appointments/:id/rating` | [ ] | 🔴 Strong: rating before completed (state machine); double rating (idempotency); wrong patient sees rating (IDOR). **UI bugs:** rating stars visible on `pending` appointment (should not render); double-click submits two ratings; average rating in doctor list wrong after submit. **Integration bugs:** rating saved → average recalculated in DB → doctor list shows stale number; rating allowed after doctor soft-deleted |
| **Bulk cancel (doctor sick day)** — `PATCH /doctors/:id/appointments/cancel?date=` (admin only) | [ ] | 🟡 Medium: partial transaction failure; waitlist cascade for all freed slots; RBAC (admin only); large dataset timeout |
| **GDPR data export** — `GET /patients/me/export` returns all personal data as JSON | [ ] | 🟡 Medium: includes other patients' data (IDOR); sensitive fields unmasked; export of deleted data |
| **API versioning** — v2 with breaking change (e.g. renamed field) alongside v1 | [ ] | 🟡 Medium: v1 works after deprecation; token crosses versions; Pact consumer needs update |
| **Appointment type / duration** — `type: consultation|procedure`; consultation = 15 min, procedure = 60 min; affects slot blocking and billing | [ ] | 🔴 Strong: two 15-min slots overlap with one 60-min block; UI shows wrong duration; billing calculated on wrong type. **UI bugs:** duration label wrong in appointment list; slot picker doesn't account for 60-min block when showing availability. **Integration bugs:** slot overlap check uses fixed 15-min window → procedure double-books; type not validated on reschedule → duration changes silently |
| **Doctor schedule / working hours** — doctor sets working hours per weekday; slots only generated within schedule; `GET /doctors/:id/schedule`, `PUT /doctors/:id/schedule` | [ ] | 🔴 Strong: boundary values (slot at exactly end-of-day — valid or not?); API bypass creates slot outside hours; UI shows out-of-schedule slots. **UI bugs:** booking dropdown includes slots outside working hours; schedule UI shows wrong day boundary. **Integration bugs:** slot created via direct API outside schedule hours → bookable; timezone edge case (slot at 17:00 UTC vs local); existing slots not invalidated when schedule changes |
| Redis caching — doctors list | [ ] | |
| Admin dashboard endpoint | [ ] | |
| Microservices — extract ai-service | [ ] | Iteration 5 |
| Kafka / async messaging | [~] SUT done 2026-05-15 | `src/kafka/producer.js` + `src/kafka/topics.js`; `docker-compose.kafka.yml` (KRaft, bitnami/kafka:3.7); 8 topics; graceful degradation if `KAFKA_BROKER` not set; tests planned below |

---

## Testing backlog

| Item | Status | Notes |
|------|--------|-------|
| Mobile viewport | [x] done 2026-05-01 | `devices["Pixel 7"]`; 12/12 pass |
| Chaos mode | [x] done 2026-05-02 | 6 tests complete |
| Visual regression | [x] done 2026-05-08 | `tests/ui/visual.test.js`; 3 tests × 2 browsers = 6 baselines |
| Rate limit tests — CI | [x] done 2026-05-15 | `.github/workflows/rate-limit.yml`; manual trigger; SUT started with `RATE_LIMIT_*_MAX=2` + 5 s window; skip guards in test files activate on MAX ≤ 5 |
| Kafka event tests | [ ] | `tests/api/appointments.kafka.test.ts`; skip guard: `KAFKA_BROKER` not set; requires `docker compose -f docker-compose.kafka.yml up -d`; test plan below |
| Pagination tests | [ ] | `tests/api/appointments.pagination.test.ts`; `GET /appointments/my` + `GET /appointments/doctor`; 7 tests; shape contract, offset correctness, NaN/division-by-zero guards; test plan below |
| **List-level AJV schemas** — add `validateAppointmentList` (array) + `validatePaginatedAppointments` (paginated envelope); call `assertSchema(body, validateAppointmentList)` in existing list tests | [ ] | Gap found: `validateAppointment` validates one object, nothing validates response envelope (array vs object); pagination change slipped through silently; schema in `data/schemas/appointmentSchemas.ts` |
| Regression: "chest pain" → Cardiologist | [ ] | add to `unit/ai.retrieval.test.js`; found during Pact 2026-05-08 |
| Regression: doctors.length > 0 after AI recommendation | [ ] | add assertion to AI tests; found during Pact 2026-05-08 |
| Mutation testing | [x] done 2026-05-01 | 92% score; `appointmentStateMachine.js` |
| Load testing (k6) | [x] done 2026-05-01 | `k6/booking-flow.js`; 50 VUs; CI gate still pending |
| k6 in CI with performance gate | [x] done 2026-05-12 | `performance.yml` workflow — manual trigger; docker-compose override raises rate limits; k6 exits 1 on threshold breach |
| Swagger / contract drift guard | [x] done 2026-05-04 | `tests/api/contract.drift.test.js`; 5 tests |
| TypeScript migration + Playwright fixtures for page objects | [ ] | gradual TS migration; introduce `test.extend()` fixture injection for page objects at the same time — no point refactoring JS first then migrating separately |
| LLM as a judge | [x] done 2026-05-04 | `ai.recommend.test.js` line 152 — second Claude evaluates reasoning vs symptoms; `@rag` |
| RAG completeness metrics | [x] done 2026-05-09 | `ai.recommend.test.js` — calls `retrieve()` locally, counts retrieved specialty names in reasoning; asserts recommended specialty present + coverage ≥ 50%; `@rag` |
| Contract testing with Pact | [x] done 2026-05-08 | consumer (3 interactions) + provider verifier; `npm run test:pact` |
| DB state assertions | [x] done 2026-05-01 | inline via `utils/dbClient.js` |
| Observability-driven testing | [x] done 2026-05-02 | `observability.loki.test.js`; Loki query after booking |
| Property-based testing (fast-check) | [x] done 2026-05-02 | `appointmentStateMachine.test.js` in SUT |
| AI-assisted test generation artifact | [x] done 2026-05-04 | `docs/AI_TEST_GENERATION.md` |
| Test orthogonality map | [x] done 2026-05-02 | §17 in TEST_STRATEGY.md; 36 files mapped |

---

## Bug-rich features — candidates for next SUT iteration

Three features chosen because they naturally produce interesting failure modes.

### ~~Reschedule appointment~~ ✅ done 2026-05-09
`PATCH /appointments/:id/reschedule` — implemented in SUT + UI. Tests planned (TS migration first).

**Implemented:** `rescheduleAppointment()` in `appointmentsRepository.js`; route in `appointmentsRoutes.js`; OpenAPI spec updated; "Reschedule" button + inline form in `patient-appointments.html`.

**State machine decision:** `pending` and `confirmed` → reschedule → always `pending` (doctor must re-confirm). Atomic transaction: free old slot + promote waitlist + book new slot.

**Error codes:** `SLOT_TAKEN` (409), `DOCTOR_MISMATCH` (422), `SAME_SLOT` (422), `INVALID_TRANSITION` (422), `SLOT_NOT_FOUND` (404).

**Test plan (write after TS migration):**
- 200 reschedule from `pending` → new slot, status `pending`
- 200 reschedule from `confirmed` → status resets to `pending`
- 409 new slot already taken
- 422 reschedule `cancelled` appointment
- 422 new slot belongs to different doctor
- 422 same slot as current
- 403 patient does not own appointment
- waitlist cascade: old slot freed → waitlist patient promoted
- UI: Reschedule button visible for pending/confirmed only
- UI: successful reschedule refreshes list

### ~~COMPLETED appointment status~~ ✅ done 2026-05-13
`PATCH /appointments/:id/complete` — doctor-only terminal transition from `confirmed`.

**Implemented:** `completeAppointmentByDoctor()` in `appointmentsRepository.js`; route in `appointmentsRoutes.js`; state machine updated (`confirmed → completed`, `completed: []`); `appointments_completed_total` metric; "Mark as completed" button in `doctor-appointments.html`; `completed` label + filter in `patient-appointments.html`; OpenAPI + `API_ENDPOINTS.md` updated.

**Key design decisions:** slot is NOT freed (visit has occurred); waitlist is NOT promoted (no-op, slot is past); patient notified via WS `appointment.completed` + webhook.

**Test plan — Tier 1 (high risk, covers real bugs and business invariants):**
- `PATCH /:id/complete` happy path: `confirmed → completed` → 200, `status: "completed"`
- Slot stays unavailable after complete — business invariant: visit occurred, slot must not reopen (guards against copy-paste of cancel logic)
- Waitlist NOT promoted after complete — guards against accidental `promoteFromWaitlist` call; if triggered, a patient gets booked into a past slot
- `pending → completed` → 422 `INVALID_TRANSITION` — completing a not-yet-confirmed appointment loses confirmation from audit trail
- `completed → completed` → 422 — double-click / retry must not fire duplicate WS events or silently change `updatedAt`
- Wrong doctor (not slot owner) → 403 — IDOR; real precedent in this project
- Patient calls `/complete` → 403 — RBAC; patient must not self-close their own appointment

**Test plan — Tier 2 (notification chain + UI invariants):**
- WS: patient receives `appointment.completed` event after doctor completes — regression guard for notification chain (was silently broken before with ClinicCore bug)
- E2E: completed appointment shows no action buttons in patient UI — if `pending || confirmed` filter not updated, patient sees "Cancel" on a closed visit → 422 UX confusion

### Recurring appointments
SUT done 2026-05-15. `POST /api/v1/appointments/recurring` + `PATCH /api/v1/appointments/series/:seriesId/cancel`.

**Design:** `seriesId` (UUID) on each appointment in the series; weekly pattern finds slots by same doctor + same weekday + same time; partial booking model — books all available, returns unavailable list.

**API test plan — `tests/api/appointments.recurring.test.ts`:**
- `POST /recurring` — 201 books all available slots, returns seriesId on each @smoke
- `POST /recurring` — 201 partial: some slots taken → books rest, returns unavailable list
- `POST /recurring` — 422 no slots match weekly pattern
- `POST /recurring` — 403 doctor cannot book recurring series
- `PATCH /series/:seriesId/cancel` — 200 cancels all pending + confirmed in series @smoke
- `PATCH /series/:seriesId/cancel` — 200 cancel one via /:id/cancel leaves rest of series intact
- `PATCH /series/:seriesId/cancel` — 200 freed confirmed slots trigger waitlist promotion
- `PATCH /series/:seriesId/cancel` — 403 patient cannot cancel another patient's series

**UI test plan — `tests/ui/` (@ui):**
- patient appointments — series badge visible on recurring appointments
- patient appointments — Cancel series button absent for cancelled appointments
- patient appointments — cancel series shows confirmation dialog
- patient appointments — after cancel series all series items disappear from list

**E2E test plan — `tests/e2e/recurring.cross-layer.test.ts` (@e2e):**
- recurring appointments — book series via API → UI shows all with series badge → DB confirms all slots taken
- recurring appointments — cancel series via UI → DB confirms slots freed
- recurring appointments — cancel one via UI → sibling appointments still active in DB

### Kafka event tests
`tests/api/appointments.kafka.test.ts` — skip guard: `KAFKA_BROKER` not set → all tests skipped.
Requires: `docker compose -f sut/docker-compose.kafka.yml up -d` before test run.
Consumer setup: KafkaJS consumer in `beforeAll`, subscribe to all `clinic.*` topics, collect messages during test.

**Test plan — `tests/api/appointments.kafka.test.ts` (@kafka):**
- `POST /appointments` → event on `clinic.appointment.booked`; payload has `appointmentId`, `patientId`, `slotId`, `status: "pending"`, `timestamp`, `requestId` @smoke
- `PATCH /:id/cancel` (patient) → event on `clinic.appointment.cancelled`; payload has `cancelledBy: "patient"`
- `PATCH /:id/confirm` (doctor) → event on `clinic.appointment.confirmed`; payload has `doctorId`
- `PATCH /:id/reject` (doctor) → event on `clinic.appointment.rejected`; payload has `doctorId`
- `PATCH /:id/reschedule` → event on `clinic.appointment.rescheduled`; payload has `newSlotId`
- `PATCH /:id/complete` → event on `clinic.appointment.completed`; payload has `doctorId`, `status: "completed"`
- `POST /recurring` → event on `clinic.appointment.recurring_booked`; payload has `seriesId`, `bookedCount`, `appointmentIds[]`
- `PATCH /series/:seriesId/cancel` → event on `clinic.appointment.series_cancelled`; payload has `seriesId`, `cancelledCount`
- Graceful degradation: `KAFKA_BROKER` not set → SUT starts, API calls succeed, no errors in response @smoke

### Pagination — `GET /appointments/my` + `GET /appointments/doctor`
SUT done 2026-05-15. Query params `?page=&limit=` (page ≥ 1, limit 1–100); response `{ data, total, page, limit, totalPages }`.

**API test plan — `tests/api/appointments.pagination.test.ts` (@api):**
- `GET /appointments/my` no params → 200 `{ data[], total, page:1, limit:20, totalPages }` shape valid @smoke
- `GET /appointments/my?page=1&limit=5` → returns max 5 items; `totalPages = ceil(total/5)`
- `GET /appointments/my?page=2&limit=1` → returns second item (correct offset); `page=2` in response — off-by-one in `OFFSET=(page-1)*limit` shows wrong appointments
- `GET /appointments/my?limit=0` → 400 `VALIDATION_ERROR` — division by zero → `totalPages: NaN/Infinity` breaks UI
- `GET /appointments/my?page=0` → 400 `VALIDATION_ERROR` — negative OFFSET in SQL returns wrong data silently
- `GET /appointments/my?page=abc` → 400 `VALIDATION_ERROR` — NaN in OFFSET, SQLite behaviour unpredictable
- `GET /appointments/doctor` no params → 200 paginated response (doctor JWT) @smoke

### Slot hold / provisional booking
Temporary hold for 10 minutes while patient fills form.

Bugs to expect:
- Race between hold expiry and patient confirming
- Background timer vs manual operations (similar to auto-expiry already in codebase)
- Waitlist behaviour while slot is in hold status

---

## UI testing gaps — strong signal

| Item | Status | Notes |
|------|--------|-------|
| **Visual snapshots — appointment states** — screenshot baselines for each appointment status in patient list: `pending`, `confirmed`, `completed` (no action buttons), `cancelled`, recurring (series badge + Cancel series button) | [x] done 2026-05-15 | `visual.test.ts` extended; 8 baselines (4 states × 2 browsers); `AppointmentsPage` type updated; `completeAppointment` added to client; 2 SUT HTML bugs fixed (pagination broke array check) |
| **`page.route()` error states** — intercept API calls from browser, return 500 / network drop; assert UI shows error message not crash | [x] done 2026-05-15 | `tests/ui/api-error-states.test.ts`; 3 tests × 2 browsers = 6; booking 500 → `booking-form-message` not empty; cancel 500 → appointment stays + error banner; network abort on load → banner visible |

---

## UI improvements — visual polish

| Item | Signal | Status | Test impact |
|------|--------|--------|-------------|
| **Toast notifications** — replace `alert()` / inline error banners with slide-in toasts; auto-dismiss after 4s | 🔴 Strong | [x] done 2026-05-15 | SUT: `ClinicApp.showToast()` in app-core.js + CSS `#toast-container .toast .toast--{type}`; doctor-appointments: removed `#bannerSuccess`, success actions → toast; patient-appointments: success toasts for cancel/reschedule/waitlist/offers; E4 test updated: `bannerSuccess` → `toastSuccess (.toast.toast--success)` |
| **Coloured status badges** — `pending` = amber, `confirmed` = green, `completed` = slate, `cancelled` = red pill badges | 🔴 Strong | [x] done 2026-05-15 | SUT: `.status-badge` CSS + badge `<span>` in patient-appointments.html + doctor-appointments.html; `data-qa="status-badge"`; visual baselines updated (8 снапшотов) |
| **Dark mode** — `prefers-color-scheme: dark` via CSS variables already in `app.css` | 🔴 Strong | [x] done 2026-05-15 | `@media (prefers-color-scheme: dark)` block in app.css: `:root` token overrides (dark navy palette) + workspace-specific overrides (patient teal, doctor indigo); component overrides for labels, secondary buttons, banners, form messages, status badges, danger zone, schedule elements; `color-scheme: light dark` on `:root` for native control theming. No new tests — headless Playwright defaults to light mode, existing visual tests unaffected. |
| **Skeleton loading** — grey placeholder cards while appointment list loads | 🟡 Medium | [ ] | Test: skeleton visible on slow network (`page.route` + delay) → data loads → skeleton gone |
| **Empty state** — illustration + CTA when no appointments exist instead of blank page | 🟡 Medium | [x] done 2026-05-15 | SVG calendar icon + title + text + "Browse available times" CTA; filter-mismatch gets magnifier icon + "No results"; doctor page same pattern without CTA; `data-qa="patient-appt-empty"` + `data-qa="patient-appt-empty-cta"` |
| **SVG icons inline** — calendar, user, check, x icons next to labels; no external dependency | 🟡 Medium | [ ] | Visual regression catches icon missing after HTML change |
| **CSS transition animations** — fade-in for cards, slide for toasts | 🟢 Low | [ ] | `animations: 'disabled'` already set in visual tests — no extra work needed |

---

## UI bug-rich features — candidates for next iteration

### Multi-step booking wizard *(recommended)*
Split booking into steps: pick doctor → pick slot → confirm.

Bugs to expect:
- Back navigation (slot released or held?)
- Slot taken between step 2 and 3
- URL manipulation to skip a step
- Progress indicator out of sync

**UI bugs:** back button doesn't release held slot — UI thinks booking is abandoned but slot stays locked; progress bar shows step 3 when user navigated back to step 1; URL `/booking/step3` accessible directly without completing step 1-2.
**Integration bugs:** slot held at step 2, user closes browser → slot never released (no TTL cleanup); step 3 "confirm" request sent but slot taken by another user since step 2 → race condition between layers; slot hold creates DB record but cleanup job doesn't run in test environment.

### Real-time appointment status for patient
WebSocket already exists for doctor side; add patient side (`pending → confirmed` without refresh).

Bugs to expect:
- Race between "cancel" and doctor confirming
- Missed event after WS reconnect
- Desync between tabs

### Optimistic UI on appointment cancel
Hide appointment immediately, call API in background; rollback on failure.

Bugs to expect:
- Double-click (two requests)
- Rollback to correct position in list
- Unclosed spinner if component unmounted

---

## Advanced tooling — portfolio differentiators

- [ ] **Impact Analysis (Claude API + git diff)** — on each PR/commit: Claude reads git diff → determines which test files are genuinely at risk → runs only those tests → posts comment to PR with results. Reduces regression time from full suite to targeted run. JavaScript/Playwright + Claude API (ANTHROPIC_API_KEY already in .env). Idea noted 2026-05-10.
  - **Prompt structure (from George Kolath, QE Practice Head):** raw diff + test directory structure + short description of naming conventions → Claude reasons scope mapping reliably without parsing import graphs.
  - **Key insight:** tricky part is confidence thresholds, not LLM reasoning. Run a lightweight smoke set in parallel as safety net. Two layers together: pre-execution narrowing + targeted execution.
  - **George offered to share prompt template** — follow up via LinkedIn DM.
- [x] **Schemathesis — API fuzzing from OpenAPI spec** *(done 2026-05-12)* — ran against live SUT, 35 operations, 408+ scenarios generated automatically. Found: malformed JWT → `400 <EMPTY>` (error contract violation), TRACE → 404 not 405, missing `401` in spec for auth endpoints. Documented in `SYSTEM_WEAKNESS_REPORT.md` §5.
- [x] **OWASP ZAP in CI — automated security scan** *(done 2026-05-12)* — `security-scan.yml` workflow — manual trigger; Docker ZAP baseline scan against SUT; HTML + JSON report as CI artifact; `-I` flag: only fail on HIGH alerts.
- [ ] **BrowserStack integration** — add BrowserStack project to `playwright.config.js`; run existing tests on real Safari + real devices (not emulation); requires trial account + `BROWSERSTACK_USERNAME` + `BROWSERSTACK_ACCESS_KEY` in `.env`. Closes the gap between Pixel 7 emulation and real device coverage.

---

## QA process artifacts — missing

- [ ] **Formal bug reports** — write up 4-5 real bugs found (IDOR, WS silent bug, retrieval quality, empty doctors, a11y) as standalone bug report documents: title, severity, priority, environment, steps to reproduce, actual vs expected, fix applied.
- [ ] **Exit criteria / Definition of Done for testing** — document: what must be true before merge/release. Not just "all tests green" — specific criteria: which tags are mandatory, which metrics hold, what is a blocker.
- [ ] **RTM (Requirements Traceability Matrix)** — table: user story / requirement → test file → result. Different from orthogonality map (that is file→risk); RTM traces from business requirements. Strong signal for enterprise and compliance teams.
- [x] **AI-generated bug report from failed test** *(done 2026-05-09)* — `utils/aiBugReporter.js` + `afterEach` in base fixture; on failure calls Claude Haiku, attaches markdown report to Allure AND saves to `bug-reports/`; skip guard: `ANTHROPIC_API_KEY` not set → silent no-op; demo: `DEMO_BUG_REPORTER=true npx playwright test bug-reporter.demo`.
- [x] **AI gap analysis from OpenAPI spec** *(done 2026-05-09)* — `scripts/ai-gap-analysis.js` + `npm run ai:gap-analysis`; reads `openapi.yaml` + test names → Claude Haiku → structured markdown: endpoints with no coverage, untested error codes, additional scenarios. Artifact: `docs/AI_GAP_ANALYSIS.md`; regenerate before each release cycle. Note: requires ANTHROPIC_API_KEY with balance.
- [ ] **AI-generated test data for content stress testing** — instead of hardcoded `"John Doe"`, a script or fixture calls Claude to generate realistic edge-case inputs: `O'Brien`, long emails (82 chars), names with special characters, Unicode. Closes the "Content stress testing" backlog item and shows AI used as a data generator, not just a code generator.
- [ ] **AI-generated CI run summary** — post-CI script reads `playwright-report/results.json`, sends to Claude, gets a human-readable summary: pass/fail counts, affected components, failure patterns. Auto-generates a machine-written version of `TEST_SUMMARY_STAKEHOLDER.md`. Saves as CI artifact; can be posted to Slack or PR comment.

---

## PM / stakeholder artifacts — missing

- [x] **Go / No-Go recommendation** *(done 2026-05-12)* — `docs/GO_NO_GO.md`; Conditional Go; 4 fixed bugs, 2 open AI issues (product decision required), reschedule flagged as controlled rollout; post-release monitoring signals included.
- [x] **Non-technical test summary** *(done 2026-05-09)* — `docs/TEST_SUMMARY_STAKEHOLDER.md`; traffic-light per area, 4 fixed bugs in plain English, 2 open issues with options, release recommendation.
- [x] **Known issues register** *(done 2026-05-09)* — `docs/KNOWN_ISSUES.md`; 4 fixed + 2 open + 3 design debt; found by: security tests, a11y tests, E2E WS tests, Pact provider verification.

---

## Designer / UX perspective — missing

- [ ] **UI states testing** *(strongest signal)* — explicitly test all 5 states of each screen: empty state (no data), loading state (data loading), error state (API returned error), success state (action completed), disabled state (button unavailable). Current tests cover only happy path behaviour. **Implementation approach:** use `page.route()` + `route.fulfill()` to intercept API calls — return `500` for error state, `[]` for empty state, delayed response for loading state. No DB manipulation needed. Happy paths stay DB-backed in E2E layer.
- [ ] **Content stress testing** — edge cases in content: very long patient name (layout break?), email 80+ chars (truncated or wrapped?), name with apostrophe (O'Brien), special characters.

---

## Mobile testing — Phase 2 (separate Appium project)

Native mobile app (React Native or Flutter) + Appium + WebdriverIO; BDD/Cucumber from the start.
Phase 1 (Playwright viewport) done. Phase 2 is a separate repo — intentionally a different skill set.

### 🔴 Strong signal

| Item | Status | Notes |
|------|--------|-------|
| **Push notification automation** — Appium reads Android notification center; assert notification text + tap opens correct screen | [ ] | 90% QA test push manually; automation here is a real differentiator |
| **WebSocket background reconnect** — iOS kills WS when app goes to background; test reconnect logic and missed-event recovery | [ ] | Same bug pattern already found in web (ClinicCore WS); on iOS it's systemic and predictable — strong portfolio story |
| **Deep links** — `clinic://appointment/123` from push notification → OS → deep link handler → correct screen with correct API data | [ ] | Multi-layer: push → OS → app → API; each hand-off is a failure point |
| **Offline + sync conflict** — patient cancels offline; doctor confirms online in parallel; assert conflict resolved correctly on reconnect | [ ] | Medical data integrity story; conflict resolution is serious interview material |
| **Biometric auth** — Face ID / Touch ID via Appium mock (`BiometricAuthentication` capability) | [ ] | Most QA don't know this is automatable; immediate differentiator |

### 🟡 Medium signal

| Item | Status | Notes |
|------|--------|-------|
| **Interrupted booking flow** — phone call mid-booking sends app to background; assert form data preserved and slot hold survives on return | [ ] | Links to slot hold feature; direct integration between OS lifecycle and SUT |
| **Certificate pinning test** — mitmproxy intercepts traffic; app must reject connection | [ ] | Security × mobile; non-trivial setup; strong for security-focused roles |
| **Gesture testing** — swipe to cancel appointment, pull-to-refresh list | [ ] | Appium W3C Actions; not all QA can automate gestures |
| **Screenshot prevention** — `FLAG_SECURE` on screens with medical data; screenshot API returns black image | [ ] | GDPR × security × mobile; verifiable in Appium |

### 🔴 Strong signal — mobile-native only (no API layer equivalent)

| Item | Status | Notes |
|------|--------|-------|
| **TalkBack / VoiceOver automation** — Appium navigates with screen reader enabled; asserts content announced correctly, focus order logical, interactive elements labelled | [ ] | axe-core doesn't cover this; legally required in UK (Equality Act); very few QA automate it — immediate differentiator |
| **Device timezone mismatch** — device in UTC+5, server in UTC; appointment at "10:00" must display in local time | [ ] | Booking apps fail here most often; bug invisible at API level — lives between server response and display layer |
| **Android Doze mode** — `adb shell dumpsys deviceidle force-idle`; assert push notification delayed and background sync stopped | [ ] | Reproducible in test; real prod scenario; shows you know Android power management |
| **Data at rest encryption** — medical data in local storage must be encrypted; verified via `adb shell` + SQLite inspector on device | [ ] | GDPR × security × mobile; impossible to verify at API level — only on device |
| **App update migration** — user on v1 updates to v2; local DB schema changes; cached JWT format changes; assert no data loss or crash | [ ] | Real prod scenario almost nobody automates; shows lifecycle thinking |

### 🟡 Medium signal — mobile-native only

| Item | Status | Notes |
|------|--------|-------|
| **Network switching mid-session** — WiFi → cellular → offline during active booking; `adb shell svc wifi disable` | [ ] | Controllable in test; verifies retry logic and graceful degradation |
| **Runtime permissions denied** — patient declines notification permission after login; app degrades gracefully vs crashes | [ ] | Shows defensive programming awareness; permission flow is mobile-specific |
| **Memory leak detection** — long session with many navigations; `adb shell dumpsys meminfo`; assert memory growth stays bounded | [ ] | Niche but shows performance thinking; differentiates from standard functional QA |

### 🔴 Strong signal — mobile-native features (rich test scenarios)

| Item | Status | Notes |
|------|--------|-------|
| **QR code check-in** — patient shows QR at reception; doctor scans → appointment status → `checked_in` | [ ] | Appium injects image into camera; offline QR (cached without network); expired QR → graceful error; full chain: camera → decode → API → UI update; ties directly into appointment state machine |
| **Calendar sync** — booking auto-added to iOS Calendar / Google Calendar; updated on reschedule; deleted on cancel | [ ] | Calendar permission denied → fallback; timezone matches device; no duplicate on re-sync; event deleted in calendar → what happens in app? |
| **Video consultation** — in-app video call between patient and doctor; extends existing consultation feature | [ ] | Camera + microphone permissions; reconnect on network loss; quality degradation on 3G; second participant timeout; recording blocked (GDPR); directly extends existing `POST /api/v1/consultations` |
| **Local notifications** — app schedules reminder 24h before appointment locally (not server push); survives app kill; cancelled when appointment cancelled | [ ] | Fires at correct local time; cancelled when appointment cancelled; no duplicate on reschedule; delayed in Doze mode? |

### 🟡 Medium signal — mobile-native features

| Item | Status | Notes |
|------|--------|-------|
| **Document upload** — patient photographs medical document and attaches to appointment | [ ] | Camera vs photo library permission; file size limit; image compression; invalid format rejected |
| **Home screen widget** — next appointment shown on home screen; background refresh every N minutes | [ ] | Updates after cancel; correct timezone; expired session → widget shows login prompt not stale data |

### 🔴 Strong signal — mobile performance (different from k6 — client-side, not server-side)

| Item | Status | Notes |
|------|--------|-------|
| **Cold / warm start time** — time to first interactive screen | [ ] | `adb shell am start -W`; cold start < 2s, warm start < 1s (industry standard); fail CI if threshold breached |
| **Frame rate / jank** — scrolling appointment list at 60fps | [ ] | `adb shell dumpsys gfxinfo`; janky frames > 0 = UX bug; assert 0 janky frames after list render |
| **Battery consumption per flow** — mAh consumed during full booking flow | [ ] | `adb shell dumpsys batterystats --reset` before; measure after; medical app must not drain battery excessively |
| **Network payload size** — API response sizes on mobile traffic | [ ] | Charles Proxy / network interceptor; assert gzip enabled; images compressed; each KB costs user money on mobile data |

### 🔴 Strong signal — AI features (genuinely new, no web equivalent)

| Item | Status | Notes |
|------|--------|-------|
| **Voice-to-booking** — speech → speech-to-text → intent extraction (doctor type + date) → book appointment | [ ] | New: audio quality as test variable; microphone permission denied → text fallback; LLM judge evaluates intent extraction accuracy (different from symptom→specialty — must parse "next Tuesday" → concrete date); background noise breaks recognition |
| **On-device AI inference** — Core ML / TensorFlow Lite symptom screener runs without network | [ ] | Entirely new class: model file not loaded → fallback; on-device vs API accuracy delta test; battery impact of inference; privacy assertion via network monitor — no data leaves device during inference |
| **Multi-turn chatbot context** — conversation state preserved across messages; "I have a headache" → follow-up questions → slot suggestion | [ ] | New pattern: context window management (what happens at message 20?); context lost on app background → foreground; prompt injection via message field already covered in web @rag — only multi-turn state is new here |

### 🔴 Strong signal — security (mobile-specific)

| Item | Status | Notes |
|------|--------|-------|
| **Root / jailbreak detection** — app refuses to run on rooted Android / jailbroken iOS | [ ] | Required for medical apps; verifiable in Appium (emulator = rooted environment by default — must be explicitly handled) |
| **Sensitive data in logs** — `adb logcat` must not expose JWT tokens, patient data, or API keys | [ ] | GDPR × security; simple adb check but commonly missed; runnable in CI pipeline |
| **Tapjacking** — malicious app overlays transparent window over booking confirmation screen | [ ] | Android-specific overlay attack; rarely tested; strong signal for security-focused roles |

### 🔴 Strong signal — infrastructure (mobile CI/CD)

| Item | Status | Notes |
|------|--------|-------|
| **Fastlane + GitHub Actions** — automated build → sign → test → deploy to TestFlight / Firebase App Distribution | [ ] | Without this the mobile project isn't production-grade; shows mobile DevOps thinking alongside test skills |
| **Crash analytics (Firebase Crashlytics)** — assert crashes reported with correct metadata (screen, OS version, user context) | [ ] | Meta-testing; shows monitoring mindset; complements observability work already in web project |
| **Feature flags (Firebase Remote Config)** — A/B test new booking flow; enable video consultation per flag | [ ] | Direct extension of feature flag testing; same concept as chaos/payment mode flags but at mobile infrastructure level |

### 🔴 Strong signal — compatibility

| Item | Status | Notes |
|------|--------|-------|
| **OS version matrix** — Android 10–14, iOS 15–17; different API levels produce different bugs | [ ] | Most common cause of "works on my device"; Firebase Test Lab covers automatically; shows you plan for real user distribution |

### 🟡 Medium signal — additional testing types

| Item | Status | Notes |
|------|--------|-------|
| **Monkey testing** — `adb shell monkey` sends random UI events; assert no crashes | [ ] | Chaos mode for mobile UI layer; different from API chaos; complements existing chaos tests |
| **Snapshot testing** — React Native component snapshots (JSON structure, not screenshot); fast structural regression | [ ] | Faster than visual regression; catches component structure changes without image comparison |
| **Exploratory testing with session charters** — structured ET sessions with documented charters and time-boxes | [ ] | Shows QA thinking beyond automation; charter-based ET is standard practice in senior QA roles |

### Architecture — cross-platform test abstraction

One test suite runs against both iOS and Android — platform difference hidden inside Page Objects.

```
tests/
  booking.spec.ts            ← single test, no platform knowledge
  pages/
    BookingPage.ts           ← abstract interface
    ios/BookingPage.ts       ← iOS locators (accessibility id)
    android/BookingPage.ts   ← Android locators (resource-id / content-desc)
```

`driver.capabilities.platformName` selects the correct implementation at runtime.

**Shared across platforms:** business logic, BDD/Cucumber scenarios, API/DB assertions.
**Platform-specific:** locators, biometric capability names, WS background behaviour (iOS kills connection, Android does not), deep link format (`clinic://` vs Android intent).

Portfolio value: shows framework design thinking, not just test writing. Cross-platform abstraction is a standard senior mobile QA interview topic.

---

## BA perspective — missing

- [x] **Acceptance criteria** *(done 2026-05-09)* — `docs/ACCEPTANCE_CRITERIA.md`; 21 features, each with numbered testable criteria; gap table of criteria without test coverage.
- [x] **Business rules document** *(done 2026-05-09)* — `docs/BUSINESS_RULES.md`; 13 domains, 50+ numbered rules, RBAC table, gap list of rules without tests.

---

## DevOps / SRE perspective — missing

- [x] **Dockerfile for SUT + docker-compose.test.yml** *(done 2026-05-09)* — `sut/docker-compose.test.yml` seeds DB, exposes `:3000`, bind-mounts `./data` for `dbClient.js` access; CI uses `docker compose up -d --wait` / `docker compose down` in every job — no curl loop, no orphan processes, local == CI.
- [ ] **Global teardown strategy on crash** — if a test fails mid-way, test users and data remain in DB. `finally` exists locally in some tests. Need explicit strategy: global teardown hook or documented approach to cleanup after partial failure.

---

## Career actions (not project backlog)

- [ ] Elevator pitch (30 sec): "I'm a QA engineer focused on API and AI testing. I build test systems that find real bugs — not just verify happy paths."
- [ ] LinkedIn recommendations — 1-2 from colleagues or manager
- [ ] Numbers on CV: "111-test suite across 7 layers", "caught 7 real unplanted bugs", "92% mutation score", "AI endpoint tested across 5 patterns including LLM-as-a-judge"
- [ ] ISTQB — removes barrier at HR filtering stage
