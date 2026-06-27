# session-docs-closeout

Use this repo-local Codex skill after Weavly remediation sessions to propose or apply evidence-backed documentation closeout updates.

Example invocations:

```text
Run skill: session-docs-closeout for Batch 2 blocked runtime proof. Do not edit docs yet; propose plan only.
```

```text
Run skill: session-docs-closeout after Batch 2 runtime proof passed. Propose docs edits and wait for approval.
```

```text
Run skill: session-docs-closeout and, after plan approval, update FIX_LOG, LOOP_STATE, and TEST_MATRIX only.
```

The skill is stored at `.codex/skills/session-docs-closeout/SKILL.md`. It requires a plan before documentation edits unless the invocation explicitly authorizes edits.
