// AI Signal — issue layout, shared by the email and the web edition.
//
// Built for an inbox: one 640px column, tables and inline styles only (QQ Mail, Gmail, Apple Mail,
// Outlook), system fonts, no images, no tracking.
//
// The look follows the restraint of Apple's own newsletters and of Stratechery / The Information:
// white page, black type, greys for everything secondary, one blue for links. Hierarchy comes from
// size, weight and space, not colour: no section colours, no tinted pills, no stripes. The only
// "material" is web-only: a translucent bar (backdrop blur) at the top of the page, as on apple.com.

// Seven colours in all; scripts/test checks that nothing else creeps in.
const C = {
  page: '#ffffff', ink: '#1d1d1f', text: '#424245', muted: '#6e6e73',
  line: '#d2d2d7', tile: '#f5f5f7', link: '#0066cc',
};
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Helvetica Neue','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif";
const DISPLAY = "-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang SC','Helvetica Neue','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif";
const REPO = 'https://github.com/qinxujunai/ai-signal';
const WEB = 'https://qinxujunai.github.io/ai-signal/';
const NUM = 'font-variant-numeric:tabular-nums;';

// Headings keep the table layout's look; they only give the web page (and screen readers) an outline.
const H = (level, html) => `<h${level} style="margin:0;font:inherit;color:inherit;letter-spacing:inherit;">${html}</h${level}>`;
// Three dots as the browser-tab icon, inline so the page makes no extra request.
const ICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%231d1d1f'/%3E%3Ccircle cx='4.5' cy='8' r='1.6' fill='%23fff'/%3E%3Ccircle cx='8' cy='8' r='1.6' fill='%23fff'/%3E%3Ccircle cx='11.5' cy='8' r='1.6' fill='%23fff' fill-opacity='.4'/%3E%3C/svg%3E">`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n ?? ''));
// Outside links open a new tab (the email and web editions point at sources); links inside the site do not.
const a = (url, text, style = '') => `<a href="${esc(url)}"${/^https?:/.test(url) ? ' target="_blank"' : ''} style="color:${C.link};text-decoration:none;${style}">${text}</a>`;
const sep = `<span style="color:${C.line};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`;
const rule = (top = 0) => `<tr><td colspan="2" style="padding:${top}px 0 0 0;"><div style="height:1px;line-height:1px;font-size:0;background:${C.line};">&nbsp;</div></td></tr>`;

// Signal strength as three dots: ●●○ = carried by two sources, or one very hot one.
const dots = (n) => (n ? `<span style="color:${C.ink};letter-spacing:1px;" title="信号强度 ${n}/3">${'●'.repeat(n)}</span><span style="color:${C.line};letter-spacing:1px;">${'●'.repeat(3 - n)}</span>` : '');

// A section: a hairline, then a large title with a quiet note on the right.
function section(label, note, rows) {
  if (!rows) return '';
  return `
<tr><td style="padding:48px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${rule()}
    <tr>
      <td style="padding:18px 0 4px 0;font-family:${DISPLAY};font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.2px;color:${C.ink};">${H(2, esc(label))}</td>
      <td align="right" valign="bottom" style="padding:18px 0 6px 0;font-size:13px;color:${C.muted};white-space:nowrap;">${esc(note || '')}</td>
    </tr>
    ${rows}
  </table>
</td></tr>`;
}

// Meta line under an item: tag  |  signal  |  source › discussion ›
function metaLine(s) {
  const bits = [];
  if (s.tag) bits.push(`<span style="color:${C.muted};">${esc(s.tag)}</span>`);
  if (s.heat) bits.push(dots(s.heat));
  const links = [];
  if (s.source) {
    links.push(a(s.source.url, `${esc(s.source.label)} ›`));
    if (s.source.discussion && s.source.discussion !== s.source.url) links.push(a(s.source.discussion, '讨论 ›'));
  }
  for (const x of s.also || []) links.push(a(x.url, `${esc(x.label)} ›`));
  if (links.length) bits.push(links.join('&nbsp;&nbsp; '));
  return `<div style="font-size:13px;line-height:20px;color:${C.muted};margin-top:8px;${NUM}">${bits.join(sep)}</div>`;
}

function story(s, first) {
  return `
    <tr><td colspan="2" style="padding:${first ? 12 : 20}px 0 20px 0;${first ? '' : `border-top:1px solid ${C.line};`}">
      <a href="${esc(s.source.url)}" target="_blank" style="font-size:17px;line-height:1.45;font-weight:600;color:${C.ink};text-decoration:none;">${esc(s.title)}</a>
      ${s.body ? `<div style="font-size:15px;line-height:1.7;color:${C.text};margin-top:6px;">${esc(s.body)}</div>` : ''}
      ${metaLine(s)}
    </td></tr>`;
}

// Two-column row for ranked lists: a quiet figure on the left, the item on the right.
function ranked(num, title, url, insight, sub, first) {
  const border = first ? '' : `border-top:1px solid ${C.line};`;
  const pad = first ? '12px 0 16px 0' : '16px 0';
  return `
    <tr>
      <td width="60" valign="top" style="width:60px;padding:${pad};${border}font-size:14px;line-height:22px;font-weight:600;color:${C.muted};white-space:nowrap;${NUM}">${num}</td>
      <td valign="top" style="padding:${pad};${border}">
        <a href="${esc(url)}" target="_blank" style="font-size:16px;line-height:22px;font-weight:600;color:${C.ink};text-decoration:none;">${esc(title)}</a>
        ${insight ? `<div style="font-size:14px;line-height:1.65;color:${C.text};margin-top:4px;">${esc(insight)}</div>` : ''}
        ${sub ? `<div style="font-size:13px;line-height:1.5;color:${C.muted};margin-top:4px;">${sub}</div>` : ''}
      </td>
    </tr>`;
}

// Web only: the translucent bar of apple.com (backdrop blur over the page), with the wordmark and one link.
const glassBar = (right, home = WEB) => `<div style="position:sticky;top:0;z-index:10;background:rgba(255,255,255,0.72);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(0,0,0,0.08);">
<div style="max-width:640px;margin:0 auto;padding:0 24px;height:48px;display:flex;align-items:center;justify-content:space-between;font-family:${FONT};">
<a href="${home}" style="font-size:15px;font-weight:600;color:${C.ink};text-decoration:none;letter-spacing:-0.1px;">AI Signal</a>
<span style="font-size:13px;">${right}</span>
</div></div>`;
const wordmark = `<span style="font-family:${DISPLAY};font-size:15px;font-weight:700;color:${C.ink};letter-spacing:-0.1px;">AI Signal</span><span style="font-size:15px;color:${C.muted};">&nbsp;信号</span>`;

export function renderIssue(issue, meta, { mode = 'email', base = '' } = {}) {
  const web = mode === 'web';
  // Web editions live in latest/ and archive/; `base` leads back to the site root.
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

  // ── masthead: wordmark and issue, the day's headline, the editor's line, then the facts ──
  const issueNo = meta.number ? `第 ${meta.number} 期` : '';
  const masthead = `
<tr><td style="padding:${web ? 40 : 32}px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      ${web ? '' : `<td>${wordmark}</td>`}
      <td align="${web ? 'left' : 'right'}" style="font-size:13px;color:${C.muted};${NUM}">${esc([issueNo, meta.dateLabel].filter(Boolean).join(' · '))}</td>
    </tr>
  </table>
  <div style="font-family:${DISPLAY};font-size:32px;line-height:1.22;font-weight:700;color:${C.ink};letter-spacing:-0.6px;margin-top:${web ? 12 : 36}px;">${H(1, esc(issue.headline))}</div>
  ${issue.intro ? `<div style="font-size:19px;line-height:1.55;color:${C.text};margin-top:14px;letter-spacing:-0.1px;">${esc(issue.intro)}</div>` : ''}
  <div style="font-size:13px;color:${C.muted};margin-top:18px;${NUM}">从 ${meta.scanned} 条新内容里选了 ${meta.picked} 条 · 约 ${minutes} 分钟读完</div>
</td></tr>`;

  const degraded = issue.degraded ? `
<tr><td style="padding:20px 0 0 0;font-size:14px;line-height:1.6;color:${C.text};">今天的模型服务没有响应，本期按来源热度直接排序，标题保留原文。明天会恢复编辑版。</td></tr>` : '';

  const tldr = issue.tldr?.length ? `
<tr><td style="padding:28px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.tile};border-radius:18px;" bgcolor="${C.tile}">
    <tr><td style="padding:20px 24px 16px 24px;">
      <div style="font-size:13px;font-weight:600;color:${C.muted};margin-bottom:6px;">30 秒读完</div>
      ${issue.tldr.map((t, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="24" valign="top" style="width:24px;padding:6px 0;font-size:16px;line-height:1.6;font-weight:600;color:${C.ink};${NUM}">${i + 1}</td><td valign="top" style="padding:6px 0;font-size:16px;line-height:1.6;color:${C.ink};">${esc(t)}</td></tr></table>`).join('')}
    </td></tr>
  </table>
</td></tr>` : '';

  const L = issue.lead;
  const lead = L ? `
<tr><td style="padding:44px 0 0 0;">
  <div style="font-size:13px;font-weight:600;color:${C.muted};">${H(2, '头条')}</div>
  <a href="${esc(L.source.url)}" target="_blank" style="display:block;font-family:${DISPLAY};font-size:26px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:${C.ink};text-decoration:none;margin-top:8px;">${esc(L.title)}</a>
  ${L.what || L.body ? `<div style="font-size:17px;line-height:1.7;color:${C.text};margin-top:12px;">${esc(L.what || L.body)}</div>` : ''}
  ${L.why ? `<div style="font-size:17px;line-height:1.7;color:${C.text};margin-top:12px;"><span style="font-weight:600;color:${C.ink};">为什么重要。</span>${esc(L.why)}</div>` : ''}
  ${metaLine({ ...L, tag: '' })}
</td></tr>` : '';

  const stories = issue.stories?.length ? section('要闻', `${issue.stories.length} 条`, issue.stories.map((x, i) => story(x, i === 0)).join('')) : '';

  const community = issue.community?.length ? section('社区在聊', 'Reddit · 经 AINews', issue.community.map((c, i) => `
    <tr><td colspan="2" style="padding:${i ? 18 : 12}px 0 18px 0;${i ? `border-top:1px solid ${C.line};` : ''}">
      <a href="${esc(c.url)}" target="_blank" style="font-size:16px;line-height:1.5;font-weight:600;color:${C.ink};text-decoration:none;">${esc(c.title)}</a>
      ${c.point ? `<div style="font-size:15px;line-height:1.7;color:${C.text};margin-top:5px;">${esc(c.point)}</div>` : ''}
      <div style="font-size:13px;margin-top:8px;${NUM}">${a(c.url, `${esc(c.label)} ›`)}</div>
    </td></tr>`).join('')) : '';

  // Voices read as pull quotes: larger type, the speaker underneath.
  const voices = issue.voices?.length ? section('观点', '来自 X', issue.voices.map((v, i) => `
    <tr><td colspan="2" style="padding:${i ? 20 : 14}px 0 20px 0;${i ? `border-top:1px solid ${C.line};` : ''}">
      <div style="font-family:${DISPLAY};font-size:19px;line-height:1.55;font-weight:500;color:${C.ink};letter-spacing:-0.1px;">「${esc(v.point)}」</div>
      <div style="font-size:13px;color:${C.muted};margin-top:8px;">${esc(v.who)}&nbsp;&nbsp; ${a(v.url, '原帖 ›', 'text-decoration:underline;text-underline-offset:2px;')}</div>
    </td></tr>`).join('')) : '';

  const models = issue.models?.length ? section('新模型', 'Hugging Face 热门', issue.models.map((m, i) =>
    ranked(`♥ ${k(m.likes)}`, m.name, m.url, m.insight, esc(m.task || ''), i === 0)).join('')) : '';

  const products = issue.products?.length ? section('新产品', 'Product Hunt', issue.products.map((p, i) =>
    ranked(String(i + 1).padStart(2, '0'), p.name, p.url, p.insight, '', i === 0)).join('')) : '';

  const papers = issue.papers?.length ? section('论文', 'Hugging Face 今日热榜', issue.papers.map((p, i) =>
    ranked(`▲ ${p.upvotes ?? ''}`, p.title, p.url, p.insight, p.original && p.original !== p.title ? esc(p.original) : '', i === 0)).join('')) : '';

  const repos = issue.repos?.length ? section('开源', 'GitHub 今日趋势', issue.repos.map((r, i) =>
    ranked(r.starsToday ? `+${k(r.starsToday)}` : `★ ${k(r.stars)}`, r.name, r.url, r.insight, [r.language, r.stars && `★ ${k(r.stars)}`].filter(Boolean).map(esc).join(' · '), i === 0)).join('')) : '';

  const quick = issue.quick?.length ? section('快讯', '', issue.quick.map((q, i) => `
    <tr><td colspan="2" style="padding:${i ? 14 : 10}px 0 14px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-size:15px;line-height:1.6;color:${C.ink};">
      ${esc(q.text)}&nbsp;&nbsp;${a(q.url, `${esc(q.label)} ›`, 'font-size:13px;')}
    </td></tr>`).join('')) : '';

  const P = issue.podcast;
  const podcast = P ? section('播客', P.name, `
    <tr><td colspan="2" style="padding:12px 0 4px 0;">
      <a href="${esc(P.url)}" target="_blank" style="font-size:17px;line-height:1.45;font-weight:600;color:${C.ink};text-decoration:none;">${esc(P.title)}</a>
      ${P.takeaway ? `<div style="font-size:15px;line-height:1.7;color:${C.ink};margin-top:8px;"><span style="font-weight:600;">一句话。</span>${esc(P.takeaway)}</div>` : ''}
      ${(P.points || []).map((x) => `<div style="font-size:15px;line-height:1.7;color:${C.text};margin-top:4px;">· ${esc(x)}</div>`).join('')}
      <div style="font-size:13px;margin-top:10px;">${a(P.url, '收听 ›')}</div>
    </td></tr>`) : '';

  const missing = (meta.missing || []).length ? `<br>今天没取到：${esc(meta.missing.map((m) => m.split(':')[0]).join('、'))}。` : '';

  const body = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};" bgcolor="${C.page}">
<tr><td align="center" style="padding:0 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;">
    ${masthead}
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
    <tr><td style="padding:56px 0 48px 0;">
      <div style="height:1px;line-height:1px;font-size:0;background:${C.line};">&nbsp;</div>
      <div style="font-size:12px;line-height:1.8;color:${C.muted};margin-top:16px;">
        信号强度 ${dots(3)}：几个独立来源报道了同一件事，或这条在社区里有多热。<br>
        AI Signal 每天北京时间 10:00 送达。今天的来源：${esc(sourceLine)}。由 DeepSeek 按编辑标准挑选，每一条都链接原文；没有链接的内容不会出现，发过的内容不会重复。${missing}
      </div>
      <div style="font-size:12px;margin-top:12px;">${web ? a(`${base}archive/`, '往期 ›') : a(`${WEB}archive/${meta.ymd}.html`, '网页版 ›')}&nbsp;&nbsp; ${a(`${WEB}archive/`, '全部往期 ›')}&nbsp;&nbsp; ${a(REPO, '源码 ›')}</div>
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
${web ? `<meta name="description" content="${preheader}">\n<meta name="theme-color" content="${C.page}">\n${ICON}` : ''}
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};color:${C.ink};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.page};">${preheader}</div>
${web ? `${glassBar(a(`${base}archive/`, '往期 ›'), base || './')}\n<main>${body}</main>` : body}
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
<meta name="theme-color" content="${C.page}">
<title>往期 · AI Signal</title>
${ICON}
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};color:${C.ink};-webkit-font-smoothing:antialiased;">
${glassBar(a('../latest/', '最新一期 ›'), '../')}
<main style="display:block;max-width:640px;margin:0 auto;padding:40px 24px 56px 24px;">
<h1 style="font-family:${DISPLAY};font-size:32px;line-height:1.2;font-weight:700;letter-spacing:-0.6px;color:${C.ink};margin:0 0 6px 0;">往期</h1>
<div style="font-size:15px;color:${C.muted};margin-bottom:24px;${NUM}">共 ${dates.length} 期 · 每天北京时间 10:00 一期</div>
${dates.map((d, i) => `<div style="padding:14px 0;border-top:1px solid ${C.line};display:flex;justify-content:space-between;${NUM}">${a(`${d}.html`, `第 ${dates.length - i} 期 · ${d}`, 'font-size:16px;')}</div>`).join('\n')}
<div style="border-top:1px solid ${C.line};padding-top:16px;font-size:13px;">${a('../latest/', '最新一期 ›')}&nbsp;&nbsp; ${a('../', '首页 ›')}&nbsp;&nbsp; ${a(REPO, '源码 ›')}</div>
</main>
</body>
</html>
`;
}
