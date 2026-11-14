# How to prompt the skills in climb-log

A guide for you (the human) on getting Claude Code to use the five project skills reliably.

## 1. How skills load, in one minute

- A skill is a folder in `.claude/skills/<name>/` containing a `SKILL.md`.
- At the start of a session Claude Code sees only each skill's **name and description**. The body is loaded when the skill is used.
- A skill gets used in one of two ways: Claude decides it is relevant from the description, or you invoke it by typing `/name`.
- Once loaded, the skill's instructions stay in that conversation for later turns. The file is not re-read, so if you edit a skill, start a new session.
- `CLAUDE.md` is different: it is loaded in full, every session. That is why the routing table lives there.

## 2. Four ways to trigger a skill, weakest to strongest

| # | Method | What you do | Reliability | Use it for |
|---|---|---|---|---|
| 1 | Automatic | Nothing; describe the task | Depends on the wording matching the description | Day-to-day work |
| 2 | Routing rule | Already in `CLAUDE.md`: "Before you … load …" | High | Standing habits |
| 3 | Name it in the prompt | "Load the `charts` skill first, then …" | Very high | Anything important or easy to miss |
| 4 | Invoke it | Type `/charts` or `/phase-check 2` | Certain | Sign-off, or forcing a skill in mid-session |

Rule of thumb: rely on 1 and 2 by default, add 3 when the task is mixed or the stakes are high, use 4 when you want no doubt.

## 3. The five skills and prompts that trigger them

### `ui-design` — screens, components, styling, copy

Triggers on its own when you say: screen, component, layout, button, restyle, theme, empty state, wording.

```
Load the ui-design skill, then build the Walls list screen from docs/ui-spec.md.
```
```
The Log climb colour chips feel cramped on my phone. Fix it (ui-design applies).
```

### `charts` — charts, tiles, metric displays

Triggers on: chart, graph, trend, pyramid, stat tile, flash rate display.

```
Load the charts skill and add the grade pyramid to Progress.
Metrics come from src/domain/metrics.ts only.
```

### `data-model` — schema, types, seed, export/import, reset logic

Triggers on: schema, Dexie, migration, seed.json, export, import, reset logic, status.

```
I want problems to have an optional "height" field. Load the data-model skill
and make the change the way it describes, including the migration test.
```

### `pwa-ios` — manifest, service worker, install, storage, camera

Triggers on: manifest, service worker, offline, install, home screen, base path, camera, photo capture, storage persistence.

```
The app shows a blank page after deploy. Load pwa-ios and check the base path
and service worker scope before changing anything else.
```

### `phase-check` — phase sign-off (manual only)

This one never loads by itself; it is set to manual so a phase is only declared done when you ask.

```
/phase-check 2
```

It runs lint, tests and build, checks every success criterion in the phase brief, and reports Pass, Fail or Needs human with evidence.

## 4. Prompt patterns that work

**Name the brief, name the gate.** The standard phase prompt does both:

```
Read docs/phases/phase-3-resets.md and docs/progress.md.
Implement Phase 3 on a new branch `phase-3`. Load the skills CLAUDE.md
routes you to before the matching work. When done, run /phase-check 3,
fix anything that fails, then open a pull request.
```

**Say "before", not "also".** Order matters; a skill read after the code is written changes little.

| Weaker | Stronger |
|---|---|
| "Make a chart of sends. Use the charts skill too." | "Load the charts skill first, then add the weekly sends chart." |
| "Follow our design rules." | "Load ui-design before touching any component." |
| "Check it's done." | "/phase-check 4" |

**Use the skill's own words.** Automatic loading matches your request against the description. "Add a stat tile" hits `charts`; "show a number at the top" might not.

**Mixed tasks: list the skills.** A photo feature touches three areas:

```
Add photo capture to Log climb. Load pwa-ios (camera, downscaling),
data-model (photos table) and ui-design (the optional section) first.
```

**Ask it to confirm.** When it matters, end with:

```
Before you start, tell me which skills you loaded.
```

**Subagents.** If you ask Claude Code to split work across subagents, add: "tell each subagent which skills to load", since a fresh subagent has not read them.

## 5. When a skill is not being used

| Symptom | Likely cause | Fix |
|---|---|---|
| Output ignores a rule from a skill | Skill never loaded | Name it in the prompt, or invoke `/name` |
| Skill missing from the `/` menu | Wrong location or file name | Must be `.claude/skills/<name>/SKILL.md`, committed, with the `---` frontmatter on line 1 |
| Loads for the wrong tasks, or two skills collide | Descriptions too vague or overlapping | Tighten the descriptions (section 6) |
| You edited a skill but nothing changed | Session has the old copy | Start a new session |
| Long session drifts from the rules | Context has grown crowded | Start a new session for the next phase; re-invoke `/name` if staying |
| `/phase-check` reports Pass with thin evidence | Criterion is vague | Sharpen the criterion in the phase brief; ask "show me the evidence for #3" |

## 6. Keeping the skills good

**Descriptions decide loading.** Write them as: *"Use before <doing what> in climb-log. Covers <topics>."* Put the main use case first; long descriptions are cut off in the listing.

**What goes where**

| Content | Put it in |
|---|---|
| A rule that applies to every task ("wall names are data") | `CLAUDE.md` |
| A fact about the project (a type, a screen, a decision) | `docs/` |
| A procedure or checklist for one kind of work | A skill |
| Something you want to trigger yourself | A skill with `disable-model-invocation: true` |

**When to add a skill.** If you paste the same instructions twice, or a `CLAUDE.md` section turns into steps, make it a skill. Ask Claude Code:

```
Turn the release steps we just did into a project skill called `release`,
manual-only, and add it to the routing table in CLAUDE.md.
```

**When to change one.** If Claude Code makes the same mistake twice in an area, the fix belongs in the skill, not in a one-off correction:

```
You used a floating tooltip again. Add a rule to the charts skill so this
doesn't recur, then fix the chart.
```

**Keep them short.** Each skill here is under one screen of rules plus a finishing checklist. A skill that tries to cover everything gets skimmed.

## 7. Cheat sheet

| I want to… | Type |
|---|---|
| Start a phase | The standard prompt in section 4, with the phase number |
| Force a skill now | `/ui-design`, `/charts`, `/data-model`, `/pwa-ios` |
| Sign off a phase | `/phase-check N` |
| See which skills exist | Type `/` and look through the menu |
| Check what was loaded | "Which skills have you loaded this session?" |
| Fix a recurring mistake | "Add a rule to the `<name>` skill so this doesn't recur" |
| Change the plan | "Decision change: … Add it to docs/decisions.md and update what it affects" |

Source: [Claude Code docs — Extend Claude with skills](https://code.claude.com/docs/en/skills) and [features overview](https://code.claude.com/docs/en/features-overview).
