// AI Signal — writes the website for one issue into docs/ (served by GitHub Pages):
//   index.html            product page, built from latest.json and the archive (site.js)
//   latest/index.html     today's issue
//   archive/<date>.html   every issue, kept forever
//   archive/index.html    list of issues
//   feed.xml              Atom feed of the last 30 issues
//   latest.json           today's issue as data, for other sites (the author's homepage shows it as a card)

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import { renderIssue, renderArchive } from './render.js';
import { renderLanding, renderFeed, entryFromArchive } from './site.js';

// `landing` is injectable for tests only.
export async function publishWeb(webDir, issue, meta, { landing = renderLanding } = {}) {
  await mkdir(join(webDir, 'archive'), { recursive: true });
  await mkdir(join(webDir, 'latest'), { recursive: true });
  const page = renderIssue(issue, meta, { mode: 'web', base: '../' });
  await writeFile(join(webDir, 'latest', 'index.html'), page, 'utf-8');
  await writeFile(join(webDir, 'archive', `${meta.ymd}.html`), page, 'utf-8');
  const data = latestJson(issue, meta);
  await writeFile(join(webDir, 'latest.json'), JSON.stringify(data, null, 2) + '\n', 'utf-8');

  const dates = await archiveDates(webDir);
  await writeFile(join(webDir, 'archive', 'index.html'), renderArchive(dates), 'utf-8');

  // This runs before the email is sent, so the product page may never be the reason an issue does not go out:
  // if it cannot be built, the previous index.html stays and the run goes on.
  try {
    await writeHome(webDir, data, dates, landing);
  } catch (e) {
    console.error(`[ai-signal] product page not rebuilt, the previous one stays: ${e.stack || e.message}`);
  }

  const entries = [];
  for (const day of dates.slice(0, 30)) {
    entries.push(entryFromArchive(await readFile(join(webDir, 'archive', `${day}.html`), 'utf-8'), day));
  }
  const updated = entries.map((entry) => entry.updated).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  await writeFile(join(webDir, 'feed.xml'), renderFeed(entries, { updated }), 'utf-8');
}

// The product page again from latest.json, without a new issue (after a design change: rebuild-home.js).
export async function rebuildHome(webDir, { landing = renderLanding } = {}) {
  const data = JSON.parse(await readFile(join(webDir, 'latest.json'), 'utf-8'));
  await writeHome(webDir, data, await archiveDates(webDir), landing);
}

async function writeHome(webDir, data, dates, landing) {
  await writeFile(join(webDir, 'index.html'), landing(data, { dates, stats: await archiveStats(webDir, dates) }), 'utf-8');
}

// Archived days, newest first.
async function archiveDates(webDir) {
  const files = await readdir(join(webDir, 'archive')).catch((e) => { if (e.code === 'ENOENT') return []; throw e; });
  return files.filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).map((f) => f.slice(0, 10)).sort().reverse();
}

// Average size of an issue over everything archived, read from each page's header line
// ("从 68 条新内容里选了 32 条"). Pages without that line are skipped; null when none has it.
export async function archiveStats(webDir, dates) {
  const rows = [];
  for (const day of dates) {
    const html = await readFile(join(webDir, 'archive', `${day}.html`), 'utf-8').catch(() => '');
    const m = html.match(/从 (\d+) 条新内容里选了 (\d+) 条/);
    if (m) rows.push({ scanned: Number(m[1]), picked: Number(m[2]) });
  }
  if (!rows.length) return null;
  const avg = (key) => Math.round(rows.reduce((sum, r) => sum + r[key], 0) / rows.length);
  return { count: rows.length, scanned: avg('scanned'), picked: avg('picked') };
}

// prepare-digest.js reports failures under internal labels; the page shows the source as a reader knows it,
// and leaves out entries that are not a source (the config file).
const MISSING_NAMES = {
  'Reddit (AINews)': 'Reddit',
  'HF Daily Papers': 'Hugging Face 论文',
  'HF 热门模型': 'Hugging Face 模型',
  'follow-builders X feed unavailable': 'X 上的 builder',
  'follow-builders podcast feed unavailable': '播客',
};
export function missingNames(missing) {
  const names = (missing || []).map((m) => String(m).split(':')[0].trim()).filter((n) => n && n !== 'config');
  return [...new Set(names.map((n) => MISSING_NAMES[n] || n))];
}

const SOURCE_KEYS = ['builders', 'tweets', 'blogs', 'hackernews', 'techmeme', 'reddit', 'papers', 'models', 'github', 'products', 'chinese', 'podcasts'];

// Plain data, no HTML: the homepage renders it in its own type. Same numbers as the issue header.
// Fields are only ever added: the author's homepage (qinxujunai.github.io, scripts/signal.mjs) reads this.
export function latestJson(issue, meta) {
  const stats = meta.stats || {};
  return {
    number: meta.number,
    date: meta.ymd,
    dateLabel: meta.dateLabel,
    scanned: meta.scanned,
    picked: meta.picked,
    minutes: Math.max(2, Math.round(meta.picked * 0.18)),
    headline: issue.headline,
    intro: issue.intro || '',
    tldr: (issue.tldr || []).slice(0, 3),
    url: `https://qinxujunai.github.io/ai-signal/archive/${meta.ymd}.html`,
    // Items fetched per source, and sources that failed that day (names only, as the issue footer shows them).
    sources: Object.fromEntries(SOURCE_KEYS.filter((k) => Number.isFinite(stats[k])).map((k) => [k, stats[k]])),
    missing: missingNames(meta.missing),
    degraded: Boolean(issue.degraded),
  };
}
