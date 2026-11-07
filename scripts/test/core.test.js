import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { msUntil, beijingDate } from '../clock.js';
import { parseFeed, parseTechmeme, parseAINewsReddit, latestAINews, mapHFModels, parseTrending, heat, decode, AI_RE_ZH } from '../sources.js';
import { renderIssue, renderArchive } from '../render.js';

test('clock: Beijing date and milliseconds until a Beijing time', () => {
  // 2026-10-22 00:00 UTC = 08:00 Beijing
  const now = new Date('2026-10-22T00:00:00Z');
  assert.equal(beijingDate(now), '2026-10-22');
  assert.equal(msUntil('09:35', now), 95 * 60_000);
  assert.equal(msUntil('10:00', now), 120 * 60_000);
  assert.equal(msUntil('07:00', now), 0, 'past times return 0');
  // 23:30 UTC on the 21st is already the 22nd in Beijing
  assert.equal(beijingDate(new Date('2026-10-21T23:30:00Z')), '2026-10-22');
  assert.throws(() => msUntil('25:00', now));
});

test('feeds: RSS and Atom items with decoded titles', () => {
  const rss = '<rss><item><title><![CDATA[A &amp; B]]></title><link>https://x.dev/a</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Hi&lt;/p&gt;</description></item></rss>';
  const [i] = parseFeed(rss);
  assert.equal(i.title, 'A & B');
  assert.equal(i.url, 'https://x.dev/a');
  assert.equal(i.summary, 'Hi');
  assert.equal(i.publishedAt, '2026-10-21T10:00:00.000Z');
  const atom = '<feed><entry><title>T</title><link href="https://y.dev/b"/><updated>2026-10-21T00:00:00Z</updated></entry></feed>';
  assert.equal(parseFeed(atom)[0].url, 'https://y.dev/b');
});

test('techmeme: original link, byline split off, AI headlines only', () => {
  const xml = `<rss><item><title>OpenAI ships a new model for agents (Jane Doe/Reuters)</title><link>https://www.techmeme.com/261022/p1#a1</link><pubDate>Thu, 22 Oct 2026 08:00:00 -0400</pubDate><description><![CDATA[<SPAN><B><A HREF="https://www.reuters.com/x">OpenAI ships</A></B></SPAN>]]></description></item>
  <item><title>Phone sales rise (A/B)</title><link>https://www.techmeme.com/261022/p2</link><pubDate>Thu, 22 Oct 2026 08:00:00 -0400</pubDate><description>x</description></item></rss>`;
  const items = parseTechmeme(xml, { now: new Date('2026-10-22T14:00:00Z').getTime() });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'OpenAI ships a new model for agents');
  assert.equal(items[0].by, 'Jane Doe/Reuters');
  assert.equal(items[0].url, 'https://www.reuters.com/x');
  assert.equal(items[0].discussion, 'https://www.techmeme.com/261022/p1#a1');
});

test('AINews: Reddit threads with activity, newest issue only when fresh', () => {
  const html = '<ul><li><p><strong><a href="https://www.reddit.com/r/LocalLLaMA/comments/1/x/">New from DeepSeek - DeepInfer -</a></strong> (Activity: 441): <strong>Open-source inference.</strong> More.</p></li>'
    + '<li><p><strong><a href="https://www.reddit.com/r/singularity/comments/2/y/">Robots</a></strong> (Activity: 3,907): <strong>Kung fu.</strong></p></li></ul>';
  const r = parseAINewsReddit(html);
  assert.deepEqual(r.map((x) => x.activity), [3907, 441]);
  assert.equal(r[1].title, 'New from DeepSeek - DeepInfer');
  assert.equal(r[1].subreddit, 'r/LocalLLaMA');
  const feed = `<rss><item><title><![CDATA[[AINews] Big day]]></title><link>https://www.latent.space/p/a</link><pubDate>Thu, 22 Oct 2026 07:00:00 GMT</pubDate><content:encoded><![CDATA[${html}]]></content:encoded></item></rss>`;
  const issue = latestAINews(feed, { now: new Date('2026-10-22T09:00:00Z').getTime() });
  assert.equal(issue.title, 'Big day');
  assert.equal(issue.reddit.length, 2);
  assert.equal(latestAINews(feed, { now: new Date('2026-10-26T09:00:00Z').getTime() }), null, 'stale issues are ignored');
});

// AINews changed its markup in late October 2026: the thread title link lost its <strong> wrapper and got a <b>
// inside. The old parser then read 0 threads from every issue for eleven days, with no error and nothing in the footer.
const AINEWS_NEW = '<div><ul><li><p><a href="https://www.reddit.com/r/LocalLLaMA/comments/9/k/" target="_blank" rel="noopener noreferrer"><b>Kimi is now open-weights</b></a> (Activity: 1972): <b>Moonshot released </b><a href="https://huggingface.co/moonshotai/Kimi"><b>Kimi</b></a><b> as open weights.</b> More text.</p></li>'
  + '<li><p><a href="https://www.reddit.com/r/singularity/comments/8/j/"><b>Robots learn kung fu</b></a> (Activity: 3,907): <b>A clip.</b></p></li>'
  + '<li><p><a href="https://example.com/blog"><b>Not a thread</b></a> (Activity: 5): <b>no reddit link.</b></p></li>'
  + '<li><p>A recap paragraph that only mentions <a href="https://www.reddit.com/r/x/comments/1/a/">a thread</a> in passing.</p></li></ul></div>';

test('AINews: the 2026 markup (no <strong> around the title link) is read too, and an unreadable issue is an error', async () => {
  const r = parseAINewsReddit(AINEWS_NEW);
  assert.deepEqual(r.map((x) => x.activity), [3907, 1972], 'two threads, hottest first; non-reddit and passing mentions are skipped');
  assert.equal(r[1].title, 'Kimi is now open-weights');
  assert.equal(r[1].subreddit, 'r/LocalLLaMA');
  assert.ok(r[1].summary.startsWith('Moonshot released') && !r[1].summary.includes('Activity'), 'the summary starts after the activity count');
  const { redditFromAINews } = await import('../sources.js');
  const feed = (html, date = 'Thu, 22 Oct 2026 07:00:00 GMT') => `<rss><item><title><![CDATA[[AINews] Day]]></title><link>https://www.latent.space/p/a</link><pubDate>${date}</pubDate><content:encoded><![CDATA[${html}]]></content:encoded></item></rss>`;
  const now = new Date('2026-10-22T09:00:00Z').getTime();
  assert.equal(redditFromAINews(feed(AINEWS_NEW), { now }).length, 2);
  assert.throws(() => redditFromAINews(feed('<ul><li><p>no threads here</p></li></ul>'), { now }), /no readable Reddit threads/, 'a fresh issue with no readable threads must not pass silently');
  assert.throws(() => redditFromAINews(feed(AINEWS_NEW), { now: new Date('2026-10-26T09:00:00Z').getTime() }), /no AINews issue/, 'a stale issue is still an error');
});

test('HF models and GitHub trending map to items', () => {
  const now = new Date('2026-10-22T00:00:00Z').getTime();
  const m = mapHFModels([{ id: 'a/new', likes: 5, createdAt: '2026-10-20T00:00:00Z', pipeline_tag: 'text-generation' }, { id: 'b/old', createdAt: '2025-01-01T00:00:00Z' }], { now });
  assert.deepEqual(m.map((x) => x.name), ['a/new']);
  assert.equal(m[0].url, 'https://huggingface.co/a/new');
  const html = '<article class="Box-row"><h2><a href="/o/r">o / r</a></h2><p class="col-9 x">An LLM agent</p><a href="/o/r/stargazers">\n 1,234\n</a> 56 stars today <span itemprop="programmingLanguage">Python</span></article>';
  assert.deepEqual(parseTrending(html)[0], { name: 'o/r', description: 'An LLM agent', url: 'https://github.com/o/r', starsToday: 56, stars: 1234, language: 'Python' });
});

test('signal strength and Chinese AI filter', () => {
  assert.equal(heat({ points: 80 }, 0), 1);
  assert.equal(heat({ points: 500 }, 0), 2);
  assert.equal(heat({ points: 500 }, 3), 3, 'capped at 3');
  assert.ok(AI_RE_ZH.test('巴克莱加码应用AI'));
  assert.ok(!AI_RE_ZH.test('新能源车销量创新高'));
  assert.equal(decode('&amp;lt;b&amp;gt;x'), 'x');
});

// A page is self-contained when nothing in it makes the browser fetch from another origin or run a script.
// (The first version of this check was a regex for .css/.js links and let fonts, @import, url(), images and frames through.)
function assertSelfContained(html, what = 'page') {
  const $ = cheerio.load(html);
  const remote = (v) => /^\s*(https?:)?\/\//i.test(v || '');
  assert.equal($('script').length, 0, `${what}: no scripts`);
  for (const [sel, attr] of [['script', 'src'], ['img', 'src'], ['iframe', 'src'], ['source', 'src'], ['video', 'src'], ['audio', 'src'], ['embed', 'src'], ['object', 'data'], ['input', 'src']]) {
    $(sel).each((_, el) => assert.ok(!remote($(el).attr(attr)), `${what}: <${sel}> loads ${$(el).attr(attr)}`));
  }
  $('link[href]').each((_, el) => {
    const rel = ($(el).attr('rel') || '').toLowerCase();
    if (/canonical|alternate|author|license/.test(rel)) return; // pointers, not requests
    assert.ok(!remote($(el).attr('href')), `${what}: <link rel=${rel}> loads ${$(el).attr('href')}`);
  });
  const css = $('style').map((_, el) => $(el).text()).get().join('\n') + '\n' + $('[style]').map((_, el) => $(el).attr('style')).get().join('\n');
  assert.ok(!/@import/i.test(css), `${what}: CSS has no @import`);
  assert.ok(!/url\(\s*['"]?(https?:)?\/\//i.test(css), `${what}: CSS loads no remote url()`);
}

test('the self-contained check catches remote fonts, imports, images, frames and scripts', () => {
  const page = (inner) => `<!doctype html><html><head>${inner}</head><body></body></html>`;
  const bad = [
    page('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">'),
    page('<style>@import url("https://x.test/a.css");</style>'),
    page('<style>body{background:url(https://x.test/a.png)}</style>'),
    page('<style>body{background:url(//x.test/a.png)}</style>'),
    '<html><body><img src="https://x.test/a.png"></body></html>',
    '<html><body><iframe src="https://x.test/"></iframe></body></html>',
    '<html><body><script src="https://x.test/a.js"></script></body></html>',
  ];
  for (const html of bad) assert.throws(() => assertSelfContained(html), /./, html);
  assert.doesNotThrow(() => assertSelfContained(page('<link rel="icon" href="data:image/svg+xml,%3Csvg/%3E"><link rel="canonical" href="https://qinxujunai.github.io/ai-signal/"><style>a{color:red}</style>')));
});

const issue = {
  headline: '测试头条 <b>', intro: '今天的三件事指向同一个方向',
  tldr: ['一', '二', '三'],
  lead: { title: 'Lead', what: 'w', why: 'y', tag: '模型', source: { label: 'HN · 300 分', url: 'https://e.com/1', discussion: 'https://news.ycombinator.com/item?id=1' }, also: [], heat: 3 },
  stories: [{ title: 'S', body: 'b', tag: '开源', source: { label: 'Techmeme', url: 'https://e.com/2' }, also: [{ label: 'X', url: 'https://e.com/3' }], heat: 2 }],
  community: [{ title: 'C', point: 'p', url: 'https://reddit.com/r/x', label: 'r/x · 热度 900' }],
  voices: [], models: [{ name: 'a/m', insight: 'i', url: 'https://huggingface.co/a/m', likes: 1200, task: 'text-generation' }],
  products: [{ name: 'P', insight: 'i', url: 'https://ph.com/p' }], papers: [], repos: [], quick: [], podcast: null,
};
const meta = { ymd: '2026-10-22', dateLabel: '10月22日周四', number: 4, scanned: 97, picked: 9, stats: { techmeme: 6, reddit: 10 }, missing: ['Techmeme: HTTP 500'] };

test('render: masthead, sections, escaping, web-only bits', () => {
  const email = renderIssue(issue, meta, { mode: 'email' });
  const web = renderIssue(issue, meta, { mode: 'web' });
  for (const s of ['第 4 期', '今天的三件事', '社区在聊', '新模型', '新产品', '为什么重要', '信号强度', '今天没取到：Techmeme', 'Techmeme 6']) assert.ok(email.includes(s), s);
  assert.ok(email.includes('测试头条 &lt;b&gt;'), 'headline is escaped');
  assert.ok(!email.includes('<main>') && !email.includes('rel="icon"'), 'email has no web-only tags');
  const fallback = renderIssue({ ...issue, degraded: true }, meta, { mode: 'email' });
  assert.ok(fallback.includes('本期依据现有来源生成') && !fallback.includes('由 DeepSeek 按编辑标准挑选'), 'fallback does not claim model editing');
  assert.ok(web.includes('<main>') && web.includes('rel="icon"'));
  assert.equal((web.match(/<h1/g) || []).length, 1);
  assert.ok(!/<style|<img|<script/i.test(email), 'email: no style blocks, images or scripts');
  // Restraint: greys plus one blue for links, nothing else (no section colours, no tinted pills).
  const colours = new Set((email.match(/#[0-9a-f]{6}\b/gi) || []).map((c) => c.toLowerCase()));
  assert.ok(colours.size <= 7, `palette has ${colours.size} colours: ${[...colours]}`);
  for (const c of colours) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    assert.ok(c === '#0066cc' || Math.max(r, g, b) - Math.min(r, g, b) <= 12, `${c} is neither grey nor the link blue`);
  }
  assert.ok(web.includes('backdrop-filter'), 'web edition has the translucent bar');
  const arch = renderArchive(['2026-10-22', '2026-10-21']);
  assert.ok(arch.includes('第 2 期 · 2026-10-22') && arch.includes('共 2 期'));
});

test('website: product page, latest, archive and an Atom feed', async () => {
  const { mkdtemp, readFile, writeFile, mkdir } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { XMLParser } = await import('fast-xml-parser');
  const { publishWeb } = await import('../publish.js');
  const dir = await mkdtemp(join(tmpdir(), 'ai-signal-web-'));
  await mkdir(join(dir, 'archive'), { recursive: true });
  await writeFile(join(dir, 'archive', '2026-10-21.html'), '<html><head><meta name="description" content="昨天"><meta name="ai-signal-updated-at" content="2026-10-23T02:00:00.000Z"></head><body><h1>昨天的头条</h1></body></html>');
  await publishWeb(dir, issue, { ...meta, updatedAt: '2026-10-22T02:13:59.000Z' });

  const landing = await readFile(join(dir, 'index.html'), 'utf-8');
  assert.ok(landing.includes('测试头条 &lt;b&gt;') && landing.includes('阅读最新一期') && landing.includes('href="latest/"'));
  assert.ok(!landing.includes('今天这期'), 'latest/ is the newest issue, which before the morning send is yesterday\'s: never call it today\'s');
  assert.ok(landing.includes('从 97 条新内容里选了 9 条') && landing.includes('Techmeme 6 · Reddit 10') && landing.includes('当天没取到：Techmeme'), 'the hero shows the latest issue and its real numbers');
  assert.ok(landing.includes('网页存档从 10 月 21 日起，已连续 2 期') && !landing.includes('创刊'), 'the run length is read from the archive');
  assert.ok(landing.includes('每天约 97 条候选内容') && landing.includes('平均每天有 97 条候选内容') && landing.includes('入选 9 条'), 'daily volume is averaged from the archived issues, not typed in');
  assert.ok(!landing.includes('21 年'), 'no age that turns false by itself');
  for (const part of ['为什么做', '怎么解决', '参考了谁', '信源从哪来', 'AI 怎么挑', '技术架构', '为什么选它', '写错了怎么办']) assert.ok(landing.includes(part), `homepage covers ${part}`);
  assert.ok(landing.includes('计划每天 10:00') && landing.includes('可能延迟'), 'the site does not guarantee publishing time');
  assert.ok(landing.includes('不等于已核实') && landing.includes('没有人工编辑') && !landing.includes('不断供'), 'source and reliability claims are limited');
  assert.ok(landing.includes('deepseek-flash') && landing.includes('DeepSeek-V4.1-Flash') && landing.includes('选稿三问') && landing.includes('GitHub Actions'), 'homepage names the real model, its rules and the pipeline');
  // What the model really sees: titles and short summaries, not articles. These two guards were in the previous page; keep them.
  assert.ok(landing.includes('摘要可能遗漏细节') && landing.includes('不是全文') && landing.includes('Hacker News 和 Techmeme 只有标题'), 'the page says what the model reads and that summaries can miss detail');
  assert.ok(!landing.includes('编不出假链接') && !landing.includes('写不出链接') && !landing.includes('读一遍'), 'no claim that the model never makes mistakes or reads everything');
  assert.ok(landing.includes('7.9%') && landing.includes('48.1%') && landing.includes('archive/2026-11-03.html') && landing.includes('rikiyat.github.io'), 'the correction links to the study and the corrected issue');
  assert.ok(['https://tldr.tech/ai', 'https://www.therundown.ai/', 'https://www.techmeme.com/'].every((u) => landing.includes(u)), 'references link to the publications they describe');
  const copy = landing.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');
  assert.ok(!copy.includes('你'), 'the page does not address the reader as 你');
  assert.ok(!/赋能|打造|极致|顶级|助力|颠覆/.test(copy), 'no hype words');
  const checkedEmail = renderIssue(issue, meta, { mode: 'email' });
  assert.ok(checkedEmail.includes('不代表事实已核实') && !checkedEmail.includes('每天北京时间 10:00 送达'), 'signals and delivery claims are qualified');
  assert.ok(!landing.includes('10:00 整发出邮件'));
  assert.ok(landing.includes('prefers-color-scheme:dark'), 'follows the system dark mode');
  // The only script allowed: the back link to the author's personal site (scripts/back.js).
  const { BACK_SCRIPT } = await import('../back.js');
  assertSelfContained(landing.replace(BACK_SCRIPT, ''), 'product page');
  assert.equal((landing.match(/<script/g) || []).length, 1, 'exactly one script: the back link');
  assert.ok(landing.includes('data-qxj-back hidden'), 'the back link is hidden until the visitor came from the personal site');

  const data = JSON.parse(await readFile(join(dir, 'latest.json'), 'utf-8'));
  assert.equal(data.headline, '测试头条 <b>', 'latest.json carries plain text, not HTML');
  assert.equal(data.date, '2026-10-22');
  assert.ok(data.url.endsWith('/archive/2026-10-22.html'), 'links to the permanent page of that issue');
  assert.ok(Array.isArray(data.tldr) && data.tldr.length <= 3);
  assert.deepEqual(data.sources, { techmeme: 6, reddit: 10 }, 'per-source counts, for the product page');
  assert.deepEqual(data.missing, ['Techmeme'], 'failed sources by name, without error details');
  assert.equal(data.degraded, false);
  // The product page is a pure function of latest.json and the archive, so a rebuild gives the same page.
  const { rebuildHome } = await import('../publish.js');
  await rebuildHome(dir);
  assert.equal(await readFile(join(dir, 'index.html'), 'utf-8'), landing, 'rebuild-home.js reproduces the published page');
  const latest = await readFile(join(dir, 'latest', 'index.html'), 'utf-8');
  assert.ok(latest.includes('href="../archive/"'), 'links lead back from latest/');
  assert.equal(latest, await readFile(join(dir, 'archive', '2026-10-22.html'), 'utf-8'));

  const feed = new XMLParser({ ignoreAttributes: false }).parse(await readFile(join(dir, 'feed.xml'), 'utf-8')).feed;
  const entries = [].concat(feed.entry);
  assert.deepEqual(entries.map((e) => e.title), ['测试头条 <b>', '昨天的头条'], 'newest first');
  assert.equal(entries[0].updated, '2026-10-22T02:13:59.000Z', 'feed uses the recorded content update time, not a fixed 10:00');
  assert.equal(feed.updated, '2026-10-23T02:00:00.000Z', 'later corrections to an older issue update the feed');
  const { entryFromArchive } = await import('../site.js');
  assert.equal(entryFromArchive('<h1>old</h1>', '2026-10-20').updated, '2026-10-20T00:00:00Z', 'unrecorded old issues use a date-only placeholder');
  assert.equal(entries[1].summary, '昨天');
  assert.ok((await readFile(join(dir, 'archive', 'index.html'), 'utf-8')).includes('第 2 期 · 2026-10-22'));
});

test('product page: degraded issues, a single issue, gaps and an old latest.json never print placeholder text', async () => {
  const { renderLanding } = await import('../site.js');
  const base = { number: 3, date: '2026-10-22', dateLabel: '10月22日周四', scanned: 50, picked: 20, minutes: 4, headline: 'H', intro: 'I', tldr: ['a', 'b', 'c'], url: 'u' };
  const cases = {
    old: [base, { dates: ['2026-10-22', '2026-10-21', '2026-10-20'] }], // latest.json from before sources/missing/degraded existed
    degraded: [{ ...base, tldr: [], intro: '', degraded: true, sources: { blogs: 4, hackernews: 6 }, missing: [] }, { dates: ['2026-10-22'] }],
    gap: [{ ...base, sources: {}, missing: ['Techmeme'] }, { dates: ['2026-10-22', '2026-10-20'] }],
    first: [{ ...base, scanned: 0, picked: 0 }, { dates: [] }],
    nulls: [{ ...base, sources: null, missing: null }, { dates: ['2026-10-22'], stats: null }],
  };
  for (const [name, [data, opts]] of Object.entries(cases)) {
    const text = renderLanding(data, opts).replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    assert.ok(!/undefined|NaN|\[object|null/.test(text), `${name}: no placeholder text on the page`);
    assertSelfContained(renderLanding(data, opts).replace(/<script>[\s\S]*?<\/script>/g, ''), name);
  }
  const degraded = renderLanding(...cases.degraded);
  assert.ok(degraded.includes('模型当天不可用') && degraded.includes('共 1 期') && !degraded.includes('一天没断'), 'a degraded day and a single issue are described as what they are');
  assert.ok(renderLanding(...cases.gap).includes('共 2 期') && !renderLanding(...cases.gap).includes('一天没断'), 'a gap in the archive is not called unbroken');
  assert.ok(!renderLanding(...cases.old).includes('当期来源'), 'no source line without per-source counts');
  assert.ok(renderLanding(...cases.nulls).includes('每天几十条候选内容'), 'without archive averages the page makes no number up');
});

test('latest.json names the sources that failed the way readers know them', async () => {
  const { missingNames } = await import('../publish.js');
  assert.deepEqual(
    missingNames(['Reddit (AINews): no AINews issue in the last 48 h', 'config: bad json', 'follow-builders X feed unavailable', 'HF Daily Papers: HTTP 500', 'Techmeme: HTTP 500', 'Techmeme: again']),
    ['Reddit', 'X 上的 builder', 'Hugging Face 论文', 'Techmeme'],
    'readable names, no config entry, no duplicates',
  );
  assert.deepEqual(missingNames(undefined), []);
});

test('a product page that cannot be built never stops the issue from being published', async () => {
  const { mkdtemp, readFile, access } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { publishWeb } = await import('../publish.js');
  const dir = await mkdtemp(join(tmpdir(), 'ai-signal-web-'));
  const errors = mock.method(console, 'error', () => {});
  try {
    await publishWeb(dir, issue, meta, { landing: () => { throw new Error('boom'); } });
  } finally {
    errors.mock.restore();
  }
  assert.ok((await readFile(join(dir, 'latest', 'index.html'), 'utf-8')).includes('测试头条'), 'the issue page is written');
  assert.equal(JSON.parse(await readFile(join(dir, 'latest.json'), 'utf-8')).date, '2026-10-22', 'latest.json is written');
  assert.ok((await readFile(join(dir, 'feed.xml'), 'utf-8')).includes('<entry>'), 'the feed is written');
  await assert.rejects(access(join(dir, 'index.html')), 'no half-written product page is left behind');
  assert.ok(errors.mock.calls.some((c) => String(c.arguments[0]).includes('product page not rebuilt')), 'the failure is logged');
});

test('subscribe: RSS, and the subject line', async () => {
  const { subscribeSection } = await import('../site.js');
  const { subjectFor } = await import('../email.js');
  const sub = subscribeSection();
  assert.ok(sub.includes('feed.xml') && !sub.includes('<form'));
  const html = '<!DOCTYPE html><html><head><title>Mistral 发布 · AI Signal 2026-10-22</title></head><body></body></html>';
  assert.equal(subjectFor(html, new Date('2026-10-22T02:00:00Z')), 'AI Signal 10/22｜Mistral 发布');
});

test('the November 3 correction retains the study limitation and source', async () => {
  const { readFile } = await import('node:fs/promises');
  const archive = await readFile(new URL('../../docs/archive/2026-11-03.html', import.meta.url), 'utf8');
  assert.ok(archive.includes('更正：本期对权重编辑研究') && archive.includes('在另一模型上的测试没有明确提升'));
  assert.ok(archive.includes('https://rikiyat.github.io/blog/weight-space-programming/'));
  assert.ok(!archive.includes('IPO 估值被投资人下调至'));
  const data = JSON.parse(await readFile(new URL('../../docs/latest.json', import.meta.url), 'utf8'));
  if (data.date === '2026-11-03') {
    assert.ok(data.tldr.some((text) => text.includes('推理循环')));
    assert.equal(await readFile(new URL('../../docs/latest/index.html', import.meta.url), 'utf8'), archive);
  }
});
