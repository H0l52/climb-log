# climb-log — handoff pack

Everything a Claude Code session needs to build the Urban Climb progress tracker, phase by phase. Drop the contents of this folder into the root of `H0l52/climb-log`.

## What is in here

| Path | Purpose | Loaded |
|---|---|---|
| `CLAUDE.md` | Always-on project rules and skill routing | Every session, automatically |
| `docs/implementation-report.md` | Full research and plan (reference) | On demand |
| `docs/decisions.md` | Decision log; newest entry wins | On demand |
| `docs/data-model.md` | Types, Dexie schema, rules, metrics | On demand |
| `docs/ui-spec.md` | Screens, flows, tap budgets | On demand |
| `docs/phases/phase-N-*.md` | One brief per phase: tasks + success criteria | One per session |
| `docs/skills-prompting-guide.md` | For you: how to prompt the skills reliably | Not needed by Claude Code |
| `docs/progress.md` | Status board Claude Code keeps current | Each phase |
| `.github/workflows/deploy.yml` | CI (lint, test, e2e, build) and GitHub Pages deploy from `main` | Every push |
| `src/data/seed.json` | Gyms, colours, walls. The only place wall names live | Phase 1 |
| `.claude/skills/*/SKILL.md` | Five project skills (see below) | When routed or invoked |

## One-time setup (you)

1. Create an **empty, public** repo: `H0l52/climb-log`.
2. Add these files to the repo root and commit to `main`.
3. Repo → Settings → Pages → Source: **GitHub Actions**.
4. Open Claude Code on the repo and paste the Phase 1 prompt below.

Phase 0 is a gym visit, not code. It does not block Phase 1.

## Prompts

Start a **new session for each phase**. Each prompt is deliberately short; the detail is in the repo.

**Phase 1**
```
Read docs/phases/phase-1-skeleton.md and docs/progress.md.
Implement Phase 1 on a new branch `phase-1`. Load the skills CLAUDE.md
routes you to before the matching work. When done, run /phase-check 1,
fix anything that fails, then open a pull request.
```

**Phases 2–6**: same prompt with the phase number and file name changed:

| Phase | File |
|---|---|
| 2 | `docs/phases/phase-2-logging.md` |
| 3 | `docs/phases/phase-3-resets.md` |
| 4 | `docs/phases/phase-4-progress-goals.md` |
| 5 | `docs/phases/phase-5-photos-board-backup.md` |
| 6 | `docs/phases/phase-6-polish.md` |

**Changing the plan mid-build**
```
Decision change: <what and why>. Add it to docs/decisions.md, update any
phase file and docs/data-model.md it affects, and tell me what else it touches.
```

## The skills and how they get used

| Skill | Use | Trigger |
|---|---|---|
| `ui-design` | Any screen, component or styling work | Routed by CLAUDE.md; auto by description |
| `charts` | Any chart, stat tile or metric display | Routed by CLAUDE.md; auto by description |
| `data-model` | Any change to storage, types, seed, export | Routed by CLAUDE.md; auto by description |
| `pwa-ios` | Manifest, service worker, install, camera, storage persistence | Routed by CLAUDE.md; auto by description |
| `phase-check` | Phase sign-off against success criteria | **Manual only**: `/phase-check N` |

Tips:

- If a session skips a skill, name it: "load the `charts` skill first".
- `/phase-check N` is the gate. A phase is not done until it reports all criteria as pass or "needs human".
- Criteria marked "needs human" are things only you can check on the iPhone (install, airplane mode, camera). The check lists them for you.
- Keep `CLAUDE.md` short. New procedures go in a skill; new facts go in `docs/`.
