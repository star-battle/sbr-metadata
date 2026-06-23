/**
 * Generates build artifacts for SBR tournament rewards.
 *
 * Cleans build/tournament/, then for each *.yaml file in tournament-rewards/:
 *   - Parses and validates the tournament structure
 *   - Copies the validated YAML to build/tournament/{id}.yaml
 *
 * Outputs:
 *   - build/tournament/index.json  — metadata index for third-party consumers
 *   - build/tournament/*.yaml      — individual tournament files
 *
 * Usage:
 *   deno run --allow-read --allow-write scripts/generate-tournament-rewards.ts
 */

import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";
import { join, dirname, fromFileUrl } from "@std/path";

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const TOURNAMENT_DIR = join(REPO_ROOT, "tournament", "items");
const BUILD_DIR = join(REPO_ROOT, "build", "tournament");

// ── Types ──────────────────────────────────────────────────────────────────

interface Player {
  handle: string;
  battletag: string;
  name: string;
  rewards: string[];
}

interface Team {
  name: string;
  tag: string;
  placement: number;
  players: Player[];
}

interface Tournament {
  id: string;
  url: string | null;
  date: string;
  teams: Team[];
}

interface IndexEntry {
  id: string;
  date: string;
  file: string;
}

// ── Validation ─────────────────────────────────────────────────────────────

const HANDLE_RE = /^\d+-S2-\d+-\d+$/;
const BATTLETAG_RE = /^.+#\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateTournament(raw: unknown, file: string): Tournament {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`[${file}] not a YAML object`);
  }
  const t = raw as Record<string, unknown>;

  if (typeof t.id !== "string" || t.id.length === 0) {
    throw new Error(`[${file}] id must be a non-empty string`);
  }
  if (t.url !== null && (typeof t.url !== "string" || !t.url.startsWith("https://"))) {
    throw new Error(`[${file}] url must be an https:// URI or null`);
  }
  if (typeof t.date !== "string" || !DATE_RE.test(t.date)) {
    throw new Error(`[${file}] date must be ISO 8601 (YYYY-MM-DD), got ${JSON.stringify(t.date)}`);
  }
  if (!Array.isArray(t.teams) || t.teams.length === 0) {
    throw new Error(`[${file}] teams must be a non-empty array`);
  }

  const seenHandles = new Set<string>();

  const teams: Team[] = (t.teams as unknown[]).map((rawTeam, ti) => {
    if (typeof rawTeam !== "object" || rawTeam === null) {
      throw new Error(`[${file}] teams[${ti}] is not an object`);
    }
    const team = rawTeam as Record<string, unknown>;

    if (typeof team.name !== "string" || team.name.length === 0) {
      throw new Error(`[${file}] teams[${ti}].name must be a non-empty string`);
    }
    if (typeof team.tag !== "string" || team.tag.length === 0) {
      throw new Error(`[${file}] teams[${ti}].tag must be a non-empty string`);
    }
    if (typeof team.placement !== "number" || !Number.isInteger(team.placement) || team.placement < 1) {
      throw new Error(`[${file}] teams[${ti}].placement must be a positive integer`);
    }
    if (!Array.isArray(team.players) || team.players.length === 0) {
      throw new Error(`[${file}] teams[${ti}].players must be a non-empty array`);
    }

    const players: Player[] = (team.players as unknown[]).map((rawPlayer, pi) => {
      if (typeof rawPlayer !== "object" || rawPlayer === null) {
        throw new Error(`[${file}] teams[${ti}].players[${pi}] is not an object`);
      }
      const p = rawPlayer as Record<string, unknown>;

      if (typeof p.handle !== "string" || !HANDLE_RE.test(p.handle)) {
        throw new Error(`[${file}] teams[${ti}].players[${pi}].handle invalid: ${JSON.stringify(p.handle)}`);
      }
      if (seenHandles.has(p.handle)) {
        throw new Error(`[${file}] duplicate handle: ${p.handle}`);
      }
      seenHandles.add(p.handle);

      if (typeof p.battletag !== "string" || !BATTLETAG_RE.test(p.battletag)) {
        throw new Error(`[${file}] teams[${ti}].players[${pi}].battletag invalid: ${JSON.stringify(p.battletag)}`);
      }
      if (typeof p.name !== "string" || p.name.length === 0) {
        throw new Error(`[${file}] teams[${ti}].players[${pi}].name must be a non-empty string`);
      }
      const rewards = p.rewards ?? [];
      if (!Array.isArray(rewards) || rewards.some((r) => typeof r !== "string" || r.length === 0)) {
        throw new Error(`[${file}] teams[${ti}].players[${pi}].rewards must be an array of non-empty strings`);
      }

      return {
        handle: p.handle,
        battletag: p.battletag,
        name: p.name,
        rewards: rewards as string[],
      };
    });

    return {
      name: team.name,
      tag: team.tag,
      placement: team.placement,
      players,
    };
  });

  return { id: t.id, url: t.url, date: t.date, teams };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  try {
    await Deno.remove(BUILD_DIR, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  await Deno.mkdir(BUILD_DIR, { recursive: true });

  const index: IndexEntry[] = [];
  const allWarnings: string[] = [];
  let hasErrors = false;

  for await (const entry of Deno.readDir(TOURNAMENT_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".yml")) continue;

    const content = await Deno.readTextFile(join(TOURNAMENT_DIR, entry.name));

    let tournament: Tournament;
    try {
      tournament = validateTournament(parseYaml(content), entry.name);
    } catch (e) {
      console.error(`ERROR: ${(e as Error).message}`);
      hasErrors = true;
      continue;
    }

    const playerCount = tournament.teams.reduce((sum, t) => sum + t.players.length, 0);
    allWarnings.push(...checkConsistency(tournament, entry.name));

    const outFile = entry.name;
    await Deno.writeTextFile(join(BUILD_DIR, outFile), stringifyYaml(tournament as unknown as Record<string, unknown>));

    index.push({ id: tournament.id, date: tournament.date, file: outFile });
    console.log(`  ${entry.name} → ${outFile} (${tournament.teams.length} teams, ${playerCount} players)`);
  }

  for (const w of allWarnings) console.warn(`WARN: ${w}`);

  if (hasErrors) {
    console.error("Aborting due to validation errors.");
    Deno.exit(1);
  }

  index.sort((a, b) => a.date.localeCompare(b.date));

  await Deno.writeTextFile(
    join(BUILD_DIR, "index.json"),
    JSON.stringify({ generated: new Date().toISOString(), tournaments: index }, null, 2) + "\n",
  );

  console.log(`Generated ${index.length} tournament file(s) into build/tournament/`);
}

function checkConsistency(t: Tournament, file: string): string[] {
  const warnings: string[] = [];
  const placements = new Set(t.teams.map((team) => team.placement));
  if (placements.size !== t.teams.length) {
    warnings.push(`[${file}] duplicate placement values across teams`);
  }
  return warnings;
}

main();
