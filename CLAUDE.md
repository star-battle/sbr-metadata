# CLAUDE.md

## Project

Content and build pipeline for **Star Battle Reloaded** (SBR), a StarCraft II Arcade game. Source files live here; built HTML/YAML artifacts are pushed to the separate `star-battle/star-battle.github.io` repo via CI.

## Tech stack

- **Runtime:** Deno v2.x (TypeScript). No Node.js, no npm. Use `pnpm dlx` → not applicable here.
- **Dependencies:** `@std/yaml`, `@std/path`, `@deno/gfm` — all declared in `deno.json`.
- **CI:** GitHub Actions with `peaceiris/actions-gh-pages@v4` for deployment.

## Scripts

Each script is self-contained and validates its input strictly — it exits 1 on any validation error.

| Script | Input | Output |
|---|---|---|
| `generate-patch-notes.ts` | `patch/*.md` | `build/patch/*.html`, `index.html`, `index.json` |
| `generate-web-index.ts` | `web/index.md`, `web/external-sites.json` | `build/web/` |
| `generate-tournament-rewards.ts` | `tournament/items/*.yml` | `build/tournament/*.yml`, `index.json` |

## Schemas

Both schemas are JSON Schema draft-07 in `schema/`. Validation is hand-written in each script (no external library).

- `patch-note.schema.json` — frontmatter fields: `version`, `published`, `updated`, `revision`, `status`, `tags`
- `tournament-item.schema.json` — tournament YAML fields: `id`, `url` (nullable), `date` (ISO 8601), `teams[].{name,tag,place,players[].{handle,battletag,name,rewards[]}}`

## Tournament data

Tournament data lives in `tournament/`. YAML files are in `tournament/items/`, named `tournament-YYYY-MM-DD.yml` (date = tournament start). The `tournament/legacy.csv` is a historical flat database (1634 players, reward columns T1–T5, RT1–RT4, TF0–TF22) — it is not processed by the pipeline; it's reference data.

Reward code conventions:
- `T1`–`T5`: legacy tournament stars (1–4 = top-4 finish, 5 = participated)
- `RT1`–`RT4`: SBR-era stars (1–3 = top-3, 4 = participated)
- `TF0`–`TF22`: Tournament Finals flags (per-event skin/unlock)

## Conventions

- Patch note files: `sbr-patch-note-X-Y.md` (major-minor, no leading zeros)
- Asset URLs in patch notes are rewritten at build time to `raw.githubusercontent.com` absolute URLs using the commit SHA
- All three deploy jobs share concurrency group `deploy-star-battle-github-io` to avoid push races on the target repo
- `generate-tournament-rewards` uses `keep_files: true`; patch notes does not (replaces the whole `/patch/` dir each build)
