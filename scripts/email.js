// AI Signal — the email's subject line.

// "AI Signal 10/23｜<the day's headline>", so the inbox list alone is worth reading.
export function subjectFor(html, now = new Date()) {
  const date = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' }).format(now);
  const headline = (String(html).match(/<title>([\s\S]*?) · AI Signal/)?.[1] || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  return headline ? `AI Signal ${date}｜${headline}` : `AI Signal ${date}`;
}
