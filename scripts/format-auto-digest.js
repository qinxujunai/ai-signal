#!/usr/bin/env node
// Reads prepare-digest.js JSON from stdin, outputs a formatted digest email.
// No LLM needed — template-based formatting for automated delivery.

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

const lang = data.config.language || 'bilingual';
const out = [];

out.push('# AI Builders Digest');
out.push('');
out.push(`📋 ${new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
out.push('');

// Podcast
if (data.podcasts && data.podcasts.length > 0) {
  out.push('## Podcast');
  for (const p of data.podcasts) {
    const title = `${p.name}: ${p.title}`;
    const desc = (p.description || '').slice(0, 300);
    out.push(`- **${title}**`);
    if (desc) {
      out.push(`  ${desc}...`);
      if (lang === 'bilingual' || lang === 'zh') {
        out.push(`  (本期播客内容较长，建议用 /ai 获取 LLM 精炼版)`);
      }
    }
    out.push(`  ${p.url}`);
  }
  out.push('');
}

// X/Twitter builders
if (data.x && data.x.length > 0) {
  out.push('## X/Twitter Builders');
  for (const builder of data.x) {
    const role = builder.bio ? builder.bio.split('\n')[0] : '';
    const label = role ? `${builder.name} (@${builder.handle}) — ${role}` : `${builder.name} (@${builder.handle})`;
    out.push(`### ${label}`);
    for (const tweet of (builder.tweets || [])) {
      const text = tweet.text.replace(/\n/g, ' ');
      out.push(`- ${text}`);
      out.push(`  ${tweet.url}`);
    }
    out.push('');
  }
}

out.push('---');
out.push('🤖 这是自动化模板摘要。如需 LLM 精炼版（中英双语、深度分析），输入 /ai。');
out.push(`⏰ 下次自动发送: 每天 10:00 北京时间 (发送到: ${data.config.delivery.email})`);

process.stdout.write(out.join('\n'));
