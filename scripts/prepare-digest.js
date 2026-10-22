#!/usr/bin/env node
// AI Signal — collect the raw material for one issue (v4).
//
// Sources (every one is optional; a dead source is reported in the footer, never fatal):
//   X posts, podcasts, blogs     follow-builders open feeds
//   Lab blogs                    official RSS: OpenAI, Anthropic, Google DeepMind, Google AI, Hugging Face, Qwen, Simon Willison
//   Hacker News                  Algolia API: AI stories from the last 36 h with 60+ points
//   Techmeme                     the tech industry's front page, AI headlines only
//   Reddit                       via AINews (Latent Space): r/LocalLLaMA and other AI subreddits, ranked by activity
//   Papers                       Hugging Face Daily Papers, ranked by community upvotes
//   Models                       Hugging Face trending models (new open weights)
//   Open source                  GitHub Trending (today), AI repositories only
//   Products                     Product Hunt, AI category
//   Chinese media                量子位, 36氪 (AI headlines only)
//
// Anything already sent in an earlier issue (data/seen.json) is dropped, so issues never repeat.
//
// Usage: node prepare-digest.js --out feed.json [--seen ../data/seen.json]

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  HOURS, AI_RE, AI_RE_ZH, get, decode, parseFeed, fresh,
  parseTechmeme, latestAINews, mapHFModels, parseTrending,
} from './sources.js';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };
const CONFIG_PATH = join(homedir(), '.ai-signal', 'config.json');
const SEEN_PATH = arg('--seen');

const NOW = Date.now();
const FRESH = 36 * HOURS; // news window
const BLOG_FRESH = 72 * HOURS; // labs post less often

const FEED_BASE = process.env.FEED_BASE_URL || 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';

const LAB_RSS = [
  ['OpenAI', 'https://openai.com/news/rss.xml'],
  // Anthropic publishes no feed; this community mirror rebuilds one from anthropic.com/news every few hours.
  ['Anthropic', 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml'],
  ['Google DeepMind', 'https://deepmind.google/blog/rss.xml'],
  ['Google AI', 'https://blog.google/innovation-and-ai/technology/ai/rss/'],
  ['Hugging Face', 'https://huggingface.co/blog/feed.xml'],
  ['Qwen', 'https://qwenlm.github.io/blog/index.xml'],
  ['Simon Willison', 'https://simonwillison.net/atom/everything/'],
];
const CN_RSS = [
  ['量子位', 'https://www.qbitai.com/feed', null],
  ['36氪', 'https://36kr.com/feed', AI_RE_ZH],
];

// ── sources ─────────────────────────────────────────────────────────────────
async function followBuilders() {
  const [x, podcasts, blogs] = await Promise.all(['feed-x', 'feed-podcasts', 'feed-blogs'].map((f) =>
    get(`${FEED_BASE}/${f}.json`, { json: true }).catch(() => null)));
  const builders = (x?.x || []).map((b) => ({
    name: b.name, handle: b.handle, role: (b.bio || '').split('\n')[0].trim(),
    tweets: (b.tweets || []).filter((t) => !t.createdAt || fresh(t.createdAt, FRESH, NOW))
      .sort((a, b2) => ((b2.likes || 0) + (b2.retweets || 0) * 2) - ((a.likes || 0) + (a.retweets || 0) * 2))
      .slice(0, 3)
      .map((t) => ({ text: t.text, url: t.url, likes: t.likes || 0, retweets: t.retweets || 0, replies: t.replies || 0 })),
  })).filter((b) => b.tweets.length);
  return {
    x: builders,
    podcasts: (podcasts?.podcasts || []).filter((p) => !p.publishedAt || fresh(p.publishedAt, 10 * 24 * HOURS, NOW)),
    blogs: (blogs?.blogs || []).map((b) => ({ source: b.name, title: decode(b.title), url: b.url, publishedAt: b.publishedAt || null, summary: decode(b.content || b.summary || '').slice(0, 600) })),
    ok: { x: Boolean(x), podcasts: Boolean(podcasts) },
  };
}

async function feeds(list, window, failed) {
  const out = [];
  await Promise.all(list.map(async ([source, url, filter]) => {
    try {
      const items = parseFeed(await get(url))
        .filter((i) => fresh(i.publishedAt, window, NOW) && (!filter || filter.test(i.title)))
        .slice(0, 5);
      for (const { html, ...i } of items) out.push({ source, ...i });
    } catch (e) {
      failed.push(`${source}: ${e.message}`);
    }
  }));
  return out.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
}

async function hackerNews() {
  const since = Math.floor((NOW - FRESH) / 1000);
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points%3E60,created_at_i%3E${since}&hitsPerPage=300`;
  const data = await get(url, { json: true });
  return (data.hits || [])
    .filter((h) => h.title && AI_RE.test(h.title))
    .sort((a, b) => b.points - a.points)
    .slice(0, 15)
    .map((h) => ({
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points,
      comments: h.num_comments || 0,
    }));
}

const techmeme = async () => parseTechmeme(await get('https://www.techmeme.com/feed.xml'), { now: NOW, window: FRESH }).slice(0, 10);

async function reddit() {
  const issue = latestAINews(await get('https://www.latent.space/feed', { timeout: 25000 }), { now: NOW, window: 48 * HOURS });
  if (!issue) throw new Error('no AINews issue in the last 48 h');
  return issue.reddit.slice(0, 10);
}

async function papers() {
  const data = await get('https://huggingface.co/api/daily_papers?limit=50', { json: true });
  return data
    .map((d) => d.paper || d)
    .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
    .slice(0, 8)
    .map((p) => ({
      title: p.title,
      url: `https://huggingface.co/papers/${p.id}`,
      upvotes: p.upvotes || 0,
      summary: (p.ai_summary || p.summary || '').slice(0, 500),
      github: p.githubRepo || null,
    }));
}

const models = async () => mapHFModels(await get('https://huggingface.co/api/models?sort=trendingScore&limit=30', { json: true }), { now: NOW }).slice(0, 8);

// Trending page first; the search API when the page cannot be read.
async function trending() {
  try {
    return parseTrending(await get('https://github.com/trending?since=daily'))
      .filter((r) => AI_RE.test(`${r.name} ${r.description}`)).slice(0, 8);
  } catch {
    const week = new Date(NOW - 7 * 24 * HOURS).toISOString().slice(0, 10);
    const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const data = await get(`https://api.github.com/search/repositories?q=topic:llm+created:%3E${week}&sort=stars&order=desc&per_page=8`, { json: true, headers });
    return (data.items || []).map((r) => ({ name: r.full_name, description: r.description || '', url: r.html_url, stars: r.stargazers_count, starsToday: 0, language: r.language || '' }));
  }
}

async function products() {
  return parseFeed(await get('https://www.producthunt.com/feed?category=artificial-intelligence'))
    .filter((i) => fresh(i.publishedAt, FRESH, NOW))
    .slice(0, 8)
    .map(({ html, ...i }) => ({ ...i, summary: decode(i.summary).replace(/\s*Discussion\s*\|\s*Link\s*$/, '') }));
}

// ── main ────────────────────────────────────────────────────────────────────
const settle = async (name, p, errors) => {
  try { return await p; } catch (e) { errors.push(`${name}: ${e.message}`); return []; }
};

async function main() {
  const errors = [];
  let config = { language: 'zh', delivery: { method: 'email' } };
  if (existsSync(CONFIG_PATH)) {
    try { config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8')); } catch (e) { errors.push(`config: ${e.message}`); }
  }
  const seen = new Set(SEEN_PATH && existsSync(SEEN_PATH) ? Object.keys(JSON.parse(await readFile(SEEN_PATH, 'utf-8'))) : []);
  const unseen = (items) => items.filter((i) => !seen.has(i.url));

  console.error('[ai-signal] fetching sources…');
  const failed = [];
  const [fb, blogs, cn, hn, tm, rd, pp, md, gh, ph] = await Promise.all([
    followBuilders(),
    feeds(LAB_RSS, BLOG_FRESH, failed),
    feeds(CN_RSS, 48 * HOURS, failed),
    settle('Hacker News', hackerNews(), errors),
    settle('Techmeme', techmeme(), errors),
    settle('Reddit (AINews)', reddit(), errors),
    settle('HF Daily Papers', papers(), errors),
    settle('HF 热门模型', models(), errors),
    settle('GitHub Trending', trending(), errors),
    settle('Product Hunt', products(), errors),
  ]);
  if (!fb.ok.x) errors.push('follow-builders X feed unavailable');
  if (!fb.ok.podcasts) errors.push('follow-builders podcast feed unavailable');
  errors.push(...failed);

  const x = fb.x.map((b) => ({ ...b, tweets: unseen(b.tweets) })).filter((b) => b.tweets.length);
  const out = {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    config: {
      language: config.language || 'zh',
      delivery: config.delivery || { method: 'email' },
      interests: config.interests || [],
    },
    x,
    podcasts: unseen(fb.podcasts),
    blogs: unseen([...fb.blogs, ...blogs].filter((b, i, all) => all.findIndex((o) => o.url === b.url) === i)),
    hackernews: unseen(hn),
    techmeme: unseen(tm),
    reddit: unseen(rd),
    papers: unseen(pp),
    models: unseen(md),
    github: unseen(gh),
    products: unseen(ph),
    chinese: unseen(cn),
    errors: errors.length ? errors : undefined,
  };
  const KEYS = ['blogs', 'hackernews', 'techmeme', 'reddit', 'papers', 'models', 'github', 'products', 'chinese', 'podcasts'];
  out.stats = { tweets: x.reduce((s, b) => s + b.tweets.length, 0), builders: x.length, skippedSeen: seen.size };
  for (const k of KEYS) out.stats[k] = out[k].length;
  out.stats.total = out.stats.tweets + KEYS.reduce((s, k) => s + out.stats[k], 0);

  const json = JSON.stringify(out, null, 2);
  const file = arg('--out');
  if (file) await writeFile(file, json, 'utf-8');
  else process.stdout.write(json);
  console.error(`[ai-signal] ${out.stats.total} fresh items · ${JSON.stringify(out.stats)}${errors.length ? `\n[ai-signal] warnings: ${errors.join(' | ')}` : ''}`);
}

main().catch((e) => {
  console.error(JSON.stringify({ status: 'error', message: e.message }));
  process.exit(1);
});
