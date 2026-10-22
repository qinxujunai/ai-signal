// AI Signal — issue layout, shared by the email and the web edition.
//
// Built for an inbox: one 640px column, tables and inline styles only (QQ Mail, Gmail, Apple Mail,
// Outlook), system fonts, no images, no tracking. Density comes from structure, not from smaller type:
// a 30-second summary, one lead story, then one-line meta under every item, and compact
// two-column lists for papers and repositories.

const C = {
  bg: '#f5f5f7', card: '#ffffff', ink: '#1d1d1f', text: '#333336', muted: '#6e6e73',
  line: '#e8e8ed', link: '#0066cc', signal: '#e5332a', soft: '#f5f5f7',
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

function section(label, note, rows) {
  if (!rows) return '';
  return `
<tr><td style="padding:30px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="font-size:13px;font-weight:700;color:${C.ink};padding-bottom:8px;border-bottom:2px solid ${C.ink};">${H(2, esc(label))}</td>
      <td align="right" style="font-size:12px;color:${C.muted};padding-bottom:8px;border-bottom:2px solid ${C.ink};">${esc(note || '')}</td>
    </tr>
    ${rows}
  </table>
</td></tr>`;
}

// Meta line under an item: tag · source · original · other sources.
function metaLine(s) {
  const bits = [];
  if (s.tag) bits.push(`<span style="color:${C.ink};font-weight:600;">${esc(s.tag)}</span>`);
  if (s.source) {
    bits.push(a(s.source.url, `${esc(s.source.label)} ›`));
    if (s.source.discussion && s.source.discussion !== s.source.url) bits.push(a(s.source.discussion, '讨论 ›'));
  }
  for (const x of s.also || []) bits.push(a(x.url, `${esc(x.label)} ›`));
  return `<div style="font-size:12px;line-height:1.6;color:${C.muted};margin-top:6px;">${bits.join(`<span style="color:${C.line};">&nbsp;|&nbsp;</span>`)}</div>`;
}

function story(s, first) {
  return `
    <tr><td colspan="2" style="padding:14px 0;${first ? '' : `border-top:1px solid ${C.line};`}">
      <a href="${esc(s.source.url)}" target="_blank" style="font-size:16px;line-height:1.45;font-weight:600;color:${C.ink};text-decoration:none;">${esc(s.title)}</a>
      ${s.body ? `<div style="font-size:14px;line-height:1.7;color:${C.text};margin-top:4px;">${esc(s.body)}</div>` : ''}
      ${metaLine(s)}
    </td></tr>`;
}

// Two-column row for ranked lists: a number on the left, the item on the right.
function ranked(num, title, url, insight, sub, first) {
  return `
    <tr>
      <td width="64" valign="top" style="width:64px;padding:12px 0;${first ? '' : `border-top:1px solid ${C.line};`}font-size:15px;font-weight:700;color:${C.ink};white-space:nowrap;">${num}</td>
      <td valign="top" style="padding:12px 0;${first ? '' : `border-top:1px solid ${C.line};`}">
        <a href="${esc(url)}" target="_blank" style="font-size:15px;line-height:1.45;font-weight:600;color:${C.ink};text-decoration:none;">${esc(title)}</a>
        ${insight ? `<div style="font-size:13px;line-height:1.65;color:${C.text};margin-top:3px;">${esc(insight)}</div>` : ''}
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
    s.papers && `论文 ${s.papers}`,
    s.github && `GitHub ${s.github}`,
    s.blogs && `官方博客 ${s.blogs}`,
    s.chinese && `中文媒体 ${s.chinese}`,
    s.podcasts && `播客 ${s.podcasts}`,
  ].filter(Boolean).join(' · ');

  const tldr = issue.tldr?.length ? `
<tr><td style="padding:22px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.soft};border-radius:12px;">
    <tr><td style="padding:16px 20px 14px 20px;">
      <div style="font-size:12px;font-weight:700;color:${C.muted};margin-bottom:6px;">30 秒读完</div>
      ${issue.tldr.map((t, i) => `<div style="font-size:14px;line-height:1.65;color:${C.ink};padding:3px 0;"><span style="font-weight:700;">${i + 1}.</span>&nbsp; ${esc(t)}</div>`).join('')}
    </td></tr>
  </table>
</td></tr>` : '';

  const L = issue.lead;
  const lead = L ? section('头条', L.tag || '', `
    <tr><td colspan="2" style="padding:14px 0 4px 0;">
      <a href="${esc(L.source.url)}" target="_blank" style="font-size:20px;line-height:1.4;font-weight:700;color:${C.ink};text-decoration:none;">${esc(L.title)}</a>
      ${L.what || L.body ? `<div style="font-size:15px;line-height:1.75;color:${C.text};margin-top:8px;">${esc(L.what || L.body)}</div>` : ''}
      ${L.why ? `<div style="font-size:15px;line-height:1.75;color:${C.text};margin-top:8px;"><span style="font-weight:700;color:${C.ink};">为什么重要：</span>${esc(L.why)}</div>` : ''}
      ${metaLine({ ...L, tag: '' })}
    </td></tr>`) : '';

  const stories = issue.stories?.length ? section('要闻', `${issue.stories.length} 条`, issue.stories.map((x, i) => story(x, i === 0)).join('')) : '';

  const voices = issue.voices?.length ? section('观点', '来自 X', issue.voices.map((v, i) => `
    <tr><td colspan="2" style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ''}">
      <div style="font-size:14px;line-height:1.7;color:${C.ink};">${esc(v.point)}</div>
      <div style="font-size:12px;color:${C.muted};margin-top:4px;">—— ${esc(v.who)}&nbsp; ${a(v.url, '原帖 ›')}</div>
    </td></tr>`).join('')) : '';

  const papers = issue.papers?.length ? section('论文', 'Hugging Face 今日热榜', issue.papers.map((p, i) =>
    ranked(`▲${p.upvotes ?? ''}`, p.title, p.url, p.insight, p.original && p.original !== p.title ? esc(p.original) : '', i === 0)).join('')) : '';

  const repos = issue.repos?.length ? section('开源', 'GitHub 今日趋势', issue.repos.map((r, i) =>
    ranked(r.starsToday ? `+${k(r.starsToday)}` : `${k(r.stars)}★`, r.name, r.url, r.insight, [r.language, r.stars && `${k(r.stars)}★`].filter(Boolean).map(esc).join(' · '), i === 0)).join('')) : '';

  const quick = issue.quick?.length ? section('快讯', '', issue.quick.map((q, i) => `
    <tr><td colspan="2" style="padding:9px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-size:14px;line-height:1.6;color:${C.ink};">
      ${esc(q.text)}&nbsp; ${a(q.url, `${esc(q.label)} ›`, 'font-size:12px;')}
    </td></tr>`).join('')) : '';

  const P = issue.podcast;
  const podcast = P ? section('播客', P.name, `
    <tr><td colspan="2" style="padding:14px 0 4px 0;">
      <a href="${esc(P.url)}" target="_blank" style="font-size:16px;line-height:1.45;font-weight:600;color:${C.ink};text-decoration:none;">${esc(P.title)}</a>
      ${P.takeaway ? `<div style="font-size:14px;line-height:1.7;color:${C.ink};margin-top:6px;"><span style="font-weight:700;">一句话：</span>${esc(P.takeaway)}</div>` : ''}
      ${(P.points || []).map((x) => `<div style="font-size:14px;line-height:1.7;color:${C.text};margin-top:4px;">· ${esc(x)}</div>`).join('')}
      <div style="font-size:12px;margin-top:8px;">${a(P.url, '收听 ›')}</div>
    </td></tr>`) : '';

  const degraded = issue.degraded ? `
<tr><td style="padding:18px 0 0 0;font-size:13px;line-height:1.6;color:${C.text};">今天的模型服务没有响应，本期按来源热度直接排序，标题保留原文。明天会恢复编辑版。</td></tr>` : '';

  const missing = (meta.missing || []).length ? `<br>今天没取到：${esc(meta.missing.map((m) => m.split(':')[0]).join('、'))}。` : '';

  const body = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:${web ? '24px 8px' : '12px 6px'};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:${C.card};border-radius:16px;">
  <tr><td style="padding:24px 22px 28px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-size:13px;font-weight:700;color:${C.ink};"><span style="color:${C.signal};">●</span>&nbsp;AI Signal · 信号</td>
          <td align="right" style="font-size:12px;color:${C.muted};">${esc(meta.dateLabel)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding-top:18px;font-size:24px;line-height:1.32;font-weight:700;color:${C.ink};letter-spacing:-0.3px;">${H(1, esc(issue.headline))}</td></tr>
      <tr><td style="padding-top:8px;font-size:13px;line-height:1.6;color:${C.muted};">从 ${meta.scanned} 条新内容里选了 ${meta.picked} 条 · 约 ${minutes} 分钟读完</td></tr>
      ${degraded}
      ${tldr}
      ${lead}
      ${stories}
      ${voices}
      ${papers}
      ${repos}
      ${quick}
      ${podcast}
      <tr><td style="padding:32px 0 0 0;font-size:12px;line-height:1.7;color:${C.muted};border-bottom:0;">
        AI Signal 每天上午自动生成。今天的来源：${esc(sourceLine)}。由 DeepSeek 按编辑标准挑选，每一条都链接原文；没有链接的内容不会出现，发过的内容不会重复。${missing}<br>
        ${web ? a('archive/', '往期 ›') : a(WEB, '网页版 ›')}&nbsp;&nbsp; ${a(`${WEB}archive/`, '全部往期 ›')}&nbsp;&nbsp; ${a(REPO, '源码 ›')}
      </td></tr>
    </table>
  </td></tr>
  </table>
</td></tr>
</table>`;

  const preheader = esc(issue.tldr?.[0] || issue.lead?.title || '');
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
<main style="display:block;max-width:640px;margin:0 auto;background:${C.card};border-radius:16px;padding:28px;">
<div style="font-size:13px;font-weight:700;color:${C.ink};"><span style="color:${C.signal};">●</span>&nbsp;AI Signal · 信号</div>
<h1 style="font-size:26px;color:${C.ink};margin:18px 0 12px 0;">往期</h1>
${dates.map((d, i) => `<div style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ''}">${a(`${d}.html`, d, 'font-size:15px;')}</div>`).join('\n')}
<div style="margin-top:20px;font-size:12px;">${a('../', '最新一期 ›')}&nbsp;&nbsp; ${a(REPO, '源码 ›')}</div>
</main>
</body>
</html>
`;
}
