/**
 * Generates build artifacts for SBR tournament rewards.
 *
 * For each *.yml file in tournament/items/:
 *   - Parses and validates the tournament structure
 *   - Writes the validated data as JSON to build/tournament/{name}.json
 *
 * Then aggregates all rewards across classic-era and SBR-era tournaments
 * into a single player-rewards.json keyed by player handle.
 *
 * Outputs:
 *   - build/tournament/index.json          — metadata index for third-party consumers
 *   - build/tournament/*.json              — individual tournament files
 *   - build/tournament/player-rewards.json — aggregated per-player rewards
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
const CLASSIC_REWARDS_PATH = join(REPO_ROOT, "tournament", "classic", "classic-rewards.yml");
const BUILD_DIR = join(REPO_ROOT, "build", "tournament");

const INPUT_EXT = ".yml";
const OUTPUT_EXT = ".json";
const INDEX_FILENAME = "index.json";
const PLAYER_REWARDS_FILENAME = "player-rewards.json";
const JSON_INDENT = 2;
const URL_SCHEME = "https://";

// RT1–RT3: top-3 placement; RT4: participation (placement 4+)
const RT_PLACEMENT_KEYS: Record<number, string> = { 1: "RT1", 2: "RT2", 3: "RT3" };

const HANDLE_RE = /^\d+-S2-\d+-\d+$/;
const BATTLETAG_RE = /^.+#\d+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VALID_TF_CODES = new Set([
  "TF0", "TF1", "TF2", "TF3", "TF4", "TF5", "TF6", "TF7", "TF8", "TF9",
  "TF10", "TF11", "TF12", "TF13", "TF14", "TF15", "TF16", "TF17", "TF18", "TF19",
  "TF20", "TF21", "TF22",
]);

// T1–T5: legacy placement stars; TF0–TF22: Tournament Finals flags
const VALID_REWARD_CODES = new Set([
  "T1", "T2", "T3", "T4", "T5",
  ...VALID_TF_CODES,
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

interface AggregatedPlacements {
  T1: number; T2: number; T3: number; T4: number; T5: number;
  RT1: number; RT2: number; RT3: number; RT4: number;
  [key: string]: number;
}

interface AggregatedPlayer {
  name: string;
  handle: string | string[];
  battletag?: string;
  placements: AggregatedPlacements;
  rewards: string[];
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

// ── Classic rewards ───────────────────────────────────────────────────────

function zeroPlacements(): AggregatedPlacements {
  return { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0, RT1: 0, RT2: 0, RT3: 0, RT4: 0 };
}

async function loadClassicRewards(): Promise<Map<string, AggregatedPlayer>> {
  console.log("Loading classic rewards...");

  const content = await Deno.readTextFile(CLASSIC_REWARDS_PATH);
  const raw = parseYaml(content) as { players?: unknown[] };

  if (!raw?.players || !Array.isArray(raw.players)) {
    throw new Error("classic-rewards.yml: expected top-level 'players' array");
  }

  const dataMap = new Map<string, AggregatedPlayer>();
  let withRewards = 0;

  for (const entry of raw.players) {
    const record = entry as Record<string, unknown>;
    const name = record.name as string;
    const handle = record.handle as string | string[];
    const battletag = record.battletag as string | undefined;
    const placements = record.placements as Record<string, number>;
    const rewards = (record.rewards as string[] | undefined) ?? [];

    const player: AggregatedPlayer = {
      name,
      handle,
      ...(battletag ? { battletag } : {}),
      placements: {
        ...zeroPlacements(),
        T1: placements.T1, T2: placements.T2, T3: placements.T3,
        T4: placements.T4, T5: placements.T5,
      },
      rewards: [...rewards],
    };

    if (rewards.length > 0) withRewards++;

    const handles = Array.isArray(handle) ? handle : [handle];
    for (const h of handles) {
      if (dataMap.has(h)) {
        console.warn(`  WARN: duplicate handle ${h} in classic-rewards.yml (later entry wins)`);
      }
      dataMap.set(h, player);
    }
  }

  console.log(`  Loaded ${raw.players.length} entries (${dataMap.size} unique handles) from tournament/classic/classic-rewards.yml`);
  console.log(`  ${withRewards} players with TF rewards, ${raw.players.length - withRewards} without`);

  return dataMap;
}

// ── Reward aggregation ───────────────────────────────────────────────────

interface MergeStats {
  updated: number;
  added: number;
  rtCounts: Record<string, number>;
  tfCounts: Record<string, number>;
}

function mergeTournamentRewards(
  dataMap: Map<string, AggregatedPlayer>,
  tournament: Tournament,
): MergeStats {
  const stats: MergeStats = { updated: 0, added: 0, rtCounts: {}, tfCounts: {} };

  for (const team of tournament.teams) {
    const rtKey = RT_PLACEMENT_KEYS[team.placement] ?? "RT4";

    for (const player of team.players) {
      let record = dataMap.get(player.handle);

      if (record) {
        record.name = player.name;
        record.battletag = player.battletag;
        stats.updated++;
      } else {
        record = {
          name: player.name,
          handle: player.handle,
          battletag: player.battletag,
          placements: zeroPlacements(),
          rewards: [],
        };
        dataMap.set(player.handle, record);
        stats.added++;
      }

      record.placements[rtKey]++;
      stats.rtCounts[rtKey] = (stats.rtCounts[rtKey] ?? 0) + 1;

      for (const code of player.rewards) {
        if (VALID_TF_CODES.has(code) && !record.rewards.includes(code)) {
          record.rewards.push(code);
          stats.tfCounts[code] = (stats.tfCounts[code] ?? 0) + 1;
        }
      }
    }
  }

  return stats;
}

function logMergeStats(filename: string, stats: MergeStats): void {
  console.log(`  ${filename}: ${stats.updated} existing players updated, ${stats.added} new players added`);

  const rtParts = Object.entries(stats.rtCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${count}× ${key}`);
  if (rtParts.length > 0) {
    console.log(`    RT rewards: ${rtParts.join(", ")}`);
  }

  const tfParts = Object.entries(stats.tfCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${count}× ${key}`);
  if (tfParts.length > 0) {
    console.log(`    TF rewards granted: ${tfParts.join(", ")}`);
  }
}

async function writePlayerRewards(dataMap: Map<string, AggregatedPlayer>): Promise<void> {
  const players = [...new Set(dataMap.values())]
    .map((player) => {
      const out: Record<string, unknown> = {
        name: player.name,
        handle: player.handle,
      };
      if (player.battletag) out.battletag = player.battletag;
      out.placements = player.placements;
      out.rewards = [...player.rewards].sort();
      return out;
    })
    .sort((a, b) => (a.name as string).localeCompare(b.name as string));

  const output = {
    generated: new Date().toISOString(),
    playerCount: players.length,
    players,
  };

  await Deno.writeTextFile(
    join(BUILD_DIR, PLAYER_REWARDS_FILENAME),
    JSON.stringify(output, null, JSON_INDENT) + "\n",
  );

  console.log(`  ${PLAYER_REWARDS_FILENAME} (${players.length} players)`);
}

// ── Processing ────────────────────────────────────────────────────────────

interface ProcessedTournament {
  tournament: Tournament;
  outputFile: string;
}

/** Reads, validates, and writes each tournament YAML as JSON (sorted alphabetically). */
async function processTournaments(): Promise<ProcessedTournament[]> {
  const results: ProcessedTournament[] = [];
  const warnings: string[] = [];
  let hasErrors = false;

  const filenames: string[] = [];
  for await (const entry of Deno.readDir(TOURNAMENT_DIR)) {
    if (entry.isFile && entry.name.endsWith(INPUT_EXT)) filenames.push(entry.name);
  }
  filenames.sort();

  for (const filename of filenames) {
    const content = await Deno.readTextFile(join(TOURNAMENT_DIR, filename));

    let tournament: Tournament;
    try {
      tournament = validateTournament(parseYaml(content), filename);
    } catch (e) {
      console.error(`ERROR: ${(e as Error).message}`);
      hasErrors = true;
      continue;
    }

    warnings.push(...checkConsistency(tournament, filename));

    const outputFile = filename.replace(INPUT_EXT, OUTPUT_EXT);
    await Deno.writeTextFile(
      join(BUILD_DIR, outputFile),
      JSON.stringify(tournament, null, JSON_INDENT) + "\n",
    );

    const playerCount = tournament.teams.reduce((sum, team) => sum + team.players.length, 0);
    console.log(`  ${filename} → ${outputFile} (${tournament.teams.length} teams, ${playerCount} players)`);

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
async function writeIndex(
  processed: ProcessedTournament[],
  playerRewardsFile: string,
): Promise<void> {
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
    rewards: playerRewardsFile,
  };

  await Deno.writeTextFile(
    join(BUILD_DIR, INDEX_FILENAME),
    JSON.stringify(index, null, JSON_INDENT) + "\n",
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  try {
    await Deno.remove(BUILD_DIR, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  await Deno.mkdir(BUILD_DIR, { recursive: true });

  const dataMap = await loadClassicRewards();

  console.log("\nBuilding tournament rewards...");
  const processed = await processTournaments();

  console.log("\nMerging tournament rewards...");
  for (const { tournament, outputFile } of processed) {
    const filename = outputFile.replace(OUTPUT_EXT, INPUT_EXT);
    const stats = mergeTournamentRewards(dataMap, tournament);
    logMergeStats(filename, stats);
  }

  console.log("\nWriting player rewards...");
  await writePlayerRewards(dataMap);

  await writeIndex(processed, PLAYER_REWARDS_FILENAME);

  console.log(`\nGenerated ${processed.length} tournament file(s) + ${PLAYER_REWARDS_FILENAME} into build/tournament/`);
}

main();
