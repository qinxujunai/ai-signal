#!/usr/bin/env node
// AI Signal — turn one day's raw material into an issue (v3).
//
//   feed.json ──► every item gets an ID (H1, P2, G3 …)
//             ──► DeepSeek writes the issue as JSON and may only cite IDs, never URLs
//             ──► code resolves IDs to real links and real numbers; anything uncited is dropped
//             ──► render.js: email HTML + web edition
//
// If the model is unavailable or its JSON cannot be repaired, the issue is still built from the
// ranked raw material (marked as such), so the email always goes out.
//
// Usage:
//   node remix-digest.js --file feed.json --out email.html
//        [--web-dir ../docs] [--seen ../data/seen.json] [--json-out issue.json] [--content issue.json]

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config as loadEnv } from 'dotenv';
import { renderIssue, renderArchive } from './render.js';
import { heat } from './sources.js';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };
const feed = JSON.parse((await readFile(arg('--file'), 'utf-8')).replace(/^﻿/, ''));

try { loadEnv({ path: join(homedir(), '.ai-signal', '.env') }); } catch {}
const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_URL = 'https://api.deepseek.com/chat/completions';

// Dates are always Beijing time, whatever the runner's clock says.
const TZ = 'Asia/Shanghai';
const now = new Date();
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const dateLabel = new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, month: 'long', day: 'numeric', weekday: 'short' }).format(now);

// ── 1. Give every item an ID ─────────────────────────────────────────────────
const refs = {};
const lines = [];
const add = (prefix, list, fmt) => list.forEach((item, i) => {
  const id = `${prefix}${i + 1}`;
  refs[id] = item;
  lines.push(`[${id}] ${fmt(item)}`);
});
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

const tweets = (feed.x || []).flatMap((b) => b.tweets.map((t) => ({ ...t, who: b.name, role: b.role, kind: 'x' })));
lines.push('## 实验室与公司博客');
add('B', (feed.blogs || []).map((b) => ({ ...b, kind: 'blog' })), (b) => `${b.source}：${b.title} —— ${clip(b.summary, 300)}`);
lines.push('\n## Hacker News（分数 = 社区热度）');
add('H', (feed.hackernews || []).map((h) => ({ ...h, kind: 'hn' })), (h) => `(${h.points} 分, ${h.comments} 评论) ${h.title} —— ${host(h.url)}`);
lines.push('\n## Techmeme（科技行业头条，括号里是作者和媒体）');
add('T', (feed.techmeme || []).map((t) => ({ ...t, kind: 'techmeme' })), (t) => `${t.title} (${t.by})`);
lines.push('\n## Reddit（经 AINews 汇总，Activity = 讨论热度）');
add('R', (feed.reddit || []).map((r) => ({ ...r, kind: 'reddit' })), (r) => `(${r.subreddit}, Activity ${r.activity}) ${r.title} —— ${clip(r.summary, 320)}`);
lines.push('\n## 论文（Hugging Face 每日热榜，▲ = 社区点赞）');
add('P', (feed.papers || []).map((p) => ({ ...p, kind: 'paper' })), (p) => `(▲${p.upvotes}) ${p.title} —— ${clip(p.summary, 380)}`);
lines.push('\n## GitHub 今日趋势（AI 相关）');
add('G', (feed.github || []).map((g) => ({ ...g, kind: 'repo', title: g.name })), (g) => `(今日 +${g.starsToday}★，总 ${g.stars}★，${g.language || '—'}) ${g.name} —— ${clip(g.description, 200)}`);
lines.push('\n## Hugging Face 热门模型（新开放的权重）');
add('M', (feed.models || []).map((m) => ({ ...m, kind: 'model', title: m.name })), (m) => `${m.name} (${m.task || '—'}, ${m.likes} 赞, ${m.downloads} 下载)`);
lines.push('\n## Product Hunt 新产品（AI 类）');
add('U', (feed.products || []).map((u) => ({ ...u, kind: 'product' })), (u) => `${u.title} —— ${clip(u.summary, 160)}`);
lines.push('\n## X 上的 builder');
add('X', tweets, (t) => `${t.who}（${clip(t.role, 60)}）：${clip(t.text, 420)} (${t.likes} 赞)`);
lines.push('\n## 中文媒体');
add('C', (feed.chinese || []).map((c) => ({ ...c, kind: 'cn' })), (c) => `${c.source}：${c.title} —— ${clip(c.summary, 200)}`);
if ((feed.podcasts || []).length) {
  lines.push('\n## 播客');
  add('D', feed.podcasts.slice(0, 1).map((p) => ({ ...p, kind: 'podcast' })), (p) => `${p.name}：${p.title}\n逐字稿节选：${clip(p.transcript, 9000)}`);
}

if (args.includes('--dump-prompt')) { console.log(lines.join('\n')); process.exit(0); }

// ── 2. The editor's brief ───────────────────────────────────────────────────
const interests = feed.config?.interests || [];
const SYSTEM = `你是「AI Signal · 信号」的主编。读者是中国的 AI 从业者：工程师、产品经理、创业者、投资人。他们每天只给这封邮件 3 分钟。你的工作是：从下面的原始材料里，挑出真正会改变他们判断的东西，用最高的信息密度写出来。

## 选稿标准（每条都过三问）
1. 读者会因为这条信息做出不同的决定吗？
2. 这是新的事实或洞察，还是噪音、情绪、营销？
3. 有没有具体的东西：数字、版本号、价格、基准分数、名字？没有就降级或不选。
- 同一件事在多个来源出现（例如博客 + HN + 推文），合并成一条，用 also 列出其它来源的 ID。
- 优先：模型与产品发布、价格与性能变化、重要开源、工程实践、政策与安全、融资与商业格局、有实证的研究。
- 跳过：个人生活、纯玩笑、没有信息的转发、泛泛而谈的观点。
${interests.length ? `- 读者特别关注：${interests.join('、')}。同等重要时优先这些。` : ''}

## 写法
- 全部用简体中文。产品名、模型名、公司名、人名保留英文原文。
- 标题是一句完整的事实，不是标签：「Mistral 发布时序基础模型 Timestral，开放权重」，而不是「Mistral 新模型」。
- 正文 1–2 句，必须带上材料里出现过的具体数字或细节。不要写「值得关注」「意义重大」「引发热议」这类空话。
- 「为什么重要」只写对读者的影响：谁会受影响、改变了什么。
- 身份比名字重要：写「Claude Code 负责人 Thariq」，不要只写「Thariq」。
- 只能使用材料中出现的事实，不要补充材料以外的信息，不要猜测。
- 不要替读者下评语：不写「正面挑战」「标志性」「意义深远」这类判断，除非材料里有人这么说（那就写明是谁说的）。
- 人物身份只能来自材料里括号中的简介；简介看不出职位时，只写名字，不要自己推断头衔。

## 只输出一个 JSON 对象，结构如下（ref 和 also 只能填材料里的 ID）
{
  "headline": "今天最重要的一件事，一句话，不超过 30 个字",
  "intro": "主编开场白：一句话（不超过 50 字）说清今天整体的走向，例如几件事共同指向什么。只用材料里的事实，不下空泛评语",
  "tldr": ["30 秒版要点，3 条，每条不超过 40 字，带数字"],
  "lead": { "ref": "H2", "also": ["B1"], "title": "头条标题", "what": "发生了什么，2–3 句", "why": "为什么重要，1–2 句" },
  "stories": [ { "ref": "B3", "also": [], "tag": "模型 | 产品 | 工程 | 开源 | 研究 | 安全与政策 | 商业", "title": "…", "body": "1–2 句" } ],
  "voices": [ { "ref": "X4", "who": "身份 + 名字", "point": "他的观点，浓缩成一句中文" } ],
  "community": [ { "ref": "R2", "title": "中文标题", "point": "社区在争论或惊叹什么，一句话" } ],
  "models": [ { "ref": "M1", "insight": "一句话：是什么模型、能做什么、谁发布的" } ],
  "products": [ { "ref": "U3", "insight": "一句话：解决什么问题" } ],
  "papers": [ { "ref": "P1", "title": "中文标题", "insight": "一句话：做了什么、结果如何" } ],
  "repos": [ { "ref": "G2", "insight": "一句话：解决什么问题、适合谁" } ],
  "quick": [ { "ref": "H9", "text": "一行快讯，不超过 36 字" } ],
  "podcast": { "ref": "D1", "takeaway": "本期最值得记住的一个结论", "points": ["3 条洞察"] }
}

## 数量
- stories 6–9 条（不含头条），voices 2–4 条，community 2–3 条，models 2–3 条，products 2–3 条，papers 3–4 条，repos 3–4 条，quick 4–8 条。
- Techmeme、Reddit 的条目可以作为要闻的主来源或 also；Reddit 适合放进 community（社区在聊）。
- 没有播客材料时 podcast 写 null。
- 同一个 ID 只能出现一次（also 也算）。宁缺毋滥。`;

// ── 3. Call the model ───────────────────────────────────────────────────────
async function callLLM(messages) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: 6000, response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(240000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.choices?.[0]) throw new Error(body.error?.message || `HTTP ${res.status}`);
  return body.choices[0].message.content;
}

function parseJSON(raw) {
  let s = String(raw).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1];
  s = s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return JSON.parse(s);
}

async function writeIssue() {
  if (!API_KEY) throw new Error('no DEEPSEEK_API_KEY');
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: `今天是 ${ymd}。原始材料：\n\n${lines.join('\n')}` }];
  const t0 = Date.now();
  const first = await callLLM(messages);
  console.error(`[ai-signal] ${MODEL} answered in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  try {
    return parseJSON(first);
  } catch (e) {
    console.error(`[ai-signal] invalid JSON (${e.message}); asking once more`);
    messages.push({ role: 'assistant', content: first }, { role: 'user', content: `上面的 JSON 无法解析：${e.message}。请输出同样内容的合法 JSON，只输出 JSON。` });
    return parseJSON(await callLLM(messages));
  }
}

// ── 4. Resolve IDs to real links and numbers; drop anything that does not resolve ──
const used = new Set();
function resolve(ref) {
  const item = refs[String(ref || '').trim()];
  if (!item || used.has(ref)) return null;
  used.add(ref);
  return item;
}
const sourceLabel = (it) => ({
  hn: `Hacker News · ${it.points} 分`,
  paper: `Hugging Face 热榜 · ▲${it.upvotes}`,
  repo: `GitHub · 今日 +${it.starsToday}★`,
  techmeme: it.by ? `${it.by.split('/').pop()} · Techmeme` : 'Techmeme',
  reddit: `${it.subreddit} · 热度 ${it.activity}`,
  model: `Hugging Face · ${it.likes} 赞`,
  product: 'Product Hunt',
  x: `${it.who} · X`,
  blog: it.source,
  cn: it.source,
  podcast: it.name,
}[it.kind] || host(it.url));
const link = (it) => ({ label: sourceLabel(it), url: it.url, discussion: it.discussion });

function normalize(c) {
  const story = (s) => {
    const it = resolve(s?.ref);
    if (!it) return null;
    const also = (s.also || []).map(resolve).filter(Boolean).map(link);
    return { title: s.title, body: s.body, what: s.what, why: s.why, tag: s.tag, source: link(it), also, heat: heat(it, also.length) };
  };
  const out = {
    headline: c.headline,
    intro: c.intro || '',
    tldr: (c.tldr || []).filter(Boolean).slice(0, 3),
    lead: c.lead ? story(c.lead) : null,
    stories: (c.stories || []).map(story).filter(Boolean).slice(0, 10),
    voices: (c.voices || []).map((v) => { const it = resolve(v.ref); return it && { who: v.who || it.who, point: v.point, url: it.url }; }).filter(Boolean).slice(0, 4),
    papers: (c.papers || []).map((p) => { const it = resolve(p.ref); return it && { title: p.title, original: it.title, insight: p.insight, url: it.url, upvotes: it.upvotes }; }).filter(Boolean).sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 5),
    repos: (c.repos || []).map((r) => { const it = resolve(r.ref); return it && { name: it.name, insight: r.insight, url: it.url, starsToday: it.starsToday, stars: it.stars, language: it.language }; }).filter(Boolean).sort((a, b) => (b.starsToday || 0) - (a.starsToday || 0)).slice(0, 5),
    community: (c.community || []).map((r) => { const it = resolve(r.ref); return it && { title: r.title || it.title, point: r.point, url: it.url, label: sourceLabel(it) }; }).filter(Boolean).slice(0, 3),
    models: (c.models || []).map((m) => { const it = resolve(m.ref); return it && { name: it.name, insight: m.insight, url: it.url, likes: it.likes, task: it.task }; }).filter(Boolean).slice(0, 3),
    products: (c.products || []).map((u) => { const it = resolve(u.ref); return it && { name: it.title, insight: u.insight, url: it.url }; }).filter(Boolean).slice(0, 3),
    quick: (c.quick || []).map((q) => { const it = resolve(q.ref); return it && { text: q.text, url: it.url, label: sourceLabel(it) }; }).filter(Boolean).slice(0, 8),
    podcast: null,
  };
  if (c.podcast?.ref) {
    const it = resolve(c.podcast.ref);
    if (it) out.podcast = { name: it.name, title: it.title, url: it.url, takeaway: c.podcast.takeaway, points: (c.podcast.points || []).slice(0, 4) };
  }
  if (!out.lead && out.stories.length) out.lead = out.stories.shift();
  return out;
}

// Built from the ranked material alone, when the model is unavailable. Titles stay in their original language.
function fallback() {
  const take = (prefix, n) => Object.keys(refs).filter((k) => k.startsWith(prefix)).slice(0, n);
  const plain = (id, tag) => { const it = resolve(id); return it && { title: it.title, body: clip(it.summary || it.description || '', 160), tag, source: link(it), also: [], heat: heat(it, 0) }; };
  const stories = [...take('B', 4).map((id) => plain(id, '博客')), ...take('H', 6).map((id) => plain(id, 'HN'))].filter(Boolean);
  return {
    degraded: true,
    headline: stories[0]?.title || 'AI Signal',
    tldr: [],
    lead: stories.shift() || null,
    stories,
    intro: '',
    voices: [],
    community: take('R', 3).map((id) => { const it = resolve(id); return it && { title: it.title, point: clip(it.summary, 120), url: it.url, label: sourceLabel(it) }; }).filter(Boolean),
    models: take('M', 3).map((id) => { const it = resolve(id); return it && { name: it.name, insight: it.task, url: it.url, likes: it.likes, task: it.task }; }).filter(Boolean),
    products: [],
    papers: take('P', 4).map((id) => { const it = resolve(id); return { title: it.title, insight: clip(it.summary, 140), url: it.url, upvotes: it.upvotes }; }),
    repos: take('G', 4).map((id) => { const it = resolve(id); return { name: it.name, insight: it.description, url: it.url, starsToday: it.starsToday, stars: it.stars, language: it.language }; }),
    quick: [],
    podcast: null,
  };
}

// ── 5. Write everything ─────────────────────────────────────────────────────
async function main() {
  let issue;
  if (arg('--content')) {
    issue = normalize(JSON.parse(await readFile(arg('--content'), 'utf-8')));
  } else {
    try {
      issue = normalize(await writeIssue());
      if (!issue.lead) throw new Error('no usable stories in the model output');
    } catch (e) {
      console.error(`[ai-signal] model unavailable (${e.message}); building the issue from ranked sources`);
      used.clear();
      issue = fallback();
    }
  }

  const webDir = arg('--web-dir');
  let number = 1;
  if (webDir && existsSync(join(webDir, 'archive'))) {
    number = (await readdir(join(webDir, 'archive'))).filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f) && f !== `${ymd}.html`).length + 1;
  }
  const count = [issue.lead, ...issue.stories].filter(Boolean).length
    + ['voices', 'community', 'models', 'products', 'papers', 'repos', 'quick'].reduce((s, k) => s + (issue[k] || []).length, 0)
    + (issue.podcast ? 1 : 0);
  const meta = { ymd, dateLabel, number, scanned: feed.stats?.total || Object.keys(refs).length, picked: count, stats: feed.stats || {}, missing: feed.errors || [] };

  const email = renderIssue(issue, meta, { mode: 'email' });
  if (arg('--out')) await writeFile(arg('--out'), email, 'utf-8');
  else process.stdout.write(email);

  if (arg('--json-out')) await writeFile(arg('--json-out'), JSON.stringify({ meta, issue }, null, 2), 'utf-8');

  if (webDir) {
    await mkdir(join(webDir, 'archive'), { recursive: true });
    const web = renderIssue(issue, meta, { mode: 'web' });
    await writeFile(join(webDir, 'index.html'), web, 'utf-8');
    await writeFile(join(webDir, 'archive', `${ymd}.html`), web.replaceAll('href="archive/"', 'href="./"'), 'utf-8');
    const dates = (await readdir(join(webDir, 'archive'))).filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).map((f) => f.slice(0, 10)).sort().reverse();
    await writeFile(join(webDir, 'archive', 'index.html'), renderArchive(dates), 'utf-8');
  }

  const seenPath = arg('--seen');
  if (seenPath && !issue.degraded) {
    const seen = existsSync(seenPath) ? JSON.parse(await readFile(seenPath, 'utf-8')) : {};
    for (const id of used) seen[refs[id].url] = ymd;
    // Keep 60 days of history.
    const cutoff = new Date(now.getTime() - 60 * 864e5).toISOString().slice(0, 10);
    for (const [u, d] of Object.entries(seen)) if (d < cutoff) delete seen[u];
    await mkdir(join(seenPath, '..'), { recursive: true });
    await writeFile(seenPath, JSON.stringify(seen, null, 1), 'utf-8');
  }
  console.error(`[ai-signal] issue #${number} · ${meta.picked} of ${meta.scanned} items${issue.degraded ? ' · degraded (no model)' : ''}`);
}

main().catch((e) => {
  console.error(`[ai-signal] failed: ${e.stack || e.message}`);
  process.exit(1);
});
