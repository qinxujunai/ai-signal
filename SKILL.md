---
name: ai
description: /ai — AI Signal · 信号。每天北京时间 10:00 送达的 AI 简报：多信源收集、DeepSeek 按编号编辑、邮件 + 网页版。
---

# AI Signal · 信号

本地跑一期：
```bash
cd scripts && npm ci
node prepare-digest.js --out /tmp/feed.json --seen ../data/seen.json
node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html --web-dir /tmp/web
node deliver.js --file /tmp/digest.html --dry-run      # 去掉 --dry-run 才真的发
```

云端：`.github/workflows/daily.yml` 每天 10:00:00 送达（排程和规则见 `CLAUDE.md`）。
需要的 Secret：`DEEPSEEK_API_KEY`、`QQ_EMAIL`、`QQ_SMTP_AUTH`、`AI_SIGNAL_CONFIG`。
