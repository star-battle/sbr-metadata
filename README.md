# Star Battle Reloaded - Metadata

Source content and build pipeline for Star Battle Reloaded (SBR), a StarCraft II Arcade game.

For consumption by:
- Website (official and others)
- 3rd party applications
- SC2Map on Battle.net

## Structure

```
patch/                      patch note markdown files (sbr-patch-note-X-Y.md) + assets/
web/                        website frontpage (index.md) + external-sites.json redirects
tournament/items/           SBR-era tournament result YAML files (tournament-YYYY-MM-DD.yml)
tournament/classic/         legacy (pre-SBR) cumulative player rewards
schema/                     JSON Schema files for frontmatter/YAML validation
scripts/                    Deno build scripts (TypeScript)
layout/default.html         shared HTML template for generated pages
```

## Build Pipeline and Delivery

All build scripts are written in TypeScript and run on [Deno](https://deno.com) v2.x. Three GitHub Actions workflows deploy built artifacts to the [`star-battle/star-battle.github.io`](https://github.com/star-battle/star-battle.github.io) repository. Each workflow can also be triggered manually via the GitHub Actions UI (`workflow_dispatch`).

All three share the concurrency group `deploy-star-battle-github-io` to serialize deploys and prevent push races on the target repository.

| Workflow | Trigger paths | What it does | Deploys to |
|---|---|---|---|
| **Generate Patch Notes** | `patch/**`, `scripts/generate-patch-notes.ts`, `layout/default.html` | Converts patch note markdown into standalone HTML pages with an index | `/patch/` |
| **Generate Tournament Rewards** | `tournament/**`, `scripts/generate-tournament-rewards.ts` | Validates tournament YAML, outputs per-tournament JSON, and aggregates all player rewards into `player-rewards.json` | `/tournament/` |
| **Deploy Web** | `web/**`, `scripts/generate-web-index.ts`, `layout/default.html` | Builds the website frontpage and external-site redirects | `/` (root) |

## Adding content

### New patch note

Create `patch/sbr-patch-note-X-Y.md` where `X-Y` is the major-minor version (no leading zeros). The file must begin with YAML frontmatter matching `schema/patch-note.schema.json`. See an existing file for the format.

The body is standard markdown. Assets such as images should be stored in `patch/assets/X.Y/` and referenced from the repository — avoid external hosts unless embedding content like YouTube videos.

### New tournament

Create `tournament/items/tournament-YYYY-MM-DD.yml` where the date is the tournament start date. The file must conform to `schema/tournament-item.schema.json`:

- **`id`** — unique tournament identifier string
- **`url`** — link to the tournament's website, or `null`
- **`date`** — ISO 8601 date (`YYYY-MM-DD`)
- **`teams[]`** — each team has `name`, `tag` (clan tag with brackets), `placement` (1 = winner), and `players[]`
- **`players[]`** — each player has `handle` (SC2 account handle, e.g. `2-S2-1-2376319`), `battletag`, `name`, and `rewards[]` (TF codes only; RT placement stars are inferred from `team.placement` at build time)

### Legacy tournament rewards (pre-SBR)

Classic-era cumulative rewards live in `tournament/classic/classic-rewards.yml` (1634 players). This file was migrated from a legacy CSV and should not be directly edited. It is read-only input to the build pipeline — the script loads it as the base dataset before merging SBR-era tournament results on top.

Known data quirks: a small number of entries contain negative placement counts (e.g. `T3: -3`), which are correction artifacts from the original source data. Two handles appear as duplicate entries with differing placement values. These are preserved as-is.
