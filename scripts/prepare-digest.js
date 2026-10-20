#!/usr/bin/env node
// AI Signal — collect the raw material for one issue (v3).
//
// Sources (every one is optional; a dead source is reported, never fatal):
//   X posts, podcasts, lab blogs   follow-builders open feeds
//   Lab blogs                      official RSS: OpenAI, Google DeepMind, Google AI, Hugging Face, Simon Willison
//   Hacker News                    Algolia API: AI stories from the last 36 h with 60+ points
//   Papers                         Hugging Face Daily Papers, ranked by community upvotes
//   Open source                    GitHub Trending (today), AI repositories only
//   Chinese media                  量子位 RSS
//
// Anything already sent in an earlier issue (data/seen.json) is dropped, so issues never repeat.
//
// Usage: node prepare-digest.js --out feed.json [--seen ../data/seen.json]

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };
const CONFIG_PATH = join(homedir(), '.ai-signal', 'config.json');
const SEEN_PATH = arg('--seen');

const HOURS = 3600 * 1000;
const NOW = Date.now();
const FRESH = 36 * HOURS; // news window
const BLOG_FRESH = 72 * HOURS; // labs post less often
const UA = 'Mozilla/5.0 (compatible; AI-Signal/3.0; +https://github.com/qinxujunai/ai-signal)';

const FEED_BASE = process.env.FEED_BASE_URL || 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';

const RSS = [
  ['OpenAI', 'https://openai.com/news/rss.xml'],
  ['Google DeepMind', 'https://deepmind.google/blog/rss.xml'],
  ['Google AI', 'https://blog.google/innovation-and-ai/technology/ai/rss/'],
  ['Hugging Face', 'https://huggingface.co/blog/feed.xml'],
  ['Simon Willison', 'https://simonwillison.net/atom/everything/'],
];
const CN_RSS = [['量子位', 'https://www.qbitai.com/feed']];

// Word-boundary match, so "said" or "maintain" never count as "ai".
const AI_RE = /\b(ai|a\.i\.|llms?|gpt[-\w.]*|claude|gemini|llama|mistral|qwen|deepseek|openai|anthropic|agentic|transformers?|diffusion|neural|machine learning|ml|rag|inference|fine-?tun\w*|embeddings?|copilot|cursor|chatgpt|reasoning model|foundation model|multimodal|vlm|mcp)\b/i;

// ── fetch helpers ────────────────────────────────────────────────────────────
async function get(url, { timeout = 15000, json = false, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': UA, ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return json ? await res.json() : await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const entities = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#039;|&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// CDATA → entities → tags → entities again (feeds often escape their HTML twice).
const decode = (s = '') => entities(entities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).replace(/<[^>]+>/g, ' '))
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Minimal RSS 2.0 / Atom parser: title, link, date, summary.
function parseFeed(xml) {
  const blocks = xml.split(/<item[\s>]|<entry[\s>]/).slice(1);
  return blocks.map((b) => {
    const tag = (t) => b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1];
    const link = tag('link')?.trim() || b.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
    const date = tag('pubDate') || tag('published') || tag('updated') || tag('dc:date');
    return {
      title: decode(tag('title')),
      url: decode(link),
      publishedAt: date ? new Date(decode(date)).toISOString() : null,
      summary: decode(tag('description') || tag('summary') || tag('content') || '').slice(0, 400),
    };
  }).filter((x) => x.title && x.url);
}

const fresh = (iso, window) => iso && NOW - new Date(iso).getTime() < window;

// ── sources ─────────────────────────────────────────────────────────────────
async function followBuilders() {
  const [x, podcasts, blogs] = await Promise.all(['feed-x', 'feed-podcasts', 'feed-blogs'].map((f) =>
    get(`${FEED_BASE}/${f}.json`, { json: true }).catch(() => null)));
  const builders = (x?.x || []).map((b) => ({
    name: b.name, handle: b.handle, role: (b.bio || '').split('\n')[0].trim(),
    tweets: (b.tweets || []).filter((t) => !t.createdAt || fresh(t.createdAt, FRESH))
      .sort((a, b2) => ((b2.likes || 0) + (b2.retweets || 0) * 2) - ((a.likes || 0) + (a.retweets || 0) * 2))
      .slice(0, 3)
      .map((t) => ({ text: t.text, url: t.url, likes: t.likes || 0, retweets: t.retweets || 0, replies: t.replies || 0 })),
  })).filter((b) => b.tweets.length);
  return {
    x: builders,
    podcasts: (podcasts?.podcasts || []).filter((p) => !p.publishedAt || fresh(p.publishedAt, 10 * 24 * HOURS)),
    blogs: (blogs?.blogs || []).map((b) => ({ source: b.name, title: decode(b.title), url: b.url, publishedAt: b.publishedAt || null, summary: decode(b.content || b.summary || '').slice(0, 600) })),
    ok: { x: Boolean(x), podcasts: Boolean(podcasts), blogs: Boolean(blogs) },
  };
}

async function labBlogs(list, window) {
  const out = [];
  const failed = [];
  await Promise.all(list.map(async ([source, url]) => {
    try {
      const items = parseFeed(await get(url)).filter((i) => fresh(i.publishedAt, window)).slice(0, 4);
      for (const i of items) out.push({ source, ...i });
    } catch (e) {
      failed.push(`${source}: ${e.message}`);
    }
  }));
  return { items: out, failed };
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

// GitHub Trending has no API: read the server-rendered page; fall back to the search API.
async function trending() {
  try {
    const html = await get('https://github.com/trending?since=daily');
    const rows = html.split('<article class="Box-row">').slice(1);
    const repos = rows.map((r) => {
      const name = r.match(/<h2[^>]*>[\s\S]*?href="\/([^"]+)"/)?.[1]?.trim();
      const desc = decode(r.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/)?.[1] || '');
      const today = r.match(/([\d,]+) stars? today/)?.[1]?.replace(/,/g, '');
      const total = r.match(/href="\/[^"]+\/stargazers"[^>]*>[\s\S]*?([\d,]+)\s*<\/a>/)?.[1]?.replace(/,/g, '');
      const lang = decode(r.match(/itemprop="programmingLanguage">([^<]+)</)?.[1] || '');
      return name && { name, description: desc, url: `https://github.com/${name}`, starsToday: Number(today) || 0, stars: Number(total) || 0, language: lang };
    }).filter(Boolean);
    return repos.filter((r) => AI_RE.test(`${r.name} ${r.description}`)).slice(0, 8);
  } catch (e) {
    const week = new Date(NOW - 7 * 24 * HOURS).toISOString().slice(0, 10);
    const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const data = await get(`https://api.github.com/search/repositories?q=topic:llm+created:%3E${week}&sort=stars&order=desc&per_page=8`, { json: true, headers });
    return (data.items || []).map((r) => ({ name: r.full_name, description: r.description || '', url: r.html_url, stars: r.stargazers_count, starsToday: 0, language: r.language || '' }));
  }
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
  const [fb, blogs, cn, hn, pp, gh] = await Promise.all([
    followBuilders(),
    labBlogs(RSS, BLOG_FRESH),
    labBlogs(CN_RSS, 48 * HOURS),
    settle('Hacker News', hackerNews(), errors),
    settle('HF Daily Papers', papers(), errors),
    settle('GitHub Trending', trending(), errors),
  ]);
  if (!fb.ok.x) errors.push('follow-builders X feed unavailable');
  if (!fb.ok.podcasts) errors.push('follow-builders podcast feed unavailable');
  errors.push(...blogs.failed, ...cn.failed);

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
    blogs: unseen([...fb.blogs, ...blogs.items.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))]),
    hackernews: unseen(hn),
    papers: unseen(pp),
    github: unseen(gh),
    chinese: unseen(cn.items),
    errors: errors.length ? errors : undefined,
  };
  out.stats = {
    tweets: x.reduce((s, b) => s + b.tweets.length, 0),
    builders: x.length,
    podcasts: out.podcasts.length,
    blogs: out.blogs.length,
    hackernews: out.hackernews.length,
    papers: out.papers.length,
    github: out.github.length,
    chinese: out.chinese.length,
    skippedSeen: seen.size,
  };
  out.stats.total = ['tweets', 'podcasts', 'blogs', 'hackernews', 'papers', 'github', 'chinese'].reduce((s, k) => s + out.stats[k], 0);

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
