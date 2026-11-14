---
name: charts
description: Use before creating or changing any chart, graph, stat tile, pyramid, trend line or metric display in climb-log. Covers which chart form to use, how grade colours are used as data colours, small-screen legibility and metric edge cases.
---

# climb-log charts

Metric definitions live in `docs/data-model.md` (Metrics). Never compute a metric inside a component: call the pure functions in `src/domain/metrics.ts`.

## Forms

| Question | Form |
|---|---|
| How much am I sending, and at what grade? | Stacked bars per week, one segment per colour, stacked easiest at the bottom |
| What does my base look like? | Grade pyramid: horizontal bars, one per colour, hardest at the top |
| Is my flash rate improving? | Line per colour over weeks; show at most 3 colours (working grade and its neighbours), others behind a toggle |
| Where am I weakest? | Horizontal bars of send rate by style tag, sorted ascending |
| Is my volume trending up? | Single line or bars of session score |
| Headline numbers | Stat tiles: one big number, a label, and a small delta versus the previous period |

No pie charts, no dual axes, no 3D, no legends that need scrolling.

## Colour

- Grade colours come from the database (`GradeBand.hex`) and are the **only** data colours. Never invent a palette for grades.
- Colour is never the only signal. Label segments or rows with the colour name; put the value in text.
- White and black bands vanish on light and dark backgrounds. Give every mark a 1 px outline in the neutral ink colour.
- Non-grade series (session score, streak) use the neutral ink, not a grade colour.
- Axes, gridlines and labels: neutral, low contrast, minimal. At most 4 y-axis ticks.

## Small screen

- Design at 390 px wide. Minimum text 12 px; prefer direct labels over legends.
- Weekly buckets: Monday start, Melbourne time. Label sparse ("3 Nov", "1 Dec"), not every bar.
- Ranges: 6 weeks, 3 months, year, all. Beyond 26 buckets, aggregate to months.
- Interaction is tap, not hover: tapping a mark shows its values in a fixed readout area below the chart, not a floating tooltip under the finger.
- Each chart has a one-line text summary underneath ("Flash rate on green: 40% → 55% over 6 weeks") which is also its accessible description.

## Edge cases you must handle

- Undefined rates (zero denominator) render as "–" and as a gap in lines, never 0.
- Fewer than 3 data points: show the tiles and a "keep logging" note instead of a trend line.
- Weeks with no sessions are shown as empty buckets, not skipped.
- Retired grade bands and walls still appear in history.
- A custom band order (the owner can reorder) must flow through stacking and pyramid order.

## Before you finish

- Fixture test for any new metric, with hand-calculated expected values.
- Render with the synthetic 2-year dataset and confirm under 1 second.
- Check both themes, and check the white and black bands are visible in each.
