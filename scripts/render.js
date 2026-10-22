// AI Signal — issue layout, shared by the email and the web edition.
//
// Built for an inbox: one 640px column, tables and inline styles only (QQ Mail, Gmail, Apple Mail,
// Outlook), system fonts, no images, no tracking. The issue opens on a dark masthead (brand, issue
// number, the day's headline and one editor's line), then a 30-second summary, the lead story, and
// colour-coded sections. Every item carries one meta line: tag, signal strength, source, discussion.

const C = {
  bg: '#f2f2f5', card: '#ffffff', ink: '#1d1d1f', text: '#333336', muted: '#6e6e73',
  line: '#e8e8ed', link: '#0066cc', signal: '#e5332a', soft: '#f5f5f7',
  night: '#0b0b0f', nightText: '#d2d2d7', nightMuted: '#a1a1a6',
};
// One colour per section; the darker shade is for text on white (4.5:1), the light one for tints.
const SECTION = {
  lead: ['#c4271f', '#fdecea'],
  stories: ['#c4271f', '#fdecea'],
  community: ['#b45309', '#fff4e5'],
  voices: ['#b45309', '#fff4e5'],
  models: ['#4b45c6', '#eeedfc'],
  products: ['#0060c7', '#e8f1fc'],
  papers: ['#8a3fbf', '#f4ebfa'],
  repos: ['#1f7a4a', '#e7f5ec'],
  quick: ['#1d1d1f', '#f5f5f7'],
  podcast: ['#8a3fbf', '#f4ebfa'],
};
const TAG = {
  模型: SECTION.models, 产品: SECTION.products, 工程: SECTION.repos, 开源: SECTION.repos,
  研究: SECTION.papers, 安全与政策: SECTION.lead, 商业: SECTION.community,
};
const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif";
const REPO = 'https://github.com/qinxujunai/ai-signal';
const WEB = 'https://qinxujunai.github.io/ai-signal/';

// Headings keep the table layout's look; they only give the web page (and screen readers) an outline.
const H = (level, html) => `<h${level} style="margin:0;font:inherit;color:inherit;letter-spacing:inherit;">${html}</h${level}>`;
// The red signal dot as the browser-tab icon, inline so the page makes no extra request.
const ICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6' fill='%23e5332a'/%3E%3C/svg%3E">`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n ?? ''));
const a = (url, text, style = '') => `<a href="${esc(url)}" target="_blank" style="color:${C.link};text-decoration:none;${style}">${text}</a>`;
const sep = `<span style="color:#aeaeb2;">&nbsp;·&nbsp;</span>`;

// Signal strength as three dots: ●●○ = carried by two sources, or one very hot one.
const dots = (n) => (n ? `<span style="color:${C.signal};letter-spacing:1px;" title="信号强度 ${n}/3">${'●'.repeat(n)}</span><span style="color:#d2d2d7;letter-spacing:1px;">${'●'.repeat(3 - n)}</span>` : '');

const pill = (text, [fg, tint]) => `<span style="display:inline-block;padding:1px 7px;border-radius:9px;background:${tint};color:${fg};font-size:11px;font-weight:700;line-height:18px;">${esc(text)}</span>`;

function section(key, label, note, rows) {
  if (!rows) return '';
  const [fg] = SECTION[key];
  return `
<tr><td style="padding:34px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="font-size:14px;font-weight:800;color:${C.ink};padding-bottom:9px;border-bottom:2px solid ${C.ink};"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${fg};vertical-align:middle;"></span>&nbsp;&nbsp;<span style="display:inline-block;vertical-align:middle;">${H(2, esc(label))}</span></td>
      <td align="right" style="font-size:12px;color:${C.muted};padding-bottom:9px;border-bottom:2px solid ${C.ink};">${esc(note || '')}</td>
    </tr>
    ${rows}
  </table>
</td></tr>`;
}

// Meta line under an item: tag · signal · source · discussion · other sources.
function metaLine(s) {
  const bits = [];
  if (s.tag) bits.push(pill(s.tag, TAG[s.tag] || SECTION.quick));
  if (s.heat) bits.push(dots(s.heat));
  if (s.source) {
    bits.push(a(s.source.url, `${esc(s.source.label)} ›`));
    if (s.source.discussion && s.source.discussion !== s.source.url) bits.push(a(s.source.discussion, '讨论 ›'));
  }
  for (const x of s.also || []) bits.push(a(x.url, `${esc(x.label)} ›`));
  return `<div style="font-size:12px;line-height:20px;color:${C.muted};margin-top:7px;">${bits.join(sep)}</div>`;
}

function story(s, first) {
  return `
    <tr><td colspan="2" style="padding:16px 0;${first ? '' : `border-top:1px solid ${C.line};`}">
      <a href="${esc(s.source.url)}" target="_blank" style="font-size:16px;line-height:1.45;font-weight:700;color:${C.ink};text-decoration:none;">${esc(s.title)}</a>
      ${s.body ? `<div style="font-size:14px;line-height:1.72;color:${C.text};margin-top:5px;">${esc(s.body)}</div>` : ''}
      ${metaLine(s)}
    </td></tr>`;
}

// Two-column row for ranked lists: a coloured number on the left, the item on the right.
function ranked(key, num, title, url, insight, sub, first) {
  const [fg] = SECTION[key];
  const border = first ? '' : `border-top:1px solid ${C.line};`;
  return `
    <tr>
      <td width="68" valign="top" style="width:68px;padding:13px 0;${border}font-size:15px;font-weight:800;color:${fg};white-space:nowrap;">${num}</td>
      <td valign="top" style="padding:13px 0;${border}">
        <a href="${esc(url)}" target="_blank" style="font-size:15px;line-height:1.45;font-weight:700;color:${C.ink};text-decoration:none;">${esc(title)}</a>
        ${insight ? `<div style="font-size:13px;line-height:1.68;color:${C.text};margin-top:3px;">${esc(insight)}</div>` : ''}
        ${sub ? `<div style="font-size:12px;line-height:1.5;color:${C.muted};margin-top:3px;">${sub}</div>` : ''}
      </td>
    </tr>`;
}

export function renderIssue(issue, meta, { mode = 'email' } = {}) {
  const web = mode === 'web';
  const minutes = Math.max(2, Math.round(meta.picked * 0.18));
  const s = meta.stats || {};
  const sourceLine = [
    s.builders && `X 上 ${s.builders} 位 builder`,
    s.hackernews && `Hacker News ${s.hackernews}`,
    s.techmeme && `Techmeme ${s.techmeme}`,
    s.reddit && `Reddit ${s.reddit}`,
    s.papers && `论文 ${s.papers}`,
    s.models && `热门模型 ${s.models}`,
    s.github && `GitHub ${s.github}`,
    s.products && `Product Hunt ${s.products}`,
    s.blogs && `官方博客 ${s.blogs}`,
    s.chinese && `中文媒体 ${s.chinese}`,
    s.podcasts && `播客 ${s.podcasts}`,
  ].filter(Boolean).join(' · ');

  // ── masthead: brand, issue number, headline, the editor's line, a thin signal stripe ──
  const issueNo = meta.number ? `第 ${meta.number} 期` : '';
  const stripe = (w, color) => `<td width="${w}" height="3" bgcolor="${color}" style="width:${w}px;height:3px;background:${color};font-size:0;line-height:0;">&nbsp;</td>`;
  const masthead = `
<tr><td style="background:${C.night};border-radius:18px 18px 0 0;padding:24px 24px 26px 24px;" bgcolor="${C.night}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="font-size:13px;font-weight:800;color:#ffffff;letter-spacing:0.4px;"><span style="color:${C.signal};">●</span>&nbsp;AI Signal&nbsp;<span style="color:${C.nightMuted};font-weight:600;">信号</span></td>
      <td align="right" style="font-size:12px;color:${C.nightMuted};">${esc(issueNo)}</td>
    </tr>
  </table>
  <div style="font-size:12px;color:${C.nightMuted};margin-top:20px;">${esc(meta.dateLabel)} · 从 ${meta.scanned} 条里选了 ${meta.picked} 条 · 约 ${minutes} 分钟</div>
  <div style="font-size:25px;line-height:1.32;font-weight:800;color:#ffffff;letter-spacing:-0.3px;margin-top:8px;">${H(1, esc(issue.headline))}</div>
  ${issue.intro ? `<div style="font-size:15px;line-height:1.7;color:${C.nightText};margin-top:12px;">${esc(issue.intro)}</div>` : ''}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>${stripe(36, C.signal)}${stripe(18, '#ff9f0a')}${stripe(10, '#5e5ce6')}</tr></table>
</td></tr>`;

  const degraded = issue.degraded ? `
<tr><td style="padding:18px 0 0 0;font-size:13px;line-height:1.6;color:${C.text};">今天的模型服务没有响应，本期按来源热度直接排序，标题保留原文。明天会恢复编辑版。</td></tr>` : '';

  const tldr = issue.tldr?.length ? `
<tr><td style="padding:24px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.soft};border-radius:14px;" bgcolor="${C.soft}">
    <tr><td style="padding:16px 20px 12px 20px;">
      <div style="font-size:12px;font-weight:800;color:${C.muted};margin-bottom:6px;">30 秒读完</div>
      ${issue.tldr.map((t, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="26" valign="top" style="width:26px;padding:5px 0;font-size:15px;font-weight:800;color:${C.signal};">${i + 1}</td><td valign="top" style="padding:5px 0;font-size:14px;line-height:1.65;color:${C.ink};">${esc(t)}</td></tr></table>`).join('')}
    </td></tr>
  </table>
</td></tr>` : '';

  const L = issue.lead;
  const lead = L ? `
<tr><td style="padding:30px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="4" bgcolor="${C.signal}" style="width:4px;background:${C.signal};border-radius:2px;font-size:0;">&nbsp;</td>
    <td style="padding:2px 0 2px 16px;">
      <div style="font-size:12px;font-weight:800;color:${SECTION.lead[0]};">${H(2, '头条')}</div>
      <a href="${esc(L.source.url)}" target="_blank" style="display:block;font-size:21px;line-height:1.4;font-weight:800;color:${C.ink};text-decoration:none;margin-top:6px;">${esc(L.title)}</a>
      ${L.what || L.body ? `<div style="font-size:15px;line-height:1.78;color:${C.text};margin-top:8px;">${esc(L.what || L.body)}</div>` : ''}
      ${L.why ? `<div style="font-size:14px;line-height:1.72;color:${C.ink};margin-top:12px;padding:12px 14px;background:${SECTION.lead[1]};border-radius:10px;"><span style="font-weight:800;color:${SECTION.lead[0]};">为什么重要&nbsp;&nbsp;</span>${esc(L.why)}</div>` : ''}
      ${metaLine({ ...L, tag: '' })}
    </td>
  </tr></table>
</td></tr>` : '';

  const stories = issue.stories?.length ? section('stories', '要闻', `${issue.stories.length} 条`, issue.stories.map((x, i) => story(x, i === 0)).join('')) : '';

  const community = issue.community?.length ? section('community', '社区在聊', 'Reddit · 经 AINews', issue.community.map((c, i) => `
    <tr><td colspan="2" style="padding:14px 0;${i ? `border-top:1px solid ${C.line};` : ''}">
      <a href="${esc(c.url)}" target="_blank" style="font-size:15px;line-height:1.5;font-weight:700;color:${C.ink};text-decoration:none;">${esc(c.title)}</a>
      ${c.point ? `<div style="font-size:14px;line-height:1.7;color:${C.text};margin-top:4px;">${esc(c.point)}</div>` : ''}
      <div style="font-size:12px;margin-top:6px;">${a(c.url, `${esc(c.label)} ›`)}</div>
    </td></tr>`).join('')) : '';

  const voices = issue.voices?.length ? section('voices', '观点', '来自 X', issue.voices.map((v, i) => `
    <tr><td colspan="2" style="padding:14px 0;${i ? `border-top:1px solid ${C.line};` : ''}">
      <div style="font-size:15px;line-height:1.72;color:${C.ink};">「${esc(v.point)}」</div>
      <div style="font-size:12px;color:${C.muted};margin-top:5px;">—— ${esc(v.who)}&nbsp; ${a(v.url, '原帖 ›')}</div>
    </td></tr>`).join('')) : '';

  const models = issue.models?.length ? section('models', '新模型', 'Hugging Face 热门', issue.models.map((m, i) =>
    ranked('models', `♥ ${k(m.likes)}`, m.name, m.url, m.insight, esc(m.task || ''), i === 0)).join('')) : '';

  const products = issue.products?.length ? section('products', '新产品', 'Product Hunt', issue.products.map((p, i) =>
    ranked('products', '→', p.name, p.url, p.insight, '', i === 0)).join('')) : '';

  const papers = issue.papers?.length ? section('papers', '论文', 'Hugging Face 今日热榜', issue.papers.map((p, i) =>
    ranked('papers', `▲${p.upvotes ?? ''}`, p.title, p.url, p.insight, p.original && p.original !== p.title ? esc(p.original) : '', i === 0)).join('')) : '';

  const repos = issue.repos?.length ? section('repos', '开源', 'GitHub 今日趋势', issue.repos.map((r, i) =>
    ranked('repos', r.starsToday ? `+${k(r.starsToday)}` : `${k(r.stars)}★`, r.name, r.url, r.insight, [r.language, r.stars && `${k(r.stars)}★`].filter(Boolean).map(esc).join(' · '), i === 0)).join('')) : '';

  const quick = issue.quick?.length ? section('quick', '快讯', '', issue.quick.map((q, i) => `
    <tr><td colspan="2" style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-size:14px;line-height:1.6;color:${C.ink};">
      ${esc(q.text)}&nbsp; ${a(q.url, `${esc(q.label)} ›`, 'font-size:12px;')}
    </td></tr>`).join('')) : '';

  const P = issue.podcast;
  const podcast = P ? section('podcast', '播客', P.name, `
    <tr><td colspan="2" style="padding:14px 0 4px 0;">
      <a href="${esc(P.url)}" target="_blank" style="font-size:16px;line-height:1.45;font-weight:700;color:${C.ink};text-decoration:none;">${esc(P.title)}</a>
      ${P.takeaway ? `<div style="font-size:14px;line-height:1.7;color:${C.ink};margin-top:6px;"><span style="font-weight:800;">一句话：</span>${esc(P.takeaway)}</div>` : ''}
      ${(P.points || []).map((x) => `<div style="font-size:14px;line-height:1.7;color:${C.text};margin-top:4px;">· ${esc(x)}</div>`).join('')}
      <div style="font-size:12px;margin-top:8px;">${a(P.url, '收听 ›')}</div>
    </td></tr>`) : '';

  const missing = (meta.missing || []).length ? `<br>今天没取到：${esc(meta.missing.map((m) => m.split(':')[0]).join('、'))}。` : '';

  const body = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};" bgcolor="${C.bg}">
<tr><td align="center" style="padding:${web ? '24px 8px' : '12px 6px'};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:${C.card};border-radius:18px;" bgcolor="${C.card}">
  ${masthead}
  <tr><td style="padding:2px 24px 30px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${degraded}
      ${tldr}
      ${lead}
      ${stories}
      ${community}
      ${voices}
      ${models}
      ${products}
      ${papers}
      ${repos}
      ${quick}
      ${podcast}
      <tr><td style="padding:36px 0 0 0;font-size:12px;line-height:1.75;color:${C.muted};">
        <span style="color:${C.signal};">●●●</span> 信号强度：几个独立来源报道了同一件事，或这条在社区里有多热。<br>
        AI Signal 每天北京时间 10:00 送达。今天的来源：${esc(sourceLine)}。由 DeepSeek 按编辑标准挑选，每一条都链接原文；没有链接的内容不会出现，发过的内容不会重复。${missing}<br>
        ${web ? a('archive/', '往期 ›') : a(WEB, '网页版 ›')}&nbsp;&nbsp; ${a(`${WEB}archive/`, '全部往期 ›')}&nbsp;&nbsp; ${a(REPO, '源码 ›')}
      </td></tr>
    </table>
  </td></tr>
  </table>
</td></tr>
</table>`;

  const preheader = esc(issue.intro || issue.tldr?.[0] || issue.lead?.title || '');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(issue.headline)} · AI Signal ${esc(meta.ymd)}</title>
${web ? `<meta name="description" content="${preheader}">\n${ICON}` : ''}
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.bg};">${preheader}</div>
${web ? `<main>${body}</main>` : body}
</body>
</html>
`;
}

export function renderArchive(dates) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>往期 · AI Signal</title>
${ICON}
</head>
<body style="margin:0;padding:32px 16px;background:${C.bg};font-family:${FONT};">
<main style="display:block;max-width:640px;margin:0 auto;background:${C.card};border-radius:18px;padding:28px;">
<div style="font-size:13px;font-weight:800;color:${C.ink};"><span style="color:${C.signal};">●</span>&nbsp;AI Signal&nbsp;<span style="color:${C.muted};font-weight:600;">信号</span></div>
<h1 style="font-size:26px;color:${C.ink};margin:18px 0 12px 0;">往期 · ${dates.length} 期</h1>
${dates.map((d, i) => `<div style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ''}">${a(`${d}.html`, `第 ${dates.length - i} 期 · ${d}`, 'font-size:15px;')}</div>`).join('\n')}
<div style="margin-top:20px;font-size:12px;">${a('../', '最新一期 ›')}&nbsp;&nbsp; ${a(REPO, '源码 ›')}</div>
</main>
</body>
</html>
`;
}
