// AI Signal — sources. Pure parsers (tested in test/) plus the fetchers that use them.
// Every fetcher may throw; prepare-digest.js wraps each one so a dead source never stops an issue.

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

const entities = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#039;|&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// CDATA → entities → tags → entities again (feeds often escape their HTML twice).
export const decode = (s = '') => entities(entities(String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).replace(/<[^>]+>/g, ' '))
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const toISO = (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? null : t.toISOString(); };

// Minimal RSS 2.0 / Atom parser: title, link, date, summary, and the raw item for source-specific parsing.
export function parseFeed(xml) {
  const blocks = String(xml).split(/<item[\s>]|<entry[\s>]/).slice(1);
  return blocks.map((b) => {
    const tag = (t) => b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1];
    const link = tag('link')?.trim() || b.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
    const date = tag('pubDate') || tag('published') || tag('updated') || tag('dc:date');
    return {
      title: decode(tag('title')),
      url: decode(link),
      publishedAt: date ? toISO(decode(date)) : null,
      summary: decode(tag('description') || tag('summary') || tag('content') || '').slice(0, 400),
      raw: b,
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
      const original = i.raw.match(/<B><A HREF="([^"]+)"/i)?.[1] || i.url;
      return { title, url: decode(original), discussion: i.url, by, publishedAt: i.publishedAt };
    })
    .filter((i) => AI_RE.test(i.title));
}

// AINews (Latent Space) publishes a daily recap of X, Reddit and Discord. Its Reddit section is a list of
// threads: <li><p><strong><a href="reddit url">title</a></strong> (Activity: 441): <strong>summary</strong> …
export function parseAINewsReddit(html) {
  const out = [];
  const re = /<li><p><strong><a href="(https:\/\/www\.reddit\.com\/r\/([^/]+)\/comments\/[^"]+)">([\s\S]*?)<\/a><\/strong>\s*\(Activity:\s*([\d,]+)\):\s*([\s\S]*?)<\/p>/g;
  for (const m of String(html).matchAll(re)) {
    out.push({
      title: decode(m[3]).replace(/\s*[-–]\s*$/, ''),
      url: m[1],
      subreddit: `r/${m[2]}`,
      activity: Number(m[4].replace(/,/g, '')) || 0,
      summary: decode(m[5]).slice(0, 500),
    });
  }
  return out.sort((a, b) => b.activity - a.activity);
}

// The newest AINews issue in the Latent Space feed, if it is recent enough.
export function latestAINews(xml, { now = Date.now(), window = 36 * HOURS } = {}) {
  const issue = parseFeed(xml).find((i) => /^\s*\[AINews\]/.test(i.title) && fresh(i.publishedAt, window, now));
  if (!issue) return null;
  const content = issue.raw.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)?.[1] || '';
  const html = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return { title: issue.title.replace(/^\s*\[AINews\]\s*/, ''), url: issue.url, publishedAt: issue.publishedAt, reddit: parseAINewsReddit(html) };
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
  return String(html).split('<article class="Box-row">').slice(1).map((r) => {
    const name = r.match(/<h2[^>]*>[\s\S]*?href="\/([^"]+)"/)?.[1]?.trim();
    const description = decode(r.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/)?.[1] || '');
    const today = r.match(/([\d,]+) stars? today/)?.[1]?.replace(/,/g, '');
    const total = r.match(/href="\/[^"]+\/stargazers"[^>]*>[\s\S]*?([\d,]+)\s*<\/a>/)?.[1]?.replace(/,/g, '');
    const language = decode(r.match(/itemprop="programmingLanguage">([^<]+)</)?.[1] || '');
    return name && { name, description, url: `https://github.com/${name}`, starsToday: Number(today) || 0, stars: Number(total) || 0, language };
  }).filter(Boolean);
}

// Signal strength, 1–3: how many independent sources carried the story, and how hot the main one is.
export function heat(it, alsoCount) {
  const hot = (it.points || 0) >= 300 || (it.activity || 0) >= 1000 || (it.upvotes || 0) >= 100 || (it.starsToday || 0) >= 1000 || (it.likes || 0) >= 2000;
  return Math.min(3, 1 + alsoCount + (hot ? 1 : 0));
}
