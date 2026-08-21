---
name: subagent-workflow
description: Delegating research and writing to subagents for large multi-file tasks. Use when: analysing a large codebase section before writing tests; running a search across many files to find patterns or coverage gaps.
triggers:
  - analysing a large codebase section before writing tests
  - running a search across many files to find patterns or coverage gaps
  - tasks with independent parallel parts (research + write + verify)
---

# Skill: Subagent Workflow

## WHEN to load this skill

Load when the task involves:
- Analysing a large codebase section before writing tests
- Running a search across many files to find patterns or coverage gaps
- Tasks with independent parallel parts (e.g. research + write + verify)

---

## WHY

A single agent reading dozens of files pollutes its own context window. Subagents start clean — they don't inherit the conversation history, which means they read faster and stay focused. The main agent delegates research, gets a summary, then acts.

**Rule of thumb:** if a task requires reading more than ~5 files before you can write a single line — delegate the reading to a subagent.

---

## HOW

### Three roles

| Role | Does | Gets |
|------|------|------|
| **Explorer** | reads files, finds patterns, locates code | read-only tools |
| **Writer** | implements the change (page object, test, client method) | edit + write tools |
| **Reviewer** | checks output against conventions from CLAUDE.md / SKILL.md | read-only tools |

### Workflow pattern

```
Main agent
  │
  ├── Explorer subagent ──► "Find all tests that check appointment status transitions"
  │         └── returns: list of files + relevant code excerpts
  │
  ├── [Main reads summary, decides what to write]
  │
  ├── Writer subagent ──► "Add a test for INVALID_TRANSITION in appointments.status.test.ts"
  │         └── returns: file changed + tsc result
  │
  └── [Main reports to user]
```

### Prompt structure for a subagent

A subagent has no conversation context. Write the prompt as if briefing a colleague who just walked in:

```
Task: [what to do]
Project: clinic-booking-api-tests at /Users/.../tests
Stack: Playwright + TypeScript, strict mode
Conventions: [paste the relevant MUST rules or point to SKILL.md]
Input: [exactly what files or data to look at]
Output: [exactly what format you expect back]
```

**Bad prompt:** "Find the appointment tests and check if they cover cancellation."  
**Good prompt:** "Read tests/api/appointments.test.ts. List every test title that mentions 'cancel'. Report as a bullet list. Do not edit any files."

### Parallel subagents

Use parallel subagents when tasks are fully independent:

```
[Patient flow coverage]   [Doctor flow coverage]   [Error contract audit]
       │                          │                         │
       └──────────── merge into one report ────────────────┘
```

### When NOT to use a subagent

- Target file is already known → use Read directly
- Change is < 3 files → do it inline
- The task is sequential (result of step 1 feeds step 2) → single agent, sequential calls

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Large read + targeted write | Explorer subagent → main acts | single agent reads 20 files |
| Two independent audits | parallel subagents | sequential single agent |
| Known file, simple edit | inline Edit tool | unnecessary subagent |
| Subagent prompt | self-contained with context | assumes conversation history |
| Subagent output | structured (bullets, table, code) | free-form prose |

---

## See Also

- `.claude/skills/explore-before-write/SKILL.md` — when to read before writing (single-agent version)
- `CLAUDE.md` — audit-then-edit contract (propose scope before applying)
