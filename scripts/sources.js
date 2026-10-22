// AI Signal — sources. Pure parsers (tested in test/) plus the fetchers that use them.
// Every fetcher may throw; prepare-digest.js wraps each one so a dead source never stops an issue.

import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';

export const HOURS = 3600 * 1000;
const UA = 'Mozilla/5.0 (compatible; AI-Signal/4.0; +https://github.com/qinxujunai/ai-signal)';

// Word-boundary match, so "said" or "maintain" never count as "ai".
export const AI_RE = /\b(ai|a\.i\.|llms?|gpt[-\w.]*|claude|gemini|llama|mistral|qwen|deepseek|openai|anthropic|agentic|agents?|transformers?|diffusion|neural|machine learning|ml|rag|inference|fine-?tun\w*|embeddings?|copilot|cursor|chatgpt|reasoning model|foundation model|multimodal|vlm|mcp|nvidia|gpus?)\b/i;
// Chinese headlines: the same idea for 36氪 and similar general tech feeds.
export const AI_RE_ZH = /(AI|人工智能|大模型|模型|智能体|Agent|算力|芯片|机器人|具身|生成式|多模态|DeepSeek|Qwen|通义|豆包|Kimi|智谱|月之暗面|MiniMax|OpenAI|英伟达)/i;

export async function get(url, { timeout = 15000, json = false, headers = {} } = {}) {
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

// Parsing is delegated to mature libraries: fast-xml-parser for RSS/Atom, cheerio for HTML.
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  cdataPropName: false,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => name === 'item' || name === 'entry' || name === 'link',
});

const textOf = (v) => (v == null ? '' : typeof v === 'object' ? String(v.text ?? '') : String(v));
// Plain text from an HTML fragment (feeds often escape their HTML, so one more pass for leftovers).
export const decode = (s = '') => {
  let text = String(s);
  for (let i = 0; i < 3 && (i === 0 || /<[a-z/!][^>]*>|&[a-z#0-9]+;/i.test(text)); i += 1) {
    text = cheerio.load(`<body>${text}</body>`)('body').text();
  }
  return text.replace(/\s+/g, ' ').trim();
};

const toISO = (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? null : t.toISOString(); };

// RSS 2.0 / Atom items: title, link, date, summary, and the item's HTML for source-specific parsing.
export function parseFeed(source) {
  const doc = xml.parse(String(source));
  const items = doc?.rss?.channel?.item || doc?.rss?.item || doc?.feed?.entry || doc?.['rdf:RDF']?.item || [];
  return items.map((it) => {
    const links = it.link || [];
    const link = links.map((l) => (typeof l === 'object' ? (l.rel && l.rel !== 'alternate' ? '' : l.href || l.text) : l)).find(Boolean) || '';
    const date = textOf(it.pubDate || it.published || it.updated || it['dc:date']);
    const html = textOf(it['content:encoded'] || it.content || it.description || it.summary);
    return {
      title: decode(textOf(it.title)),
      url: String(link).trim(),
      publishedAt: date ? toISO(date.trim()) : null,
      summary: decode(textOf(it.description || it.summary || it.content)).slice(0, 400),
      html,
    };
  }).filter((x) => x.title && x.url);
}

export const fresh = (iso, window, now = Date.now()) => Boolean(iso) && now - new Date(iso).getTime() < window;

// Techmeme: the headline ends with "(Author/Publication)"; the original article is the first bold link.
export function parseTechmeme(xml, { now = Date.now(), window = 36 * HOURS } = {}) {
  return parseFeed(xml)
    .filter((i) => fresh(i.publishedAt, window, now))
    .map((i) => {
      const by = i.title.match(/\(([^()]+)\)\s*$/)?.[1] || '';
      const title = i.title.replace(/\s*\([^()]+\)\s*$/, '');
      // The original article is the first bold link in the item's HTML.
      const original = cheerio.load(i.html)('b a[href]').first().attr('href') || i.url;
      return { title, url: original, discussion: i.url, by, publishedAt: i.publishedAt };
    })
    .filter((i) => AI_RE.test(i.title));
}

// AINews (Latent Space) publishes a daily recap of X, Reddit and Discord. Its Reddit section is a list of
// threads: <li><p><strong><a href="reddit url">title</a></strong> (Activity: 441): <strong>summary</strong> …
export function parseAINewsReddit(html) {
  const $ = cheerio.load(String(html));
  const out = [];
  $('li > p').each((_, p) => {
    const a = $(p).children('strong').first().children('a[href*="reddit.com/r/"]').first();
    if (!a.length) return;
    const url = a.attr('href');
    const rest = $(p).text().slice($(p).children('strong').first().text().length);
    const activity = rest.match(/\(Activity:\s*([\d,]+)\)/)?.[1];
    if (!activity) return;
    out.push({
      title: decode(a.text()).replace(/\s*[-–]\s*$/, ''),
      url,
      subreddit: `r/${url.match(/reddit\.com\/r\/([^/]+)/)[1]}`,
      activity: Number(activity.replace(/,/g, '')) || 0,
      summary: decode(rest.replace(/^\s*\(Activity:[^)]*\):\s*/, '')).slice(0, 500),
    });
  });
  return out.sort((a, b) => b.activity - a.activity);
}

// The newest AINews issue in the Latent Space feed, if it is recent enough.
export function latestAINews(xml, { now = Date.now(), window = 36 * HOURS } = {}) {
  const issue = parseFeed(xml).find((i) => /^\s*\[AINews\]/.test(i.title) && fresh(i.publishedAt, window, now));
  if (!issue) return null;
  return { title: issue.title.replace(/^\s*\[AINews\]\s*/, ''), url: issue.url, publishedAt: issue.publishedAt, reddit: parseAINewsReddit(issue.html) };
}

// Hugging Face trending models: new or newly popular open weights.
export function mapHFModels(list, { now = Date.now(), maxAgeDays = 45 } = {}) {
  return (list || [])
    .filter((m) => m.id && (!m.createdAt || now - new Date(m.createdAt).getTime() < maxAgeDays * 24 * HOURS))
    .map((m) => ({
      name: m.id,
      url: `https://huggingface.co/${m.id}`,
      likes: m.likes || 0,
      downloads: m.downloads || 0,
      task: m.pipeline_tag || '',
      trending: m.trendingScore || 0,
    }));
}

// GitHub Trending has no API: read the server-rendered page.
export function parseTrending(html) {
  const $ = cheerio.load(String(html));
  const num = (t) => Number(String(t || '').replace(/[^\d]/g, '')) || 0;
  return $('article.Box-row').map((_, el) => {
    const row = $(el);
    const name = (row.find('h2 a').attr('href') || '').replace(/^\//, '').trim();
    if (!name) return null;
    return {
      name,
      description: decode(row.find('p').first().text()),
      url: `https://github.com/${name}`,
      starsToday: num(row.text().match(/([\d,]+) stars? today/)?.[1]),
      stars: num(row.find(`a[href="/${name}/stargazers"]`).text()),
      language: decode(row.find('[itemprop="programmingLanguage"]').text()),
    };
  }).get().filter(Boolean);
}

// Signal strength, 1–3: how many independent sources carried the story, and how hot the main one is.
export function heat(it, alsoCount) {
  const hot = (it.points || 0) >= 300 || (it.activity || 0) >= 1000 || (it.upvotes || 0) >= 100 || (it.starsToday || 0) >= 1000 || (it.likes || 0) >= 2000;
  return Math.min(3, 1 + alsoCount + (hot ? 1 : 0));
}
