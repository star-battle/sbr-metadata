/**
 * Generates build artifacts for SBR patch notes.
 *
 * Cleans build/patch/, then for each patch note .md file:
 *   - Validates and parses YAML frontmatter against schema/patch-note.schema.json
 *   - Lints heading hierarchy
 *   - Verifies referenced assets exist on disk
 *   - Renders markdown to HTML via @deno/gfm
 *   - Resolves ./assets/... to absolute raw.githubusercontent.com URLs
 *
 * Outputs:
 *   - build/patch/index.json  — metadata index for third-party consumers
 *   - build/patch/*.html      — individual patch note pages
 *   - build/patch/index.html  — listing page
 *
 * Usage:
 *   deno run --allow-read --allow-write --allow-env --allow-run=git scripts/generate-patch-notes.ts
 *
 * Env vars (all optional — inferred from git when absent):
 *   REPO_OWNER   GitHub org/user  (git remote get-url origin)
 *   REPO_NAME    Repository name  (git remote get-url origin)
 *   COMMIT_SHA   Commit ref       (git rev-parse HEAD)
 */

import { parse as parseYaml } from "@std/yaml";
import { join, dirname, fromFileUrl } from "@std/path";
import { render } from "@deno/gfm";

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const PATCH_DIR = join(REPO_ROOT, "patch");
const BUILD_DIR = join(REPO_ROOT, "build", "patch");
const LAYOUT_PATH = join(REPO_ROOT, "layout", "default.html");

// ── Git inference ──────────────────────────────────────────────────────────

async function gitOut(args: string[]): Promise<string> {
  try {
    const { stdout } = await new Deno.Command("git", {
      args,
      stdout: "piped",
      stderr: "null",
    }).output();
    return new TextDecoder().decode(stdout).trim();
  } catch {
    return "";
  }
}

const _gitSha = await gitOut(["rev-parse", "HEAD"]);
const _gitRemote = await gitOut(["remote", "get-url", "origin"]);
const _remoteMatch = _gitRemote.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);

function mustResolve(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`ERROR: ${name} is not set and could not be inferred from git.`);
    Deno.exit(1);
  }
  return value;
}

const REPO_OWNER = mustResolve("REPO_OWNER", Deno.env.get("REPO_OWNER") ?? _remoteMatch?.[1]);
const REPO_NAME  = mustResolve("REPO_NAME",  Deno.env.get("REPO_NAME")  ?? _remoteMatch?.[2]);
const COMMIT_SHA = mustResolve("COMMIT_SHA", Deno.env.get("COMMIT_SHA") ?? (_gitSha || undefined));

const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${COMMIT_SHA}`;

// ── Types ──────────────────────────────────────────────────────────────────

interface Frontmatter {
  version: string;
  published: string | null;
  updated?: string | null;
  revision?: number | null;
  status: string;
  tags: string[];
}

interface PatchEntry {
  version: string;
  published: string | null;
  updated: string | null;
  revision: number | null;
  status: string;
  tags: string[];
  file: string;
  assets: Record<string, string>;
  htmlFile: string;
  title: string;
}

// ── Schema validation ──────────────────────────────────────────────────────

const VALID_STATUSES = new Set(["dev", "test", "live"]);
const VALID_TAGS = new Set(["game-balance", "ui", "bugfixes", "new-content"]);

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
  const fm = validateFrontmatter(parseYaml(content.slice(4, end)), file);
  return { fm, body: content.slice(end + 5) };
}

// ── Asset reference extraction & verification ──────────────────────────────

async function extractAssets(
  body: string,
  file: string,
  warnings: string[],
): Promise<Record<string, string>> {
  const assets: Record<string, string> = {};
  const pattern = /\]\(\.(\/assets\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(body)) !== null) {
    const rel = m[1].slice(1); // "assets/X.Y/file.ext"
    if (rel in assets) continue;
    try {
      await Deno.stat(join(PATCH_DIR, rel));
    } catch {
      warnings.push(`[${file}] referenced asset not found on disk: ${rel}`);
    }
    assets[rel] = `${RAW_BASE}/patch/${rel}`;
  }
  return assets;
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

// ── HTML helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  dev:  "In development",
  test: "Live on Battle.net as separate &#x27;Star Battle Reloaded &lt;TEST&gt;&#x27;",
  live: "Live on Battle.net",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}

function tagClass(tag: string): string {
  return `tag tag-${tag}`;
}

function buildPatchHeader(fm: Frontmatter, title: string): string {
  const tagsHtml = fm.tags.map((t) => `<span class="${tagClass(t)}">${t}</span>`).join(" ");
  return `<div class="patch-header">
  <h1>${escapeHtml(title)}</h1>
  <div class="meta-row">
    <span class="meta-date">${formatDate(fm.published)}</span>
    <span class="status-badge status-${fm.status}">${STATUS_LABELS[fm.status] ?? fm.status}</span>
    ${tagsHtml}
  </div>
</div>`;
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function rewriteAssetUrls(html: string): string {
  return html.replace(/\.\/(assets\/[^"'\s)]+)/g, `${RAW_BASE}/patch/$1`);
}

// ── Version sort key ───────────────────────────────────────────────────────

function versionKey(v: string): number {
  const [major, minor] = v.split(".").map(Number);
  return major * 1000 + minor;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Clean and recreate build/patch/
  try {
    await Deno.remove(BUILD_DIR, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  await Deno.mkdir(BUILD_DIR, { recursive: true });

  const template = await Deno.readTextFile(LAYOUT_PATH);
  const entries: PatchEntry[] = [];
  const allWarnings: string[] = [];
  let hasErrors = false;

  for await (const entry of Deno.readDir(PATCH_DIR)) {
    if (!entry.isFile || !entry.name.match(/^sbr-patch-note-\d+-\d+\.md$/)) continue;

    const content = await Deno.readTextFile(join(PATCH_DIR, entry.name));

    let fm: Frontmatter;
    let body: string;
    try {
      ({ fm, body } = extractFrontmatter(content, entry.name));
    } catch (e) {
      console.error(`ERROR: ${(e as Error).message}`);
      hasErrors = true;
      continue;
    }

    allWarnings.push(...lintHeadings(body, entry.name));
    const assets = await extractAssets(body, entry.name, allWarnings);

    // ── Generate HTML ────────────────────────────────────────────────────

    const title = `Star Battle Reloaded ${fm.version} - Patch Notes`;
    const bodyWithoutH1 = body.replace(/^# .+\n/, "");
    const renderedHtml = rewriteAssetUrls(render(bodyWithoutH1, { allowIframes: false }));

    const htmlName = entry.name.replace(/\.md$/, ".html");
    await Deno.writeTextFile(
      join(BUILD_DIR, htmlName),
      applyTemplate(template, {
        title,
        head: "",
        header: buildPatchHeader(fm, title),
        content: renderedHtml,
        styles: "",
      }),
    );

    entries.push({
      version: fm.version,
      published: fm.published,
      updated: fm.updated ?? null,
      revision: fm.revision ?? null,
      status: fm.status,
      tags: fm.tags,
      file: `${RAW_BASE}/patch/${entry.name}`,
      assets,
      htmlFile: htmlName,
      title,
    });
  }

  for (const w of allWarnings) console.warn(`WARN: ${w}`);

  if (hasErrors) {
    console.error("Aborting due to validation errors.");
    Deno.exit(1);
  }

  entries.sort((a, b) => versionKey(b.version) - versionKey(a.version));

  // ── Generate index.json ──────────────────────────────────────────────────

  await Deno.writeTextFile(
    join(BUILD_DIR, "index.json"),
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        patches: entries.map(({ htmlFile: _, title: __, ...rest }) => rest),
      },
      null,
      2,
    ) + "\n",
  );

  // ── Generate index.html ──────────────────────────────────────────────────

  const listItems = entries.map((e) => {
    return `<li>
    <a href="${e.htmlFile}">${escapeHtml(e.title)}</a>
    <span class="index-date">${formatDate(e.published)}</span>
    <span class="status-badge status-${e.status}">${STATUS_LABELS[e.status] ?? e.status}</span>
  </li>`;
  }).join("\n  ");

  await Deno.writeTextFile(
    join(BUILD_DIR, "index.html"),
    applyTemplate(template, {
      title: "Star Battle Reloaded — Patch Notes",
      head: "",
      header: "",
      content: `<h1>Star Battle Reloaded — Patch Notes</h1>\n<ul class="index-list">\n  ${listItems}\n</ul>`,
      styles: "",
    }),
  );

  console.log(`Generated ${entries.length} patch notes into build/patch/`);
}

main();
