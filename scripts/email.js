// AI Signal — what every copy of the email shares: its subject, and the body Buttondown sends.

import * as cheerio from 'cheerio';

// "AI Signal 10/23｜<the day's headline>", so the inbox list alone is worth reading.
export function subjectFor(html, now = new Date()) {
  const date = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' }).format(now);
  const headline = (String(html).match(/<title>([\s\S]*?) · AI Signal/)?.[1] || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  return headline ? `AI Signal ${date}｜${headline}` : `AI Signal ${date}`;
}

// Buttondown takes the inside of <body>; the marker keeps our tables as HTML instead of Markdown.
// Buttondown adds its own unsubscribe footer.
export function buttondownEmail(html, now = new Date()) {
  const $ = cheerio.load(String(html));
  return {
    subject: subjectFor(html, now),
    body: `<!-- buttondown-editor-mode: fancy -->\n${($('body').html() || '').trim()}`,
    status: 'about_to_send',
  };
}
