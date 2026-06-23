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
| `generate-tournament-rewards.ts` | `tournament/items/*.yml`, `tournament/classic/classic-rewards.yml` | `build/tournament/*.json`, `index.json`, `player-rewards.json` |

## Schemas

Input files are validated against JSON Schema draft-07 definitions in `schema/`. Validation is hand-written in each build script (no external library).

## Tournament data

Tournament data lives in `tournament/`. SBR-era YAML files are in `tournament/items/`, named `tournament-YYYY-MM-DD.yml` (date = tournament start). Classic-era cumulative rewards are in `tournament/classic/classic-rewards.yml` (1634 players).

Reward code conventions:
- `T1`–`T5`: legacy tournament stars (1–4 = top-4 finish, 5 = participated)
- `RT1`–`RT3`: SBR-era top-3 placement stars, inferred from `team.placement` (not stored in source YAML)
- `RT4`: SBR-era participation star (placement 4+, i.e. players outside top 3)
- `TF0`–`TF22`: Tournament Finals flags (per-event skin/unlock)

The build script aggregates classic + SBR rewards into `player-rewards.json`: T1–T5 preserved from classic, RT1–RT4 accumulated from SBR placements, TF codes unioned across all sources.

## Conventions

- Patch note files: `sbr-patch-note-X-Y.md` (major-minor, no leading zeros)
- Asset URLs in patch notes are rewritten at build time to `raw.githubusercontent.com` absolute URLs using the commit SHA
- All three deploy jobs share concurrency group `deploy-star-battle-github-io` to avoid push races on the target repo
- `generate-tournament-rewards` uses `keep_files: true`; patch notes does not (replaces the whole `/patch/` dir each build)
