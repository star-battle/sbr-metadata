# sbr-patch-notes

Source and build pipeline for [Star Battle Reloaded](https://star-battle.talv.space).

For consumption by:
- Website (official and others) 
- 3rd party applications
- SC2Map on Battle.net

## Structure

```
patch/                      patch note markdown files (sbr-patch-note-X-Y.md) + assets/
web/                        website frontpage (index.md) + external-sites.json redirects
tournament-rewards/         tournament result YAML files (tournament-YYYY-MM-DD.yml) + legacy.csv
schema/                     JSON Schema files for frontmatter/YAML validation
scripts/                    Deno build scripts
layout/default.html         shared HTML template
```

## Build

Requires [Deno](https://deno.com) v2.x.

```sh
# Patch notes → build/patch/
deno run --allow-read --allow-write --allow-env --allow-run=git scripts/generate-patch-notes.ts

# Website → build/web/
deno run --allow-read --allow-write --allow-env scripts/generate-web-index.ts

# Tournament rewards → build/tournament/
deno run --allow-read --allow-write scripts/generate-tournament-rewards.ts
```

## CI

Three workflows deploy artifacts on push to `master`:

| Workflow | Trigger paths | Deploys to |
|---|---|---|
| `generate-patch-notes` | `patch/**` | `/patch/` |
| `deploy-web` | `web/**` | `/` |
| `generate-tournament-rewards` | `tournament-rewards/**` | `/tournament/` |

All share a concurrency group to serialize deploys.

## Adding content

**New patch note:** create `patch/sbr-patch-note-X-Y.md` with YAML frontmatter matching `schema/patch-note.schema.json`. See an existing file for the format.

**New tournament:** create `tournament-rewards/tournament-YYYY-MM-DD.yml` matching `schema/tournament.schema.json`. The date is the tournament start date.
