#!/usr/bin/env node
// AI Signal — Fetch feed data for LLM curation (v2.0)
// 新增：arxiv、Hacker News、中文AI源、GitHub Trending

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const USER_DIR = join(homedir(), '.ai-signal');
const CONFIG_PATH = join(USER_DIR, 'config.json');

// ── 数据源配置 ──────────────────────────────────────────────────────────────
const FEED_BASE = process.env.FEED_BASE_URL ||
  'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';
const FEED_X_URL = process.env.FEED_X_URL || `${FEED_BASE}/feed-x.json`;
const FEED_PODCASTS_URL = process.env.FEED_PODCASTS_URL || `${FEED_BASE}/feed-podcasts.json`;
const FEED_BLOGS_URL = process.env.FEED_BLOGS_URL || `${FEED_BASE}/feed-blogs.json`;

// ── 工具函数 ────────────────────────────────────────────────────────────────
async function fetchJSON(url, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchText(url, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── Hacker News API ────────────────────────────────────────────────────────
async function fetchHackerNews() {
  try {
    // 获取前30条热门故事
    const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topRes.ok) return [];
    const topIds = await topRes.json();
    const ids = topIds.slice(0, 30);

    const stories = await Promise.all(
      ids.map(async id => {
        const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!res.ok) return null;
        return await res.json();
      })
    );

    return stories
      .filter(s => s && s.title && s.url)
      .filter(s => {
        const title = s.title.toLowerCase();
        return title.includes('ai') || title.includes('llm') || title.includes('gpt') ||
               title.includes('model') || title.includes('machine learning') ||
               title.includes('neural') || title.includes('transformer') ||
               title.includes('openai') || title.includes('anthropic') ||
               title.includes('deepseek') || title.includes('agent');
      })
      .slice(0, 10)
      .map(s => ({
        title: s.title,
        url: s.url,
        score: s.score || 0,
        comments: s.descendants || 0,
        source: 'Hacker News'
      }));
  } catch {
    return [];
  }
}

// ── ArXiv AI Papers ────────────────────────────────────────────────────────
async function fetchArxiv() {
  try {
    // 搜索最新的 AI/ML 论文
    const query = 'cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL';
    const url = `http://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`;
    const text = await fetchText(url, 15000);
    if (!text) return [];

    // 简单解析 XML
    const papers = [];
    const entries = text.split('<entry>').slice(1);
    for (const entry of entries.slice(0, 5)) {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ');
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().slice(0, 300);
      const link = entry.match(/<id>(.*?)<\/id>/)?.[1];
      const authors = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>/g)
        ?.map(a => a.match(/<name>(.*?)<\/name>/)?.[1])
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');

      if (title && link) {
        papers.push({
          title,
          summary,
          url: link.replace('http', 'https'),
          authors,
          source: 'ArXiv'
        });
      }
    }
    return papers;
  } catch {
    return [];
  }
}

// ── GitHub Trending AI ─────────────────────────────────────────────────────
async function fetchGitHubTrending() {
  try {
    // 使用非官方 API 获取 AI 相关 trending
    const url = 'https://api.gitterapp.com/repositories?language=&since=daily';
    const data = await fetchJSON(url);
    if (!data) return [];

    return data
      .filter(r => {
        const desc = (r.description || '').toLowerCase();
        const name = (r.name || '').toLowerCase();
        return desc.includes('ai') || desc.includes('llm') || desc.includes('gpt') ||
               desc.includes('model') || desc.includes('machine-learning') ||
               name.includes('ai') || name.includes('llm');
      })
      .slice(0, 5)
      .map(r => ({
        name: r.name,
        description: r.description?.slice(0, 200),
        url: r.url,
        stars: r.stars,
        language: r.language,
        source: 'GitHub Trending'
      }));
  } catch {
    return [];
  }
}

// ── 中文 AI 新闻源 ────────────────────────────────────────────────────────
async function fetchChineseAINews() {
  // 使用 RSS2JSON 转换中文 AI 博客的 RSS
  const feeds = [
    'https://api.rss2json.com/v1/api.json?rss_url=https://www.jiqizhixin.com/rss',
    'https://api.rss2json.com/v1/api.json?rss_url=https://www.qbitai.com/feed'
  ];

  const articles = [];
  for (const feedUrl of feeds) {
    try {
      const data = await fetchJSON(feedUrl, 8000);
      if (data?.items) {
        for (const item of data.items.slice(0, 5)) {
          articles.push({
            title: item.title,
            description: item.description?.slice(0, 200),
            url: item.link,
            pubDate: item.pubDate,
            source: '中文AI媒体'
          });
        }
      }
    } catch {}
  }
  return articles;
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
async function main() {
  const errors = [];

  let config = { language: 'bilingual', frequency: 'daily', delivery: { method: 'email' } };
  if (existsSync(CONFIG_PATH)) {
    try { config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8')); }
    catch (err) { errors.push(`Config read error: ${err.message}`); }
  }

  console.error('[ai-signal] Fetching data from multiple sources...');

  // 并行获取所有数据源
  const [feedX, feedPodcasts, feedBlogs, hnStories, arxivPapers, ghTrending, cnNews] = await Promise.all([
    fetchJSON(FEED_X_URL),
    fetchJSON(FEED_PODCASTS_URL),
    fetchJSON(FEED_BLOGS_URL),
    fetchHackerNews(),
    fetchArxiv(),
    fetchGitHubTrending(),
    fetchChineseAINews()
  ]);

  if (!feedX) errors.push('Could not fetch tweet feed');
  if (!feedPodcasts) errors.push('Could not fetch podcast feed');
  if (!feedBlogs) errors.push('Could not fetch blog feed');
  if (hnStories.length === 0) errors.push('Could not fetch Hacker News');
  if (arxivPapers.length === 0) errors.push('Could not fetch ArXiv papers');

  const output = {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    config: {
      language: config.language || 'bilingual',
      frequency: config.frequency || 'daily',
      delivery: config.delivery || { method: 'email' },
      interests: config.interests || []
    },
    // 原有数据源
    podcasts: feedPodcasts?.podcasts || [],
    x: feedX?.x || [],
    blogs: feedBlogs?.blogs || [],
    // 新增数据源
    hackernews: hnStories,
    arxiv: arxivPapers,
    githubTrending: ghTrending,
    chineseNews: cnNews,
    stats: {
      podcastEpisodes: feedPodcasts?.podcasts?.length || 0,
      xBuilders: feedX?.x?.length || 0,
      totalTweets: (feedX?.x || []).reduce((sum, a) => sum + a.tweets.length, 0),
      blogPosts: feedBlogs?.blogs?.length || 0,
      hackernewsStories: hnStories.length,
      arxivPapers: arxivPapers.length,
      githubTrending: ghTrending.length,
      chineseNews: cnNews.length,
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
