/**
 * Generates build artifacts for SBR tournament rewards.
 *
 * For each *.yml file in tournament/items/:
 *   - Parses and validates the tournament structure
 *   - Writes the validated data as JSON to build/tournament/{name}.json
 *
 * Outputs:
 *   - build/tournament/index.json  — metadata index for third-party consumers
 *   - build/tournament/*.json      — individual tournament files
 *
 * Usage:
 *   deno run --allow-read --allow-write scripts/generate-tournament-rewards.ts
 */

import { parse as parseYaml } from "@std/yaml";
import { join, dirname, fromFileUrl } from "@std/path";

// ── Constants ─────────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const TOURNAMENT_DIR = join(REPO_ROOT, "tournament", "items");
const BUILD_DIR = join(REPO_ROOT, "build", "tournament");

const INPUT_EXT = ".yml";
const OUTPUT_EXT = ".json";
const INDEX_FILENAME = "index.json";
const JSON_INDENT = 2;
const URL_SCHEME = "https://";

const HANDLE_RE = /^\d+-S2-\d+-\d+$/;
const BATTLETAG_RE = /^.+#\d+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// T1–T5: legacy placement stars; TF0–TF22: Tournament Finals flags
const VALID_REWARD_CODES = new Set([
  "T1", "T2", "T3", "T4", "T5",
  "TF0", "TF1", "TF2", "TF3", "TF4", "TF5", "TF6", "TF7", "TF8", "TF9",
  "TF10", "TF11", "TF12", "TF13", "TF14", "TF15", "TF16", "TF17", "TF18", "TF19",
  "TF20", "TF21", "TF22",
]);

// ── Types ─────────────────────────────────────────────────────────────────

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

// ── Validation ────────────────────────────────────────────────────────────

function validateTournament(raw: unknown, filename: string): Tournament {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`[${filename}] not a YAML object`);
  }
  const record = raw as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.length === 0) {
    throw new Error(`[${filename}] id must be a non-empty string`);
  }
  // Intentionally simple scheme check — not a full URI parser
  if (record.url !== null && (typeof record.url !== "string" || !record.url.startsWith(URL_SCHEME))) {
    throw new Error(`[${filename}] url must be an ${URL_SCHEME} URI or null`);
  }
  if (typeof record.date !== "string" || !ISO_DATE_RE.test(record.date)) {
    throw new Error(`[${filename}] date must be ISO 8601 (YYYY-MM-DD), got ${JSON.stringify(record.date)}`);
  }
  if (!Array.isArray(record.teams) || record.teams.length === 0) {
    throw new Error(`[${filename}] teams must be a non-empty array`);
  }

  const seenHandles = new Set<string>();

  const teams: Team[] = (record.teams as unknown[]).map((rawTeam, teamIdx) => {
    if (typeof rawTeam !== "object" || rawTeam === null) {
      throw new Error(`[${filename}] teams[${teamIdx}] is not an object`);
    }
    const team = rawTeam as Record<string, unknown>;
    const teamPath = `[${filename}] teams[${teamIdx}]`;

    if (typeof team.name !== "string" || team.name.length === 0) {
      throw new Error(`${teamPath}.name must be a non-empty string`);
    }
    if (typeof team.tag !== "string" || team.tag.length === 0) {
      throw new Error(`${teamPath}.tag must be a non-empty string`);
    }
    if (typeof team.placement !== "number" || !Number.isInteger(team.placement) || team.placement < 1) {
      throw new Error(`${teamPath}.placement must be a positive integer`);
    }
    if (!Array.isArray(team.players) || team.players.length === 0) {
      throw new Error(`${teamPath}.players must be a non-empty array`);
    }

    const players: Player[] = (team.players as unknown[]).map((rawPlayer, playerIdx) => {
      if (typeof rawPlayer !== "object" || rawPlayer === null) {
        throw new Error(`${teamPath}.players[${playerIdx}] is not an object`);
      }
      const player = rawPlayer as Record<string, unknown>;
      const playerPath = `${teamPath}.players[${playerIdx}]`;

      if (typeof player.handle !== "string" || !HANDLE_RE.test(player.handle)) {
        throw new Error(`${playerPath}.handle invalid: ${JSON.stringify(player.handle)}`);
      }
      if (seenHandles.has(player.handle)) {
        throw new Error(`[${filename}] duplicate handle: ${player.handle}`);
      }
      seenHandles.add(player.handle);

      if (typeof player.battletag !== "string" || !BATTLETAG_RE.test(player.battletag)) {
        throw new Error(`${playerPath}.battletag invalid: ${JSON.stringify(player.battletag)}`);
      }
      if (typeof player.name !== "string" || player.name.length === 0) {
        throw new Error(`${playerPath}.name must be a non-empty string`);
      }

      const rewards = player.rewards ?? [];
      if (!Array.isArray(rewards)) {
        throw new Error(`${playerPath}.rewards must be an array`);
      }
      for (const reward of rewards) {
        if (typeof reward !== "string" || !VALID_REWARD_CODES.has(reward)) {
          throw new Error(`${playerPath}.rewards contains invalid code: ${JSON.stringify(reward)}`);
        }
      }

      return {
        handle: player.handle,
        battletag: player.battletag,
        name: player.name,
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

  return { id: record.id, url: record.url, date: record.date, teams } as Tournament;
}

// ── Consistency checks (non-fatal) ────────────────────────────────────────

function checkConsistency(tournament: Tournament, filename: string): string[] {
  const warnings: string[] = [];
  const placements = new Set(tournament.teams.map((team) => team.placement));
  if (placements.size !== tournament.teams.length) {
    warnings.push(`[${filename}] duplicate placement values across teams`);
  }
  return warnings;
}

// ── Processing ────────────────────────────────────────────────────────────

interface ProcessedTournament {
  tournament: Tournament;
  outputFile: string;
}

/** Reads, validates, and writes each tournament YAML as JSON. */
async function processTournaments(): Promise<ProcessedTournament[]> {
  const results: ProcessedTournament[] = [];
  const warnings: string[] = [];
  let hasErrors = false;

  for await (const entry of Deno.readDir(TOURNAMENT_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(INPUT_EXT)) continue;

    const content = await Deno.readTextFile(join(TOURNAMENT_DIR, entry.name));

    let tournament: Tournament;
    try {
      tournament = validateTournament(parseYaml(content), entry.name);
    } catch (e) {
      console.error(`ERROR: ${(e as Error).message}`);
      hasErrors = true;
      continue;
    }

    warnings.push(...checkConsistency(tournament, entry.name));

    const outputFile = entry.name.replace(INPUT_EXT, OUTPUT_EXT);
    await Deno.writeTextFile(
      join(BUILD_DIR, outputFile),
      JSON.stringify(tournament, null, JSON_INDENT) + "\n",
    );

    const playerCount = tournament.teams.reduce((sum, team) => sum + team.players.length, 0);
    console.log(`  ${entry.name} → ${outputFile} (${tournament.teams.length} teams, ${playerCount} players)`);

    results.push({ tournament, outputFile });
  }

  for (const warning of warnings) console.warn(`WARN: ${warning}`);

  if (hasErrors) {
    console.error("Aborting due to validation errors.");
    Deno.exit(1);
  }

  return results;
}

/** Writes the index.json manifest from processed tournament results. */
async function writeIndex(processed: ProcessedTournament[]): Promise<void> {
  const entries: IndexEntry[] = processed
    .map(({ tournament, outputFile }) => ({
      id: tournament.id,
      date: tournament.date,
      file: outputFile,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const index = {
    generated: new Date().toISOString(),
    tournaments: entries,
  };

  await Deno.writeTextFile(
    join(BUILD_DIR, INDEX_FILENAME),
    JSON.stringify(index, null, JSON_INDENT) + "\n",
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("Building tournament rewards...");

  try {
    await Deno.remove(BUILD_DIR, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  await Deno.mkdir(BUILD_DIR, { recursive: true });

  const processed = await processTournaments();
  await writeIndex(processed);

  console.log(`Generated ${processed.length} tournament file(s) into build/tournament/`);
}

main();
