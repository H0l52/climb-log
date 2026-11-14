---
name: data-model
description: Use before touching the Dexie schema, TypeScript domain types, seed.json, repositories, reset or status logic, or export and import in climb-log. Covers invariants, migration rules and the checks required after any storage change.
---

# climb-log data model

The reference is `docs/data-model.md`. Read the relevant section before changing anything, and update that file in the same commit as the code.

## Invariants (tests must protect these)

1. Attempts are never deleted by resets, retirements or merges. Only an explicit user delete removes one.
2. Everything references walls, gyms and grade bands **by ID**. Names are labels.
3. A problem's status only moves `project → sent` or `project → expired`. Undo of a reset is the single exception and restores exact prior values.
4. `flash` is only valid on a problem's first attempt entry with `tries = 1`.
5. Seed runs once. It never overwrites or re-adds rows the user changed or removed.
6. No wall, gym or colour name is hard-coded outside `src/data/seed.json` and fixtures.
7. Board logs never enter colour metrics.
8. Calendar dates are Melbourne `YYYY-MM-DD` strings; instants are epoch milliseconds. Never derive a calendar date with `toISOString()` (that is UTC).

## Layering

- `src/domain/`: pure functions over plain objects. No Dexie, no React, no `Date.now()` (pass the clock in).
- `src/db/`: Dexie schema, migrations, repositories. Multi-table writes (reset, merge, import, problem + first attempt) run in a single transaction.
- Components read through `useLiveQuery` hooks exposed by repositories; they do not open tables directly.

## Changing the schema

1. Changes are **additive**: new tables, new optional fields, new indexes. Do not rename or drop stores or fields.
2. Add `db.version(n + 1)` with an `upgrade()` that backfills defaults. Keep every earlier version declaration.
3. Bump `schemaVersion` in the export format and add an import migration from the previous version.
4. Add a migration test: build a database at version n with fixture data, open at n + 1, assert the data.
5. Update `docs/data-model.md` and add a line to `docs/decisions.md`.

## IndexedDB gotchas

- Booleans cannot be indexed. Filter in memory or store 0/1.
- Blobs: store photos in their own table so list queries never load them. Never index a blob.
- Safari can abort a transaction that awaits anything other than Dexie calls. Do image processing **before** opening the transaction.
- IDs come from `crypto.randomUUID()`.

## After any storage change, run

- Unit tests for the affected domain functions.
- Export → clear → import deep-equal test (once export exists).
- The "no hard-coded names" test.
- The seed idempotency test.
