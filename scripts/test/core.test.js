import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  await writeFile(join(dir, 'archive', '2026-10-21.html'), '<html><head><meta name="description" content="昨天"></head><body><h1>昨天的头条</h1></body></html>');
  await publishWeb(dir, issue, meta);

  const landing = await readFile(join(dir, 'index.html'), 'utf-8');
  assert.ok(landing.includes('测试头条 &lt;b&gt;') && landing.includes('阅读今天这期') && landing.includes('href="latest/"'));
  assert.ok(landing.includes('prefers-color-scheme:dark'), 'follows the system dark mode');
  assert.ok(!/<script|https?:\/\/(?!qinxujunai\.github\.io|github\.com)[^"']+\.(css|js)/.test(landing), 'no scripts or external assets');

  const latest = await readFile(join(dir, 'latest', 'index.html'), 'utf-8');
  assert.ok(latest.includes('href="../archive/"'), 'links lead back from latest/');
  assert.equal(latest, await readFile(join(dir, 'archive', '2026-10-22.html'), 'utf-8'));

  const feed = new XMLParser({ ignoreAttributes: false }).parse(await readFile(join(dir, 'feed.xml'), 'utf-8')).feed;
  const entries = [].concat(feed.entry);
  assert.deepEqual(entries.map((e) => e.title), ['测试头条 <b>', '昨天的头条'], 'newest first');
  assert.equal(entries[1].summary, '昨天');
  assert.ok((await readFile(join(dir, 'archive', 'index.html'), 'utf-8')).includes('第 2 期 · 2026-10-22'));
});
