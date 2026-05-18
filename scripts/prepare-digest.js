#!/usr/bin/env node
// AI Signal — Fetch feed data for LLM curation

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const USER_DIR = join(homedir(), '.ai-signal');
const CONFIG_PATH = join(USER_DIR, 'config.json');

const FEED_BASE = process.env.FEED_BASE_URL ||
  'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';
const FEED_X_URL = process.env.FEED_X_URL || `${FEED_BASE}/feed-x.json`;
const FEED_PODCASTS_URL = process.env.FEED_PODCASTS_URL || `${FEED_BASE}/feed-podcasts.json`;
const FEED_BLOGS_URL = process.env.FEED_BLOGS_URL || `${FEED_BASE}/feed-blogs.json`;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  const errors = [];

  let config = { language: 'bilingual', frequency: 'daily', delivery: { method: 'email' } };
  if (existsSync(CONFIG_PATH)) {
    try { config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8')); }
    catch (err) { errors.push(`Config read error: ${err.message}`); }
  }

  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchJSON(FEED_X_URL), fetchJSON(FEED_PODCASTS_URL), fetchJSON(FEED_BLOGS_URL)
  ]);

  if (!feedX) errors.push('Could not fetch tweet feed');
  if (!feedPodcasts) errors.push('Could not fetch podcast feed');
  if (!feedBlogs) errors.push('Could not fetch blog feed');

  const output = {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    config: {
      language: config.language || 'bilingual',
      frequency: config.frequency || 'daily',
      delivery: config.delivery || { method: 'email' }
    },
    podcasts: feedPodcasts?.podcasts || [],
    x: feedX?.x || [],
    blogs: feedBlogs?.blogs || [],
    stats: {
      podcastEpisodes: feedPodcasts?.podcasts?.length || 0,
      xBuilders: feedX?.x?.length || 0,
      totalTweets: (feedX?.x || []).reduce((sum, a) => sum + a.tweets.length, 0),
      blogPosts: feedBlogs?.blogs?.length || 0,
      feedGeneratedAt: feedX?.generatedAt || feedPodcasts?.generatedAt || feedBlogs?.generatedAt || null
    },
    errors: errors.length > 0 ? errors : undefined
  };

  const json = JSON.stringify(output, null, 2);
  console.log(json);

  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) {
    await writeFile(args[outIdx + 1], json, 'utf-8');
    console.error(`[ai-signal] Feed data written to: ${args[outIdx + 1]}`);
  }
}

console.error('[ai-signal] Fetching feed data...');
main().catch(err => {
  console.error(JSON.stringify({ status: 'error', message: err.message }));
  process.exit(1);
});
