// AI Signal — the website around the issues: the product page at the site root and the Atom feed.
//
// The issue itself (render.js) is built for an inbox: tables, inline styles, black on white. The
// product page is web-only: one stylesheet, the system light/dark setting, no external requests and
// no script except the back link (back.js). It follows the author's other product sites (VoiceFlow,
// 万象成文): a light page, very large two-tone headlines, the real product as the hero, big rounded
// panels, black pill buttons and one dark band.
//
// The page answers, in order: what it is, why it exists, how it works, who it learned from, where
// the sources come from, how the model picks, how it runs, why choose it, and what happens when it
// is wrong. Every number is either read from latest.json and the archive (so it moves with the
// issues) or written next to its date; the evidence is in plans/2026-11-03-homepage.md.

import * as cheerio from 'cheerio';
import { BACK_SCRIPT } from './back.js';
import { sourceSummary } from './render.js';

export const SITE = 'https://qinxujunai.github.io/ai-signal/';
const REPO = 'https://github.com/qinxujunai/ai-signal';
const AUTHOR = 'https://qinxujunai.github.io/';
const PROMPT = `${REPO}/blob/master/scripts/remix-digest.js`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%231d1d1f'/%3E%3Ccircle cx='4.5' cy='8' r='1.6' fill='%23fff'/%3E%3Ccircle cx='8' cy='8' r='1.6' fill='%23fff'/%3E%3Ccircle cx='11.5' cy='8' r='1.6' fill='%23fff' fill-opacity='.4'/%3E%3C/svg%3E">`;

// ── The facts behind the page ────────────────────────────────────────────────

// The 11 kinds of source, with the thresholds coded in prepare-digest.js and sources.js.
const GROUPS = [
  { id: 'first', name: '一手发布', hint: '公司和从业者自己发的', items: [
    ['官方博客', 'OpenAI、Anthropic、Google DeepMind、Google AI、Qwen、Hugging Face 等', '72 小时内的新文章，外加 follow-builders 的两个博客'],
    ['X 上的 builder', 'follow-builders 追踪的账号，多是一线 AI 从业者，如 Andrej Karpathy、Sam Altman', '36 小时内，每个账号取最热 3 条'],
    ['播客', 'follow-builders 收录的 Latent Space、No Priors 等', '10 天内的新一期，每天取 1 档'],
  ] },
  { id: 'community', name: '社区信号', hint: '工程师在投票、在讨论的', items: [
    ['Hacker News', '工程师社区的投票排行', '36 小时内超过 60 分的 AI 帖子，取前 15'],
    ['Reddit', '经 AINews 汇总的 AI 版块热帖', '最新一期 AINews（48 小时内）里讨论最热的 10 条'],
    ['Hugging Face 论文', '每日论文热榜', '按社区点赞取前 8'],
    ['Hugging Face 模型', '热门榜上的开放权重', '45 天内发布的新模型，取前 8'],
    ['GitHub Trending', '当日趋势里的 AI 项目', '取前 8'],
    ['Product Hunt', 'AI 分类的新产品', '36 小时内，取前 8'],
  ] },
  { id: 'media', name: '媒体报道', hint: '记者和编辑写的', items: [
    ['Techmeme', '科技行业的头条聚合', '36 小时内，只取 AI 相关，前 10'],
    ['中文媒体', '量子位、36氪', '48 小时内，36氪只取 AI 相关'],
  ] },
];
const KINDS = GROUPS.reduce((n, g) => n + g.items.length, 0);

// Checked on each publication's own site, 2026-11-03 (and Techmeme's front page).
const REFERENCES = [
  { name: 'TLDR AI', url: 'https://tldr.tech/ai', fact: '官网称 110 万订阅 · 每个工作日一期 · 约 5 分钟读完',
    good: '每条只有几句话，标题直接链到原文，扫一眼就能决定读不读。', learned: '每条只写几句话，标题和来源链接放在一起；每期开头再加三条「30 秒读完」。' },
  { name: 'The Rundown AI', url: 'https://www.therundown.ai/', fact: '官网称 350 万+ 读者 · 主打每天 5 分钟',
    good: '每期的主要新闻固定写「The details」和「Why it matters」，不只说发生了什么，还讲为什么重要。', learned: '头条分成「发生了什么」和「为什么重要」两段。' },
  { name: 'Techmeme', url: 'https://www.techmeme.com/', fact: '2005 年上线 · 从数千家媒体挑头条 · 软件初筛、编辑定稿',
    good: '同一件事的多家报道和讨论放在一起，一眼看出有多少人在跟。', learned: '同一件事的多个来源合并成一条，用「信号强度」最多三个点标出关注度。' },
];

// From the GitHub Actions run history, read on 2026-11-07 (evidence: plans/2026-11-03-homepage.md): the "Send"
// step of every daily run since 2026-10-23, and the "Edit the issue" step of the 13 runs since deepseek-flash
// replaced deepseek-chat (2026-10-26). Dated on the page: update them together with the as-of date.
const PUNCT = { asOf: '11 月 7 日', since: '10 月 23 日', days: 16, onTime: 15, late: '11 月 3 日 GitHub 的定时任务到 10:12 才启动，10:13 才发出' };
const EDIT = { since: '10 月 26 日', runs: 13, min: 32, max: 59 };

// Only what can be read off each product's own pages; nothing is inferred about how others pick or who writes.
const CRITERIA = ['语言', '广告', '原文链接', '谁来挑'];
const OPTIONS = [
  { name: 'AI Signal', note: '本站', mine: true,
    cells: ['中文，专有名词保留英文', '无', '每条都有，由程序按编号填入', 'DeepSeek 按公开的规则挑，没有人工编辑'] },
  { name: '英文 AI 简报', note: 'TLDR AI、The Rundown AI',
    cells: ['英文', '查看的样例期里都有赞助内容', '大多附原文链接，赞助内容链到广告主', '官网首页未说明'] },
  { name: '自己逐个刷', note: '官方博客、X、Hacker News……',
    cells: ['大多是英文', '各站不同', '直接读原文', '自己判断'] },
];

// The 2026-11-03 lead as the model saw it (run 41564707869). The model's raw JSON was not kept, so the page
// labels the reconstruction as a sketch and does not echo a headline.
const TRACE = {
  material: [
    ['H3', '(226 分, 265 评论) Anthropic reports $17B in Q3 revenue, commitments of $895B in revised S-1 —— cnbc.com'],
    ['T4', 'Sources: institutional investors told Anthropic that its IPO valuation should be around $1.5T to $1.6T … (Wall Street Journal)'],
  ],
  links: [
    ['Hacker News · 226 分', 'https://www.cnbc.com/2026/11/02/anthropic-ant-s-1-quarter-financials.html'],
    ['讨论', 'https://news.ycombinator.com/item?id=50337439'],
    ['Wall Street Journal · Techmeme', 'https://www.wsj.com/finance/stocks/anthropic-investors-push-for-cautious-valuation-closer-to-1-5-trillion-2f2df9cf'],
    ['TechCrunch · Techmeme', 'https://techcrunch.com/2026/11/02/anthropic-warns-that-its-very-close-to-rsi-capability-aka-self-building-ai/'],
  ],
};

// ── Style ───────────────────────────────────────────────────────────────────

const STYLE = `
:root{
  --bg:#fbfbfd;--surface:#fff;--tile:#f2f2f4;--ink:#1d1d1f;--ink-2:#6e6e73;--dim:#6e6e73;--line:#d2d2d7;
  --link:#0066cc;--btn:#1d1d1f;--btn-ink:#fff;--btn-hover:#3a3a3c;
  --g-first:#0071e3;--g-community:#f56300;--g-media:#af52de;
  --glass:rgba(255,255,255,.58);--glass-line:rgba(255,255,255,.9);--glow:.52;
  --bar:rgba(251,251,253,.8);--bar-line:rgba(0,0,0,.08);--code:#1d1d1f;
  --wrap:1180px;--gut:clamp(20px,4vw,40px);
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Helvetica Neue",Arial,sans-serif;
  --display:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  color-scheme:light dark;
}
@media (prefers-color-scheme:dark){
  :root{--bg:#000;--surface:#1c1c1e;--tile:#111113;--ink:#f5f5f7;--ink-2:#a1a1a6;--dim:#8e8e93;--line:#38383a;--link:#2997ff;--btn:#f5f5f7;--btn-ink:#1d1d1f;--btn-hover:#d2d2d7;--g-first:#2997ff;--g-community:#ff9f0a;--g-media:#bf5af2;--glass:rgba(28,28,30,.55);--glass-line:rgba(255,255,255,.12);--glow:.5;--bar:rgba(0,0,0,.72);--bar-line:rgba(255,255,255,.12);--code:#1c1c1e}
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-padding-top:64px}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 var(--font);-webkit-font-smoothing:antialiased;overflow-x:clip}
h1,h2,h3,p,ol,ul,figure{margin:0}
ol,ul{padding:0;list-style:none}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline;text-underline-offset:.18em}
:focus-visible{outline:3px solid var(--link);outline-offset:4px;border-radius:6px}
.wrap{width:min(var(--wrap),100% - 2*var(--gut));margin-inline:auto}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.num{font-variant-numeric:tabular-nums}

.bar{position:sticky;top:0;z-index:20;background:var(--bar);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--bar-line)}
.bar-in{width:min(var(--wrap),100% - 2*var(--gut));margin-inline:auto;height:52px;display:flex;align-items:center;gap:20px}
.start{display:flex;align-items:center;gap:16px;min-width:0}
.back{font-size:13px;color:var(--ink-2);white-space:nowrap;flex:none}
.back[hidden]{display:none}
.brand{font:700 18px/1 var(--display);letter-spacing:-.03em;color:var(--ink);white-space:nowrap}
.brand:hover{text-decoration:none}
.bar nav{margin-left:auto;display:flex;align-items:center;gap:26px;font-size:13px;white-space:nowrap}
.bar nav a{color:var(--ink-2)}
.bar nav a:hover{color:var(--ink);text-decoration:none}
.bar nav .pill{background:var(--btn);color:var(--btn-ink);padding:6px 14px;border-radius:980px}
.bar nav .pill:hover{background:var(--btn-hover);color:var(--btn-ink)}

.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 28px;border-radius:980px;background:var(--btn);color:var(--btn-ink);font-size:17px;font-weight:600}
.btn:hover{background:var(--btn-hover);text-decoration:none}
.btn-line{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 22px;border-radius:980px;border:1px solid var(--ink);color:var(--ink);font-size:15px;font-weight:600;white-space:nowrap}
.btn-line:hover{background:var(--ink);color:var(--bg);text-decoration:none}
.actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px 30px}
.go{font-size:17px}

.label{font-size:15px;font-weight:700;color:var(--link);margin-bottom:18px}
.h2{font:700 clamp(38px,5.4vw,72px)/1.1 var(--display);letter-spacing:-.045em;text-wrap:balance}
.h2 span{display:block}
.dim{color:var(--dim)}
.lede{font-size:clamp(17px,1.5vw,20px);line-height:1.75;color:var(--ink-2);max-width:38em;margin-top:28px;text-wrap:pretty}
.fine{font-size:13px;line-height:1.75;color:var(--ink-2);max-width:62em;margin-top:28px}
.fine a{text-decoration:underline;text-underline-offset:.18em}

.band{padding:clamp(72px,9vw,120px) 0;--card:var(--tile)}
.band.alt{background:var(--tile);--card:var(--surface)}
.band.dark{background:#000;color:#f5f5f7;--ink:#f5f5f7;--ink-2:#a1a1a6;--dim:#8e8e93;--line:#2c2c2e;--card:#161617;--link:#2997ff;--bg:#000}
@media (prefers-color-scheme:dark){.band.dark{border-block:1px solid #1c1c1e}}

/* Hero: the latest issue itself, inside a glass panel with one coloured glow. */
.hero{padding:clamp(64px,8vw,112px) 0 clamp(72px,9vw,112px);overflow:clip}
.hero-copy{text-align:center;max-width:880px;margin-inline:auto}
.hero .label{color:var(--ink);margin-bottom:20px}
.hero h1{font:700 clamp(64px,10vw,128px)/1 var(--display);letter-spacing:-.055em}
.hero-sub{font:700 clamp(28px,4.2vw,54px)/1.2 var(--display);letter-spacing:-.04em;color:var(--dim);margin-top:16px;text-wrap:balance}
.hero-desc{font-size:clamp(17px,1.6vw,21px);line-height:1.7;color:var(--ink-2);max-width:30em;margin:30px auto 0;text-wrap:balance}
.hero .actions{justify-content:center;margin-top:36px}
.hero-meta{font-size:13px;color:var(--ink-2);margin-top:22px}
.stage{position:relative;isolation:isolate;margin-top:clamp(56px,7vw,92px)}
.stage::before{content:"";position:absolute;z-index:-1;inset:12% 4% -3%;border-radius:80px;background:linear-gradient(110deg,#64d2ff,#0a84ff 22%,#5e5ce6 42%,#bf5af2 60%,#ff375f 80%,#ff9f0a);filter:blur(72px);opacity:var(--glow)}
.glass{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(28px,4vw,60px);align-items:center;padding:clamp(14px,2.6vw,32px);border-radius:44px;background:var(--glass);border:1px solid var(--glass-line);-webkit-backdrop-filter:saturate(170%) blur(30px);backdrop-filter:saturate(170%) blur(30px);box-shadow:0 40px 90px -56px rgba(0,0,0,.45)}
.stage-note{font-size:13px;line-height:1.7;color:var(--ink-2);text-align:center;margin-top:28px;text-wrap:balance}

.paper{background:#fff;color:#1d1d1f;border-radius:30px;padding:clamp(24px,3.4vw,44px);box-shadow:0 1px 2px rgba(0,0,0,.05),0 22px 44px -28px rgba(0,0,0,.3)}
.paper a{color:#0066cc}
.paper-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;color:#6e6e73}
.paper-brand{font:700 15px/1.3 var(--display);color:#1d1d1f;letter-spacing:-.01em}
.paper-brand span{font-weight:400;color:#6e6e73}
.paper-h{font:700 clamp(23px,2.5vw,32px)/1.25 var(--display);letter-spacing:-.025em;margin-top:22px;text-wrap:balance}
.paper-h a{color:#1d1d1f}
.paper-intro{font-size:16px;line-height:1.65;color:#424245;margin-top:12px}
.paper-meta{font-size:13px;color:#6e6e73;margin-top:14px}
.paper-tldr{background:#f5f5f7;border-radius:18px;padding:16px 20px 12px;margin-top:22px}
.paper-tldr p{font-size:13px;font-weight:600;color:#6e6e73}
.paper-tldr ol{counter-reset:t;margin-top:4px}
.paper-tldr li{counter-increment:t;display:grid;grid-template-columns:24px 1fr;font-size:15px;line-height:1.6;padding:5px 0}
.paper-tldr li::before{content:counter(t);font-weight:600;font-variant-numeric:tabular-nums}
.paper-more{font-size:15px;margin-top:18px}

.funnel{padding:clamp(8px,1.5vw,20px) clamp(4px,1vw,12px)}
.funnel-t{font:700 22px/1.3 var(--display);letter-spacing:-.02em}
.funnel-s{font-size:14px;color:var(--ink-2);margin-top:6px}
.steps{display:grid;gap:22px;margin-top:28px}
.step{display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:baseline}
.step b{font:700 clamp(40px,4.4vw,56px)/1 var(--display);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.step span{font-size:17px;font-weight:600}
.step small{grid-column:1/-1;font-size:13px;color:var(--ink-2);margin-top:6px}
.meter{grid-column:1/-1;position:relative;height:8px;border-radius:8px;background:rgba(120,120,128,.18);margin-top:12px}
.meter i{position:absolute;inset:0;border-radius:8px;background:linear-gradient(90deg,#0a84ff,#5e5ce6 40%,#bf5af2 70%,#ff375f);clip-path:inset(0 calc(100% - var(--w)) 0 0 round 8px)}
.funnel-src{font-size:13px;line-height:1.75;color:var(--ink-2);margin-top:26px;padding-top:18px;border-top:1px solid var(--line)}
@media (prefers-reduced-motion:no-preference){
  .meter i{animation:fill 1.2s cubic-bezier(.2,.7,.1,1) .2s both}
  .step:nth-child(2) .meter i{animation-delay:.4s}
  .step:nth-child(3) .meter i{animation-delay:.6s}
  @keyframes fill{from{clip-path:inset(0 100% 0 0 round 8px)}}
}

/* Why it exists */
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2vw,22px);margin-top:clamp(48px,6vw,72px)}
.tile{background:var(--card);border-radius:30px;padding:clamp(24px,2.6vw,34px)}
.tile h3{font:700 clamp(21px,1.9vw,25px)/1.3 var(--display);letter-spacing:-.02em;margin-top:28px}
.tile p{font-size:15px;line-height:1.75;color:var(--ink-2);margin-top:10px}
.viz{min-height:150px;padding-block:8px;display:flex;align-items:center;justify-content:center}
.cloud{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:300px}
.cloud span{font-size:12px;line-height:1;padding:7px 11px;border-radius:999px;background:var(--bg);border:1px solid var(--line);white-space:nowrap}
.cloud span:nth-child(3n){transform:rotate(-5deg) translateY(3px)}
.cloud span:nth-child(4n+1){transform:rotate(4deg)}
.cloud span:nth-child(5n){transform:translateY(-4px) rotate(-2deg)}
.langs{display:grid;grid-template-columns:repeat(11,minmax(0,1fr));gap:5px;width:100%}
.langs i{font-style:normal;font-size:11px;font-weight:700;height:84px;border-radius:9px;background:var(--bg);border:1px solid var(--line);color:var(--ink-2);display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px}
.langs .zh{background:var(--g-first);border-color:var(--g-first);color:#fff;height:84px}
.hn{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.hn-meta{font-size:12px;color:var(--ink-2)}
.hn-title{font:600 15px/1.45 var(--font);margin-top:6px}
.hn-claim{display:inline-block;font-size:12px;font-weight:600;color:#fff;background:#d70040;border-radius:999px;padding:4px 10px;margin-top:12px}
.mission{font:600 clamp(22px,2.5vw,32px)/1.55 var(--display);letter-spacing:-.02em;max-width:30em;margin-top:clamp(48px,6vw,80px);text-wrap:pretty}

/* How it solves it */
.cols3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(24px,3.4vw,52px);margin-top:clamp(48px,6vw,72px)}
.col{border-top:1px solid var(--line);padding-top:24px}
.col h3{font:700 clamp(21px,1.9vw,25px)/1.3 var(--display);letter-spacing:-.02em}
.col p{font-size:16px;line-height:1.8;color:var(--ink-2);margin-top:12px}
.seq-box{margin-top:clamp(40px,5vw,64px);background:var(--card);border-radius:28px;padding:22px clamp(20px,3vw,32px)}
.seq-t{font-size:13px;font-weight:600;color:var(--ink-2)}
.seq{display:flex;flex-wrap:wrap;align-items:center;gap:10px 0;margin-top:12px}
.seq li{display:flex;align-items:center;font-size:14px;font-weight:600}
.seq li+li::before{content:"›";color:var(--dim);margin:0 8px}
.seq span{padding:7px 13px;border-radius:999px;background:var(--bg)}

/* References */
.refs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(5,auto);gap:0 clamp(24px,3.4vw,52px);margin-top:clamp(48px,6vw,72px)}
.ref{border-top:2px solid var(--ink);padding-top:24px;grid-row:span 5;display:grid;grid-template-rows:subgrid;align-content:start}
.ref h3{font:700 clamp(26px,2.6vw,34px)/1.15 var(--display);letter-spacing:-.035em}
.ref-fact{font-size:14px;line-height:1.6;color:var(--ink-2);margin-top:10px}
.ref-k{font-size:13px;font-weight:700;color:var(--ink-2);margin-top:24px}
.ref-v{font-size:16px;line-height:1.75;margin-top:6px}
.ref-learned{background:var(--card);border-radius:18px;padding:16px 18px;margin-top:24px}
.ref-learned .ref-k{margin-top:0;color:var(--link)}
.ref-link{padding-top:22px;font-size:15px}

/* Sources: three groups, the big one in two columns so the cards come out level. */
.srcgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr) minmax(0,1fr);gap:14px;align-items:start;margin-top:clamp(40px,5vw,56px)}
.srccard{background:var(--card);border-radius:28px;padding:24px 26px 10px}
.srccard ul{margin-top:14px}
.srccard.wide ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:30px}
.srccard li{border-top:1px solid var(--line);padding:14px 0 16px}
.srccard li b{display:block;font:700 17px/1.35 var(--display);letter-spacing:-.01em}
.srccard li span{display:block;font-size:14px;line-height:1.6;color:var(--ink-2);margin-top:4px}
.srccard li em{display:block;font-style:normal;font-size:13px;line-height:1.55;font-weight:600;margin-top:6px}
.src-g{display:flex;align-items:center;font-size:16px;font-weight:700}
.src-hint{font-size:13px;color:var(--ink-2);margin-top:2px}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--g);margin-right:8px;flex:none}
.today-src{display:grid;grid-template-columns:auto 1fr;gap:10px 40px;align-items:center;margin-top:14px;background:var(--ink);color:var(--bg);border-radius:28px;padding:24px 30px}
.today-src .k{font-size:13px;font-weight:600;opacity:.75}
.today-src b{display:block;font:700 clamp(28px,3.2vw,40px)/1.1 var(--display);letter-spacing:-.035em;margin-top:4px}
.today-src p{font-size:14px;line-height:1.7}

/* The editor */
.editor{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:clamp(32px,5vw,76px);margin-top:clamp(48px,6vw,72px);align-items:start}
.specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:24px;overflow:hidden}
.specs div{background:var(--card);padding:18px 20px}
.specs dt{font-size:12px;font-weight:600;color:var(--ink-2)}
.specs dd{margin:6px 0 0;font:600 17px/1.4 var(--display)}
.specs small{display:block;font:400 12px/1.55 var(--font);color:var(--ink-2);margin-top:4px}
.asks-t{font:700 24px/1.3 var(--display);letter-spacing:-.02em;margin-top:44px}
.asks-s{font-size:15px;color:var(--ink-2);margin-top:8px}
.asks{counter-reset:q;display:grid;gap:16px;margin-top:20px}
.asks li{counter-increment:q;display:grid;grid-template-columns:44px 1fr;font:600 clamp(18px,1.7vw,22px)/1.5 var(--display);letter-spacing:-.01em}
.asks li::before{content:counter(q);width:30px;height:30px;border-radius:50%;background:var(--ink);color:var(--bg);font:700 15px/1 var(--font);display:flex;align-items:center;justify-content:center;margin-top:2px}
.trace{counter-reset:s;display:grid;gap:12px}
.trace>li{counter-increment:s;background:var(--card);border-radius:24px;padding:20px 22px}
.trace-t{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700}
.trace-t::before{content:counter(s);width:24px;height:24px;flex:none;border-radius:50%;border:1.5px solid var(--ink);font:700 12px/1 var(--font);display:flex;align-items:center;justify-content:center}
.code{font:13px/1.75 var(--mono);background:var(--code);color:#f5f5f7;border-radius:16px;padding:14px 16px;margin-top:14px;white-space:pre-wrap;overflow-wrap:anywhere}
.code b{color:#ffd60a;font-weight:600}
.code i{font-style:normal;color:#8fd1ff}
.out{background:#fff;color:#1d1d1f;border:1px solid #d2d2d7;border-radius:16px;padding:16px 18px;margin-top:14px}
.out-h{font:500 15px/1.5 var(--font);color:#6e6e73}
.out-src{font-size:13px;line-height:1.9;margin-top:8px;color:#6e6e73}
.out-src a{color:#0066cc}
.out-src .heat{color:#1d1d1f;letter-spacing:1px}

/* How it runs */
.timeline{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin-top:clamp(56px,7vw,88px);position:relative}
.timeline::before{content:"";position:absolute;left:0;right:0;top:45px;height:1px;background:linear-gradient(90deg,#0a84ff,#bf5af2 55%,#ff9f0a)}
.timeline li{display:grid;grid-template-rows:32px auto auto;align-content:start;padding-right:24px}
.timeline time{font:700 clamp(24px,2.4vw,32px)/1 var(--display);letter-spacing:-.03em;font-variant-numeric:tabular-nums;white-space:nowrap}
.timeline .node{width:11px;height:11px;border-radius:50%;background:#f5f5f7;box-shadow:0 0 0 5px #000;margin:8px 0 24px}
.timeline h3{font:700 20px/1.3 var(--display)}
.timeline p{font-size:14px;line-height:1.7;color:var(--ink-2);margin-top:8px}
.timeline code{display:inline-block;font:12px/1.4 var(--mono);color:#a1a1a6;background:#1c1c1e;border-radius:8px;padding:4px 8px;margin-top:12px}
.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:clamp(32px,5vw,72px);margin-top:clamp(56px,7vw,88px);border-top:1px solid var(--line)}
.facts div{display:grid;grid-template-columns:6.5em 1fr;gap:16px;padding:20px 0;border-bottom:1px solid var(--line)}
.facts dt{font-size:14px;color:var(--ink-2)}
.facts dd{margin:0;font-size:15px;line-height:1.75}
.facts dd a{text-decoration:underline;text-underline-offset:.18em}

/* Why choose it */
.compare{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:auto repeat(4,auto);gap:0 14px;margin-top:clamp(48px,6vw,72px)}
.option{grid-row:span 5;display:grid;grid-template-rows:subgrid;background:var(--card);border-radius:28px;padding:6px 22px 12px;border:2px solid transparent}
.option.mine{background:linear-gradient(var(--card),var(--card)) padding-box,linear-gradient(120deg,#0a84ff,#5e5ce6,#bf5af2,#ff375f,#ff9f0a) border-box}
.option header{padding:18px 0 16px}
.option h3{font:700 21px/1.3 var(--display);letter-spacing:-.02em}
.option header p{font-size:13px;color:var(--ink-2);margin-top:4px}
.cell{border-top:1px solid var(--line);padding:14px 0}
.cell-k{font-size:12px;color:var(--ink-2)}
.cell-v{font-size:15px;line-height:1.6;margin-top:4px}
.verdict{font:600 clamp(19px,1.8vw,23px)/1.65 var(--display);letter-spacing:-.01em;max-width:44em;margin-top:clamp(40px,5vw,56px);text-wrap:pretty}

/* A correction */
.fix{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(14px,2vw,22px);margin-top:clamp(48px,6vw,72px)}
.fix-tag{font-size:14px;font-weight:700;color:var(--ink-2);margin-bottom:12px}
.fix-card{background:#fff;color:#1d1d1f;border-radius:28px;padding:clamp(24px,3vw,36px);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.fix-text{font:600 clamp(19px,1.8vw,23px)/1.6 var(--display);letter-spacing:-.01em}
.fix-text del{color:#6e6e73;text-decoration-color:#d70040;text-decoration-thickness:2px}
.fix-links{display:flex;flex-wrap:wrap;gap:12px 28px;margin-top:32px;font-size:16px}

/* Start reading */
.begin{text-align:center}
.begin .h2{margin-inline:auto}
.begin .actions{justify-content:center;margin-top:40px}
.rss{max-width:760px;margin:clamp(48px,6vw,72px) auto 0;background:var(--card);border-radius:28px;padding:clamp(24px,3vw,34px);text-align:left;display:grid;grid-template-columns:1fr auto;gap:16px 28px;align-items:end}
.rss h3{font:700 21px/1.3 var(--display);letter-spacing:-.02em}
.rss p{font-size:15px;line-height:1.7;color:var(--ink-2);margin-top:6px}
.rss-url{font:14px/1.5 var(--mono);color:var(--ink);margin-top:14px;overflow-wrap:anywhere;user-select:all}

.foot{border-top:1px solid var(--line);padding:24px 0 48px;font-size:12px;color:var(--ink-2)}
.foot .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px 24px}
.foot nav{display:flex;flex-wrap:wrap;gap:8px 20px}
.foot a{color:var(--ink-2);text-decoration:underline;text-underline-offset:.18em}

@media (max-width:1068px){
  .srcgrid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-flow:dense}
  .srccard.wide{grid-column:1/-1}
  .timeline li{padding-right:16px}
}
@media (max-width:834px){
  .glass{grid-template-columns:1fr}
  .grid3,.cols3,.refs,.editor,.fix,.srcgrid{grid-template-columns:1fr}
  .srccard.wide ul{grid-template-columns:1fr}
  .today-src{grid-template-columns:1fr}
  .timeline{grid-template-columns:1fr}
  .timeline::before{left:5px;right:auto;top:6px;bottom:6px;width:1px;height:auto;background:linear-gradient(180deg,#0a84ff,#bf5af2 55%,#ff9f0a)}
  .timeline li{grid-template-columns:36px 1fr;grid-template-rows:auto;grid-template-areas:"node time" "node body";padding:0 0 32px}
  .timeline time{grid-area:time;font-size:24px}
  .timeline .node{grid-area:node;margin:6px 0 0}
  .timeline .body{grid-area:body;margin-top:10px}
  .facts{grid-template-columns:1fr}
  .compare{grid-template-columns:1fr;grid-template-rows:none;gap:14px}
  .option{grid-row:auto;display:block}
  .refs{grid-template-columns:1fr;grid-template-rows:none;row-gap:40px}
  .ref{grid-row:auto;display:flex;flex-direction:column}
  .rss{grid-template-columns:1fr;align-items:start}
}
@media (max-width:600px){
  .bar nav{gap:16px}
  .bar nav .hide-s{display:none}
  .specs{grid-template-columns:1fr}
  .facts div{grid-template-columns:1fr;gap:4px}
  .langs i,.langs .zh{height:64px}
  .srccard{padding:20px 20px 6px}
}
@media (max-width:380px){
  .bar-in{gap:12px}
  .start{gap:12px}
  .bar nav{gap:12px}
  .bar nav .hide-xs{display:none}
}
@supports not (grid-template-rows:subgrid){.option{grid-row:auto;display:block}.ref{grid-row:auto;display:flex;flex-direction:column}.refs,.compare{grid-template-rows:none}}
`;

// ── Pieces ──────────────────────────────────────────────────────────────────

function bar() {
  return `<header class="bar"><div class="bar-in"><span class="start"><a class="back" data-qxj-back hidden>‹ 返回</a><a class="brand" href="./">AI Signal</a></span><nav aria-label="主导航"><a class="hide-s" href="#approach">怎么做的</a><a href="archive/">往期</a><a class="hide-xs" href="#subscribe">订阅</a><a class="hide-s" href="${REPO}">GitHub</a><a class="pill" href="latest/">最新一期</a></nav></div></header>${BACK_SCRIPT}`;
}

const DAY = 864e5;
const dayLabel = (ymd) => { const [, m, d] = String(ymd).split('-'); return `${Number(m)} 月 ${Number(d)} 日`; };

// How long the issue has run, from the archive file names (one per Beijing day).
function runOf(dates) {
  const days = [...new Set(dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const daily = days.length > 1 && days.every((d, i) => i === 0 || Date.parse(d) - Date.parse(days[i - 1]) === DAY);
  return { count: days.length, first: days[0], last: days[days.length - 1], daily };
}

function hero(d, run) {
  const tldr = (d.tldr || []).slice(0, 3);
  const scanned = Number(d.scanned) || 0;
  const picked = Number(d.picked) || 0;
  const pct = (n) => `${Math.max(3, Math.min(100, Math.round((n / (scanned || 1)) * 100)))}%`;
  const summary = sourceSummary(d.sources);
  const missing = (d.missing || []).length ? `当天没取到：${esc(d.missing.join('、'))}，已在当期页脚注明。` : '';
  const story = run.count ? `网页存档从 ${dayLabel(run.first)}起，${run.daily ? `已连续 ${run.count} 期，一天没断` : `共 ${run.count} 期`}。` : '';
  return `<section class="hero" aria-labelledby="top">
  <div class="wrap hero-copy">
    <p class="label">中文 AI 日报</p>
    <h1 id="top">AI Signal</h1>
    <p class="hero-sub">每天一页，看懂 AI 的变化。</p>
    <p class="hero-desc">每天从全球 ${KINDS} 类 AI 信源里挑出约 30 条重要消息，用中文写清楚，每一条都能点回原文。</p>
    <div class="actions"><a class="btn" href="latest/">阅读最新一期</a><a class="go" href="#approach">看看它怎么做 ↓</a></div>
    <p class="hero-meta">计划每天 10:00 更新 · 免费 · 无广告 · 代码开源</p>
  </div>
  <div class="wrap stage">
    <div class="glass">
      <article class="paper" aria-labelledby="paper-h">
        <p class="paper-top"><span class="paper-brand">AI Signal <span>信号</span></span><span class="num">第 ${esc(d.number)} 期 · ${esc(d.dateLabel)}</span></p>
        <h2 class="paper-h" id="paper-h"><span class="visually-hidden">最新一期：</span><a href="latest/">${esc(d.headline)}</a></h2>
        ${d.intro ? `<p class="paper-intro">${esc(d.intro)}</p>` : ''}
        <p class="paper-meta num">从 ${esc(scanned)} 条新内容里选了 ${esc(picked)} 条 · 约 ${esc(d.minutes)} 分钟读完</p>
        ${tldr.length ? `<div class="paper-tldr"><p>30 秒读完</p><ol>${tldr.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>` : ''}
        <p class="paper-more"><a href="latest/">阅读全文 ›</a></p>
      </article>
      <div class="funnel">
        <p class="funnel-t">这一期是怎么来的</p>
        <p class="funnel-s">${KINDS} 类信源，各取最近的新内容</p>
        <ol class="steps">
          <li class="step"><b>${esc(scanned)}</b><span>条新内容</span><small>已去掉 60 天内发过的链接</small><span class="meter" aria-hidden="true"><i style="--w:100%"></i></span></li>
          <li class="step"><b>${esc(picked)}</b><span>条入选</span><small>${d.degraded ? '模型当天不可用，用原标题排出' : 'DeepSeek 按「选稿三问」挑选、写成中文'}</small><span class="meter" aria-hidden="true"><i style="--w:${pct(picked)}"></i></span></li>
          ${tldr.length ? `<li class="step"><b>${tldr.length}</b><span>条 30 秒读完</span><small>放在每期最前面</small><span class="meter" aria-hidden="true"><i style="--w:${pct(tldr.length)}"></i></span></li>` : ''}
        </ol>
        ${summary ? `<p class="funnel-src">当期来源：${esc(summary)}。${missing}</p>` : ''}
      </div>
    </div>
    <p class="stage-note">上面是最新一期的真实内容和数据，每天发布后自动更新。${story}</p>
  </div>
</section>`;
}

function why(stats, run) {
  // The average comes from the archived issues themselves (publish.js reads each page's header line). It counts the
  // candidates that reach the model, which each source caps at its top few: it is not the volume of AI news.
  const perDay = stats ? `每天约 ${stats.scanned} 条候选内容` : '每天几十条候选内容';
  const perDayNote = stats
    ? `已存档的 ${stats.count} 期（${dayLabel(run.first)}至${dayLabel(run.last)}）里，平均每天有 ${stats.scanned} 条候选内容进入筛选，入选 ${stats.picked} 条。`
    : '每天都有几十条候选内容进入筛选。';
  const names = ['OpenAI', 'Anthropic', 'Google DeepMind', 'Hacker News', 'Reddit', 'GitHub', 'Hugging Face', 'X', 'Techmeme', 'Product Hunt', 'Qwen', '量子位', '36氪'];
  return `<section class="band alt" id="why" aria-labelledby="why-h"><div class="wrap">
  <p class="label">为什么做</p>
  <h2 class="h2" id="why-h"><span>重要的 AI 消息，</span><span class="dim">分散在十几个网站。</span></h2>
  <p class="lede">一项发布，原文在官方博客，讨论在 Hacker News 和 Reddit，代码在 GitHub，论文在 Hugging Face。想每天跟上，就得每天把这些地方都翻一遍。</p>
  <div class="grid3">
    <article class="tile"><div class="viz" aria-hidden="true"><div class="cloud">${names.map((n) => `<span>${esc(n)}</span>`).join('')}</div></div>
      <h3>${perDay}</h3><p>${perDayNote}</p></article>
    <article class="tile"><div class="viz" aria-hidden="true"><div class="langs">${'<i>EN</i>'.repeat(KINDS - 1)}<i class="zh">中</i></div></div>
      <h3>一手信息多是英文</h3><p>这 ${KINDS} 类信源里，${KINDS - 1} 类是英文。读原文费时间，读转述又容易走样。</p></article>
    <article class="tile"><div class="viz" aria-hidden="true"><div class="hn"><p class="hn-meta">▲ 1971 分 · 624 条评论 · Hacker News</p><p class="hn-title">Astra can read and write weights to improve Qwen</p><span class="hn-claim">转述：数学能力变强了</span></div></div>
      <h3>热度高，不等于结论对</h3><p>11 月 3 日这条 1971 分的热帖，一句「数学能力变强」就能盖过作者写明的限制。</p></article>
  </div>
  <p class="mission">所以 AI Signal 只做一件事：每天替读者把这些地方扫一遍，挑出会影响判断的消息，用中文写清楚，并让每一条都能回到原文。</p>
</div></section>`;
}

function approach(d) {
  const order = ['30 秒读完', '头条', '要闻', '社区在聊', '观点', '新模型', '新产品', '论文', '开源', '快讯', '播客'];
  return `<section class="band" id="approach" aria-labelledby="approach-h"><div class="wrap">
  <p class="label">怎么解决</p>
  <h2 class="h2" id="approach-h"><span>${KINDS} 类信源进来，</span><span class="dim">一页中文出去。</span></h2>
  <p class="lede">用固定的流程代替每天手动刷网站：程序收集素材，模型按规则挑选、改写成中文，程序再把链接和数字填回去。</p>
  <div class="cols3">
    <div class="col"><h3>一页读完</h3><p>先读「30 秒读完」三条，再看头条和要闻，后面是社区、观点、模型、产品、论文、开源和快讯。最新一期约 ${esc(d.minutes)} 分钟读完。</p></div>
    <div class="col"><h3>每条都能回到原文</h3><p>每条都附原文链接。链接，以及来源标签里的分数、星标、点赞，都由程序按素材编号从原始数据填入，不经过模型。</p></div>
    <div class="col"><h3>把边界讲清楚</h3><p>原文写了限制，就照写；热度只说明有多少人关注，不等于已核实；写错了，就在原期公开更正。</p></div>
  </div>
  <div class="seq-box"><p class="seq-t">一期的顺序</p><ol class="seq">${order.map((s) => `<li><span>${s}</span></li>`).join('')}</ol></div>
</div></section>`;
}

function references() {
  return `<section class="band alt" id="references" aria-labelledby="references-h"><div class="wrap">
  <p class="label">参考了谁</p>
  <h2 class="h2" id="references-h"><span>借鉴成熟简报，</span><span class="dim">按中文读者改。</span></h2>
  <p class="lede">TLDR AI 和 The Rundown AI 的官网各自称有上百万读者，Techmeme 2005 年上线。从每家借鉴一个最关键的做法。</p>
  <div class="refs">${REFERENCES.map((r) => `
    <article class="ref">
      <h3>${esc(r.name)}</h3>
      <p class="ref-fact">${esc(r.fact)}</p>
      <div><p class="ref-k">好在哪</p><p class="ref-v">${esc(r.good)}</p></div>
      <div class="ref-learned"><p class="ref-k">AI Signal 借鉴了</p><p class="ref-v">${esc(r.learned)}</p></div>
      <p class="ref-link"><a href="${esc(r.url)}">${esc(r.name)} 官网 ›</a></p>
    </article>`).join('')}
  </div>
  <p class="fine">订阅数和介绍来自各家官网，2026 年 11 月 3 日查看。TLDR AI 和 The Rundown AI 的样例期里都有赞助内容；AI Signal 是中文、无广告，选稿规则公开在代码里。这里只是参考，不代表合作或背书。</p>
</div></section>`;
}

function sources(d) {
  const card = (g) => `
    <article class="srccard${g.items.length > 4 ? ' wide' : ''}" style="--g:var(--g-${g.id})">
      <p class="src-g"><span class="dot"></span>${esc(g.name)}</p><p class="src-hint">${esc(g.hint)}</p>
      <ul>${g.items.map(([name, who, rule]) => `<li><b>${esc(name)}</b><span>${esc(who)}</span><em>${esc(rule)}</em></li>`).join('')}</ul>
    </article>`;
  const summary = sourceSummary(d.sources);
  const today = summary ? `
  <div class="today-src"><div><p class="k">第 ${esc(d.number)} 期实际取到</p><b>${esc(d.scanned)} 条新内容</b></div><p>${esc(summary)}。${(d.missing || []).length ? `当天没取到：${esc(d.missing.join('、'))}。` : ''}发过的链接，60 天内不再出现。</p></div>` : '';
  return `<section class="band" id="sources" aria-labelledby="sources-h"><div class="wrap">
  <p class="label">信源从哪来</p>
  <h2 class="h2" id="sources-h"><span>${KINDS} 类信源，</span><span class="dim">每一类都有入选门槛。</span></h2>
  <p class="lede">一手发布看官方，关注度看社区，补充视角看媒体。门槛写在代码里，每天都一样。</p>
  <div class="srcgrid">${GROUPS.map(card).join('')}
  </div>${today}
</div></section>`;
}

function editor() {
  const material = TRACE.material.map(([id, text]) => `<b>[${id}]</b> ${esc(text)}`).join('\n');
  const json = `{ <i>"ref"</i>: <b>"H3"</b>, <i>"also"</i>: [<b>"T4"</b>, <b>"T3"</b>],\n  <i>"title"</i>: "……", <i>"what"</i>: "……" }`;
  const links = TRACE.links.map(([label, url]) => `<a href="${esc(url)}">${esc(label)} ›</a>`).join('&nbsp;&nbsp; ');
  return `<section class="band alt" id="editor" aria-labelledby="editor-h"><div class="wrap">
  <p class="label">AI 怎么挑</p>
  <h2 class="h2" id="editor-h"><span>DeepSeek 当主编，</span><span class="dim">规则写进代码里。</span></h2>
  <p class="lede">每天调用一次模型，返回的内容无法解析时才重试。模型负责挑选、归类、写中文；来源链接和标签里的热度数字由程序填入，模型只能引用编号。</p>
  <div class="editor">
    <div>
      <dl class="specs">
        <div><dt>模型</dt><dd>DeepSeek-V4.1-Flash<small>接口名 deepseek-flash</small></dd></div>
        <div><dt>模式</dt><dd>深度思考，JSON 输出</dd></div>
        <div><dt>输入</dt><dd>标题、热度和摘要<small>摘要最多 160–420 字，因信源而异；Hacker News 和 Techmeme 只有标题；播客读逐字稿前 9000 字</small></dd></div>
        <div><dt>输出</dt><dd>素材编号和中文文字<small>链接由程序按编号填入</small></dd></div>
        <div><dt>调用</dt><dd>每天 09:35，1 次<small>JSON 无法解析时重试 1 次</small></dd></div>
        <div><dt>用时</dt><dd class="num">${EDIT.min}–${EDIT.max} 秒<small>deepseek-flash，${EDIT.since}至${PUNCT.asOf}的 ${EDIT.runs} 次运行</small></dd></div>
      </dl>
      <h3 class="asks-t">选稿三问</h3>
      <p class="asks-s">每条素材都要过这三问；没有具体内容，就降级或不选。</p>
      <ol class="asks">
        <li>读者会因为这条信息做出不同的决定吗？</li>
        <li>这是新的事实或洞察，还是噪音、情绪、营销？</li>
        <li>有没有具体的东西：数字、版本号、价格、基准分数、名字？</li>
      </ol>
      <p class="fine">写法也有规定：标题写成一句完整的事实；正文必须带材料里的数字或细节；不写「值得关注」「意义重大」这类空话；材料里的限制条件要保留。模型看到的是标题、热度和摘要，不是全文，所以摘要可能遗漏细节，重要结论请回原文核对。全文见 <a href="${PROMPT}">remix-digest.js</a>。</p>
    </div>
    <ol class="trace">
      <li><p class="trace-t">程序给每条素材编号</p><pre class="code">${material}</pre></li>
      <li><p class="trace-t">模型用编号指明出处</p><pre class="code">${json}</pre></li>
      <li><p class="trace-t">程序按编号填回链接和分数</p><div class="out"><p class="out-h">标题和正文：模型写的中文</p><p class="out-src"><span class="heat">●●●</span>&nbsp;&nbsp;|&nbsp;&nbsp;${links}</p></div></li>
    </ol>
  </div>
  <p class="fine">示意：素材和链接取自 11 月 3 日头条那次真实运行，模型返回的 JSON 做了简化。引用了不存在的编号，这一条直接丢掉；模型不可用时，用原标题排出降级版，并在页脚注明。</p>
</div></section>`;
}

function architecture() {
  const steps = [
    ['08:10', '闹钟', '前一天发完就给今天定好闹钟，到点启动并认领当天；04:07 起每 20 分钟一次的定时任务作后备。', 'relay.js'],
    ['09:35', '收集', `并行读取 ${KINDS} 类信源，各取最近的新内容，去掉 60 天内发过的，用时 1–3 秒。`, 'prepare-digest.js'],
    ['09:35', '编辑', '素材编号后交给 DeepSeek，拿回 JSON，再由程序回填链接和数字。', 'remix-digest.js'],
    ['10:00', '发送', '邮件经 QQ 邮箱 SMTP 发出。', 'deliver.js'],
    ['10:00', '发布', '更新首页、当期、往期、RSS 和 latest.json，由 GitHub Pages 托管。', 'publish.js'],
  ];
  return `<section class="band dark" id="how" aria-labelledby="how-h"><div class="wrap">
  <p class="label">技术架构</p>
  <h2 class="h2" id="how-h"><span>一个 GitHub 仓库，</span><span class="dim">每天自动跑完全程。</span></h2>
  <p class="lede">不用自己的服务器。收集、编辑、发送、发布都在 GitHub Actions 里完成，代码全部公开。</p>
  <ol class="timeline">${steps.map(([t, h, p, f]) => `
    <li><time class="num">${t}</time><span class="node" aria-hidden="true"></span><div class="body"><h3>${h}</h3><p>${p}</p><code>${f}</code></div></li>`).join('')}
  </ol>
  <dl class="facts">
    <div><dt>准点</dt><dd>计划每天 10:00 发出，可能延迟。截至 ${PUNCT.asOf}，${PUNCT.since}起的 ${PUNCT.days} 天里，${PUNCT.onTime} 天在 10:00:00 发出；${PUNCT.late}。<a href="${REPO}/actions/workflows/daily.yml">每次运行记录</a>公开可查。</dd></div>
    <div><dt>费用</dt><dd>GitHub Actions 和 Pages 对公开仓库免费；模型按 DeepSeek 的用量计费，每天 1 次调用，解析失败时多 1 次。</dd></div>
    <div><dt>数据接口</dt><dd><a href="latest.json">latest.json</a>：当期的期号、标题、三条要点、信源统计和链接。作者的个人主页每天读取它。</dd></div>
    <div><dt>源代码</dt><dd><a href="${REPO}">GitHub</a>，MIT 许可，可以自己部署一份。网站不加载外部字体、脚本和统计代码，也不收集邮箱。</dd></div>
  </dl>
</div></section>`;
}

function compare() {
  return `<section class="band" id="compare" aria-labelledby="compare-h"><div class="wrap">
  <p class="label">为什么选它</p>
  <h2 class="h2" id="compare-h"><span>同样是看 AI 新闻，</span><span class="dim">差别在这 ${CRITERIA.length} 处。</span></h2>
  <div class="compare">${OPTIONS.map((o) => `
    <article class="option${o.mine ? ' mine' : ''}"><header><h3>${esc(o.name)}</h3><p>${esc(o.note)}</p></header>${o.cells.map((v, i) => `<div class="cell"><p class="cell-k">${CRITERIA[i]}</p><p class="cell-v">${esc(v)}</p></div>`).join('')}</article>`).join('')}
  </div>
  <p class="verdict">想把简报直接订到邮箱、或读英文原味，TLDR AI、The Rundown AI 更合适；想用中文几分钟看完，并且知道每一条是怎么挑出来的，AI Signal 更合适。</p>
  <p class="fine">英文简报一列只写官网和样例期里能看到的内容，2026 年 11 月 3 日查看；没有说明的，写「官网首页未说明」，不猜。</p>
</div></section>`;
}

function correction() {
  return `<section class="band alt" id="correction" aria-labelledby="correction-h"><div class="wrap">
  <p class="label">写错了怎么办</p>
  <h2 class="h2" id="correction-h"><span>写过头的地方，</span><span class="dim">在原期公开改正。</span></h2>
  <div class="fix">
    <div><p class="fix-tag">11 月 3 日发出时</p><div class="fix-card"><p class="fix-text"><del>Astra 能直接读写神经网络权重，把 Qwen3.5-0.8B 的数学能力改强</del></p></div></div>
    <div><p class="fix-tag">对照研究原文后</p><div class="fix-card"><p class="fix-text">研究者用 Astra 修改 Qwen 权重，缓解推理循环：MATH-500 得分从 7.9% 升至 48.1%。作者强调，减少循环不等于增加新能力；在另一模型上的测试没有明确提升。</p></div></div>
  </div>
  <p class="fix-links"><a href="https://rikiyat.github.io/blog/weight-space-programming/">研究原文 ›</a><a href="archive/2026-11-03.html">更正后的第 15 期 ›</a></p>
  <p class="fine">原因：那天模型只看到 Hacker News 的标题和 Techmeme 的一句话摘要，没有读到研究原文里的限制。网页和 RSS 已同步更正，期首写明了改了什么；已发出的邮件无法撤回。同一期的估值报道，也改成了「部分投资人的判断」。</p>
</div></section>`;
}

// Subscribing is RSS: any reader app follows the feed. No sign-up, no list of addresses to keep.
export function subscribeSection() {
  return `<div class="rss" id="subscribe">
    <div><h3>用 RSS 订阅</h3><p>把下面的地址添加到任意 RSS 阅读器，新一期发布后自动出现。不用注册，邮件目前只发给作者本人。</p><p class="rss-url">${esc(SITE)}feed.xml</p></div>
    <a class="btn-line" href="feed.xml">打开 RSS 地址</a>
  </div>`;
}

function begin(run) {
  return `<section class="band begin" aria-labelledby="begin-h"><div class="wrap">
  <p class="label">开始读</p>
  <h2 class="h2" id="begin-h"><span>每天一期，</span><span class="dim">从这一页开始。</span></h2>
  <div class="actions"><a class="btn" href="latest/">阅读最新一期</a><a class="go" href="archive/">${run.count ? `浏览全部 ${run.count} 期` : '浏览往期'} ›</a></div>
  ${subscribeSection()}
</div></section>`;
}

// The product page. `d` is the latest issue as written to latest.json (publish.js); `dates` are the
// archived days, newest first; `stats` the averages over the archive (publish.js archiveStats). The page
// is a pure function of these, so it can be rebuilt any time.
export function renderLanding(d, { dates = [], stats = null } = {}) {
  const run = runOf(dates);
  const description = `AI Signal 是一份中文 AI 日报：每天从 ${KINDS} 类全球信源中挑出约 30 条重要消息，用中文写清楚，每条附原文链接。免费、无广告、代码开源。`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Signal · 每天一页，看懂 AI 的变化</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#fbfbfd" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="AI Signal · 每天一页，看懂 AI 的变化">
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
${hero(d, run)}
${why(stats, run)}
${approach(d)}
${references()}
${sources(d)}
${editor()}
${architecture()}
${compare()}
${correction()}
${begin(run)}
</main>
<footer class="foot"><div class="wrap"><span>AI Signal · MIT 许可 · 由 <a href="${AUTHOR}">秦徐俊</a> 制作</span><nav aria-label="页脚"><a href="${REPO}">源代码</a><a href="feed.xml">RSS</a><a href="latest.json">latest.json</a><a href="archive/">往期</a></nav></div></footer>
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
