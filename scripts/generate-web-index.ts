/**
 * Generates build artifacts for the SBR web frontpage and external-site redirects.
 *
 * Reads:
 *   - web/index.md            → build/web/index.html
 *   - web/external-sites.json → build/web/{path}/index.html (meta-refresh redirects)
 *   - web/assets/             → build/web/assets/ (copied verbatim)
 *
 * Usage:
 *   deno run --allow-read --allow-write --allow-env scripts/generate-web-index.ts
 */

import { join, dirname, fromFileUrl } from "@std/path";
import { render } from "@deno/gfm";

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const WEB_DIR = join(REPO_ROOT, "web");
const BUILD_DIR = join(REPO_ROOT, "build", "web");
const LAYOUT_PATH = join(REPO_ROOT, "layout", "default.html");

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function buildRedirectHtml(targetUrl: string): string {
  const escaped = targetUrl.replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Redirecting…</title>
  <meta http-equiv="refresh" content="0; url=${escaped}" />
  <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
  <p>Redirecting to <a href="${escaped}">${escaped}</a>…</p>
</body>
</html>
`;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await Deno.mkdir(dest, { recursive: true });
  for await (const entry of Deno.readDir(src)) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory) {
      await copyDir(srcPath, destPath);
    } else {
      await Deno.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  try {
    await Deno.remove(BUILD_DIR, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  await Deno.mkdir(BUILD_DIR, { recursive: true });

  const template = await Deno.readTextFile(LAYOUT_PATH);

  // ── index.html ──────────────────────────────────────────────────────────

  const indexMd = await Deno.readTextFile(join(WEB_DIR, "index.md"));
  const indexHtml = render(indexMd, { allowIframes: false });

  await Deno.writeTextFile(
    join(BUILD_DIR, "index.html"),
    applyTemplate(template, {
      title: "Star Battle Reloaded",
      head: "",
      header: "",
      content: indexHtml,
      styles: "",
    }),
  );

  // ── Redirect pages ───────────────────────────────────────────────────────

  const redirects: Record<string, string> = JSON.parse(
    await Deno.readTextFile(join(WEB_DIR, "external-sites.json")),
  );

  let redirectCount = 0;
  for (const [path, targetUrl] of Object.entries(redirects)) {
    const segments = path.replace(/^\//, "").split("/");
    const outputDir = join(BUILD_DIR, "link", ...segments);
    await Deno.mkdir(outputDir, { recursive: true });
    await Deno.writeTextFile(join(outputDir, "index.html"), buildRedirectHtml(targetUrl));
    redirectCount++;
  }

  // ── Copy assets ──────────────────────────────────────────────────────────

  try {
    await copyDir(join(WEB_DIR, "assets"), join(BUILD_DIR, "assets"));
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }

  console.log(`Generated index.html, ${redirectCount} redirect pages into build/web/`);
}

main();
