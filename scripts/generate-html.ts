/**
 * Generates HTML files from patch note .md files using @deno/gfm.
 *
 * For each patch note:
 *   - Parses YAML frontmatter to build a metadata header
 *   - Renders markdown body to HTML
 *   - Resolves ./assets/... references to absolute raw.githubusercontent.com URLs
 *   - Injects into layout/default.html template
 *   - Writes patch/sbr-patch-note-X-Y.html
 *
 * Also generates patch/index.html listing all patch notes.
 *
 * Usage:
 *   REPO_OWNER=star-battle REPO_NAME=patch-notes COMMIT_SHA=<sha> \
 *     deno run --allow-read --allow-write --allow-env scripts/generate-html.ts
 */

import { parse as parseYaml } from "@std/yaml";
import { join, dirname, fromFileUrl, basename } from "@std/path";
import { render } from "@deno/gfm";

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const PATCH_DIR = join(REPO_ROOT, "patch");
const LAYOUT_PATH = join(REPO_ROOT, "layout", "default.html");

const REPO_OWNER = Deno.env.get("REPO_OWNER") ?? "star-battle";
const REPO_NAME = Deno.env.get("REPO_NAME") ?? "patch-notes";
const COMMIT_SHA = Deno.env.get("COMMIT_SHA") ?? "master";

const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${COMMIT_SHA}`;

// ── Frontmatter extraction ─────────────────────────────────────────────────

interface Frontmatter {
  version: string;
  published: string | null;
  updated?: string | null;
  revision?: number | null;
  status: string;
  tags: string[];
}

function extractFrontmatter(content: string): { fm: Frontmatter; body: string } {
  if (!content.startsWith("---\n")) throw new Error("missing frontmatter");
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("missing closing ---");
  const fm = parseYaml(content.slice(4, end)) as Frontmatter;
  return { fm, body: content.slice(end + 5) };
}

// ── Asset URL rewriting ────────────────────────────────────────────────────

function rewriteAssetUrls(html: string): string {
  // Replace ./assets/X.Y/file.ext with absolute raw GitHub URLs
  return html.replace(/\.\/(assets\/[^"'\s)]+)/g, `${RAW_BASE}/patch/$1`);
}

// ── Status label ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  dev:  "In development",
  test: "Live on Battle.net as separate &#x27;Star Battle Reloaded &lt;TEST&gt;&#x27;",
  live: "Live on Battle.net",
};

// ── Tag CSS class ──────────────────────────────────────────────────────────

function tagClass(tag: string): string {
  return "tag tag-" + tag;
}

// ── Format date ───────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  // e.g. "2021-08-15T00:00Z" -> "Aug 15, 2021"
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

// ── Build metadata header ──────────────────────────────────────────────────

function buildHeader(fm: Frontmatter, title: string): string {
  const statusLabel = STATUS_LABELS[fm.status] ?? fm.status;
  const statusClass = "status-badge status-" + fm.status;
  const tagsHtml = fm.tags.map((t) => `<span class="${tagClass(t)}">${t}</span>`).join(" ");

  return `
<div class="patch-header">
  <h1>${escapeHtml(title)}</h1>
  <div class="meta-row">
    <span class="meta-date">${formatDate(fm.published)}</span>
    <span class="${statusClass}">${statusLabel}</span>
    ${tagsHtml}
  </div>
</div>`.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Template injection ─────────────────────────────────────────────────────

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// ── Per-patch entry ────────────────────────────────────────────────────────

interface PatchEntry {
  version: string;
  published: string | null;
  status: string;
  tags: string[];
  htmlFile: string;
  title: string;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const template = await Deno.readTextFile(LAYOUT_PATH);
  const entries: PatchEntry[] = [];

  for await (const entry of Deno.readDir(PATCH_DIR)) {
    if (!entry.isFile || !entry.name.match(/^sbr-patch-note-\d+-\d+\.md$/)) continue;

    const filePath = join(PATCH_DIR, entry.name);
    const content = await Deno.readTextFile(filePath);

    let fm: Frontmatter;
    let body: string;
    try {
      ({ fm, body } = extractFrontmatter(content));
    } catch (e) {
      console.error(`ERROR: [${entry.name}] ${(e as Error).message}`);
      continue;
    }

    // Strip the H1 from body (it's rendered in the header)
    const bodyWithoutH1 = body.replace(/^# .+\n/, "");

    // Render markdown to HTML
    let renderedHtml = render(bodyWithoutH1, { allowIframes: false });

    // Rewrite relative asset URLs to absolute raw.githubusercontent.com
    renderedHtml = rewriteAssetUrls(renderedHtml);

    const title = `Star Battle Reloaded ${fm.version} - Patch Notes`;
    const header = buildHeader(fm, title);

    const htmlContent = applyTemplate(template, {
      title,
      head: "",
      header,
      content: renderedHtml,
      styles: "",
    });

    const htmlName = entry.name.replace(/\.md$/, ".html");
    const outPath = join(PATCH_DIR, htmlName);
    await Deno.writeTextFile(outPath, htmlContent);

    entries.push({
      version: fm.version,
      published: fm.published,
      status: fm.status,
      tags: fm.tags,
      htmlFile: htmlName,
      title,
    });

    console.log(`Generated ${htmlName}`);
  }

  // Sort newest first
  entries.sort((a, b) => {
    const [amaj, amin] = a.version.split(".").map(Number);
    const [bmaj, bmin] = b.version.split(".").map(Number);
    return (bmaj * 1000 + bmin) - (amaj * 1000 + amin);
  });

  // Generate index.html
  const listItems = entries.map((e) => {
    const tagsHtml = e.tags.map((t) => `<span class="${tagClass(t)}">${t}</span>`).join(" ");
    const statusClass = "status-badge status-" + e.status;
    const statusLabel = STATUS_LABELS[e.status] ?? e.status;
    return `
  <li>
    <a href="${e.htmlFile}">${escapeHtml(e.title)}</a>
    <span class="index-date">${formatDate(e.published)}</span>
    <span class="${statusClass}">${statusLabel}</span>
    ${tagsHtml}
  </li>`.trim();
  }).join("\n  ");

  const indexContent = `<h1>Star Battle Reloaded — Patch Notes</h1>
<ul class="index-list">
  ${listItems}
</ul>`;

  const indexHtml = applyTemplate(template, {
    title: "Star Battle Reloaded — Patch Notes",
    head: "",
    header: "",
    content: indexContent,
    styles: "",
  });

  const indexPath = join(PATCH_DIR, "index.html");
  await Deno.writeTextFile(indexPath, indexHtml);
  console.log(`Generated index.html with ${entries.length} entries.`);
}

main();
