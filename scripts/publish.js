// AI Signal — writes the website for one issue into docs/ (served by GitHub Pages):
//   index.html            product page with today's issue
//   latest/index.html     today's issue
//   archive/<date>.html   every issue, kept forever
//   archive/index.html    list of issues
//   feed.xml              Atom feed of the last 30 issues
//   latest.json           today's issue as data, for other sites (the author's homepage shows it as a card)

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import { renderIssue, renderArchive } from './render.js';
import { renderLanding, renderFeed, entryFromArchive } from './site.js';

export async function publishWeb(webDir, issue, meta) {
  await mkdir(join(webDir, 'archive'), { recursive: true });
  await mkdir(join(webDir, 'latest'), { recursive: true });
  const page = renderIssue(issue, meta, { mode: 'web', base: '../' });
  await writeFile(join(webDir, 'latest', 'index.html'), page, 'utf-8');
  await writeFile(join(webDir, 'archive', `${meta.ymd}.html`), page, 'utf-8');
  await writeFile(join(webDir, 'index.html'), renderLanding(issue, meta), 'utf-8');
  await writeFile(join(webDir, 'latest.json'), JSON.stringify(latestJson(issue, meta), null, 2) + '\n', 'utf-8');

  const dates = (await readdir(join(webDir, 'archive')))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).map((f) => f.slice(0, 10)).sort().reverse();
  await writeFile(join(webDir, 'archive', 'index.html'), renderArchive(dates), 'utf-8');

  const entries = [];
  for (const day of dates.slice(0, 30)) {
    entries.push(entryFromArchive(await readFile(join(webDir, 'archive', `${day}.html`), 'utf-8'), day));
  }
  await writeFile(join(webDir, 'feed.xml'), renderFeed(entries, { updated: entries[0]?.updated }), 'utf-8');
}

// Plain data, no HTML: the homepage renders it in its own type. Same numbers as the issue header.
export function latestJson(issue, meta) {
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
  };
}
