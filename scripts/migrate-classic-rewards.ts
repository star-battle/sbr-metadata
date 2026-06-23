/**
 * One-shot migration: tournament/legacy.csv → tournament/classic/classic-rewards.yml
 *
 * Also generates data/logs/migrate-classic-rewards.log with conversion details.
 *
 * Usage:
 *   deno run --allow-read --allow-write scripts/migrate-classic-rewards.ts
 */

import { stringify as stringifyYaml } from "@std/yaml";
import { join, dirname, fromFileUrl } from "@std/path";

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const CSV_PATH = join(REPO_ROOT, "tournament", "legacy.csv");
const OUTPUT_DIR = join(REPO_ROOT, "tournament", "classic");
const OUTPUT_PATH = join(OUTPUT_DIR, "classic-rewards.yml");
const LOG_DIR = join(REPO_ROOT, "data", "logs");
const LOG_PATH = join(LOG_DIR, "migrate-classic-rewards.log");

const TF_CODES = [
  "TF0", "TF1", "TF2", "TF3", "TF4", "TF5", "TF6", "TF7", "TF8", "TF9",
  "TF10", "TF11", "TF12", "TF13", "TF14", "TF15", "TF16", "TF17", "TF18", "TF19",
  "TF20", "TF21", "TF22",
];

// ── Types ──────────────────────────────────────────────────────────────────

interface CsvRow {
  ToonName: string;
  Player: string;
  Handle: string;
  T1: number;
  T2: number;
  T3: number;
  T4: number;
  T5: number;
  tfFlags: Map<string, number>;
  emptyTfCodes: string[];
}

interface ClassicPlayer {
  name: string;
  handle: string;
  toon_name?: string;
  battletag?: string;
  placements: { T1: number; T2: number; T3: number; T4: number; T5: number };
  rewards?: string[];
}

// ── Logging ────────────────────────────────────────────────────────────────

const log: string[] = [];

function logLine(line: string) {
  log.push(line);
}

function logSection(title: string) {
  log.push("");
  log.push(`── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function stripDiscriminator(value: string): string {
  return value.replace(/#\d+$/, "");
}

function inferName(battletag: string, toonName: string, handle: string): string {
  if (battletag) return stripDiscriminator(battletag);
  if (toonName) return stripDiscriminator(toonName);
  return handle;
}

function normalizeHandle(raw: string): string {
  return raw.replace(/(\d+)-s2-/i, (_, region) => `${region}-S2-`);
}

function parseIntSafe(value: string): number {
  if (value === "" || value === undefined) return 0;
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
}

// ── CSV Parsing ────────────────────────────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  const header = lines[0].split(",");
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const get = (name: string) => cols[header.indexOf(name)]?.trim() ?? "";

    const tfFlags = new Map<string, number>();
    const emptyTfCodes: string[] = [];
    for (const code of TF_CODES) {
      const raw = get(code);
      if (raw === "") emptyTfCodes.push(code);
      tfFlags.set(code, parseIntSafe(raw));
    }

    rows.push({
      ToonName: get("ToonName"),
      Player: get("Player"),
      Handle: get("Handle"),
      T1: parseIntSafe(get("T1")),
      T2: parseIntSafe(get("T2")),
      T3: parseIntSafe(get("T3")),
      T4: parseIntSafe(get("T4")),
      T5: parseIntSafe(get("T5")),
      tfFlags,
      emptyTfCodes,
    });
  }

  return rows;
}

// ── Main ───────────────────────────────────────────────────────────────────

const csvText = await Deno.readTextFile(CSV_PATH);
const rows = parseCsv(csvText);

logSection("Migration Summary");
logLine(`Source: tournament/legacy.csv`);
logLine(`Target: tournament/classic/classic-rewards.yml`);
logLine(`Date: ${new Date().toISOString()}`);
logLine(`Total CSV rows: ${rows.length}`);

// Track anomalies
const normalizedHandles: string[] = [];
const negativeValues: string[] = [];
const emptyTfValues: string[] = [];
const emptyToonNames: string[] = [];
const emptyPlayers: string[] = [];
const allZeroRewards: string[] = [];

// Convert rows to player entries
const players: ClassicPlayer[] = [];

for (const row of rows) {
  const rawHandle = row.Handle;
  const handle = normalizeHandle(rawHandle);

  if (handle !== rawHandle) {
    normalizedHandles.push(`${rawHandle} → ${handle}`);
  }

  // Track negatives
  const negCols: string[] = [];
  if (row.T1 < 0) negCols.push(`T1=${row.T1}`);
  if (row.T2 < 0) negCols.push(`T2=${row.T2}`);
  if (row.T3 < 0) negCols.push(`T3=${row.T3}`);
  if (row.T4 < 0) negCols.push(`T4=${row.T4}`);
  if (row.T5 < 0) negCols.push(`T5=${row.T5}`);
  if (negCols.length > 0) {
    negativeValues.push(`${handle}: ${negCols.join(", ")}`);
  }

  for (const code of row.emptyTfCodes) {
    emptyTfValues.push(`${handle}: ${code} (empty string → 0)`);
  }

  if (!row.ToonName) emptyToonNames.push(handle);
  if (!row.Player) emptyPlayers.push(handle);

  // Check all-zero rewards
  const hasAnyPlacement = row.T1 !== 0 || row.T2 !== 0 || row.T3 !== 0 || row.T4 !== 0 || row.T5 !== 0;
  const earnedRewards = TF_CODES.filter((code) => (row.tfFlags.get(code) ?? 0) !== 0);
  if (!hasAnyPlacement && earnedRewards.length === 0) {
    allZeroRewards.push(handle);
  }

  const name = inferName(row.Player, row.ToonName, handle);

  const player: ClassicPlayer = {
    name,
    handle,
    ...(row.ToonName ? { toon_name: row.ToonName } : {}),
    ...(row.Player ? { battletag: row.Player } : {}),
    placements: { T1: row.T1, T2: row.T2, T3: row.T3, T4: row.T4, T5: row.T5 },
    ...(earnedRewards.length > 0 ? { rewards: earnedRewards } : {}),
  };

  players.push(player);
}

// Sort by name (case-insensitive), then handle as tiebreaker
players.sort((a, b) => {
  const nameCmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (nameCmp !== 0) return nameCmp;
  return a.handle.localeCompare(b.handle);
});

// ── Write YAML ─────────────────────────────────────────────────────────────

await Deno.mkdir(OUTPUT_DIR, { recursive: true });

const yamlData = { players };
const yamlContent = stringifyYaml(yamlData, { lineWidth: -1 });
await Deno.writeTextFile(OUTPUT_PATH, yamlContent);

// ── Write Log ──────────────────────────────────────────────────────────────

logSection("Handles Normalized (lowercase → uppercase)");
if (normalizedHandles.length === 0) {
  logLine("(none)");
} else {
  for (const entry of normalizedHandles) logLine(`  ${entry}`);
}
logLine(`Count: ${normalizedHandles.length}`);

logSection("Negative Placement Values");
if (negativeValues.length === 0) {
  logLine("(none)");
} else {
  for (const entry of negativeValues) logLine(`  ${entry}`);
}
logLine(`Count: ${negativeValues.length}`);

logSection("Empty TF Values (treated as 0)");
if (emptyTfValues.length === 0) {
  logLine("(none)");
} else {
  for (const entry of emptyTfValues) logLine(`  ${entry}`);
}
logLine(`Count: ${emptyTfValues.length}`);

logSection("Empty ToonName");
logLine(`Count: ${emptyToonNames.length}`);
if (emptyToonNames.length > 0) {
  for (const entry of emptyToonNames) logLine(`  ${entry}`);
}

logSection("Empty Player (BattleTag)");
logLine(`Count: ${emptyPlayers.length}`);

logSection("All-Zero Reward Rows");
if (allZeroRewards.length === 0) {
  logLine("(none)");
} else {
  for (const entry of allZeroRewards) logLine(`  ${entry}`);
}
logLine(`Count: ${allZeroRewards.length}`);

logSection("Result");
logLine(`Players written: ${players.length}`);

await Deno.mkdir(LOG_DIR, { recursive: true });
await Deno.writeTextFile(LOG_PATH, log.join("\n") + "\n");

console.log(`✓ Wrote ${players.length} players to ${OUTPUT_PATH}`);
console.log(`✓ Log written to ${LOG_PATH}`);
