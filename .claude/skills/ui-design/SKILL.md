---
name: ui-design
description: Use before building, changing or restyling any screen, component, layout or copy in climb-log. Covers the one-handed phone layout, tap budgets, grade colour chips, dark gym-friendly theme, touch targets and empty states.
---

# climb-log UI design

Read `docs/ui-spec.md` for the screen you are touching first. This skill is how to build it.

## Who and where

One person, iPhone, portrait, one hand, between attempts, chalk on fingers, dim warehouse lighting. They glance, tap a few times, pocket the phone.

## Direction: chalk and tape

- Dark by default: near-black slate background, chalk-white text. Offer a light theme via `prefers-color-scheme`, but design dark first.
- The **grade colours are the only saturated colours** in the app. Chrome, buttons and charts' non-data ink stay neutral so a colour always means a grade.
- Typography: system font stack, large and heavy for numbers (tallies, tries, streaks). No remote fonts.
- Shapes: chunky rounded rectangles that read as strips of tape. Avoid card-in-card nesting, drop shadows and gradients.
- Motion: one short confirmation on save (under 200 ms). Respect `prefers-reduced-motion`.

## Rules

1. **Thumb zone:** primary actions sit in the bottom half. Nothing important in the top corners.
2. **Touch targets ≥ 44 × 44 pt**, with ≥ 8 pt gaps. Colour chips on Log climb are much bigger (aim for 64 pt tall).
3. **Tap budgets are requirements**, not goals. See the table in `docs/ui-spec.md`. Preselect the last-used wall; default tries to 1.
4. **No blocking modals in the logging flow.** Use inline expansion and toasts with Undo instead of confirm dialogs. Destructive actions outside logging (import, merge) may confirm.
5. **Grade chips always carry the colour name as text.** White, black and yellow chips need a visible border on both themes. Text on a chip must meet 4.5:1 contrast: pick black or white text per chip by luminance, computed from the stored hex (colours are editable data).
6. **Never hard-code the list of colours or walls.** Render from the database, in `order`.
7. **Numbers over prose.** "3 sends · 1 flash" beats a sentence.
8. **Safe areas:** pad for the notch and home indicator with `env(safe-area-inset-*)`; use `100dvh`, not `100vh`.
9. **Inputs:** font size ≥ 16 px so iOS does not zoom. Numeric steppers, not keyboards, wherever possible.
10. **Every screen handles** empty, offline (no difference), and long lists (a year of sessions).

## Copy

Short, plain, climber vocabulary: send, flash, project, set, reset. Buttons say what happens ("Mark as reset", "End session"). Empty states give one next step. No exclamation marks, no jokes in error messages.

## Before you finish

- Check at 390 × 844 and 320 × 568.
- Check both themes.
- Tab through with VoiceOver labels in mind: every chip and icon button has an accessible name.
- Re-run the tap-budget e2e tests if you touched Log climb.
