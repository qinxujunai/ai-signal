// AI Signal — the website around the issues: the product page at the site root and the Atom feed.
//
// The issue itself (render.js) is built for an inbox: tables and inline styles. These pages are
// web-only, so they use one small stylesheet, follow the system light/dark setting and make no
// external requests. The look matches the issue: black type on white, greys for hierarchy, one
// blue for links, an apple.com-style translucent bar.

import * as cheerio from 'cheerio';
import { BACK_SCRIPT } from './back.js';

export const SITE = 'https://qinxujunai.github.io/ai-signal/';
const REPO = 'https://github.com/qinxujunai/ai-signal';
const AUTHOR = 'https://qinxujunai.github.io/';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%231d1d1f'/%3E%3Ccircle cx='4.5' cy='8' r='1.6' fill='%23fff'/%3E%3Ccircle cx='8' cy='8' r='1.6' fill='%23fff'/%3E%3Ccircle cx='11.5' cy='8' r='1.6' fill='%23fff' fill-opacity='.4'/%3E%3C/svg%3E">`;

const STYLE = `
:root{--bg:#fff;--ink:#1d1d1f;--text:#424245;--muted:#6e6e73;--line:#d2d2d7;--tile:#f5f5f7;--link:#0066cc;--bar:rgba(255,255,255,.72);--bar-line:rgba(0,0,0,.08);--button:#0071e3;--button-ink:#fff;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#000;--ink:#f5f5f7;--text:#d2d2d7;--muted:#a1a1a6;--line:#38383a;--tile:#1c1c1e;--link:#2997ff;--bar:rgba(22,22,23,.72);--bar-line:rgba(255,255,255,.12);--button:#0071e3}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline}
:focus-visible{outline:2px solid var(--link);outline-offset:3px;border-radius:4px}
.bar{position:sticky;top:0;z-index:10;background:var(--bar);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--bar-line)}
.bar-in{max-width:980px;margin:0 auto;padding:0 22px;height:48px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{font-weight:600;font-size:15px;color:var(--ink);letter-spacing:-.01em}
.start{display:flex;align-items:center;gap:14px}
.back{font-size:13px;color:var(--ink);opacity:.8}
.back[hidden]{display:none}
.bar nav{display:flex;gap:20px;font-size:13px}
.bar nav a{color:var(--ink);opacity:.8}
.wrap{max-width:980px;margin:0 auto;padding:0 22px}
.hero{text-align:center;padding:88px 0 56px}
.eyebrow{font-size:17px;font-weight:600;color:var(--muted);margin:0 0 10px}
h1{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC","Helvetica Neue",sans-serif;font-size:clamp(48px,9vw,80px);line-height:1.05;letter-spacing:-.015em;font-weight:700;margin:0}
.lede{font-size:clamp(21px,3vw,28px);line-height:1.35;font-weight:600;letter-spacing:-.01em;margin:18px auto 0;max-width:680px;text-wrap:balance;word-break:keep-all;overflow-wrap:anywhere}
.cta{margin-top:30px;display:flex;gap:26px;justify-content:center;align-items:center;flex-wrap:wrap;font-size:17px}
.button{display:inline-block;background:var(--button);color:var(--button-ink);padding:11px 22px;border-radius:980px;font-weight:500}
.button:hover{text-decoration:none;filter:brightness(1.08)}
.today{background:var(--tile);border-radius:28px;padding:40px clamp(22px,5vw,56px);margin:8px 0 0}
.today .when{font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums}
.today h2{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC",sans-serif;font-size:clamp(26px,4vw,36px);line-height:1.2;letter-spacing:-.01em;margin:10px 0 0}
.today .intro{font-size:19px;color:var(--text);margin:14px 0 0;max-width:760px}
.today ol{list-style:none;margin:26px 0 0;padding:0;counter-reset:n;display:grid;gap:12px}
.today li{counter-increment:n;display:grid;grid-template-columns:28px 1fr;font-size:17px;line-height:1.55}
.today li::before{content:counter(n);font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}
.today .more{margin-top:26px;font-size:17px}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding-block:72px}
.facts h3{font-size:24px;line-height:1.25;letter-spacing:-.01em;margin:0}
.facts p{font-size:17px;color:var(--text);margin:10px 0 0}
.how{border-top:1px solid var(--line);padding-block:56px}
.how h2,.open h2{font-size:clamp(28px,4vw,40px);letter-spacing:-.015em;line-height:1.15;margin:0;text-align:center}
.steps{list-style:none;margin:36px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.steps li{border-top:2px solid var(--ink);padding-top:14px}
.steps strong{display:block;font-size:17px}
.steps span{display:block;font-size:15px;color:var(--text);margin-top:6px}
.open{border-top:1px solid var(--line);padding-block:56px 72px;text-align:center}
.open p{font-size:19px;color:var(--text);margin:14px auto 0;max-width:640px}
.open .cta{margin-top:22px}
.sub{padding-block:72px 8px;text-align:center}
.sub h2{font-size:clamp(28px,4vw,40px);letter-spacing:-.015em;line-height:1.15;margin:0}
.sub p{font-size:19px;color:var(--text);margin:14px auto 0;max-width:600px}
html{scroll-padding-top:60px}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sub .note{font-size:13px;color:var(--muted);margin-top:14px}
.sub .note a{text-decoration:underline;text-underline-offset:2px}
footer{border-top:1px solid var(--line);padding:22px 0 40px;font-size:12px;color:var(--muted)}
footer a{text-decoration:underline;text-underline-offset:2px}
footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media (max-width:734px){.hero{padding:56px 0 40px}.facts{grid-template-columns:1fr;padding-block:48px;gap:28px}.steps{grid-template-columns:1fr 1fr}.bar nav{gap:14px}.bar nav .hide-s{display:none}}
/* An editorial front page: one current issue, with sources and context nearby. */
.front{display:grid;grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:clamp(36px,6vw,84px);align-items:center;padding-top:76px;padding-bottom:74px}
.hero{text-align:left;padding:0}.hero .eyebrow{font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:var(--link);margin-bottom:18px}
.hero h1{font-size:clamp(48px,6vw,76px);letter-spacing:-.045em}.hero .lede{font-size:clamp(24px,3vw,34px);font-weight:600;line-height:1.3;margin:20px 0 0;max-width:440px;word-break:normal}
.hero .dek{font-size:16px;line-height:1.75;color:var(--text);max-width:390px;margin:20px 0 0}.hero .cta{justify-content:flex-start;gap:20px;margin-top:28px;font-size:15px}
.today{margin:0;padding:32px clamp(24px,4vw,42px);border:1px solid var(--bar-line);border-radius:22px}.today .issue-label{display:flex;align-items:center;justify-content:space-between;gap:15px;border-bottom:1px solid var(--line);padding-bottom:18px;color:var(--muted);font-size:13px}
.today .issue-label strong{color:var(--ink);font-size:14px}.today h2{font-size:clamp(23px,2.8vw,34px);line-height:1.27;margin-top:22px}.today .intro{font-size:16px;line-height:1.7;margin-top:12px}.today ol{gap:11px;margin-top:20px}.today li{font-size:15px;grid-template-columns:24px 1fr}.today .more{font-size:15px;margin:23px 0 0}.today .when{margin-top:14px;font-size:12px}
.section-label{font-size:12px;letter-spacing:.1em;color:var(--muted);font-weight:600;text-transform:uppercase;margin:0 0 14px}.facts{border-top:1px solid var(--line);padding-block:56px}.facts h3{font-size:20px}.facts p{font-size:15px;line-height:1.75}.sub{border-top:1px solid var(--line);padding-block:64px}.sub p{font-size:16px;line-height:1.7}.how{padding-block:56px}.open{padding-block:56px}.steps span{line-height:1.7}
@media(max-width:734px){.front{grid-template-columns:1fr;gap:36px;padding-top:48px;padding-bottom:52px}.hero .lede{font-size:27px}.hero .dek{font-size:15px}.today{padding:26px 22px}.facts{padding-block:45px}.sub{padding-block:48px}}
/* Product story: large type, concrete examples, and a quiet reading path. */
.hero .lede{font-size:clamp(30px,3.5vw,44px);line-height:1.2;letter-spacing:-.025em;max-width:490px}
.story{border-top:1px solid var(--line);padding:88px 0 72px}.story-heading{max-width:800px}.kicker{margin:0 0 18px;color:var(--link);font-size:13px;font-weight:700;letter-spacing:.08em}.story h2,.sources h2,.inspired h2{margin:0;font-size:clamp(32px,4.7vw,52px);line-height:1.18;letter-spacing:-.035em}.story-intro{font-size:clamp(17px,2vw,21px);color:var(--text);line-height:1.75;max-width:700px;margin:24px 0 0}
.principles{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:56px}.principle{border-top:1px solid var(--line);padding-top:20px}.principle .num{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}.principle h3{font-size:21px;line-height:1.3;margin:20px 0 10px}.principle p{font-size:15px;line-height:1.8;color:var(--text);margin:0}
.reading{background:#161617;color:#f5f5f7;border-radius:26px;padding:clamp(30px,5vw,58px);display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;margin-bottom:80px}.reading .kicker{color:#70b9ff}.reading h2{font-size:clamp(32px,4.6vw,50px);line-height:1.18;letter-spacing:-.035em;margin:0}.reading p{font-size:16px;line-height:1.8;color:#c7c7cc;max-width:430px;margin:20px 0 0}.reading a{color:#8dc9ff}.sample{border-left:1px solid #454548;padding-left:32px}.sample-label{font-size:12px;letter-spacing:.08em;color:#a1a1a6}.sample strong{display:block;font-size:clamp(32px,5vw,56px);line-height:1.1;letter-spacing:-.04em;margin:16px 0 10px}.sample span{font-size:15px;line-height:1.7;color:#c7c7cc}
.sources{border-top:1px solid var(--line);padding:80px 0}.sources-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start}.sources p,.inspired p{color:var(--text);font-size:16px;line-height:1.8;max-width:520px}.source-list{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin:0;padding:0;list-style:none}.source-list li{padding:13px 0;border-bottom:1px solid var(--line);font-size:15px;font-weight:600}.source-list small{display:block;color:var(--muted);font-size:12px;font-weight:400;margin-top:4px}
.inspired{border-top:1px solid var(--line);padding:72px 0}.inspired .refs{display:flex;gap:24px;flex-wrap:wrap;font-size:15px;margin-top:22px}.inspired p{max-width:720px}
@media(max-width:734px){.story{padding:62px 0 54px}.story-intro{margin-top:18px}.principles{grid-template-columns:1fr;gap:28px;margin-top:36px}.principle h3{margin-top:12px}.reading{grid-template-columns:1fr;gap:28px;margin-bottom:56px}.sample{border-left:0;border-top:1px solid #454548;padding:24px 0 0}.sources{padding:58px 0}.sources-grid{grid-template-columns:1fr;gap:24px}.inspired{padding:54px 0}}
`;

function bar() {
  return `<header class="bar"><div class="bar-in"><span class="start"><a class="back" data-qxj-back hidden>‹ 返回</a><a class="brand" href="./">AI Signal</a></span><nav aria-label="主导航"><a href="latest/">最新</a><a href="archive/">往期</a><a href="#subscribe">订阅</a><a class="hide-s" href="${REPO}">GitHub</a></nav></div></header>${BACK_SCRIPT}`;
}

// Subscribing is RSS: any reader app follows the feed. No sign-up, no list of addresses to keep.
export function subscribeSection() {
  return `<section class="wrap sub" id="subscribe" aria-labelledby="subscribe-title">
    <h2 id="subscribe-title">订阅 RSS，在阅读器中追踪更新</h2>
    <p>把订阅地址添加到 RSS 阅读器，新一期发布后可在阅读器中查看。</p>
    <div class="cta"><a class="button" href="feed.xml">RSS 订阅</a></div>
    <p class="note">订阅地址：${esc(SITE)}feed.xml</p>
  </section>`;
}

// The product page: what it is, today's issue, why it can be trusted, how it works, where the code is.
export function renderLanding(issue, meta) {
  const tldr = (issue.tldr || []).slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('');
  const description = 'AI Signal 是一份中文 AI 简报。关注模型、产品、研究与开源项目，保留来源链接，计划每天更新。';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Signal · 每天一期，一页读完 AI 消息</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="AI Signal">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}">
<link rel="canonical" href="${SITE}">
<link rel="alternate" type="application/atom+xml" title="AI Signal" href="feed.xml">
${ICON}
<style>${STYLE}</style>
</head>
<body>
${bar()}
<main>
  <div class="front wrap">
  <section class="hero">
    <p class="eyebrow">AI NEWSLETTER · 信号</p>
    <h1>AI Signal</h1>
    <p class="lede">AI 变化很快。<br>重点，一眼看清。</p>
    <p class="dek">一份中文 AI 简报，把模型、产品、研究与开源项目的变化整理在一起。从最新消息出发，也能回到原文。</p>
    <div class="cta"><a class="button" href="latest/">阅读最新一期</a><a href="archive/">浏览往期 ›</a></div>
  </section>

  <section aria-labelledby="today">
    <article class="today">
      <div class="issue-label"><strong>最新一期</strong><span>第 ${esc(meta.number)} 期 · ${esc(meta.dateLabel)}</span></div>
      <h2 id="today"><a href="latest/" style="color:inherit">${esc(issue.headline)}</a></h2>
      ${issue.intro ? `<p class="intro">${esc(issue.intro)}</p>` : ''}
      ${tldr ? `<ol aria-label="30 秒读完">${tldr}</ol>` : ''}
      <div class="when">从 ${esc(meta.scanned)} 条新内容中选出 ${esc(meta.picked)} 条</div>
      <p class="more"><a href="latest/">阅读全文 ›</a></p>
    </article>
  </section>
  </div>

  <section class="wrap" aria-labelledby="story-title">
    <div class="story">
      <div class="story-heading"><p class="kicker">WHY AI SIGNAL</p><h2 id="story-title">把分散的信息，整理成一份清晰的简报。</h2><p class="story-intro">新模型、产品更新、研究论文、开发者讨论，每天都有新消息。AI Signal 汇总多处信息，使用 AI 协助筛选、摘要与归类，让阅读从重点开始。</p></div>
      <div class="principles">
        <div class="principle"><span class="num">01 / 先看重点</span><h3>30 秒，读懂重点。</h3><p>编辑版通常先给出几条要点，再展开头条与其他消息。时间有限时，也能先掌握这一期在说什么。</p></div>
        <div class="principle"><span class="num">02 / 读懂变化</span><h3>事实和背景，放在一起。</h3><p>从发生了什么，到可能影响什么；模型发布、产品、研究和开源项目各有清晰的位置。</p></div>
        <div class="principle"><span class="num">03 / 可以回看</span><h3>从新闻到原文。</h3><p>正文附来源链接，重要信息可以继续核对；往期也有独立页面，方便回看和分享。</p></div>
      </div>
    </div>
  </section>

  <section class="wrap" aria-labelledby="reading-title">
    <div class="reading"><div><p class="kicker">A CLOSER LOOK</p><h2 id="reading-title">先有全貌。<br>再看细节。</h2><p>一期一页，可能包括头条、要闻、论文、开源项目和社区讨论。内容有重点，出处有路径。</p><p><a href="latest/">打开最新一期 ›</a></p></div>
      <div class="sample"><span class="sample-label">本期 · ${esc(meta.dateLabel)}</span><strong>${esc(meta.picked)} / ${esc(meta.scanned)}</strong><span>条内容入选 / 条新内容<br>实际数量随当天信源与内容变化</span></div>
    </div>
  </section>

  <section class="wrap" aria-labelledby="sources-title"><div class="sources"><div class="sources-grid"><div><p class="kicker">THE SOURCES</p><h2 id="sources-title">让不同的声音，<br>出现在同一页。</h2><p>实验室的发布、开发者的讨论、研究和产品的变化，都可以成为线索。当天信源不足时，简报会注明。</p><p>摘要可能遗漏细节，重要信息请结合原文判断。计划每天更新，任务或信源异常时可能延迟。</p></div><ul class="source-list"><li>实验室与公司<small>官方博客与产品发布</small></li><li>开发者社区<small>Hacker News 与 GitHub</small></li><li>研究与模型<small>论文热榜与开放模型</small></li><li>中文媒体<small>中文科技新闻与报道</small></li></ul></div></div></section>

  <section class="wrap how" aria-labelledby="how">
    <h2 id="how">每天早上发生的事</h2>
    <ol class="steps">
      <li><strong>收集</strong><span>计划从多个来源收集近 36 小时的新内容。</span></li>
      <li><strong>整理</strong><span>给素材编号，尽量过滤近期已发过的链接。</span></li>
      <li><strong>编辑</strong><span>按三个问题挑选：会改变判断吗？是新事实吗？有数字或名字吗？</span></li>
      <li><strong>发布</strong><span>生成网页并保留往期，计划每天更新；任务可能延迟。</span></li>
    </ol>
  </section>

  <section class="wrap" aria-labelledby="inspired-title"><div class="inspired"><p class="kicker">EDITORIAL APPROACH</p><h2 id="inspired-title">借鉴成熟简报的阅读方式。</h2><p>参考优秀 AI 简报把重点放在前面、按主题组织内容、为新闻附上出处的做法。AI Signal 用中文呈现，并保留来源链接，方便继续阅读和判断。</p><div class="refs"><a href="https://tldr.tech/ai">TLDR AI ›</a><a href="https://www.therundown.ai/">The Rundown AI ›</a></div></div></section>

  ${subscribeSection()}

  <section class="wrap open" aria-labelledby="open">
    <h2 id="open">开源，可以自己部署</h2>
    <p>一个 GitHub 仓库、一个 DeepSeek API key、一个发信邮箱。网站不使用自建追踪像素或点击统计。</p>
    <div class="cta"><a href="${REPO}">在 GitHub 上查看 ›</a><a href="feed.xml">RSS 订阅 ›</a></div>
  </section>
</main>
<footer><div class="wrap"><span>AI Signal · MIT 许可</span><span>由 <a href="${AUTHOR}">秦徐俊</a> 制作</span></div></footer>
</body>
</html>
`;
}

// Atom feed: one entry per issue, newest first, built from the archived web editions.
export function renderFeed(entries, { updated = new Date().toISOString() } = {}) {
  const items = entries.map((e) => `  <entry>
    <title>${esc(e.title)}</title>
    <link href="${esc(e.url)}"/>
    <id>${esc(e.url)}</id>
    <updated>${esc(e.updated)}</updated>
    <summary>${esc(e.summary || '')}</summary>
  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>AI Signal</title>
  <subtitle>计划每天更新的中文 AI 简报</subtitle>
  <link href="${SITE}"/>
  <link rel="self" href="${SITE}feed.xml"/>
  <id>${SITE}</id>
  <updated>${esc(updated)}</updated>
  <author><name>秦徐俊</name><uri>${AUTHOR}</uri></author>
${items}
</feed>
`;
}

// Title and summary of an archived issue, read from its HTML.
export function entryFromArchive(html, ymd) {
  const $ = cheerio.load(String(html));
  const title = ($('h1').first().text() || $('title').text().split(' · ')[0] || ymd).replace(/\s+/g, ' ').trim();
  const summary = ($('meta[name="description"]').attr('content') || '').trim();
  // Atom requires a timestamp. For old archives with no recorded update time,
  // midnight UTC is a date-only placeholder, not a claim of publication time.
  const recorded = $('meta[name="ai-signal-updated-at"]').attr('content') || '';
  const updated = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(recorded) && !Number.isNaN(Date.parse(recorded)) ? recorded : `${ymd}T00:00:00Z`;
  return { title, summary, url: `${SITE}archive/${ymd}.html`, updated };
}
