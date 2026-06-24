/**
 * Generates build artifacts for the SBR web frontpage and external-site redirects.
 *
 * Reads:
 *   - web/external-sites.json → build/web/{path}/index.html (meta-refresh redirects)
 *   - web/assets/             → build/web/assets/ (copied verbatim)
 *
 * The frontpage HTML is generated inline (no markdown source).
 *
 * Usage:
 *   deno run --allow-read --allow-write --allow-env scripts/generate-web-index.ts
 */

import { join, dirname, fromFileUrl } from "@std/path";

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

const SITE_URL = "https://star-battle.talv.space";
const HERO_TEXT =
  "Star Battle is a team oriented game, that allows you to command a powerful " +
  "space ship and join a battle between Terran and Protoss warfleets.";

function buildIndexHtml(): { content: string; head: string } {
  const content = `<div class="landing">
  <div class="landing-logo">
    <img src="./assets/logo.png" alt="Star Battle Reloaded logo" />
  </div>

  <h2 class="landing-title">Star Battle Reloaded</h2>

  <p class="landing-hero">${HERO_TEXT}</p>

  <div class="card-grid">
    <a class="card" href="https://starbattle.pro" target="_blank" rel="noopener">
      <span class="card-title">Starbattle.pro</span>
      <span class="card-desc">Inhouse League Tracker</span>
    </a>
    <a class="card" href="https://discord.gg/8pNrrM6JMF" target="_blank" rel="noopener">
      <span class="card-title">SBR Discord server</span>
      <span class="card-desc">Join the community</span>
    </a>
    <a class="card" href="https://starbattle.pro/patch-notes" target="_blank" rel="noopener">
      <span class="card-title">Patch notes</span>
      <span class="card-desc">See what's changed</span>
    </a>
  </div>
</div>`;

  const head = `
  <meta name="description" content="${HERO_TEXT}" />
  <meta property="og:title" content="Star Battle Reloaded" />
  <meta property="og:description" content="${HERO_TEXT}" />
  <meta property="og:image" content="${SITE_URL}/assets/logo.png" />
  <meta property="og:url" content="${SITE_URL}/" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Star Battle Reloaded" />
  <meta name="twitter:description" content="${HERO_TEXT}" />
  <meta name="twitter:image" content="${SITE_URL}/assets/logo.png" />
  <style>
    @font-face {
      font-family: 'Electrolize';
      src: url('./assets/electrolize-regular.woff') format('woff');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }

    .landing {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 2rem 0 1rem;
      gap: 1.5rem;
      font-family: 'Electrolize', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }

    .landing-logo img {
      width: 75vh;
      max-width: 100%;
      display: block;
      margin: 0 auto;
      border: 5px solid rgba(255, 255, 255, 0.05);
      border-radius: 5px;
    }

    .landing-title {
      font-family: 'Electrolize', sans-serif;
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-head);
      line-height: 1.2;
      margin: 0;
      border: none;
      padding: 0;
    }

    .landing-hero {
      max-width: 640px;
      color: var(--text-muted);
      font-size: 1.05rem;
      line-height: 1.7;
      margin: 0;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      width: 100%;
      max-width: 800px;
      margin-top: 0.5rem;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 1.35rem 1.5rem;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none !important;
      transition: border-color 0.15s;
    }

    .card:hover {
      border-color: var(--accent-dim);
      text-decoration: none !important;
    }

    .card-title {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--text-head);
    }

    .card-desc {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    @media (max-width: 480px) {
      .landing-title { font-size: 1.6rem; }
      .card-grid { grid-template-columns: 1fr; }
    }
  </style>`;

  return { content, head };
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

  const { content: indexContent, head: indexHead } = buildIndexHtml();

  await Deno.writeTextFile(
    join(BUILD_DIR, "index.html"),
    applyTemplate(template, {
      title: "Star Battle Reloaded",
      head: indexHead,
      header: "",
      content: indexContent,
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
