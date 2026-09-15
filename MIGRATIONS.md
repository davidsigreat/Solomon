# Database migrations

Schema lives in `prisma/schema.prisma`; history lives in `prisma/migrations/` and is
committed. **`prisma migrate deploy` is the deploy path.** `db push` is for emergencies
only — it writes nothing to `_prisma_migrations`, so the next `migrate deploy` can't tell
what it did.

## Local one-liner

```bash
npm run db:deploy           # = prisma migrate deploy — applies committed migrations, nothing else
```

Thanos checks branches/PRs out locally and runs this against a local DB. For a brand-new
empty DB it produces the full schema (including `api_keys`).

Iterating on the schema during development:

```bash
npm run db:migrate          # = prisma migrate dev — diffs schema, writes a new migration, applies it
```

Commit the generated `prisma/migrations/<timestamp>_<name>/` folder with the schema change.

## Existing database (built with `db push`, no `_prisma_migrations` table)

`migrate deploy` refuses to run on a non-empty DB that has no migration history (`P3005`).
Baseline it once — this does not touch data:

```bash
# 1. Anything the DB is missing vs. the schema? (prod may be missing api_keys — see PR #6 QA)
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > /tmp/catchup.sql
cat /tmp/catchup.sql                       # review; "-- This is an empty migration." means nothing to do
npx prisma db execute --url "$DATABASE_URL" --file /tmp/catchup.sql

# 2. Mark the baseline as already applied (no SQL runs), then deploy is a no-op
npx prisma migrate resolve --applied 20260915000000_baseline
npx prisma migrate deploy
npx prisma migrate status                  # → "Database schema is up to date!"
```

Do step 1 before step 2: `resolve --applied` records the baseline as done without running
it, so any table it should have created must already exist.

## Adding the next migration

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate -- --name <short_name>` against a local DB.
3. Commit `prisma/migrations/<timestamp>_<short_name>/migration.sql` alongside the schema.
4. Deploy runs `npm run db:deploy`.

No runtime DDL in app code (no `CREATE TABLE IF NOT EXISTS` in request handlers) — if a
table is missing, the fix is a migration, not a handler.
