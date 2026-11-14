---
name: phase-check
description: Verify a climb-log build phase against its success criteria and report pass or fail with evidence. Run manually at the end of a phase.
disable-model-invocation: true
argument-hint: "[phase-number]"
---

# Phase check

Check phase **$ARGUMENTS** of climb-log. You are verifying, not building. Do not weaken a criterion or a test to make it pass.

## Steps

1. Open the brief in `docs/phases/` whose name starts with `phase-$ARGUMENTS-`. If no phase number was given, read `docs/progress.md` and use the phase marked "In progress".
2. Run, in order, and capture the results:
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - `npm run e2e` (if the phase has e2e criteria)
3. Go through **every** success criterion in the brief. For each one decide:
   - **Pass**: name the evidence (test name, command output, file and line).
   - **Fail**: say what is missing or wrong.
   - **Needs human**: it can only be checked on the iPhone. Write the exact steps the owner should follow and what they should see.
   A criterion with no automated evidence and no human step is a Fail.
4. Check the standing rules from `CLAUDE.md`:
   - the "no hard-coded names" test passes;
   - no new dependency without a line in `docs/decisions.md`;
   - docs changed in step with code (`docs/data-model.md`, `docs/ui-spec.md`).
5. Check scope: list anything built that the brief marks "Out of scope".

## Report

Output this table, then a one-line verdict.

| # | Criterion | Result | Evidence or steps |
|---|---|---|---|

Verdict is one of:

- **Ready to merge**: all Pass.
- **Ready, awaiting human checks**: only Pass and Needs human.
- **Not ready**: any Fail. List the fixes, smallest first.

## Then

- If there are Fails: fix them and run this check again. Do not open the PR yet.
- Otherwise: update the phase row in `docs/progress.md`, add the "Needs human" steps to its list, and put the table in the pull request description.
