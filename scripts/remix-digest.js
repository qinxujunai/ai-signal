#!/usr/bin/env node
// ── AI Signal · 信号 · LLM 内容引擎 (v2.0) ─────────────────────────────────
// 流程: stdin ← prepare-digest.js JSON
//        → DeepSeek API (结构化 JSON)
//        → Apple-grade HTML 模板渲染
//        → stdout → deliver.js → QQ邮箱
//
// v2.0 新增：
// - 支持 arxiv、Hacker News、GitHub Trending、中文AI源
// - 个性化过滤（基于 interests 配置）
// - 改进降级策略（重试 + 历史草稿）
// - 反馈追踪像素
// ────────────────────────────────────────────────────────────────────────────

import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, '..');
const USER_DIR = join(homedir(), '.ai-signal');

// ── 读取输入 ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outFile = outIdx !== -1 ? args[outIdx + 1] : null;
const fileIdx = args.indexOf('--file');
const inFile = fileIdx !== -1 ? args[fileIdx + 1] : null;

let raw;
if (inFile) {
  raw = await readFile(inFile, 'utf-8');
} else {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  raw = Buffer.concat(chunks).toString('utf-8').replace(/^﻿/, '');
}
const data = JSON.parse(raw);

// ── 加载配置 ──────────────────────────────────────────────────────────────
let API_KEY, MODEL;
try { loadEnv({ path: join(homedir(), '.ai-signal', '.env') }); } catch {}
API_KEY = process.env.DEEPSEEK_API_KEY;
MODEL = process.env.DEEPSEEK_MODEL;

if (!API_KEY || !MODEL) {
  try {
    const s = JSON.parse(await readFile(join(homedir(), '.claude', 'settings.json'), 'utf-8'));
    if (!API_KEY) {
      const tk = s.env?.ANTHROPIC_AUTH_TOKEN;
      if (tk && tk.startsWith('sk-')) API_KEY = tk;
    }
    if (!MODEL) {
      const m = s.env?.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME ||
                s.env?.ANTHROPIC_DEFAULT_OPUS_MODEL ||
                s.env?.ANTHROPIC_DEFAULT_SONNET_MODEL ||
                s.env?.ANTHROPIC_MODEL || '';
      const cleaned = m.replace(/\[.*?\]/gi, '').trim();
      if (cleaned.startsWith('deepseek')) MODEL = cleaned;
    }
  } catch {}
}
MODEL = MODEL || 'deepseek-v4-flash';
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
if (!API_KEY) { console.error('No API key'); process.exit(1); }

// ── 个性化过滤 ────────────────────────────────────────────────────────────
const interests = data.config?.interests || [];
const filterByInterests = (items, textFields) => {
  if (interests.length === 0) return items;
  return items.filter(item => {
    const text = textFields.map(f => item[f] || '').join(' ').toLowerCase();
    return interests.some(i => text.includes(i.toLowerCase()));
  });
};

// ── 预过滤 ────────────────────────────────────────────────────────────────
// 原有推文过滤
for (const builder of (data.x || [])) {
  if (builder.tweets) {
    builder.tweets = builder.tweets
      .filter(t => (t.likes || 0) >= 3)
      .sort((a, b) => (b.likes + b.retweets * 2) - (a.likes + a.retweets * 2))
      .slice(0, 3);
  }
}
data.x = (data.x || []).filter(b => b.tweets && b.tweets.length > 0);

// Hacker News 过滤（按得分排序）
data.hackernews = (data.hackernews || [])
  .sort((a, b) => (b.score || 0) - (a.score || 0))
  .slice(0, 10);

// ArXiv 过滤（只保留最近的）
data.arxiv = (data.arxiv || []).slice(0, 5);

// GitHub Trending 过滤
data.githubTrending = (data.githubTrending || []).slice(0, 5);

// 中文新闻过滤
data.chineseNews = (data.chineseNews || []).slice(0, 5);

const lang = data.config?.language || 'bilingual';
const toEmail = data.config?.delivery?.email || '';
const deliveryTime = data.config?.deliveryTime || '10:00';
const today = new Date();
const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日 · 周${'日一二三四五六'[today.getDay()]}`;

// ── 构建 feed 数据 ────────────────────────────────────────────────────────
const feedData = [];

// 原有：播客
if (data.podcasts && data.podcasts.length > 0) {
  feedData.push('## PODCAST');
  for (const p of data.podcasts) {
    feedData.push(`NAME: ${p.name}`);
    feedData.push(`TITLE: ${p.title}`);
    feedData.push(`URL: ${p.url}`);
    feedData.push(`TRANSCRIPT:\n${(p.transcript || '').slice(0, 15000)}`);
  }
  feedData.push('');
}

// 原有：推文
if (data.x && data.x.length > 0) {
  feedData.push('## TWEETS');
  for (const b of data.x) {
    const role = (b.bio || '').split('\n')[0].trim();
    feedData.push(`--- ${b.name} | @${b.handle} | ${role} ---`);
    for (const t of (b.tweets || [])) {
      feedData.push(`  TEXT: ${t.text.replace(/\n/g, ' · ')}`);
      feedData.push(`  URL: ${t.url}`);
      feedData.push(`  STATS: ${t.likes} likes, ${t.retweets} RTs, ${t.replies} replies`);
    }
    feedData.push('');
  }
}

// 新增：Hacker News
if (data.hackernews && data.hackernews.length > 0) {
  feedData.push('## HACKER NEWS (AI Related)');
  for (const s of data.hackernews) {
    feedData.push(`TITLE: ${s.title}`);
    feedData.push(`URL: ${s.url}`);
    feedData.push(`SCORE: ${s.score} points, ${s.comments} comments`);
  }
  feedData.push('');
}

// 新增：ArXiv 论文
if (data.arxiv && data.arxiv.length > 0) {
  feedData.push('## ARXIV PAPERS');
  for (const p of data.arxiv) {
    feedData.push(`TITLE: ${p.title}`);
    feedData.push(`AUTHORS: ${p.authors}`);
    feedData.push(`URL: ${p.url}`);
    feedData.push(`ABSTRACT: ${p.summary}`);
  }
  feedData.push('');
}

// 新增：GitHub Trending
if (data.githubTrending && data.githubTrending.length > 0) {
  feedData.push('## GITHUB TRENDING');
  for (const r of data.githubTrending) {
    feedData.push(`NAME: ${r.name}`);
    feedData.push(`DESCRIPTION: ${r.description}`);
    feedData.push(`URL: ${r.url}`);
    feedData.push(`STARS: ${r.stars}, LANGUAGE: ${r.language}`);
  }
  feedData.push('');
}

// 新增：中文 AI 新闻
if (data.chineseNews && data.chineseNews.length > 0) {
  feedData.push('## CHINESE AI NEWS');
  for (const n of data.chineseNews) {
    feedData.push(`TITLE: ${n.title}`);
    feedData.push(`URL: ${n.url}`);
    feedData.push(`DESCRIPTION: ${n.description}`);
  }
  feedData.push('');
}

// ── 系统提示词 ────────────────────────────────────────────────────────────
const systemPrompt = `你是 AI Signal · 信号的主编。你的读者是中国 AI 从业者——工程师、创始人、投资人。他们每天只有 3 分钟扫邮件，每一条内容都必须值得他们的时间。

## 核心策展哲学

每条内容必过三问：
1. 读者会因为这条信息做出不同的决策吗？
2. 这是真正的洞察，还是噪音？
3. 没有 URL = 不存在。No link = not real.

## 推文策展

✅ 保留：原创观点、产品发布、技术讨论、行业分析、逆向观点、经验教训、工具/demo/资源分享
❌ 跳过：个人生活、无评论转发、"活动真棒"、引流 bait、情绪发泄、纯玩笑
- 长线程提炼为一个连贯摘要，不逐条复述
- 引用推文补 1 句上下文
- 身份永远比名字重要："Box CEO Aaron Levie" 不是 "Levie" 或 "@levie"
- 如果某 builder 今天没有实质性内容，宁可不写

## 播客策展

- 先给出 takeaway——这一期最值得记住的一个观点
- 优先反直觉、逆主流、有实操价值的见解。跳过泛泛 wisdom
- 每个洞察独立成段，不要写"在本期节目中"、"主持人问到"
- 至少引用一句最有记忆点的原话
- 把专业术语翻译成外行也能听懂的话

## Hacker News 策展

- 优先选择高分（100+）的 AI 相关帖子
- 关注技术深度和社区讨论质量
- 跳过简单的新闻转载，优先原创内容

## ArXiv 论文策展

- 优先选择有实际应用价值的论文
- 简化技术术语，用通俗语言解释核心贡献
- 标注论文的实际影响（如：新 SOTA、新方法、开源实现）

## GitHub Trending 策展

- 优先选择有实际使用价值的工具/框架
- 关注星标数和增长趋势
- 说明工具解决的具体问题

## 中文 AI 新闻策展

- 优先选择有深度分析的报道
- 跳过简单的新闻转载
- 标注信息来源的可信度

## 主题归类

动态分组，不机械按人排列。标签建议（不限于此）：产品动态、战略洞察、开源与工具、融资与市场、学术前沿、开发者生态

## JSON 格式

只输出纯 JSON，不要 markdown 包裹，不要解释：

{
  "headline": {
    "text_cn": "今日焦点标题（中文·必填）",
    "text_en": "English version of the headline (in bilingual mode)"
  },
  "mustRead": [
    {
      "title_cn": "中文小标题（具体有信息量）",
      "title_en": "English title",
      "body_cn": "中文摘要 2-3 句，足够详细让读者不需要点原文也能理解",
      "body_en": "English summary 2-3 sentences",
      "source": "完整身份 · 如 Box CEO Aaron Levie",
      "url": "https://..."
    }
  ],
  "sections": [
    {
      "tag": "产品动态",
      "emoji": "📱",
      "items": [
        {
          "title_cn": "...",
          "title_en": "...",
          "body_cn": "中文摘要 2-3 句",
          "body_en": "English summary 2-3 sentences",
          "source": "完整身份",
          "url": "https://..."
        }
      ]
    }
  ],
  "podcast": {
    "name": "播客名称",
    "title": "单集标题",
    "url": "https://...",
    "why_cn": "一句话说明谁该听、为什么值得花时间",
    "why_en": "Who should listen and why",
    "takeaway_cn": "本期最值得记住的一个核心结论",
    "takeaway_en": "The single most important takeaway",
    "insights": [
      {
        "point_cn": "核心洞察",
        "point_en": "Core insight",
        "quote": "原话英文原文（可选）",
        "quote_cn": "原话中文翻译，如果有 quote 就必须有 quote_cn"
      }
    ]
  }
}

## CRITICAL RULES

- **headline 必须源于 mustRead**：headline.text_cn 的内容必须是 mustRead 中某一条标题的浓缩版，不能凭空编造一个抽象的、放到任何一期都能用的话。具体 > 抽象。
- **中文优先**：在双语模式下，中国人的眼睛先看到中文。标题和正文的 cn 字段是你输出的重点，en 字段是英文读者的备选。
- 每条 item 必须带 url
- 每个 section 不超过 5 条，总共不超过 4 个 section
- mustRead 选 1-2 条，宁缺毋滥
- 播客必须 3-5 个核心洞察
- 语言模式：${lang === 'bilingual' ? '所有字段同时输出 cn 和 en' : lang === 'zh' ? '只输出 cn 字段，en 留空字符串 ""' : '只输出 en 字段，cn 留空字符串 ""'}
${interests.length > 0 ? `\n## 个性化偏好\n读者关注领域：${interests.join('、')}。优先选择与这些领域相关的内容。` : ''}
`;

// ── LLM 调用 ──────────────────────────────────────────────────────────────
async function callLLM(system, user) {
  const payload = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: 8000,
    temperature: 0.5
  };

  const url = new URL(API_URL);
  const https = await import('https');
  const http = await import('http');
  const mod = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = mod.request({
      hostname: url.hostname, port: url.port || 443, path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      timeout: 180000
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (j.choices?.[0]) resolve(j.choices[0].message.content);
          else reject(new Error(j.error?.message || body.slice(0, 500)));
        } catch (e) { reject(new Error('Parse: ' + body.slice(0, 500))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('LLM timeout')); });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

// ── HTML 模板渲染 ─────────────────────────────────────────────────────────
function renderHTML(content, lang) {
  const isBilingual = lang === 'bilingual';
  const isZh = lang === 'zh';
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');

  // 反馈追踪像素（用于统计邮件打开率）
  const trackingPixel = `<img src="https://ai-signal-tracker.vercel.app/api/track?date=${today.toISOString().split('T')[0]}" width="1" height="1" style="display:none;" alt="" />`;

  // 中文优先的正文渲染
  const bodyText = (cn, en) => {
    if (isZh) return esc(cn);
    if (lang === 'en') return esc(en);
    return esc(cn);
  };

  // 双语正文
  const bilingualBody = (cn, en) => {
    if (isZh || lang === 'en') return '';
    if (!en || en === cn) return '';
    return `<div style="font-size:13px;color:#6b7280;line-height:1.6;margin-top:8px;">${esc(en)}</div>`;
  };

  // 双语标题
  const titleText = (cn, en) => {
    if (isZh) return esc(cn);
    if (lang === 'en') return esc(en);
    let h = esc(cn);
    if (en && en !== cn) h += ' <span style="font-weight:400;color:#6b7280;font-size:0.85em;">· ' + esc(en) + '</span>';
    return h;
  };

  // 统一按钮文案
  const btnLabel = isZh ? '查看原文 →' : (lang === 'en' ? 'Read more →' : '查看原文 →');

  // ── Build sections HTML ──────────────────────────────────────────────────
  let sectionsHTML = '';

  // Must Read
  if (content.mustRead && content.mustRead.length > 0) {
    sectionsHTML += `
    <!-- MUST READ -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding:0 0 12px 0;">
        <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;letter-spacing:0.5px;">🔥 今日必读</span>
      </td></tr>`;
    for (const item of content.mustRead) {
      sectionsHTML += `
      <tr><td style="padding-bottom:16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
          <tr><td style="padding:24px;">
            <div style="font-size:12px;color:#9ca3af;margin-bottom:8px;letter-spacing:0.3px;">${esc(item.source || '')}</div>
            <div style="font-size:17px;font-weight:700;color:#0f172a;line-height:1.45;margin-bottom:8px;">${titleText(item.title_cn, item.title_en)}</div>
            <div style="font-size:15px;color:#374151;line-height:1.7;">${bodyText(item.body_cn, item.body_en)}</div>
            ${bilingualBody(item.body_cn, item.body_en)}
            <a href="${esc(item.url)}" target="_blank" style="display:inline-block;margin-top:12px;color:#2563eb;font-size:13px;font-weight:600;text-decoration:none;border:1px solid #2563eb;border-radius:6px;padding:6px 16px;">${btnLabel}</a>
          </td></tr>
        </table>
      </td></tr>`;
    }
    sectionsHTML += '</table>';
  }

  // Topic sections
  for (const sec of (content.sections || [])) {
    const tagLabel = (sec.emoji || '') + ' ' + esc(sec.tag || '');
    sectionsHTML += `
    <!-- SECTION -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding:0 0 12px 0;">
        <span style="display:inline-block;background:#e0e7ff;color:#3730a3;font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;letter-spacing:0.5px;">${tagLabel}</span>
      </td></tr>`;
    for (const item of (sec.items || [])) {
      sectionsHTML += `
      <tr><td style="padding-bottom:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #edf2f7;">
          <tr><td style="padding:16px 20px;">
            <div style="font-size:12px;color:#9ca3af;margin-bottom:6px;">${esc(item.source || '')}</div>
            <div style="font-size:15px;font-weight:700;color:#1f2937;line-height:1.5;margin-bottom:6px;">${titleText(item.title_cn, item.title_en)}</div>
            <div style="font-size:15px;color:#4b5563;line-height:1.7;">${bodyText(item.body_cn, item.body_en)}</div>
            ${bilingualBody(item.body_cn, item.body_en)}
            <a href="${esc(item.url)}" target="_blank" style="display:inline-block;margin-top:8px;color:#2563eb;font-size:12px;font-weight:500;text-decoration:underline;">${btnLabel}</a>
          </td></tr>
        </table>
      </td></tr>`;
    }
    sectionsHTML += '</table>';
  }

  // Podcast section
  let podcastHTML = '';
  if (content.podcast && content.podcast.insights && content.podcast.insights.length > 0) {
    const p = content.podcast;
    podcastHTML = `
    <!-- PODCAST -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding:0 0 12px 0;">
        <span style="display:inline-block;background:#f3e8ff;color:#6b21a8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;letter-spacing:0.5px;">🎙️ 深度播客</span>
      </td></tr>
      <tr><td style="padding-bottom:16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#faf5ff 0%,#f3e8ff 100%);border-radius:10px;border:1px solid #e9d5ff;">
          <tr><td style="padding:24px;">
            <!-- Episode info -->
            <div style="font-size:12px;color:#7c3aed;margin-bottom:4px;font-weight:600;letter-spacing:0.3px;">${esc(p.name || '')}</div>
            <div style="font-size:18px;font-weight:700;color:#4c1d95;line-height:1.4;margin-bottom:12px;">${esc(p.title || '')}</div>
            ${p.takeaway_cn ? `<div style="background:#ffffff;border-radius:8px;border:1px solid #e9d5ff;padding:14px 16px;margin-bottom:16px;">
              <div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:6px;letter-spacing:0.5px;">💡 核心结论</div>
              <div style="font-size:14px;color:#1f2937;line-height:1.6;font-weight:600;">${bodyText(p.takeaway_cn, p.takeaway_en)}</div>
            </div>` : ''}
            ${p.why_cn ? `<div style="font-size:12px;color:#7c3aed;margin-bottom:14px;line-height:1.5;">${esc('🎯 ' + (p.why_cn || p.why_en))}</div>` : ''}`;
    for (const ins of (p.insights || [])) {
      podcastHTML += `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;background:#ffffff;border-radius:8px;border:1px solid #ede9fe;">
              <tr><td style="padding:16px;">
                <div style="font-size:14px;font-weight:600;color:#0f172a;line-height:1.6;margin-bottom:6px;">${bodyText(ins.point_cn, ins.point_en)}</div>`;
      if (ins.quote || ins.quote_cn) {
        const quoteText = ins.quote_cn || ins.quote;
        podcastHTML += `<div style="font-size:14px;color:#374151;line-height:1.7;font-style:italic;border-left:3px solid #c4b5fd;padding-left:14px;margin-top:10px;">"${esc(quoteText.slice(0, 300))}"</div>`;
        if (ins.quote_cn && ins.quote) {
          podcastHTML += `<div style="font-size:12px;color:#9ca3af;line-height:1.5;padding-left:14px;margin-top:4px;font-style:italic;">${esc(ins.quote.slice(0, 200))}</div>`;
        }
      }
      podcastHTML += `
              </td></tr>
            </table>`;
    }
    podcastHTML += `
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">
              <tr><td style="background:#7c3aed;border-radius:6px;">
                <a href="${esc(p.url)}" target="_blank" style="display:inline-block;padding:8px 20px;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;">🎧 ${isZh ? '收听完整播客' : 'Listen'}</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
  }

  // ── Full HTML document ───────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="zh-CN" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>AI Signal · 信号 | ${dateStr}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'SF Pro Text',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;word-spacing:normal;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;">
<tr><td align="center" style="padding:24px 8px;">

<!-- PREVIEW TEXT -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(content.headline?.text_cn || '')} — ${esc(content.mustRead?.[0]?.title_cn || '')}</div>

<!-- CONTAINER -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <!--[if mso]><tr><td style="background:#0f172a;padding:28px 32px 24px 32px;"><![endif]-->
  <!--[if !mso]><!--><tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px 24px 32px;"><!--<![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-size:11px;color:#64748b;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;font-weight:600;">AI FRONTIER DIGEST</div>
          <div style="font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;margin-bottom:6px;">AI Signal · 信号</div>
          <div style="font-size:13px;color:#94a3b8;">${dateStr}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- HEADLINE -->
  ${content.headline ? `
  <tr><td style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 100%);padding:16px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;color:#93c5fd;font-weight:700;letter-spacing:1px;padding-bottom:4px;">今日焦点</td>
      </tr>
      <tr>
        <td style="font-size:16px;color:#ffffff;font-weight:700;line-height:1.5;">
          ${esc(content.headline.text_cn || content.headline.text_en)}
        </td>
      </tr>
      ${(content.headline.text_en && content.headline.text_cn && isBilingual) ? `
      <tr>
        <td style="font-size:14px;color:#93c5fd;line-height:1.5;padding-top:4px;">
          ${esc(content.headline.text_en)}
        </td>
      </tr>` : ''}
    </table>
  </td></tr>` : ''}

  <!-- CONTENT -->
  <tr><td style="padding:24px;background:#fafbfc;">

    ${sectionsHTML}
    ${podcastHTML}

  </td></tr>

  <!-- FEEDBACK -->
  <tr><td style="padding:0 24px 16px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <tr><td style="padding:12px 16px;text-align:center;">
        <span style="font-size:12px;color:#64748b;">这封邮件对你有帮助吗？</span>
        <a href="https://ai-signal-tracker.vercel.app/api/feedback?date=${today.toISOString().split('T')[0]}&vote=yes" style="display:inline-block;margin:0 8px;padding:4px 12px;background:#10b981;color:#ffffff;border-radius:4px;text-decoration:none;font-size:12px;font-weight:600;">👍 有用</a>
        <a href="https://ai-signal-tracker.vercel.app/api/feedback?date=${today.toISOString().split('T')[0]}&vote=no" style="display:inline-block;margin:0 8px;padding:4px 12px;background:#ef4444;color:#ffffff;border-radius:4px;text-decoration:none;font-size:12px;font-weight:600;">👎 没用</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f8f9fa;padding:20px 28px;border-top:1px solid #f0f0f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:12px;color:#9ca3af;line-height:1.7;">
        <strong style="color:#6b7280;">AI Signal · 信号</strong> · 从 AI 噪音中提取信号<br>
        ${esc(toEmail)} · 每天 ${deliveryTime} 北京时间
      </td></tr>
    </table>
  </td></tr>

</table>
<!-- /CONTAINER -->

</td></tr>
</table>
${trackingPixel}
</body>
</html>`;
}

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  const userPrompt = `根据以下原始数据生成内容 JSON：\n\n${feedData.join('\n')}`;

  const promptChars = systemPrompt.length + userPrompt.length;
  console.error(`[ai-signal] 数据就绪 · ~${Math.round(promptChars/3)} tokens · 调用 ${MODEL}...`);

  let content;
  try {
    const raw = await callLLM(systemPrompt, userPrompt);
    console.error(`[ai-signal] LLM 响应完成 (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    let jsonStr = raw.trim();
    const match = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) jsonStr = match[1];
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);

    // Repair common LLM JSON errors
    jsonStr = jsonStr
      .replace(/,\s*}/g, '}')       // trailing comma in object
      .replace(/,\s*\]/g, ']')       // trailing comma in array
      .replace(/\\'/g, "'")          // escaped single quotes → plain
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // control chars

    content = JSON.parse(jsonStr);
  } catch (e) {
    // Retry once with a fix-prompt if JSON is broken
    try {
      const fixPrompt = `The previous JSON output was invalid: ${e.message.slice(0, 200)}. Please regenerate the EXACT same content but ensure the JSON is valid (no trailing commas, properly closed brackets). Output ONLY valid JSON.`;
      const retryRaw = await callLLM(systemPrompt + '\n\n## PREVIOUS ATTEMPT FAILED\n' + fixPrompt, userPrompt);
      let retryStr = retryRaw.trim();
      const m = retryStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (m) retryStr = m[1];
      const s = retryStr.indexOf('{'), e2 = retryStr.lastIndexOf('}');
      if (s >= 0 && e2 > s) retryStr = retryStr.slice(s, e2 + 1);
      retryStr = retryStr.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']').replace(/\\'/g, "'").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      content = JSON.parse(retryStr);
    } catch (e2) {
      console.error('LLM JSON parse error (retry also failed):', e2.message);
      // 尝试使用历史草稿
      const fallbackHtml = await tryFallbackDraft(lang) || renderFallback(data, lang);
      process.stdout.write(fallbackHtml);
      if (outFile) await writeFile(outFile, fallbackHtml, 'utf-8');
      return;
    }
  }

  const html = renderHTML(content, lang);
  process.stdout.write(html);
  if (outFile) {
    await writeFile(outFile, html, 'utf-8');
    console.error(`[ai-signal] 输出已写入: ${outFile}`);
  }
  console.error(`[ai-signal] 渲染完成 · 总耗时 ${((Date.now()-t0)/1000).toFixed(1)}s`);
}

// ── 尝试使用历史草稿 ─────────────────────────────────────────────────────
async function tryFallbackDraft(lang) {
  try {
    const draftsDir = join(USER_DIR, 'drafts');
    if (!existsSync(draftsDir)) return null;

    const files = await readdir(draftsDir);
    const htmlFiles = files.filter(f => f.endsWith('.html')).sort().reverse();

    // 找最近 3 天内的草稿
    for (const file of htmlFiles.slice(0, 3)) {
      const filePath = join(draftsDir, file);
      const content = await readFile(filePath, 'utf-8');

      // 检查是否是 LLM 生成的（不是模板降级）
      if (content.includes('🔥 今日必读') && !content.includes('模板摘要')) {
        console.error(`[ai-signal] 使用历史草稿: ${file}`);
        return content;
      }
    }
  } catch {}
  return null;
}

// ── Fallback: 当 LLM JSON 彻底失败时，用模板引擎兜底 ──────────────────────
function renderFallback(data, lang) {
  const isZh = lang === 'zh';
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');

  let items = '';
  const builders = data.x || [];
  for (const b of builders) {
    const role = (b.bio || '').split('\n')[0].trim();
    for (const t of (b.tweets || []).slice(0, 2)) {
      items += `
        <tr><td style="padding-bottom:12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #edf2f7;">
            <tr><td style="padding:16px 20px;">
              <div style="font-size:12px;color:#9ca3af;margin-bottom:6px;">${esc(b.name)} · ${esc(role)}</div>
              <div style="font-size:14px;color:#1f2937;line-height:1.7;">${esc(t.text)}</div>
              <a href="${esc(t.url)}" target="_blank" style="display:inline-block;margin-top:8px;color:#2563eb;font-size:12px;font-weight:500;text-decoration:underline;">查看原文 →</a>
            </td></tr>
          </table>
        </td></tr>`;
    }
  }

  const dateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 · 周${'日一二三四五六'[d.getDay()]}`;
  })();

  return `<!DOCTYPE html>
<html lang="zh-CN" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'SF Pro Text',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;">
<tr><td align="center" style="padding:24px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!--[if mso]><tr><td style="background:#0f172a;padding:28px 32px;"><![endif]-->
  <!--[if !mso]><!--><tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;"><!--<![endif]-->
    <div style="font-size:11px;color:#64748b;letter-spacing:2.5px;font-weight:600;margin-bottom:10px;">AI FRONTIER DIGEST</div>
    <div style="font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;margin-bottom:6px;">AI Signal · 信号</div>
    <div style="font-size:13px;color:#94a3b8;">${dateStr} · 每天 ${data.config?.deliveryTime || '10:00'} 北京时间</div>
  </td></tr>

  <tr><td style="background:#fef3c7;padding:14px 28px;">
    <div style="font-size:12px;color:#92400e;line-height:1.5;">⚠️ 本期为模板摘要（LLM 服务暂时不可达，已自动降级）。下一期自动恢复。</div>
  </td></tr>

  <tr><td style="padding:24px 28px;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
  </td></tr>

  <tr><td style="background:#f8f9fa;padding:20px 28px;border-top:1px solid #f0f0f0;">
    <div style="font-size:12px;color:#9ca3af;line-height:1.7;">
      <strong style="color:#6b7280;">AI Signal · 信号</strong> · 从 AI 噪音中提取信号<br>
      ${esc(data.config?.delivery?.email || '')} · 每天 ${data.config?.deliveryTime || '10:00'} 北京时间
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

main().catch(async e => {
  console.error('LLM failed, using fallback:', e.message);
  try {
    const fb = await tryFallbackDraft(lang) || renderFallback(data, lang);
    process.stdout.write(fb);
    if (outFile) await writeFile(outFile, fb, 'utf-8');
  } catch {}
});
