/**
 * Generates patch/index.json from frontmatter metadata in all patch note .md files.
 *
 * Validates frontmatter against schema/patch-note.schema.json, lints heading
 * hierarchy, verifies relative asset references exist on disk, then outputs
 * a JSON index with absolute raw.githubusercontent.com URLs.
 *
 * Usage:
 *   REPO_OWNER=star-battle REPO_NAME=patch-notes COMMIT_SHA=<sha> \
 *     deno run --allow-read --allow-write --allow-env scripts/generate-index.ts
 */

import { parse as parseYaml } from "@std/yaml";
import { join, dirname, fromFileUrl } from "@std/path";

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const PATCH_DIR = join(REPO_ROOT, "patch");
const SCHEMA_PATH = join(REPO_ROOT, "schema", "patch-note.schema.json");

const REPO_OWNER = Deno.env.get("REPO_OWNER") ?? "star-battle";
const REPO_NAME = Deno.env.get("REPO_NAME") ?? "patch-notes";
const COMMIT_SHA = Deno.env.get("COMMIT_SHA") ?? "master";

const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${COMMIT_SHA}`;

// ── Schema validation ──────────────────────────────────────────────────────

const VALID_STATUSES = new Set(["dev", "test", "live"]);
const VALID_TAGS = new Set(["game-balance", "ui", "bugfixes", "new-content"]);

interface Frontmatter {
  version: string;
  published: string | null;
  updated?: string | null;
  revision?: number | null;
  status: string;
  tags: string[];
}

function validateFrontmatter(fm: unknown, file: string): Frontmatter {
  if (typeof fm !== "object" || fm === null) {
    throw new Error(`[${file}] frontmatter is not an object`);
  }
  const f = fm as Record<string, unknown>;

  if (typeof f.version !== "string" || !/^\d+\.\d+$/.test(f.version)) {
    throw new Error(`[${file}] invalid version: ${JSON.stringify(f.version)}`);
  }
  if (f.published !== null && typeof f.published !== "string") {
    throw new Error(`[${file}] published must be a string or null`);
  }
  if (f.updated !== undefined && f.updated !== null && typeof f.updated !== "string") {
    throw new Error(`[${file}] updated must be a string or null`);
  }
  if (f.revision !== undefined && f.revision !== null && typeof f.revision !== "number") {
    throw new Error(`[${file}] revision must be an integer or null`);
  }
  if (!VALID_STATUSES.has(f.status as string)) {
    throw new Error(`[${file}] invalid status: ${JSON.stringify(f.status)}`);
  }
  if (!Array.isArray(f.tags) || f.tags.length === 0) {
    throw new Error(`[${file}] tags must be a non-empty array`);
  }
  for (const tag of f.tags as string[]) {
    if (!VALID_TAGS.has(tag)) {
      throw new Error(`[${file}] invalid tag: ${JSON.stringify(tag)}`);
    }
  }

  return {
    version: f.version as string,
    published: (f.published ?? null) as string | null,
    updated: (f.updated ?? null) as string | null,
    revision: (f.revision ?? null) as number | null,
    status: f.status as string,
    tags: f.tags as string[],
  };
}

// ── Frontmatter extraction ─────────────────────────────────────────────────

function extractFrontmatter(content: string, file: string): { fm: Frontmatter; body: string } {
  if (!content.startsWith("---\n")) {
    throw new Error(`[${file}] missing frontmatter opening ---`);
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error(`[${file}] missing frontmatter closing ---`);
  }
  const yamlStr = content.slice(4, end);
  const body = content.slice(end + 5);
  const raw = parseYaml(yamlStr);
  const fm = validateFrontmatter(raw, file);
  return { fm, body };
}

// ── Asset reference extraction ─────────────────────────────────────────────

function extractAssetRefs(body: string): string[] {
  const refs = new Set<string>();
  // Matches ![...](./assets/...) and [...](./assets/...)
  const pattern = /\]\(\.(\/assets\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(body)) !== null) {
    // Strip leading ./ to get path relative to patch/
    refs.add(m[1].slice(1)); // "/assets/..." -> keep as-is for joining with PATCH_DIR
  }
  return Array.from(refs);
}

// ── Markdown linting ───────────────────────────────────────────────────────

function lintHeadings(body: string, file: string): string[] {
  const warnings: string[] = [];
  const lines = body.split("\n");
  let h1Count = 0;
  let prevLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6}) /);
    if (!m) continue;
    const level = m[1].length;

    if (level === 1) h1Count++;
    if (prevLevel > 0 && level > prevLevel + 1) {
      warnings.push(`[${file}:${i + 1}] heading jumps from H${prevLevel} to H${level}`);
    }
    prevLevel = level;
  }

  if (h1Count !== 1) {
    warnings.push(`[${file}] expected exactly 1 H1 heading, found ${h1Count}`);
  }
  return warnings;
}

// ── Version sort (newest first) ────────────────────────────────────────────

function versionKey(v: string): number {
  const [major, minor] = v.split(".").map(Number);
  return major * 1000 + minor;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const entries = [];
  const allWarnings: string[] = [];
  let hasErrors = false;

  for await (const entry of Deno.readDir(PATCH_DIR)) {
    if (!entry.isFile || !entry.name.match(/^sbr-patch-note-\d+-\d+\.md$/)) continue;

    const filePath = join(PATCH_DIR, entry.name);
    const content = await Deno.readTextFile(filePath);

    let fm: Frontmatter;
    let body: string;
    try {
      ({ fm, body } = extractFrontmatter(content, entry.name));
    } catch (e) {
      console.error(`ERROR: ${(e as Error).message}`);
      hasErrors = true;
      continue;
    }

    // Lint headings
    const warnings = lintHeadings(body, entry.name);
    allWarnings.push(...warnings);

    // Extract and verify asset refs
    const assetRefs = extractAssetRefs(body);
    const assets: Record<string, string> = {};

    for (const ref of assetRefs) {
      const diskPath = join(PATCH_DIR, ref);
      try {
        await Deno.stat(diskPath);
      } catch {
        const msg = `[${entry.name}] referenced asset not found on disk: ${ref}`;
        allWarnings.push(msg);
      }
      assets[ref] = `${RAW_BASE}/patch/${ref}`;
    }

    entries.push({
      version: fm.version,
      published: fm.published,
      updated: fm.updated ?? null,
      revision: fm.revision ?? null,
      status: fm.status,
      tags: fm.tags,
      file: `${RAW_BASE}/patch/${entry.name}`,
      assets,
    });
  }

  if (allWarnings.length > 0) {
    for (const w of allWarnings) console.warn(`WARN: ${w}`);
  }

  if (hasErrors) {
    console.error("Aborting due to validation errors.");
    Deno.exit(1);
  }

  entries.sort((a, b) => versionKey(b.version) - versionKey(a.version));

  const index = {
    generated: new Date().toISOString(),
    patches: entries,
  };

  const outPath = join(PATCH_DIR, "index.json");
  await Deno.writeTextFile(outPath, JSON.stringify(index, null, 2) + "\n");
  console.log(`Generated ${outPath} with ${entries.length} entries.`);
}

main();
